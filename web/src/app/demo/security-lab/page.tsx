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
  { name: "Ambiguous Commitment", input: "We'll try to get it out tomorrow.", code: "SUPPLIER_HEDGED" },
  { name: "Partial Commitment", input: "We have four units. We'll ship them.", code: "DELIVERY_WINDOW_MISSING" },
  { name: "False Completion", input: "Agent: delivery confirmed, case closed.", code: "PROOF_NOT_TRUSTED" },
  { name: "Hedged Timeframe", input: "Yeah, should be there sometime soon.", code: "UNSPECIFIED_DELIVERY_TIME" },
];

interface LogEntry {
  time: string;
  event: string;
  type: "attack" | "policy" | "blocked";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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
    addLog("STATE TRANSITION BLOCKED", "blocked");
    await sleep(200);
    setAttacks((prev) =>
      prev.map((a, i) =>
        i === index ? { ...a, result: "BLOCKED", detail: `Protocol rejected: ${attack.code}` } : a
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
    setAttacks(ATTACKS.map((a) => ({ ...a, result: null, detail: "" })));
    setLog([]);
  };

  return (
    <div className="ds-page">
      <div className="ds-header">
        <div className="ds-kicker" style={{ color: "#dc2626" }}>
          <Shield size={13} />
          Security Lab
        </div>
        <h1 className="ds-h1">Try to Make MISE Lie</h1>
        <p className="ds-sub">
          MISE should refuse to advance the workflow when evidence is insufficient.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 24,
          alignItems: "start",
        }}
      >
        <div className="ds-stack">
          {attacks.map((attack, i) => (
            <div
              key={i}
              className="ds-card"
              style={{
                padding: 20,
                borderRadius: 14,
                borderColor:
                  attack.result === "BLOCKED"
                    ? "rgba(220,38,38,0.35)"
                    : "var(--ds-border)",
                background:
                  attack.result === "BLOCKED"
                    ? "rgba(58,18,20,0.28)"
                    : "var(--ds-surface-2)",
                transition: "all 0.3s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      letterSpacing: "0.1em",
                      color: "#8a887f",
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}
                  >
                    Attack {(i + 1).toString().padStart(2, "0")}
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#e8e6e1" }}>
                    {attack.name}
                  </h3>
                </div>
                {attack.result && (
                  <span className="ds-badge solid red">
                    {attack.result === "BLOCKED" ? (
                      <XCircle size={12} />
                    ) : (
                      <CheckCircle2 size={12} />
                    )}
                    {attack.result}
                  </span>
                )}
              </div>

              <div className="ds-kv" style={{ marginBottom: 12 }}>
                <div className="ds-kv-k">Payload</div>
                <p
                  style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: 14,
                    fontStyle: "italic",
                    color: "#e8e6e1",
                    fontWeight: 400,
                    lineHeight: 1.4,
                  }}
                >
                  &ldquo;{attack.input}&rdquo;
                </p>
              </div>

              <div
                className="ds-row"
                style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}
              >
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: "#55534b",
                    letterSpacing: "0.06em",
                  }}
                >
                  Expected: {attack.code}
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => runAttack(i)}
                  disabled={running !== null || attack.result !== null}
                >
                  {running === i ? (
                    <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <Play size={12} />
                  )}
                  Run Attack
                </Button>
              </div>

              {attack.detail && (
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    color: "rgba(220,38,38,0.8)",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {attack.detail}
                </div>
              )}
            </div>
          ))}

          <div className="ds-row" style={{ marginTop: 4 }}>
            <Button variant="danger" onClick={runAll} disabled={running !== null}>
              <Play size={12} />
              Run All Attacks
            </Button>
            <Button variant="ghost" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>

        <div className="ds-card ds-card-pad" style={{ position: "sticky", top: 24 }}>
          <div className="ds-card-title" style={{ marginBottom: 16 }}>
            Event Stream
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxHeight: 500,
              overflowY: "auto",
            }}
          >
            {log.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div className="ds-empty-icon">
                  <AlertTriangle size={24} color="#55534b" />
                </div>
                <p style={{ fontSize: 12, color: "#55534b" }}>
                  Run an attack to see events
                </p>
              </div>
            ) : (
              log.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: "1px solid #1b1b20",
                    animation: "fadeInUp 0.3s ease-out both",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      color: "#55534b",
                      flexShrink: 0,
                      paddingTop: 2,
                    }}
                  >
                    {entry.time}
                  </span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      fontWeight: 700,
                      color:
                        entry.type === "attack"
                          ? "#dc2626"
                          : entry.type === "policy"
                            ? "#c6a96b"
                            : "#dc2626",
                    }}
                  >
                    {entry.event}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}