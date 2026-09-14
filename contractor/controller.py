"""CONTRACTOR — the product surface.

One class. One story: a phone conversation becomes an obligation only when
both parties explicitly confirmed the exact terms.

    from contractor import Contractor

    c = Contractor(store, calle_client)

    session   = c.form(objective=..., counterparty=...)
    session   = c.clarify(session, response=...)       # loop with c.questions
    record    = c.confirm(session, readback=...)
    commitment = c.commit(record)

    decision  = c.evaluate(commitment.id)              # .actions.<verb>.allowed
    c.record_evidence(commitment.id, ...)
    child     = c.amend(commitment.id, terms, readback=...)

The developer never touches SQLite, hashes, state transitions, or attack
logic. The protocol is the internals; this class is the interface.
"""
from __future__ import annotations
import json
from .store import Store
from . import protocol as _p
from . import formation as _f
from . import policy as _policy
from .models import utcnow_iso
from .audit import append_event as _append


class Contractor:
    def __init__(self, store: Store | None = None, calle_client=None,
                 trusted_source_context: str | None = "warehouse_system"):
        self.store = store or Store()
        self.calle = calle_client
        self._trusted_source_context = trusted_source_context

    # ------------------------------------------------------------ formation
    def form(self, objective: str, counterparty: str,
             terms: dict | None = None, transcript: str = "") -> dict:
        """Open a formation session from a call. NEVER creates an obligation."""
        proposed = terms or {}
        if not proposed and transcript:
            # caller may pass a raw transcript; extraction is CALL-E's job —
            # CONTRACTOR still refuses to commit what wasn't confirmed.
            proposed = {"action": "unknown", "quantity": None,
                        "unit": None, "destination": None, "deadline": None}
        s = {"objective": objective, "counterparty": counterparty,
             **_f.start_proposal(proposed, transcript)}
        # no audit event yet: the formation session is pre-obligation; the
        # confirmation record and all lifecycle events attach to the
        # commitment row created at commit().
        return s

    def clarify(self, session: dict, response: str,
                terms: dict | None = None) -> dict:
        """Submit the counterparty's answer to a clarification question.

        Returns the session; read `.state` (AMBIGUOUS / CLARIFICATION /
        MUTUALLY_CONFIRMED) and `.questions`. Loop until MUTUALLY_CONFIRMED."""
        return _f.clarify(session, terms or session["proposed"], response)

    def confirm(self, session: dict, readback: str, actor_id: str,
                call_id: str | None = None) -> dict:
        """Run the mutual-confirmation gate. Returns a sealed confirmation
        record. Raises AMBIGUITY_UNRESOLVED / PARTIAL_CONFIRMATION /
        CONVERSATION_CONFLICT — never returns a half-confirmation."""
        return _f.mutual_confirm(session, session["proposed"], readback,
                                 call_id=call_id, actor_id=actor_id)

    def commit(self, record: dict, actor_id: str, actor_name: str,
               call_id: str | None = None,
               evidence_requirements: list | None = None,
               provenance: dict | None = None,
               required_scope: str = "procurement"):
        """Commit a confirmed obligation. The record must be fresh, bound to
        actor_id, and unused — otherwise FORGED / EXPIRED / MISMATCH /
        REPLAYED. This is the only way to obtain origin='formation'."""
        terms = record["confirmed_terms"]
        candidate = {"actor_id": actor_id, "actor": actor_name,
                     "terms": {k: terms[k] for k in
                               ("action", "quantity", "unit", "destination",
                                "deadline") if k in terms}}
        for k in ("object", "price", "currency", "cancellation_terms"):
            if k in terms:
                candidate["terms"][k] = terms[k]
        from . import sdk as _sdk
        c = _sdk.commit(self.store, record, actor_id, actor_name,
                        call_id, evidence_requirements, provenance,
                        required_scope)
        return c

    # ------------------------------------------------------------ lifecycle
    def record_evidence(self, commitment_id: str, ev_type: str, source: str,
                        observed_at: str | None = None, payload: dict | None = None):
        return _p.attach_evidence(
            self.store, commitment_id, ev_type, source,
            observed_at or utcnow_iso(), payload or {}, actor="external_system")

    def evaluate(self, commitment_id: str, now_iso: str | None = None) -> dict:
        """Run the verifier (state may advance) + the action table.

        Returns {verdict, state, actions: {verb: {allowed, reason}}}."""
        verdict = _p.run_verification(self.store, commitment_id, now_iso=now_iso)
        table = _policy.evaluate(self.store, commitment_id, now_iso=now_iso)
        actions = {name: spec for name, spec in table["actions"].items()}
        return {"id": commitment_id, "state": table["state"],
                "verdict": verdict["verdict"],
                "reason": verdict.get("reason", ""),
                "actions": actions}

    def amend(self, parent_id: str, terms: dict, readback: str,
              actor_id: str, actor_name: str, call_id: str | None = None):
        """Formation-confirmed amendment: v1 stays immutable, v2 is new."""
        proposal = _f.start_proposal(terms, "")
        record = _f.mutual_confirm(proposal, terms, readback,
                                   call_id=call_id, actor_id=actor_id)
        child = _p.create_amendment(
            self.store, parent_id, {"actor_id": actor_id, "actor": actor_name,
                                    "terms": terms},
            actor_id, actor_name, source_call_id=call_id, confirmation=record)
        _p.full_activate(self.store, child.id, actor="protocol")
        return child

    def recover(self, commitment_id: str, counterparty: str, deadline_iso: str,
                call_fn=None):
        from .recovery import recover as _recover
        return _recover(self.store, commitment_id, counterparty,
                        deadline_iso, call_fn=call_fn)

    # ------------------------------------------------------------ surface
    def commitment(self, commitment_id: str) -> dict:
        row = self.store.get_commitment_row(commitment_id)
        if row is None:
            return None
        out = dict(row)
        out["terms"] = self.store.get_terms(commitment_id)
        out["evidence"] = [dict(r) for r in self.store.evidence_for(commitment_id)]
        out["events"] = [dict(r) for r in self.store.events_for(commitment_id)]
        out["conditions"] = json.loads(out.get("conditions_json", "[]") or "[]")
        out["confirmation"] = json.loads(out.get("confirmation_json", "{}") or "{}")
        out["provenance"] = json.loads(out.get("provenance_json", "{}") or "{}")
        return out

    def register_authority(self, actor_id: str, scopes: list, **kw):
        self.store.upsert_authority(actor_id, scopes, **kw)