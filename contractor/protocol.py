"""Protocol validator + state machine. Only this module mutates commitment state."""
from __future__ import annotations
import json
import uuid
from datetime import datetime, timezone
from .models import (
    ALLOWED_TRANSITIONS, AMENDABLE_STATES, REQUIRED_TERMS,
    DRAFT, NEGOTIATED, CONFIRMED, CONDITIONAL, ACTIVE, CANCELLED,
    Commitment, Evidence, ProtocolError,
    canonical, sha256, utcnow_iso, fingerprint_terms, TRUSTED_SOURCES,
)
from .store import Store
from .authority import check_authority
from .audit import append_event
from . import evidence as evmod
from . import formation as fmod


def _nid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def _parse(ts: str | None):
    if not ts:
        return None
    return datetime.fromisoformat(ts)


# ------------------------------------------------------------ validation

def validate_candidate(candidate: dict) -> dict:
    """Validate terms shape. Returns normalized canonical terms or raises.

    Canonical term model: action, quantity, unit, destination, deadline are
    required. object, price, currency, cancellation_terms are optional but,
    once confirmed, become part of the obligation — changing any of them
    constitutes a materially different obligation (see formation gate).
    """
    terms = candidate.get("terms", candidate)
    missing = [f for f in REQUIRED_TERMS if f not in terms or terms[f] in (None, "")]
    if missing:
        raise ProtocolError("INVALID_COMMITMENT", f"MISSING: {', '.join(missing)}")
    try:
        qty = float(terms["quantity"])
    except (TypeError, ValueError):
        raise ProtocolError("INVALID_COMMITMENT", "quantity must be numeric")
    if qty <= 0:
        raise ProtocolError("INVALID_COMMITMENT", "quantity must be > 0")
    if not terms.get("action") or not terms.get("destination"):
        raise ProtocolError("INVALID_COMMITMENT", "action/destination required")
    dl = _parse(terms["deadline"])
    if not dl:
        raise ProtocolError("INVALID_COMMITMENT", "deadline unparsable")
    norm = {
        "action": str(terms["action"]),
        "quantity": qty,
        "unit": str(terms["unit"]),
        "destination": str(terms["destination"]),
        "deadline": dl.isoformat(),
    }
    if terms.get("object") not in (None, ""):
        norm["object"] = str(terms["object"])
    if terms.get("price") not in (None, ""):
        try:
            price = float(terms["price"])
        except (TypeError, ValueError):
            raise ProtocolError("INVALID_COMMITMENT", "price must be numeric")
        if price < 0:
            raise ProtocolError("INVALID_COMMITMENT", "price must be >= 0")
        norm["price"] = price
    if terms.get("currency") not in (None, ""):
        cur = str(terms["currency"]).upper()
        if len(cur) != 3 or not cur.isalpha():
            raise ProtocolError("INVALID_COMMITMENT", "currency must be a 3-letter code")
        norm["currency"] = cur
    if terms.get("cancellation_terms") not in (None, ""):
        norm["cancellation_terms"] = str(terms["cancellation_terms"])
    return norm


def _transition(store: Store, cid: str, to_state: str, actor: str, extra: dict | None = None):
    row = store.get_commitment_row(cid)
    if not row:
        raise ProtocolError("UNKNOWN_COMMITMENT", cid)
    cur = row["state"]
    if to_state == cur:
        return cur
    allowed = ALLOWED_TRANSITIONS.get(cur, set())
    if to_state not in allowed:
        raise ProtocolError("INVALID_STATE_TRANSITION", f"{cur} -> {to_state} forbidden")
    store.update_state(cid, to_state)
    append_event(store, cid, f"STATE_{to_state}", actor, {"from": cur, **(extra or {})})
    return to_state


# ------------------------------------------------------------ lifecycle

