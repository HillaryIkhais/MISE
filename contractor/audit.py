"""Append-only, hash-linked audit trail. Tamper-evident, not blockchain."""
from __future__ import annotations
import uuid
from .models import canonical, sha256, utcnow_iso
from .store import Store
from dataclasses import dataclass


def append_event(store: Store, commitment_id: str, event_type: str,
                 actor: str, payload: dict | None = None) -> dict:
    payload = payload or {}
    previous_hash = store.last_hash(commitment_id)
    timestamp = utcnow_iso()
    eid = f"evt_{uuid.uuid4().hex[:12]}"
    body = canonical({
        "id": eid, "commitment_id": commitment_id, "event_type": event_type,
        "timestamp": timestamp, "actor": actor, "payload": payload,
        "previous_hash": previous_hash,
    })
    event_hash = sha256(body)
    from .models import AuditEvent
    ev = AuditEvent(eid, commitment_id, event_type, timestamp, actor,
                    payload, previous_hash, event_hash)
    store.insert_event(ev)
    return {"event_id": eid, "event_hash": event_hash,
            "previous_hash": previous_hash, "timestamp": timestamp}


def verify_chain(store: Store, commitment_id: str) -> dict:
    """Recompute hashes; detect modification. Returns {ok, checked, error}."""
    from .models import GENESIS_HASH
    events = store.events_for(commitment_id)
    prev = GENESIS_HASH
    for r in events:
        import json
        body = canonical({
            "id": r["id"], "commitment_id": r["commitment_id"],
            "event_type": r["event_type"], "timestamp": r["timestamp"],
            "actor": r["actor"], "payload": json.loads(r["payload_json"]),
            "previous_hash": r["previous_hash"],
        })
        if r["previous_hash"] != prev:
            return {"ok": False, "checked": len(events),
                    "error": f"CHAIN_BREAK at {r['id']}: expected prev {prev}"}
        if sha256(body) != r["event_hash"]:
            return {"ok": False, "checked": len(events),
                    "error": f"TAMPER_DETECTED at {r['id']}"}
        prev = r["event_hash"]
    return {"ok": True, "checked": len(events), "error": ""}
