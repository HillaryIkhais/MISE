"use client";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  primary: { background: "#2f6bff", color: "#fff", boxShadow: "0 4px 16px rgba(47,107,255,0.2)" },
  secondary: { border: "1px solid #232328", background: "#161619", color: "#e8e6e1" },
  ghost: { background: "transparent", color: "#7c7a72" },
  danger: { background: "#dc2626", color: "#fff", boxShadow: "0 4px 16px rgba(220,38,38,0.2)" },
  success: { background: "#16a34a", color: "#fff", boxShadow: "0 4px 16px rgba(22,163,74,0.2)" },
};

const SIZE_STYLES: Record<string, React.CSSProperties> = {
  sm: { padding: "6px 12px", fontSize: 12, borderRadius: 6 },
  md: { padding: "10px 20px", fontSize: 13, borderRadius: 8 },
  lg: { padding: "14px 28px", fontSize: 15, borderRadius: 10 },
};

export function Button({
  variant = "primary",
  size = "md",
  style,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontWeight: 600,
        cursor: "pointer",
        border: "none",
        transition: "all 0.2s",
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
