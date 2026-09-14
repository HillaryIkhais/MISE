"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  AlertTriangle,
  Phone,
  Shield,
  FileText,
  Link2,
  Settings,
  Activity,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    label: "OPERATIONS",
    items: [
      { href: "/demo", icon: LayoutDashboard, label: "Overview" },
      { href: "/demo/incident", icon: AlertTriangle, label: "Incidents" },
      { href: "/demo/evidence", icon: FileText, label: "Evidence" },
    ],
  },
  {
    label: "COMMUNICATIONS",
    items: [
      { href: "/demo/calls", icon: Phone, label: "Calls" },
    ],
  },
  {
    label: "VERIFICATION",
    items: [
      { href: "/demo/security-lab", icon: Shield, label: "Security Lab" },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { href: "/demo/integrations", icon: Link2, label: "Integrations" },
      { href: "/demo/settings", icon: Settings, label: "Settings" },
    ],
  },
];

const s = {
  aside: {
    position: "fixed" as const,
    left: 0,
    top: 0,
    bottom: 0,
    width: 224,
    background: "#111114",
    borderRight: "1px solid #232328",
    zIndex: 40,
    display: "flex",
    flexDirection: "column" as const,
  },
  logo: {
    height: 56,
    display: "flex",
    alignItems: "center",
    padding: "0 20px",
    borderBottom: "1px solid #232328",
    textDecoration: "none",
    color: "#e8e6e1",
    gap: 10,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#2f6bff",
    boxShadow: "0 0 12px rgba(47,107,255,0.4)",
  },
  logoText: {
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "0.15em",
    textTransform: "uppercase" as const,
  },
  nav: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "16px 12px",
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    padding: "0 8px",
    marginBottom: 8,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.2em",
    color: "#4a4940",
    textTransform: "uppercase" as const,
  },
  link: (active: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    textDecoration: "none",
    transition: "all 0.15s",
    background: active ? "rgba(47,107,255,0.1)" : "transparent",
    color: active ? "#2f6bff" : "#7c7a72",
    border: active ? "1px solid rgba(47,107,255,0.2)" : "1px solid transparent",
  }),
  bottom: {
    borderTop: "1px solid #232328",
    padding: 16,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={s.aside}>
      <Link href="/" style={s.logo}>
        <span style={s.logoDot} />
        <span style={s.logoText}>MISE</span>
      </Link>

      <nav style={s.nav}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} style={s.section}>
            <div style={s.sectionLabel}>{section.label}</div>
            <div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={s.link(active)}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div style={s.bottom}>
        <Activity size={12} color="#16a34a" />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#7c7a72", letterSpacing: "0.1em" }}>
          System Operational
        </span>
      </div>
    </aside>
  );
}
