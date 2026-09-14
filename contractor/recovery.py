"""Recovery engine: BREACH -> CALL-E renegotiation -> new obligation (lineage preserved)."""
from __future__ import annotations
from .store import Store
from . import protocol
from .calle_adapter import place_call
from .audit import append_event


def recover(store: Store, commitment_id: str, supplier: str,
             deadline_iso: str, call_fn=None) -> dict:
    """Run recovery policy: place recovery call, validate candidate, create amendment.

    Never mutates the breached commitment. Returns {child_id, call, verdict}.
    """
    row = store.get_commitment_row(commitment_id)
    if not row:
        from .models import ProtocolError
        raise ProtocolError("UNKNOWN_COMMITMENT", commitment_id)
    fn = call_fn or place_call
    call = fn(supplier, f"Renegotiate remaining quantity for {commitment_id}",
              scenario="recovery", deadline=deadline_iso)
    ext = call["extracted"]
    candidate = {"actor_id": ext["actor_id"], "actor": ext["actor"], "terms": {
        "action": ext["action"], "quantity": ext["quantity"], "unit": ext["unit"],
        "destination": ext["destination"], "deadline": ext["deadline"]}}
    child = protocol.create_amendment(
        store, commitment_id, candidate,
        actor_id=ext["actor_id"], actor_name=ext["actor"],
        source_call_id=call["call_id"])
    protocol.full_activate(store, child.id, actor="protocol")
    append_event(store, child.id, "RECOVERY_COMPLETED", "protocol",
                 {"parent_id": commitment_id, "call_id": call["call_id"]})
    return {"child_id": child.id, "call": call,
            "state": store.get_commitment_row(child.id)["state"]}
