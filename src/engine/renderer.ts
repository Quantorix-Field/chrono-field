/* ============================================
   RENDERER
   WebGL orchestration for all four shader passes:
   sky (opaque base) → stars → clouds → precip,
   each blended on top of the last. Uniform
   locations are cached per-program at setup,
   never re-queried inside the frame loop.
============================================ */
import type { SkyRenderState } from '@/types';

import fullscreenVertSrc from './shaders/sky.vert.glsl?raw';
import skyFragSrc from './shaders/sky.frag.glsl?raw';
import cloudsFragSrc from './shaders/clouds.frag.glsl?raw';
import starsFragSrc from './shaders/stars.frag.glsl?raw';
import precipFragSrc from './shaders/precip.frag.glsl?raw';

interface RendererHandle {
  update: (state: SkyRenderState) => void;
  destroy: () => void;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  if (!program) throw new Error('Could not create program');
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failed: ${log}`);
  }
  return program;
}

// All four passes share the same fullscreen-triangle vertex shader
// and the same VAO/buffer — only the fragment program differs.
function getUniformLocations(gl: WebGL2RenderingContext, program: WebGLProgram, names: string[]) {
  const map: Record<string, WebGLUniformLocation | null> = {};
  for (const name of names) {
    map[name] = gl.getUniformLocation(program, name);
  }
  return map;
}

export function createRenderer(canvas: HTMLCanvasElement): RendererHandle {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) throw new Error('WebGL2 is not supported on this device');

  const skyProgram = createProgram(gl, fullscreenVertSrc, skyFragSrc);
  const starsProgram = createProgram(gl, fullscreenVertSrc, starsFragSrc);
  const cloudsProgram = createProgram(gl, fullscreenVertSrc, cloudsFragSrc);
  const precipProgram = createProgram(gl, fullscreenVertSrc, precipFragSrc);

  // Shared fullscreen triangle geometry — bound once, reused by every pass.
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  // Attribute location can differ per program in theory, but since
  // all four share the same vertex shader source, it's identical —
  // bind it once against any of the programs.
  const posLoc = gl.getAttribLocation(skyProgram, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const skyUniforms = getUniformLocations(gl, skyProgram, [
    'u_resolution', 'u_sunAltitude', 'u_sunAzimuth',
    'u_moonAltitude', 'u_moonAzimuth', 'u_moonPhase',
    'u_cloudcover', 'u_visibility',
  ]);
  const starsUniforms = getUniformLocations(gl, starsProgram, [
    'u_resolution', 'u_time', 'u_sunAltitude', 'u_visibility',
  ]);
  const cloudsUniforms = getUniformLocations(gl, cloudsProgram, [
    'u_resolution', 'u_time', 'u_cloudcover', 'u_sunAltitude',
    'u_windDirection', 'u_windSpeed',
  ]);
  const precipUniforms = getUniformLocations(gl, precipProgram, [
    'u_resolution', 'u_time', 'u_precipitation', 'u_isSnow',
    'u_windSpeed', 'u_sunAltitude',
  ]);

  let latestState: SkyRenderState | null = null;
  let rafId = 0;
  let destroyed = false;
  const startTime = performance.now();

  function frame() {
    if (destroyed || !gl) return;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindVertexArray(vao);

    const time = (performance.now() - startTime) / 1000;
    const s = latestState;

    // --- Pass 1: Sky (opaque base, no blending) ---
    gl.disable(gl.BLEND);
    gl.useProgram(skyProgram);
    gl.uniform2f(skyUniforms.u_resolution, canvas.width, canvas.height);
    if (s) {
      gl.uniform1f(skyUniforms.u_sunAltitude, s.sunAltitude);
      gl.uniform1f(skyUniforms.u_sunAzimuth, s.sunAzimuth);
      gl.uniform1f(skyUniforms.u_moonAltitude, s.moonAltitude);
      gl.uniform1f(skyUniforms.u_moonAzimuth, s.moonAzimuth);
      gl.uniform1f(skyUniforms.u_moonPhase, s.moonPhase);
      gl.uniform1f(skyUniforms.u_cloudcover, s.cloudcover / 100);
      gl.uniform1f(skyUniforms.u_visibility, s.visibility);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // --- Pass 2: Stars (premultiplied-alpha blend) ---
    // Output is already premultiplied in the shader, so ONE / ONE_MINUS_SRC_ALPHA
    // is correct here rather than the standard SRC_ALPHA / ONE_MINUS_SRC_ALPHA.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(starsProgram);
    gl.uniform2f(starsUniforms.u_resolution, canvas.width, canvas.height);
    gl.uniform1f(starsUniforms.u_time, time);
    if (s) {
      gl.uniform1f(starsUniforms.u_sunAltitude, s.sunAltitude);
      gl.uniform1f(starsUniforms.u_visibility, s.visibility);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // --- Pass 3: Clouds (standard alpha blend) ---
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(cloudsProgram);
    gl.uniform2f(cloudsUniforms.u_resolution, canvas.width, canvas.height);
    gl.uniform1f(cloudsUniforms.u_time, time);
    if (s) {
      gl.uniform1f(cloudsUniforms.u_cloudcover, s.cloudcover / 100);
      gl.uniform1f(cloudsUniforms.u_sunAltitude, s.sunAltitude);
      gl.uniform1f(cloudsUniforms.u_windDirection, (s.winddirection * Math.PI) / 180);
      gl.uniform1f(cloudsUniforms.u_windSpeed, s.windspeed);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // --- Pass 4: Precipitation (standard alpha blend, drawn last so
    // rain/snow visibly falls in front of clouds and sky) ---
    gl.useProgram(precipProgram);
    gl.uniform2f(precipUniforms.u_resolution, canvas.width, canvas.height);
    gl.uniform1f(precipUniforms.u_time, time);
    if (s) {
      gl.uniform1f(precipUniforms.u_precipitation, s.precipitation);
      gl.uniform1f(precipUniforms.u_isSnow, s.condition === 'snow' ? 1.0 : 0.0);
      gl.uniform1f(precipUniforms.u_windSpeed, s.windspeed);
      gl.uniform1f(precipUniforms.u_sunAltitude, s.sunAltitude);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  return {
    update(state: SkyRenderState) {
      latestState = state;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      gl.deleteProgram(skyProgram);
      gl.deleteProgram(starsProgram);
      gl.deleteProgram(cloudsProgram);
      gl.deleteProgram(precipProgram);
      gl.deleteBuffer(positionBuffer);
      gl.deleteVertexArray(vao);
    },
  };
}
