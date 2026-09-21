// /games: the bar clock, the channel preview, and videos that respect
// reduced motion.

export function clockParts(d) {
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return { time, date };
}

function initClock() {
  const t = document.querySelector('[data-time]');
  const d = document.querySelector('[data-date]');
  if (!t || !d) return;
  const tick = () => {
    const p = clockParts(new Date());
    t.textContent = p.time;
    d.textContent = p.date;
  };
  tick();
  setInterval(tick, 15_000);
}

function initPreview() {
  const dialog = document.querySelector('[data-preview]');
  const raw = document.getElementById('games-data');
  if (!dialog || !raw || typeof dialog.showModal !== 'function') return;
  const games = JSON.parse(raw.textContent);
  const set = (sel, text) => { dialog.querySelector(sel).textContent = text; };
  let opener = null;
  document.querySelectorAll('[data-game]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = games[Number(btn.dataset.game)];
      set('[data-pv-icon]', g.icon);
      set('[data-pv-name]', g.name);
      set('[data-pv-players]', `${g.players} ${g.players === '1' ? 'player' : 'players'}`);
      set('[data-pv-body]', g.body);
      opener = btn;
      dialog.showModal();
    });
  });
  // A click on the backdrop closes it, like tapping outside a menu.
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => opener?.focus());
}

function initVideos() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const videos = [...document.querySelectorAll('video')];
  const apply = () => {
    for (const v of videos) {
      if (reduce.matches) { v.pause(); v.removeAttribute('autoplay'); v.controls = true; }
    }
  };
  apply();
  reduce.addEventListener?.('change', apply);
  // preload="none" keeps them off the critical path; start each one as it nears the screen.
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting && !reduce.matches) v.play().catch(() => {});
      else if (!e.isIntersecting) v.pause();
    }
  }, { rootMargin: '200px' });
  videos.forEach((v) => io.observe(v));
}

export function initGames() {
  initClock();
  initPreview();
  initVideos();
}
