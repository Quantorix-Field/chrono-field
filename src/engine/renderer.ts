/* ============================================
   RENDERER
   WebGL orchestration: compiles shaders, owns
   the GPU pipeline, and exposes a small update
   API. All the actual sky/light math lives in
   the shader files — this file only wires the
   pipeline together and keeps it alive safely.
============================================ */
import type { SkyRenderState } from '@/types';
import skyVertSrc from './shaders/sky.vert.glsl?raw';
import skyFragSrc from './shaders/sky.frag.glsl?raw';

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

  // Shaders can be freed once linked — the program keeps its own copy.
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failed: ${log}`);
  }
  return program;
}

export function createRenderer(canvas: HTMLCanvasElement): RendererHandle {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) throw new Error('WebGL2 is not supported on this device');

  const program = createProgram(gl, skyVertSrc, skyFragSrc);

  // Fullscreen triangle — cheaper than a quad (no diagonal seam,
  // one less vertex), a standard trick for full-screen shader passes.
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );

  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // Cache uniform locations once — looking these up every frame is
  // a common source of unnecessary GPU-driver overhead.
  const uniforms = {
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    sunAltitude: gl.getUniformLocation(program, 'u_sunAltitude'),
    sunAzimuth: gl.getUniformLocation(program, 'u_sunAzimuth'),
    moonAltitude: gl.getUniformLocation(program, 'u_moonAltitude'),
    moonAzimuth: gl.getUniformLocation(program, 'u_moonAzimuth'),
    moonPhase: gl.getUniformLocation(program, 'u_moonPhase'),
    cloudcover: gl.getUniformLocation(program, 'u_cloudcover'),
    visibility: gl.getUniformLocation(program, 'u_visibility'),
    time: gl.getUniformLocation(program, 'u_time'),
  };

  let latestState: SkyRenderState | null = null;
  let rafId = 0;
  let destroyed = false;
  const startTime = performance.now();

  function frame() {
    if (destroyed || !gl) return;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, (performance.now() - startTime) / 1000);

    if (latestState) {
      gl.uniform1f(uniforms.sunAltitude, latestState.sunAltitude);
      gl.uniform1f(uniforms.sunAzimuth, latestState.sunAzimuth);
      gl.uniform1f(uniforms.moonAltitude, latestState.moonAltitude);
      gl.uniform1f(uniforms.moonAzimuth, latestState.moonAzimuth);
      gl.uniform1f(uniforms.moonPhase, latestState.moonPhase);
      gl.uniform1f(uniforms.cloudcover, latestState.cloudcover / 100);
      gl.uniform1f(uniforms.visibility, latestState.visibility);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  return {
    update(state: SkyRenderState) {
      // Just stores the latest state — the running frame loop above
      // picks it up on the next tick, so updates are always in sync
      // with an actual paint rather than forcing an extra draw call.
      latestState = state;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      gl.deleteProgram(program);
      gl.deleteBuffer(positionBuffer);
      gl.deleteVertexArray(vao);
    },
  };
}
