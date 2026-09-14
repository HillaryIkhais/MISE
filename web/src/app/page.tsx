"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

/* ══════════════ 3D SUPPLY CHAIN CONSTELLATION ══════════════ */
function Scene3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let animId: number;
    let time = 0;
    let yaw = 0.4;
    let pitch = 0.35;
    const center = { x: 0, y: 1.8, z: 0 };

    const nodes = [
      { x: -2.5, y: 1.8, z: 0, r: 0.22, color: "#dc2626", label: "FAILED" },
      { x: -0.8, y: 2.2, z: 0.5, r: 0.18, color: "#c6a96b", label: "CALL" },
      { x: 1.0, y: 1.6, z: -0.3, r: 0.20, color: "#2f6bff", label: "COMMIT" },
      { x: 2.8, y: 2.0, z: 0, r: 0.22, color: "#16a34a", label: "RECOVERED" },
    ];

    function resize() {
      const r = canvas!.parentElement!.getBoundingClientRect();
      canvas!.width = r.width * dpr;
      canvas!.height = r.height * dpr;
      canvas!.style.width = r.width + "px";
      canvas!.style.height = r.height + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function proj(p: { x: number; y: number; z: number }) {
      const w = canvas!.width / dpr;
      const h = canvas!.height / dpr;
      const eye = {
        x: center.x + 9 * Math.sin(yaw) * Math.cos(pitch),
        y: center.y + 9 * Math.sin(pitch),
        z: center.z + 9 * Math.cos(yaw) * Math.cos(pitch),
      };
      const dx = p.x - eye.x;
      const dy = p.y - eye.y;
      const dz = p.z - eye.z;
      const cz =
        -Math.sin(yaw) * Math.cos(pitch) * dx +
        Math.sin(pitch) * dy -
        Math.cos(yaw) * Math.cos(pitch) * dz;
      if (cz <= 0.1) return null;
      const f = w * 0.85;
      const cx =
        (Math.cos(yaw) * dx - Math.sin(yaw) * dz) * f / cz;
      const cy =
        (Math.sin(yaw) * Math.sin(pitch) * dx +
          Math.cos(pitch) * dy -
          Math.cos(yaw) * Math.sin(pitch) * dz) *
        f / cz;
      return { x: w / 2 + cx, y: h / 2 - cy, z: cz };
    }

    function drawSphere(
      c: { x: number; y: number; z: number },
      r: number,
      col: string,
      glow: number
    ) {
      const p = proj(c);
      if (!p) return;
      const sz = (r * (canvas!.width / dpr) * 0.85) / p.z;
      if (sz < 1) return;
      if (glow > 0) {
        ctx!.save();
        ctx!.shadowBlur = glow;
        ctx!.shadowColor = col;
        const g = ctx!.createRadialGradient(
          p.x - sz * 0.2,
          p.y - sz * 0.2,
          0,
          p.x,
          p.y,
          sz * 1.5
        );
        g.addColorStop(0, col);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx!.fillStyle = g;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, sz * 1.5, 0, 7);
        ctx!.fill();
        ctx!.shadowBlur = 0;
        ctx!.restore();
      }
      const g = ctx!.createRadialGradient(
        p.x - sz * 0.25,
        p.y - sz * 0.25,
        0,
        p.x,
        p.y,
        sz
      );
      g.addColorStop(0, "#fff");
      g.addColorStop(0.3, col);
      g.addColorStop(1, "rgba(0,0,0,0.15)");
      ctx!.fillStyle = g;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, sz, 0, 7);
      ctx!.fill();
    }

    function drawLine(
      a: { x: number; y: number; z: number },
      b: { x: number; y: number; z: number },
      col: string
    ) {
      const pa = proj(a);
      const pb = proj(b);
      if (!pa || !pb) return;
      ctx!.strokeStyle = col;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(pa.x, pa.y);
      ctx!.lineTo(pb.x, pb.y);
      ctx!.stroke();
    }

    function drawRing(
      c: { x: number; y: number; z: number },
      rad: number,
      col: string
    ) {
      const pts: { x: number; y: number; z: number }[] = [];
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        pts.push({
          x: c.x + Math.cos(a) * rad,
          y: c.y,
          z: c.z + Math.sin(a) * rad,
        });
      }
      ctx!.strokeStyle = col;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      let started = false;
      for (const pt of pts) {
        const p = proj(pt);
        if (!p) {
          started = false;
          continue;
        }
        if (!started) {
          ctx!.moveTo(p.x, p.y);
          started = true;
        } else ctx!.lineTo(p.x, p.y);
      }
      ctx!.stroke();
    }

    function render() {
      const w = canvas!.width / dpr;
      const h = canvas!.height / dpr;
      ctx!.clearRect(0, 0, w, h);

      // Floor grid
      ctx!.strokeStyle = "rgba(255,255,255,0.025)";
      ctx!.lineWidth = 0.5;
      for (let i = -6; i <= 6; i += 2) {
        const a = proj({ x: i, y: 0, z: 6 });
        const b = proj({ x: i, y: 0, z: -6 });
        const c2 = proj({ x: 6, y: 0, z: i });
        const d = proj({ x: -6, y: 0, z: i });
        if (a && b) {
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }
        if (c2 && d) {
          ctx!.beginPath();
          ctx!.moveTo(c2.x, c2.y);
          ctx!.lineTo(d.x, d.y);
          ctx!.stroke();
        }
      }

      // Connections
      for (let i = 0; i < nodes.length - 1; i++) {
        drawLine(nodes[i], nodes[i + 1], "rgba(255,255,255,0.06)");
      }

      // Animated pulse
      const pulseT = (time * 0.3) % 1;
      const seg = Math.floor(pulseT * 3);
      const lt = (pulseT * 3) % 1;
      if (seg < nodes.length - 1) {
        const from = nodes[seg];
        const to = nodes[seg + 1];
        const pp = {
          x: from.x + (to.x - from.x) * lt,
          y: from.y + (to.y - from.y) * lt + Math.sin(lt * Math.PI) * 0.3,
          z: from.z + (to.z - from.z) * lt,
        };
        drawSphere(pp, 0.08, "#2f6bff", 20);
      }

      // Second pulse offset
      const pulseT2 = ((time * 0.3) + 0.5) % 1;
      const seg2 = Math.floor(pulseT2 * 3);
      const lt2 = (pulseT2 * 3) % 1;
      if (seg2 < nodes.length - 1) {
        const from2 = nodes[seg2];
        const to2 = nodes[seg2 + 1];
        const pp2 = {
          x: from2.x + (to2.x - from2.x) * lt2,
          y: from2.y + (to2.y - from2.y) * lt2 + Math.sin(lt2 * Math.PI) * 0.3,
          z: from2.z + (to2.z - from2.z) * lt2,
        };
        drawSphere(pp2, 0.06, "rgba(47,107,255,0.5)", 12);
      }

      // Rings
      nodes.forEach((n, i) => {
        const pulse = Math.sin(time * 2 + i * 1.5) * 0.05 + 0.35;
        drawRing({ x: n.x, y: n.y, z: n.z }, pulse, n.color + "40");
      });

      // Nodes
      nodes.forEach((n, i) => {
        const glow = Math.sin(time * 2.5 + i) * 4 + 12;
        drawSphere({ x: n.x, y: n.y, z: n.z }, n.r, n.color, glow);
      });

      // Center gate
      const gateY = 1.8 + Math.sin(time * 0.8) * 0.15;
      const gatePulse = Math.sin(time * 3) * 0.04 + 0.28;
      drawRing({ x: 0, y: gateY, z: 0 }, gatePulse, "#2f6bff40");
      drawRing(
        { x: 0, y: gateY, z: 0 },
        gatePulse + 0.12,
        "rgba(47,107,255,0.15)"
      );
      drawSphere({ x: 0, y: gateY, z: 0 }, 0.12, "#2f6bff", 25);

      // Node labels
      nodes.forEach((n) => {
        const p = proj({ x: n.x, y: n.y - 0.4, z: n.z });
        if (!p) return;
        ctx!.font = `bold 9px 'JetBrains Mono', monospace`;
        ctx!.fillStyle = n.color;
        ctx!.textAlign = "center";
        ctx!.fillText(n.label, p.x, p.y);
      });
    }

    const loop = () => {
      time += 0.016;
      render();
      animId = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener("resize", resize);

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas!.parentElement!.getBoundingClientRect();
      yaw = 0.4 + ((e.clientX - rect.left) / rect.width - 0.5) * 1.2;
      pitch = 0.35 + ((e.clientY - rect.top) / rect.height - 0.5) * -0.5;
    };
    canvas!.parentElement!.addEventListener("mousemove", handleMouse);

    loop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
}

