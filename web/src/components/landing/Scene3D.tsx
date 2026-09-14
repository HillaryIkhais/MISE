"use client";

import { useEffect, useRef, useState } from "react";

interface Node {
  x: number;
  y: number;
  z: number;
  r: number;
  color: string;
  label: string;
}

const NODES: Node[] = [
  { x: -2.5, y: 1.8, z: 0, r: 0.22, color: "#dc2626", label: "FAILED" },
  { x: -0.8, y: 2.2, z: 0.5, r: 0.18, color: "#c6a96b", label: "CALL" },
  { x: 1.0, y: 1.6, z: -0.3, r: 0.20, color: "#2f6bff", label: "COMMIT" },
  { x: 2.8, y: 2.0, z: 0, r: 0.22, color: "#16a34a", label: "RECOVERED" },
];

export function Scene3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ w: 0, h: 0 });

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

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      setDimensions({ w: rect.width, h: rect.height });
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const proj = (p: { x: number; y: number; z: number }) => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const eye = {
        x: 9 * Math.sin(yaw) * Math.cos(pitch),
        y: 9 * Math.sin(pitch),
        z: 9 * Math.cos(yaw) * Math.cos(pitch),
      };
      const dx = p.x - eye.x;
      const dy = p.y - eye.y;
      const dz = p.z - eye.z;
      const cz = -Math.sin(yaw) * Math.cos(pitch) * dx + Math.sin(pitch) * dy - Math.cos(yaw) * Math.cos(pitch) * dz;
      if (cz <= 0.1) return null;
      const f = w * 0.85;
      const cx = (Math.cos(yaw) * dx - Math.sin(yaw) * dz) * f / cz;
      const cy = (Math.sin(yaw) * Math.sin(pitch) * dx + Math.cos(pitch) * dy - Math.cos(yaw) * Math.sin(pitch) * dz) * f / cz;
      return { x: w / 2 + cx, y: h / 2 - cy, z: cz };
    };

    const drawSphere = (c: { x: number; y: number; z: number }, r: number, col: string, glow: number) => {
      const p = proj(c);
      if (!p) return;
      const sz = r * (canvas.width / dpr) * 0.85 / p.z;
      if (sz < 1) return;

      if (glow > 0) {
        ctx.save();
        ctx.shadowBlur = glow;
        ctx.shadowColor = col;
        const g = ctx.createRadialGradient(p.x - sz * 0.2, p.y - sz * 0.2, 0, p.x, p.y, sz * 1.5);
        g.addColorStop(0, col);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, sz * 1.5, 0, 7);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      const g = ctx.createRadialGradient(p.x - sz * 0.25, p.y - sz * 0.25, 0, p.x, p.y, sz);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.3, col);
      g.addColorStop(1, "rgba(0,0,0,0.15)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, sz, 0, 7);
      ctx.fill();
    };

    const drawLine = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, col: string) => {
      const pa = proj(a);
      const pb = proj(b);
      if (!pa || !pb) return;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    };

    const drawRing = (c: { x: number; y: number; z: number }, rad: number, col: string) => {
      const pts: { x: number; y: number; z: number }[] = [];
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        pts.push({
          x: c.x + Math.cos(a) * rad,
          y: c.y,
          z: c.z + Math.sin(a) * rad,
        });
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      for (const pt of pts) {
        const p = proj(pt);
        if (!p) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    };

    const render = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      // Floor grid
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 0.5;
      for (let i = -6; i <= 6; i += 2) {
        const a = proj({ x: i, y: 0, z: 6 });
        const b = proj({ x: i, y: 0, z: -6 });
        const c = proj({ x: 6, y: 0, z: i });
        const d = proj({ x: -6, y: 0, z: i });
        if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        if (c && d) { ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke(); }
      }

      // Connections
      for (let i = 0; i < NODES.length - 1; i++) {
        drawLine(NODES[i], NODES[i + 1], "rgba(255,255,255,0.06)");
      }

      // Animated pulse
      const pulseT = (time * 0.3) % 1;
      const seg = Math.floor(pulseT * 3);
      const lt = (pulseT * 3) % 1;
      if (seg < NODES.length - 1) {
        const from = NODES[seg];
        const to = NODES[seg + 1];
        const pp = {
          x: from.x + (to.x - from.x) * lt,
          y: from.y + (to.y - from.y) * lt + Math.sin(lt * Math.PI) * 0.3,
          z: from.z + (to.z - from.z) * lt,
        };
        drawSphere(pp, 0.08, "#2f6bff", 20);
      }

      // Rings
      NODES.forEach((n, i) => {
        const pulse = Math.sin(time * 2 + i * 1.5) * 0.05 + 0.35;
        drawRing({ x: n.x, y: n.y, z: n.z }, pulse, n.color + "40");
      });

      // Nodes
      NODES.forEach((n, i) => {
        const glow = Math.sin(time * 2.5 + i) * 4 + 12;
        drawSphere({ x: n.x, y: n.y, z: n.z }, n.r, n.color, glow);
      });

      // Center gate
      const gateY = 1.8 + Math.sin(time * 0.8) * 0.15;
      const gatePulse = Math.sin(time * 3) * 0.04 + 0.28;
      drawRing({ x: 0, y: gateY, z: 0 }, gatePulse, "#2f6bff40");
      drawRing({ x: 0, y: gateY, z: 0 }, gatePulse + 0.12, "rgba(47,107,255,0.15)");
      drawSphere({ x: 0, y: gateY, z: 0 }, 0.12, "#2f6bff", 25);
    };

    const loop = () => {
      time += 0.016;
      render();
      animId = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener("resize", resize);

    canvas.parentElement?.addEventListener("mousemove", (e) => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      yaw = 0.4 + ((e.clientX - rect.left) / rect.width - 0.5) * 1.0;
      pitch = 0.35 + ((e.clientY - rect.top) / rect.height - 0.5) * -0.4;
    });

    loop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
