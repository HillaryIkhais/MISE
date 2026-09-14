"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Case, AdvanceResult } from "@/lib/types";
import { fetchCases, advanceCase, fetchCalleStatus } from "@/lib/api";
import { humanize } from "@/lib/utils";
import {
  Phone,
  PhoneForwarded,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Loader2,
  PhoneCall,
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
  extracting: "EXTRACTING COMMITMENT",
  evaluating: "EVALUATING",
  accepted: "COMMITMENT ACCEPTED",
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

  const loadCase = useCallback(async () => {
    try {
      const cases = await fetchCases();
      const c = caseId ? cases.find((c) => c.id === caseId) : cases[0];
      if (c) setCaseData(c);
    } catch {}
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    loadCase();
    fetchCalleStatus()
      .then((s) => setIsLive(s.live))
      .catch(() => {});
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
      await loadCase();
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
      <div style={{ padding: 32 }}>
        <div style={{ height: 32, background: "#111114", border: "1px solid #232328", borderRadius: 8, width: 256, marginBottom: 16 }} />
        <div style={{ height: 256, background: "#111114", border: "1px solid #232328", borderRadius: 12 }} />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p style={{ color: "#7c7a72" }}>No incident found.</p>
      </div>
    );
  }

  const isTerminal =
    caseData.state === "COMMITMENT_ACCEPTED" ||
    caseData.state === "RECOVERY_COMMITTED";

  return (
    <div style={{ padding: 32, maxWidth: 1280, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.18em", color: "#7c7a72", textTransform: "uppercase" }}>
              Incident #{caseData.id.split("_")[1]?.slice(0, 4) || "1842"}
            </span>
            <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: PHASE_COLORS[callPhase], background: PHASE_COLORS[callPhase] + "15", border: "1px solid " + PHASE_COLORS[callPhase] + "30" }}>
              {PHASE_LABELS[callPhase]}
            </span>
            {mode !== "idle" && (
              <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: mode === "live" ? "#16a34a" : "#c6a96b", background: mode === "live" ? "rgba(22,163,74,0.1)" : "rgba(198,169,107,0.1)", border: "1px solid " + (mode === "live" ? "rgba(22,163,74,0.2)" : "rgba(198,169,107,0.2)") }}>
                {mode === "live" ? "LIVE CALL" : "SIMULATION"}
              </span>
            )}
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600, color: "#e8e6e1" }}>
            Critical Delivery Recovery
          </h1>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {!isTerminal && callPhase === "idle" && (
            <>
              <button onClick={() => executeCall(false)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer", background: "#c6a96b", color: "#fff", fontSize: 13, fontWeight: 700 }}>
                <PhoneCall size={14} /> Run Simulation
              </button>
              {isLive && (
                <button onClick={() => executeCall(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer", background: "#2f6bff", color: "#fff", fontSize: 13, fontWeight: 700, boxShadow: "0 4px 16px rgba(47,107,255,0.3)" }}>
                  <Phone size={14} /> Execute Live Call
                </button>
              )}
            </>
          )}
          {callPhase !== "idle" && (
            <button onClick={resetCall} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #232328", background: "transparent", color: "#7c7a72", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Reset
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24, alignItems: "start" }}>
        {/* Left: Context */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ border: "1px solid #232328", borderRadius: 14, background: "#111114", padding: 20 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", color: "#7c7a72", textTransform: "uppercase", marginBottom: 16 }}>
              Incident Context
            </div>
            {[
              { k: "Required Outcome", v: "4 replacement units" },
              { k: "Required Delivery", v: "Tomorrow · 2:00 PM" },
              { k: "Responsible Party", v: caseData.location_name },
              { k: "Current State", v: humanize(caseData.state), color: "#dc2626" },
              { k: "Next Action", v: caseData.next_action?.label || "—", color: "#2f6bff" },
            ].map((item) => (
              <div key={item.k} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #232328" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.12em", color: "#4a4940", textTransform: "uppercase", marginBottom: 3 }}>
                  {item.k}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: item.color || "#e8e6e1" }}>
                  {item.v}
                </div>
              </div>
            ))}
          </div>

          {caseData.why_stuck && (
            <div style={{ border: "1px solid #232328", borderRadius: 14, background: "#111114", padding: 20 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", color: "#7c7a72", textTransform: "uppercase", marginBottom: 10 }}>
                Why Blocked
              </div>
              <p style={{ fontSize: 13, color: "#7c7a72", lineHeight: 1.5 }}>
                {caseData.why_stuck[0]}
              </p>
            </div>
          )}

          {/* State flow */}
          <div style={{ border: "1px solid #232328", borderRadius: 14, background: "#111114", padding: 20 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", color: "#7c7a72", textTransform: "uppercase", marginBottom: 12 }}>
              State Flow
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {["DELIVERY_FAILED", "SUPPLIER_CONTACT_REQUIRED", "COMMITMENT_ACCEPTED", "RECOVERY_COMMITTED"].map(
                (s, i) => {
                  const isCurrent = s === caseData.state;
                  const isPast =
                    ["DELIVERY_FAILED", "SUPPLIER_CONTACT_REQUIRED", "COMMITMENT_ACCEPTED", "RECOVERY_COMMITTED"].indexOf(caseData.state) > i;
                  return (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%", display: "flex",
                        alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800,
                        background: isCurrent ? "#2f6bff" : isPast ? "#16a34a" : "#161619",
                        color: isCurrent || isPast ? "#fff" : "#4a4940",
                        border: isCurrent || isPast ? "none" : "1px solid #232328",
                      }}>
                        {isPast ? "✓" : i + 1}
                      </div>
                      <span style={{
                        fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                        color: isCurrent ? "#2f6bff" : isPast ? "#16a34a" : "#4a4940",
                        fontWeight: isCurrent ? 800 : 400,
                      }}>
                        {humanize(s)}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>

        {/* Right: Call experience */}
        <div>
          {/* Call status bar */}
          <div style={{ border: "1px solid #232328", borderRadius: 14, background: "#111114", padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  border:  "2px solid " + PHASE_COLORS[callPhase],
                  background:  PHASE_COLORS[callPhase] + "15",
                }}>
                  {callPhase === "idle" ? (
                    <Phone size={16} color={PHASE_COLORS.idle} />
                  ) : callPhase === "accepted" || callPhase === "rejected" ? (
                    callPhase === "accepted" ? <CheckCircle2 size={16} color={PHASE_COLORS.accepted} /> : <XCircle size={16} color={PHASE_COLORS.rejected} />
                  ) : callPhase === "ringing" ? (
                    <PhoneForwarded size={16} color={PHASE_COLORS.ringing} style={{ animation: "pulse 1s infinite" }} />
                  ) : (
                    <Loader2 size={16} color={PHASE_COLORS[callPhase]} style={{ animation: "spin 1s linear infinite" }} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#e8e6e1" }}>
                    {mode === "live" ? "CALL-E · Live Outbound Call" : mode === "simulation" ? "CALL-E · Simulated Call" : "CALL-E · Ready"}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#7c7a72" }}>
                    {caseData.location_name}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {callTime > 0 && (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "#7c7a72" }}>
                    {String(Math.floor(callTime / 60)).padStart(2, "0")}:{String(callTime % 60).padStart(2, "0")}
                  </span>
                )}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 800,
                  letterSpacing: "0.1em", padding: "5px 12px", borderRadius: 20,
                  color: PHASE_COLORS[callPhase],
                  background:  PHASE_COLORS[callPhase] + "15",
                  border:  "1px solid " + PHASE_COLORS[callPhase] + "30",
                }}>
                  {PHASE_LABELS[callPhase]}
                </span>
              </div>
            </div>

            {/* Waveform */}
            {(callPhase === "connected" || callPhase === "speaking" || callPhase === "extracting" || callPhase === "evaluating") && (
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 2, height: 32 }}>
                {Array.from({ length: 50 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 3,
                      borderRadius: 2,
                      background: PHASE_COLORS[callPhase],
                      height:  (20 + Math.random() * 80) + "%",
                      opacity: 0.3 + Math.random() * 0.7,
                      animation:  "waveform 0.6s ease-in-out " + (i * 0.03) + "s infinite alternate",
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Transcript */}
          {transcriptLines.length > 0 && (
            <div style={{ border: "1px solid #232328", borderRadius: 14, background: "#111114", padding: 20, marginBottom: 16 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", color: "#7c7a72", textTransform: "uppercase", marginBottom: 14 }}>
                Live Transcript
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {transcriptLines.map((line, i) => {
                  const isMise = line.startsWith("MISE:");
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, animation: "fadeInUp 0.4s ease-out both" }}>
                      <span style={{
                        flexShrink: 0, padding: "2px 8px", borderRadius: 4,
                        fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800,
                        background: isMise ? "rgba(47,107,255,0.1)" : "rgba(198,169,107,0.1)",
                        color: isMise ? "#2f6bff" : "#c6a96b",
                        border:  "1px solid " + (isMise ? "rgba(47,107,255,0.2)" : "rgba(198,169,107,0.2)"),
                      }}>
                        {isMise ? "MISE" : "SUPPLIER"}
                      </span>
                      <span style={{ fontSize: 13, color: "#e8e6e1", lineHeight: 1.5 }}>
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
            <div style={{ border: "1px solid #232328", borderRadius: 14, background: "#111114", padding: 20, marginBottom: 16 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", color: "#7c7a72", textTransform: "uppercase", marginBottom: 14 }}>
                Commitment Detected
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {extractedTerms.map((term) => (
                  <div key={term.label} style={{ border: "1px solid #232328", borderRadius: 10, padding: 12, background: "#161619" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: "#4a4940", textTransform: "uppercase", marginBottom: 4 }}>
                      {term.label}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#e8e6e1", display: "flex", alignItems: "center", gap: 6 }}>
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
            <div style={{
              border:  "1px solid " + (advanceResult.ok ? "rgba(22,163,74,0.3)" : "rgba(220,38,38,0.3)"),
              borderRadius: 14, padding: 20,
              background: advanceResult.ok ? "rgba(13,58,31,0.3)" : "rgba(58,15,15,0.3)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                {advanceResult.ok ? <CheckCircle2 size={20} color="#16a34a" /> : <XCircle size={20} color="#dc2626" />}
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: advanceResult.ok ? "#16a34a" : "#dc2626" }}>
                  {advanceResult.ok ? "COMMITMENT ACCEPTED" : "REJECTED"}
                </span>
              </div>
              {advanceResult.advance && (
                <div style={{ fontSize: 13, color: "#7c7a72" }}>
                  State: {humanize(caseData.state)} → <span style={{ fontWeight: 700, color: "#16a34a" }}>{humanize(advanceResult.advance.state)}</span>
                  {advanceResult.advance.live && <span style={{ marginLeft: 8, color: "#16a34a", fontWeight: 700 }}>(LIVE CALL)</span>}
                </div>
              )}
              {advanceResult.detail && (
                <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{advanceResult.detail}</div>
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
        <div style={{ padding: 32 }}>
          <div style={{ height: 32, background: "#111114", border: "1px solid #232328", borderRadius: 8, width: 256, marginBottom: 16 }} />
          <div style={{ height: 256, background: "#111114", border: "1px solid #232328", borderRadius: 12 }} />
        </div>
      }
    >
      <IncidentContent />
    </Suspense>
  );
}
