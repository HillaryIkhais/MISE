"""CALL-E adapter — CONTRACTOR's actuator.

call_e_call(to, goal)  →  {call_id, status, to, goal, transcript, extracted, live}

Live path: POSTs to CALLE_API_URL/calls when CALLE_API_URL + CALLE_API_KEY
are set.  Falls back to deterministic simulation without credentials so the
protocol, tests, and demo remain credible without live telephony.
"""
from __future__ import annotations
import json
import os
import uuid
from urllib.request import Request, urlopen
from urllib.error import URLError


def _simulate(goal: str, to: str, **kw) -> dict:
    from .passback import simulate_phone
    r = simulate_phone(goal, to, **kw)
    r["live"] = False
    return r


def _normalize(raw: dict) -> dict:
    """Coerce an arbitrary CALL-E response into the case-ready contract."""
    call_id = raw.get("call_id") or raw.get("id") or f"calle_{uuid.uuid4().hex[:10]}"
    transcript = raw.get("transcript") or raw.get("result") or raw.get("text") or ""
    extracted = dict(raw.get("extracted") or raw.get("structured") or {})
    extracted.setdefault("confidence", raw.get("confidence", 0.8))
    return {"call_id": call_id, "status": raw.get("status", "completed"),
            "transcript": transcript, "extracted": extracted, "live": True}


def simulate_call(supplier: str, prompt: str, scenario: str = "confirm",
                  quantity: float = 500, deadline: str | None = None) -> dict:
    """CALL-E goal-driven phone task result (offline, supply-chain corpus).

    Used by the SDK integration test and as the offline stand-in when
    CALL-E credentials are absent.
    """
    from datetime import datetime, timezone, timedelta
    call_id = f"call_{uuid.uuid4().hex[:10]}"
    dl = deadline or _iso(datetime.now(timezone.utc) + timedelta(days=1))
    if scenario == "confirm":
        transcript = (f"Agent: confirming {quantity} units to Warehouse A by {dl}. "
                      f"{supplier}: Yes, we agree to deliver {quantity} units.")
        extracted = {"actor": supplier, "actor_id": "supplier_001",
                     "action": "deliver", "quantity": quantity, "unit": "units",
                     "destination": "warehouse_a", "deadline": dl, "confidence": 0.94}
    elif scenario == "vague":
        transcript = f"{supplier}: Yeah, we'll deliver it Friday."
        extracted = {"actor": supplier, "actor_id": "supplier_001",
                     "action": "deliver", "quantity": None, "unit": None,
                     "destination": None, "deadline": dl, "confidence": 0.51}
    elif scenario == "false_fulfilled":
        transcript = f"{supplier}: Everything has shipped, all {quantity} units delivered."
        extracted = {"actor": supplier, "actor_id": "supplier_001",
                     "action": "deliver", "quantity": quantity, "unit": "units",
                     "destination": "warehouse_a", "deadline": dl,
                     "claim": "fulfilled", "confidence": 0.88}
    elif scenario == "recovery":
        transcript = (f"{supplier}: We can send the remaining 200 Monday. "
                      "Agent: confirming 200 units Monday.")
        extracted = {"actor": supplier, "actor_id": "supplier_001",
                     "action": "deliver", "quantity": 200, "unit": "units",
                     "destination": "warehouse_a", "deadline": dl, "confidence": 0.91}
    else:
        transcript = f"{supplier}: {prompt}"
        extracted = {"actor": supplier, "actor_id": "supplier_001",
                     "action": "deliver", "quantity": quantity, "unit": "units",
                     "destination": "warehouse_a", "deadline": dl, "confidence": 0.5}
    return {"call_id": call_id, "status": "completed", "transcript": transcript,
            "extracted": extracted, "simulated": True}


def _iso(dt) -> str:
    return dt.isoformat()


def call_e_call(goal: str, to: str, **kw) -> dict:
    """Single entry point for CALL-E in the MISE flow.

    Matches simulate_phone(goal, to, **kw) signature so either can be
    passed as a call_fn to PassbackCase.run_next().
    """
    url = os.environ.get("CALLE_API_URL")
    key = os.environ.get("CALLE_API_KEY")
    if not url or not key:
        return _simulate(goal, to, **kw)
    try:
        body = json.dumps({"to": to, "goal": goal, **kw}).encode()
        req = Request(
            url.rstrip("/") + "/calls",
            data=body,
            headers={"Authorization": f"Bearer {key}",
                     "Content-Type": "application/json"},
        )
        with urlopen(req, timeout=30) as resp:
            raw = json.loads(resp.read().decode())
        result = _normalize(raw)
        result["to"] = to
        result["goal"] = goal
        return result
    except (URLError, Exception) as exc:
        # A failed live call is safer to flag than to pretend it didn't happen.
        fb = _simulate(goal, to, **kw)
        fb["live_error"] = str(exc)
        return fb
