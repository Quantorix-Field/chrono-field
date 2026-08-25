/* ============================================
   SKY RENDERER — Hyper-realistic edition
   Physically-inspired atmospheric scattering,
   textured sun/moon, layered volumetric clouds,
   and weather-precise particle systems.
   ============================================ */

const SkyRenderer = (() => {

  let canvas, ctx, width, height, dpr;
  let stars = [];
  let clouds = [];
  let precipDrops = [];
  let fogLayers = [];
  let moonCraters = [];

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
    generateMoonCraters();
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
    for (let i = 0; i < 400; i++) {
      const tint = Math.random();
      stars.push({
        x: Math.random(),
        y: Math.random() * 0.7,
        r: Math.random() * 1.3 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.004,
        twinklePhase: Math.random() * Math.PI * 2,
        color: tint < 0.15 ? '173,196,255' : tint > 0.9 ? '255,214,180' : '255,255,255'
      });
    }
  }

  function generateClouds() {
    clouds = [];
    for (let i = 0; i < 10; i++) {
      const puffs = [];
      const puffCount = 4 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffCount; p++) {
        puffs.push({
          dx: (Math.random() - 0.5) * 1.6,
          dy: (Math.random() - 0.5) * 0.4,
          scale: Math.random() * 0.5 + 0.5
        });
      }
      clouds.push({
        x: Math.random(),
        y: Math.random() * 0.32 + 0.04,
        scale: Math.random() * 0.7 + 0.8,
        speed: Math.random() * 0.00007 + 0.00002,
        baseOpacity: Math.random() * 0.25 + 0.2,
        puffs
      });
    }
  }

  function generatePrecip() {
    precipDrops = [];
    for (let i = 0; i < 400; i++) {
      precipDrops.push({
        x: Math.random(),
        y: Math.random(),
        len: Math.random() * 16 + 10,
        speed: Math.random() * 0.018 + 0.022,
        drift: (Math.random() - 0.5) * 0.0015,
        rot: Math.random() * 4 - 2
      });
    }
  }

  function generateFog() {
    fogLayers = [];
    for (let i = 0; i < 6; i++) {
      fogLayers.push({
        x: Math.random(),
        y: 0.45 + Math.random() * 0.55,
        scale: Math.random() * 0.9 + 0.6,
        speed: (Math.random() * 0.00004 + 0.00001) * (Math.random() < 0.5 ? 1 : -1)
      });
    }
  }

  function generateMoonCraters() {
    moonCraters = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * 0.6;
      moonCraters.push({
        dx: Math.cos(a) * d,
        dy: Math.sin(a) * d,
        r: Math.random() * 0.14 + 0.05
      });
    }
  }

  function update(newState) {
    state = { ...state, ...newState };
  }

  // Physically-flavored sky gradient: deep blue zenith fading through
  // atmospheric haze near the horizon, with warm scattering when the
  // sun sits low (Rayleigh-scattering-like behavior, simplified).
  function getSkyStops(altitude) {
    const t = Math.max(-1, Math.min(1, altitude / (Math.PI / 2)));

    if (t < -0.25) {
      return [[3, 4, 14], [5, 7, 20], [8, 10, 26]];
    }
    if (t < -0.05) {
      const k = (t + 0.25) / 0.2;
      return [
        lerpColor([6, 8, 22], [18, 16, 40], k),
        lerpColor([10, 12, 30], [55, 35, 65], k),
        lerpColor([16, 16, 38], [130, 70, 80], k)
      ];
    }
    if (t < 0.08) {
      const k = (t + 0.05) / 0.13;
      return [
        lerpColor([18, 16, 40], [80, 110, 170], k),
        lerpColor([55, 35, 65], [220, 150, 120], k),
        lerpColor([130, 70, 80], [255, 200, 150], k)
      ];
    }
    if (t < 0.35) {
      const k = (t - 0.08) / 0.27;
      return [
        lerpColor([80, 110, 170], [55, 140, 220], k),
        lerpColor([220, 150, 120], [150, 195, 225], k),
        lerpColor([255, 200, 150], [205, 225, 235], k)
      ];
    }
    const k = Math.min(1, (t - 0.35) / 0.65);
    return [
      lerpColor([55, 140, 220], [45, 130, 220], k),
      lerpColor([150, 195, 225], [160, 205, 230], k),
      lerpColor([205, 225, 235], [210, 228, 236], k)
    ];
  }

  function lerpColor(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  function rgb(c) { return `rgb(${c[0]}, ${c[1]}, ${c[2]})`; }
  function rgba(c, a) { return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`; }

  function greyFactorFor(condition, cloudcover) {
    if (condition === 'storm') return 0.7;
    if (condition === 'overcast') return 0.5;
    if (condition === 'rain' || condition === 'snow') return 0.42;
    if (condition === 'fog') return 0.35;
    return (cloudcover / 100) * 0.32;
  }

  function drawSky() {
    const [top, mid, bottom] = getSkyStops(state.sunAltitude);
    const grey = greyFactorFor(state.condition, state.cloudcover);
    const greyTone = state.condition === 'storm' ? [22, 24, 30] : [110, 115, 122];

    const t2 = lerpColor(top, greyTone, grey);
    const m2 = lerpColor(mid, greyTone, grey * 0.85);
    const b2 = lerpColor(bottom, greyTone, grey * 0.6);

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, rgb(t2));
    grad.addColorStop(0.55, rgb(m2));
    grad.addColorStop(1, rgb(b2));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawStars(nightFactor) {
    const cloudBlock = 1 - Math.min(1, state.cloudcover / 85);
    const hazeBlock = (state.condition === 'fog' || state.condition === 'haze') ? 0.15 : 1;
    const visible = nightFactor * cloudBlock * hazeBlock;
    if (visible <= 0.02) return;

    stars.forEach(s => {
      const twinkle = 0.55 + 0.45 * Math.sin(performance.now() * s.twinkleSpeed + s.twinklePhase);
      ctx.beginPath();
      ctx.arc(s.x * width, s.y * height, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${s.color},${twinkle * visible})`;
      ctx.fill();
    });
  }

  function bodyVisibilityFactor() {
    let block = state.cloudcover / 100;
    if (state.condition === 'storm') block = Math.max(block, 0.88);
    if (state.condition === 'fog') block = Math.max(block, 0.75);
    if (state.condition === 'haze') block = Math.max(block, 0.4);
    return 1 - block * 0.92;
  }

  function bodyPosition(altitude, azimuth) {
    const x = width * (0.5 + 0.42 * Math.sin(azimuth));
    const y = height * (0.88 - 0.72 * Math.max(0, (altitude + 0.15) / 1.7));
    return { x, y };
  }

  function drawSun() {
    if (state.sunAltitude < -0.18) return;
    const { x, y } = bodyPosition(state.sunAltitude, state.sunAzimuth);
    const altVisibility = Math.max(0, Math.min(1, (state.sunAltitude + 0.15) * 3));
    const visibility = altVisibility * bodyVisibilityFactor();
    if (visibility <= 0.02) return;

    // Colour shifts warm/red near the horizon, white-hot high in the sky
    const lowSun = Math.max(0, 1 - Math.max(0, state.sunAltitude) / 0.5);
    const core = lerpColor([255, 250, 235], [255, 150, 90], lowSun);

    // Wide atmospheric halo
    const halo = ctx.createRadialGradient(x, y, 0, x, y, 220);
    halo.addColorStop(0, rgba(core, 0.35 * visibility));
    halo.addColorStop(1, rgba(core, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(x - 220, y - 220, 440, 440);

    // Tighter corona
    const corona = ctx.createRadialGradient(x, y, 0, x, y, 70);
    corona.addColorStop(0, rgba([255, 255, 250], 0.95 * visibility));
    corona.addColorStop(0.4, rgba(core, 0.55 * visibility));
    corona.addColorStop(1, rgba(core, 0));
    ctx.fillStyle = corona;
    ctx.fillRect(x - 70, y - 70, 140, 140);

    // Sun rays, subtle, rotating very slowly
    const rayRotation = performance.now() * 0.00002;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rayRotation);
    ctx.globalAlpha = 0.12 * visibility;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 30);
      ctx.lineTo(Math.cos(a) * 95, Math.sin(a) * 95);
      ctx.strokeStyle = rgb(core);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fillStyle = rgba([255, 252, 240], visibility);
    ctx.fill();
  }

  function drawMoon() {
    if (state.moonAltitude < -0.18) return;
    const { x, y } = bodyPosition(state.moonAltitude, state.moonAzimuth);
    const altVisibility = Math.max(0, Math.min(1, (state.moonAltitude + 0.15) * 3));
    const visibility = altVisibility * bodyVisibilityFactor();
    if (visibility <= 0.02) return;

    const r = 19;

    // Soft ambient glow
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 55);
    glow.addColorStop(0, rgba([210, 218, 235], 0.4 * visibility));
    glow.addColorStop(1, rgba([210, 218, 235], 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - 55, y - 55, 110, 110);

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();

    // Base lunar surface
    ctx.fillStyle = rgba([222, 225, 232], visibility);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    // Crater texture, subtle
    moonCraters.forEach(c => {
      ctx.beginPath();
      ctx.arc(x + c.dx * r, y + c.dy * r, c.r * r, 0, Math.PI * 2);
      ctx.fillStyle = rgba([195, 198, 208], visibility * 0.6);
      ctx.fill();
    });

    // Phase shadow with a soft blurred terminator instead of a hard edge
    const phaseOffset = Math.cos(state.moonPhase * Math.PI * 2) * r * 1.35;
    const termGrad = ctx.createLinearGradient(x - r, y, x + r, y);
    const shadowPos = 0.5 + (phaseOffset / (r * 2));
    termGrad.addColorStop(Math.max(0, shadowPos - 0.06), 'rgba(6,7,16,0)');
    termGrad.addColorStop(Math.min(1, shadowPos + 0.02), `rgba(6,7,16,${visibility})`);
    ctx.beginPath();
    ctx.arc(x + phaseOffset, y, r * 1.08, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(6,7,16,${visibility})`;
    ctx.fill();

    ctx.restore();
  }

  function drawClouds() {
    if (state.cloudcover < 6) return;
    const coverFactor = state.cloudcover / 100;
    const activeCount = Math.round(clouds.length * Math.min(1, coverFactor + 0.25));
    const darken = state.condition === 'storm' ? 0.42 : state.condition === 'overcast' ? 0.65 : 1;

    // Light direction from the sun's azimuth, used to shade cloud edges
    const lightFromRight = Math.sin(state.sunAzimuth) >= 0;

    clouds.forEach((c, i) => {
      if (i >= activeCount) return;
      c.x += c.speed * (1 + state.windspeed / 35);
      if (c.x > 1.25) c.x = -0.25;

      const cx = c.x * width;
      const cy = c.y * height;
      const s = c.scale * 95;

      c.puffs.forEach(p => {
        const px = cx + p.dx * s;
        const py = cy + p.dy * s;
        const pr = s * p.scale * 0.55;

        const shade = lightFromRight ? [255 * darken, 255 * darken, 255 * darken] : [225 * darken, 225 * darken, 235 * darken];
        ctx.beginPath();
        ctx.ellipse(px, py, pr, pr * 0.62, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${shade[0]},${shade[1]},${shade[2]},${c.baseOpacity * coverFactor})`;
        ctx.fill();
      });

      // Undershadow for volume
      ctx.beginPath();
      ctx.ellipse(cx, cy + s * 0.22, s * 0.9, s * 0.22, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(40,42,55,${c.baseOpacity * coverFactor * 0.35})`;
      ctx.fill();
    });
  }

  function drawPrecipitation() {
    const isRainLike = ['rain', 'drizzle', 'storm'].includes(state.condition);
    const isSnow = state.condition === 'snow';
    if ((!isRainLike && !isSnow) || state.precipitation <= 0.01) return;

    const intensity = Math.min(1, state.precipitation / 4);
    const activeCount = Math.round(precipDrops.length * Math.max(0.15, intensity));

    if (isSnow) {
      precipDrops.forEach((d, i) => {
        if (i >= activeCount) return;
        d.y += d.speed * 0.3;
        d.x += d.drift + Math.sin(d.y * 20) * 0.0006;
        if (d.y > 1) d.y = 0;
        if (d.x > 1) d.x = 0;
        if (d.x < 0) d.x = 1;
        ctx.beginPath();
        ctx.arc(d.x * width, d.y * height, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fill();
      });
    } else {
      const speedMul = state.condition === 'storm' ? 2 : 1;
      ctx.lineCap = 'round';
      precipDrops.forEach((d, i) => {
        if (i >= activeCount) return;
        d.y += d.speed * speedMul;
        if (d.y > 1) d.y = 0;
        const x = d.x * width + state.windspeed * 0.3;
        const y = d.y * height;

        const grad = ctx.createLinearGradient(x, y, x - 3, y + d.len);
        grad.addColorStop(0, 'rgba(200,215,235,0)');
        grad.addColorStop(1, state.condition === 'storm' ? 'rgba(210,220,240,0.75)' : 'rgba(190,205,225,0.55)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = state.condition === 'storm' ? 1.3 : 0.9;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + d.len);
        ctx.stroke();
      });
    }
  }

  function drawFogHaze() {
    if (state.condition !== 'fog' && state.condition !== 'haze') return;
    const density = state.condition === 'fog' ? 0.55 : 0.3;
    const tint = state.condition === 'fog' ? [205, 212, 218] : [198, 186, 165];

    fogLayers.forEach(f => {
      f.x += f.speed;
      if (f.x > 1.3) f.x = -0.3;
      if (f.x < -0.3) f.x = 1.3;

      const cx = f.x * width;
      const cy = f.y * height;
      const s = f.scale * width * 0.55;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s);
      grad.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${density})`);
      grad.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
    });
  }

  function drawStormFlash() {
    if (state.condition !== 'storm') return;
    const t = performance.now();
    const cycle = t % 7000;
    if (cycle < 100) {
      const flashAlpha = 0.18 * (1 - cycle / 100);
      ctx.fillStyle = `rgba(230,235,255,${flashAlpha})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // Subtle cinematic vignette to focus the eye and add depth
  function drawVignette() {
    const grad = ctx.createRadialGradient(
      width / 2, height / 2, height * 0.35,
      width / 2, height / 2, height * 0.9
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
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
    drawVignette();

    requestAnimationFrame(loop);
  }

  return { init, update };

})();
