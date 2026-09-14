# CONTRACTOR Protocol Specification

> **No commitment exists beyond what both parties explicitly confirmed.**
> Formally: **Committed Terms ⊆ Mutually Confirmed Terms.**

## 1. Canonical commitment

| Field | Required | Semantics |
|---|---|---|
| `parties` (`actor_id`, `actor_name`) | yes | Counterparty identity; authority-checked, never inferred |
| `action` | yes | The obligated act (`deliver`, …) |
| `quantity` | yes | Numeric, > 0. `100 ≠ 120` |
| `unit` | yes | `100 boxes ≠ 100 units` |
| `object` | no | What is delivered (`bolts` ≠ `nuts`) |
| `destination` | yes | `Warehouse A ≠ Warehouse B` |
| `deadline` | yes | ISO timestamp. `Friday ≠ Monday`; earlier ≠ later |
| `price` / `currency` | no | Once confirmed, immutable. `USD ≠ NGN` |
| `conditions` | no | Per-commitment; conditional ≠ unconditional |
| `cancellation_terms` | no | Once confirmed, immutable |
| `evidence_requirements` | yes (defaulted) | Machine-readable proof rules per commitment |
| `confirmation` | phone path only | `{confirmation_id, actor_id, terms_hash, confirmed_at, call_id}` |
| `provenance` | yes (phone path) | Per-term `{source, confidence, verbatim}` |
| `version` (`id`, `parent_id`, `amended_by`) | yes | Lineage; v1 never mutated |
| `status` | yes | Below |

Any change to a confirmed field is a **materially different obligation** and
must travel as an amendment (v2), never an edit.

## 2. Formation state machine

```
PROPOSAL → AMBIGUOUS → CLARIFICATION → MUTUALLY_CONFIRMED → COMMITTED
              ↓              ↓
         UNRESOLVED     CONFLICTED / ABANDONED
```

Illegal: `clarify()` on a `MUTUALLY_CONFIRMED` proposal
(`INVALID_FORMATION_TRANSITION`); post-confirm changes need a new proposal.

## 3. Lifecycle state machine

```
DRAFT → NEGOTIATED → CONFIRMED → ACTIVE → AT_RISK → FULFILLED
                          ↓          ↓         ↓
                    CONDITIONAL   ESCALATED  BREACHED / EXPIRED
                          ↓
                        ACTIVE (conditions proven) — else BLOCKED_CONDITIONAL
```

Terminal: `FULFILLED, BREACHED, EXPIRED, CANCELLED`.
Only the protocol module performs transitions; the full table is
`ALLOWED_TRANSITIONS` in `contractor/models.py`. Illegal transitions raise
`INVALID_STATE_TRANSITION`.

## 4. Ambiguity taxonomy (auditable, lexical by design)

`MISSING_* | APPROXIMATE→AMBIGUOUS_QUANTITY | IMPRECISE→AMBIGUOUS_TIME |
HEDGE | CONDITIONAL_TERM | REFERENCE_AMBIGUITY | UNCONFIRMED
(NO_EXPLICIT_CONFIRMATION) | PARTIAL_CONFIRMATION | CONTRADICTORY_TERM`.
The protocol never resolves these silently — each yields a clarification
question or a rejection.

## 5. Confirmation record

Single-use (`CONFIRMATION_REPLAYED`), 48h TTL (`CONFIRMATION_EXPIRED`),
actor-bound (`CONFIRMATION_ACTOR_MISMATCH`), hash-sealed
(`CONFIRMATION_FORGED`), read-back completeness ≥ 2 of
quantity/destination/deadline (`PARTIAL_CONFIRMATION`).

## 6. Evidence rules

Trusted sources only count toward quantity; `condition_proof` never counts
as quantity; evidence addressed to another commitment is rejected
(`EVIDENCE_COMMITMENT_MISMATCH`); pre-obligation replays and over-age
evidence are `STALE` (300s clock-skew grace); duplicates rejected.
Late full delivery is `EXPIRED`, not fulfilled.

## 7. Execution policy (`contractor/policy.py`)

`fulfill` = reality (evidence). `release_payment` = proof + confirmation.
`dispatch` = confirmed + executable (performance, allowed pre-evidence).
`amend` = living states only. `close` = `FULFILLED`/`CANCELLED` only —
breach must amend, never close.