def propose_commitment(store: Store, candidate: dict, actor_id: str,
                       actor_name: str, required_scope: str = "procurement",
                       source_call_id: str | None = None,
                       at: str | None = None,
                       conditions: list | None = None,
                       evidence_requirements: list | None = None,
                       provenance: dict | None = None,
                       confirmation: dict | None = None,
                       origin: str = "programmatic") -> Commitment:
    """LLM proposes; protocol disposes.

    Full gate: authority + terms + temporal + confirmation + duplicate.
    The raw path creates a PROGRAMMATIC, UNCONFIRMED obligation — it can never
    manufacture human confirmation. Only propose_from_formation() (origin
    'formation') staples a mutual-confirmation record, and that record must
    pass: hash integrity (FORGED) → TTL (EXPIRED) → actor binding (MISMATCH)
    → non-widening (WIDENED/...) → condition equality → replay (REPLAYED).
    Phone-created obligations SHOULD use propose_from_formation().
    """
    now = at or utcnow_iso()
    # 1. authority (LLM cannot override)
    check_authority(store, actor_id, required_scope, at=now)
    # 2. terms
    if not candidate.get("actor_id"):
        raise ProtocolError("INVALID_COMMITMENT", "MISSING: actor")
    terms = validate_candidate(candidate)
    # 3. temporal: deadline must be in the future relative to creation
    if _parse(terms["deadline"]) <= _parse(now):
        raise ProtocolError("INVALID_COMMITMENT", "deadline must be after creation")
    # 4. formation gate (non-widening) when a confirmation record exists
    conds = list(conditions or candidate.get("conditions") or [])
    replay_key = None
    if confirmation is not None:
        conf_terms = confirmation.get("confirmed_terms", {})
        # 4a. integrity: the record must be exactly what the gate produced
        if confirmation.get("terms_hash") != sha256(canonical(conf_terms)):
            raise ProtocolError("CONFIRMATION_FORGED",
                                "terms_hash does not match confirmed terms")
        # 4b. freshness: confirmations expire (default 48h)
        if confirmation.get("confirmed_at"):
            from .formation import CONFIRMATION_TTL_HOURS
            age_h = (_parse(now) - _parse(confirmation["confirmed_at"])).total_seconds() / 3600
            if age_h > CONFIRMATION_TTL_HOURS:
                raise ProtocolError("CONFIRMATION_EXPIRED",
                                    f"confirmation is {age_h:.1f}h old "
                                    f"(TTL {CONFIRMATION_TTL_HOURS}h)")
        # 4c. identity: a confirmation by X cannot commit Y
        if confirmation.get("actor_id") and confirmation["actor_id"] != actor_id:
            raise ProtocolError("CONFIRMATION_ACTOR_MISMATCH",
                                f"confirmed by {confirmation['actor_id']}, "
                                f"commitment for {actor_id}")
        # 4d. non-widening: Committed Terms ⊆ Mutually Confirmed Terms
        conf_conds = confirmation.get("conditions", [])
        fmod.check_non_widening({**conf_terms, "conditions": conf_conds},
                                {**terms, "conditions": conds})
        if {c.lower() for c in conds} != {c.lower() for c in conf_conds}:
            raise ProtocolError("CONDITION_DROPPED",
                                f"confirmed {conf_conds} vs committed {conds}")
        if confirmation.get("call_id") and source_call_id and \
                confirmation["call_id"] != source_call_id:
            raise ProtocolError("CONFIRMATION_MISMATCH", "confirmation call != source call")
        # 4e. replay: one confirmation commits exactly once
        replay_key = sha256(canonical({"actor": actor_id,
                                       "terms_hash": confirmation["terms_hash"]}))
        if store.confirmation_replayed(replay_key):
            raise ProtocolError("CONFIRMATION_REPLAYED",
                                "this confirmation already created a commitment")
    # 5. duplicate fingerprint (actor + terms + conditions)
    fp = fingerprint_terms({"actor": actor_id, **terms, "conditions": sorted(conds)})
    if store.fingerprint_exists(fp):
        raise ProtocolError("DUPLICATE_COMMITMENT", "identical obligation already exists")
    cid = candidate.get("id") or f"c_{uuid.uuid4().hex[:8]}"
    if store.get_commitment_row(cid):
        raise ProtocolError("DUPLICATE_COMMITMENT_ID", cid)
    reqs = evidence_requirements or candidate.get("evidence_requirements") or [
        {"type": "shipment_receipt", "source_class": "trusted",
         "field": "quantity", "rule": "sum_trusted_before_deadline >= quantity"}]
    c = Commitment(
        id=cid, parent_id=candidate.get("parent_id"),
        actor_id=actor_id, actor_name=actor_name or candidate.get("actor", actor_name),
        source_call_id=source_call_id, state=DRAFT,
        created_at=now, effective_at=now, deadline=terms["deadline"],
        fingerprint=fp, terms=terms,
        conditions=conds, evidence_requirements=reqs,
        provenance=provenance or candidate.get("provenance") or {},
        confirmation=confirmation or {},
        origin=origin if (confirmation is None or origin != "programmatic")
        else "formation",
    )
    store.insert_commitment(c)
    if replay_key:
        store.consume_confirmation(replay_key, c.id, now)
    append_event(store, c.id, "COMMITMENT_PROPOSED", actor_id,
                 {"terms": terms, "conditions": conds, "source_call": source_call_id,
                  "confirmed": confirmation is not None})
    append_event(store, c.id, "COMMITMENT_CREATED", "protocol", {"fingerprint": fp})
    return c


