"""Deterministic policy engine — CONTRACTOR as an execution gate.

Answers: given commitment state + evidence + confirmation lineage, which
actions are legal RIGHT NOW? Pure reads (verification is run read-only via
summarize/decide, no transitions), so gating never mutates the obligation.

Distinction that matters:
- FULFILLMENT is about reality (did qualifying evidence arrive?).
- PAYMENT / DISPATCH / CLOSE are about authorization (was this obligation
  mutually confirmed, or does a privileged origin with a recorded reason
  cover it?). A programmatic system obligation can become FULFILLED by
  evidence yet still be barred from releasing payment — the agent cannot
  spend money on an unconfirmed phone promise.
"""
from __future__ import annotations
import json
from . import evidence as evmod
from .models import utcnow_iso


def _row_get(row, key, default=None):
    try:
        return row[key]
    except (KeyError, IndexError, TypeError):
        return default


def confirmed_lineage(store, cid: str) -> dict:
    """Does this obligation carry mutual confirmation (or privileged cover)?"""
    row = store.get_commitment_row(cid)
    conf = json.loads(_row_get(row, "confirmation_json", "{}") or "{}")
    origin = _row_get(row, "origin", "programmatic") or "programmatic"
    if conf and conf.get("terms_hash"):
        return {"confirmed": True, "via": "mutual_confirmation", "origin": origin}
    if origin in ("recovery_import", "migration_import", "system_reconciliation"):
        return {"confirmed": True, "via": f"privileged:{origin}", "origin": origin}
    if origin == "amendment":
        parent = row["parent_id"]
        if parent:
            p = confirmed_lineage(store, parent)
            return {"confirmed": p["confirmed"], "via": f"amendment-of-{p['via']}",
                    "origin": origin}
        return {"confirmed": False, "via": "amendment-without-parent", "origin": origin}
    return {"confirmed": False, "via": "unconfirmed-programmatic", "origin": origin}


def _verdict(store, cid: str, now_iso: str | None):
    row = store.get_commitment_row(cid)
    terms = store.get_terms(cid)
    summary = evmod.summarize_evidence(terms, store.evidence_for(cid), row["deadline"],
                                       effective_at=row["effective_at"])
    return evmod.decide_verdict(summary, now_iso or utcnow_iso(), row["deadline"]), summary


def evaluate(store, cid: str, now_iso: str | None = None) -> dict:
    """Full action table for a commitment. Deterministic. Read-only."""
    row = store.get_commitment_row(cid)
    if row is None:
        from .models import ProtocolError
        raise ProtocolError("UNKNOWN_COMMITMENT", cid)
    state = row["state"]
    verdict, summary = _verdict(store, cid, now_iso)
    lin = confirmed_lineage(store, cid)
    terminal = state in ("FULFILLED", "BREACHED", "EXPIRED", "CANCELLED")

    def no(reason):
        return {"allowed": False, "reason": reason}

    def yes(reason):
        return {"allowed": True, "reason": reason}

    # --- fulfill: reality only (confirmation irrelevant to what happened)
    can_fulfill = (yes(f"qualifying evidence {summary['trusted_before_qty']}/"
                       f"{summary['expected']}")
                   if verdict["verdict"] == "FULFILLMENT_PROVED"
                   else no(verdict["reason"]))
    # --- execution actions: reality AND authorization
    # Dispatch is performance of the obligation: allowed while executable.
    # Payment is settlement: requires proof of fulfillment AND confirmation.
    if not lin["confirmed"]:
        can_pay = no(f"UNCONFIRMED: {lin['via']} — payment requires mutual "
                     "confirmation or privileged cover")
        can_dispatch = no(f"UNCONFIRMED: {lin['via']}")
    elif state == "CONDITIONAL":
        can_pay = no("BLOCKED_CONDITIONAL: condition evidence missing")
        can_dispatch = no("BLOCKED_CONDITIONAL: commitment not executable")
    elif state == "FULFILLED":
        can_pay = yes(f"fulfillment proved + confirmed ({lin['via']})")
        can_dispatch = no("already fulfilled: nothing to dispatch")
    elif state in ("ACTIVE", "AT_RISK"):
        can_dispatch = yes(f"confirmed ({lin['via']}); obligation executable")
        if verdict["verdict"] == "FULFILLMENT_PROVED":
            can_pay = yes(f"fulfillment proved + confirmed ({lin['via']})")
        else:
            can_pay = no(f"no qualifying fulfillment evidence: {verdict['verdict']}")
    else:
        can_pay = no(f"cannot settle {state} obligation")
        can_dispatch = no(f"cannot dispatch {state} obligation")
    # --- amend: living obligations only; never terminal, never pre-lock
    if state in ("ACTIVE", "AT_RISK", "ESCALATED", "BREACHED", "EXPIRED", "CONDITIONAL"):
        can_amend = yes("amendment creates v2; v1 stays immutable")
    else:
        can_amend = no(f"cannot amend obligation in state {state}")
    # --- cancel: pre-terminal only
    if state in ("DRAFT", "NEGOTIATED", "CONFIRMED", "CONDITIONAL", "ACTIVE", "AT_RISK"):
        can_cancel = yes("cancellation is a protocol transition")
    else:
        can_cancel = no(f"cannot cancel obligation in state {state}")
    # --- escalate: risk states only
    if state in ("AT_RISK", "ACTIVE", "ESCALATED"):
        can_escalate = yes("escalation path open")
    else:
        can_escalate = no(f"nothing to escalate in state {state}")
    # --- close: fulfilled or cancelled only; terminal breach must amend, not close
    if state in ("FULFILLED", "CANCELLED"):
        can_close = yes("obligation settled")
    else:
        can_close = no(f"cannot close {state} obligation (amend/recover instead)")
    return {"commitment_id": cid, "state": state,
            "confirmed": lin, "verification": verdict["verdict"],
            "actions": {"fulfill": can_fulfill, "amend": can_amend,
                        "cancel": can_cancel, "escalate": can_escalate,
                        "release_payment": can_pay, "dispatch": can_dispatch,
                        "close": can_close}}
