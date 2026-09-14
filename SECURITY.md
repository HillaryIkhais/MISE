# CONTRACTOR Security Notes

- **Fail closed.** Unknown phrasing, missing terms, hedges, and partial
  read-backs produce `AMBIGUOUS` / rejection — never a best-guess commitment.
- **No silent mutation.** `UPDATE commitment` does not exist in the API.
  Amendments are new rows with `parent_id`; v1 stays inspectable forever.
- **No self-confirmation.** The raw `propose_commitment` path creates at most
  an *unconfirmed programmatic* obligation (`origin=programmatic`,
  empty confirmation). It can become `FULFILLED` by evidence, but the
  execution gate refuses `release_payment`/`dispatch` on it (`UNCONFIRMED`).
  Only the formation path yields `origin=formation` with a sealed record.
- **Confirmations are bearer-proof.** Hash-sealed, actor-bound, 48h TTL,
  single-use ledger. Forgery, replay, expiry, and wrong-actor use each have
  their own rejection code and test.
- **Evidence is bound and fresh.** Commitment-bound, type-separated
  (condition proof ≠ quantity), deduplicated by payload hash, stale-rejected.
- **History is tamper-evident.** Append-only hash-linked audit chain per
  commitment; `verify_chain` detects modification (`TAMPER_DETECTED`).
- **Privileged paths are lit, not hidden.** `sdk.privileged_import` requires
  `kind` + `reason`, emits `PRIVILEGED_IMPORT`, and never carries confirmation.
- **No overclaim.** Machine-enforceable within integrated systems (the order
  gate proves it); not legal enforceability, not speaker authentication, not
  universal NLU. See THREAT_MODEL.md "Out of scope".