def propose_from_formation(store: Store, proposal: dict, confirmed_terms: dict,
                           confirmation_transcript: str, actor_id: str,
                           actor_name: str, required_scope: str = "procurement",
                           call_id: str | None = None,
                           at: str | None = None,
                           evidence_requirements: list | None = None,
                           provenance: dict | None = None) -> Commitment:
    """Phone-created obligations MUST use this path.

    Runs mutual_confirm gate (ambiguity-free + explicit confirmation +
    contradiction check), then creates the commitment with the record stapled.
    Raises AMBIGUITY_UNRESOLVED / CONVERSATION_CONFLICT / *_WIDENED on attack.
    """
    record = fmod.mutual_confirm(proposal, confirmed_terms,
                                 confirmation_transcript, call_id=call_id,
                                 actor_id=actor_id)
    candidate = {"actor_id": actor_id, "actor": actor_name,
                 "terms": {k: confirmed_terms[k] for k in
                           ("action", "quantity", "unit", "destination", "deadline")
                           if k in confirmed_terms}}
    # carry canonical optional terms through the gate (compared, not trusted)
    for k in ("object", "price", "currency", "cancellation_terms"):
        if k in confirmed_terms:
            candidate["terms"][k] = confirmed_terms[k]
    return propose_commitment(
        store, candidate, actor_id, actor_name, required_scope,
        source_call_id=call_id, at=at, conditions=record["conditions"],
        evidence_requirements=evidence_requirements, provenance=provenance,
        confirmation=record)


def negotiate(store: Store, cid: str, actor: str) -> str:
    return _transition(store, cid, NEGOTIATED, actor)


def confirm(store: Store, cid: str, actor: str) -> str:
    return _transition(store, cid, CONFIRMED, actor)


def lock(store: Store, cid: str, actor: str = "protocol") -> str:
    """CONFIRMED -> ACTIVE (or CONDITIONAL when conditions are pending).

    The obligation is now locked and immutable. Conditional obligations rest
    in CONDITIONAL until every condition is evidenced via resolve_conditions.
    """
    import json as _j
    row = store.get_commitment_row(cid)
    conds = _j.loads(row["conditions_json"]) if row and "conditions_json" in row.keys() else []
    target = CONDITIONAL if conds else ACTIVE
    # allow direct CONFIRMED -> CONDITIONAL (in ALLOWED_TRANSITIONS)
    try:
        st = _transition(store, cid, target, actor)
    except ProtocolError:
        # negotiation fast-path may still be in NEGOTIATED
        if store.get_commitment_row(cid)["state"] == NEGOTIATED and target == CONDITIONAL:
            confirm(store, cid, actor)
            st = _transition(store, cid, target, actor)
        else:
            raise
    append_event(store, cid, "COMMITMENT_LOCKED", actor, {"into": target})
    return st


def full_activate(store: Store, cid: str, actor: str = "protocol") -> str:
    """DRAFT -> NEGOTIATED -> CONFIRMED -> ACTIVE (or CONDITIONAL)."""
    negotiate(store, cid, actor)
    confirm(store, cid, actor)
    return lock(store, cid, actor)


def resolve_conditions(store: Store, cid: str, actor: str = "protocol") -> str:
    """CONDITIONAL -> ACTIVE once every condition has trusted proof.

    Condition proof = evidence of type 'condition_proof' from a trusted
    source whose payload names the condition. Untrusted claims don't count.
    """
    import json as _j
    row = store.get_commitment_row(cid)
    if not row:
        raise ProtocolError("UNKNOWN_COMMITMENT", cid)
    if row["state"] != CONDITIONAL:
        raise ProtocolError("INVALID_STATE_TRANSITION",
                            f"resolve_conditions requires CONDITIONAL, is {row['state']}")
    conds = _j.loads(row["conditions_json"])
    proven = set()
    for r in store.evidence_for(cid):
        if r["type"] != "condition_proof" or r["source"] not in TRUSTED_SOURCES:
            continue
        payload = _j.loads(r["payload_json"])
        named = str(payload.get("condition", "")).lower()
        for c in conds:
            if c.lower() in named or named in c.lower():
                proven.add(c)
    missing = [c for c in conds if c not in proven]
    if missing:
        append_event(store, cid, "CONDITIONS_PENDING", actor, {"missing": missing})
        raise ProtocolError("CONDITIONS_UNMET", f"unproven: {missing}")
    st = _transition(store, cid, ACTIVE, actor, {"conditions_proven": conds})
    return st


