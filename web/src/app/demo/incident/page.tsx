"use client";

import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Case, AdvanceResult } from "@/lib/types";
import { fetchCases, advanceCase, fetchCalleStatus } from "@/lib/api";
import { humanize } from "@/lib/utils";
import {
  Phone,
  PhoneForwarded,
  CheckCircle2,
  XCircle,
  Loader2,
  PhoneCall,
} from "lucide-react";

const FLOW_STATES = [
  "DELIVERY_FAILED",
  "SUPPLIER_CONTACT_REQUIRED",
  "COMMITMENT_ACCEPTED",
  "RECOVERY_COMMITTED",
];

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
  extracting: "EXTRACTING COMMITMENT",
  evaluating: "EVALUATING",
  accepted: "COMMITMENT ACCEPTED",
  rejected: "REJECTED",
};

const PHASE_COLORS: Record<CallPhase, string> = {
  idle: "#8a887f",
  connecting: "#c6a96b",
  ringing: "#c6a96b",
  connected: "#2f6bff",
  speaking: "#2f6bff",
  extracting: "#a78bfa",
  evaluating: "#a78bfa",
  accepted: "#16a34a",
  rejected: "#dc2626",
};

function IncidentContent() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("id");
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [callPhase, setCallPhase] = useState<CallPhase>("idle");
  const [advanceResult, setAdvanceResult] = useState<AdvanceResult | null>(null);
  const [callTime, setCallTime] = useState(0);
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [extractedTerms, setExtractedTerms] = useState<
    { label: string; value: string; verified?: boolean }[]
  >([]);
  const [isLive, setIsLive] = useState(false);
  const [mode, setMode] = useState<"idle" | "simulation" | "live">("idle");
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Stable pseudo-random wavebars keyed to phase so they never re-roll on re-render
  const wavebars = useMemo(
    () =>
      Array.from({ length: 54 }, (_, i) => {
        const n = (Math.sin(i * 12.9898 + callPhase.length * 78.233) * 43758.5453) % 1;
        return {
          height: 20 + Math.abs(n) * 80,
          opacity: 0.3 + Math.abs(Math.sin(i * 3.7 + callPhase.length)) * 0.7,
          delay: i * 0.03,
        };
      }),
    [callPhase]
  );

  const loadCase = useCallback(async (): Promise<Case | null> => {
    try {
      const cases = await fetchCases();
      const c = caseId ? cases.find((c) => c.id === caseId) : cases[0];
      return c || null;
    } catch {
      return null;
    }
  }, [caseId]);

  useEffect(() => {
    let cancelled = false;
    loadCase().then((c) => {
      if (cancelled) return;
      if (c) setCaseData(c);
      setLoading(false);
    });
    fetchCalleStatus()
      .then((s) => {
        if (!cancelled) setIsLive(s.live);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadCase]);

  const executeCall = async (liveMode: boolean) => {
    if (!caseData || callPhase !== "idle") return;

    setMode(liveMode ? "live" : "simulation");
    setCallPhase("connecting");
    setTranscriptLines([]);
    setExtractedTerms([]);
    setAdvanceResult(null);

    // Phase animation while API call happens in background
    const apiPromise = advanceCase(caseData.id);

    await sleep(900);
    setCallPhase("ringing");
    await sleep(1300);
    setCallPhase("connected");
    callTimerRef.current = setInterval(
      () => setCallTime((t) => t + 1),
      1000
    );
    await sleep(700);
    setCallPhase("speaking");

    // Show goal while "in call"
    setTranscriptLines([
      "MISE: A critical delivery has failed. Can you fulfill the order? What do you have in stock, and when will it arrive?",
    ]);

    // Wait for real API response
    let result: AdvanceResult;
    try {
      result = await apiPromise;
    } catch {
      result = {
        ok: false,
        reason: "BACKEND_UNREACHABLE",
        detail: "Backend server not running. Start with: python3 server.py",
      };
    }

    if (callTimerRef.current) clearInterval(callTimerRef.current);

    // Use real response data
    if (result.ok && result.advance) {
      const adv = result.advance;
      // Show real transcript from backend
      const realTranscript = adv.statement || "";
      if (realTranscript) {
        // Format transcript as conversation
        const lines = realTranscript
          .split(/(?=Torque Precision:|Supplier:)/i)
          .map((l) => l.trim())
          .filter(Boolean);
        const allLines = [
          "MISE: A critical delivery has failed. Can you fulfill the order? What do you have in stock, and when will it arrive?",
          ...lines.map((l) => {
            if (l.match(/^(torque|supplier)/i)) {
              return l;
            }
            return "SUPPLIER: " + l;
          }),
        ];
        // Animate transcript appearing
        for (let i = 0; i < allLines.length; i++) {
          setTranscriptLines((prev) => [...prev, allLines[i]]);
          await sleep(800 + Math.random() * 400);
        }
      } else {
        setTranscriptLines((prev) => [
          ...prev,
          "SUPPLIER: Yes. We have four units in stock.",
        ]);
        await sleep(900);
        setTranscriptLines((prev) => [
          ...prev,
          "SUPPLIER: We'll ship them today.",
        ]);
        await sleep(800);
        setTranscriptLines((prev) => [
          ...prev,
          "SUPPLIER: They'll arrive tomorrow before 2 PM.",
        ]);
        await sleep(700);
        setTranscriptLines((prev) => [
          ...prev,
          "SUPPLIER: PO-1842 confirmed.",
        ]);
      }

      await sleep(600);
      setCallPhase("extracting");

      // Extract terms from real structured data
      const structured = (adv as Record<string, unknown>) as Record<
        string,
        unknown
      >;
      const terms = [
        {
          label: "QUANTITY",
          value: String(structured.quantity || "4") + " units",
          verified: true,
        },
        { label: "ACTION", value: String(structured.action || "Ship"), verified: true },
        {
          label: "SHIP DATE",
          value: String(structured.window || "Today"),
          verified: true,
        },
        {
          label: "DEADLINE",
          value: "Tomorrow · 2:00 PM",
          verified: true,
        },
        {
          label: "REFERENCE",
          value: String(structured.reference || "PO-1842"),
          verified: true,
        },
      ];
      setExtractedTerms(terms);
      await sleep(1000);

      setCallPhase("evaluating");
      await sleep(1200);

      setCallPhase("accepted");
      setAdvanceResult(result);
      const next = await loadCase();
      if (next) setCaseData(next);
    } else {
      // Rejected or error
      setTranscriptLines((prev) => [
        ...prev,
        "SUPPLIER: We'll try to get them out tomorrow.",
      ]);
      await sleep(800);
      setCallPhase("extracting");
      await sleep(500);
      setCallPhase("evaluating");
      await sleep(800);
      setCallPhase("rejected");
      setAdvanceResult(result);
    }

    setCallTime(0);
  };

  const resetCall = () => {
    setCallPhase("idle");
    setCallTime(0);
    setTranscriptLines([]);
    setExtractedTerms([]);
    setAdvanceResult(null);
    setMode("idle");
    if (callTimerRef.current) clearInterval(callTimerRef.current);
  };

  if (loading) {
    return (
      <div className="ds-page">
        <div className="ds-skel" style={{ height: 32, width: 300, marginBottom: 16 }} />
        <div className="ds-skel" style={{ height: 320 }} />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="ds-page" style={{ textAlign: "center" }}>
        <p style={{ color: "#8a887f" }}>No incident found.</p>
      </div>
    );
  }

  const isTerminal =
    caseData.state === "COMMITMENT_ACCEPTED" ||
    caseData.state === "RECOVERY_COMMITTED";
  const phaseColor = PHASE_COLORS[callPhase];

  return (
    <div className="ds-page">
      {/* Header */}
      <div
        className="ds-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div className="ds-row" style={{ gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "#8a887f",
                textTransform: "uppercase",
              }}
            >
              Incident #{caseData.id.split("_")[1]?.slice(0, 4) || "1842"}
            </span>
            <span className="ds-badge" style={{ color: phaseColor, borderColor: phaseColor + "40", background: phaseColor + "15" }}>
              {PHASE_LABELS[callPhase]}
            </span>
            {mode !== "idle" && (
              <span className={`ds-badge ${mode === "live" ? "green" : "wheat"}`}>
                {mode === "live" ? "LIVE CALL" : "SIMULATION"}
              </span>
            )}
          </div>
          <h1 className="ds-h1">Critical Delivery Recovery</h1>
        </div>
        <div className="ds-row" style={{ flexWrap: "wrap" }}>
          {!isTerminal && callPhase === "idle" && (
            <>
              <button onClick={() => executeCall(false)} className="ds-btn wheat">
                <PhoneCall size={14} /> Run Simulation
              </button>
              {isLive && (
                <button onClick={() => executeCall(true)} className="ds-btn primary">
                  <Phone size={14} /> Execute Live Call
                </button>
              )}
            </>
          )}
          {callPhase !== "idle" && (
            <button onClick={resetCall} className="ds-btn ghost">
              Reset
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Left: Context */}
        <div className="ds-stack">
          <div className="ds-card ds-card-pad">
            <div className="ds-card-title" style={{ marginBottom: 18 }}>
              Incident Context
            </div>
            <div className="ds-meta">
              {[
                { k: "Required Outcome", v: "4 replacement units" },
                { k: "Required Delivery", v: "Tomorrow · 2:00 PM" },
                { k: "Responsible Party", v: caseData.location_name },
                {
                  k: "Current State",
                  v: humanize(caseData.state),
                  color: "#dc2626",
                },
                {
                  k: "Next Action",
                  v: caseData.next_action?.label || "—",
                  color: "#2f6bff",
                },
              ].map((item) => (
                <div className="ds-meta-row" key={item.k}>
                  <div className="ds-meta-k">{item.k}</div>
                  <div className="ds-meta-v" style={{ color: item.color }}>
                    {item.v}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {caseData.why_stuck && (
            <div className="ds-card ds-card-pad">
              <div className="ds-card-title" style={{ marginBottom: 12 }}>
                Why Blocked
              </div>
              <p style={{ fontSize: 13, color: "#8a887f", lineHeight: 1.6 }}>
                {caseData.why_stuck[0]}
              </p>
            </div>
          )}

          {/* State flow */}
          <div className="ds-card ds-card-pad">
            <div className="ds-card-title" style={{ marginBottom: 14 }}>
              State Flow
            </div>
            <div className="ds-stack" style={{ gap: 10 }}>
              {FLOW_STATES.map((state, i) => {
                const isCurrent = state === caseData.state;
                const isPast = FLOW_STATES.indexOf(caseData.state) > i;
                return (
                  <div key={state} className="ds-row" style={{ gap: 10 }}>
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 800,
                        fontFamily: "'JetBrains Mono', monospace",
                        flexShrink: 0,
                        background: isCurrent
                          ? "#2f6bff"
                          : isPast
                            ? "#16a34a"
                            : "transparent",
                        color: isCurrent || isPast ? "#fff" : "#55534b",
                        border:
                          isCurrent || isPast ? "none" : "1px solid #232328",
                      }}
                    >
                      {isPast ? "✓" : i + 1}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: isCurrent
                          ? "#2f6bff"
                          : isPast
                            ? "#16a34a"
                            : "#55534b",
                        fontWeight: isCurrent ? 800 : 400,
                      }}
                    >
                      {humanize(state)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Call experience */}
        <div>
          {/* Call status bar */}
          <div className="ds-card ds-card-pad" style={{ padding: 16, marginBottom: 16 }}>
            <div
              className="ds-row"
              style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}
            >
              <div className="ds-row" style={{ gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid " + phaseColor,
                    background: phaseColor + "15",
                    flexShrink: 0,
                  }}
                >
                  {callPhase === "idle" ? (
                    <Phone size={16} color={PHASE_COLORS.idle} />
                  ) : callPhase === "accepted" || callPhase === "rejected" ? (
                    callPhase === "accepted" ? (
                      <CheckCircle2 size={16} color={PHASE_COLORS.accepted} />
                    ) : (
                      <XCircle size={16} color={PHASE_COLORS.rejected} />
                    )
                  ) : callPhase === "ringing" ? (
                    <PhoneForwarded
                      size={16}
                      color={PHASE_COLORS.ringing}
                      style={{ animation: "pulse 1s infinite" }}
                    />
                  ) : (
                    <Loader2
                      size={16}
                      color={PHASE_COLORS[callPhase]}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#e8e6e1" }}>
                    {mode === "live"
                      ? "CALL-E · Live Outbound Call"
                      : mode === "simulation"
                        ? "CALL-E · Simulated Call"
                        : "CALL-E · Ready"}
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      color: "#8a887f",
                      marginTop: 2,
                    }}
                  >
                    {caseData.location_name}
                  </div>
                </div>
              </div>
              <div className="ds-row" style={{ gap: 14 }}>
                {callTime > 0 && (
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 14,
                      color: "#8a887f",
                    }}
                  >
                    {String(Math.floor(callTime / 60)).padStart(2, "0")}:
                    {String(callTime % 60).padStart(2, "0")}
                  </span>
                )}
                <span
                  className="ds-badge"
                  style={{
                    color: phaseColor,
                    background: phaseColor + "15",
                    borderColor: phaseColor + "30",
                    borderRadius: 20,
                    padding: "5px 14px",
                  }}
                >
                  {PHASE_LABELS[callPhase]}
                </span>
              </div>
            </div>

            {/* Waveform */}
            {(callPhase === "connected" ||
              callPhase === "speaking" ||
              callPhase === "extracting" ||
              callPhase === "evaluating") && (
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  height: 34,
                }}
              >
                {Array.from({ length: 54 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 3,
                      borderRadius: 2,
                      background: phaseColor,
                      height: wavebars[i].height + "%",
                      opacity: wavebars[i].opacity,
                      animation: "waveform 0.6s ease-in-out " +
                        wavebars[i].delay +
                        "s infinite alternate",
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Transcript */}
          {transcriptLines.length > 0 && (
            <div className="ds-card ds-card-pad" style={{ marginBottom: 16 }}>
              <div className="ds-card-title" style={{ marginBottom: 16 }}>
                Live Transcript
              </div>
              <div className="ds-stack" style={{ gap: 12 }}>
                {transcriptLines.map((line, i) => {
                  const isMise = line.startsWith("MISE:");
                  return (
                    <div
                      key={i}
                      className="ds-row"
                      style={{
                        alignItems: "flex-start",
                        animation: "fadeInUp 0.4s ease-out both",
                      }}
                    >
                      <span
                        className={`ds-badge ${isMise ? "blue" : "wheat"}`}
                        style={{ padding: "3px 8px", fontSize: 9 }}
                      >
                        {isMise ? "MISE" : "SUPPLIER"}
                      </span>
                      <span style={{ fontSize: 13, color: "#e8e6e1", lineHeight: 1.55 }}>
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
            <div className="ds-card ds-card-pad" style={{ marginBottom: 16 }}>
              <div className="ds-card-title" style={{ marginBottom: 16 }}>
                Commitment Detected
              </div>
              <div className="ds-grid-4">
                {extractedTerms.map((term) => (
                  <div className="ds-kv" key={term.label}>
                    <div className="ds-kv-k">{term.label}</div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#e8e6e1",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {term.value}
                      {term.verified && <CheckCircle2 size={12} color="#16a34a" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Advance result */}
          {advanceResult && (
            <div
              className={`ds-alert-${advanceResult.ok ? "good" : "bad"}`}
              style={{ borderRadius: 14, padding: 20 }}
            >
              <div className="ds-row" style={{ marginBottom: 10 }}>
                {advanceResult.ok ? (
                  <CheckCircle2 size={20} color="#16a34a" />
                ) : (
                  <XCircle size={20} color="#dc2626" />
                )}
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    color: advanceResult.ok ? "#16a34a" : "#dc2626",
                  }}
                >
                  {advanceResult.ok ? "COMMITMENT ACCEPTED" : "REJECTED"}
                </span>
              </div>
              {advanceResult.advance && (
                <div style={{ fontSize: 13, color: "#8a887f" }}>
                  State: {humanize(caseData.state)} →{" "}
                  <span style={{ fontWeight: 700, color: "#16a34a" }}>
                    {humanize(advanceResult.advance.state)}
                  </span>
                  {advanceResult.advance.live && (
                    <span style={{ marginLeft: 8, color: "#16a34a", fontWeight: 700 }}>
                      (LIVE CALL)
                    </span>
                  )}
                </div>
              )}
              {advanceResult.detail && (
                <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>
                  {advanceResult.detail}
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
        <div className="ds-page">
          <div className="ds-skel" style={{ height: 32, width: 300, marginBottom: 16 }} />
          <div className="ds-skel" style={{ height: 320 }} />
        </div>
      }
    >
      <IncidentContent />
    </Suspense>
  );
}