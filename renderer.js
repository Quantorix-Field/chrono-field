/* ============================================
   SKY RENDERER
   Paints a physically-informed sky: gradient by
   solar altitude, sun, moon (true phase shading),
   stars, and weather particles.
   ============================================ */

const SkyRenderer = (() => {

  let canvas, ctx, width, height, dpr;
  let stars = [];
  let clouds = [];
  let raindrops = [];

  let state = {
    sunAltitude: 0.5,   // radians
    sunAzimuth: 0,
    moonAltitude: -0.5,
    moonAzimuth: 0,
    moonPhase: 0.5,
    condition: 'clear',
    cloudcover: 0,
    precipitation: 0
  };

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    generateStars();
    generateClouds();
    generateRaindrops();
    requestAnimationFrame(loop);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function generateStars() {
    stars = [];
    const count = 220;
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random() * 0.65,
        r: Math.random() * 1.2 + 0.3,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2
      });
    }
  }

  function generateClouds() {
    clouds = [];
    for (let i = 0; i < 6; i++) {
      clouds.push({
        x: Math.random(),
        y: Math.random() * 0.35 + 0.05,
        scale: Math.random() * 0.6 + 0.7,
        speed: Math.random() * 0.00008 + 0.00002,
        opacity: Math.random() * 0.3 + 0.15
      });
    }
  }

  function generateRaindrops() {
    raindrops = [];
    for (let i = 0; i < 150; i++) {
      raindrops.push({
        x: Math.random(),
        y: Math.random(),
        len: Math.random() * 14 + 8,
        speed: Math.random() * 0.015 + 0.02
      });
    }
  }

  function update(newState) {
    state = { ...state, ...newState };
  }

  // Maps sun altitude (radians, -PI/2 to PI/2) to a sky color palette
  function getSkyColors(altitude) {
    const t = Math.max(-1, Math.min(1, altitude / (Math.PI / 2)));

    const palettes = [
      { at: -1,    top: [3, 5, 16],     bottom: [10, 12, 30] },   // deep night
      { at: -0.2,  top: [8, 10, 30],    bottom: [30, 20, 50] },   // astronomical twilight
      { at: -0.05, top: [30, 25, 60],   bottom: [180, 90, 90] },  // sunrise/sunset glow
      { at: 0.05,  top: [90, 130, 190], bottom: [255, 190, 140] },// low sun, warm horizon
      { at: 0.3,   top: [70, 150, 220], bottom: [190, 220, 240] },// morning/evening
      { at: 1,     top: [60, 150, 235], bottom: [200, 225, 245] } // high day
    ];

    for (let i = 0; i < palettes.length - 1; i++) {
      const a = palettes[i], b = palettes[i + 1];
      if (t >= a.at && t <= b.at) {
        const localT = (t - a.at) / (b.at - a.at);
        return {
          top: lerpColor(a.top, b.top, localT),
          bottom: lerpColor(a.bottom, b.bottom, localT)
        };
      }
    }
    return t < palettes[0].at
      ? { top: palettes[0].top, bottom: palettes[0].bottom }
      : { top: palettes[palettes.length - 1].top, bottom: palettes[palettes.length - 1].bottom };
  }

  function lerpColor(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  function rgb(c) {
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }

  function drawSky() {
    const colors = getSkyColors(state.sunAltitude);
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, rgb(colors.top));
    grad.addColorStop(1, rgb(colors.bottom));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawStars(nightFactor) {
    if (nightFactor <= 0) return;
    stars.forEach(s => {
      const twinkle = 0.6 + 0.4 * Math.sin(performance.now() * s.twinkleSpeed + s.twinklePhase);
      ctx.beginPath();
      ctx.arc(s.x * width, s.y * height, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${twinkle * nightFactor})`;
      ctx.fill();
    });
  }

  function drawSun() {
    if (state.sunAltitude < -0.15) return;

    const x = width * (0.5 + 0.4 * Math.sin(state.sunAzimuth));
    const y = height * (0.85 - 0.7 * Math.max(0, (state.sunAltitude + 0.15) / 1.7));
    const visibility = Math.max(0, Math.min(1, (state.sunAltitude + 0.15) * 3));

    const glow = ctx.createRadialGradient(x, y, 0, x, y, 120);
    glow.addColorStop(0, `rgba(255, 240, 200, ${0.9 * visibility})`);
    glow.addColorStop(1, 'rgba(255, 240, 200, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 120, y - 120, 240, 240);

    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 250, 235, ${visibility})`;
    ctx.fill();
  }

  function drawMoon() {
    if (state.moonAltitude < -0.15) return;

    const x = width * (0.5 + 0.4 * Math.sin(state.moonAzimuth));
    const y = height * (0.85 - 0.7 * Math.max(0, (state.moonAltitude + 0.15) / 1.7));
    const visibility = Math.max(0, Math.min(1, (state.moonAltitude + 0.15) * 3));
    const r = 20;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(230, 232, 240, ${visibility})`;
    ctx.fill();

    // Phase shadow: offset dark circle creates the illuminated crescent/gibbous shape
    const phaseOffset = Math.cos(state.moonPhase * Math.PI * 2) * r * 1.3;
    ctx.beginPath();
    ctx.arc(x + phaseOffset, y, r * 1.05, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(8, 9, 20, ${visibility})`;
    ctx.fill();
    ctx.restore();
  }

  function drawClouds() {
    if (state.cloudcover < 5) return;
    const coverFactor = state.cloudcover / 100;

    clouds.forEach(c => {
      c.x += c.speed;
      if (c.x > 1.2) c.x = -0.2;

      const cx = c.x * width;
      const cy = c.y * height;
      const s = c.scale * 100;

      ctx.beginPath();
      ctx.ellipse(cx, cy, s, s * 0.4, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + s * 0.5, cy + s * 0.1, s * 0.6, s * 0.3, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - s * 0.5, cy + s * 0.1, s * 0.6, s * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${c.opacity * coverFactor})`;
      ctx.fill();
    });
  }

  function drawRain() {
    if (state.precipitation <= 0) return;

    ctx.strokeStyle = 'rgba(180, 200, 230, 0.5)';
    ctx.lineWidth = 1;

    raindrops.forEach(d => {
      d.y += d.speed;
      if (d.y > 1) d.y = 0;

      const x = d.x * width;
      const y = d.y * height;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + d.len);
      ctx.stroke();
    });
  }

  function loop() {
    ctx.clearRect(0, 0, width, height);

    drawSky();

    const nightFactor = Math.max(0, Math.min(1, -state.sunAltitude / 0.5 + 0.3));
    drawStars(nightFactor);

    drawMoon();
    drawSun();
    drawClouds();
    drawRain();

    requestAnimationFrame(loop);
  }

  return { init, update };

})();
