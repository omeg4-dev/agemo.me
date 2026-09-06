// Card interactions for the Work slabs. Three effects, all optional
// enhancements over a card that is already complete without them:
//
//   1. --rx/--ry  : a 3D tilt that leans the slab toward the pointer
//   2. --mx/--my  : the pointer's position inside the slab, in percent, which
//                   CSS turns into a specular highlight
//   3. name scramble: the repo name decodes from noise on first hover
//
// Every one of these is a hover affordance layered on a link that already
// works, so the whole module bails silently rather than degrading.

const GLYPHS = '!<>-_\\/[]{}—=+*^?#@$%&0123456789abcdefghijklmnopqrstuvwxyz';
const MAX_TILT = 5; // degrees. Past ~6 the text starts to visibly shear.

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function tilt(card) {
  let frame = 0;

  const onMove = (event) => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const r = card.getBoundingClientRect();
      // Guard against a zero-sized rect (display:none, not yet laid out):
      // dividing by it yields Infinity and pins the card at a 90° flip.
      if (r.width === 0 || r.height === 0) return;
      const px = (event.clientX - r.left) / r.width;
      const py = (event.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${(px * 100).toFixed(2)}%`);
      card.style.setProperty('--my', `${(py * 100).toFixed(2)}%`);
      card.style.setProperty('--ry', `${((px - 0.5) * 2 * MAX_TILT).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${((0.5 - py) * 2 * MAX_TILT).toFixed(2)}deg`);
    });
  };

  const onLeave = () => {
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  };

  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerleave', onLeave);
  // A pointercancel (touch interrupted by a scroll) never produces a
  // pointerleave, so without this the slab stays stuck at its last angle.
  card.addEventListener('pointercancel', onLeave);
}

function scramble(el) {
  const final = el.textContent;
  let running = false;

  el.addEventListener('pointerenter', () => {
    if (running) return;
    running = true;

    const chars = [...final];
    // Each character settles at its own moment, spread across the run, so
    // the name resolves left-to-right rather than all at once.
    const settleAt = chars.map((_, i) => 120 + i * (380 / Math.max(chars.length, 1)));
    const started = performance.now();

    const step = (now) => {
      const elapsed = now - started;
      let done = true;
      el.textContent = chars
        .map((c, i) => {
          if (elapsed >= settleAt[i] || c === ' ' || c === '-') return c;
          done = false;
          return GLYPHS[(Math.random() * GLYPHS.length) | 0];
        })
        .join('');
      if (done) {
        // Belt and braces. `done` is only true once the map above returned
        // the original character for every position, so this assignment is
        // unobservable by construction — mutation testing confirmed no test
        // can discriminate it. Kept as a guard, not claimed as behaviour.
        el.textContent = final;
        running = false;
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

export function initCards() {
  // Reduced motion: no tilt, no decode. The slab keeps its colour-and-shadow
  // hover state from CSS, so the affordance survives intact.
  if (reduced()) return;

  for (const card of document.querySelectorAll('[data-slab]')) {
    tilt(card);
    const name = card.querySelector('[data-scramble]');
    if (name) scramble(name);
  }
}
