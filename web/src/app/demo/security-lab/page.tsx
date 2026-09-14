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
    <div style={{ padding: 32, maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <Shield size={18} color="#dc2626" />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.25em", color: "#dc2626", textTransform: "uppercase" }}>
            Security Lab
          </span>
        </div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600, color: "#e8e6e1" }}>
          Try to Make MISE Lie
        </h1>
        <p style={{ fontSize: 14, color: "#7c7a72", marginTop: 4 }}>
          MISE should refuse to advance the workflow when evidence is insufficient.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {attacks.map((attack, i) => (
            <div
              key={i}
              style={{
                border: "1px solid " + (attack.result === "BLOCKED" ? "rgba(220,38,38,0.3)" : "#232328"),
                borderRadius: 14,
                padding: 20,
                background: attack.result === "BLOCKED" ? "rgba(58,15,15,0.2)" : "#111114",
                transition: "all 0.3s",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "#7c7a72", textTransform: "uppercase", marginBottom: 4 }}>
                    Attack {(i + 1).toString().padStart(2, "0")}
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#e8e6e1" }}>
                    {attack.name}
                  </h3>
                </div>
                {attack.result && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "4px 10px", borderRadius: 6,
                    fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800,
                    background: attack.result === "BLOCKED" ? "#dc2626" : "#16a34a",
                    color: "#fff",
                  }}>
                    {attack.result === "BLOCKED" ? <XCircle size={12} /> : <CheckCircle2 size={12} />}
                    {attack.result}
                  </span>
                )}
              </div>

              <div style={{ border: "1px solid #232328", borderRadius: 10, padding: 12, background: "#161619", marginBottom: 12 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: "#4a4940", textTransform: "uppercase", marginBottom: 4 }}>
                  Payload
                </div>
                <p style={{ fontFamily: "'Fraunces', serif", fontSize: 14, fontStyle: "italic", color: "#e8e6e1" }}>
                  &ldquo;{attack.input}&rdquo;
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#4a4940" }}>
                  Expected: {attack.code}
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => runAttack(i)}
                  disabled={running !== null || attack.result !== null}
                >
                  {running === i ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={12} />}
                  Run Attack
                </Button>
              </div>

              {attack.detail && (
                <div style={{ marginTop: 12, fontSize: 12, color: "rgba(220,38,38,0.7)" }}>
                  {attack.detail}
                </div>
              )}
            </div>
          ))}

          <div style={{ display: "flex", gap: 12 }}>
            <Button variant="danger" onClick={runAll} disabled={running !== null}>
              <Play size={12} />
              Run All Attacks
            </Button>
            <Button variant="ghost" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>

        <div style={{ border: "1px solid #232328", borderRadius: 14, background: "#111114", padding: 20 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", color: "#7c7a72", textTransform: "uppercase", marginBottom: 16 }}>
            Event Stream
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 500, overflowY: "auto" }}>
            {log.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <AlertTriangle size={24} color="#4a4940" style={{ margin: "0 auto 8px" }} />
                <p style={{ fontSize: 12, color: "#4a4940" }}>
                  Run an attack to see events
                </p>
              </div>
            ) : (
              log.map((entry, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 0", borderBottom: "1px solid #232328" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#4a4940", flexShrink: 0, paddingTop: 2 }}>
                    {entry.time}
                  </span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700,
                    color: entry.type === "attack" ? "#dc2626" : entry.type === "policy" ? "#c6a96b" : "#dc2626",
                  }}>
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
