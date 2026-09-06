// Site-wide ambient background — "the deep". A fixed, full-viewport WebGL1
// layer that screen-blends over the CSS aurora in Ambient.astro: flowing
// caustics, three parallax layers of drifting motes, a cursor light, and
// grain. Reads --depth (0 at the top of the document, 1 at the bottom) so
// the water genuinely gets deeper and colder as you scroll.
//
// Same contract as mirror.js: this is progressive enhancement. Any failure
// bails silently and Ambient.astro's animated CSS aurora remains the
// background on its own.

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform vec2  u_res;
uniform vec2  u_mouse;
uniform float u_time;
uniform float u_depth;
uniform vec3  u_accent;
uniform vec3  u_accent2;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i),               hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Three octaves is the performance ceiling here: the domain warp below
// calls fbm three times per pixel, so every octave added costs 3x.
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

// One layer of rising motes. Branchless: step() rather than an if, so the
// GPU does not serialise divergent lanes.
float motes(vec2 p, float scale, float rise, float t) {
  vec2 q = p * scale;
  q.y -= t * rise;
  q.x += sin(q.y * 0.6 + t * 0.3) * 0.25;   // lazy sideways drift
  vec2 i = floor(q);
  vec2 f = fract(q);
  float h = hash(i);
  vec2 c = vec2(hash(i + 11.3), hash(i + 27.7));
  float d = distance(f, c);
  return smoothstep(0.10, 0.0, d) * step(0.88, h) * (0.35 + 0.65 * hash(i + 5.1));
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = u_time * 0.06;

  // Domain-warped flow field. The warp is what stops this reading as
  // plain noise and makes it read as moving water.
  vec2 q = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 + vec2(5.2, 1.3) - t));
  float f = fbm(p * 1.6 + 2.4 * q);

  // Ridged bands off the flow field = caustics.
  float caustic = pow(abs(sin(f * 6.2831 + u_time * 0.22)), 4.0);

  // Light comes from above and dies with depth, both down the viewport
  // and down the document.
  float fromTop = smoothstep(1.15, -0.15, uv.y);
  caustic *= fromTop * (1.0 - u_depth * 0.72);

  float m = motes(p, 9.0,  0.05, u_time) * 0.55
          + motes(p, 5.0,  0.03, u_time) * 0.85
          + motes(p, 2.7,  0.017, u_time) * 1.0;
  m *= 0.55 + 0.45 * fromTop;

  // Cursor light, lagged in JS so it trails the pointer.
  float md = distance(p, vec2(u_mouse.x * aspect, u_mouse.y));
  float glow = exp(-md * 3.1) * 0.085;

  // Slow vertical shafts, barely there — they give the field a direction.
  float shaft = pow(abs(sin(p.x * 1.9 + fbm(p * 0.8 + t * 0.4) * 3.0)), 8.0)
              * fromTop * 0.05 * (1.0 - u_depth * 0.5);

  vec3 warm = mix(u_accent, u_accent2, 0.35 + 0.65 * sin(f * 3.0 + u_time * 0.1) * 0.5 + 0.5);

  vec3 col = vec3(0.0);
  col += warm * caustic * 0.13;
  col += u_accent2 * m * 0.30;
  col += u_accent * glow;
  col += u_accent2 * shaft;

  // Edge vignette so the light never touches the frame.
  float vig = smoothstep(1.25, 0.35, distance(uv, vec2(0.5)));
  col *= vig;

  // Animated grain kills the banding that 8-bit gradients this dark
  // otherwise show on wide screens.
  col += (hash(uv * u_res + fract(u_time)) - 0.5) * 0.016;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) || 'ambient shader compile failed');
  }
  return s;
}

