/* ============================================
   QUANTORIX-FIELD WATERMARK
   An engraved celestial seal — a living instrument
   that quietly tracks real time, with a monogram
   at its core revealing the maker's identity.
   ============================================ */

const Watermark = (() => {

  let container, canvas, ctx, label;
  let size = 64;
  let hovering = false;

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
      transition: opacity 0.35s ease, transform 0.35s ease;
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
    const now = new Date();
    const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const dayFraction = seconds / 86400;
    const isDayNow = now.getHours() >= 6 && now.getHours() < 18;

    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const outerR = size / 2 - 3;
    const tickR = outerR - 4;

    const ringGlow = hovering ? 'rgba(127, 214, 255, 0.9)' : 'rgba(243, 240, 234, 0.35)';

    // Slowly rotating outer engraved ring
    const ringRotation = performance.now() * 0.00003;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ringRotation);
    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
    ctx.strokeStyle = ringGlow;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Hour tick marks — 12 delicate radial lines, like an astrolabe rim
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const isQuarter = i % 3 === 0;
      const inner = isQuarter ? tickR - 5 : tickR - 2.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * tickR, Math.sin(a) * tickR);
      ctx.strokeStyle = isQuarter ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)';
      ctx.lineWidth = isQuarter ? 1 : 0.6;
      ctx.stroke();
    }
    ctx.restore();

    // Inner engraved circle framing the monogram
    ctx.beginPath();
    ctx.arc(cx, cy, outerR - 11, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // Sun/moon glyph orbiting at the true time-of-day position
    const glyphAngle = dayFraction * Math.PI * 2 - Math.PI / 2;
    const glyphR = outerR - 1.5;
    const gx = cx + Math.cos(glyphAngle) * glyphR;
    const gy = cy + Math.sin(glyphAngle) * glyphR;

    ctx.beginPath();
    ctx.arc(gx, gy, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = isDayNow ? '#ffb37f' : '#7fd6ff';
    ctx.shadowColor = isDayNow ? '#ffb37f' : '#7fd6ff';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Monogram — "QF" softly breathing, brightens on hover
    const breathe = 0.85 + 0.15 * Math.sin(performance.now() * 0.0015);
    ctx.font = '500 15px Fraunces, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = hovering
      ? `rgba(127, 214, 255, 1)`
      : `rgba(243, 240, 234, ${0.55 * breathe + 0.25})`;
    ctx.fillText('QF', cx, cy + 0.5);

    requestAnimationFrame(loop);
  }

  return { init };

})();
