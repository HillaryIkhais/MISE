"""CONTRACTOR Attack Lab — a product, not a test file.

Interactive surface a developer (or judge) runs to *attack their own
commitment* and see the protocol respond. Every attack returns a structured,
machine-checkable result: what was attempted, what the protocol did, and the
exact rejection code. Runs standalone:

    python3 -m contractor.attacklab            # demo against an in-memory store
    contractor.run_attacks(store, commitment)  # as a library
"""
from __future__ import annotations
import json
from datetime import datetime, timezone, timedelta
from .models import ProtocolError
from . import protocol as _p
from . import formation as _f


def _now():
    return datetime.now(timezone.utc)


def _iso(dt):
    return dt.isoformat()


def _try(fn):
    try:
        fn()
        return {"blocked": False, "verdict": "PASSED (variant succeeded)",
                "code": "", "detail": ""}
    except ProtocolError as e:
        return {"blocked": True, "verdict": "BLOCKED",
                "code": e.reason, "detail": e.detail}


def run_attacks(store, commitment_id: str) -> list[dict]:
    """Run the standard attack battery against `commitment_id`.

    Deterministic order: forge → replay → widen quantity → drop condition →
    rewrite history → premature fulfillment → unconfirmed payment.
    Returns list of {attack, verdict, code, detail}."""
    row = store.get_commitment_row(commitment_id)
    if row is None:
        raise ProtocolError("UNKNOWN_COMMITMENT", commitment_id)
    terms = store.get_terms(commitment_id)
    conds = json.loads(row["conditions_json"] or "[]")
    conf = json.loads(row["confirmation_json"] or "{}")
    actor = row["actor_id"]
    attacks = []

    # 1. forge confirmation
    forged = dict(conf)
    forged["terms_hash"] = "deadbeef"
    attacks.append({
        "attack": "forge_confirmation",
        **_try(lambda: _p.propose_commitment(
            store, {"actor_id": actor, "terms": dict(terms)},
            actor, "Acme", confirmation=forged))})

    # 2. replay confirmation (correct terms+conditions, so only replay blocks)
    attacks.append({
        "attack": "replay_confirmation",
        **_try(lambda: _p.propose_commitment(
            store, {"actor_id": actor, "terms": dict(terms)},
            actor, "Acme", conditions=list(conds), confirmation=conf))})

    # 3. widen quantity
    wide = dict(terms, quantity=float(terms["quantity"]) * 2)
    attacks.append({
        "attack": "widen_quantity",
        **_try(lambda: _p.propose_commitment(
            store, {"actor_id": actor, "terms": dict(wide)},
            actor, "Acme", confirmation=conf))})

    # 4. drop condition
    attacks.append({
        "attack": "drop_condition",
        **_try(lambda: _p.propose_commitment(
            store, {"actor_id": actor, "terms": dict(terms)},
            actor, "Acme", conditions=[], confirmation=conf))})

    # 5. rewrite history (silent mutation)
    attacks.append({
        "attack": "rewrite_history",
        **_try(lambda: _p.update_terms(store, commitment_id, quantity=1))})

    # 6. premature fulfillment: agent claims fulfillment, zero qualifying evidence
    def _premature():
        from . import evidence as _ev
        _p.attach_evidence(store, commitment_id, "agent_claim", "agent",
                           _iso(_now()), {"claim": "all done"},
                           actor="agent")
        ev_rows = store.evidence_for(commitment_id)
        summary = _ev.summarize_evidence(terms, ev_rows, terms["deadline"])
        report = _ev.decide_verdict(summary, _iso(_now()), terms["deadline"])
        if report["verdict"] in ("FULFILLMENT_PROVED", "PARTIAL_FULFILLMENT"):
            raise RuntimeError("agent claim proved fulfillment")
        raise ProtocolError("FULFILLMENT_BLOCKED",
                            "agent claim is untrusted evidence; verdict=%s"
                            % report["verdict"])
    attacks.append({
        "attack": "premature_fulfillment", **_try(_premature)})

    # 7. unconfirmed payment (policy gate)
    from . import policy
    pay = policy.evaluate(store, commitment_id)["actions"]["release_payment"]
    attacks.append({
        "attack": "unconfirmed_payment",
        "blocked": not pay["allowed"], "verdict": "BLOCKED" if not pay["allowed"] else "PASSED",
        "code": pay["reason"] if not pay["allowed"] else "", "detail": pay["reason"]})

    return attacks


def demo() -> int:
    from .store import Store
    store = Store()
    store.upsert_authority("supplier_001", ["inventory", "delivery", "procurement"])
    dl = _iso(_now() + timedelta(hours=2))
    terms = {"action": "deliver", "quantity": 100, "unit": "units",
             "destination": "warehouse_a", "deadline": dl}
    t = ("Yes, I confirm 100 units to warehouse A, if the inbound shipment "
         "arrives Thursday. I commit.")
    p = _f.start_proposal(terms, "negotiating")
    rec = _f.mutual_confirm(p, terms, t, actor_id="supplier_001")
    c = _p.propose_commitment(store, {"actor_id": "supplier_001", "terms": terms},
                              "supplier_001", "Acme", conditions=rec["conditions"],
                              confirmation=rec)
    _p.full_activate(store, c.id)
    print(f"ADVERSARIAL LAB — attacking commitment #{c.id}\n")
    for a in run_attacks(store, c.id):
        verdict = a["verdict"]
        extra = f" [{a['code']}]" if a.get("code") else ""
        print(f"  {a['attack'].replace('_', ' ').ljust(24)} → {verdict}{extra}")
    return 0


if __name__ == "__main__":
    raise SystemExit(demo())