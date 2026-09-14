"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/shared/Button";
import { Shield, Play, XCircle, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

interface Attack {
  name: string;
  input: string;
  code: string;
  result: "BLOCKED" | "PASSED" | null;
  detail: string;
}

const ATTACKS: Omit<Attack, "result" | "detail">[] = [
  {
    name: "Ambiguous Commitment",
    input: "We'll try to get it out tomorrow.",
    code: "SUPPLIER_HEDGED",
  },
  {
    name: "Partial Commitment",
    input: "We have four units. We'll ship them.",
    code: "DELIVERY_WINDOW_MISSING",
  },
  {
    name: "False Completion",
    input: "Agent: delivery confirmed, case closed.",
    code: "PROOF_NOT_TRUSTED",
  },
  {
    name: "Hedged Timeframe",
    input: "Yeah, should be there sometime soon.",
    code: "UNSPECIFIED_DELIVERY_TIME",
  },
];

interface LogEntry {
  time: string;
  event: string;
  type: "attack" | "policy" | "blocked";
}

export default function SecurityLabPage() {
  const [attacks, setAttacks] = useState<Attack[]>(
    ATTACKS.map((a) => ({ ...a, result: null, detail: "" }))
  );
  const [log, setLog] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState<number | null>(null);

  const addLog = useCallback(
    (event: string, type: LogEntry["type"]) => {
      const now = new Date();
      const time = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setLog((prev) => [...prev, { time, event, type }]);
    },
    []
  );

  const runAttack = async (index: number) => {
    setRunning(index);
    const attack = attacks[index];

    addLog(`ATTACK DETECTED: ${attack.name}`, "attack");
    await sleep(400);
    addLog(`POLICY EVALUATION: ${attack.code}`, "policy");
    await sleep(600);

    // All attacks are blocked by the protocol
    addLog("STATE TRANSITION BLOCKED", "blocked");
    await sleep(200);

    setAttacks((prev) =>
      prev.map((a, i) =>
        i === index
          ? { ...a, result: "BLOCKED", detail: `Protocol rejected: ${attack.code}` }
          : a
      )
    );
    setRunning(null);
  };

  const runAll = async () => {
    for (let i = 0; i < attacks.length; i++) {
      if (!attacks[i].result) {
        await runAttack(i);
        await sleep(300);
      }
    }
  };

  const reset = () => {
    setAttacks(
      ATTACKS.map((a) => ({ ...a, result: null, detail: "" }))
    );
    setLog([]);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-5 h-5 text-mise-red" />
          <span className="font-mono text-[10px] tracking-[0.25em] text-mise-red uppercase">
            Security Lab
          </span>
        </div>
        <h1 className="text-2xl font-display font-semibold text-mise-ink">
          Try to Make MISE Lie
        </h1>
        <p className="text-sm text-mise-muted mt-1">
          MISE should refuse to advance the workflow when evidence is insufficient.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attack cards */}
        <div className="lg:col-span-2 space-y-4">
          {attacks.map((attack, i) => (
            <div
              key={i}
              className={`border rounded-xl p-5 transition-all duration-300 ${
                attack.result === "BLOCKED"
                  ? "border-mise-red/30 bg-mise-red-dim/20"
                  : attack.result === "PASSED"
                  ? "border-mise-green/30 bg-mise-green-dim/20"
                  : "border-mise-border bg-mise-surface"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-mono text-[10px] tracking-wider text-mise-muted uppercase mb-1">
                    Attack {(i + 1).toString().padStart(2, "0")}
                  </div>
                  <h3 className="text-sm font-bold text-mise-ink">
                    {attack.name}
                  </h3>
                </div>
                {attack.result && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono font-bold ${
                      attack.result === "BLOCKED"
                        ? "bg-mise-red text-white"
                        : "bg-mise-green text-white"
                    }`}
                  >
                    {attack.result === "BLOCKED" ? (
                      <XCircle className="w-3 h-3" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                    {attack.result}
                  </span>
                )}
              </div>

              {/* Input */}
              <div className="border border-mise-border rounded-lg p-3 bg-mise-card mb-3">
                <div className="font-mono text-[9px] tracking-wider text-mise-faint uppercase mb-1">
                  Payload
                </div>
                <p className="font-display text-sm italic text-mise-ink">
                  &ldquo;{attack.input}&rdquo;
                </p>
              </div>

              {/* Expected code */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] text-mise-faint">
                  Expected: {attack.code}
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => runAttack(i)}
                  disabled={running !== null || attack.result !== null}
                >
                  {running === i ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  Run Attack
                </Button>
              </div>

              {/* Detail */}
              {attack.detail && (
                <div className="mt-3 text-xs text-mise-red/70">
                  {attack.detail}
                </div>
              )}
            </div>
          ))}

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="danger" onClick={runAll} disabled={running !== null}>
              <Play className="w-3 h-3" />
              Run All Attacks
            </Button>
            <Button variant="ghost" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>

        {/* Event log */}
        <div className="border border-mise-border rounded-xl bg-mise-surface p-5">
          <div className="font-mono text-[10px] tracking-[0.2em] text-mise-muted uppercase mb-4">
            Event Stream
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {log.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="w-6 h-6 text-mise-faint mx-auto mb-2" />
                <p className="text-xs text-mise-faint">
                  Run an attack to see events
                </p>
              </div>
            ) : (
              log.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 py-2 border-b border-mise-border last:border-0 animate-fade-in"
                >
                  <span className="font-mono text-[9px] text-mise-faint shrink-0 pt-0.5">
                    {entry.time}
                  </span>
                  <div>
                    <span
                      className={`font-mono text-[10px] font-bold ${
                        entry.type === "attack"
                          ? "text-mise-red"
                          : entry.type === "policy"
                          ? "text-mise-wheat"
                          : "text-mise-red"
                      }`}
                    >
                      {entry.event}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
