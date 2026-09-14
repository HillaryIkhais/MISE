import { Case, Stats, CalleStatus, AdvanceResult, Commitment } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export async function fetchCases(): Promise<Case[]> {
  return apiFetch<Case[]>("/api/cases");
}

export async function fetchCase(id: string): Promise<Case> {
  const cases = await fetchCases();
  const c = cases.find((c) => c.id === id);
  if (!c) throw new Error(`Case ${id} not found`);
  return c;
}

export async function fetchStats(): Promise<Stats> {
  return apiFetch<Stats>("/api/stats");
}

export async function fetchCalleStatus(): Promise<CalleStatus> {
  return apiFetch<CalleStatus>("/api/calle");
}

export async function advanceCase(id: string): Promise<AdvanceResult> {
  return apiFetch<AdvanceResult>(`/api/cases/${id}/advance`, {
    method: "POST",
  });
}

export async function fetchCommitments(): Promise<Commitment[]> {
  return apiFetch<Commitment[]>("/api/commitments");
}

export async function fetchAttacks(caseId: string): Promise<unknown> {
  return apiFetch<unknown>(`/api/attacks/${caseId}`);
}
