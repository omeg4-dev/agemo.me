// /jerkcraft: splash text, hotbar navigation, and the live scoreboard.

const DATA = 'https://dactylus.app/mc/stats/data';

const SPLASHES = [
  'Now with Bedrock!', 'Invite only!', 'Pearls load chunks!', '11 skills!',
  'Treecapitator!', 'Trade safely!', 'Also try Terraria!', '100% vanilla client!',
  'Ask in Discord!', 'Mana!', 'Sell it on /ah!',
];

export const BOARDS = {
  playtime: { key: 'playtimeTicks', fmt: (v) => `${Math.round(v / 72000)} h` },
  blocks: { key: 'blocksMined', fmt: (v) => v.toLocaleString('en') },
  kills: { key: 'mobKills', fmt: (v) => v.toLocaleString('en') },
  walked: { key: 'distanceWalkedCm', fmt: (v) => `${(v / 100000).toFixed(1)} km` },
  deaths: { key: 'deaths', fmt: (v) => v.toLocaleString('en') },
};

/** Rank players for one board: highest first, missing values dropped. */
export function rank(players, board, limit = 10) {
  const { key } = BOARDS[board];
  return players
    .filter((p) => Number.isFinite(p[key]) && p[key] > 0)
    .sort((a, b) => b[key] - a[key] || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function summary(players) {
  const ticks = players.reduce((n, p) => n + (p.playtimeTicks || 0), 0);
  return {
    players: players.length,
    hours: Math.round(ticks / 72000),
    online: players.filter((p) => p.online).length,
  };
}

export function ago(ms, now = Date.now()) {
  const m = Math.round((now - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function renderBoard(list, players, board) {
  const top = rank(players, board);
  list.replaceChildren();
  if (!top.length) {
    list.append(el('li', 'mc-board__msg', 'Nobody on this board yet.'));
    return;
  }
  const { key, fmt } = BOARDS[board];
  const max = top[0][key];
  top.forEach((p, i) => {
    const li = el('li');
    li.append(el('span', 'mc-rank', `#${i + 1}`));
    const head = el('img', 'mc-head');
    head.alt = '';
    head.width = 32;
    head.height = 32;
    head.loading = 'lazy';
    // Bedrock players have a "." prefix and no Java skin; they keep the dirt square.
    if (!p.name.startsWith('.')) head.src = `https://mc-heads.net/avatar/${p.uuid}/32`;
    head.addEventListener('error', () => head.removeAttribute('src'), { once: true });
    li.append(head);
    const name = el('span', 'mc-name', p.name);
    if (p.online) name.append(el('small', null, '● online'));
    li.append(name, el('span', 'mc-val', fmt(p[key])));
    const bar = el('span', 'mc-bar');
    const fill = el('span');
    fill.style.width = `${Math.max(3, (p[key] / max) * 100).toFixed(1)}%`;
    bar.append(fill);
    li.append(bar);
    list.append(li);
  });
}

async function loadStats(root) {
  const list = root.querySelector('[data-board-list]');
  const updated = root.querySelector('[data-updated]');
  try {
    const get = (path) => fetch(`${DATA}/${path}`, { cache: 'no-cache', signal: AbortSignal.timeout(8000) })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
    const [meta, roster] = await Promise.all([get('meta.json'), get('players.json')]);
    // The roster has playtime and deaths; the rest is in each player's file.
    const players = await Promise.all(roster.map((p) =>
      get(`player/${p.uuid}.json`).then((full) => ({ ...p, ...full })).catch(() => p)));

    const s = summary(players);
    for (const [k, v] of Object.entries(s)) {
      const n = root.querySelector(`[data-k="${k}"]`);
      if (n) n.textContent = v.toLocaleString('en');
    }
    if (meta.generatedAtEpochMs) updated.textContent = `Updated ${ago(meta.generatedAtEpochMs)}, straight from the server.`;

    const tabs = [...root.querySelectorAll('[data-board]')];
    const select = (tab, focus) => {
      for (const t of tabs) {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      }
      root.querySelector('[data-board-panel]')?.setAttribute('aria-labelledby', tab.id);
      renderBoard(list, players, tab.dataset.board);
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        select(tabs[(i + step + tabs.length) % tabs.length], true);
      });
    });
    select(tabs[0]);
    root.dataset.loaded = 'true';
  } catch {
    list.replaceChildren(el('li', 'mc-board__msg', 'The scoreboard can’t be reached right now. Try again in a minute.'));
    root.dataset.loaded = 'error';
  }
}

function initHotbar() {
  const slots = [...document.querySelectorAll('[data-slot]')];
  const mark = (id) => slots.forEach((s) => {
    if (s.dataset.slot === id) s.setAttribute('aria-current', 'true');
    else s.removeAttribute('aria-current');
  });
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return;
    const n = Number(e.key);
    if (n >= 1 && n <= slots.length) {
      e.preventDefault();
      slots[n - 1].click();
    }
  });
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) mark(en.target.id);
  }, { rootMargin: '-45% 0px -50% 0px' });
  for (const s of slots) {
    const target = document.getElementById(s.dataset.slot);
    if (target) io.observe(target);
  }
}

export function initJerkcraft() {
  const splash = document.querySelector('[data-splash]');
  if (splash) splash.textContent = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
  initHotbar();
  const stats = document.querySelector('[data-stats]');
  if (stats) loadStats(stats);
}
