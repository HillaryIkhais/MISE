"use client";

import { useEffect, useRef } from "react";

const EXAMPLES = [
  {
    quote: "We'll try to get it out tomorrow.",
    verdict: "REJECTED",
    reason: "NO SUFFICIENT COMMITMENT",
    accepted: false,
    extractions: [],
  },
  {
    quote: "We have four units. We'll ship them.",
    verdict: "REJECTED",
    reason: "DELIVERY DEADLINE MISSING",
    accepted: false,
    extractions: [
      { label: "QUANTITY", value: "4" },
      { label: "ACTION", value: "Ship" },
    ],
  },
  {
    quote:
      "We have four units in stock. We'll ship them today. They'll arrive tomorrow before 2 PM.",
    verdict: "ACCEPTED",
    reason: "EXPLICIT COMMITMENT — ALL CONDITIONS MET",
    accepted: true,
    extractions: [
      { label: "QUANTITY", value: "4" },
      { label: "ACTION", value: "Ship" },
      { label: "SHIP DATE", value: "Today" },
      { label: "DEADLINE", value: "Tomorrow · 2:00 PM" },
    ],
  },
];

export function Boundary() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const loadGSAP = async () => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        gsap.from(".boundary-title", {
          scrollTrigger: { trigger: ".boundary-title", start: "top 85%" },
          opacity: 0,
          y: 20,
          duration: 0.7,
        });

        EXAMPLES.forEach((_, i) => {
          gsap.from(`.boundary-example-${i}`, {
            scrollTrigger: {
              trigger: `.boundary-example-${i}`,
              start: "top 85%",
            },
            opacity: 0,
            y: 20,
            duration: 0.6,
            delay: i * 0.15,
          });
        });
      }, sectionRef);

      return () => ctx.revert();
    };
    loadGSAP();
  }, []);

  return (
    <section ref={sectionRef} id="security" className="py-24 relative">
      <div className="mx-auto max-w-5xl px-6">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-mise-blue mb-4">
          04 · The Boundary
        </div>

        <h2 className="boundary-title font-display text-3xl md:text-5xl font-semibold leading-tight tracking-tight max-w-3xl">
          What MISE refuses
          <br />
          <span className="text-mise-muted">to accept.</span>
        </h2>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {EXAMPLES.map((ex, i) => (
            <div
              key={i}
              className={`boundary-example-${i} border rounded-2xl p-6 relative ${
                ex.accepted
                  ? "border-mise-green/30 bg-mise-green-dim/30"
                  : "border-mise-border bg-mise-surface"
              }`}
            >
              {/* Verdict badge */}
              <div
                className={`absolute -top-3 right-4 px-3 py-1 rounded text-[10px] font-mono font-bold tracking-wider ${
                  ex.accepted
                    ? "bg-mise-green text-white"
                    : "bg-mise-red text-white"
                }`}
              >
                {ex.verdict}
              </div>

              {/* Quote */}
              <div className="font-display text-base italic text-mise-ink leading-relaxed mb-4 mt-2">
                &ldquo;{ex.quote}&rdquo;
              </div>

              {/* Reason */}
              <div className="font-mono text-[9px] tracking-wider text-mise-muted uppercase mb-4">
                {ex.reason}
              </div>

              {/* Extracted terms */}
              {ex.extractions.length > 0 && (
                <div className="border-t border-mise-border pt-3 mt-3 space-y-2">
                  {ex.extractions.map((ext) => (
                    <div key={ext.label} className="flex justify-between items-center">
                      <span className="font-mono text-[9px] tracking-wider text-mise-faint uppercase">
                        {ext.label}
                      </span>
                      <span className="font-mono text-xs font-bold text-mise-ink">
                        {ext.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
