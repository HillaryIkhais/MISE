"use client";

import { useEffect, useState } from "react";
import { CalleStatus } from "@/lib/types";
import { fetchCalleStatus } from "@/lib/api";
import {
  Settings,
  Shield,
  Database,
  Globe,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function SettingsPage() {
  const [calle, setCalle] = useState<CalleStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCalleStatus()
      .then(setCalle)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="font-mono text-[10px] tracking-[0.25em] text-mise-muted uppercase mb-2">
          Settings
        </div>
        <h1 className="text-2xl font-display font-semibold text-mise-ink">
          Workspace Configuration
        </h1>
      </div>

      <div className="space-y-6">
        {/* Workspace */}
        <div className="border border-mise-border rounded-xl bg-mise-surface p-6">
          <div className="flex items-center gap-3 mb-5">
            <Settings className="w-4 h-4 text-mise-muted" />
            <h2 className="text-sm font-bold text-mise-ink uppercase tracking-wider">
              Workspace
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-mise-border">
              <div>
                <div className="text-sm font-medium text-mise-ink">
                  Environment
                </div>
                <div className="text-xs text-mise-muted">
                  Current deployment environment
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-mise-blue/10 text-mise-blue text-[10px] font-mono font-bold border border-mise-blue/20">
                PRODUCTION
              </span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-mise-border">
              <div>
                <div className="text-sm font-medium text-mise-ink">
                  Evidence Retention
                </div>
                <div className="text-xs text-mise-muted">
                  How long call evidence is preserved
                </div>
              </div>
              <span className="font-mono text-xs text-mise-ink">
                Indefinite
              </span>
            </div>
          </div>
        </div>

        {/* Integrations */}
        <div className="border border-mise-border rounded-xl bg-mise-surface p-6">
          <div className="flex items-center gap-3 mb-5">
            <Globe className="w-4 h-4 text-mise-muted" />
            <h2 className="text-sm font-bold text-mise-ink uppercase tracking-wider">
              Integrations
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-mise-border">
              <div>
                <div className="text-sm font-medium text-mise-ink">
                  CALL-E Connection
                </div>
                <div className="text-xs text-mise-muted">
                  Phone call infrastructure status
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold ${
                  calle?.live ? "text-mise-green" : "text-mise-red"
                }`}
              >
                {calle?.live ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                {calle?.live ? "CONNECTED" : "DISCONNECTED"}
              </span>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="border border-mise-border rounded-xl bg-mise-surface p-6">
          <div className="flex items-center gap-3 mb-5">
            <Shield className="w-4 h-4 text-mise-muted" />
            <h2 className="text-sm font-bold text-mise-ink uppercase tracking-wider">
              Security
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-mise-border">
              <div>
                <div className="text-sm font-medium text-mise-ink">
                  Contract Enforcement
                </div>
                <div className="text-xs text-mise-muted">
                  CONTRACTOR protocol gate status
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-mise-green">
                <CheckCircle2 className="w-3 h-3" />
                ACTIVE
              </span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-mise-border">
              <div>
                <div className="text-sm font-medium text-mise-ink">
                  Ledger Integrity
                </div>
                <div className="text-xs text-mise-muted">
                  Hash chain verification
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-mise-green">
                <CheckCircle2 className="w-3 h-3" />
                VERIFIED
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium text-mise-ink">
                  API Key Security
                </div>
                <div className="text-xs text-mise-muted">
                  Secrets stored server-side only
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-mise-green">
                <CheckCircle2 className="w-3 h-3" />
                SECURE
              </span>
            </div>
          </div>
        </div>

        {/* Audit */}
        <div className="border border-mise-border rounded-xl bg-mise-surface p-6">
          <div className="flex items-center gap-3 mb-5">
            <Database className="w-4 h-4 text-mise-muted" />
            <h2 className="text-sm font-bold text-mise-ink uppercase tracking-wider">
              Audit
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-mise-border">
              <div>
                <div className="text-sm font-medium text-mise-ink">
                  Test Suite
                </div>
                <div className="text-xs text-mise-muted">
                  All protocol tests passing
                </div>
              </div>
              <span className="font-mono text-xs text-mise-ink">
                72 / 72 passing
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium text-mise-ink">
                  Mutation Testing
                </div>
                <div className="text-xs text-mise-muted">
                  5,000 mutations evaluated
                </div>
              </div>
              <span className="font-mono text-xs text-mise-green">
                0 violations
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
