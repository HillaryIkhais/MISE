"""Authority registry: phone presence != authority. LLM cannot override."""
from __future__ import annotations
from datetime import datetime, timezone
from .models import ProtocolError
from .store import Store
import json


def _parse(ts: str | None):
    if not ts:
        return None
    return datetime.fromisoformat(ts)


def check_authority(store: Store, actor_id: str, required_scope: str,
                    at: str | None = None) -> dict:
    """Raise ProtocolError(ACTOR_NOT_AUTHORIZED / AUTHORITY_SCOPE_MISMATCH / AUTHORITY_EXPIRED)."""
    row = store.get_authority(actor_id)
    if row is None:
        raise ProtocolError("ACTOR_NOT_AUTHORIZED", f"unknown actor '{actor_id}'")
    import json as _j
    scopes = _j.loads(row["scopes_json"])
    now = _parse(at) or datetime.now(timezone.utc)
    vf, vu = _parse(row["valid_from"]), _parse(row["valid_until"])
    if vf and now < vf:
        raise ProtocolError("AUTHORITY_EXPIRED", f"authority for '{actor_id}' not yet valid")
    if vu and now > vu:
        raise ProtocolError("AUTHORITY_EXPIRED", f"authority for '{actor_id}' expired")
    if required_scope not in scopes:
        raise ProtocolError(
            "AUTHORITY_SCOPE_MISMATCH",
            f"actor '{actor_id}' scopes={scopes} lacks '{required_scope}'",
        )
    return {"verified": True, "scope": scopes, "actor_id": actor_id}
