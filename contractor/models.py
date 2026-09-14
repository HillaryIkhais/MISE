"""CONTRACTOR — commitment protocol for AI phone agents.
Core domain models. Deterministic. No LLM here.
Thesis: A promise is not proof. The phone call creates the obligation;
it is not the record of truth.
"""
from __future__ import annotations
import hashlib
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Optional

# ---------------------------------------------------------------- states

DRAFT = "DRAFT"
NEGOTIATED = "NEGOTIATED"
CONFIRMED = "CONFIRMED"
CONDITIONAL = "CONDITIONAL"
ACTIVE = "ACTIVE"
AT_RISK = "AT_RISK"
ESCALATED = "ESCALATED"
FULFILLED = "FULFILLED"
BREACHED = "BREACHED"
EXPIRED = "EXPIRED"
CANCELLED = "CANCELLED"
# Formation-layer outcomes (pre-obligation; no commitment row exists yet,
# tracked as negotiation records + audit events on a proposal id):
PROPOSAL = "PROPOSAL"
AMBIGUOUS = "AMBIGUOUS"
CLARIFICATION = "CLARIFICATION"
MUTUALLY_CONFIRMED = "MUTUALLY_CONFIRMED"
UNRESOLVED = "UNRESOLVED"
CONFLICTED = "CONFLICTED"
ABANDONED = "ABANDONED"

TERMINAL = {FULFILLED, EXPIRED, CANCELLED}
FORMATION_TERMINAL = {UNRESOLVED, CONFLICTED, ABANDONED}
# AMENDED is not a state: parent keeps its state; child carries parent_id.
# (Keeps "no silent history rewriting" visible in lineage graph.)

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    DRAFT: {NEGOTIATED, CANCELLED},
    NEGOTIATED: {CONFIRMED, CONDITIONAL, CANCELLED},
    CONFIRMED: {ACTIVE, CONDITIONAL, CANCELLED},
    CONDITIONAL: {ACTIVE, EXPIRED, CANCELLED, BREACHED},
    ACTIVE: {AT_RISK, FULFILLED, BREACHED, EXPIRED, CANCELLED, ESCALATED},
    AT_RISK: {FULFILLED, BREACHED, EXPIRED, ESCALATED, CANCELLED},
    ESCALATED: {FULFILLED, BREACHED, EXPIRED, CANCELLED},
    BREACHED: set(),   # terminal, spawns children via amendment (new rows)
    EXPIRED: set(),    # terminal, spawns children via amendment
    FULFILLED: set(),
    CANCELLED: set(),
}

AMENDABLE_STATES = {ACTIVE, AT_RISK, ESCALATED, BREACHED, EXPIRED, CONDITIONAL}

# ------------------------------------------------------- trust boundaries

# LLM CAN: extract candidates, negotiate, suggest recovery, summarize.
# LLM CANNOT: create commitments directly, declare fulfillment, manufacture
# evidence, override deadlines, resolve conflicts, mutate history.
# Only the protocol (this package) performs state transitions.

TRUSTED_SOURCES = {"warehouse_system", "erp", "carrier_scan", "bank_ledger"}
UNTRUSTED_SOURCES = {"supplier_claim", "phone_claim", "agent_claim", "llm_extraction"}

REQUIRED_TERMS = ["action", "quantity", "unit", "destination", "deadline"]

GENESIS_HASH = "GENESIS"


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def canonical(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), default=str)


def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def fingerprint_terms(terms: dict) -> str:
    return sha256(canonical(terms))


# ---------------------------------------------------------------- models

@dataclass
class Commitment:
    id: str
    parent_id: Optional[str]
    actor_id: str
    actor_name: str
    source_call_id: Optional[str]
    state: str = DRAFT
    created_at: str = field(default_factory=utcnow_iso)
    effective_at: Optional[str] = None
    deadline: Optional[str] = None
    fingerprint: str = ""
    terms: dict = field(default_factory=dict)
    amended_by: Optional[str] = None  # filled on child creation (link only)
    # --- 10/10 formation layer: per-commitment conditions, evidence
    # requirements, term provenance, and the mutual-confirmation record.
    # Committed Terms ⊆ Mutually Confirmed Terms is enforced at creation.
    conditions: list = field(default_factory=list)
    evidence_requirements: list = field(default_factory=list)
    provenance: dict = field(default_factory=dict)
    confirmation: dict = field(default_factory=dict)
    # origin: 'formation' (mutually confirmed by phone) | 'programmatic'
    # (system-created, unconfirmed) | 'amendment' | privileged imports.
    # The raw path can NEVER manufacture a confirmed obligation: confirmation
    # stays empty unless a formation record passes the gate.
    origin: str = "programmatic"


@dataclass
class Evidence:
    id: str
    commitment_id: str
    type: str
    source: str
    observed_at: str
    payload_hash: str
    payload: dict = field(default_factory=dict)

    @property
    def quantity(self) -> float:
        try:
            return float(self.payload.get("quantity", 0))
        except (TypeError, ValueError):
            return 0.0


@dataclass
class AuditEvent:
    id: str
    commitment_id: str
    event_type: str
    timestamp: str
    actor: str
    payload: dict
    previous_hash: str
    event_hash: str


# ---------------------------------------------------------------- errors

class ProtocolError(Exception):
    """Deterministic rejection. Includes machine-readable reason code."""

    def __init__(self, reason: str, detail: str = ""):
        super().__init__(f"{reason}: {detail}" if detail else reason)
        self.reason = reason
        self.detail = detail
