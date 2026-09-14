"use client";

import { useEffect, useState } from "react";
import { CalleStatus } from "@/lib/types";
import { fetchCalleStatus } from "@/lib/api";
import {
  Link2,
  Phone,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Globe,
  Key,
  Smartphone,
} from "lucide-react";

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
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="font-mono text-[10px] tracking-[0.25em] text-mise-muted uppercase mb-2">
          Integrations
        </div>
        <h1 className="text-2xl font-display font-semibold text-mise-ink">
          Connected Systems
        </h1>
        <p className="text-sm text-mise-muted mt-1">
          External services powering MISE operations.
        </p>
      </div>

      {/* CALL-E card */}
      <div className="border border-mise-border rounded-2xl bg-mise-surface p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-mise-blue/10 border border-mise-blue/20">
              <Phone className="w-5 h-5 text-mise-blue" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-mise-ink">CALL-E</h2>
              <p className="text-sm text-mise-muted">
                Phone call infrastructure
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold ${
              calle?.live
                ? "bg-mise-green/10 text-mise-green border border-mise-green/20"
                : "bg-mise-red/10 text-mise-red border border-mise-red/20"
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

        {/* Capabilities */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { icon: Phone, label: "Outbound Calls", available: true },
            { icon: ArrowRight, label: "Structured Results", available: true },
            { icon: Globe, label: "Transcripts", available: true },
            { icon: Key, label: "Evidence", available: true },
          ].map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.label}
                className="border border-mise-border rounded-lg p-3 bg-mise-card"
              >
                <Icon className="w-4 h-4 text-mise-blue mb-2" />
                <div className="text-xs font-semibold text-mise-ink">
                  {cap.label}
                </div>
                <div className="font-mono text-[9px] text-mise-green mt-1">
                  AVAILABLE
                </div>
              </div>
            );
          })}
        </div>

        {/* Connection details */}
        <div className="border-t border-mise-border pt-5">
          <div className="font-mono text-[10px] tracking-[0.2em] text-mise-muted uppercase mb-3">
            Connection Details
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-mise-border rounded-lg p-3 bg-mise-card">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-3 h-3 text-mise-faint" />
                <span className="font-mono text-[9px] tracking-wider text-mise-faint uppercase">
                  API Endpoint
                </span>
              </div>
              <div className="font-mono text-xs text-mise-ink truncate">
                {calle?.live ? "api.call-e.com" : "Not configured"}
              </div>
            </div>
            <div className="border border-mise-border rounded-lg p-3 bg-mise-card">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-3 h-3 text-mise-faint" />
                <span className="font-mono text-[9px] tracking-wider text-mise-faint uppercase">
                  API Key
                </span>
              </div>
              <div className="font-mono text-xs text-mise-ink">
                {calle?.live ? "••••••••••••••••" : "Not configured"}
              </div>
            </div>
            <div className="border border-mise-border rounded-lg p-3 bg-mise-card">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="w-3 h-3 text-mise-faint" />
                <span className="font-mono text-[9px] tracking-wider text-mise-faint uppercase">
                  Phone Number
                </span>
              </div>
              <div className="font-mono text-xs text-mise-ink">
                {calle?.live ? "Configured" : "Not configured"}
              </div>
            </div>
          </div>
        </div>

        {/* Security note */}
        <div className="mt-5 border border-mise-wheat/20 rounded-lg p-4 bg-mise-wheat-dim/20">
          <p className="text-xs text-mise-wheat">
            <strong>Security:</strong> API keys are stored server-side and never
            exposed to the browser. All CALL-E requests are proxied through the
            backend.
          </p>
        </div>
      </div>
    </div>
  );
}
