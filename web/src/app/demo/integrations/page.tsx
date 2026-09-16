"use client";

import { useEffect, useState } from "react";
import { CalleStatus } from "@/lib/types";
import { fetchCalleStatus } from "@/lib/api";
import { Phone, CheckCircle2, XCircle, ArrowRight, Globe, Key, Smartphone } from "lucide-react";

export default function IntegrationsPage() {
  const [calle, setCalle] = useState<CalleStatus | null>(null);

  useEffect(() => {
    fetchCalleStatus()
      .then(setCalle)
      .catch(() => {});
  }, []);

  const statusOn = calle?.live;

  return (
    <div className="ds-page-narrow">
      <div className="ds-header">
        <div className="ds-kicker">
          <Globe size={13} />
          Integrations
        </div>
        <h1 className="ds-h1">Connected Systems</h1>
        <p className="ds-sub">External services powering MISE operations.</p>
      </div>

      <div className="ds-card" style={{ padding: 26 }}>
        <div
          className="ds-row"
          style={{ justifyContent: "space-between", marginBottom: 26, flexWrap: "wrap", gap: 16 }}
        >
          <div className="ds-row" style={{ gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(47,107,255,0.1)",
                border: "1px solid rgba(47,107,255,0.25)",
                flexShrink: 0,
              }}
            >
              <Phone size={20} color="#2f6bff" />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#e8e6e1" }}>CALL-E</h2>
              <p style={{ fontSize: 13, color: "#8a887f", marginTop: 2 }}>
                Phone call infrastructure
              </p>
            </div>
          </div>
          <span className={`ds-badge ${statusOn ? "green" : "red"}`} style={{ borderRadius: 20, padding: "6px 14px" }}>
            {statusOn ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {statusOn ? "CONNECTED" : "DISCONNECTED"}
          </span>
        </div>

        <div className="ds-grid-4" style={{ marginBottom: 26 }}>
          {[
            { icon: Phone, label: "Outbound Calls" },
            { icon: ArrowRight, label: "Structured Results" },
            { icon: Globe, label: "Transcripts" },
            { icon: Key, label: "Evidence" },
          ].map((cap) => {
            const Icon = cap.icon;
            return (
              <div className="ds-kv" key={cap.label}>
                <Icon size={16} color="#2f6bff" style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: "#e8e6e1" }}>
                  {cap.label}
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: "#16a34a",
                    marginTop: 4,
                    letterSpacing: "0.08em",
                  }}
                >
                  AVAILABLE
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ borderTop: "1px solid #1b1b20", paddingTop: 20 }}>
          <div className="ds-card-title" style={{ marginBottom: 14 }}>
            Connection Details
          </div>
          <div className="ds-grid-4">
            {[
              { icon: Globe, label: "API Endpoint", value: statusOn ? "api.call-e.com" : "Not configured" },
              { icon: Key, label: "API Key", value: statusOn ? "••••••••••••••••" : "Not configured" },
              { icon: Smartphone, label: "Phone Number", value: statusOn ? "Configured" : "Not configured" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div className="ds-kv" key={item.label}>
                  <div className="ds-row" style={{ gap: 8, marginBottom: 8 }}>
                    <Icon size={12} color="#55534b" />
                    <span className="ds-kv-k" style={{ marginBottom: 0 }}>
                      {item.label}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 12,
                      color: statusOn ? "#e8e6e1" : "#55534b",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ds-alert-wheat" style={{ marginTop: 24, borderRadius: 10, padding: 16 }}>
          <p style={{ fontSize: 12, lineHeight: 1.6, color: "#c6a96b" }}>
            <strong>Security:</strong> API keys are stored server-side and never
            exposed to the browser. All CALL-E requests are proxied through the
            backend.
          </p>
        </div>
      </div>
    </div>
  );
}