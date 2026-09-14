"use client";

import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200",
        "active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
        {
          "bg-mise-blue text-white hover:bg-blue-600 shadow-lg shadow-blue-500/20":
            variant === "primary",
          "border border-mise-border bg-mise-card text-mise-ink hover:bg-mise-border":
            variant === "secondary",
          "text-mise-muted hover:text-mise-ink": variant === "ghost",
          "bg-mise-red text-white hover:bg-red-700 shadow-lg shadow-red-500/20":
            variant === "danger",
          "bg-mise-green text-white hover:bg-green-700 shadow-lg shadow-green-500/20":
            variant === "success",
        },
        {
          "px-3 py-1.5 text-xs rounded-md": size === "sm",
          "px-5 py-2.5 text-sm rounded-lg": size === "md",
          "px-7 py-3.5 text-base rounded-xl": size === "lg",
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
