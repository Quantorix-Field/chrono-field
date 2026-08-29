/* ============================================
   PARTICLE SYSTEM
   GPU-instanced rain/snow particles — each one
   a point with its own depth, speed, and size,
   drawn as instanced geometry rather than CPU-
   simulated sprites. Complements precip.frag.glsl
   (screen-space streaks) with actual discrete
   particles for close-up depth.
============================================ */

const MAX_PARTICLES = 800;

interface ParticleSystemHandle {
  setIntensity: (precipitation: number, isSnow: boolean, windSpeed: number, windDirection: number) => void;
  render: (time: number) => void;
  destroy: () => void;
}

// Vertex shader: expands each point into a small camera-facing quad
// (rain: thin vertical streak, snow: soft round dot) and advances
// its fall position over time entirely on the GPU — no per-frame
// CPU loop over particles, which is what keeps this cheap at 800+ count.
const PARTICLE_VERT = `#version 300 es
in vec2 a_corner;       // -1..1 quad corner, shared geometry
in vec3 a_seed;         // x: horizontal seed, y: depth (0=far,1=near), z: fall-speed seed
in float a_startOffset; // staggers particles so they don't fall in sync

uniform float u_time;
uniform float u_isSnow;
uniform float u_windSpeed;
uniform float u_windDirection;
uniform vec2 u_resolution;

out float v_depth;
out float v_isSnow;

void main() {
  float fallSpeed = mix(0.6, 1.4, a_seed.z) * (a_seed.y * 0.7 + 0.3);
  float t = fract(u_time * fallSpeed * 0.15 + a_startOffset);

  // Depth controls both fall speed (near = faster, parallax-style)
  // and horizontal drift from wind (near particles drift more).
  float windDrift = cos(u_windDirection) * u_windSpeed * 0.05 * a_seed.y;

  vec2 pos;
  pos.x = fract(a_seed.x + windDrift * t) * 2.0 - 1.0;
  pos.y = 1.0 - t * 2.2;

  // Near particles (higher depth) render larger — real parallax cue.
  float size = mix(0.004, 0.014, a_seed.y) * (u_isSnow > 0.5 ? 1.6 : 1.0);
  vec2 aspectCorrect = vec2(u_resolution.y / u_resolution.x, 1.0);

  // Rain corners stretch vertically into streaks; snow stays round.
  vec2 shape = mix(vec2(1.0, 3.0), vec2(1.0, 1.0), u_isSnow);
  vec2 offset = a_corner * size * shape * aspectCorrect;

  gl_Position = vec4(pos + offset, 0.0, 1.0);
  v_depth = a_seed.y;
  v_isSnow = u_isSnow;
}
`;

const PARTICLE_FRAG = `#version 300 es
precision highp float;

in float v_depth;
in float v_isSnow;
out vec4 fragColor;

void main() {
  // Far particles are dimmer and slightly desaturated — cheap depth cue
  // without any actual z-buffer or fog pass.
  float brightness = mix(0.35, 1.0, v_depth);
  vec3 rainColor = vec3(0.7, 0.8, 0.95) * brightness;
  vec3 snowColor = vec3(0.95, 0.96, 1.0) * brightness;
  vec3 color = mix(rainColor, snowColor, v_isSnow);

  fragColor = vec4(color, brightness * 0.8);
}
`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create particle shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Particle shader compile failed: ${log}`);
  }
  return shader;
}

export function createParticleSystem(gl: WebGL2RenderingContext): ParticleSystemHandle {
  const vert = compileShader(gl, gl.VERTEX_SHADER, PARTICLE_VERT);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, PARTICLE_FRAG);
  const program = gl.createProgram();
  if (!program) throw new Error('Could not create particle program');
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Particle program link failed: ${log}`);
  }

  // Shared quad geometry — one tiny 4-vertex square, instanced
  // MAX_PARTICLES times rather than uploading unique geometry per particle.
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const cornerBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  const cornerLoc = gl.getAttribLocation(program, 'a_corner');
  gl.enableVertexAttribArray(cornerLoc);
  gl.vertexAttribPointer(cornerLoc, 2, gl.FLOAT, false, 0, 0);

  // Per-particle instance data, generated once and left static —
  // motion comes entirely from u_time in the vertex shader, so this
  // buffer never needs re-uploading on every frame.
  const seeds = new Float32Array(MAX_PARTICLES * 3);
  const startOffsets = new Float32Array(MAX_PARTICLES);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    seeds[i * 3 + 0] = Math.random();       // horizontal seed
    seeds[i * 3 + 1] = Math.random();       // depth
    seeds[i * 3 + 2] = Math.random();       // fall-speed seed
    startOffsets[i] = Math.random();
  }

  const seedBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, seedBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
  const seedLoc = gl.getAttribLocation(program, 'a_seed');
  gl.enableVertexAttribArray(seedLoc);
  gl.vertexAttribPointer(seedLoc, 3, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(seedLoc, 1); // one value per instance, not per vertex

  const offsetBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, startOffsets, gl.STATIC_DRAW);
  const offsetLoc = gl.getAttribLocation(program, 'a_startOffset');
  gl.enableVertexAttribArray(offsetLoc);
  gl.vertexAttribPointer(offsetLoc, 1, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(offsetLoc, 1);

  const uniforms = {
    time: gl.getUniformLocation(program, 'u_time'),
    isSnow: gl.getUniformLocation(program, 'u_isSnow'),
    windSpeed: gl.getUniformLocation(program, 'u_windSpeed'),
    windDirection: gl.getUniformLocation(program, 'u_windDirection'),
    resolution: gl.getUniformLocation(program, 'u_resolution'),
  };

  let activeCount = 0; // how many of MAX_PARTICLES are actually drawn
  let isSnow = 0;
  let windSpeed = 0;
  let windDirection = 0;

  return {
    setIntensity(precipitation, snowFlag, wind, direction) {
      // Particle count scales with precipitation intensity, capped
      // at MAX_PARTICLES — light drizzle uses far fewer than a storm.
      activeCount = Math.round(Math.min(1, precipitation / 8) * MAX_PARTICLES);
      isSnow = snowFlag ? 1 : 0;
      windSpeed = wind;
      windDirection = (direction * Math.PI) / 180;
    },

    render(time: number) {
      if (activeCount <= 0) return;

      gl.useProgram(program);
      gl.bindVertexArray(vao);

      gl.uniform1f(uniforms.time, time);
      gl.uniform1f(uniforms.isSnow, isSnow);
      gl.uniform1f(uniforms.windSpeed, windSpeed);
      gl.uniform1f(uniforms.windDirection, windDirection);
      gl.uniform2f(uniforms.resolution, gl.canvas.width, gl.canvas.height);

      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, activeCount);
    },

    destroy() {
      gl.deleteProgram(program);
      gl.deleteBuffer(cornerBuffer);
      gl.deleteBuffer(seedBuffer);
      gl.deleteBuffer(offsetBuffer);
      gl.deleteVertexArray(vao);
    },
  };
}
