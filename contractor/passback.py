"""PASSBACK — turns a failed inspection into a reopening path.

One product, two layers.

Layer 1 (Recovery Engine): decides what must happen next from the case state,
and drives CALL-E to perform the phone action.

Layer 2 (Evidence / Control): every state transition is backed by what the
relevant human actually said on the phone — exact statement, exact
requirement, contractor commitment, reinspection instruction, call id,
timestamps, confidence, ambiguity, unresolved items. Append-only, hash-linked.

The engine never decides whether the restaurant is compliant. It moves the
case until the authority's own process reaches the next legitimate state.

Reusable primitive: verify_call(state, transcript, structured, confidence)
  → {"accepted": bool, "reasons": [code], "to_state": str, "step_type": str}
"""
from __future__ import annotations
import json
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from .models import sha256, GENESIS_HASH, ProtocolError
from .formation import HEDGES

# Board: the visible operational state of a case.
STATES = [
    "CLOSED",
    "BLOCKER_IDENTIFIED",
    "REMEDIATION_BOOKED",
    "REINSPECTION_REQUESTED",
    "REOPENING_PATH_ACTIVE",
]
# Legal transitions — the case can never skip a step or roll back.
TRANSITIONS = {
    "CLOSED": ("BLOCKER_IDENTIFIED", "health_department_requirement"),
    "BLOCKER_IDENTIFIED": ("REMEDIATION_BOOKED", "provider_commitment"),
    "REMEDIATION_BOOKED": ("REINSPECTION_REQUESTED", "reinspection_requested"),
    "REINSPECTION_REQUESTED": ("REOPENING_PATH_ACTIVE", "reopening_confirmed"),
}
TO_LABEL = {
    "health_department": "Health Department",
    "remediation_provider": "Remediation Provider",
}
STEP_ACTOR = {
    "health_department_requirement": "health_department",
    "provider_commitment": "remediation_provider",
    "reinspection_requested": "health_department",
    "reopening_confirmed": "health_department",
}
STEP_WHO = {
    "health_department_requirement": "Health Department",
    "provider_commitment": "Remediation Provider",
    "reinspection_requested": "Health Department",
    "reopening_confirmed": "Health Department",
}
STEP_WHY = {
    "health_department_requirement": ("Explicit violation named and requirement "
                                      "stated by the authority."),
    "provider_commitment": ("Explicit service commitment with date, time, and "
                            "responsible provider."),
    "reinspection_requested": "Authority confirmed a reinspection path.",
    "reopening_confirmed": "Trusted authority source plus dated reopening state.",
}

# Gate reason codes — each maps to a one-line explanation.
REJECT_REASONS = {
    "NO_STATEMENT": "no phone statement recorded for this transition",
    "VIOLATION_UNSTRUCTURED": "health department call produced no structured "
                              "violation or requirement",
    "LOW_CONFIDENCE": "extraction confidence below 0.5",
    "BLOCKER_UNCONFIRMED": "blocker not confirmed — hedged or vague",
    "NO_FIX_WINDOW": "provider gave no concrete fix window",
    "UNSPECIFIED_FIX_TIME": "fix window has no clock time — not bookable",
    "PROVIDER_HEDGED": "provider hedged — not a firm commitment",
    "NO_EXPLICIT_COMMITMENT": "provider did not explicitly commit to the window",
    "NO_REINSPECTION_PATH": "health department did not confirm a reinspection path",
    "PROOF_NOT_TRUSTED": "reopening requires trusted proof; got untrusted source",
    "NO_DATED_REOPENING": ("no dated reopening state — recovery is not a "
                           "promise, it is a date"),
}

WHY_STUCK = {
    "CLOSED": ("Corrective action has not been confirmed.",
               "Identify the blocking violation"),
    "BLOCKER_IDENTIFIED": ("No authorized provider has committed to a fix window.",
                           "Secure a remediation commitment"),
    "REMEDIATION_BOOKED": ("The authority has not confirmed a reinspection path.",
                           "Request the reinspection path"),
    "REINSPECTION_REQUESTED": ("Reopening date is not yet confirmed by the authority.",
                               "Confirm dated reopening with trusted source"),
    "REOPENING_PATH_ACTIVE": ("Waiting on the authority's physical reinspection.",
                               "No further action — case is in the authority's hands"),
}

