# CONTRACTOR Architecture

```
              CALL-E (real phone calls; simulated offline)
                         │
                         ▼
              ┌─────────────────────┐
              │  FORMATION ENGINE    │  contractor/formation.py
              │  proposal · ambiguity│  PROPOSAL→AMBIGUOUS→CLARIFICATION
              │  clarification ·     │  →MUTUALLY_CONFIRMED (or UNRESOLVED/
              │  convergence ·       │  CONFLICTED/ABANDONED)
              │  confirmation        │
              └──────────┬──────────┘
                         │ confirmation record (hash-sealed, TTL, single-use)
                         ▼
              ┌─────────────────────┐
              │ COMMITMENT PROTOCOL  │  contractor/protocol.py + models.py
              │ canonical terms ·    │  DRAFT→NEGOTIATED→CONFIRMED→ACTIVE/
              │ conditions · parties │  CONDITIONAL→…→FULFILLED|BREACHED|
              │ provenance · version │  EXPIRED|CANCELLED (+AT_RISK/ESCALATED)
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  EVIDENCE ENGINE     │  contractor/evidence.py
              │  freshness · binding │  trusted-only quantity math, conflict
              │  condition proof ·   │  detection, stale/replay rejection
              │  term separation     │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │ ENFORCEMENT (POLICY) │  contractor/policy.py
              │ ALLOW / BLOCK per    │  fulfill · amend · cancel · escalate
              │ action, determinist. │  release_payment · dispatch · close
              └──────────┬──────────┘
                         │
                 ┌───────┴────────┐
                 ▼                ▼
             EXECUTION         AMENDMENT (contractor/recovery.py)
        (examples/order_      NEW VERSION, OLD VERSION UNTOUCHED
         fulfillment.py)
```

Cross-cutting: `contractor/authority.py` (phone presence ≠ authority),
`contractor/audit.py` (append-only hash-linked events), `contractor/sdk.py`
(the public surface — the only documented path to a confirmed obligation),
`contractor/calle_adapter.py` (live CALL-E via `CALLE_API_URL`/`CALLE_API_KEY`,
simulated otherwise).

Storage: SQLite (`contractor/store.py`) — commitments (+conditions,
evidence_requirements, provenance, confirmation, origin), commitment_terms,
evidence, events, authorities, used_confirmations. No services required.

Trust boundary: the LLM proposes, extracts, negotiates, asks clarifications.
It cannot create, confirm, widen, fulfill, amend, or close — every one of
those is a deterministic protocol decision.
