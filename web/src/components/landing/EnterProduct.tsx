"use client";

import Link from "next/link";
import { Button } from "@/components/shared/Button";
import { ArrowRight } from "lucide-react";

export function EnterProduct() {
  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-mise-bg via-mise-surface/30 to-mise-bg pointer-events-none" />

      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-mise-wheat mb-4">
          05 · Enter the Real Product
        </div>

        <h2 className="font-display text-3xl md:text-5xl font-semibold leading-tight tracking-tight">
          Enough explanation.
          <br />
          <span className="text-mise-muted">Watch it work.</span>
        </h2>

        <div className="mt-10">
          <Link href="/demo">
            <Button variant="primary" size="lg">
              Open Incident #1842
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        <p className="mt-6 font-mono text-[10px] text-mise-faint tracking-wider">
          The marketing UI transitions into the actual application.
        </p>
      </div>
    </section>
  );
}
