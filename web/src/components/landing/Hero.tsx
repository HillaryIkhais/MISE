"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/shared/Button";
import { ArrowRight, ExternalLink } from "lucide-react";

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const loadGSAP = async () => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        gsap.from(".hero-eyebrow", {
          opacity: 0,
          y: 10,
          duration: 0.6,
          delay: 0.2,
        });
        gsap.from(".hero-title", {
          opacity: 0,
          y: 20,
          duration: 0.8,
          delay: 0.4,
        });
        gsap.from(".hero-sub", {
          opacity: 0,
          y: 15,
          duration: 0.7,
          delay: 0.6,
        });
        gsap.from(".hero-cta", {
          opacity: 0,
          y: 15,
          duration: 0.6,
          delay: 0.8,
        });
        gsap.from(".hero-card", {
          opacity: 0,
          x: 30,
          duration: 0.8,
          delay: 0.6,
        });
      }, sectionRef);

      return () => ctx.revert();
    };
    loadGSAP();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center pt-14"
    >
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-mise-blue/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-mise-wheat/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="mx-auto max-w-7xl w-full px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="hero-eyebrow flex items-center gap-3 mb-6 font-mono text-[10px] tracking-[0.2em] uppercase text-mise-muted">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mise-red opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-mise-red" />
            </span>
            Incident #1842 · Critical Delivery · Case Live
          </div>

          <h1 className="hero-title font-display text-5xl md:text-7xl font-semibold leading-[1.02] tracking-tight">
            Don&apos;t let{" "}
            <span className="text-mise-blue">&quot;maybe&quot;</span>
            <br />
            become{" "}
            <span className="text-mise-muted font-light">&quot;done.&quot;</span>
          </h1>

          <p className="hero-sub mt-6 text-lg text-mise-muted leading-relaxed max-w-lg">
            MISE gives autonomous agents a hard boundary between conversation and
            operational reality. A real-world task moves only when the responsible
            party makes a{" "}
            <span className="text-mise-ink font-semibold">
              verified commitment
            </span>
            .
          </p>

          <div className="hero-cta mt-8 flex items-center gap-4">
            <Link href="/demo">
              <Button variant="primary" size="lg">
                Open Live Demo
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="secondary" size="lg">
                How It Works
              </Button>
            </a>
          </div>
        </div>

        {/* Hero visual: operational state card */}
        <div className="hero-card hidden lg:block">
          <div className="relative border border-mise-border rounded-2xl bg-mise-surface p-6 shadow-2xl shadow-black/40">
            {/* Status bar */}
            <div className="flex items-center justify-between mb-5">
              <span className="font-mono text-[10px] tracking-widest text-mise-muted uppercase">
                Operational Status
              </span>
              <span className="flex items-center gap-2 font-mono text-[10px] text-mise-red">
                <span className="h-1.5 w-1.5 rounded-full bg-mise-red animate-pulse" />
                BLOCKED
              </span>
            </div>

            {/* Incident header */}
            <div className="mb-5">
              <div className="font-mono text-[10px] tracking-widest text-mise-muted uppercase mb-1">
                Incident #1842
              </div>
              <div className="text-sm font-bold tracking-wide uppercase text-mise-ink">
                Critical Delivery Recovery
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="border border-mise-border rounded-lg p-3">
                <div className="font-mono text-[9px] tracking-widest text-mise-faint uppercase mb-1">
                  Required
                </div>
                <div className="text-sm font-bold text-mise-ink">
                  4 Units
                </div>
              </div>
              <div className="border border-mise-border rounded-lg p-3">
                <div className="font-mono text-[9px] tracking-widest text-mise-faint uppercase mb-1">
                  Deadline
                </div>
                <div className="text-sm font-bold text-mise-ink">
                  Tomorrow · 2:00 PM
                </div>
              </div>
              <div className="border border-mise-border rounded-lg p-3">
                <div className="font-mono text-[9px] tracking-widest text-mise-faint uppercase mb-1">
                  Supplier
                </div>
                <div className="text-sm font-bold text-mise-ink">
                  Torque Precision
                </div>
              </div>
              <div className="border border-mise-border rounded-lg p-3">
                <div className="font-mono text-[9px] tracking-widest text-mise-faint uppercase mb-1">
                  Next Action
                </div>
                <div className="text-sm font-bold text-mise-blue">
                  Call Supplier
                </div>
              </div>
            </div>

            {/* State flow */}
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-wide">
              <span className="px-2 py-1 rounded bg-mise-red-dim text-mise-red border border-mise-red/20">
                DELIVERY FAILED
              </span>
              <span className="text-mise-faint">→</span>
              <span className="px-2 py-1 rounded bg-mise-wheat-dim text-mise-wheat border border-mise-wheat/20">
                SUPPLIER CONTACT REQUIRED
              </span>
              <span className="text-mise-faint">→</span>
              <span className="px-2 py-1 rounded border border-mise-border text-mise-faint">
                COMMITMENT ACCEPTED
              </span>
              <span className="text-mise-faint">→</span>
              <span className="px-2 py-1 rounded border border-mise-border text-mise-faint">
                RECOVERY COMMITTED
              </span>
            </div>

            {/* Phone call animation hint */}
            <div className="mt-5 flex items-center gap-3 border-t border-mise-border pt-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mise-blue/10 border border-mise-blue/20">
                <svg
                  className="w-4 h-4 text-mise-blue"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
              </div>
              <div>
                <div className="text-xs font-semibold text-mise-ink">
                  CALL-E Ready
                </div>
                <div className="font-mono text-[9px] text-mise-muted">
                  Outbound call · Torque Precision
                </div>
              </div>
              <div className="ml-auto">
                <span className="flex items-center gap-1.5 font-mono text-[9px] text-mise-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-mise-green animate-pulse" />
                  CONNECTING
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
