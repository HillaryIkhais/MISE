"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Case, Stats } from "@/lib/types";
import { fetchCases, fetchStats } from "@/lib/api";
import { humanize } from "@/lib/utils";

export default function OverviewPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchCases(), fetchStats()])
      .then(([c, s]) => { setCases(c); setStats(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const primary = cases[0];

  return (
    <div style={{ padding: 32, maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.25em", color: "#7c7a72", textTransform: "uppercase", marginBottom: 8 }}>
          Operations
        </div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600, color: "#e8e6e1" }}>
          Active Incidents
        </h1>
        <p style={{ fontSize: 14, color: "#7c7a72", marginTop: 4 }}>
          Incidents requiring verified real-world action.
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 120, background: "#111114", border: "1px solid #232328", borderRadius: 14 }} />
          ))}
        </div>
      ) : (
        <>
          {primary && (
            <Link href={"/demo/incident?id=" + primary.id} style={{ textDecoration: "none" }}>
              <div style={{ border: "1px solid #232328", borderRadius: 18, background: "#111114", padding: 24, marginBottom: 24, cursor: "pointer", transition: "border-color 0.3s" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(47,107,255,0.3)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#232328")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.15em", color: "#7c7a72", textTransform: "uppercase" }}>
                    Incident #{primary.id.split("_")[1]?.slice(0, 4) || "1842"}
                  </span>
                  <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: "#dc2626", background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)" }}>
                    BLOCKED
                  </span>
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#e8e6e1", marginBottom: 12 }}>
                  Critical Delivery Recovery
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
                  {[
                    { k: "Required", v: "4 Units" },
                    { k: "Supplier", v: primary.location_name },
                    { k: "Deadline", v: "Tomorrow · 2:00 PM" },
                    { k: "Next Action", v: primary.next_action?.label || "—", color: "#2f6bff" },
                  ].map((item) => (
                    <div key={item.k}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.12em", color: "#4a4940", textTransform: "uppercase", marginBottom: 3 }}>
                        {item.k}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: item.color || "#e8e6e1" }}>
                        {item.v}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.06em" }}>
                  {["DELIVERY_FAILED", "SUPPLIER_CONTACT_REQUIRED", "COMMITMENT_ACCEPTED", "RECOVERY_COMMITTED"].map(
                    (s, i) => {
                      const isCurrent = s === primary.state;
                      const isPast = ["DELIVERY_FAILED", "SUPPLIER_CONTACT_REQUIRED", "COMMITMENT_ACCEPTED", "RECOVERY_COMMITTED"].indexOf(primary.state) > i;
                      return (
                        <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {i > 0 && <span style={{ color: "#4a4940" }}>→</span>}
                          <span style={{
                            padding: "4px 8px", borderRadius: 4, border: "1px solid " + (isCurrent ? "rgba(47,107,255,0.4)" : isPast ? "rgba(22,163,74,0.3)" : "#232328"),
                            background: isCurrent ? "rgba(47,107,255,0.1)" : isPast ? "rgba(22,163,74,0.1)" : "transparent",
                            color: isCurrent ? "#2f6bff" : isPast ? "#16a34a" : "#4a4940",
                            fontWeight: isCurrent ? 800 : 400,
                          }}>
                            {humanize(s)}
                          </span>
                        </span>
                      );
                    }
                  )}
                </div>
              </div>
            </Link>
          )}

          {stats && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, border: "1px solid #232328", borderRadius: 14, overflow: "hidden", marginBottom: 32 }}>
              {[
                { label: "Live Cases", value: stats.cases, color: "#2f6bff" },
                { label: "Transitions", value: stats.transitions, color: "#c6a96b" },
                { label: "Avg Confidence", value: Math.round(stats.avg_confidence * 100) + "%", color: "#16a34a" },
                { label: "Tests Passing", value: stats.tests, color: "#e8e6e1" },
              ].map((stat) => (
                <div key={stat.label} style={{ background: "#111114", padding: 24 }}>
                  <div style={{ fontSize: 32, fontFamily: "'Fraunces', serif", fontWeight: 900, color: stat.color }}>
                    {stat.value}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.15em", color: "#4a4940", textTransform: "uppercase", marginTop: 4 }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ border: "1px solid #232328", borderRadius: 14, background: "#111114", padding: 24 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", color: "#7c7a72", textTransform: "uppercase", marginBottom: 14 }}>
              Quick Actions
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <Link href={"/demo/incident?id=" + (primary?.id || "")}>
                <button style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer", background: "#2f6bff", color: "#fff", fontSize: 13, fontWeight: 700 }}>
                  Open Incident Detail →
                </button>
              </Link>
              <Link href="/demo/security-lab">
                <button style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #232328", background: "transparent", color: "#e8e6e1", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Security Lab
                </button>
              </Link>
              <Link href="/demo/evidence">
                <button style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #232328", background: "transparent", color: "#7c7a72", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  View Evidence
                </button>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
