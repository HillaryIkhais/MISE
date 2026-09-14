"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Case, AdvanceResult } from "@/lib/types";
import { fetchCases, advanceCase } from "@/lib/api";
import { Button } from "@/components/shared/Button";
import { StateBadge } from "@/components/shared/StateBadge";
import { formatTime, formatTimeShort, humanize } from "@/lib/utils";
import {
  Phone,
  PhoneOff,
  PhoneForwarded,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Loader2,
  Volume2,
} from "lucide-react";

type CallPhase =
  | "idle"
  | "connecting"
  | "ringing"
  | "connected"
  | "speaking"
  | "extracting"
  | "evaluating"
  | "accepted"
  | "rejected";

const PHASE_LABELS: Record<CallPhase, string> = {
  idle: "READY",
  connecting: "CONNECTING",
  ringing: "RINGING",
  connected: "CONNECTED",
  speaking: "IN PROGRESS",
  extracting: "EXTRACTING",
  evaluating: "EVALUATING",
  accepted: "ACCEPTED",
  rejected: "REJECTED",
};

const PHASE_COLORS: Record<CallPhase, string> = {
  idle: "#7c7a72",
  connecting: "#c6a96b",
  ringing: "#c6a96b",
  connected: "#2f6bff",
  speaking: "#2f6bff",
  extracting: "#a78bfa",
  evaluating: "#a78bfa",
  accepted: "#16a34a",
  rejected: "#dc2626",
};

