"use client";

import { cn } from "@/lib/utils";
import { STATE_COLORS, STATE_LABELS } from "@/lib/types";

interface StateBadgeProps {
  state: string;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
}

export function StateBadge({ state, size = "md", pulse }: StateBadgeProps) {
  const color = STATE_COLORS[state] || "#7c7a72";
  const label = STATE_LABELS[state] || state;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono font-bold tracking-wider uppercase",
        {
          "px-2 py-0.5 text-[9px] rounded": size === "sm",
          "px-3 py-1 text-[10px] rounded-md": size === "md",
          "px-4 py-1.5 text-xs rounded-lg": size === "lg",
        }
      )}
      style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            style={{ backgroundColor: color }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: color }}
          />
        </span>
      )}
      {label}
    </span>
  );
}
