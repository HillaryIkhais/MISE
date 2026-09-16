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
    <div className="ds-page">
      <div className="ds-header">
        <div className="ds-kicker">
          <Shield size={13} />
          Evidence
        </div>
        <h1 className="ds-h1">Proof Behind Every Transition</h1>
        <p className="ds-sub">
          Every state change is backed by verifiable call evidence. Append-only,
          hash-linked.
        </p>
      </div>

      {loading ? (
        <div className="ds-stack">
          {[1, 2, 3].map((i) => (
            <div key={i} className="ds-skel" style={{ height: 200 }} />
          ))}
        </div>
      ) : allSteps.length === 0 ? (
        <div className="ds-empty">
          <div className="ds-empty-icon">
            <FileText size={28} color="#55534b" />
          </div>
          <p className="ds-empty-title">No evidence records yet.</p>
          <p className="ds-empty-sub">Run the demo to generate call evidence.</p>
        </div>
      ) : (
        <div className="ds-stack">
          {allSteps.map((step, i) => (
            <div className="ds-card ds-card-pad" key={step.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div>
                  <div className="ds-row" style={{ gap: 10, marginBottom: 8 }}>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        letterSpacing: "0.15em",
                        color: "#8a887f",
                        textTransform: "uppercase",
                      }}
                    >
                      Evidence #{i + 1}
                    </span>
                    <span className="ds-badge green">
                      <Lock size={10} />
                      SEALED
                    </span>
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#e8e6e1" }}>
                    {humanize(step.to_state)}
                  </h3>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      color: "#55534b",
                    }}
                  >
                    {formatTime(step.at)}
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      color: "#55534b",
                      marginTop: 4,
                    }}
                  >
                    {step.caseName}
                  </div>
                </div>
              </div>

              <div className="ds-quote" style={{ marginBottom: 16 }}>
                <p
                  style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: 14,
                    fontStyle: "italic",
                    color: "#e8e6e1",
                    lineHeight: 1.5,
                  }}
                >
                  &ldquo;{step.statement}&rdquo;
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                {Object.entries(step.structured).map(([key, val]) => {
                  if (key === "confidence") return null;
                  return (
                    <div className="ds-kv" key={key}>
                      <div className="ds-kv-k">{humanize(key)}</div>
                      <div className="ds-kv-v">
                        {typeof val === "object" ? JSON.stringify(val) : String(val)}
                      </div>
                    </div>
                  );
                })}
                <div className="ds-kv">
                  <div className="ds-kv-k">Confidence</div>
                  <div
                    className="ds-kv-v"
                    style={{ color: "#16a34a" }}
                  >
                    {Math.round(step.confidence * 100)}%
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#55534b",
                  flexWrap: "wrap",
                }}
              >
                <Hash size={12} />
                <span
                  style={{
                    maxWidth: 160,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  PREV: {step.previous_hash.slice(0, 16)}…
                </span>
                <ArrowRight size={12} />
                <span
                  style={{
                    maxWidth: 160,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "#16a34a",
                  }}
                >
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