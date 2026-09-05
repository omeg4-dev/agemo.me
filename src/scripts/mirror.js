// Waterline reflection. Renders the wordmark AGEMO into a rippling surface
// below the hero's midline. Pure WebGL1, no libraries, ~4 KB.
// Bails out silently on any failure; Hero.astro's CSS reflection remains.

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
uniform sampler2D u_text;
uniform vec2  u_res;
uniform vec2  u_mouse;
uniform float u_time;
uniform vec3  u_accent;

void main() {
  vec2 uv = v_uv;

  // Depth: distortion grows the further below the waterline we are.
  float depth = 1.0 - uv.y;

  // Travelling ripples.
  float w = sin(uv.x * 22.0 - u_time * 1.1) * 0.0038
          + sin(uv.x * 41.0 + u_time * 0.7) * 0.0021;

  // A wake that follows the cursor.
  float d = distance(uv * u_res / u_res.y, u_mouse * u_res / u_res.y);
  w += sin(d * 34.0 - u_time * 2.4) * 0.0075 * exp(-d * 3.4);

  uv.x += w * (0.35 + depth * 1.9);
  uv.y += w * 0.45;

  // The texture is drawn upright; flipping y here makes it a reflection.
  vec4 tex = texture2D(u_text, vec2(uv.x, 1.0 - uv.y));

  vec3 col = mix(u_accent, vec3(1.0), 0.18) * tex.a;
  float fade = smoothstep(0.0, 0.72, uv.y);
  float shimmer = 0.94 + 0.06 * sin(uv.y * 60.0 + u_time * 1.6);

  gl_FragColor = vec4(col * shimmer, tex.a * fade * 0.72);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed');
  }
  return s;
}

// Renders "agemo" to a 2D canvas we can sample as a texture — upside down,
// because this is a reflection.
//
// The glyphs are mirrored HERE rather than in the shader, and that is
// deliberate. The obvious-looking alternative, dropping the `1.0 - uv.y`
// from the fragment shader's texture lookup, does flip the image but also
// moves it: WebGL's uv.y runs bottom-up while a canvas texture uploads
// top-down, so `1.0 - uv.y` is what aligns texture row 0 with canvas row 0
// in the first place. Remove it and the wordmark lands at the bottom of
// the canvas, a full half-viewport away from the waterline it is supposed
// to be reflecting in. Mirroring the glyphs in place keeps every existing
// coordinate — texture layout, shader sampling, canvas offset — untouched.
function wordmarkTexture(gl, width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  const size = Math.min(width * 0.19, height * 0.62);
  const top = height * 0.06;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `${size}px "Instrument Serif", Georgia, serif`;
  ctx.letterSpacing = '0.06em';
  ctx.save();
  // Mirror about the text band's own axis, so the glyphs turn over while
  // still occupying rows [top, top + size].
  ctx.translate(0, top * 2 + size);
  ctx.scale(1, -1);
  ctx.fillText('agemo', width / 2, top);
  ctx.restore();

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

export function initMirror() {
  const canvas = document.querySelector('[data-mirror-canvas]');
  if (!canvas) return null;

  // Spec §6.3 and §6.4: never under reduced motion, never below 768px.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  if (window.innerWidth < 768) return null;

  // preserveDrawingBuffer: true so a pixel readback taken from outside the
  // render loop (as our e2e test does) can still see the last drawn frame
  // instead of racing the browser's implicit clear-on-composite.
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;

  let raf = 0;
  const mouse = { x: 0.5, y: 0.5 };

  try {
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || 'link failed');
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = {
      res: gl.getUniformLocation(prog, 'u_res'),
      mouse: gl.getUniformLocation(prog, 'u_mouse'),
      time: gl.getUniformLocation(prog, 'u_time'),
      accent: gl.getUniformLocation(prog, 'u_accent'),
      text: gl.getUniformLocation(prog, 'u_text'),
    };
    gl.uniform3f(u.accent, 0.2, 0.694, 1.0); // #33B1FF
    gl.uniform1i(u.text, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let tex = null;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (!w || !h) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.res, w, h);
      if (tex) gl.deleteTexture(tex);
      tex = wordmarkTexture(gl, w, h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
    };

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / r.width;
      mouse.y = 1 - (e.clientY - r.top) / r.height;
    };

    const start = performance.now();
    let running = true;
    const frame = () => {
      if (!running) return;
      gl.uniform1f(u.time, (performance.now() - start) / 1000);
      gl.uniform2f(u.mouse, mouse.x, mouse.y);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });

    // Stop burning GPU when the hero is off-screen or the tab is hidden.
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !running) { running = true; frame(); }
      else if (!entry.isIntersecting) { running = false; cancelAnimationFrame(raf); }
    });
    io.observe(canvas);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!running) { running = true; frame(); }
    });

    // Recover from a lost WebGL context (GPU reset, driver crash, tab
    // eviction) by falling back to the CSS reflection instead of leaving a
    // dead, blank canvas with data-active still set.
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      running = false;
      cancelAnimationFrame(raf);
      canvas.removeAttribute('data-active');
    });

    canvas.setAttribute('data-active', '');
    frame();
    return { stop: () => { running = false; cancelAnimationFrame(raf); } };
  } catch (err) {
    cancelAnimationFrame(raf);
    canvas.removeAttribute('data-active');
    return null; // CSS fallback stands.
  }
}