CLOCK = re.compile(r"\d{1,2}:\d{2}")
TRUSTED_PROOF_SOURCES = {"health_department", "provider_system", "inspection_portal"}

SCHEMA = """
CREATE TABLE IF NOT EXISTS passback_cases (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  location_name TEXT NOT NULL,
  state TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS passback_steps (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  step_type TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  call_id TEXT NOT NULL,
  at TEXT NOT NULL,
  statement TEXT NOT NULL,
  structured_json TEXT NOT NULL,
  confidence REAL NOT NULL,
  ambiguity_json TEXT NOT NULL,
  unresolved_json TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  step_hash TEXT NOT NULL,
  FOREIGN KEY(case_id) REFERENCES passback_cases(id)
);
"""


def _now():
    return datetime.now(timezone.utc).isoformat()


def _hedged(text: str) -> str | None:
    t = text.lower()
    hits = [h for h in HEDGES if h in t]
    return max(hits) if hits else None


def _step_body(case_id, step_type, from_state, to_state, call_id, at,
               statement, structured, confidence) -> str:
    return "|".join([case_id, step_type, from_state, to_state, call_id,
                     at, statement, json.dumps(structured, sort_keys=True),
                     repr(confidence)])


# --------------------------------------------------- public verify primitive
def verify_call(state: str, transcript: str, structured: dict | None = None,
                confidence: float = 0.0, source: str | None = None) -> dict:
    """Evaluate whether a phone statement is sufficient to advance the case
    from its current state.  Pure function — no side effects.

    Returns:
      accepted    : bool — True if the evidence passes the gate
      reasons     : [code, …] — empty when accepted; reason code(s) when not
      detail      : human-readable reason (first reason)
      from_state  : the case state evaluated
      to_state    : next state if accepted
      step_type   : which gate was applied
      ambiguity   : uncertainty items from the extraction
      unresolved  : open items that remain after this call
    """
    structured = structured or {}
    to_state, step_type = TRANSITIONS[state]
    reasons: list[str] = []
    ambiguity: list[dict] = []
    unresolved: list[dict] = []
    detail = ""

    def _fail(code):
        nonlocal detail
        reasons.append(code)
        detail = REJECT_REASONS.get(code, code)
        raise _GateExit(code)

    class _GateExit(Exception):
        pass

    if not transcript or not transcript.strip():
        _fail("NO_STATEMENT")

    try:
        if step_type == "health_department_requirement":
            if "violation" not in structured and "requirement" not in structured:
                _fail("VIOLATION_UNSTRUCTURED")
            if confidence < 0.5:
                _fail("LOW_CONFIDENCE")
            h = _hedged(transcript)
            if h:
                ambiguity.append({"field": "violation", "kind": "UNCERTAIN",
                                  "detail": f"department hedged: '{h}'"})
            if ambiguity:
                _fail("BLOCKER_UNCONFIRMED")
            unresolved.append({"item": "proof_of_service_not_yet_provided"})

        if step_type == "provider_commitment":
            window = structured.get("window") or structured.get("deadline")
            if not window:
                _fail("NO_FIX_WINDOW")
            if not CLOCK.search(str(window)):
                _fail("UNSPECIFIED_FIX_TIME")
            h = _hedged(transcript)
            if h:
                _fail("PROVIDER_HEDGED")
            if not re.search(r"\b(yes|confirm|commit|will|can)\b", transcript.lower()):
                _fail("NO_EXPLICIT_COMMITMENT")
            if confidence < 0.5:
                _fail("LOW_CONFIDENCE")

        if step_type == "reinspection_requested":
            if not re.search(r"reinspect|re-inspect|reopen", transcript.lower()):
                _fail("NO_REINSPECTION_PATH")
            if confidence < 0.5:
                _fail("LOW_CONFIDENCE")
            unresolved.append({"item": "remediation_proof_pending"})

        if step_type == "reopening_confirmed":
            if source not in TRUSTED_PROOF_SOURCES:
                _fail("PROOF_NOT_TRUSTED")
            if not isinstance(structured.get("reopening_date"), dict):
                _fail("NO_DATED_REOPENING")
            if not structured["reopening_date"].get("date"):
                _fail("NO_DATED_REOPENING")
    except _GateExit:
        pass

    return {"accepted": not reasons, "reasons": reasons, "detail": detail,
            "from_state": state, "to_state": to_state, "step_type": step_type,
            "ambiguity": ambiguity, "unresolved": unresolved}