/* ══════════════ GSAP SCROLL ANIMATIONS ══════════════ */
function useScrollReveal(selector: string, stagger = 0) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ctx: ReturnType<typeof import("gsap").default.context> | null = null;

    const load = async () => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      if (!ref.current) return;

      const elements = ref.current.querySelectorAll(selector);
      if (!elements.length) return;

      ctx = gsap.context(() => {
        gsap.from(elements, {
          scrollTrigger: {
            trigger: ref.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
          opacity: 0,
          y: 30,
          duration: 0.8,
          stagger,
          ease: "power3.out",
        });
      }, ref);
    };

    load();
    return () => ctx?.revert();
  }, [selector, stagger]);

  return ref;
}

/* ══════════════ PAGE ══════════════ */
export default function Home() {
  const heroRef = useScrollReveal("[data-reveal]", 0.1);
  const problemRef = useScrollReveal("[data-reveal]", 0.1);
  const productRef = useScrollReveal("[data-reveal]", 0.12);
  const howRef = useScrollReveal("[data-reveal]", 0.08);
  const boundaryRef = useScrollReveal("[data-reveal]", 0.15);

  return (
    <main>
      {/* NAV */}
      <nav className="nav">
        <Link href="/" className="nav-logo">
          <span className="nav-logo-dot" />
          <span>MISE</span>
        </Link>
        <div className="nav-links">
          <a href="#product">Product</a>
          <a href="#how-it-works">How It Works</a>
          <Link href="/demo">Demo</Link>
          <a href="#security">Security</a>
        </div>
        <div className="nav-right">
          <a href="https://github.com/HillaryIkhais/MISE" target="_blank" rel="noopener noreferrer">GitHub</a>
          <Link href="/demo">
            <button className="btn-primary">Open MISE</button>
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero-section" ref={heroRef}>
        <div className="hero-glow-1" />
        <div className="hero-glow-2" />
        <div className="hero-inner">
          <div>
            <div data-reveal className="hero-eyebrow">
              <span className="hero-eyebrow-dot" />
              Incident #1842 · Critical Delivery · Case Live
            </div>
            <h1 data-reveal className="hero-title">
              Don&apos;t let <span className="blue">&quot;maybe&quot;</span>
              <br />
              become <span className="muted">&quot;done.&quot;</span>
            </h1>
            <p data-reveal className="hero-sub">
              MISE gives autonomous agents a hard boundary between conversation
              and operational reality. A real-world task moves only when the
              responsible party makes a <strong>verified commitment</strong>.
            </p>
            <div data-reveal className="hero-cta">
              <Link href="/demo">
                <button className="btn-primary" style={{ padding: "14px 32px", fontSize: 15 }}>
                  Open Live Demo →
                </button>
              </Link>
              <a href="#how-it-works">
                <button className="btn-secondary">How It Works</button>
              </a>
            </div>
          </div>

          {/* HERO CARD */}
          <div data-reveal className="hero-card">
            <div className="hero-card-bar">
              <span className="hero-card-bar-label">Operational Status</span>
              <span className="hero-card-bar-status">
                <span className="dot" />
                BLOCKED
              </span>
            </div>
            <div className="hero-card-id">Incident #1842</div>
            <div className="hero-card-name">Critical Delivery Recovery</div>
            <div className="hero-card-grid">
              <div className="hero-card-cell">
                <div className="hero-card-cell-label">Required</div>
                <div className="hero-card-cell-value">4 Units</div>
              </div>
              <div className="hero-card-cell">
                <div className="hero-card-cell-label">Deadline</div>
                <div className="hero-card-cell-value">Tomorrow · 2:00 PM</div>
              </div>
              <div className="hero-card-cell">
                <div className="hero-card-cell-label">Supplier</div>
                <div className="hero-card-cell-value">Torque Precision</div>
              </div>
              <div className="hero-card-cell">
                <div className="hero-card-cell-label">Next Action</div>
                <div className="hero-card-cell-value blue">Call Supplier</div>
              </div>
            </div>
            <div className="hero-card-flow">
              <span className="active-red">DELIVERY FAILED</span>
              <span className="arrow">→</span>
              <span className="active-wheat">SUPPLIER CONTACT REQUIRED</span>
              <span className="arrow">→</span>
              <span className="dim">COMMITMENT ACCEPTED</span>
              <span className="arrow">→</span>
              <span className="dim">RECOVERY COMMITTED</span>
            </div>
            <div className="hero-card-phone">
              <div className="hero-card-phone-icon">📞</div>
              <div className="hero-card-phone-text">
                <div className="label">CALL-E Ready</div>
                <div className="sub">Outbound call · Torque Precision</div>
              </div>
              <div className="hero-card-phone-status">
                <span className="dot" />
                CONNECTING
              </div>
            </div>
          </div>
        </div>

        {/* 3D Scene */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            width: "50%",
            height: "100%",
            opacity: 0.6,
            pointerEvents: "none",
          }}
        >
          <Scene3D />
        </div>
      </section>

      {/* PROBLEM */}
      <section className="section" id="problem" ref={problemRef}>
        <div data-reveal className="section-kicker">01 · The Problem</div>
        <h2 data-reveal className="section-title">
          The problem isn&apos;t the call.
          <br />
          <span className="muted">It&apos;s what happens after it.</span>
        </h2>
        <p data-reveal className="section-text">
          Autonomous agents increasingly interact with the physical world. They
          call suppliers, contact vendors, coordinate services, and recover from
          operational failures. But conversation creates ambiguity.
        </p>
        <div data-reveal className="problem-box">
          <div className="problem-msg">
            <div className="avatar agent">AGENT</div>
            <div className="bubble">We need four units delivered by tomorrow at 2 PM.</div>
          </div>
          <div className="problem-arrow">↓</div>
          <div className="problem-msg">
            <div className="avatar supplier">SUPPLIER</div>
            <div className="bubble">Yeah, we&apos;ll try to get them out tomorrow.</div>
          </div>
          <div className="problem-arrow">↓</div>
          <div className="problem-msg">
            <div className="avatar agent">AGENT</div>
            <div className="bubble">Supplier confirmed.</div>
          </div>
          <div className="problem-fail">
            <div className="problem-fail-badge">FALSE COMPLETION</div>
            <div className="strike" />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#dc2626", letterSpacing: "0.15em", textTransform: "uppercase" as const, marginBottom: 8 }}>
                System: Recovery Complete
              </div>
              <p style={{ fontSize: 12, color: "rgba(220,38,38,0.7)", lineHeight: 1.5 }}>
                The agent transformed an ambiguous conversation into an operational fact.
                This is the problem MISE exists to solve.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT MISE IS */}
      <section className="section" id="product" ref={productRef}>
        <div data-reveal className="section-kicker">02 · What MISE Is</div>
        <h2 data-reveal className="section-title">
          MISE is the boundary
          <br />
          <span className="muted">between talk and action.</span>
        </h2>
        <p data-reveal className="section-text">
          Not a feature grid. One pipeline. Each stage activates sequentially.
          Each stage must pass before the next can begin.
        </p>
        <div className="pipeline">
          <div className="pipeline-line" />
          {[
            { label: "PHONE CALL", desc: "Real conversation with the responsible party.", color: "#c6a96b" },
            { label: "COMMITMENT", desc: "Extract what they actually agreed to do.", color: "#2f6bff" },
            { label: "EVIDENCE", desc: "Preserve the conversation and supporting details.", color: "#a78bfa" },
            { label: "DECISION", desc: "Evaluate whether the commitment satisfies the requirement.", color: "#16a34a" },
            { label: "STATE CHANGE", desc: "Only then does the workflow move.", color: "#16a34a" },
          ].map((step) => (
            <div data-reveal key={step.label} className="pipeline-step">
              <div className="pipeline-node" style={{ borderColor: step.color, background: `${step.color}15` }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={step.color} strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  {step.label === "PHONE CALL" && <path d="M13.832 16.568a1 1 0 001.213-.303l.355-.465A2 2 0 0117 15h3a2 2 0 012 2v3a2 2 0 01-2 2A18 18 0 012 4a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-.8 1.6l-.468.351a1 1 0 00-.292 1.233 14 14 0 006.392 6.384" />}
                  {step.label === "COMMITMENT" && <><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>}
                  {step.label === "EVIDENCE" && <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 01-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 011-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 011.52 0C14.51 3.81 17 5 19 5a1 1 0 011 1z" />}
                  {step.label === "DECISION" && <path d="m16 9-5.5 5.5L8 12" />}
                  {step.label === "STATE CHANGE" && <path d="M5 12h14m-7-7l7 7-7 7" />}
                </svg>
              </div>
              <div className="pipeline-content">
                <div className="pipeline-label" style={{ color: step.color }}>{step.label}</div>
                <div className="pipeline-desc">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 36, textAlign: "center", fontFamily: "'Fraunces', serif", fontSize: 18, fontStyle: "italic", color: "#7c7a72" }}>
          A claim can be made instantly.<br />
          <span style={{ color: "#e8e6e1", fontWeight: 700 }}>A commitment must be earned.</span>
        </p>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" id="how-it-works" ref={howRef}>
        <div data-reveal className="section-kicker">03 · How It Works</div>
        <h2 data-reveal className="section-title">One hard rule.</h2>
        <div data-reveal className="invariant">
          <p>
            &ldquo;A conversation doesn&apos;t move the workflow.
            <br />
            <span className="green">A verified commitment does.</span>&rdquo;
          </p>
        </div>
        <div className="timeline">
          <div className="timeline-line" />
          {[
            { num: "01", label: "TASK BLOCKED", desc: "Delivery has failed." },
            { num: "02", label: "RESPONSIBLE PARTY CONTACTED", desc: "MISE invokes CALL-E." },
            { num: "03", label: "CONVERSATION ANALYZED", desc: "The response is converted into structured commitment terms." },
            { num: "04", label: "COMMITMENT EVALUATED", desc: "MISE checks the required conditions." },
            { num: "05", label: "EVIDENCE SEALED", desc: "The decision retains the underlying call evidence." },
            { num: "06", label: "WORKFLOW ADVANCES", desc: "Only now does the operational state change." },
          ].map((s) => (
            <div data-reveal key={s.num} className="timeline-step">
              <div className="timeline-num">{s.num}</div>
              <div className="timeline-content">
                <div className="timeline-label">{s.label}</div>
                <div className="timeline-desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* BOUNDARY */}
      <section className="section" id="security" ref={boundaryRef}>
        <div data-reveal className="section-kicker">04 · The Boundary</div>
        <h2 data-reveal className="section-title">
          What MISE refuses
          <br />
          <span className="muted">to accept.</span>
        </h2>
        <div className="boundary-grid">
          {[
            {
              quote: "We'll try to get it out tomorrow.",
              reason: "NO SUFFICIENT COMMITMENT",
              accepted: false,
              terms: [],
            },
            {
              quote: "We have four units. We'll ship them.",
              reason: "DELIVERY DEADLINE MISSING",
              accepted: false,
              terms: [
                { k: "QUANTITY", v: "4" },
                { k: "ACTION", v: "Ship" },
              ],
            },
            {
              quote: "We have four units in stock. We'll ship them today. They'll arrive tomorrow before 2 PM.",
              reason: "EXPLICIT COMMITMENT — ALL CONDITIONS MET",
              accepted: true,
              terms: [
                { k: "QUANTITY", v: "4" },
                { k: "ACTION", v: "Ship" },
                { k: "SHIP DATE", v: "Today" },
                { k: "DEADLINE", v: "Tomorrow · 2:00 PM" },
              ],
            },
          ].map((ex) => (
            <div data-reveal key={ex.reason} className={`boundary-card ${ex.accepted ? "accepted" : ""}`}>
              <div className={`boundary-badge ${ex.accepted ? "accepted" : "rejected"}`}>
                {ex.accepted ? "ACCEPTED" : "REJECTED"}
              </div>
              <div className="boundary-quote">&ldquo;{ex.quote}&rdquo;</div>
              <div className="boundary-reason">{ex.reason}</div>
              {ex.terms.length > 0 && (
                <div className="boundary-terms">
                  {ex.terms.map((t) => (
                    <div key={t.k} className="boundary-term">
                      <span className="k">{t.k}</span>
                      <span className="v">{t.v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ENTER */}
      <section className="enter-section">
        <div className="section-kicker" style={{ color: "#c6a96b" }}>05 · Enter the Real Product</div>
        <h2 className="section-title" style={{ margin: "0 auto" }}>
          Enough explanation.
          <br />
          <span className="muted">Watch it work.</span>
        </h2>
        <div style={{ marginTop: 36, position: "relative", zIndex: 1 }}>
          <Link href="/demo">
            <button className="btn-primary" style={{ padding: "14px 32px", fontSize: 15 }}>
              Open Incident #1842 →
            </button>
          </Link>
        </div>
        <p style={{ marginTop: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#4a4940", letterSpacing: "0.1em", position: "relative", zIndex: 1 }}>
          The marketing UI transitions into the actual application.
        </p>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="nav-logo">
          <span className="nav-logo-dot" style={{ width: 8, height: 8 }} />
          <span style={{ fontSize: 12 }}>MISE</span>
        </div>
        <p>CALL-E makes the calls. MISE decides when the work is allowed to move.</p>
      </footer>
    </main>
  );
}
