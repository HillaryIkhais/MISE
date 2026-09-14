"""Deterministic fulfillment engine. Evidence-gated transitions.

Invariant: an agent claim (LLM output) NEVER changes commitment state.
Only qualifying evidence (trusted source, before deadline, matching terms)
can drive FULFILLED. Everything else is BLOCKED / CONTRADICTED / CONFLICT.
"""
from __future__ import annotations
from datetime import datetime
from .models import TRUSTED_SOURCES, ProtocolError

# Clock-skew grace: warehouse/ERP clocks may lag the protocol by seconds.
# Evidence observed more than this before effective_at is STALE (replay of an
# old receipt against a new obligation); inside the window it counts.
STALE_SKEW_SECONDS = 300


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts)


def summarize_evidence(terms: dict, evidence_rows, deadline: str,
                       effective_at: str | None = None,
                       requirements: list | None = None,
                       max_age_hours: float | None = None) -> dict:
    expected = float(terms.get("quantity", 0))
    dl = _parse(deadline) if deadline else None
    eff = _parse(effective_at) if effective_at else None
    trusted_before, trusted_after, untrusted, stale = [], [], [], []
    for r in evidence_rows:
        import json
        payload = json.loads(r["payload_json"])
        try:
            q = float(payload.get("quantity", 0))
        except (TypeError, ValueError):
            q = 0.0
        obs = _parse(r["observed_at"])
        rec = {"id": r["id"], "source": r["source"], "type": r["type"],
               "quantity": q, "observed_at": r["observed_at"]}
        # stale: observed well before the obligation existed (replay), or
        # older than max age
        if r["type"] == "condition_proof":
            continue  # condition proofs don't count toward quantity
        if eff and (eff - obs).total_seconds() > STALE_SKEW_SECONDS:
            stale.append({**rec, "stale_reason": "observed before effective_at"})
            continue
        if max_age_hours is not None:
            from datetime import timezone as _tz
            age_h = (datetime.now(_tz.utc) - obs).total_seconds() / 3600
            if age_h > max_age_hours:
                stale.append({**rec, "stale_reason": f"age {age_h:.1f}h > {max_age_hours}h"})
                continue
        if r["source"] in TRUSTED_SOURCES:
            if dl and obs > dl:
                trusted_after.append(rec)
            else:
                trusted_before.append(rec)
        else:
            untrusted.append(rec)
    total_before = sum(r["quantity"] for r in trusted_before)
    total_after = sum(r["quantity"] for r in trusted_after)
    # conflict: any untrusted quantity disagreeing with trusted total
    conflict = None
    for u in untrusted:
        if trusted_before and abs(u["quantity"] - total_before) > 1e-9:
            # untrusted claims a different reality than trusted systems
            conflict = {
                "trusted_total": total_before,
                "untrusted_claim": u,
            }
            break
    return {
        "expected": expected,
        "trusted_before_qty": total_before,
        "trusted_after_qty": total_after,
        "trusted_before": trusted_before,
        "trusted_after": trusted_after,
        "untrusted": untrusted,
        "stale": stale,
        "conflict": conflict,
        "requirements": requirements or [],
    }


def decide_verdict(summary: dict, now_iso: str, deadline: str) -> dict:
    """Pure function -> {verdict, fulfillment, next_state, reason}."""
    from .models import ACTIVE, AT_RISK, FULFILLED, BREACHED, EXPIRED
    expected = summary["expected"]
    tb = summary["trusted_before_qty"]
    ta = summary["trusted_after_qty"]
    has_trusted_before = len(summary["trusted_before"]) > 0
    has_any_trusted = has_trusted_before or len(summary["trusted_after"]) > 0
    conflict = summary["conflict"]
    now = _parse(now_iso)
    dl = _parse(deadline) if deadline else None
    past_deadline = bool(dl and now > dl)

    if conflict:
        # trusted shortfall + contradictory phone claim => breach w/ conflict
        if tb < expected and (past_deadline or has_trusted_before):
            # explicit policy: partial before deadline -> AT_RISK; at/past -> BREACHED
            state = BREACHED if past_deadline else AT_RISK
            # partial before deadline -> AT_RISK (policy explicit)
            return {"verdict": "UNRESOLVED_CONFLICT", "fulfillment": "BLOCKED",
                    "next_state": state,
                    "reason": f"EVIDENCE CONFLICT: trusted={tb} vs "
                              f"{conflict['untrusted_claim']['source']}="
                              f"{conflict['untrusted_claim']['quantity']}"}
        return {"verdict": "UNRESOLVED_CONFLICT", "fulfillment": "BLOCKED",
                "next_state": None,
                "reason": "conflicting evidence, fulfillment blocked"}

    if tb >= expected and expected > 0:
        return {"verdict": "FULFILLMENT_PROVED", "fulfillment": "FULFILLED",
                "next_state": FULFILLED,
                "reason": f"qualifying evidence {tb}/{expected} before deadline"}

    if has_trusted_before and tb < expected:
        # partial fulfillment observed
        if past_deadline:
            return {"verdict": "PARTIAL_FULFILLMENT", "fulfillment": "BREACHED",
                    "next_state": BREACHED,
                    "reason": f"PARTIAL {tb}/{expected} at deadline"}
        return {"verdict": "PARTIAL_FULFILLMENT", "fulfillment": "AT_RISK",
                "next_state": AT_RISK,
                "reason": f"PARTIAL {tb}/{expected} before deadline -> AT_RISK"}

    # no qualifying trusted evidence before deadline
    if past_deadline:
        if ta >= expected:
            return {"verdict": "DEADLINE_EXCEEDED", "fulfillment": "EXPIRED",
                    "next_state": EXPIRED,
                    "reason": f"late evidence {ta}/{expected} after deadline — EXPIRED"}
        if has_any_trusted or summary["untrusted"]:
            # something arrived late / only phone claims exist
            if ta > 0:
                return {"verdict": "DEADLINE_EXCEEDED", "fulfillment": "EXPIRED",
                        "next_state": EXPIRED, "reason": "evidence after deadline"}
            return {"verdict": "NO_QUALIFYING_EVIDENCE", "fulfillment": "EXPIRED",
                    "next_state": EXPIRED,
                    "reason": "deadline passed with no qualifying evidence"}
        return {"verdict": "NO_QUALIFYING_EVIDENCE", "fulfillment": "EXPIRED",
                "next_state": EXPIRED, "reason": "deadline passed, no evidence"}

    # before deadline, nothing yet
    if summary["untrusted"] and not has_any_trusted:
        return {"verdict": "FULFILLMENT_BLOCKED", "fulfillment": "BLOCKED",
                "next_state": None,
                "reason": "agent/phone claim without qualifying evidence — BLOCKED. "
                          "A promise is not proof."}
    return {"verdict": "AWAITING_EVIDENCE", "fulfillment": "PENDING",
            "next_state": None, "reason": "awaiting qualifying evidence"}