class PassbackStore:
    """Dedicated case ledger. Separate tables, same DB file as the engine."""

    def __init__(self, path: str = ":memory:"):
        self.path = path
        self.conn = sqlite3.connect(path)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.conn.commit()

    def insert_case(self, case) -> None:
        self.conn.execute(
            "INSERT INTO passback_cases(id,location_id,location_name,state,opened_at,updated_at)"
            " VALUES(?,?,?,?,?,?)",
            (case.id, case.location_id, case.location_name, case.state,
             case.opened_at, case.updated_at))
        self.conn.commit()

    def update_state(self, case_id: str, state: str) -> None:
        self.conn.execute(
            "UPDATE passback_cases SET state=?, updated_at=? WHERE id=?",
            (state, _now(), case_id))
        self.conn.commit()

    def get_case(self, case_id: str):
        row = self.conn.execute(
            "SELECT * FROM passback_cases WHERE id=?", (case_id,)).fetchone()
        return dict(row) if row else None

    def last_step_hash(self, case_id: str) -> str:
        row = self.conn.execute(
            "SELECT step_hash FROM passback_steps WHERE case_id=? "
            "ORDER BY at, rowid", (case_id,)).fetchall()
        return row[-1]["step_hash"] if row else GENESIS_HASH

    def insert_step(self, case_id: str, step_type: str, from_state: str, to_state: str,
                    call_id: str, at: str, statement: str, structured: dict,
                    confidence: float, ambiguity: list, unresolved: list) -> dict:
        prev = self.last_step_hash(case_id)
        body = _step_body(case_id, step_type, from_state, to_state, call_id,
                          at, statement, structured, confidence)
        step_hash = sha256(prev + "|" + body)
        step_id = f"step_{uuid.uuid4().hex[:10]}"
        self.conn.execute(
            "INSERT INTO passback_steps(id,case_id,step_type,from_state,to_state,"
            "call_id,at,statement,structured_json,confidence,ambiguity_json,"
            "unresolved_json,previous_hash,step_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (step_id, case_id, step_type, from_state, to_state, call_id, at, statement,
             json.dumps(structured), confidence, json.dumps(ambiguity),
             json.dumps(unresolved), prev, step_hash))
        self.conn.commit()
        return {"id": step_id, "step_type": step_type, "from_state": from_state,
                "to_state": to_state, "call_id": call_id, "at": at,
                "statement": statement, "structured": structured,
                "confidence": confidence, "ambiguity": ambiguity,
                "unresolved": unresolved, "previous_hash": prev, "step_hash": step_hash}

    def steps_for(self, case_id: str):
        rows = self.conn.execute(
            "SELECT * FROM passback_steps WHERE case_id=? ORDER BY at, rowid",
            (case_id,)).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["structured"] = json.loads(d.pop("structured_json"))
            d["ambiguity"] = json.loads(d.pop("ambiguity_json"))
            d["unresolved"] = json.loads(d.pop("unresolved_json"))
            out.append(d)
        return out

    def verify_chain(self, case_id: str) -> dict:
        prev = GENESIS_HASH
        checked = 0
        for r in self.conn.execute(
                "SELECT * FROM passback_steps WHERE case_id=? ORDER BY at, rowid",
                (case_id,)).fetchall():
            recomputed = sha256(
                prev + "|" + _step_body(
                    r["case_id"], r["step_type"], r["from_state"], r["to_state"],
                    r["call_id"], r["at"], r["statement"],
                    json.loads(r["structured_json"]), r["confidence"]))
            if r["previous_hash"] != prev or r["step_hash"] != recomputed:
                return {"ok": False, "checked": checked,
                        "reason": "tamper or broken link"}
            prev = r["step_hash"]
            checked += 1
        return {"ok": True, "checked": checked}

    def list_cases(self):
        return [dict(r) for r in self.conn.execute(
            "SELECT * FROM passback_cases ORDER BY opened_at").fetchall()]

    def clear(self):
        self.conn.execute("DELETE FROM passback_steps")
        self.conn.execute("DELETE FROM passback_cases")
        self.conn.commit()

    def close(self):
        self.conn.close()


