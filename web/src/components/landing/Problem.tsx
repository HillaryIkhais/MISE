"use client";

import { useEffect, useRef } from "react";

export function Problem() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const loadGSAP = async () => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        gsap.from(".problem-kicker", {
          scrollTrigger: { trigger: ".problem-kicker", start: "top 85%" },
          opacity: 0,
          y: 10,
          duration: 0.5,
        });
        gsap.from(".problem-title", {
          scrollTrigger: { trigger: ".problem-title", start: "top 85%" },
          opacity: 0,
          y: 20,
          duration: 0.7,
        });
        gsap.from(".problem-flow", {
          scrollTrigger: { trigger: ".problem-flow", start: "top 80%" },
          opacity: 0,
          y: 20,
          duration: 0.7,
        });
        gsap.from(".problem-fail", {
          scrollTrigger: { trigger: ".problem-fail", start: "top 80%" },
          opacity: 0,
          scale: 0.95,
          duration: 0.6,
        });
      }, sectionRef);

      return () => ctx.revert();
    };
    loadGSAP();
  }, []);

  return (
    <section ref={sectionRef} id="problem" className="py-24 relative">
      <div className="mx-auto max-w-5xl px-6">
        <div className="problem-kicker font-mono text-[10px] tracking-[0.25em] uppercase text-mise-blue mb-4">
          01 · The Problem
        </div>

        <h2 className="problem-title font-display text-3xl md:text-5xl font-semibold leading-tight tracking-tight max-w-3xl">
          The problem isn&apos;t the call.
          <br />
          <span className="text-mise-muted">
            It&apos;s what happens after it.
          </span>
        </h2>

        <p className="mt-6 text-mise-muted text-lg leading-relaxed max-w-2xl">
          Autonomous agents increasingly interact with the physical world. They
          call suppliers, contact vendors, coordinate services, and recover from
          operational failures. But conversation creates ambiguity.
        </p>

        {/* Conversation flow */}
        <div className="problem-flow mt-12 border border-mise-border rounded-2xl bg-mise-surface p-8">
          <div className="space-y-6">
            {/* Agent */}
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mise-blue/10 border border-mise-blue/20 font-mono text-[10px] font-bold text-mise-blue">
                AGENT
              </div>
              <div className="border border-mise-border rounded-xl rounded-tl-sm px-5 py-3 bg-mise-card text-sm text-mise-ink leading-relaxed max-w-md">
                We need four units delivered by tomorrow at 2 PM.
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center gap-3 pl-4">
              <div className="w-px h-4 bg-mise-border" />
              <span className="font-mono text-[9px] text-mise-faint tracking-wider">
                ↓
              </span>
            </div>

            {/* Supplier */}
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mise-wheat/10 border border-mise-wheat/20 font-mono text-[10px] font-bold text-mise-wheat">
                SUPPLIER
              </div>
              <div className="border border-mise-border rounded-xl rounded-tl-sm px-5 py-3 bg-mise-card text-sm text-mise-ink leading-relaxed max-w-md">
                Yeah, we&apos;ll try to get them out tomorrow.
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center gap-3 pl-4">
              <div className="w-px h-4 bg-mise-border" />
              <span className="font-mono text-[9px] text-mise-faint tracking-wider">
                ↓
              </span>
            </div>

            {/* Agent response */}
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mise-blue/10 border border-mise-blue/20 font-mono text-[10px] font-bold text-mise-blue">
                AGENT
              </div>
              <div className="border border-mise-border rounded-xl rounded-tl-sm px-5 py-3 bg-mise-card text-sm text-mise-ink leading-relaxed max-w-md">
                Supplier confirmed.
              </div>
            </div>
          </div>

          {/* False completion */}
          <div className="problem-fail mt-8 border-2 border-mise-red/40 rounded-xl p-5 bg-mise-red-dim/50 relative">
            <div className="absolute -top-3 left-4 px-2 py-0.5 bg-mise-red text-white text-[10px] font-mono font-bold tracking-wider rounded">
              FALSE COMPLETION
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] text-mise-red tracking-wider uppercase">
                System
              </span>
              <span className="text-sm font-bold text-mise-red">
                Recovery Complete
              </span>
            </div>
            <p className="mt-2 text-xs text-mise-red/70 leading-relaxed">
              The agent transformed an ambiguous conversation into an operational
              fact. This is the problem MISE exists to solve.
            </p>
            {/* Strike-through */}
            <div className="absolute inset-0 flex items-center pointer-events-none">
              <div className="w-full h-0.5 bg-mise-red/60 -rotate-1" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
