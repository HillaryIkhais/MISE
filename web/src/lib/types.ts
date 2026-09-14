export interface Case {
  id: string;
  location_id: string;
  location_name: string;
  state: string;
  opened_at: string;
  updated_at: string;
  steps: Step[];
  next_action: NextAction;
  why_stuck: [string, string];
  blocker: string | null;
}

export interface Step {
  id: string;
  case_id: string;
  step_type: string;
  from_state: string;
  to_state: string;
  call_id: string;
  at: string;
  statement: string;
  structured: Record<string, unknown>;
  confidence: number;
  ambiguity: unknown[];
  unresolved: unknown[];
  previous_hash: string;
  step_hash: string;
  who: string;
  why: string;
}

export interface NextAction {
  to: string | null;
  label: string;
  goal: string;
  question: string | null;
  terminal: boolean;
}

export interface Stats {
  cases: number;
  transitions: number;
  transitions_accepted: number;
  avg_confidence: number;
  ledger_chain_ok: string;
  tests: number;
  mutations_evaluated: number;
  mutations_violations: number;
}

export interface CalleStatus {
  live: boolean;
  missing: string[];
}

export interface AdvanceResult {
  ok: boolean;
  case?: Case;
  advance?: {
    state: string;
    live: boolean;
    call_id: string;
    statement: string;
    confidence: number;
    verdict: string[];
  };
  reason?: string;
  detail?: string;
  state?: string;
}

export interface Commitment {
  id: string;
  case_id: string;
  actor_id: string;
  terms: Record<string, unknown>;
  evidence: Evidence[];
  events: Event[];
}

export interface Evidence {
  id: string;
  commitment_id: string;
  type: string;
  source: string;
  data_json: string;
  created_at: string;
}

export interface Event {
  id: string;
  commitment_id: string;
  type: string;
  data_json: string;
  timestamp: string;
}

export type ViewState = 
  | "DELIVERY_FAILED"
  | "SUPPLIER_CONTACT_REQUIRED"
  | "COMMITMENT_REJECTED"
  | "COMMITMENT_ACCEPTED"
  | "RECOVERY_COMMITTED";

export const STATE_COLORS: Record<string, string> = {
  DELIVERY_FAILED: "#dc2626",
  SUPPLIER_CONTACT_REQUIRED: "#c6a96b",
  COMMITMENT_REJECTED: "#dc2626",
  COMMITMENT_ACCEPTED: "#16a34a",
  RECOVERY_COMMITTED: "#16a34a",
};

export const STATE_LABELS: Record<string, string> = {
  DELIVERY_FAILED: "BLOCKED",
  SUPPLIER_CONTACT_REQUIRED: "CALLING",
  COMMITMENT_REJECTED: "REJECTED",
  COMMITMENT_ACCEPTED: "ACCEPTED",
  RECOVERY_COMMITTED: "RECOVERY COMMITTED",
};

export const STATE_ICONS: Record<string, string> = {
  DELIVERY_FAILED: "✕",
  SUPPLIER_CONTACT_REQUIRED: "◎",
  COMMITMENT_REJECTED: "✕",
  COMMITMENT_ACCEPTED: "✓",
  RECOVERY_COMMITTED: "✓",
};
