// Drives the hero: scroll turns OMEGA into its reflection, and on a fine
// pointer the mirror's edge follows the cursor.

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// Each letter's share of the scroll. Partners (O/A, M/G) move together so
// they cross at the same moment; E, on the axis, only turns over.
const WINDOWS = [
  [0.04, 0.8],
  [0.14, 0.88],
  [0.22, 0.74],
  [0.14, 0.88],
  [0.04, 0.8],
];
// Depth while crossing, in em. Partners pass on opposite sides of the glass.
const DEPTH = [1.1, -0.7, 0, 0.7, -1.1];
const SPIN = [-1, 1, 1, -1, 1];

/** Offset that moves letter i into the slot its mirror partner occupies. */
export function reversedOffsets(lefts, widths) {
  const n = lefts.length;
  const start = lefts[0];
  const out = [];
  for (let i = 0; i < n; i++) {
    let left = start;
    for (let j = n - 1; j > i; j--) left += widths[j];
    out.push(left - lefts[i]);
  }
  return out;
}

export function letterTransform(i, p, dx, em) {
  const [a, b] = WINDOWS[i];
  const t = ease(clamp((p - a) / (b - a)));
  const arc = Math.sin(Math.PI * t);
  const x = t * dx;
  const z = arc * DEPTH[i] * em;
  const y = arc * (i === 2 ? 0 : -0.04 * Math.sign(DEPTH[i]) * em);
  const r = SPIN[i] * 180 * t;
  return `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateY(${r.toFixed(2)}deg)`;
}

export function initMirror() {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;
  const stick = hero.querySelector('[data-stick]');
  const words = [...hero.querySelectorAll('.word')];
  const sets = words.map((w) => [...w.querySelectorAll('.word__l')]);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');

  let dx = [0, 0, 0, 0, 0];
  let em = 0;
  let p = -1;
  let flipped = false;
  let visible = true;
  let queued = 0;

  function measure() {
    const ls = sets[0];
    dx = reversedOffsets(ls.map((l) => l.offsetLeft), ls.map((l) => l.offsetWidth));
    em = parseFloat(getComputedStyle(words[0]).fontSize) || 0;
    p = -1;
    render();
  }

  function progress() {
    const span = hero.offsetHeight - window.innerHeight;
    if (span <= 0) return 0;
    return clamp(-hero.getBoundingClientRect().top / span);
  }

  function render() {
    queued = 0;
    if (reduced.matches) return;
    const next = progress();
    if (next === p) return;
    p = next;
    for (let i = 0; i < 5; i++) {
      const tf = letterTransform(i, p, dx[i], em);
      for (const set of sets) set[i].style.transform = tf;
    }
    const nowFlipped = p > 0.5;
    if (nowFlipped !== flipped) {
      flipped = nowFlipped;
      hero.dataset.flipped = String(flipped);
    }
  }

  const queue = () => {
    if (!queued && visible) queued = requestAnimationFrame(render);
  };

  // The mirror's edge. It rests on the E and follows a fine pointer.
  let axis = 0.5;
  let axisTarget = 0.5;
  let axisRaf = 0;
  function stepAxis() {
    axis += (axisTarget - axis) * 0.14;
    if (Math.abs(axisTarget - axis) < 0.0005) axis = axisTarget;
    stick.style.setProperty('--axis', `${(axis * 100).toFixed(3)}%`);
    axisRaf = axis === axisTarget ? 0 : requestAnimationFrame(stepAxis);
  }
  function aim(v) {
    axisTarget = clamp(v, 0.04, 0.96);
    if (!axisRaf) axisRaf = requestAnimationFrame(stepAxis);
  }
  stick.addEventListener('pointermove', (e) => {
    if (!fine.matches || reduced.matches || e.pointerType !== 'mouse') return;
    // Chrome sends a synthetic move at (0,0) after scrolling with no real
    // pointer; following it would slam the mirror into the corner.
    if (e.clientX === 0 && e.clientY === 0) return;
    aim(e.clientX / window.innerWidth);
  }, { passive: true });
  stick.addEventListener('pointerleave', () => aim(0.5), { passive: true });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) queue();
    }).observe(hero);
  }

  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  reduced.addEventListener?.('change', () => {
    if (reduced.matches) for (const set of sets) for (const l of set) l.style.transform = '';
    measure();
  });

  measure();
  document.fonts?.ready.then(measure);
  hero.dataset.ready = 'true';
}
