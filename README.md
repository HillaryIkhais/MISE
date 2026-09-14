# MISE

### Don't let 'maybe' become 'done.'

A critical supplier delivery fails. **MISE coordinates the phone work required to
recover** — contacting Torque Precision, extracting a firm commitment, and only
advancing the workflow when the commitment is explicit. **CALL-E makes the
calls; MISE decides when the work is actually allowed to move.**

> **A hedged "we'll try" is not permission to advance.** Every transition
> requires sufficient evidence from the call. Vague observations, hedged
> commitments, and unsupported agent claims are rejected.

```
DELIVERY FAILED
      ↓
SUPPLIER CONTACT REQUIRED    ← call the supplier
      ↓
COMMITMENT ACCEPTED          ← explicit commitment: action, quantity, window, reference
      ↓
RECOVERY COMMITTED           ← delivery in progress, monitored
```

The board: `DELIVERY FAILED → SUPPLIER CONTACT REQUIRED → COMMITMENT ACCEPTED
→ RECOVERY COMMITTED`.

---

## One product, two layers

**Layer 1 — Move the case.** The recovery engine reads the case state and
decides the one next phone action. CALL-E performs it. The first call's answer
determines whether the board advances.

```
MISE CASE
   ↓
RECOVERY ENGINE        "next action: call supplier"
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
supplier *actually said* — exact statement, extracted commitment, delivery
window, confidence, call ID, timestamp. Append-only, hash-linked: the board
can be *verified*, not just claimed.

---

## Try it — stdlib only, zero deps

```bash
python3 demo.py --db contractor.db           # the recovery board, called and defended
python3 server.py --db contractor.db         # dashboard at http://127.0.0.1:8080
python3 -m unittest discover -s tests        # 19 tests, all green
```

---

## CALL-E, live

Live mode activates when all three env vars are present (a tiny stdlib `.env`
loader reads them automatically at startup):

```bash
# .env — do not commit (gitignored)
CALLE_BASE_URL=https://api.heycall-e.com
CALLE_API_KEY=your_live_key
CALLE_PHONE=+15551234567      # consented E.164 destination
```

Without credentials the demo runs the same pipeline on a deterministic
simulation — same protocol, same gate, same ledger — so judges can evaluate
the full stack offline.

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
    # reason codes: SUPPLIER_HEDGED · DELIVERY_WINDOW_MISSING
    #               NO_EXPLICIT_COMMITMENT · PROOF_NOT_TRUSTED · …
```

The rejected paths, always visible:

```
"we'll try to get to it by 4:00 PM"  → SUPPLIER_HEDGED         board stays
"we can probably ship"                → DELIVERY_WINDOW_MISSING  board stays
agent: "delivery confirmed"           → PROOF_NOT_TRUSTED        board stays
"Yes, 4 units, ship today, 2:00 PM"  → ACCEPTED                 board moves
```

---

## The engine never declares delivery complete

MISE **doesn't decide whether the delivery is complete** and never replaces
the supplier's commitment. The final state is `COMMITMENT ACCEPTED` —
recovery committed, delivery in progress, with the remaining delivery action
still in the supplier's hands. MISE coordinates reality; it doesn't pretend
to be the supplier.

## Under the hood

MISE is the recovery product; its control layer is **CONTRACTOR**, the
commitment protocol (invariant: *committed terms ⊆ mutually confirmed terms*).
Tests: lifecycle matrix, attack corpus, mutation property harness, and
the MISE case-ledger suite.

## The 2-minute demo

| time | beat |
| --- | --- |
| 0:00–0:10 | **Cold open** — INCIDENT #1842, 4 units, delivery failed |
| 0:10–0:25 | **Product** — four-state board, MISE coordinates supplier calls |
| 0:25–0:45 | **First call** — supplier hedges, REJECTED, board stays |
| 0:45–1:05 | **Attack lab** — hedged / missing deadline / agent claim all REJECTED |
| 1:05–1:30 | **Escalation** — second call, firm commitment, ACCEPTED |
| 1:30–1:50 | **Evidence** — click a transition: call, statement, commitment, call ID, integrity |
| 1:50–2:00 | **Thesis** — "CALL-E makes the calls. MISE decides when the work is allowed to move." |
