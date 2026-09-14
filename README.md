# MISE

### Get a closed restaurant back on the road to reopening.

A restaurant fails a health inspection and closes. **MISE coordinates the phone
work required to move that case toward reopening**: identifying the blocker,
securing remediation, and requesting reinspection. **CALL-E makes the calls;
MISE decides what becomes true.**

> **A phone response does not automatically change the case.** Every transition
> requires sufficient evidence from the call. Vague observations, hedged
> commitments, and unsupported agent claims are rejected.

Not "inspection monitoring." Not "AI compliance." Not "call the inspector."
A dashboard can't know what a human at a phone desk knows. A phone agent can
ask — but only if something decides **what to ask next** and **when the answer
is good enough to trust**. That's the product: a board that cannot be moved by
words.

```
FAILED INSPECTION
      ↓
IDENTIFY THE BLOCKING VIOLATION   ← call the health department
      ↓
BOOK THE REQUIRED REMEDIATION     ← call the authorized service provider (confirm the fix window)
      ↓
REQUEST THE REINSPECTION PATH     ← call the health department again
      ↓
REOPENING PATH ACTIVE             ← dated confirmation from a trusted authority, not a promise
```

The board: `CLOSED → BLOCKER IDENTIFIED → REMEDIATION BOOKED → REINSPECTION
REQUESTED → REOPENING PATH ACTIVE`.

---

## One product, two layers

**Layer 1 — Move the case.** The recovery engine reads the case state and
decides the one next phone action. CALL-E performs it. The first call's answer
determines the second; the second determines what gets asked on the third.

```
MISE CASE
   ↓
RECOVERY ENGINE        "next action: call health department"
   ↓
CALL-E                 real phone call
   ↓
structured result + transcript + call id
   ↓
CONTRACTOR             evidence gate
   ├── NO  → case remains BLOCKED, board does not move
   └── YES → state transition, hash-linked ledger append
   ↓
BOARD
```

**Layer 2 — Prove the move.** Every state transition is backed by what the
relevant human *actually said* — exact statement, extracted commitment,
date, confidence, call ID, timestamp, ambiguity, unresolved items.
Append-only, hash-linked: the board can be *verified*, not just claimed.

---

## Try it — stdlib only, zero deps

```bash
python3 demo.py --db contractor.db           # the recovery board, called and defended
python3 server.py --db contractor.db         # dashboard at http://127.0.0.1:8080
python3 -m unittest discover -s tests        # 69 tests, all green
```

---

## CALL-E, live

The architecture is not "demo simulator → fake result → board." The engine
calls CALL-E, CALL-E calls a real phone, the real result enters the evidence
gate.

```bash
export CALLE_API_URL=...
export CALLE_API_KEY=...
python3 demo.py --real-call --db contractor.db
```

Without credentials the demo runs the same pipeline on a deterministic
simulation — same protocol, same gate, same ledger — so judges can evaluate
the full stack offline. The live path posts to `{CALLE_API_URL}/calls`,
normalizes the response into `{call_id, transcript, extracted}` and feeds it
straight into `verify_call`.

The **designated live transition** is `BLOCKER IDENTIFIED → REMEDIATION
BOOKED`: one genuinely live, load-bearing call to the remediation provider.
That one real moment proves the whole architecture; the deterministic backbone
can carry the rest of the demo safely.

---

## CONTRACTOR — the reusable primitive

A commitment protocol for phone agents, distilled into one function:

**Input:** a phone-derived claim.

**Output:** `ACCEPTED | REJECTED` with a reason code.

**Rule:** a state transition cannot occur without an accepted commitment.

```python
from contractor import verify_call

verdict = verify_call(state, transcript, extracted, confidence, source)
if verdict["accepted"]:
    case.advance(verdict)          # board moves, ledger appends
else:
    # reason codes: BLOCKER_UNCONFIRMED · PROVIDER_HEDGED
    #               UNSPECIFIED_FIX_TIME · PROOF_NOT_TRUSTED · …
```

The three rejected paths, always visible:

```
"probably a grease trap"        → BLOCKER_UNCONFIRMED   board stays
"we'll try to get to it soon"   → PROVIDER_HEDGED       board stays
agent: "it can reopen"          → PROOF_NOT_TRUSTED     board stays
"Yes, 4:30 PM today, we commit" → ACCEPTED              board moves
```

### SDK

```python
from contractor.passback import PassbackStore, PassbackCase

store = PassbackStore("contractor.db")
case  = PassbackCase(store, "loc_004", "Harbor Kitchen #04", call_fn=call_e_call)

action = case.next_action()          # engine: what must happen next
result = call_e_call(action["to"], action["goal"])   # CALL-E does the talking
case.execute_next(result["transcript"], result["extracted"],
                  result["extracted"]["confidence"], result["call_id"])
#   board moved — or a PassbackError with the exact reason code
```

---

## The engine never declares compliance

MISE **doesn't decide whether the restaurant is compliant** and never replaces
the health department's decision. The final state is `REOPENING PATH ACTIVE` —
reinspection requested, authority confirmation received, with the remaining
authority action (physical reinspection) still in the department's hands.
MISE coordinates reality; it doesn't pretend to be the authority.

## Under the hood

MISE is the recovery product; its control layer is **CONTRACTOR**, the
commitment protocol (invariant: *committed terms ⊆ mutually confirmed terms*).
Tests: lifecycle matrix, attack corpus, 5,000-mutation property harness, and
the MISE case-ledger suite. Docs: `PROTOCOL.md`, `THREAT_MODEL.md`,
`ARCHITECTURE.md`, `SECURITY.md`.

## The 2:20 demo

| time | beat |
| --- | --- |
| 0:00–0:12 | **Cold open** — restaurant closed, red `CLOSED`, the blocker |
| 0:12–0:30 | **Product** — five-state board, MISE coordinates phone work |
| 0:30–0:55 | **First live CALL-E call** — engine → CALL-E → health department → board advances |
| 0:55–1:15 | **Multi-party recovery** — provider commit, reinspection request |
| 1:15–1:45 | **Attack lab** — vague / hedged / agent claim all REJECTED, real evidence ACCEPTED |
| 1:45–2:05 | **Evidence** — click a transition: call, statement, commitment, call ID, integrity |
| 2:05–2:20 | **Thesis** — board reaches `REOPENING PATH ACTIVE`, "CALL-E makes the calls. MISE decides what becomes true." |