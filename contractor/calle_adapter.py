"""CALL-E adapter — CONTRACTOR's actuator.

call_e_call(goal, to)  →  {call_id, status, to, goal, transcript, extracted, live}

Live path: creates a call task at {CALLE_BASE_URL}/v1/calls (or
CALLE_API_URL), polls until terminal, and normalizes the result into the
case-ready contract.  Falls back to deterministic simulation when the
credentials (or a destination phone) are absent so the protocol, tests, and
demo remain credible without live telephony.
"""
from __future__ import annotations
import hashlib
import json
import os
import time
import uuid
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

POLL_TIMEOUT_S = 45.0
POLL_INTERVAL_S = 1.5


def _load_dotenv():
    """Tiny stdlib .env loader (repo-root first match wins, no override)."""
    for path in (Path.cwd() / ".env", Path(__file__).resolve().parents[1] / ".env"):
        try:
            for raw in path.read_text().splitlines():
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())
            break
        except OSError:
            continue


def calle_env() -> dict:
    """Live CALL-E config from env + .env (url accepts both var names)."""
    _load_dotenv()
    url = (os.environ.get("CALLE_API_URL")
           or os.environ.get("CALLE_BASE_URL") or "").rstrip("/")
    key = os.environ.get("CALLE_API_KEY") or ""
    phone = os.environ.get("CALLE_PHONE") or ""
    return {"url": url, "key": key, "phone": phone}


def _simulate(goal: str, to: str, **kw) -> dict:
    from .passback import simulate_phone
    r = simulate_phone(goal, to, **kw)
    r["live"] = False
    return r


def _schema_for(to: str, scenario: str) -> dict:
    """JSON Schema for the extraction contract of the current transition.

    Mirrors the fields verify_call() consumes in passback.py.
    """
    if to == "supplier":
        return {
            "type": "object", "additionalProperties": False,
            "required": ["action", "quantity", "window", "reference"],
            "properties": {
                "action": {"type": "string",
                           "description": "The action the supplier commits to, e.g. ship."},
                "quantity": {"type": "integer",
                             "description": "How many units."},
                "window": {"type": "string",
                           "description": "The exact delivery window WITH a clock time, e.g. \"tomorrow before 2 PM\". Must include an hour:minute time or clear time-of-day."},
                "reference": {"type": "string",
                              "description": "Order or PO reference, e.g. PO-1842."},
            },
        }
    return {
        "type": "object", "additionalProperties": False,
        "required": ["incident", "requirement"],
        "properties": {
            "incident": {"type": "string",
                         "description": "The type of incident, e.g. delivery_failed."},
            "requirement": {"type": "string",
                            "description": "What must happen to resolve the incident."},
        },
    }


def _task_text(goal: str, to: str) -> str:
    party = "supplier" if to == "supplier" else "operations"
    return (f"Call the {party} for a business with a critical delivery failure. "
            f"Your objective: {goal} Keep the call until the recipient gives a clear, "
            f"verbatim answer, then end the call and report their exact words.")


def _create_call(cfg: dict, task: str, schema: dict, idem: str) -> dict:
    body = json.dumps({
        "task": task,
        "recipients": [{"phones": [cfg["phone"]], "region": "US", "locale": "en-US"}],
        "result_schema": schema,
        "metadata": {"product": "MISE", "module": "CONTRACTOR"},
    }).encode()
    req = Request(cfg["url"] + "/v1/calls", data=body, method="POST",
                  headers={"Authorization": f"Bearer {cfg['key']}",
                           "Content-Type": "application/json",
                           "Idempotency-Key": idem})
    with urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def _poll_call(cfg: dict, call_id: str) -> dict:
    deadline = time.monotonic() + POLL_TIMEOUT_S
    req = Request(cfg["url"] + f"/v1/calls/{call_id}",
                  headers={"Authorization": f"Bearer {cfg['key']}"})
    while time.monotonic() < deadline:
        with urlopen(req, timeout=30) as resp:
            task = json.loads(resp.read().decode())
        if task.get("status") in ("completed", "failed", "canceled"):
            return task
        time.sleep(POLL_INTERVAL_S)
    raise RuntimeError("CALL-E poll timed out")


def _transcript_from(task: dict) -> str:
    turns = []
    for r in task.get("recipients") or []:
        for a in r.get("attempts") or []:
            for t in a.get("transcript_turns") or []:
                if t.get("speaker") == "user" and t.get("text"):
                    turns.append(t["text"])
    if turns:
        return " ".join(turns)
    ev = task.get("evidence") or []
    return " ".join(ev) if ev else ""


def _normalize(task: dict, to: str, goal: str) -> dict:
    """Coerce a terminal CALL-E call task into the case-ready contract."""
    raw_id = task.get("id") or f"call_{uuid.uuid4().hex[:10]}"
    structured = task.get("structured_result") or {}
    conf_obj = task.get("completion_confidence") or {}
    confidence = float(conf_obj.get("score")) if conf_obj.get("score") is not None else 0.8
    configured = "confidence" in structured
    if configured:
        confidence = float(structured.pop("confidence"))
    elif isinstance(structured, dict):
        structured = dict(structured)
    structured.setdefault("confidence", confidence)
    return {"call_id": f"calle_{raw_id}", "status": task.get("status", "completed"),
            "to": to, "goal": goal, "transcript": _transcript_from(task),
            "extracted": structured, "live": True,
            "task_completed": task.get("task_completed"),
            "evidence": task.get("evidence") or []}


def call_e_call(goal: str, to: str, **kw) -> dict:
    """Single entry point for CALL-E in the MISE flow.

    Matches simulate_phone(goal, to, **kw) signature so either can be
    passed as a call_fn to PassbackCase.run_next().
    """
    cfg = calle_env()
    if not cfg["url"] or not cfg["key"]:
        return _simulate(goal, to, **kw)
    if not cfg["phone"]:
        fb = _simulate(goal, to, **kw)
        fb["live_error"] = "CALLE_PHONE not set — live call not placed"
        return fb
    idem_src = f"{kw.get('case_id', '')}|{kw.get('from_state', '')}|{goal}"
    idem = "mise_" + hashlib.sha256(idem_src.encode()).hexdigest()[:24]
    task = _task_text(goal, to)
    schema = _schema_for(to, kw.get("scenario", "auto"))
    try:
        created = _create_call(cfg, task, schema, idem)
        call_id = created.get("id") or ""
        task = _poll_call(cfg, call_id) if call_id else created
        return _normalize(task, to, goal)
    except (URLError, HTTPError, OSError, RuntimeError, TimeoutError) as exc:
        # A failed live call is safer to flag than to pretend it didn't happen.
        fb = _simulate(goal, to, **kw)
        fb["live_error"] = str(exc)
        return fb


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
