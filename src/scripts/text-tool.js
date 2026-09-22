// /text — types your text out by hand.

import { hand, glyph, word, rng, seedFrom, segments, PAPERS } from './handwriting.js';
import { drawSheet, canvasToBlob } from './sheet-canvas.js';

const STORE = 'agemo:text';
const SAMPLE = `Anything you paste here comes out in handwriting.

Maths works too, between dollar signs:

$$\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s} = \\prod_{p \\text{ prime}} \\left(1 - p^{-s}\\right)^{-1}$$

Drag the slider to decide how neat the hand is.`;

const state = {
  text: '',
  neat: 0.55,
  paper: 'lined',
  ink: 'navy',
  size: 30,
};

const INKS = {
  navy: '#1c3f8f',
  black: '#1d1f24',
  red: '#a8281f',
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? '{}');
    if (typeof saved.text === 'string') state.text = saved.text;
    if (Number.isFinite(saved.neat)) state.neat = saved.neat;
    if (PAPERS.includes(saved.paper)) state.paper = saved.paper;
    if (INKS[saved.ink]) state.ink = saved.ink;
    if (Number.isFinite(saved.size)) state.size = saved.size;
  } catch { /* first visit, or storage is off */ }
}

function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* fine */ }
}

/** Builds one span per character, each with its own small mistakes. */
function writeText(value, h, rand, into) {
  const lines = value.split('\n');
  lines.forEach((line, i) => {
    if (i > 0) into.append(document.createElement('br'));
    for (const chunk of line.split(/(\s+)/)) {
      if (!chunk) continue;
      if (/^\s+$/.test(chunk)) {
        into.append(document.createTextNode(chunk));
        continue;
      }
      const w = word(rand, h);
      const el = document.createElement('span');
      el.className = 'hw-w';
      el.dataset.k = w.skew.toFixed(2);
      el.style.setProperty('--wy', `${w.dy.toFixed(3)}em`);
      el.style.setProperty('--wk', `${w.skew.toFixed(2)}deg`);
      for (const ch of chunk) {
        const g = glyph(rand, h);
        const span = document.createElement('span');
        span.className = g.loose ? 'hw-g hw-g--loose' : 'hw-g';
        span.textContent = ch;
        span.dataset.r = g.rot.toFixed(2);
        span.dataset.x = g.dx.toFixed(4);
        span.dataset.y = g.dy.toFixed(4);
        span.dataset.s = g.scale.toFixed(3);
        span.dataset.a = g.alpha.toFixed(3);
        span.style.cssText =
          `--r:${g.rot.toFixed(2)}deg;--x:${g.dx.toFixed(4)}em;--y:${g.dy.toFixed(4)}em;` +
          `--s:${g.scale.toFixed(3)};font-weight:${g.weight};opacity:${g.alpha.toFixed(3)}`;
        el.append(span);
      }
      into.append(el);
    }
  });
}

// KaTeX is a third of a megabyte, so it is fetched the first time a sheet
// actually contains maths, and never on a page of plain prose.
let katexPromise = null;
let katex = null;
function loadKatex() {
  katexPromise ??= (() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/katex.css';
    document.head.append(link);
    return import('katex').then((mod) => { katex = mod.default ?? mod; return katex; });
  })();
  return katexPromise;
}

function writeMath(seg, into) {
  const el = document.createElement(seg.display ? 'div' : 'span');
  el.className = seg.display ? 'hw-math hw-math--block' : 'hw-math';
  if (!katex) {
    el.classList.add('hw-math--waiting');
    el.textContent = seg.value;
    return into.append(el);
  }
  try {
    // KaTeX's own escaping is the sanitiser here: trust is off, so the input
    // can only produce maths, never markup.
    el.innerHTML = katex.renderToString(seg.value, {
      displayMode: seg.display,
      throwOnError: false,
      strict: false,
      trust: false,
    });
  } catch (err) {
    el.className = 'hw-math hw-math--bad';
    el.textContent = seg.value;
    el.title = err.message;
  }
  into.append(el);
}

/** Keeps the maths typesetter out of the way of the first paint. */
function whenIdle(fn) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 1200 });
  else setTimeout(fn, 200);
}

