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
import { cn } from "@/lib/utils";

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
    items: [{ href: "/demo/calls", icon: Phone, label: "Calls" }],
  },
  {
    label: "VERIFICATION",
    items: [{ href: "/demo/security-lab", icon: Shield, label: "Security Lab" }],
  },
  {
    label: "SYSTEM",
    items: [
      { href: "/demo/integrations", icon: Link2, label: "Integrations" },
      { href: "/demo/settings", icon: Settings, label: "Settings" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="ds-sidebar">
      <Link href="/" className="ds-side-logo">
        <span className="ds-side-logo-dot" />
        <span className="ds-side-logo-text">MISE</span>
      </Link>

      <nav className="ds-side-nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="ds-side-section">
            <div className="ds-side-group">{section.label}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("ds-side-link", { active })}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="ds-side-foot">
        <Activity size={12} color="#16a34a" />
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "#8a887f",
            letterSpacing: "0.1em",
          }}
        >
          System Operational
        </span>
      </div>
    </aside>
  );
}