import React, { useEffect, useRef, useState } from "react";

/**
 * DarpanMirror3D — Ultra-lightweight interactive 3D Geometric Mind Mirror
 * 
 * Performance & Low-RAM Features:
 * - Pure native HTML5 Canvas mathematical 3D projection (0 external libraries, < 2MB RAM).
 * - Automatic low-spec device detection (hardwareConcurrency < 4 or mobile).
 * - Adaptive particle/vertex count (40 on desktop, 20 on low-spec/mobile).
 * - IntersectionObserver: Automatically stops requestAnimationFrame when scrolled out of view.
 * - Smooth mouse & touch drag 3D rotation.
 * - Gentle ambient idle rotation.
 */
export default function DarpanMirror3D({ className = "" }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Detect device performance capability
    const isMobile = window.innerWidth < 768 || "ontouchstart" in window;
    const isLowPower = (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) || isMobile;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 340);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 340);

    // 3D rotation angles & velocities
    let rotX = 0.2;
    let rotY = 0;
    let targetRotX = 0.2;
    let targetRotY = 0;
    let autoSpeed = 0.004;

    let isVisible = true;
    let animId = null;

    // ── Generate 3D Geodesic Fibonacci Sphere Vertices ──
    const vertexCount = isLowPower ? 22 : 38;
    const radius = Math.min(width, height) * 0.36;
    const vertices = [];

    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle
    for (let i = 0; i < vertexCount; i++) {
      const y = 1 - (i / (vertexCount - 1)) * 2; // y goes from 1 to -1
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      // Mood nodes on selected vertices
      let label = null;
      let color = "#C8A97E"; // Gold default
      if (i === 3) { label = "Calm 😌"; color = "#A8C87E"; }
      if (i === 8) { label = "Clarity ✨"; color = "#7EB8C8"; }
      if (i === 14) { label = "Peace 🍃"; color = "#A8C87E"; }
      if (i === 20) { label = "Hope 🌱"; color = "#C8A97E"; }

      vertices.push({
        origX: x * radius,
        origY: y * radius,
        origZ: z * radius,
        label,
        color,
        size: label ? (isLowPower ? 3.5 : 4.5) : (isLowPower ? 2 : 2.5),
      });
    }

    // ── Precompute edges between closest neighbors ──
    const edges = [];
    const maxDist = radius * (isLowPower ? 0.9 : 0.8);
    for (let i = 0; i < vertices.length; i++) {
      for (let j = i + 1; j < vertices.length; j++) {
        const dx = vertices[i].origX - vertices[j].origX;
        const dy = vertices[i].origY - vertices[j].origY;
        const dz = vertices[i].origZ - vertices[j].origZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < maxDist) {
          edges.push([i, j, dist / maxDist]);
        }
      }
    }

    // ── Resize handler ──
    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener("resize", handleResize);

    // ── Interactive Mouse / Touch rotation ──
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    const onPointerDown = (e) => {
      isDragging = true;
      startX = e.clientX || e.touches?.[0]?.clientX || 0;
      startY = e.clientY || e.touches?.[0]?.clientY || 0;
    };

    const onPointerMove = (e) => {
      const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
      const clientY = e.clientY || e.touches?.[0]?.clientY || 0;

      if (isDragging) {
        const dx = clientX - startX;
        const dy = clientY - startY;
        targetRotY += dx * 0.007;
        targetRotX += dy * 0.007;
        startX = clientX;
        startY = clientY;
      } else {
        // Subtle hover tilt
        const rect = canvas.getBoundingClientRect();
        const normX = (clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        const normY = (clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        targetRotY += normX * 0.001;
        targetRotX += normY * 0.001;
      }
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    canvas.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);

    canvas.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    window.addEventListener("touchend", onPointerUp, { passive: true });

    // ── IntersectionObserver — Pauses render loop when scrolled off-screen ──
    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0].isIntersecting;
        if (isVisible && !animId) render();
      },
      { threshold: 0.05 }
    );
    if (containerRef.current) observer.observe(containerRef.current);

    // ── 3D Render Loop ──
    const fov = 400; // perspective depth
    const cx = width / 2;
    const cy = height / 2;

    const render = () => {
      if (!isVisible) {
        animId = null;
        return;
      }

      // Smooth damped rotation interpolation
      rotX += (targetRotX - rotX) * 0.06;
      rotY += (targetRotY - rotY) * 0.06;
      targetRotY += autoSpeed; // ambient constant rotation

      ctx.clearRect(0, 0, width, height);

      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);

      // Project vertices to 2D
      const projected = [];
      for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];

        // Rotate Y
        let x1 = v.origX * cosY - v.origZ * sinY;
        let z1 = v.origZ * cosY + v.origX * sinY;

        // Rotate X
        let y2 = v.origY * cosX - z1 * sinX;
        let z2 = z1 * cosX + v.origY * sinX;

        // Perspective projection
        const scale = fov / (fov + z2 + radius);
        const px = cx + x1 * scale;
        const py = cy + y2 * scale;
        const alpha = Math.max(0.15, Math.min(1, (z2 + radius) / (radius * 2)));

        projected.push({
          px,
          py,
          scale,
          alpha,
          z: z2,
          color: v.color,
          label: v.label,
          size: v.size * scale,
        });
      }

      // ── Draw Edges ──
      ctx.lineWidth = 1;
      for (let i = 0; i < edges.length; i++) {
        const [idx1, idx2, distRatio] = edges[i];
        const p1 = projected[idx1];
        const p2 = projected[idx2];

        const avgAlpha = ((p1.alpha + p2.alpha) / 2) * (1 - distRatio * 0.7) * 0.4;
        if (avgAlpha > 0.04) {
          ctx.strokeStyle = `rgba(200, 169, 126, ${avgAlpha.toFixed(2)})`;
          ctx.beginPath();
          ctx.moveTo(p1.px, p1.py);
          ctx.lineTo(p2.px, p2.py);
          ctx.stroke();
        }
      }

      // Sort points back-to-front for proper depth drawing
      const sortedPoints = [...projected].sort((a, b) => a.z - b.z);

      // ── Draw Vertices & Labels ──
      for (let i = 0; i < sortedPoints.length; i++) {
        const p = sortedPoints[i];

        // Outer glow on front-facing nodes
        if (p.label && p.alpha > 0.4 && !isLowPower) {
          ctx.fillStyle = `rgba(200, 169, 126, ${((p.alpha - 0.4) * 0.25).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(p.px, p.py, p.size * 3.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Vertex Dot
        ctx.fillStyle = p.label ? p.color : `rgba(200, 169, 126, ${p.alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(p.px, p.py, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Node Label
        if (p.label && p.alpha > 0.45) {
          ctx.font = `${Math.round(9 * p.scale)}px "DM Mono", monospace`;
          ctx.fillStyle = `rgba(232, 228, 220, ${(p.alpha * 0.9).toFixed(2)})`;
          ctx.textAlign = "center";
          ctx.fillText(p.label, p.px, p.py - p.size - 6);
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      canvas.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("touchend", onPointerUp);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative flex flex-col items-center justify-center select-none ${className}`}
    >
      {/* Ambient Radial Under-Glow */}
      <div className="absolute inset-0 bg-radial-gradient from-[#C8A97E]/10 via-[#7EB8C8]/5 to-transparent blur-2xl pointer-events-none rounded-full" />

      {/* 3D Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none transition-transform duration-300"
        style={{ maxWidth: "380px", maxHeight: "380px" }}
      />

      {/* Subtle Interaction Hint */}
      <div className="absolute -bottom-2 font-mono text-[9px] tracking-[0.25em] uppercase text-[#8A8580] opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1.5 pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-[#C8A97E] animate-pulse" />
        <span>3D Mind Mirror · Drag to rotate</span>
      </div>
    </div>
  );
}
