/* ============================================
   QUANTORIX-FIELD WATERMARK
   A tiny living instrument — a real-time dial
   that quietly ticks with the actual current time,
   revealing the maker's identity on interaction.
   ============================================ */

const Watermark = (() => {

  let container, canvas, ctx;
  let size = 56;
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

    const label = document.createElement('div');
    label.textContent = 'Purushotam Kumar · Quantorix-Field';
    label.style.cssText = `
      position: absolute;
      bottom: 70px;
      right: 0;
      font-family: 'Inter', sans-serif;
      font-size: 0.7rem;
      color: #9aa3b5;
      white-space: nowrap;
      opacity: 0;
      transform: translateY(6px);
      transition: opacity 0.25s ease, transform 0.25s ease;
      pointer-events: none;
      letter-spacing: 0.03em;
    `;
    container.appendChild(label);

    container.addEventListener('mouseenter', () => {
      hovering = true;
      label.style.opacity = '1';
      label.style.transform = 'translateY(0)';
    });
    container.addEventListener('mouseleave', () => {
      hovering = false;
      label.style.opacity = '0';
      label.style.transform = 'translateY(6px)';
    });
    container.addEventListener('touchstart', () => {
      hovering = !hovering;
      label.style.opacity = hovering ? '1' : '0';
      label.style.transform = hovering ? 'translateY(0)' : 'translateY(6px)';
    });

    requestAnimationFrame(loop);
  }

  function loop() {
    const now = new Date();
    const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const dayFraction = seconds / 86400;
    const angle = dayFraction * Math.PI * 2 - Math.PI / 2;

    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 4;

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = hovering ? 'rgba(127, 214, 255, 0.7)' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Day/night arc fill (subtle, based on real time of day)
    const nightStart = -Math.PI / 2;
    const isDayNow = now.getHours() >= 6 && now.getHours() < 18;
    ctx.beginPath();
    ctx.arc(cx, cy, r, nightStart, angle);
    ctx.strokeStyle = isDayNow ? 'rgba(255, 179, 127, 0.5)' : 'rgba(127, 214, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center pulse dot — the "live" indicator
    const pulse = 1 + 0.15 * Math.sin(performance.now() * 0.003);
    ctx.beginPath();
    ctx.arc(cx, cy, 3 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = hovering ? '#7fd6ff' : 'rgba(238,241,247,0.7)';
    ctx.fill();

    // Tracking indicator (the "hand" of the dial)
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    requestAnimationFrame(loop);
  }

  return { init };

})();
