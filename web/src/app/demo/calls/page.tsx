"use client";

import { useEffect, useState } from "react";
import { Case } from "@/lib/types";
import { fetchCases } from "@/lib/api";
import { formatTime, humanize } from "@/lib/utils";
import { Phone, CheckCircle2, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function CallsPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCases()
      .then(setCases)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const allSteps = cases.flatMap((c) =>
    (c.steps || []).map((s) => ({ ...s, caseName: c.location_name, caseId: c.id }))
  );

  const cols = "80px 1fr 1fr 100px 80px 100px 40px";

  return (
    <div style={{ padding: 32, maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.25em", color: "#7c7a72", textTransform: "uppercase", marginBottom: 8 }}>
          Calls
        </div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600, color: "#e8e6e1" }}>
          CALL-E Interactions
        </h1>
        <p style={{ fontSize: 14, color: "#7c7a72", marginTop: 4 }}>
          Every outbound call made by MISE through CALL-E.
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 56, background: "#111114", border: "1px solid #232328", borderRadius: 14 }} />
          ))}
        </div>
      ) : allSteps.length === 0 ? (
        <div style={{ border: "1px solid #232328", borderRadius: 14, background: "#111114", padding: 48, textAlign: "center" }}>
          <Phone size={32} color="#4a4940" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, color: "#7c7a72" }}>No calls yet.</p>
          <p style={{ fontSize: 12, color: "#4a4940", marginTop: 4 }}>
            Run the demo to place a call.
          </p>
        </div>
      ) : (
        <div style={{ border: "1px solid #232328", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 16, padding: "12px 20px", background: "#111114", borderBottom: "1px solid #232328" }}>
            {["Call", "Incident", "Recipient", "Status", "Confidence", "Decision", ""].map((h) => (
              <div key={h} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: "#4a4940", textTransform: "uppercase" }}>
                {h}
              </div>
            ))}
          </div>

          {allSteps.map((step) => (
            <div
              key={step.id}
              style={{ display: "grid", gridTemplateColumns: cols, gap: 16, padding: "14px 20px", borderBottom: "1px solid #232328", transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#161619")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#e8e6e1" }}>
                {step.call_id.slice(0, 12)}
              </div>
              <div style={{ fontSize: 12, color: "#7c7a72" }}>
                {step.caseName}
              </div>
              <div style={{ fontSize: 12, color: "#e8e6e1", fontWeight: 500 }}>
                {step.who || "—"}
              </div>
              <div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 6, background: "rgba(22,163,74,0.1)", color: "#16a34a", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800 }}>
                  <CheckCircle2 size={10} />
                  COMPLETED
                </span>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#e8e6e1" }}>
                {Math.round(step.confidence * 100)}%
              </div>
              <div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 6, background: "rgba(22,163,74,0.1)", color: "#16a34a", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800 }}>
                  ACCEPTED
                </span>
              </div>
              <div>
                <Link href={`/demo/incident?id=${step.caseId}`} style={{ color: "#2f6bff", textDecoration: "none" }}>
                  <ExternalLink size={16} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