class PassbackCase:
    """One location, one failed inspection, one recovery loop."""

    def __init__(self, store: PassbackStore, location_id: str, location_name: str,
                 call_fn=None):
        if call_fn is None:
            call_fn = simulate_phone
        self.store = store
        self.call_fn = call_fn
        self.location_id = location_id
        self.location_name = location_name
        self.id = f"case_{uuid.uuid4().hex[:10]}"
        self.state = "CLOSED"
        self.opened_at = _now()
        self.updated_at = self.opened_at
        store.insert_case(self)

    # ------------------------------------------------------ Layer 1: MOVE THE CASE
    def next_action(self) -> dict:
        """What CALL-E must do next to reach the next legitimate state."""
        info = _next_actions[self.state]
        return {**info}

    @classmethod
    def open(cls, store: PassbackStore, case_id: str, call_fn=None) -> "PassbackCase":
        """Re-open an existing case without creating a new one.

        Keeps the same ledger, same state, same call contract — used by the
        live demo loop (POST /api/cases/<id>/advance)."""
        row = store.get_case(case_id)
        if row is None:
            raise KeyError(f"no case {case_id}")
        c = cls.__new__(cls)
        c.store = store
        c.call_fn = call_fn or simulate_phone
        c.id = row["id"]
        c.location_id = row["location_id"]
        c.location_name = row["location_name"]
        c.state = row["state"]
        c.opened_at = row["opened_at"]
        c.updated_at = row["updated_at"]
        return c

    def run_next(self, **kw) -> dict:
        """Engine → CALL-E → gate → advance, in one stroke.

        Decides next_action from the case state, runs the call, runs the
        evidence gate (pure, no side effects), and only persists the step if
        the gate accepted it.  Returns {step, state, verdict, action, live}.

        Raises PassbackError when the call evidence is insufficient — the
        board does not move and nothing is written to the ledger.
        """
        action = self.next_action()
        if action.get("terminal"):
            raise PassbackError("TERMINAL", "no further phone action for this case")
        structured = kw.pop("structured", None) or {}
        source = kw.pop("source", None) or STEP_ACTOR.get(TRANSITIONS[self.state][1])

        transcript = kw.pop("transcript", None)
        live = False
        if transcript is None:
            # Engine chooses the CALL-E scenario: the first authority call must
            # surface the blocking violation; later authority calls surface the
            # reinspection path. Deterministic simulation mirrors this contract.
            if "scenario" not in kw:
                kw["scenario"] = ("requirement"
                                  if self.state == "CLOSED"
                                  else "auto")
            kw.setdefault("case_id", self.id)
            kw.setdefault("from_state", self.state)
            result = self.call_fn(action["goal"], action["to"], **kw)
            transcript = result.get("transcript", "")
            structured = structured or result.get("extracted", {})
            confidence = structured.get("confidence", 0.0)
            call_id = result.get("call_id")
            live = bool(result.get("live"))
        else:
            confidence = kw.pop("confidence", 0.0)
            call_id = kw.pop("call_id", None)

        g = verify_call(self.state, transcript, structured, confidence, source=source)
        if not g["accepted"]:
            raise PassbackError(g["reasons"][0], g["detail"])
        step = self.store.insert_step(
            self.id, g["step_type"], self.state, g["to_state"],
            call_id or f"call_{uuid.uuid4().hex[:10]}", _now(),
            transcript.strip(), structured, confidence, g["ambiguity"],
            g["unresolved"])
        self.store.update_state(self.id, g["to_state"])
        self.state = g["to_state"]
        return {"step": step, "state": g["to_state"], "verdict": g,
                "action": action, "call_id": call_id, "live": live}

    def execute_next(self, transcript: str, structured: dict | None = None,
                     confidence: float = 0.0, call_id: str | None = None,
                     source: str | None = None) -> dict:
        """Run the next phone action (record it as the truth of the transition).

        Returns {step, state}. Raises PassbackError with the exact reason when
        the evidence is not good enough to move the case.
        """
        structured = structured or {}
        g = verify_call(self.state, transcript, structured, confidence, source)
        if not g["accepted"]:
            raise PassbackError(g["reasons"][0], g["detail"])

        to_state, step_type = g["to_state"], g["step_type"]
        call_id = call_id or f"call_{uuid.uuid4().hex[:10]}"
        step = self.store.insert_step(
            self.id, step_type, self.state, to_state, call_id, _now(),
            transcript.strip(), structured, confidence, g["ambiguity"],
            g["unresolved"])
        self.store.update_state(self.id, to_state)
        self.state = to_state
        return {"step": step, "state": to_state}

    def verify(self, transcript: str, structured: dict | None = None,
               confidence: float = 0.0, source: str | None = None) -> dict:
        """View the verdict without persisting anything."""
        return verify_call(self.state, transcript, structured, confidence, source)


