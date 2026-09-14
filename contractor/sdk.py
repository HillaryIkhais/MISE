"""CONTRACTOR public SDK — the infrastructure surface.

A developer integrates without touching the database or state machine::

    import contractor.sdk as contractor

    proposal = contractor.start_formation(terms, transcript)
    proposal = contractor.clarify(proposal, revised_terms, response)
    record   = contractor.confirm(proposal, terms, readback, actor_id, call_id)
    comm     = contractor.commit(store, record, actor_id, actor_name)
    contractor.record_evidence(store, comm.id, ...)
    report   = contractor.evaluate(store, comm.id)   # verdict + action table
    child    = contractor.amend(store, comm.id, new_terms, readback, ...)

The ONLY path to a confirmed obligation is start_formation → clarify →
confirm → commit. There is no SDK function that manufactures confirmation.
Privileged system paths (recovery/migration/reconciliation imports) require
an explicit reason and are audited as privileged — never as human confirmation.
"""
from __future__ import annotations
from . import formation as _f
from . import protocol as _p
from . import policy as _policy
from .audit import append_event as _append
from .controller import Contractor


# ------------------------------------------------------------ formation

def start_formation(terms: dict, transcript: str = "") -> dict:
    """Open a formation session. Never creates an obligation."""
    return _f.start_proposal(terms, transcript)


def clarify(proposal: dict, revised_terms: dict, response_transcript: str) -> dict:
    """Submit the counterparty's clarification answer; re-check convergence."""
    return _f.clarify(proposal, revised_terms, response_transcript)


def confirm(proposal: dict, confirmed_terms: dict, confirmation_transcript: str,
            actor_id: str, call_id: str | None = None) -> dict:
    """Run the mutual-confirmation gate. Raises on ambiguity/conflict/partial.

    Returns a confirmation record bound to actor_id. Single-use, 48h TTL,
    tamper-evident (terms_hash)."""
    return _f.mutual_confirm(proposal, confirmed_terms, confirmation_transcript,
                             call_id=call_id, actor_id=actor_id)


# ------------------------------------------------------------ lifecycle

def commit(store, confirmation_record: dict, actor_id: str, actor_name: str,
           call_id: str | None = None, evidence_requirements: list | None = None,
           provenance: dict | None = None, required_scope: str = "procurement",
           at: str | None = None):
    """Create + lock a confirmed obligation. The record must be fresh, bound
    to actor_id, and unused — otherwise FORGED / EXPIRED / MISMATCH / REPLAYED."""
    terms = confirmation_record["confirmed_terms"]
    candidate = {"actor_id": actor_id, "actor": actor_name,
                 "terms": {k: terms[k] for k in
                           ("action", "quantity", "unit", "destination", "deadline")
                           if k in terms}}
    for k in ("object", "price", "currency", "cancellation_terms"):
        if k in terms:
            candidate["terms"][k] = terms[k]
    c = _p.propose_commitment(
        store, candidate, actor_id, actor_name, required_scope,
        source_call_id=call_id or confirmation_record.get("call_id"),
        at=at, conditions=confirmation_record.get("conditions", []),
        evidence_requirements=evidence_requirements,
        provenance=provenance, confirmation=confirmation_record)
    _p.full_activate(store, c.id, actor="protocol")
    return c


def record_evidence(store, commitment_id: str, ev_type: str, source: str,
                    observed_at: str, payload: dict, actor: str = "external_system"):
    """Attach fulfillment evidence. Duplicates / wrong-commitment evidence
    are rejected deterministically."""
    return _p.attach_evidence(store, commitment_id, ev_type, source,
                              observed_at, payload, actor)


def evaluate(store, commitment_id: str, now_iso: str | None = None) -> dict:
    """Run the deterministic verifier (state may advance) + the policy action
    table. Returns {verdict, state, policy}."""
    verdict = _p.run_verification(store, commitment_id, now_iso=now_iso)
    table = _policy.evaluate(store, commitment_id, now_iso=now_iso)
    return {"verdict": verdict, "state": table["state"], "policy": table}


def amend(store, parent_id: str, confirmed_terms: dict,
         confirmation_transcript: str, actor_id: str, actor_name: str,
         call_id: str | None = None):
    """Formation-confirmed amendment: v1 untouched, v2 created + locked with
    its own confirmation record. Recovery never erases the breach."""
    proposal = _f.start_proposal(confirmed_terms, "")
    record = _f.mutual_confirm(proposal, confirmed_terms,
                               confirmation_transcript,
                               call_id=call_id, actor_id=actor_id)
    child = _p.create_amendment(store, parent_id,
                                {"actor_id": actor_id, "actor": actor_name,
                                 "terms": confirmed_terms},
                                actor_id, actor_name, source_call_id=call_id,
                                confirmation=record)
    _p.full_activate(store, child.id, actor="protocol")
    return child


def recover(store, commitment_id: str, supplier: str, deadline_iso: str,
            call_fn=None) -> dict:
    """Breach → CALL-E renegotiation → confirmed amendment (lineage kept)."""
    from .recovery import recover as _recover
    return _recover(store, commitment_id, supplier, deadline_iso, call_fn=call_fn)


def privileged_import(store, candidate: dict, actor_id: str, actor_name: str,
                      kind: str, reason: str, **kw):
    """System back-door with the lights on. kind ∈ {recovery_import,
    migration_import, system_reconciliation}. Requires a reason; audited as
    PRIVILEGED_IMPORT; NEVER carries human confirmation."""
    if kind not in ("recovery_import", "migration_import", "system_reconciliation"):
        from .models import ProtocolError
        raise ProtocolError("INVALID_IMPORT_KIND", kind)
    if not reason:
        from .models import ProtocolError
        raise ProtocolError("IMPORT_REASON_REQUIRED", "privileged imports need a reason")
    c = _p.propose_commitment(store, candidate, actor_id, actor_name,
                              origin=kind, **kw)
    _append(store, c.id, "PRIVILEGED_IMPORT", actor_id,
            {"kind": kind, "reason": reason, "confirmed": False})
    return c
