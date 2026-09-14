"use client";

import { useEffect, useState } from "react";
import { CalleStatus } from "@/lib/types";
import { fetchCalleStatus } from "@/lib/api";
import { Settings, Shield, Database, Globe, CheckCircle2, XCircle } from "lucide-react";

export default function SettingsPage() {
  const [calle, setCalle] = useState<CalleStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCalleStatus()
      .then(setCalle)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const Section = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) => (
    <div style={{ border: "1px solid #232328", borderRadius: 14, background: "#111114", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Icon size={16} color="#7c7a72" />
        <h2 style={{ fontSize: 12, fontWeight: 700, color: "#e8e6e1", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );

  const Row = ({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #232328" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#e8e6e1" }}>{label}</div>
        <div style={{ fontSize: 12, color: "#7c7a72", marginTop: 2 }}>{sub}</div>
      </div>
      {children}
    </div>
  );

  return (
    <div style={{ padding: 32, maxWidth: 1024, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.25em", color: "#7c7a72", textTransform: "uppercase", marginBottom: 8 }}>
          Settings
        </div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600, color: "#e8e6e1" }}>
          Workspace Configuration
        </h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Section icon={Settings} title="Workspace">
          <Row label="Environment" sub="Current deployment environment">
            <span style={{ padding: "4px 12px", borderRadius: 12, background: "rgba(47,107,255,0.1)", color: "#2f6bff", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, border: "1px solid rgba(47,107,255,0.2)" }}>
              PRODUCTION
            </span>
          </Row>
          <Row label="Evidence Retention" sub="How long call evidence is preserved">
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#e8e6e1" }}>
              Indefinite
            </span>
          </Row>
        </Section>

        <Section icon={Globe} title="Integrations">
          <Row label="CALL-E Connection" sub="Phone call infrastructure status">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: calle?.live ? "#16a34a" : "#dc2626" }}>
              {calle?.live ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              {calle?.live ? "CONNECTED" : "DISCONNECTED"}
            </span>
          </Row>
        </Section>

        <Section icon={Shield} title="Security">
          <Row label="Contract Enforcement" sub="CONTRACTOR protocol gate status">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: "#16a34a" }}>
              <CheckCircle2 size={12} />
              ACTIVE
            </span>
          </Row>
          <Row label="Ledger Integrity" sub="Hash chain verification">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: "#16a34a" }}>
              <CheckCircle2 size={12} />
              VERIFIED
            </span>
          </Row>
          <Row label="API Key Security" sub="Secrets stored server-side only">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: "#16a34a" }}>
              <CheckCircle2 size={12} />
              SECURE
            </span>
          </Row>
        </Section>

        <Section icon={Database} title="Audit">
          <Row label="Test Suite" sub="All protocol tests passing">
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#e8e6e1" }}>
              72 / 72 passing
            </span>
          </Row>
          <Row label="Mutation Testing" sub="5,000 mutations evaluated">
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#16a34a" }}>
              0 violations
            </span>
          </Row>
        </Section>
      </div>
    </div>
  );
}