export function initTextTool() {
  const root = document.querySelector('[data-tool]');
  if (!root) return;

  const input = root.querySelector('[data-input]');
  const sheet = root.querySelector('[data-sheet]');
  const ink = root.querySelector('[data-ink]');
  const status = root.querySelector('[data-status]');
  const turbulence = document.querySelector('[data-turbulence]');
  const displace = document.querySelector('[data-displace]');
  const neatInput = root.querySelector('[data-neat]');
  const sizeInput = root.querySelector('[data-size]');
  const counter = root.querySelector('[data-count]');

  let frame = 0;
  let announce = 0;

  function say(message) {
    status.textContent = message;
    clearTimeout(announce);
    if (message) announce = setTimeout(() => { status.textContent = ''; }, 4000);
  }

  function render() {
    frame = 0;
    const h = hand(state.neat);
    const rand = rng(seedFrom(`${state.text}|${state.neat.toFixed(2)}`));
    ink.replaceChildren();
    const parts = segments(state.text);
    for (const seg of parts) {
      if (seg.type === 'text') writeText(seg.value, h, rand, ink);
      else writeMath(seg, ink);
    }
    if (!katex && parts.some((p) => p.type === 'math')) whenIdle(() => loadKatex().then(render));
    sheet.dataset.paper = state.paper;
    sheet.style.setProperty('--ink', INKS[state.ink]);
    sheet.style.setProperty('--hand-size', `${state.size}px`);
    sheet.dataset.neat = state.neat.toFixed(2);
    turbulence?.setAttribute('baseFrequency', h.grain.toFixed(4));
    displace?.setAttribute('scale', h.wobble.toFixed(2));
    if (counter) counter.textContent = `${state.text.length} characters`;
    save();
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };

  async function toCanvas() {
    const h = hand(state.neat);
    const style = getComputedStyle(sheet);
    return drawSheet({
      sheet,
      ink,
      paper: state.paper,
      colors: {
        paper: style.getPropertyValue('--paper-fill').trim() || '#fffdf8',
        rule: style.getPropertyValue('--paper-rule').trim() || '#c9d7ea',
      },
      line: parseFloat(style.getPropertyValue('--rule-step')) || 32,
      wobbleAmount: h.wobble * 0.45,
      seed: seedFrom(state.text) || 7,
      scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
    });
  }

  // Controls
  input.addEventListener('input', () => {
    state.text = input.value;
    schedule();
  });

  for (const button of root.querySelectorAll('[data-paper-option]')) {
    button.addEventListener('click', () => {
      state.paper = button.dataset.paperOption;
      for (const b of root.querySelectorAll('[data-paper-option]')) {
        b.setAttribute('aria-checked', String(b === button));
        b.tabIndex = b === button ? 0 : -1;
      }
      schedule();
    });
  }
  for (const button of root.querySelectorAll('[data-ink-option]')) {
    button.addEventListener('click', () => {
      state.ink = button.dataset.inkOption;
      for (const b of root.querySelectorAll('[data-ink-option]')) {
        b.setAttribute('aria-checked', String(b === button));
        b.tabIndex = b === button ? 0 : -1;
      }
      schedule();
    });
  }
  neatInput.addEventListener('input', () => {
    state.neat = Number(neatInput.value) / 100;
    schedule();
  });
  sizeInput.addEventListener('input', () => {
    state.size = Number(sizeInput.value);
    schedule();
  });

  root.querySelector('[data-clear]')?.addEventListener('click', () => {
    state.text = '';
    input.value = '';
    input.focus();
    schedule();
    say('Cleared.');
  });

  root.querySelector('[data-sample]')?.addEventListener('click', () => {
    state.text = SAMPLE;
    input.value = SAMPLE;
    schedule();
  });

  root.querySelector('[data-paste]')?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return say('The clipboard is empty.');
      state.text = text;
      input.value = text;
      schedule();
      say('Pasted.');
    } catch {
      say('Your browser won’t hand over the clipboard — paste into the box instead.');
    }
  });

  const copyButton = root.querySelector('[data-copy]');
  copyButton?.addEventListener('click', async () => {
    if (!state.text.trim()) return say('Write something first.');
    const blob = toCanvas().then(canvasToBlob);
    try {
      // Safari needs the ClipboardItem built in the click itself, so it gets
      // the promise rather than the finished blob.
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('unsupported');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      root.dataset.copied = String(Date.now());
      say('Copied as an image. Paste it anywhere.');
    } catch {
      const done = await blob;
      download(done);
      say('Copying isn’t allowed here, so the image was saved instead.');
    }
  });

  function download(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'handwriting.png';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  root.querySelector('[data-save]')?.addEventListener('click', async () => {
    if (!state.text.trim()) return say('Write something first.');
    const canvas = await toCanvas();
    root.dataset.exported = `${canvas.width}x${canvas.height}`;
    download(await canvasToBlob(canvas));
    say('Saved as handwriting.png.');
  });

  // Start
  load();
  if (!state.text) state.text = SAMPLE;
  input.value = state.text;
  neatInput.value = String(Math.round(state.neat * 100));
  sizeInput.value = String(state.size);
  for (const b of root.querySelectorAll('[data-paper-option]')) {
    const on = b.dataset.paperOption === state.paper;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  }
  for (const b of root.querySelectorAll('[data-ink-option]')) {
    const on = b.dataset.inkOption === state.ink;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  }
  render();
  document.fonts?.ready.then(render);
  root.dataset.ready = 'true';
}
