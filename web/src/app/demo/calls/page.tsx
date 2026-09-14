"use client";

import { useEffect, useState } from "react";
import { Case } from "@/lib/types";
import { fetchCases } from "@/lib/api";
import { formatTime, formatTimeShort, humanize } from "@/lib/utils";
import { Phone, CheckCircle2, Clock, ExternalLink } from "lucide-react";
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="font-mono text-[10px] tracking-[0.25em] text-mise-muted uppercase mb-2">
          Calls
        </div>
        <h1 className="text-2xl font-display font-semibold text-mise-ink">
          CALL-E Interactions
        </h1>
        <p className="text-sm text-mise-muted mt-1">
          Every outbound call made by MISE through CALL-E.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-mise-surface border border-mise-border rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : allSteps.length === 0 ? (
        <div className="border border-mise-border rounded-xl bg-mise-surface p-12 text-center">
          <Phone className="w-8 h-8 text-mise-faint mx-auto mb-3" />
          <p className="text-sm text-mise-muted">No calls yet.</p>
          <p className="text-xs text-mise-faint mt-1">
            Run the demo to place a call.
          </p>
        </div>
      ) : (
        <div className="border border-mise-border rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-7 gap-4 px-5 py-3 bg-mise-surface border-b border-mise-border">
            {["Call", "Incident", "Recipient", "Status", "Confidence", "Decision", ""].map(
              (h) => (
                <div
                  key={h}
                  className="font-mono text-[9px] tracking-wider text-mise-faint uppercase"
                >
                  {h}
                </div>
              )
            )}
          </div>

          {/* Rows */}
          {allSteps.map((step, i) => (
            <div
              key={step.id}
              className="grid grid-cols-7 gap-4 px-5 py-4 border-b border-mise-border last:border-0 hover:bg-mise-card/50 transition-colors"
            >
              <div className="font-mono text-xs text-mise-ink">
                {step.call_id.slice(0, 12)}
              </div>
              <div className="text-xs text-mise-muted">
                {step.caseName}
              </div>
              <div className="text-xs text-mise-ink font-medium">
                {step.who || "—"}
              </div>
              <div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-mise-green/10 text-mise-green text-[10px] font-mono font-bold">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  COMPLETED
                </span>
              </div>
              <div className="font-mono text-xs text-mise-ink">
                {Math.round(step.confidence * 100)}%
              </div>
              <div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-mise-green/10 text-mise-green text-[10px] font-mono font-bold">
                  ACCEPTED
                </span>
              </div>
              <div>
                <Link
                  href={`/demo/incident?id=${step.caseId}`}
                  className="text-mise-blue hover:text-mise-blue/80 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
