"use client";

import { useEffect, useState } from "react";
import { Case } from "@/lib/types";
import { fetchCases } from "@/lib/api";
import { formatTime, humanize } from "@/lib/utils";
import { Shield, FileText, Lock, Hash, ArrowRight } from "lucide-react";

export default function EvidencePage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCases()
      .then(setCases)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const allSteps = cases.flatMap((c) =>
    (c.steps || []).map((s) => ({ ...s, caseName: c.location_name }))
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="font-mono text-[10px] tracking-[0.25em] text-mise-muted uppercase mb-2">
          Evidence
        </div>
        <h1 className="text-2xl font-display font-semibold text-mise-ink">
          Proof Behind Every Transition
        </h1>
        <p className="text-sm text-mise-muted mt-1">
          Every state change is backed by verifiable call evidence. Append-only, hash-linked.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 bg-mise-surface border border-mise-border rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : allSteps.length === 0 ? (
        <div className="border border-mise-border rounded-xl bg-mise-surface p-12 text-center">
          <FileText className="w-8 h-8 text-mise-faint mx-auto mb-3" />
          <p className="text-sm text-mise-muted">No evidence records yet.</p>
          <p className="text-xs text-mise-faint mt-1">
            Run the demo to generate call evidence.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {allSteps.map((step, i) => (
            <div
              key={step.id}
              className="border border-mise-border rounded-xl bg-mise-surface p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-[10px] tracking-widest text-mise-muted uppercase">
                      Evidence #{i + 1}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-mise-green/10 border border-mise-green/20 text-mise-green text-[10px] font-mono font-bold">
                      <Lock className="w-2.5 h-2.5" />
                      SEALED
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-mise-ink">
                    {humanize(step.to_state)}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[10px] text-mise-faint">
                    {formatTime(step.at)}
                  </div>
                  <div className="font-mono text-[9px] text-mise-faint mt-1">
                    {step.caseName}
                  </div>
                </div>
              </div>

              {/* Quote */}
              <div className="border-l-3 border-mise-green bg-mise-green-dim/20 rounded-r-lg p-4 mb-4">
                <p className="font-display text-sm italic text-mise-ink leading-relaxed">
                  &ldquo;{step.statement}&rdquo;
                </p>
              </div>

              {/* Extracted terms */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {Object.entries(step.structured).map(([key, val]) => {
                  if (key === "confidence") return null;
                  return (
                    <div
                      key={key}
                      className="border border-mise-border rounded-lg p-3 bg-mise-card"
                    >
                      <div className="font-mono text-[9px] tracking-wider text-mise-faint uppercase mb-1">
                        {humanize(key)}
                      </div>
                      <div className="text-sm font-bold text-mise-ink">
                        {typeof val === "object"
                          ? JSON.stringify(val)
                          : String(val)}
                      </div>
                    </div>
                  );
                })}
                <div className="border border-mise-border rounded-lg p-3 bg-mise-card">
                  <div className="font-mono text-[9px] tracking-wider text-mise-faint uppercase mb-1">
                    Confidence
                  </div>
                  <div className="text-sm font-bold text-mise-green">
                    {Math.round(step.confidence * 100)}%
                  </div>
                </div>
              </div>

              {/* Chain */}
              <div className="flex items-center gap-3 text-[10px] font-mono text-mise-faint">
                <Hash className="w-3 h-3" />
                <span className="truncate max-w-xs">
                  PREV: {step.previous_hash.slice(0, 16)}…
                </span>
                <ArrowRight className="w-3 h-3" />
                <span className="truncate max-w-xs text-mise-green">
                  STEP: {step.step_hash.slice(0, 16)}…
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
