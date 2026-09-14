"use client";

import { useEffect, useRef } from "react";

const STEPS = [
  { num: "01", label: "TASK BLOCKED", detail: "Delivery has failed." },
  { num: "02", label: "RESPONSIBLE PARTY CONTACTED", detail: "MISE invokes CALL-E." },
  { num: "03", label: "CONVERSATION ANALYZED", detail: "The response is converted into structured commitment terms." },
  { num: "04", label: "COMMITMENT EVALUATED", detail: "MISE checks the required conditions." },
  { num: "05", label: "EVIDENCE SEALED", detail: "The decision retains the underlying call evidence." },
  { num: "06", label: "WORKFLOW ADVANCES", detail: "Only now does the operational state change." },
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const loadGSAP = async () => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        gsap.from(".hiw-title", {
          scrollTrigger: { trigger: ".hiw-title", start: "top 85%" },
          opacity: 0,
          y: 20,
          duration: 0.7,
        });

        gsap.from(".hiw-invariant", {
          scrollTrigger: { trigger: ".hiw-invariant", start: "top 80%" },
          opacity: 0,
          y: 15,
          duration: 0.6,
        });

        STEPS.forEach((_, i) => {
          gsap.from(`.hiw-step-${i}`, {
            scrollTrigger: {
              trigger: `.hiw-step-${i}`,
              start: "top 88%",
            },
            opacity: 0,
            x: i % 2 === 0 ? -15 : 15,
            duration: 0.5,
            delay: i * 0.05,
          });
        });
      }, sectionRef);

      return () => ctx.revert();
    };
    loadGSAP();
  }, []);

  return (
    <section ref={sectionRef} id="how-it-works" className="py-24 relative">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-mise-bg via-mise-surface/50 to-mise-bg pointer-events-none" />

      <div className="relative mx-auto max-w-5xl px-6">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-mise-blue mb-4">
          03 · How It Works
        </div>

        <h2 className="hiw-title font-display text-3xl md:text-5xl font-semibold leading-tight tracking-tight max-w-3xl">
          One hard rule.
        </h2>

        <div className="hiw-invariant mt-8 border border-mise-border rounded-2xl bg-mise-card p-8 max-w-2xl">
          <p className="font-display text-xl md:text-2xl leading-relaxed text-mise-ink">
            &ldquo;A conversation doesn&apos;t move the workflow.
            <br />
            <span className="text-mise-green font-semibold">
              A verified commitment does.
            </span>
            &rdquo;
          </p>
        </div>

        {/* Timeline */}
        <div className="mt-16 relative">
          {/* Vertical line */}
          <div className="absolute left-[31px] top-0 bottom-0 w-px bg-mise-border" />

          <div className="space-y-0">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className={`hiw-step-${i} flex items-start gap-6 relative`}
              >
                {/* Step number */}
                <div className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full border-2 border-mise-border bg-mise-bg z-10">
                  <span className="font-mono text-sm font-bold text-mise-muted">
                    {step.num}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 py-2">
                  <div className="font-mono text-[10px] tracking-[0.15em] uppercase font-bold text-mise-ink mb-1">
                    {step.label}
                  </div>
                  <div className="text-sm text-mise-muted leading-relaxed">
                    {step.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
