/* ============================================
   QUANTORIX-FIELD WATERMARK
   A particle field at rest — drifting quanta that
   snap into a "QF" sigil on interaction, then
   dissolve back into drift. The mark IS the idea.
   ============================================ */

const Watermark = (() => {

  let container, canvas, ctx, label;
  let size = 64;
  let hovering = false;
  let formCoherence = 0; // 0 = loose field, 1 = fully formed sigil
  let particles = [];

  // Sample points outlining a compact "QF" glyph, normalized -1..1
  const SIGIL_POINTS = [
    // Q (circle + tail)
    [-0.62, -0.38], [-0.5, -0.55], [-0.3, -0.62], [-0.1, -0.55],
    [0.02, -0.38], [0.06, -0.15], [0.02, 0.08], [-0.1, 0.25],
    [-0.3, 0.32], [-0.5, 0.25], [-0.62, 0.08], [-0.66, -0.15],
    [-0.62, -0.38], [0.08, 0.3],
    // F
    [0.28, -0.55], [0.28, -0.25], [0.28, 0.05], [0.28, 0.35],
    [0.28, -0.55], [0.55, -0.55],
    [0.28, -0.12], [0.5, -0.12]
  ];

  function init() {
    container = document.getElementById('quantorix-mark');
    container.style.cssText += `
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    canvas = document.createElement('canvas');
    canvas.width = size * 2;
    canvas.height = size * 2;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    container.appendChild(canvas);

    particles = SIGIL_POINTS.map(([tx, ty]) => ({
      targetX: tx, targetY: ty,
      fieldX: (Math.random() - 0.5) * 1.4,
      fieldY: (Math.random() - 0.5) * 1.4,
      driftPhase: Math.random() * Math.PI * 2,
      driftSpeed: Math.random() * 0.0006 + 0.0003,
      driftRadius: Math.random() * 0.15 + 0.05
    }));

    label = document.createElement('div');
    label.innerHTML = `<span class="wm-name">Purushotam Kumar</span><span class="wm-tag">Quantorix-Field</span>`;
    label.style.cssText = `
      position: absolute;
      bottom: 78px;
      right: 0;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.4s ease, transform 0.4s ease;
      pointer-events: none;
      white-space: nowrap;
    `;

    const style = document.createElement('style');
    style.textContent = `
      .wm-name {
        font-family: 'Fraunces', serif;
        font-style: italic;
        font-weight: 500;
        font-size: 0.85rem;
        color: #f3f0ea;
        letter-spacing: 0.02em;
      }
      .wm-tag {
        font-family: 'Manrope', sans-serif;
        font-weight: 500;
        font-size: 0.62rem;
        color: #7fd6ff;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        margin-top: 2px;
      }
    `;
    document.head.appendChild(style);
    container.appendChild(label);

    const setHover = (on) => {
      hovering = on;
      label.style.opacity = on ? '1' : '0';
      label.style.transform = on ? 'translateY(0)' : 'translateY(8px)';
    };

    container.addEventListener('mouseenter', () => setHover(true));
    container.addEventListener('mouseleave', () => setHover(false));
    container.addEventListener('touchstart', (e) => {
      e.preventDefault();
      setHover(!hovering);
    });

    requestAnimationFrame(loop);
  }

  function loop() {
    const target = hovering ? 1 : 0;
    formCoherence += (target - formCoherence) * 0.06;

    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const scale = size * 0.42;
    const t = performance.now();

    // Faint boundary ring, brightens as the sigil forms
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 - 2, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(127, 214, 255, ${0.15 + formCoherence * 0.35})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    const positions = particles.map(p => {
      const drift = p.driftRadius * Math.sin(t * p.driftSpeed + p.driftPhase);
      const fx = p.fieldX + drift;
      const fy = p.fieldY + Math.cos(t * p.driftSpeed * 1.3 + p.driftPhase) * p.driftRadius;

      const px = fx + (p.targetX - fx) * formCoherence;
      const py = fy + (p.targetY - fy) * formCoherence;

      return { x: cx + px * scale, y: cy + py * scale };
    });

    // Connective lines — a loose network in field state, crisp sigil strokes when formed
    ctx.lineWidth = 0.6 + formCoherence * 0.5;
    for (let i = 0; i < positions.length - 1; i++) {
      const a = positions[i], b = positions[i + 1];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const maxDist = 20 + formCoherence * 40;
      if (dist < maxDist || formCoherence > 0.5) {
        const alpha = formCoherence > 0.5
          ? 0.5 * formCoherence
          : Math.max(0, 1 - dist / maxDist) * 0.25;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(127, 214, 255, ${alpha})`;
        ctx.stroke();
      }
    }

    // Particles themselves
    positions.forEach((pos, i) => {
      const pulse = 0.7 + 0.3 * Math.sin(t * 0.002 + i);
      const r = (0.9 + formCoherence * 0.5) * pulse;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = formCoherence > 0.6
        ? `rgba(243, 240, 234, ${0.7 + formCoherence * 0.3})`
        : `rgba(127, 214, 255, ${0.5 + formCoherence * 0.3})`;
      ctx.fill();
    });

    requestAnimationFrame(loop);
  }

  return { init };

})();
