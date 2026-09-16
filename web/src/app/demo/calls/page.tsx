"use client";

import { useEffect, useState } from "react";
import { Case } from "@/lib/types";
import { fetchCases } from "@/lib/api";
import { humanize } from "@/lib/utils";
import { Phone, CheckCircle2, ExternalLink } from "lucide-react";
import Link from "next/link";

const COLS = "80px 1fr 1fr 110px 70px 90px 32px";

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

  return (
    <div className="ds-page">
      <div className="ds-header">
        <div className="ds-kicker">
          <Phone size={13} />
          Calls
        </div>
        <h1 className="ds-h1">CALL-E Interactions</h1>
        <p className="ds-sub">Every outbound call made by MISE through CALL-E.</p>
      </div>

      {loading ? (
        <div className="ds-stack">
          {[1, 2, 3].map((i) => (
            <div key={i} className="ds-skel" style={{ height: 54 }} />
          ))}
        </div>
      ) : allSteps.length === 0 ? (
        <div className="ds-empty">
          <div className="ds-empty-icon">
            <Phone size={28} color="#55534b" />
          </div>
          <p className="ds-empty-title">No calls yet.</p>
          <p className="ds-empty-sub">Run the demo to place a call.</p>
        </div>
      ) : (
        <div className="ds-table">
          <div className="ds-table-head" style={{ gridTemplateColumns: COLS }}>
            {["Call", "Incident", "Recipient", "Status", "Confidence", "Decision", ""].map(
              (h) => (
                <span key={h}>{h}</span>
              )
            )}
          </div>

          {allSteps.map((step) => (
            <div
              key={step.id}
              className="ds-table-row"
              style={{ gridTemplateColumns: COLS }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  color: "#e8e6e1",
                }}
              >
                {step.call_id.slice(0, 12)}
              </span>
              <span style={{ fontSize: 13, color: "#8a887f" }}>
                {step.caseName}
              </span>
              <span style={{ fontSize: 13, color: "#e8e6e1", fontWeight: 500 }}>
                {step.who || "—"}
              </span>
              <span>
                <span className="ds-badge green">
                  <CheckCircle2 size={10} />
                  COMPLETED
                </span>
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  color: "#e8e6e1",
                }}
              >
                {Math.round(step.confidence * 100)}%
              </span>
              <span>
                <span className="ds-badge green">ACCEPTED</span>
              </span>
              <span>
                <Link
                  href={`/demo/incident?id=${step.caseId}`}
                  style={{ color: "#2f6bff", textDecoration: "none" }}
                  aria-label={`Open ${humanize(step.to_state)} incident`}
                >
                  <ExternalLink size={15} />
                </Link>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}