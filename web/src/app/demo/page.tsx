"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Case, Stats } from "@/lib/types";
import { fetchCases, fetchStats } from "@/lib/api";
import { humanize } from "@/lib/utils";

const FLOW = [
  "DELIVERY_FAILED",
  "SUPPLIER_CONTACT_REQUIRED",
  "COMMITMENT_ACCEPTED",
  "RECOVERY_COMMITTED",
];

function skeleton() {
  return (
    <div className="ds-stack" aria-hidden>
      {[1, 2, 3].map((i) => (
        <div key={i} className="ds-skel" style={{ height: 132 }} />
      ))}
    </div>
  );
}

export default function OverviewPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchCases(), fetchStats()])
      .then(([c, s]) => {
        setCases(c);
        setStats(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const primary = cases[0];

  return (
    <div className="ds-page">
      <div className="ds-header">
        <div className="ds-kicker">Operations</div>
        <h1 className="ds-h1">Active Incidents</h1>
        <p className="ds-sub">
          Incidents requiring verified real-world action.
        </p>
      </div>

      {loading ? (
        skeleton()
      ) : (
        <>
          {primary && (
            <Link
              href={"/demo/incident?id=" + primary.id}
              style={{ textDecoration: "none", display: "block" }}
            >
              <div
                className="ds-card ds-card-hover"
                style={{ padding: 24, marginBottom: 20 }}
              >
                <div className="ds-row" style={{ gap: 12, marginBottom: 14 }}>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      letterSpacing: "0.15em",
                      color: "#8a887f",
                      textTransform: "uppercase",
                    }}
                  >
                    Incident #{primary.id.split("_")[1]?.slice(0, 4) || "1842"}
                  </span>
                  <span className="ds-badge red">BLOCKED</span>
                </div>

                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#e8e6e1",
                    marginBottom: 18,
                  }}
                >
                  Critical Delivery Recovery
                </h2>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 16,
                    marginBottom: 20,
                  }}
                >
                  {[
                    { k: "Required", v: "4 Units" },
                    { k: "Supplier", v: primary.location_name },
                    { k: "Deadline", v: "Tomorrow · 2:00 PM" },
                    {
                      k: "Next Action",
                      v: primary.next_action?.label || "—",
                      color: "#2f6bff",
                    },
                  ].map((item) => (
                    <div key={item.k}>
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 9,
                          letterSpacing: "0.12em",
                          color: "#55534b",
                          textTransform: "uppercase",
                          marginBottom: 4,
                        }}
                      >
                        {item.k}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: item.color || "#e8e6e1",
                        }}
                      >
                        {item.v}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="ds-flow">
                  {FLOW.map((state, i) => {
                    const idx = FLOW.indexOf(primary.state);
                    const cls =
                      state === primary.state
                        ? "now"
                        : idx > i
                          ? "done"
                          : "";
                    return (
                      <span
                        key={state}
                        className="ds-row"
                        style={{ gap: 8, display: "inline-flex" }}
                      >
                        {i > 0 && <span className="ds-flow-chip arrow">→</span>}
                        <span className={`ds-flow-chip ${cls}`}>
                          {humanize(state)}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </Link>
          )}

          {stats && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 1,
                border: "1px solid #232328",
                borderRadius: 14,
                overflow: "hidden",
                background: "#232328",
                marginBottom: 32,
              }}
            >
              {[
                { label: "Live Cases", value: stats.cases, color: "#2f6bff" },
                { label: "Transitions", value: stats.transitions, color: "#c6a96b" },
                {
                  label: "Avg Confidence",
                  value: Math.round(stats.avg_confidence * 100) + "%",
                  color: "#16a34a",
                },
                { label: "Tests Passing", value: stats.tests, color: "#e8e6e1" },
              ].map((stat) => (
                <div key={stat.label} className="ds-stat">
                  <div
                    className="ds-stat-value"
                    style={{ color: stat.color }}
                  >
                    {stat.value}
                  </div>
                  <div className="ds-stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="ds-card ds-card-pad">
            <div className="ds-card-title" style={{ marginBottom: 16 }}>
              Quick Actions
            </div>
            <div className="ds-row" style={{ flexWrap: "wrap" }}>
              <Link href={"/demo/incident?id=" + (primary?.id || "")}>
                <button className="ds-btn primary">
                  Open Incident Detail →
                </button>
              </Link>
              <Link href="/demo/security-lab">
                <button className="ds-btn secondary">Security Lab</button>
              </Link>
              <Link href="/demo/evidence">
                <button className="ds-btn ghost">View Evidence</button>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}