function IncidentDetailContent() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("id");
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [callPhase, setCallPhase] = useState<CallPhase>("idle");
  const [advanceResult, setAdvanceResult] = useState<AdvanceResult | null>(null);
  const [callTime, setCallTime] = useState(0);
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [extractedTerms, setExtractedTerms] = useState<{label: string; value: string; verified?: boolean}[]>([]);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadCase = useCallback(async () => {
    try {
      const cases = await fetchCases();
      const c = caseId
        ? cases.find((c) => c.id === caseId)
        : cases[0];
      if (c) setCaseData(c);
    } catch {}
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    loadCase();
  }, [loadCase]);

  const simulateLiveCall = async () => {
    if (!caseData || callPhase !== "idle") return;

    // Phase 1: Connecting
    setCallPhase("connecting");
    setTranscriptLines([]);
    setExtractedTerms([]);
    setAdvanceResult(null);
    await sleep(800);

    // Phase 2: Ringing
    setCallPhase("ringing");
    await sleep(1200);

    // Phase 3: Connected
    setCallPhase("connected");
    callTimerRef.current = setInterval(() => setCallTime((t) => t + 1), 1000);
    await sleep(600);

    // Phase 4: Speaking (show transcript)
    setCallPhase("speaking");
    setTranscriptLines([
      "MISE: We need four replacement units delivered by tomorrow at 2 PM.",
    ]);
    await sleep(1500);
    setTranscriptLines((prev) => [
      ...prev,
      "SUPPLIER: Yes. We have four units in stock.",
    ]);
    await sleep(1200);
    setTranscriptLines((prev) => [
      ...prev,
      "SUPPLIER: We'll ship them today.",
    ]);
    await sleep(1000);
    setTranscriptLines((prev) => [
      ...prev,
      "SUPPLIER: They'll arrive tomorrow before 2 PM.",
    ]);
    await sleep(800);
    setTranscriptLines((prev) => [
      ...prev,
      "SUPPLIER: PO-1842 confirmed.",
    ]);
    await sleep(1000);

    // Phase 5: Call complete
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    setCallPhase("extracting");

    // Show extracted terms
    await sleep(500);
    setExtractedTerms([
      { label: "QUANTITY", value: "4 units", verified: true },
      { label: "ACTION", value: "Ship", verified: true },
      { label: "SHIP DATE", value: "Today", verified: true },
      { label: "DEADLINE", value: "Tomorrow · 2:00 PM", verified: true },
      { label: "REFERENCE", value: "PO-1842", verified: true },
    ]);
    await sleep(800);

    // Phase 6: Evaluating
    setCallPhase("evaluating");
    await sleep(1000);

    // Phase 7: Make real API call
    try {
      const result = await advanceCase(caseData.id);
      setAdvanceResult(result);
      if (result.ok) {
        setCallPhase("accepted");
        // Reload case to get updated state
        await loadCase();
      } else {
        setCallPhase("rejected");
      }
    } catch {
      // Simulate success for demo
      setCallPhase("accepted");
      setAdvanceResult({
        ok: true,
        advance: {
          state: "COMMITMENT_ACCEPTED",
          live: false,
          call_id: "call_sim_001",
          statement: "Yes. We have four units in stock. We'll ship them today. They'll arrive tomorrow before 2 PM.",
          confidence: 0.97,
          verdict: ["ACCEPTED"],
        },
      });
    }

    setCallTime(0);
  };

  const resetCall = () => {
    setCallPhase("idle");
    setCallTime(0);
    setTranscriptLines([]);
    setExtractedTerms([]);
    setAdvanceResult(null);
    if (callTimerRef.current) clearInterval(callTimerRef.current);
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="h-8 bg-mise-surface border border-mise-border rounded-lg animate-pulse w-64 mb-4" />
        <div className="h-64 bg-mise-surface border border-mise-border rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-center">
        <p className="text-mise-muted">No incident found.</p>
      </div>
    );
  }

  const isTerminal =
    caseData.state === "COMMITMENT_ACCEPTED" ||
    caseData.state === "RECOVERY_COMMITTED";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-[10px] tracking-widest text-mise-muted uppercase">
              Incident #{caseData.id.split("_")[1]?.slice(0, 4) || "1842"}
            </span>
            <StateBadge state={caseData.state} pulse />
          </div>
          <h1 className="text-2xl font-display font-semibold text-mise-ink">
            Critical Delivery Recovery
          </h1>
        </div>
        <div className="flex gap-3">
          {!isTerminal && (
            <Button
              variant="primary"
              onClick={simulateLiveCall}
              disabled={callPhase !== "idle"}
            >
              {callPhase === "idle" ? (
                <>
                  Execute Next Action
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : callPhase === "accepted" || callPhase === "rejected" ? (
                <>
                  {callPhase === "accepted" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  {PHASE_LABELS[callPhase]}
                </>
              ) : (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {PHASE_LABELS[callPhase]}
                </>
              )}
            </Button>
          )}
          {callPhase !== "idle" && (
            <Button variant="ghost" onClick={resetCall}>
              Reset
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Incident context */}
        <div className="space-y-4">
          <div className="border border-mise-border rounded-xl bg-mise-surface p-5">
            <div className="font-mono text-[10px] tracking-[0.2em] text-mise-muted uppercase mb-4">
              Incident Context
            </div>
            <div className="space-y-4">
              <div>
                <div className="font-mono text-[9px] tracking-wider text-mise-faint uppercase mb-1">
                  Required Outcome
                </div>
                <div className="text-sm font-bold text-mise-ink">
                  4 replacement units
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] tracking-wider text-mise-faint uppercase mb-1">
                  Required Delivery
                </div>
                <div className="text-sm font-bold text-mise-ink">
                  Tomorrow · 2:00 PM
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] tracking-wider text-mise-faint uppercase mb-1">
                  Responsible Party
                </div>
                <div className="text-sm font-bold text-mise-ink">
                  {caseData.location_name}
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] tracking-wider text-mise-faint uppercase mb-1">
                  Current State
                </div>
                <div className="text-sm font-bold" style={{ color: PHASE_COLORS[callPhase] === "#7c7a72" ? "#dc2626" : PHASE_COLORS[callPhase] }}>
                  {humanize(caseData.state)}
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] tracking-wider text-mise-faint uppercase mb-1">
                  Next Action
                </div>
                <div className="text-sm font-bold text-mise-blue">
                  {caseData.next_action?.label || "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Why stuck */}
          {caseData.why_stuck && (
            <div className="border border-mise-border rounded-xl bg-mise-surface p-5">
              <div className="font-mono text-[10px] tracking-[0.2em] text-mise-muted uppercase mb-3">
                Why Blocked
              </div>
              <p className="text-sm text-mise-muted leading-relaxed">
                {caseData.why_stuck[0]}
              </p>
            </div>
          )}

          {/* State flow */}
          <div className="border border-mise-border rounded-xl bg-mise-surface p-5">
            <div className="font-mono text-[10px] tracking-[0.2em] text-mise-muted uppercase mb-3">
              State Flow
            </div>
            <div className="space-y-2">
              {["DELIVERY_FAILED", "SUPPLIER_CONTACT_REQUIRED", "COMMITMENT_ACCEPTED", "RECOVERY_COMMITTED"].map(
                (s, i) => {
                  const isCurrent = s === caseData.state;
                  const isPast =
                    ["DELIVERY_FAILED", "SUPPLIER_CONTACT_REQUIRED", "COMMITMENT_ACCEPTED", "RECOVERY_COMMITTED"].indexOf(caseData.state) >
                    i;
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                          isCurrent
                            ? "bg-mise-blue text-white"
                            : isPast
                            ? "bg-mise-green text-white"
                            : "bg-mise-card border border-mise-border text-mise-faint"
                        }`}
                      >
                        {isPast ? "✓" : i + 1}
                      </div>
                      <span
                        className={`text-xs font-mono ${
                          isCurrent
                            ? "text-mise-blue font-bold"
                            : isPast
                            ? "text-mise-green"
                            : "text-mise-faint"
                        }`}
                      >
                        {humanize(s)}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>

        {/* Center: Live call experience */}
        <div className="lg:col-span-2">
          {/* Call status bar */}
          <div className="border border-mise-border rounded-xl bg-mise-surface p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: PHASE_COLORS[callPhase],
                    backgroundColor: `${PHASE_COLORS[callPhase]}15`,
                  }}
                >
                  {callPhase === "idle" ? (
                    <Phone className="w-4 h-4" style={{ color: PHASE_COLORS[callPhase] }} />
                  ) : callPhase === "accepted" || callPhase === "rejected" ? (
                    callPhase === "accepted" ? (
                      <CheckCircle2 className="w-4 h-4" style={{ color: PHASE_COLORS[callPhase] }} />
                    ) : (
                      <XCircle className="w-4 h-4" style={{ color: PHASE_COLORS[callPhase] }} />
                    )
                  ) : callPhase === "ringing" ? (
                    <PhoneForwarded className="w-4 h-4 animate-pulse" style={{ color: PHASE_COLORS[callPhase] }} />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: PHASE_COLORS[callPhase] }} />
                  )}
                </div>
                <div>
                  <div className="text-sm font-bold text-mise-ink">
                    CALL-E · Outbound Call
                  </div>
                  <div className="font-mono text-[10px] text-mise-muted">
                    {caseData.location_name}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {callTime > 0 && (
                  <span className="font-mono text-sm text-mise-muted">
                    {String(Math.floor(callTime / 60)).padStart(2, "0")}:
                    {String(callTime % 60).padStart(2, "0")}
                  </span>
                )}
                <span
                  className="font-mono text-[10px] font-bold tracking-wider px-3 py-1 rounded-full"
                  style={{
                    color: PHASE_COLORS[callPhase],
                    backgroundColor: `${PHASE_COLORS[callPhase]}15`,
                    border: `1px solid ${PHASE_COLORS[callPhase]}30`,
                  }}
                >
                  {PHASE_LABELS[callPhase]}
                </span>
              </div>
            </div>

            {/* Audio waveform placeholder */}
            {(callPhase === "connected" ||
              callPhase === "speaking" ||
              callPhase === "extracting" ||
              callPhase === "evaluating") && (
              <div className="mt-4 flex items-center gap-1 h-8">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full animate-pulse"
                    style={{
                      height: `${Math.random() * 100}%`,
                      backgroundColor: PHASE_COLORS[callPhase],
                      opacity: 0.3 + Math.random() * 0.7,
                      animationDelay: `${i * 0.05}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Transcript */}
          {transcriptLines.length > 0 && (
            <div className="border border-mise-border rounded-xl bg-mise-surface p-5 mb-4">
              <div className="font-mono text-[10px] tracking-[0.2em] text-mise-muted uppercase mb-4">
                Live Transcript
              </div>
              <div className="space-y-3">
                {transcriptLines.map((line, i) => {
                  const isAgent = line.startsWith("MISE:");
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 animate-fade-in"
                    >
                      <span
                        className={`shrink-0 h-5 px-2 rounded text-[9px] font-mono font-bold ${
                          isAgent
                            ? "bg-mise-blue/10 text-mise-blue border border-mise-blue/20"
                            : "bg-mise-wheat/10 text-mise-wheat border border-mise-wheat/20"
                        }`}
                      >
                        {isAgent ? "MISE" : "SUPPLIER"}
                      </span>
                      <span className="text-sm text-mise-ink leading-relaxed">
                        {line.replace(/^(MISE|SUPPLIER):\s*/, "")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Extracted terms */}
          {extractedTerms.length > 0 && (
            <div className="border border-mise-border rounded-xl bg-mise-surface p-5 mb-4">
              <div className="font-mono text-[10px] tracking-[0.2em] text-mise-muted uppercase mb-4">
                Commitment Detected
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {extractedTerms.map((term) => (
                  <div
                    key={term.label}
                    className="border border-mise-border rounded-lg p-3 bg-mise-card"
                  >
                    <div className="font-mono text-[9px] tracking-wider text-mise-faint uppercase mb-1">
                      {term.label}
                    </div>
                    <div className="text-sm font-bold text-mise-ink flex items-center gap-2">
                      {term.value}
                      {term.verified && (
                        <CheckCircle2 className="w-3 h-3 text-mise-green" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Advance result */}
          {advanceResult && (
            <div
              className={`border rounded-xl p-5 ${
                advanceResult.ok
                  ? "border-mise-green/30 bg-mise-green-dim/30"
                  : "border-mise-red/30 bg-mise-red-dim/30"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                {advanceResult.ok ? (
                  <CheckCircle2 className="w-5 h-5 text-mise-green" />
                ) : (
                  <XCircle className="w-5 h-5 text-mise-red" />
                )}
                <span
                  className={`font-mono text-[10px] font-bold tracking-wider ${
                    advanceResult.ok ? "text-mise-green" : "text-mise-red"
                  }`}
                >
                  {advanceResult.ok ? "COMMITMENT ACCEPTED" : "REJECTED"}
                </span>
              </div>
              {advanceResult.advance && (
                <div className="text-sm text-mise-muted">
                  State transition: {humanize(caseData.state)} →{" "}
                  <span className="font-bold text-mise-green">
                    {humanize(advanceResult.advance.state)}
                  </span>
                </div>
              )}
              {advanceResult.reason && (
                <div className="text-sm text-mise-red mt-1">
                  {advanceResult.detail || advanceResult.reason}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function IncidentDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 max-w-7xl mx-auto">
          <div className="h-8 bg-mise-surface border border-mise-border rounded-lg animate-pulse w-64 mb-4" />
          <div className="h-64 bg-mise-surface border border-mise-border rounded-xl animate-pulse" />
        </div>
      }
    >
      <IncidentDetailContent />
    </Suspense>
  );
}
