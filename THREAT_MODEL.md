# CONTRACTOR Threat Model

**Scope:** the semantic boundary between "a human said something on a phone
call" and "an autonomous system may treat it as a real-world obligation."

| # | Threat | Invariant | Enforcement point | Test | Observable failure |
|---|---|---|---|---|---|
| 1 | Agent hallucinates agreement | No shared commitment without convergence | `formation.mutual_confirm` | formation-01, attack-lab vague corpus | `AMBIGUITY_UNRESOLVED` |
| 2 | Agent over-interprets hedge (`should be fine`, `maybe`) | Hedges never confirm | ambiguity taxonomy | formation-01/05, demo scene 0 | `AMBIGUOUS`, no row created |
| 3 | Term escalation (100→120) | Committed ⊆ Confirmed | `check_non_widening` | formation-03, property (5000) | `QUANTITY_WIDENED` |
| 4 | Term narrowing (100→60) | Exact match required | `check_non_widening` | property | `QUANTITY_NARROWED` |
| 5 | Deadline shift | Deadline equality | `check_non_widening` | formation-04, property | `DEADLINE_WIDENED/SHIFTED` |
| 6 | Destination / unit / object / price / currency swap | Canonical term equality | `check_non_widening` | attack-lab 08/09, property | `*_SUBSTITUTED` |
| 7 | Condition stripping | Conditions sticky + set-equal | gate + `CONDITIONAL` state | formation-02/06, demo scene 4 | `CONDITION_DROPPED`, `BLOCKED_CONDITIONAL` |
| 8 | Condition neutering (added `if pigs fly`) | No unconfirmed conditions | `check_non_widening` | property (`CONDITION_ADDED`) | `CONDITION_ADDED` |
| 9 | Confirmation forgery | Hash-sealed records | `propose_commitment` 4a | attack-lab 07 | `CONFIRMATION_FORGED` |
| 10 | Confirmation replay | Single-use ledger | `used_confirmations` | attack-lab 06 | `CONFIRMATION_REPLAYED` |
| 11 | Stale/expired confirmation | 48h TTL | `propose_commitment` 4b | attack-lab 05 | `CONFIRMATION_EXPIRED` |
| 12 | Wrong-actor confirmation | Actor binding | `propose_commitment` 4c | attack-lab 04 | `CONFIRMATION_ACTOR_MISMATCH` |
| 13 | Partial read-back | 2-of-3 completeness | `mutual_confirm` | attack-lab 03 | `PARTIAL_CONFIRMATION` |
| 14 | Reference deferral (`do the usual`) | No implicit context | taxonomy | attack-lab 01/02 | `REFERENCE_AMBIGUITY` |
| 15 | Counterparty contradiction | Symmetry check first | `mutual_confirm` | formation-07 | `CONVERSATION_CONFLICT` |
| 16 | Early fulfillment claim | Claims are untrusted evidence | `agent_claim_fulfilled` | protocol-05, demo final | `FULFILLMENT_BLOCKED` |
| 17 | Stale evidence replay | Freshness window | `summarize_evidence` | formation-10 | `stale_ignored`, no transition |
| 18 | Evidence substitution (wrong commitment) | Commitment binding | `attach_evidence` | attack-lab 10 | `EVIDENCE_COMMITMENT_MISMATCH` |
| 19 | Condition proof as quantity | Type separation | `summarize_evidence` | attack-lab 11 | no fulfillment |
| 20 | History rewrite | Immutability | `update_terms` | protocol-11, demo scene 6 | `IMMUTABLE_OBLIGATION` |
| 21 | Recovery erasing breach | Lineage preservation | `create_amendment` | protocol-17/18, formation-11 | parent stays `BREACHED` |
| 22 | Unauthorized creation/amendment | Authority registry | `check_authority` | protocol-04, attack-lab 13 | `AUTHORITY_SCOPE_MISMATCH` |
| 23 | Unconfirmed payment | Execution gate | `policy.evaluate` | attack-lab 14, `examples/` | `UNCONFIRMED` payment refusal |
| 24 | Audit tampering | Hash-linked chain | `verify_chain` | protocol-19 | `TAMPER_DETECTED` |

**Out of scope (stated, not hidden):** speaker-voice authentication (assumes
CALL-E caller identity), legal enforceability (machine-enforceable within
integrated systems, not a court), universal NLU (lexical detector is
deliberately narrow — unknown phrasing fails closed to `AMBIGUOUS`).
