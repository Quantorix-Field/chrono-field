#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_precipitation;  // mm, drives density/opacity
uniform float u_isSnow;         // 0.0 = rain, 1.0 = snow
uniform float u_windSpeed;      // arbitrary units, drives horizontal drift
uniform float u_sunAltitude;    // radians, drives tint/visibility

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Rain: thin, fast, near-vertical streaks with a slight wind slant.
float rainLayer(vec2 uv, float speed, float density, float seed) {
  // Slant the sampling space by wind before tiling into streak cells —
  // this is what makes rain fall at an angle instead of straight down.
  vec2 slanted = uv + vec2(u_windSpeed * 0.15, 0.0) * uv.y;
  vec2 p = slanted * vec2(40.0, 8.0) + vec2(seed, -u_time * speed);

  vec2 cell = floor(p);
  vec2 local = fract(p) - 0.5;

  float h = hash(cell + seed);
  if (h < 1.0 - density) return 0.0;

  // Streak shape: narrow horizontally, elongated vertically.
  float streak = smoothstep(0.05, 0.0, abs(local.x)) *
                 smoothstep(0.5, 0.1, abs(local.y));
  return streak;
}

// Snow: soft round flakes drifting slowly with gentle horizontal sway.
float snowLayer(vec2 uv, float speed, float density, float seed) {
  float sway = sin(u_time * 0.6 + seed * 10.0) * 0.03;
  vec2 p = uv * vec2(25.0, 25.0) + vec2(seed + sway, -u_time * speed);

  vec2 cell = floor(p);
  vec2 local = fract(p) - 0.5;

  float h = hash(cell + seed);
  if (h < 1.0 - density) return 0.0;

  float size = mix(0.08, 0.18, hash(cell + seed + 5.0));
  float flake = smoothstep(size, 0.0, length(local));
  return flake;
}

void main() {
  vec2 uv = v_uv;
  uv.x *= u_resolution.x / u_resolution.y;

  if (u_precipitation <= 0.01) {
    fragColor = vec4(0.0);
    return;
  }

  // Precipitation intensity (mm) maps to density, clamped so heavy
  // storms don't fully white out the screen.
  float density = clamp(u_precipitation / 10.0, 0.05, 0.85);

  float accum = 0.0;

  if (u_isSnow > 0.5) {
    // Two depth layers: slow/large (near) and fast/small (far) —
    // gives a sense of depth instead of one flat plane of flakes.
    accum += snowLayer(uv, 0.15, density, 1.0) * 0.9;
    accum += snowLayer(uv * 1.6, 0.25, density * 0.7, 7.0) * 0.6;
  } else {
    // Rain: three streak layers at different speeds/angles read as
    // a much denser downpour than one layer ever could.
    accum += rainLayer(uv, 2.5, density, 1.0);
    accum += rainLayer(uv * 1.3, 3.2, density * 0.8, 12.0) * 0.7;
    accum += rainLayer(uv * 0.8, 1.8, density * 0.6, 25.0) * 0.5;
  }

  accum = clamp(accum, 0.0, 1.0);

  // Darker tint at night (less ambient light catching each drop/flake),
  // brighter/whiter tint in daylight.
  float dayFactor = clamp((u_sunAltitude + 0.15) / 0.4, 0.0, 1.0);
  vec3 rainColor = mix(vec3(0.5, 0.55, 0.65), vec3(0.75, 0.8, 0.9), dayFactor);
  vec3 snowColor = vec3(0.95, 0.96, 1.0);
  vec3 color = mix(rainColor, snowColor, u_isSnow);

  fragColor = vec4(color, accum * 0.8);
}