def cancel(store: Store, cid: str, actor: str) -> str:
    return _transition(store, cid, CANCELLED, actor)


def escalate(store: Store, cid: str, actor: str, reason: str = "") -> str:
    from .models import ESCALATED
    return _transition(store, cid, ESCALATED, actor, {"reason": reason})


def update_terms(store: Store, cid: str, *a, **k):
    """Silent mutation is ALWAYS rejected. Create an amendment instead."""
    raise ProtocolError("IMMUTABLE_OBLIGATION",
                        f"{cid}: 500 -> 300 is never UPDATE; CREATE amendment with parent={cid}")


# ------------------------------------------------------------ evidence

def attach_evidence(store: Store, commitment_id: str, ev_type: str, source: str,
                    observed_at: str, payload: dict,
                    actor: str = "external_system") -> Evidence:
    row = store.get_commitment_row(commitment_id)
    if not row:
        raise ProtocolError("UNKNOWN_COMMITMENT", commitment_id)
    # binding: evidence addressed to another commitment dies here, not in review
    if payload.get("commitment_id") and payload["commitment_id"] != commitment_id:
        raise ProtocolError("EVIDENCE_COMMITMENT_MISMATCH",
                            f"evidence for {payload['commitment_id']} "
                            f"attached to {commitment_id}")
    import json as _j
    ph = sha256(canonical({"commitment": commitment_id, "source": source,
                           "observed_at": observed_at, "payload": payload}))
    if store.payload_hash_exists(ph):
        raise ProtocolError("DUPLICATE_EVIDENCE", "identical evidence already attached")
    e = Evidence(_nid("ev"), commitment_id, ev_type, source, observed_at, ph, payload)
    store.insert_evidence(e)
    append_event(store, commitment_id, "EVIDENCE_ATTACHED", actor,
                 {"evidence_id": e.id, "source": source, "payload": payload})
    return e


def run_verification(store: Store, commitment_id: str,
                     now_iso: str | None = None, actor: str = "protocol") -> dict:
    """Deterministic verifier. Agent claims are untrusted input, never truth."""
    row = store.get_commitment_row(commitment_id)
    if not row:
        raise ProtocolError("UNKNOWN_COMMITMENT", commitment_id)
    terms = store.get_terms(commitment_id)
    ev_rows = store.evidence_for(commitment_id)
    now_iso = now_iso or utcnow_iso()
    import json as _j2
    reqs = _j2.loads(row["evidence_requirements_json"]) if "evidence_requirements_json" in row.keys() else []
    max_age = None
    for r in reqs:
        if isinstance(r, dict) and r.get("max_age_hours") is not None:
            try:
                h = float(r["max_age_hours"])
                max_age = h if max_age is None else min(max_age, h)
            except (TypeError, ValueError):
                pass
    summary = evmod.summarize_evidence(terms, ev_rows, row["deadline"],
                                       effective_at=row["effective_at"],
                                       requirements=reqs, max_age_hours=max_age)
    verdict = evmod.decide_verdict(summary, now_iso, row["deadline"])
    if summary.get("stale"):
        verdict["reason"] += f" ({len(summary['stale'])} stale evidence ignored)"
        verdict["stale_ignored"] = len(summary["stale"])
    cur = row["state"]
    if cur == CONDITIONAL and verdict.get("next_state") in ("FULFILLED", "AT_RISK", "BREACHED"):
        # conditional obligations cannot fulfill/breach on quantity alone:
        # conditions must resolve first. Deterministic, visible.
        append_event(store, commitment_id, "CONDITIONS_PENDING", actor,
                     {"verdict": verdict["verdict"], "reason": "conditions unresolved"})
        verdict["next_state"] = None
        verdict["fulfillment"] = "BLOCKED_CONDITIONAL"
        verdict["summary"] = summary
        verdict["commitment_id"] = commitment_id
        verdict["state"] = cur
        return verdict
    append_event(store, commitment_id, "VERIFICATION_RUN", actor,
                 {"verdict": verdict["verdict"], "reason": verdict["reason"],
                  "expected": summary["expected"],
                  "trusted_before": summary["trusted_before_qty"]})
    nxt = verdict["next_state"]
    if nxt and nxt != cur:
        try:
            _transition(store, commitment_id, nxt, "protocol",
                        {"verdict": verdict["verdict"]})
            if nxt == "FULFILLED":
                append_event(store, commitment_id, "FULFILLMENT_PROVED", "protocol", summary)
            elif nxt in ("BREACHED", "EXPIRED"):
                append_event(store, commitment_id, "BREACH_DETECTED" if nxt == "BREACHED" else "COMMITMENT_EXPIRED",
                             "protocol", {"reason": verdict["reason"]})
        except ProtocolError as e:
            # e.g. ACTIVE -> AT_RISK allowed; BREACHED -> X forbidden etc.
            # If already terminal with same meaning, record contradiction instead.
            append_event(store, commitment_id, "VERIFICATION_BLOCKED_TRANSITION",
                         "protocol", {"error": e.reason, "wanted": nxt, "current": cur})
            verdict["transition_blocked"] = f"{e.reason}: {cur} -> {nxt}"
    else:
        if verdict["verdict"] in ("FULFILLMENT_BLOCKED", "UNRESOLVED_CONFLICT"):
            append_event(store, commitment_id, "FULFILLMENT_CONTRADICTED" if summary["conflict"] else "FULFILLMENT_BLOCKED",
                         "protocol", {"reason": verdict["reason"]})
    verdict["summary"] = summary
    verdict["commitment_id"] = commitment_id
    verdict["state"] = store.get_commitment_row(commitment_id)["state"]
    return verdict


