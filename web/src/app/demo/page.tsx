"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Case, Stats } from "@/lib/types";
import { fetchCases, fetchStats } from "@/lib/api";
import { Button } from "@/components/shared/Button";
import { StateBadge } from "@/components/shared/StateBadge";
import { formatTime, humanize } from "@/lib/utils";
import { ArrowRight, Phone, CheckCircle2, Clock, Zap } from "lucide-react";

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
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="font-mono text-[10px] tracking-[0.25em] text-mise-muted uppercase mb-2">
          Operations
        </div>
        <h1 className="text-2xl font-display font-semibold text-mise-ink">
          Active Incidents
        </h1>
        <p className="text-sm text-mise-muted mt-1">
          Incidents requiring verified real-world action.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 bg-mise-surface border border-mise-border rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <>
          {/* Primary incident */}
          {primary && (
            <Link href={`/demo/incident?id=${primary.id}`}>
              <div className="border border-mise-border rounded-2xl bg-mise-surface p-6 mb-6 hover:border-mise-blue/30 transition-all duration-300 cursor-pointer group">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-mono text-[10px] tracking-widest text-mise-muted uppercase">
                        Incident #{primary.id.split("_")[1]?.slice(0, 4) || "1842"}
                      </span>
                      <StateBadge state={primary.state} size="sm" pulse />
                    </div>
                    <h2 className="text-lg font-bold text-mise-ink mb-2">
                      Critical Delivery Recovery
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <div className="font-mono text-[9px] tracking-wider text-mise-faint uppercase mb-1">
                          Required
                        </div>
                        <div className="text-sm font-bold text-mise-ink">
                          4 Units
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-[9px] tracking-wider text-mise-faint uppercase mb-1">
                          Supplier
                        </div>
                        <div className="text-sm font-bold text-mise-ink">
                          {primary.location_name}
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-[9px] tracking-wider text-mise-faint uppercase mb-1">
                          Deadline
                        </div>
                        <div className="text-sm font-bold text-mise-ink">
                          Tomorrow · 2:00 PM
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-[9px] tracking-wider text-mise-faint uppercase mb-1">
                          Next Action
                        </div>
                        <div className="text-sm font-bold text-mise-blue">
                          {primary.next_action?.label || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-5 h-5 text-mise-blue" />
                  </div>
                </div>

                {/* State flow */}
                <div className="mt-5 flex items-center gap-2 text-[10px] font-mono tracking-wide overflow-x-auto">
                  {["DELIVERY_FAILED", "SUPPLIER_CONTACT_REQUIRED", "COMMITMENT_ACCEPTED", "RECOVERY_COMMITTED"].map(
                    (s, i) => {
                      const isCurrent = s === primary.state;
                      const isPast =
                        ["DELIVERY_FAILED", "SUPPLIER_CONTACT_REQUIRED", "COMMITMENT_ACCEPTED", "RECOVERY_COMMITTED"].indexOf(primary.state) >
                        i;
                      return (
                        <span key={s} className="flex items-center gap-2">
                          {i > 0 && <span className="text-mise-faint">→</span>}
                          <span
                            className={`px-2 py-1 rounded border ${
                              isCurrent
                                ? "border-mise-blue/40 bg-mise-blue/10 text-mise-blue font-bold"
                                : isPast
                                ? "border-mise-green/30 bg-mise-green/10 text-mise-green"
                                : "border-mise-border text-mise-faint"
                            }`}
                          >
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

          {/* Stats row */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1 border border-mise-border rounded-xl overflow-hidden mb-8">
              {[
                { icon: Zap, label: "Live Cases", value: stats.cases, color: "text-mise-blue" },
                { icon: Phone, label: "Total Transitions", value: stats.transitions, color: "text-mise-wheat" },
                { icon: CheckCircle2, label: "Avg Confidence", value: `${Math.round(stats.avg_confidence * 100)}%`, color: "text-mise-green" },
                { icon: Clock, label: "Tests Passing", value: stats.tests, color: "text-mise-ink" },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="bg-mise-surface p-5">
                    <Icon className={`w-4 h-4 ${stat.color} mb-2`} />
                    <div className="text-2xl font-display font-bold text-mise-ink">
                      {stat.value}
                    </div>
                    <div className="font-mono text-[9px] tracking-wider text-mise-faint uppercase mt-1">
                      {stat.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick actions */}
          <div className="border border-mise-border rounded-xl bg-mise-surface p-6">
            <h3 className="font-mono text-[10px] tracking-[0.2em] text-mise-muted uppercase mb-4">
              Quick Actions
            </h3>
            <div className="flex gap-3">
              <Link href={`/demo/incident?id=${primary?.id}`}>
                <Button variant="primary" size="sm">
                  Open Incident Detail
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
              <Link href="/demo/security-lab">
                <Button variant="secondary" size="sm">
                  Security Lab
                </Button>
              </Link>
              <Link href="/demo/evidence">
                <Button variant="ghost" size="sm">
                  View Evidence
                </Button>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
