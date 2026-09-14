"use client";

import { useEffect, useState } from "react";
import { Case } from "@/lib/types";
import { fetchCases } from "@/lib/api";
import { formatTime, humanize } from "@/lib/utils";
import { Shield, FileText, Lock, Hash, ArrowRight } from "lucide-react";

export default function EvidencePage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCases()
      .then(setCases)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const allSteps = cases.flatMap((c) =>
    (c.steps || []).map((s) => ({ ...s, caseName: c.location_name }))
  );

  return (
    <div style={{ padding: 32, maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.25em", color: "#7c7a72", textTransform: "uppercase", marginBottom: 8 }}>
          Evidence
        </div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600, color: "#e8e6e1" }}>
          Proof Behind Every Transition
        </h1>
        <p style={{ fontSize: 14, color: "#7c7a72", marginTop: 4 }}>
          Every state change is backed by verifiable call evidence. Append-only, hash-linked.
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 160, background: "#111114", border: "1px solid #232328", borderRadius: 14 }} />
          ))}
        </div>
      ) : allSteps.length === 0 ? (
        <div style={{ border: "1px solid #232328", borderRadius: 14, background: "#111114", padding: 48, textAlign: "center" }}>
          <FileText size={32} color="#4a4940" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, color: "#7c7a72" }}>No evidence records yet.</p>
          <p style={{ fontSize: 12, color: "#4a4940", marginTop: 4 }}>
            Run the demo to generate call evidence.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {allSteps.map((step, i) => (
            <div
              key={step.id}
              style={{ border: "1px solid #232328", borderRadius: 14, background: "#111114", padding: 24 }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.15em", color: "#7c7a72", textTransform: "uppercase" }}>
                      Evidence #{i + 1}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 6, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: "#16a34a", background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.2)" }}>
                      <Lock size={10} />
                      SEALED
                    </span>
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#e8e6e1" }}>
                    {humanize(step.to_state)}
                  </h3>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#4a4940" }}>
                    {formatTime(step.at)}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#4a4940", marginTop: 4 }}>
                    {step.caseName}
                  </div>
                </div>
              </div>

              <div style={{ borderLeft: "3px solid #16a34a", background: "rgba(13,58,31,0.2)", borderRadius: "0 8px 8px 0", padding: 16, marginBottom: 16 }}>
                <p style={{ fontFamily: "'Fraunces', serif", fontSize: 14, fontStyle: "italic", color: "#e8e6e1", lineHeight: 1.5 }}>
                  &ldquo;{step.statement}&rdquo;
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                {Object.entries(step.structured).map(([key, val]) => {
                  if (key === "confidence") return null;
                  return (
                    <div key={key} style={{ border: "1px solid #232328", borderRadius: 10, padding: 12, background: "#161619" }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: "#4a4940", textTransform: "uppercase", marginBottom: 4 }}>
                        {humanize(key)}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#e8e6e1" }}>
                        {typeof val === "object" ? JSON.stringify(val) : String(val)}
                      </div>
                    </div>
                  );
                })}
                <div style={{ border: "1px solid #232328", borderRadius: 10, padding: 12, background: "#161619" }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: "#4a4940", textTransform: "uppercase", marginBottom: 4 }}>
                    Confidence
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>
                    {Math.round(step.confidence * 100)}%
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#4a4940" }}>
                <Hash size={12} />
                <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  PREV: {step.previous_hash.slice(0, 16)}…
                </span>
                <ArrowRight size={12} />
                <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#16a34a" }}>
                  STEP: {step.step_hash.slice(0, 16)}…
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
