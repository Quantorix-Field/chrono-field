#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_sunAltitude;   // radians, drives overall visibility
uniform float u_visibility;    // meters, haze washes stars out near horizon

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Two independent hashes per cell so brightness and color-temperature
// aren't correlated — otherwise all the "bright" stars end up the
// same tint, which reads as fake immediately.
vec2 hash2(vec2 p) {
  return vec2(
    hash(p),
    hash(p + vec2(41.3, 17.7))
  );
}

// A single layer of the star field at a given grid density.
// Returns brightness (0..1) and a per-star seed for color/twinkle.
vec2 starLayer(vec2 uv, float cellsPerScreen, float threshold) {
  vec2 grid = floor(uv * cellsPerScreen);
  vec2 cellUv = fract(uv * cellsPerScreen) - 0.5;

  vec2 h = hash2(grid);
  if (h.x < threshold) return vec2(0.0);

  // Jitter each star's position within its cell so the grid
  // structure isn't visible as a repeating pattern.
  vec2 starPos = (h - 0.5) * 0.7;
  float dist = length(cellUv - starPos);

  // Star size varies per-star, biased small — a few "bright" outliers
  // read as more realistic than uniform dot size.
  float size = mix(0.02, 0.06, pow(h.y, 3.0));
  float core = smoothstep(size, 0.0, dist);

  return vec2(core, h.y);
}

void main() {
  vec2 uv = v_uv;
  uv.x *= u_resolution.x / u_resolution.y;

  // Only visible once the sun is well below the horizon — this
  // mirrors the twilight fade already happening in the sky shader
  // so the two layers agree on when "night" actually starts.
  float dayFactor = clamp((u_sunAltitude + 0.15) / 0.4, 0.0, 1.0);
  float nightVisibility = 1.0 - dayFactor;

  // Fade out near the horizon (bottom of screen) — thicker
  // atmosphere there washes out faint stars in reality.
  float verticalT = clamp(1.0 - v_uv.y, 0.0, 1.0);
  float horizonFalloff = smoothstep(0.0, 0.35, verticalT);

  // Haze/fog reduces star visibility independent of time of day.
  float fogFactor = clamp(u_visibility / 10000.0, 0.0, 1.0);

  float visibility = nightVisibility * horizonFalloff * fogFactor;

  if (visibility <= 0.001) {
    fragColor = vec4(0.0);
    return;
  }

  // Two layers at different densities: a common layer of faint,
  // small stars, and a sparser layer of larger, brighter ones —
  // this is what avoids the "uniform static noise" look.
  vec2 faint = starLayer(uv, 120.0, 0.90);
  vec2 bright = starLayer(uv, 40.0, 0.985);

  float brightness = max(faint.x, bright.x * 1.4);
  float colorSeed = bright.x > faint.x ? bright.y : faint.y;

  // Twinkle: unique phase/speed per star via its hash seed.
  float twinkle = 0.7 + 0.3 * sin(u_time * (1.5 + colorSeed * 3.0) + colorSeed * 40.0);
  brightness *= twinkle;

  // Subtle color temperature: cooler (blue-white) for high seed
  // values, warmer (pale yellow) for low ones — real starlight
  // varies this way and it reads as far less artificial than pure white.
  vec3 coolTint = vec3(0.75, 0.85, 1.0);
  vec3 warmTint = vec3(1.0, 0.92, 0.8);
  vec3 starColor = mix(warmTint, coolTint, colorSeed);

  fragColor = vec4(starColor * brightness * visibility, brightness * visibility);
}
