/* ============================================
   SKY RENDERER
   Paints a physically-informed sky: gradient by
   solar altitude, sun, moon (true phase shading),
   stars, and precise weather-driven particles.
   ============================================ */

const SkyRenderer = (() => {

  let canvas, ctx, width, height, dpr;
  let stars = [];
  let clouds = [];
  let precipDrops = [];
  let fogParticles = [];

  let state = {
    sunAltitude: 0.5,
    sunAzimuth: 0,
    moonAltitude: -0.5,
    moonAzimuth: 0,
    moonPhase: 0.5,
    condition: 'clear',
    cloudcover: 0,
    precipitation: 0,
    visibility: 10000,
    windspeed: 0
  };

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    generateStars();
    generateClouds();
    generatePrecip();
    generateFog();
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
    for (let i = 0; i < 220; i++) {
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
    for (let i = 0; i < 8; i++) {
      clouds.push({
        x: Math.random(),
        y: Math.random() * 0.35 + 0.05,
        scale: Math.random() * 0.6 + 0.7,
        speed: Math.random() * 0.00008 + 0.00002,
        baseOpacity: Math.random() * 0.3 + 0.15
      });
    }
  }

  function generatePrecip() {
    precipDrops = [];
    for (let i = 0; i < 300; i++) {
      precipDrops.push({
        x: Math.random(),
        y: Math.random(),
        len: Math.random() * 14 + 8,
        speed: Math.random() * 0.015 + 0.02,
        drift: (Math.random() - 0.5) * 0.002
      });
    }
  }

  function generateFog() {
    fogParticles = [];
    for (let i = 0; i < 5; i++) {
      fogParticles.push({
        x: Math.random(),
        y: 0.5 + Math.random() * 0.5,
        scale: Math.random() * 0.8 + 0.6,
        speed: Math.random() * 0.00004 + 0.00001
      });
    }
  }

  function update(newState) {
    state = { ...state, ...newState };
  }

  function getSkyColors(altitude, condition, cloudcover) {
    const t = Math.max(-1, Math.min(1, altitude / (Math.PI / 2)));

    const palettes = [
      { at: -1,    top: [3, 5, 16],     bottom: [10, 12, 30] },
      { at: -0.2,  top: [8, 10, 30],    bottom: [30, 20, 50] },
      { at: -0.05, top: [30, 25, 60],   bottom: [180, 90, 90] },
      { at: 0.05,  top: [90, 130, 190], bottom: [255, 190, 140] },
      { at: 0.3,   top: [70, 150, 220], bottom: [190, 220, 240] },
      { at: 1,     top: [60, 150, 235], bottom: [200, 225, 245] }
    ];

    let top, bottom;
    for (let i = 0; i < palettes.length - 1; i++) {
      const a = palettes[i], b = palettes[i + 1];
      if (t >= a.at && t <= b.at) {
        const localT = (t - a.at) / (b.at - a.at);
        top = lerpColor(a.top, b.top, localT);
        bottom = lerpColor(a.bottom, b.bottom, localT);
        break;
      }
    }
    if (!top) {
      const p = t < palettes[0].at ? palettes[0] : palettes[palettes.length - 1];
      top = p.top; bottom = p.bottom;
    }

    // Desaturate and darken toward grey as cloud cover / storm intensity rises —
    // this is what makes an overcast or stormy sky look physically correct
    // rather than just a clear sky with clouds pasted on top.
    const greyFactor = condition === 'storm' ? 0.75
      : condition === 'overcast' ? 0.55
      : condition === 'rain' || condition === 'snow' ? 0.5
      : (cloudcover / 100) * 0.4;

    const grey = condition === 'storm' ? [25, 27, 35] : [120, 125, 135];
    top = lerpColor(top, grey, greyFactor);
    bottom = lerpColor(bottom, grey, greyFactor * 0.7);

    return { top, bottom };
  }

  function lerpColor(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  function rgb(c) { return `rgb(${c[0]}, ${c[1]}, ${c[2]})`; }

  function drawSky() {
    const colors = getSkyColors(state.sunAltitude, state.condition, state.cloudcover);
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, rgb(colors.top));
    grad.addColorStop(1, rgb(colors.bottom));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawStars(nightFactor) {
    // Stars are hidden proportionally to cloud cover — a fully overcast
    // night shows no stars at all, matching reality.
    const cloudBlock = 1 - Math.min(1, state.cloudcover / 85);
    const visible = nightFactor * cloudBlock;
    if (visible <= 0.02) return;

    stars.forEach(s => {
      const twinkle = 0.6 + 0.4 * Math.sin(performance.now() * s.twinkleSpeed + s.twinklePhase);
      ctx.beginPath();
      ctx.arc(s.x * width, s.y * height, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${twinkle * visible})`;
      ctx.fill();
    });
  }

  function bodyVisibilityFactor() {
    // Sun/moon visibility is reduced by cloud cover and storm conditions,
    // not just by altitude — a fully overcast sky hides the sun even at noon.
    let block = state.cloudcover / 100;
    if (state.condition === 'storm') block = Math.max(block, 0.85);
    if (state.condition === 'fog') block = Math.max(block, 0.7);
    if (state.condition === 'haze') block = Math.max(block, 0.35);
    return 1 - block * 0.9; // never fully zero — a bright glow bleeds through thin cloud
  }

  function drawSun() {
    if (state.sunAltitude < -0.15) return;

    const x = width * (0.5 + 0.4 * Math.sin(state.sunAzimuth));
    const y = height * (0.85 - 0.7 * Math.max(0, (state.sunAltitude + 0.15) / 1.7));
    const altVisibility = Math.max(0, Math.min(1, (state.sunAltitude + 0.15) * 3));
    const visibility = altVisibility * bodyVisibilityFactor();
    if (visibility <= 0.02) return;

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
    const altVisibility = Math.max(0, Math.min(1, (state.moonAltitude + 0.15) * 3));
    const visibility = altVisibility * bodyVisibilityFactor();
    if (visibility <= 0.02) return;

    const r = 20;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(230, 232, 240, ${visibility})`;
    ctx.fill();

    const phaseOffset = Math.cos(state.moonPhase * Math.PI * 2) * r * 1.3;
    ctx.beginPath();
    ctx.arc(x + phaseOffset, y, r * 1.05, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(8, 9, 20, ${visibility})`;
    ctx.fill();
    ctx.restore();
  }

  function drawClouds() {
    // Cloud density and opacity scale directly with real cloudcover %.
    if (state.cloudcover < 8) return;
    const coverFactor = state.cloudcover / 100;
    const activeCount = Math.round(clouds.length * Math.min(1, coverFactor + 0.2));

    clouds.forEach((c, i) => {
      if (i >= activeCount) return;

      c.x += c.speed * (1 + state.windspeed / 40);
      if (c.x > 1.2) c.x = -0.2;

      const cx = c.x * width;
      const cy = c.y * height;
      const s = c.scale * 100;
      const darken = state.condition === 'storm' ? 0.5 : state.condition === 'overcast' ? 0.75 : 1;

      ctx.beginPath();
      ctx.ellipse(cx, cy, s, s * 0.4, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + s * 0.5, cy + s * 0.1, s * 0.6, s * 0.3, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - s * 0.5, cy + s * 0.1, s * 0.6, s * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${255 * darken},${255 * darken},${255 * darken},${c.baseOpacity * coverFactor})`;
      ctx.fill();
    });
  }

  function drawPrecipitation() {
    // Only draws when the real condition is rain/drizzle/storm/snow —
    // and never when precipitation amount is effectively zero.
    const isRainLike = ['rain', 'drizzle', 'storm'].includes(state.condition);
    const isSnow = state.condition === 'snow';
    if ((!isRainLike && !isSnow) || state.precipitation <= 0.01) return;

    const intensity = Math.min(1, state.precipitation / 4);
    const activeCount = Math.round(precipDrops.length * Math.max(0.15, intensity));

    if (isSnow) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      precipDrops.forEach((d, i) => {
        if (i >= activeCount) return;
        d.y += d.speed * 0.3;
        d.x += d.drift;
        if (d.y > 1) d.y = 0;
        if (d.x > 1) d.x = 0;
        if (d.x < 0) d.x = 1;
        ctx.beginPath();
        ctx.arc(d.x * width, d.y * height, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {
      ctx.strokeStyle = state.condition === 'storm'
        ? 'rgba(200, 210, 230, 0.65)'
        : 'rgba(180, 200, 230, 0.5)';
      ctx.lineWidth = state.condition === 'storm' ? 1.4 : 1;

      precipDrops.forEach((d, i) => {
        if (i >= activeCount) return;
        d.y += d.speed * (state.condition === 'storm' ? 1.8 : 1);
        if (d.y > 1) d.y = 0;
        const x = d.x * width;
        const y = d.y * height;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + d.len);
        ctx.stroke();
      });
    }
  }

  function drawFogHaze() {
    if (state.condition !== 'fog' && state.condition !== 'haze') return;

    const density = state.condition === 'fog' ? 0.5 : 0.28;
    const tint = state.condition === 'fog' ? [210, 215, 220] : [200, 190, 170];

    fogParticles.forEach(f => {
      f.x += f.speed;
      if (f.x > 1.3) f.x = -0.3;

      const cx = f.x * width;
      const cy = f.y * height;
      const s = f.scale * width * 0.5;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s);
      grad.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${density})`);
      grad.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
    });
  }

  function drawStormFlash() {
    if (state.condition !== 'storm') return;
    // Rare, irregular lightning flash driven by real time rather than
    // a fixed interval, so it never feels mechanical.
    const t = performance.now();
    const cycle = t % 6000;
    if (cycle < 90) {
      const flashAlpha = 0.15 * (1 - cycle / 90);
      ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  function loop() {
    ctx.clearRect(0, 0, width, height);

    drawSky();

    const nightFactor = Math.max(0, Math.min(1, -state.sunAltitude / 0.5 + 0.3));
    drawStars(nightFactor);

    drawMoon();
    drawSun();
    drawClouds();
    drawFogHaze();
    drawPrecipitation();
    drawStormFlash();

    requestAnimationFrame(loop);
  }

  return { init, update };

})();
