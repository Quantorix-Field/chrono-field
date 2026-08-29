#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_sunAltitude;   // radians, negative = below horizon
uniform float u_sunAzimuth;    // radians
uniform float u_moonAltitude;
uniform float u_moonAzimuth;
uniform float u_moonPhase;     // 0 = new, 0.5 = full, 1 = new again
uniform float u_cloudcover;    // 0..1
uniform float u_visibility;    // meters

const float PI = 3.14159265359;

vec2 celestialToScreen(float altitude, float azimuth) {
  float x = 0.5 + (azimuth / PI) * 0.5;
  float y = 1.0 - (altitude / (PI * 0.5)) * 0.85 - 0.05;
  return vec2(x, y);
}

void main() {
  vec2 uv = v_uv;

  float sunHeight = clamp((u_sunAltitude + 0.15) / 0.4, 0.0, 1.0);
  float dayFactor = smoothstep(0.0, 1.0, sunHeight);

  vec3 nightZenith = vec3(0.02, 0.03, 0.08);
  vec3 nightHorizon = vec3(0.05, 0.06, 0.12);
  vec3 dayZenith = vec3(0.15, 0.40, 0.75);
  vec3 dayHorizon = vec3(0.65, 0.75, 0.85);
  vec3 duskHorizon = vec3(0.95, 0.55, 0.30);

  vec3 zenithColor = mix(nightZenith, dayZenith, dayFactor);
  vec3 horizonColor = mix(nightHorizon, dayHorizon, dayFactor);

  float twilightWarmth = 1.0 - clamp(abs(u_sunAltitude) / 0.25, 0.0, 1.0);
  horizonColor = mix(horizonColor, duskHorizon, twilightWarmth * 0.7);

  float verticalT = clamp(1.0 - uv.y, 0.0, 1.0);
  vec3 skyColor = mix(horizonColor, zenithColor, pow(verticalT, 0.6));

  // Sun disc + glow.
  vec2 sunPos = celestialToScreen(u_sunAltitude, u_sunAzimuth);
  float sunDist = distance(uv, sunPos) * (u_resolution.x / u_resolution.y);
  float sunDisc = smoothstep(0.025, 0.018, sunDist);
  float sunGlow = smoothstep(0.25, 0.0, sunDist) * 0.4;
  vec3 sunColor = mix(vec3(1.0, 0.6, 0.3), vec3(1.0, 0.95, 0.85), dayFactor);
  if (u_sunAltitude > -0.2) {
    skyColor += sunColor * (sunDisc * 1.5 + sunGlow) * clamp(u_sunAltitude / 0.2 + 0.5, 0.0, 1.0);
  }

  // Moon disc with simple phase shading.
  vec2 moonPos = celestialToScreen(u_moonAltitude, u_moonAzimuth);
  float moonDist = distance(uv, moonPos) * (u_resolution.x / u_resolution.y);
  float moonDisc = smoothstep(0.02, 0.014, moonDist);
  if (moonDisc > 0.0 && u_moonAltitude > -0.05) {
    float phaseAngle = (u_moonPhase - 0.5) * 2.0;
    vec2 localUv = (uv - moonPos) / 0.02;
    float litSide = sign(phaseAngle) * localUv.x;
    float terminator = smoothstep(-abs(phaseAngle), abs(phaseAngle), -litSide);
    float lit = mix(1.0, terminator, abs(phaseAngle));
    vec3 moonColor = vec3(0.9, 0.9, 0.85) * lit;
    skyColor = mix(skyColor, moonColor, moonDisc * clamp(1.0 - dayFactor * 1.5, 0.0, 1.0));
  }

  // Low visibility (fog/haze) desaturates and lightens toward a haze color.
  // Cloud tinting now happens in the dedicated clouds pass, not here.
  float fogAmount = 1.0 - clamp(u_visibility / 10000.0, 0.0, 1.0);
  vec3 hazeColor = vec3(0.75, 0.75, 0.78);
  skyColor = mix(skyColor, hazeColor, fogAmount * 0.5);

  fragColor = vec4(skyColor, 1.0);
}
