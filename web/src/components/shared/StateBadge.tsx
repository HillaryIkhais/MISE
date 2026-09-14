"use client";

import { STATE_COLORS, STATE_LABELS } from "@/lib/types";

interface StateBadgeProps {
  state: string;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
}

const SIZE_STYLES: Record<string, React.CSSProperties> = {
  sm: { padding: "2px 8px", fontSize: 9, borderRadius: 4 },
  md: { padding: "4px 12px", fontSize: 10, borderRadius: 6 },
  lg: { padding: "6px 16px", fontSize: 12, borderRadius: 8 },
};

export function StateBadge({ state, size = "md", pulse }: StateBadgeProps) {
  const color = STATE_COLORS[state] || "#7c7a72";
  const label = STATE_LABELS[state] || state;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 800,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color,
        backgroundColor: `${color}18`,
        border: `1px solid ${color}30`,
        ...SIZE_STYLES[size],
      }}
    >
      {pulse && (
        <span style={{ position: "relative", display: "flex", width: 8, height: 8 }}>
          <span
            style={{
              position: "absolute",
              inlineSize: "100%",
              blockSize: "100%",
              borderRadius: "50%",
              opacity: 0.75,
              backgroundColor: color,
              animation: "ping 2s infinite",
            }}
          />
          <span
            style={{
              position: "relative",
              display: "inline-flex",
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: color,
            }}
          />
        </span>
      )}
      {label}
    </span>
  );
}