def agent_claim_fulfilled(store: Store, commitment_id: str, claim_text: str) -> dict:
    """LLM says fulfilled -> recorded as UNTRUSTED evidence, then verified (and blocked)."""
    row = store.get_commitment_row(commitment_id)
    if not row:
        raise ProtocolError("UNKNOWN_COMMITMENT", commitment_id)
    append_event(store, commitment_id, "CLAIM_EXTRACTED", "agent",
                 {"claim": "fulfilled", "text": claim_text})
    # The claim becomes untrusted evidence, never a state transition.
    e = attach_evidence(store, commitment_id, "phone_claim", "agent_claim",
                        utcnow_iso(), {"quantity": store.get_terms(commitment_id).get("quantity"),
                                       "claim_text": claim_text}, actor="agent")
    verdict = run_verification(store, commitment_id)
    return {"evidence_id": e.id, "verdict": verdict}


# ------------------------------------------------------------ amendments

def create_amendment(store: Store, parent_id: str, candidate: dict,
                     actor_id: str, actor_name: str,
                     required_scope: str = "procurement",
                     source_call_id: str | None = None,
                     at: str | None = None,
                     confirmation: dict | None = None) -> Commitment:
    parent = store.get_commitment_row(parent_id)
    if not parent:
        raise ProtocolError("UNKNOWN_COMMITMENT", parent_id)
    if parent["state"] in ("FULFILLED", "CANCELLED", "DRAFT", "NEGOTIATED", "CONFIRMED"):
        raise ProtocolError("AMENDMENT_FORBIDDEN",
                            f"cannot amend parent in state {parent['state']}")
    if parent["state"] not in AMENDABLE_STATES:
        raise ProtocolError("AMENDMENT_FORBIDDEN", f"parent state {parent['state']}")
    # recovery must not erase the breach: amendment requires its own mutual
    # confirmation when it comes from a phone negotiation (enforced via
    # confirmation param); programmatic recovery carries parent's evidence
    # requirements forward so the child is held to the same proof standard.
    import json as _j3
    parent_reqs = _j3.loads(parent["evidence_requirements_json"]) \
        if "evidence_requirements_json" in parent.keys() else []
    candidate = dict(candidate)
    candidate["parent_id"] = parent_id
    if "evidence_requirements" not in candidate and parent_reqs:
        candidate["evidence_requirements"] = parent_reqs
    child = propose_commitment(store, candidate, actor_id, actor_name,
                               required_scope, source_call_id, at,
                               confirmation=confirmation, origin="amendment")
    store.set_amended_by(parent_id, child.id)
    append_event(store, parent_id, "AMENDMENT_CREATED", actor_id,
                 {"child_id": child.id})
    append_event(store, parent_id, "RECOVERY_STARTED", actor_id,
                 {"child_id": child.id})
    return child


def get_lineage(store: Store, cid: str) -> list:
    return store.lineage(cid)


def extract_candidate(llm_output: dict) -> dict:
    """Extraction layer: LLM output -> candidate commitment (untrusted until validated)."""
    return {
        "actor": llm_output.get("actor") or llm_output.get("actor_name"),
        "actor_id": llm_output.get("actor_id"),
        "terms": {
            "action": llm_output.get("action"),
            "quantity": llm_output.get("quantity"),
            "unit": llm_output.get("unit"),
            "destination": llm_output.get("destination"),
            "deadline": llm_output.get("deadline"),
        },
    }
