#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_cloudcover;   // 0..1
uniform float u_sunAltitude;  // radians, drives lighting/tinting
uniform float u_windDirection; // radians
uniform float u_windSpeed;    // arbitrary units, drives drift speed

// Standard 2D value noise — cheap, no texture lookups, tileable
// enough for a drifting cloud layer at screen scale.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// Fractal Brownian Motion: layers noise at increasing frequency and
// decreasing amplitude — this is what gives clouds their "puffy at
// large scale, wispy at small scale" look instead of flat blobs.
// Standing in for true 3D volumetric noise at a fraction of the cost.
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = v_uv;
  uv.x *= u_resolution.x / u_resolution.y;

  // Drift the noise field over time in the wind's direction —
  // this is what makes clouds appear to actually move rather than
  // just fade in place.
  vec2 wind = vec2(cos(u_windDirection), sin(u_windDirection)) * u_windSpeed * 0.02;
  vec2 driftedUv = uv * 3.0 + wind * u_time;

  float shape = fbm(driftedUv);

  // Cloud cover percentage raises or lowers the noise threshold —
  // more cover means more of the noise field reads as "cloud."
  float coverage = smoothstep(0.55 - u_cloudcover * 0.5, 0.75 - u_cloudcover * 0.5, shape);

  // Soft self-shadowing: sample the noise slightly offset to fake
  // depth/thickness variation within the cloud mass, not just a flat tone.
  float thickness = fbm(driftedUv * 1.7 + 4.2);
  float shading = mix(0.55, 1.0, thickness);

  // Tint clouds by sun altitude — warm/pink near sunrise-sunset,
  // grey-white at midday, dark blue-grey at night.
  vec3 dayTint = vec3(1.0, 1.0, 1.0);
  vec3 duskTint = vec3(1.0, 0.75, 0.6);
  vec3 nightTint = vec3(0.15, 0.16, 0.22);

  float dayFactor = clamp((u_sunAltitude + 0.1) / 0.3, 0.0, 1.0);
  float twilightFactor = 1.0 - clamp(abs(u_sunAltitude) / 0.2, 0.0, 1.0);

  vec3 cloudColor = mix(nightTint, dayTint, dayFactor);
  cloudColor = mix(cloudColor, duskTint, twilightFactor * 0.6);
  cloudColor *= shading;

  // Alpha carries both coverage and a gentle edge falloff so clouds
  // composite over the sky shader rather than punching in as hard shapes.
  float alpha = coverage * clamp(u_cloudcover * 1.3, 0.0, 1.0);

  fragColor = vec4(cloudColor, alpha);
}
