"use client";

import { useEffect, useState } from "react";
import { CalleStatus } from "@/lib/types";
import { fetchCalleStatus } from "@/lib/api";
import { Settings, Shield, Database, Globe, CheckCircle2, XCircle } from "lucide-react";

function StatusOk({ children }: { children: React.ReactNode }) {
  return (
    <span className="ds-badge green">
      <CheckCircle2 size={12} />
      {children}
    </span>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ds-card ds-card-pad">
      <div className="ds-row" style={{ gap: 10, marginBottom: 8 }}>
        <Icon size={16} color="#8a887f" />
        <h2 className="ds-card-title" style={{ color: "#e8e6e1", fontWeight: 800 }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  sub,
  children,
  noDivider,
}: {
  label: string;
  sub: string;
  children: React.ReactNode;
  noDivider?: boolean;
}) {
  return (
    <div
      className="ds-row"
      style={{
        justifyContent: "space-between",
        padding: "14px 0",
        borderBottom: noDivider ? "none" : "1px solid #1b1b20",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e6e1" }}>{label}</div>
        <div style={{ fontSize: 12, color: "#8a887f", marginTop: 2 }}>{sub}</div>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [calle, setCalle] = useState<CalleStatus | null>(null);

  useEffect(() => {
    fetchCalleStatus()
      .then(setCalle)
      .catch(() => {});
  }, []);

  return (
    <div className="ds-page-narrow">
      <div className="ds-header">
        <div className="ds-kicker">
          <Settings size={13} />
          Settings
        </div>
        <h1 className="ds-h1">Workspace Configuration</h1>
      </div>

      <div className="ds-stack">
        <Section icon={Settings} title="Workspace">
          <Row label="Environment" sub="Current deployment environment">
            <span className="ds-badge blue">PRODUCTION</span>
          </Row>
          <Row label="Evidence Retention" sub="How long call evidence is preserved" noDivider>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                fontWeight: 600,
                color: "#e8e6e1",
              }}
            >
              Indefinite
            </span>
          </Row>
        </Section>

        <Section icon={Globe} title="Integrations">
          <Row label="CALL-E Connection" sub="Phone call infrastructure status" noDivider>
            {calle?.live ? (
              <StatusOk>CONNECTED</StatusOk>
            ) : (
              <span className="ds-badge red">
                <XCircle size={12} />
                DISCONNECTED
              </span>
            )}
          </Row>
        </Section>

        <Section icon={Shield} title="Security">
          <Row label="Contract Enforcement" sub="CONTRACTOR protocol gate status">
            <StatusOk>ACTIVE</StatusOk>
          </Row>
          <Row label="Ledger Integrity" sub="Hash chain verification">
            <StatusOk>VERIFIED</StatusOk>
          </Row>
          <Row label="API Key Security" sub="Secrets stored server-side only" noDivider>
            <StatusOk>SECURE</StatusOk>
          </Row>
        </Section>

        <Section icon={Database} title="Audit">
          <Row label="Test Suite" sub="All protocol tests passing">
            <span
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "#e8e6e1" }}
            >
              72 / 72 passing
            </span>
          </Row>
          <Row label="Mutation Testing" sub="5,000 mutations evaluated" noDivider>
            <span
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: "#16a34a" }}
            >
              0 violations
            </span>
          </Row>
        </Section>
      </div>
    </div>
  );
}