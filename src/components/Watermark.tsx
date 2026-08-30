/* ============================================
   WATERMARK
   A living signature mark, not a static logo.
   Particles orbit loosely at rest, then converge
   into a "QF" monogram on hover/focus/touch.
   Color is driven continuously by real sun
   altitude — the mark itself tells you something
   true about the moment, it doesn't just sit there.

   Technique: render "QF" to an offscreen canvas,
   sample its pixel alpha to derive target points,
   then spring-animate a particle field toward
   those points. No image assets, no icon fonts —
   every pixel here is computed.
============================================ */
import { useEffect, useRef, useCallback } from 'react';

interface WatermarkProps {
  sunAltitude: number; // radians — drives the color mood
}

interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  orbitAngle: number;
  orbitRadius: number;
  orbitSpeed: number;
  size: number;
  twinklePhase: number;
}

const WIDTH = 120;
const HEIGHT = 48;
const PARTICLE_COUNT = 260;

// Samples "QF" rendered to an offscreen canvas and returns a set of
// {x, y} points wherever glyph opacity is high enough — this is what
// lets particles converge into crisp, real letterforms instead of a
// hand-tuned blob of coordinates.
function sampleGlyphPoints(): { x: number; y: number }[] {
  const off = document.createElement('canvas');
  off.width = WIDTH;
  off.height = HEIGHT;
  const ctx = off.getContext('2d');
  if (!ctx) return [];

  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#fff';
  ctx.font = '600 34px Georgia, "Times New Roman", serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText('QF', WIDTH / 2, HEIGHT / 2 + 2);

  const { data } = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  const points: { x: number; y: number }[] = [];

  // Subsample on a grid rather than every opaque pixel — keeps the
  // particle count reasonable while still reading as solid letterforms.
  for (let y = 0; y < HEIGHT; y += 2) {
    for (let x = 0; x < WIDTH; x += 2) {
      const alpha = data[(y * WIDTH + x) * 4 + 3];
      if (alpha > 120) points.push({ x, y });
    }
  }
  return points;
}

// Mirrors the color logic in sky.frag.glsl so the watermark and the
// actual sky always agree on what "the current light" looks like.
function sunColor(sunAltitude: number): string {
  const dayFactor = Math.max(0, Math.min(1, (sunAltitude + 0.15) / 0.4));
  const twilight = 1 - Math.max(0, Math.min(1, Math.abs(sunAltitude) / 0.25));

  const night: [number, number, number] = [120, 140, 220];
  const day: [number, number, number] = [255, 235, 190];
  const dusk: [number, number, number] = [255, 160, 110];

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  let r = lerp(night[0], day[0], dayFactor);
  let g = lerp(night[1], day[1], dayFactor);
  let b = lerp(night[2], day[2], dayFactor);

  r = lerp(r, dusk[0], twilight * 0.6);
  g = lerp(g, dusk[1], twilight * 0.6);
  b = lerp(b, dusk[2], twilight * 0.6);

  return `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`;
}

export default function Watermark({ sunAltitude }: WatermarkProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const convergenceRef = useRef(0); // 0 = scattered, 1 = fully converged
  const hoveredRef = useRef(false);
  const rafRef = useRef(0);
  const colorRef = useRef(sunColor(sunAltitude));

  // Keep the latest sun color available inside the animation loop
  // without re-running particle setup on every altitude change.
  useEffect(() => {
    colorRef.current = sunColor(sunAltitude);
  }, [sunAltitude]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const targets = sampleGlyphPoints();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Build the particle field. Some particles get a real letterform
    // target; any excess (or shortfall) just orbits with no target,
    // which reads as ambient sparkle around the mark rather than a
    // hard edge where "the logo" stops and "decoration" begins.
    const particles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const target = targets[i % targets.length] ?? { x: WIDTH / 2, y: HEIGHT / 2 };
      const jitter = i < targets.length ? 0 : 1;
      particles.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        targetX: target.x + (jitter ? (Math.random() - 0.5) * 30 : 0),
        targetY: target.y + (jitter ? (Math.random() - 0.5) * 20 : 0),
        orbitAngle: Math.random() * Math.PI * 2,
        orbitRadius: 4 + Math.random() * 10,
        orbitSpeed: 0.15 + Math.random() * 0.35,
        size: 0.6 + Math.random() * 1.4,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
    particlesRef.current = particles;

    if (reducedMotion) {
      // No animation loop at all — draw the converged mark once, static.
      convergenceRef.current = 1;
      drawFrame(ctx, 0);
      return;
    }

    function drawFrame(ctx: CanvasRenderingContext2D, time: number) {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const target = hoveredRef.current ? 1 : 0;
      // Ease convergence toward its target rather than snapping —
      // this is what makes hover feel like a gathering, not a toggle.
      convergenceRef.current += (target - convergenceRef.current) * 0.08;
      const c = convergenceRef.current;

      const [r, g, b] = colorRef.current.split(', ');

      for (const p of particlesRef.current) {
        p.orbitAngle += p.orbitSpeed * 0.02;
        const orbitX = p.x + Math.cos(p.orbitAngle) * p.orbitRadius * 0.02;
        const orbitY = p.y + Math.sin(p.orbitAngle) * p.orbitRadius * 0.02;

        // Blend between free orbit position and letterform target
        // based on convergence — every particle travels the same
        // path type, just at different progress, so the whole field
        // moves as one coherent gesture rather than particles racing
        // independently to their spots.
        const drawX = orbitX + (p.targetX - orbitX) * c;
        const drawY = orbitY + (p.targetY - orbitY) * c;

        p.x += (drawX - p.x) * 0.15;
        p.y += (drawY - p.y) * 0.15;

        const twinkle = 0.6 + 0.4 * Math.sin(time * 0.002 + p.twinklePhase);
        const alpha = (0.35 + 0.5 * c) * twinkle;
        const size = p.size * (0.8 + c * 0.6);

        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${(0.5 * c + 0.15).toFixed(3)})`;
        ctx.shadowBlur = 3 + c * 4;
        ctx.fill();
      }
    }

    function loop(time: number) {
      const ctx2 = canvasRef.current?.getContext('2d');
      if (ctx2) drawFrame(ctx2, time);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const setHovered = useCallback((value: boolean) => {
    hoveredRef.current = value;
  }, []);

  return (
    <div
      className="watermark"
      role="img"
      aria-label="Quantorix-Field"
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onTouchStart={() => setHovered(!hoveredRef.current)}
    >
      <canvas ref={canvasRef} style={{ width: WIDTH, height: HEIGHT, display: 'block' }} />
    </div>
  );
}
