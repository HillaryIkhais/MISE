"use client";

import { useEffect, useRef } from "react";
import { Phone, Target, Shield, ArrowRight, CheckCircle2 } from "lucide-react";

const PIPELINE_STEPS = [
  {
    icon: Phone,
    label: "PHONE CALL",
    description: "Real conversation with the responsible party.",
    color: "#c6a96b",
  },
  {
    icon: Target,
    label: "COMMITMENT",
    description: "Extract what they actually agreed to do.",
    color: "#2f6bff",
  },
  {
    icon: Shield,
    label: "EVIDENCE",
    description: "Preserve the conversation and supporting details.",
    color: "#a78bfa",
  },
  {
    icon: CheckCircle2,
    label: "DECISION",
    description: "Evaluate whether the commitment satisfies the requirement.",
    color: "#16a34a",
  },
  {
    icon: ArrowRight,
    label: "STATE CHANGE",
    description: "Only then does the workflow move.",
    color: "#16a34a",
  },
];

export function WhatMise() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const loadGSAP = async () => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        gsap.from(".what-title", {
          scrollTrigger: { trigger: ".what-title", start: "top 85%" },
          opacity: 0,
          y: 20,
          duration: 0.7,
        });

        PIPELINE_STEPS.forEach((_, i) => {
          gsap.from(`.pipeline-step-${i}`, {
            scrollTrigger: {
              trigger: `.pipeline-step-${i}`,
              start: "top 85%",
            },
            opacity: 0,
            x: -20,
            duration: 0.5,
            delay: i * 0.1,
          });
        });
      }, sectionRef);

      return () => ctx.revert();
    };
    loadGSAP();
  }, []);

  return (
    <section ref={sectionRef} id="product" className="py-24 relative">
      <div className="mx-auto max-w-5xl px-6">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-mise-blue mb-4">
          02 · What MISE Is
        </div>

        <h2 className="what-title font-display text-3xl md:text-5xl font-semibold leading-tight tracking-tight max-w-3xl">
          MISE is the boundary
          <br />
          <span className="text-mise-muted">between talk and action.</span>
        </h2>

        <p className="mt-6 text-mise-muted text-lg leading-relaxed max-w-2xl">
          Not a feature grid. One pipeline. Each stage activates sequentially.
          Each stage must pass before the next can begin.
        </p>

        {/* Pipeline */}
        <div className="mt-12 relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-mise-border" />

          <div className="space-y-1">
            {PIPELINE_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.label}
                  className={`pipeline-step-${i} flex items-start gap-5 relative`}
                >
                  {/* Node */}
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 z-10"
                    style={{
                      borderColor: step.color,
                      backgroundColor: `${step.color}15`,
                    }}
                  >
                    <Icon
                      className="w-4 h-4"
                      style={{ color: step.color }}
                    />
                  </div>

                  {/* Content */}
                  <div className="border border-mise-border rounded-xl p-5 bg-mise-surface flex-1 mb-2">
                    <div
                      className="font-mono text-[10px] tracking-[0.2em] uppercase font-bold mb-1"
                      style={{ color: step.color }}
                    >
                      {step.label}
                    </div>
                    <div className="text-sm text-mise-muted leading-relaxed">
                      {step.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-10 text-center font-display text-lg italic text-mise-muted">
          A claim can be made instantly.
          <br />
          <span className="text-mise-ink font-semibold">
            A commitment must be earned.
          </span>
        </p>
      </div>
    </section>
  );
}
