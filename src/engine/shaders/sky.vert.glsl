#version 300 es

// Fullscreen triangle vertex shader.
// No transforms, no camera — the fragment shader does all
// the actual work by reading screen-space position directly.

in vec2 a_position;
out vec2 v_uv;

void main() {
  // Map clip-space [-1, 1] to UV [0, 1] for the fragment shader.
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