function rgb(varName, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(raw);
  if (!hex) return fallback;
  const n = parseInt(hex[1], 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

export function initAmbient() {
  const canvas = document.querySelector('[data-ambient-canvas]');
  if (!canvas) return;

  // Reduced motion: never start. Ambient.astro's aurora is already frozen
  // by base.css's global kill switch, so the background becomes a static
  // gradient — which is the correct outcome, not a degraded one.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let gl;
  try {
    gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
      powerPreference: 'low-power', failIfMajorPerformanceCaveat: false,
    });
  } catch { return; }
  if (!gl) return;

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'ambient link failed');
    }
  } catch { return; }

  gl.useProgram(program);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (n) => gl.getUniformLocation(program, n);
  const uRes = u('u_res'), uMouse = u('u_mouse'), uTime = u('u_time');
  const uDepth = u('u_depth'), uAccent = u('u_accent'), uAccent2 = u('u_accent2');

  gl.uniform3fv(uAccent, rgb('--accent', [0.2, 0.694, 1]));
  gl.uniform3fv(uAccent2, rgb('--accent-2', [0.47, 0.663, 1]));

  // Caustics are soft and low-frequency, so half resolution is visually
  // free and quarters the fragment cost. Capped so a 4K display does not
  // quietly become a 4K shader.
  const SCALE = 0.5;
  const MAX = 1280;
  function resize() {
    const w = Math.min(window.innerWidth * SCALE, MAX);
    const h = w * (window.innerHeight / Math.max(window.innerWidth, 1));
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Pointer, lagged. target is where the cursor is, mouse chases it.
  const target = { x: 0.5, y: 0.6 };
  const mouse = { x: 0.5, y: 0.6 };
  window.addEventListener('pointermove', (e) => {
    target.x = e.clientX / window.innerWidth;
    target.y = 1 - e.clientY / window.innerHeight;
  }, { passive: true });

  let raf = 0;
  let running = true;
  let last = 0;
  const FRAME = 1000 / 30;   // 30fps is plenty for motion this slow, and
                             // halves the battery cost of a always-on layer.
  const start = performance.now();

  // Adaptive frame budget.
  //
  // The shader is trivial on a GPU and ruinous without one: on a software
  // rasteriser each full-viewport frame costs ~150ms, so a 30fps loop simply
  // owns the main thread. Measured under a 6x CPU throttle this layer alone
  // was 6.3s of main-thread work and 3.7s of total blocking time — the page
  // stayed visually correct and stopped responding.
  //
  // Rather than guess at device class from hardwareConcurrency or a UA
  // string, watch what the machine actually delivers: sample the first second
  // of real frames, and if the loop could not hold a usable rate, ask for
  // frames far less often so the layer takes a small slice of the machine
  // instead of all of it.
  //
  // Back off rather than stop. An earlier version retired the loop outright,
  // which reads well in a benchmark and badly in life: on any machine without
  // a GPU — a VM, a remote desktop, a Linux box with no driver — the living
  // background the page is built around would simply never appear. Slow and
  // present beats absent. Only context loss retires it.
  const PROBE_MS = 1000;
  const MIN_FPS = 12;
  const BACKOFF = 4;      // leave the machine ~3/4 of the time it was using
  let frameGap = FRAME;
  let drawn = 0;
  let probed = false;

  function retire() {
    running = false;
    cancelAnimationFrame(raf);
    canvas.removeAttribute('data-active');
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (now - last < frameGap) return;
    last = now;

    const elapsed = now - start;
    if (!probed && elapsed >= PROBE_MS) {
      probed = true;
      const fps = drawn / (elapsed / 1000);
      if (fps < MIN_FPS) frameGap = 1000 / Math.max(fps / BACKOFF, 0.4);
    }
    drawn += 1;

    mouse.x += (target.x - mouse.x) * 0.045;
    mouse.y += (target.y - mouse.y) * 0.045;

    const depth = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--depth')) || 0;

    gl.uniform1f(uTime, (now - start) / 1000);
    gl.uniform1f(uDepth, depth);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Same recovery contract as mirror.js: a lost context must drop
  // data-active so the CSS aurora is visibly the background again,
  // rather than leaving a dead black canvas screen-blended over it.
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    retire();
  });

  // Stop burning frames on a tab nobody is looking at.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (canvas.hasAttribute('data-active')) {
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  });

  canvas.setAttribute('data-active', '');
  raf = requestAnimationFrame(frame);
}