class PassbackError(ProtocolError):
    pass


# --------------------------------------------------- next-action knowledge
_next_actions = {
    "CLOSED": {
        "to": "health_department",
        "label": "Call the health department",
        "goal": ("Ask exactly what must be corrected before reinspection "
                 "for this failed inspection."),
        "question": "What specifically must be corrected before reinspection?",
        "terminal": False,
    },
    "BLOCKER_IDENTIFIED": {
        "to": "remediation_provider",
        "label": "Call the remediation provider",
        "goal": ("An authorized service provider for the blocker is needed. "
                 "Ask whether they can perform the required service and when."),
        "question": "Can you perform the required service, and when will it be completed?",
        "terminal": False,
    },
    "REMEDIATION_BOOKED": {
        "to": "health_department",
        "label": "Call the health department — reinspection path",
        "goal": ("Corrective work is scheduled. Ask the health department "
                 "for the earliest reinspection process."),
        "question": ("The corrective work is scheduled for {window}. "
                     "What is the earliest reinspection process?"),
        "terminal": False,
    },
    "REINSPECTION_REQUESTED": {
        "to": "health_department",
        "label": "Call the health department — remaining steps",
        "goal": ("Reinspection is in motion. Confirm what remains before "
                 "the location may reopen to produce the dated recovery state."),
        "question": "What is the current reinspection status and reopening date?",
        "terminal": False,
    },
    "REOPENING_PATH_ACTIVE": {
        "to": None,
        "label": "Waiting on authority — physical reinspection",
        "goal": ("Recovery path is active. Remaining authority action: physical "
                 "reinspection. MISE waits on the authority."),
        "question": None,
        "terminal": True,
    },
}
# Public alias — server / UI imports this directly.
NEXT_ACTION = _next_actions


# ------------------------------------------------------------ CALL-E scenarios
def simulate_phone(goal: str, to: str, scenario: str = "auto", **kw) -> dict:
    """Offline CALL-E. In production PassbackCase.call_fn is the live
    place_call hook (CALLE_API_URL / CALLE_API_KEY) — same contract."""
    dl = kw.get("deadline", "today at 4:30 PM")
    if to == "health_department":
        if scenario == "requirement":
            transcript = ("Health dept: the grease trap must be serviced by a "
                          "licensed provider and proof of service made available "
                          "before reinspection.")
            extracted = {"violation": "grease_trap",
                         "requirement": "service by licensed provider + proof of service"}
        else:
            transcript = ("Health dept: reinspection request accepted. Schedule for "
                          "tomorrow morning; reopen date pending proof of service.")
            extracted = {"reinspection": "tomorrow_morning",
                         "reopening_date": {"date": "pending", "depends_on": "proof_of_service"}}
    else:  # remediation_provider
        transcript = (f"{kw.get('provider', 'Apex Drain & Grease Co.')}: Yes, "
                      f"we can perform the grease trap service {dl}. I commit to that window.")
        extracted = {"provider": kw.get("provider", "Apex Drain & Grease Co."),
                     "window": dl, "service": "grease_trap_service"}
    extracted["confidence"] = kw.get("confidence", 0.92)
    return {"call_id": f"call_{uuid.uuid4().hex[:10]}", "status": "completed",
            "to": to, "goal": goal, "transcript": transcript,
            "extracted": extracted, "simulated": True, "live": False}
