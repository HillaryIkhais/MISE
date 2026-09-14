"use client";

import { useEffect, useState } from "react";
import { CalleStatus } from "@/lib/types";
import { fetchCalleStatus } from "@/lib/api";
import { Phone, CheckCircle2, XCircle, ArrowRight, Globe, Key, Smartphone } from "lucide-react";

export default function IntegrationsPage() {
  const [calle, setCalle] = useState<CalleStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCalleStatus()
      .then(setCalle)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 32, maxWidth: 1024, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.25em", color: "#7c7a72", textTransform: "uppercase", marginBottom: 8 }}>
          Integrations
        </div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600, color: "#e8e6e1" }}>
          Connected Systems
        </h1>
        <p style={{ fontSize: 14, color: "#7c7a72", marginTop: 4 }}>
          External services powering MISE operations.
        </p>
      </div>

      <div style={{ border: "1px solid #232328", borderRadius: 18, background: "#111114", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(47,107,255,0.1)", border: "1px solid rgba(47,107,255,0.2)" }}>
              <Phone size={20} color="#2f6bff" />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#e8e6e1" }}>CALL-E</h2>
              <p style={{ fontSize: 13, color: "#7c7a72" }}>Phone call infrastructure</p>
            </div>
          </div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 14px", borderRadius: 20,
            fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800,
            color: calle?.live ? "#16a34a" : "#dc2626",
            background: calle?.live ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)",
            border: "1px solid " + (calle?.live ? "rgba(22,163,74,0.2)" : "rgba(220,38,38,0.2)"),
          }}>
            {calle?.live ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {calle?.live ? "CONNECTED" : "DISCONNECTED"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { icon: Phone, label: "Outbound Calls" },
            { icon: ArrowRight, label: "Structured Results" },
            { icon: Globe, label: "Transcripts" },
            { icon: Key, label: "Evidence" },
          ].map((cap) => {
            const Icon = cap.icon;
            return (
              <div key={cap.label} style={{ border: "1px solid #232328", borderRadius: 10, padding: 12, background: "#161619" }}>
                <Icon size={16} color="#2f6bff" style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: "#e8e6e1" }}>
                  {cap.label}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#16a34a", marginTop: 4 }}>
                  AVAILABLE
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ borderTop: "1px solid #232328", paddingTop: 20 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", color: "#7c7a72", textTransform: "uppercase", marginBottom: 12 }}>
            Connection Details
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { icon: Globe, label: "API Endpoint", value: calle?.live ? "api.call-e.com" : "Not configured" },
              { icon: Key, label: "API Key", value: calle?.live ? "••••••••••••••••" : "Not configured" },
              { icon: Smartphone, label: "Phone Number", value: calle?.live ? "Configured" : "Not configured" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} style={{ border: "1px solid #232328", borderRadius: 10, padding: 12, background: "#161619" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Icon size={12} color="#4a4940" />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: "#4a4940", textTransform: "uppercase" }}>
                      {item.label}
                    </span>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#e8e6e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 20, border: "1px solid rgba(198,169,107,0.2)", borderRadius: 10, padding: 16, background: "rgba(58,48,32,0.2)" }}>
          <p style={{ fontSize: 12, color: "#c6a96b" }}>
            <strong>Security:</strong> API keys are stored server-side and never
            exposed to the browser. All CALL-E requests are proxied through the
            backend.
          </p>
        </div>
      </div>
    </div>
  );
}
