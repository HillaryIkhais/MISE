"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/shared/Button";

const NAV_ITEMS = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/demo", label: "Demo" },
  { href: "/#security", label: "Security" },
];

export function LandingNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-mise-border/50 bg-mise-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-2.5 w-2.5 rounded-full bg-mise-blue shadow-lg shadow-blue-500/30" />
          <span className="text-sm font-bold tracking-[0.15em] uppercase">MISE</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "text-xs font-semibold tracking-wide transition-colors hover:text-mise-ink",
                pathname === item.href ? "text-mise-ink" : "text-mise-muted"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://github.com/HillaryIkhais/MISE"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-mise-muted transition-colors hover:text-mise-ink"
          >
            GitHub
          </a>
          <Link href="/demo">
            <Button variant="primary" size="sm">
              Open MISE
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
