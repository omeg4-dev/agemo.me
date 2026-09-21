// /bot: a departures board that flips into place, and a clock.

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/_:';

/** The frame-by-frame text a flap shows while settling on `target`. */
export function settle(target, frame, lockAt) {
  let out = '';
  for (let i = 0; i < target.length; i++) {
    const ch = target[i];
    if (ch === ' ' || frame >= lockAt + i) out += ch;
    else out += GLYPHS[(frame * 7 + i * 13) % GLYPHS.length];
  }
  return out;
}

function flipAll(board) {
  const rows = [...board.querySelectorAll('tbody tr')];
  const jobs = [];
  rows.forEach((row, r) => {
    const lockAt = 4 + r * 2;
    for (const el of row.querySelectorAll('[data-flap]')) jobs.push({ el, text: el.textContent, lockAt, cells: null });
    const cells = [...row.querySelectorAll('[data-cell]')];
    if (cells.length) jobs.push({ el: null, text: cells.map((c) => c.dataset.cell).join(''), lockAt, cells });
  });
  const last = Math.max(...jobs.map((j) => j.lockAt + j.text.length));
  let frame = 0;
  const tick = () => {
    for (const j of jobs) {
      const now = settle(j.text, frame, j.lockAt);
      if (j.cells) {
        j.cells.forEach((c, i) => {
          if (c.textContent !== now[i]) {
            c.textContent = now[i];
            c.classList.remove('is-flipping');
            void c.offsetWidth;
            c.classList.add('is-flipping');
          }
        });
      } else if (j.el.textContent !== now) {
        j.el.textContent = now;
      }
    }
    frame += 1;
    if (frame <= last) setTimeout(tick, 45);
    else board.dataset.settled = 'true';
  };
  tick();
}

function initClock() {
  const el = document.querySelector('[data-clock]');
  if (!el) return;
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
  const tick = () => { el.textContent = fmt.format(new Date()); };
  tick();
  setInterval(tick, 15_000);
}

export function initBoard() {
  initClock();
  const board = document.querySelector('[data-board]');
  if (!board) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    board.dataset.settled = 'true';
    return;
  }
  // Only flip once the board is on screen, so the effect isn't spent unseen.
  if (!('IntersectionObserver' in window)) return flipAll(board);
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { io.disconnect(); flipAll(board); }
  });
  io.observe(board);
}
