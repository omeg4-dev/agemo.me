// launcher.js: Noctalia/rofi-style command palette
import reposData from '../data/repos.json' with { type: 'json' };
import linksData from '../data/links.json' with { type: 'json' };
import { setAccent } from './accent.js';

let isLauncherOpen = false;
let previousFocused = null;
let activeIdx = 0;
let currentItems = [];

function fuzzyMatch(query, text) {
  if (!query) return { score: 1, indices: [] };
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  let qIdx = 0;
  let score = 0;
  let consecutive = 0;
  const indices = [];

  for (let i = 0; i < t.length; i++) {
    if (qIdx < q.length && t[i] === q[qIdx]) {
      indices.push(i);
      qIdx++;
      // Word boundary bonus
      const isStart = i === 0 || /[\s\-_/.:]/.test(t[i - 1]);
      if (isStart) score += 15;
      // Consecutive bonus
      consecutive++;
      score += consecutive * 5;
    } else {
      consecutive = 0;
    }
  }

  if (qIdx === q.length) {
    // Shorter text penalty
    score -= t.length;
    return { score, indices };
  }
  return null;
}

function buildAllItems() {
  const items = [];

  // Workspaces
  const workspaces = [
    { num: 1, name: 'home', title: '1. home', sub: 'mirror, terminal, now' },
    { num: 2, name: 'work', title: '2. work', sub: 'pinned projects' },
    { num: 3, name: 'machine', title: '3. machine', sub: 'fastfetch, palette, keybinds' },
    { num: 4, name: 'links', title: '4. links', sub: 'pointers vault' },
    { num: 5, name: 'reach', title: '5. reach', sub: 'discord, github' },
  ];

  for (const ws of workspaces) {
    items.push({
      id: `ws-${ws.name}`,
      title: ws.title,
      sub: ws.sub,
      group: 'workspaces',
      searchText: `${ws.num} ${ws.name} workspace ${ws.sub}`,
      run: () => {
        const el = document.getElementById(`ws-${ws.name}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          history.replaceState(null, '', `#ws-${ws.name}`);
        }
      },
    });
  }

  // Projects
  for (const repo of reposData.pinned) {
    items.push({
      id: `proj-${repo.name}`,
      title: repo.name,
      sub: repo.description,
      group: 'projects',
      searchText: `${repo.name} ${repo.description} ${repo.language}`,
      run: () => {
        window.open(repo.url, '_blank', 'noopener,noreferrer');
      },
    });
  }

  // Links
  for (const l of linksData.links) {
    let host = l.url;
    try { host = new URL(l.url).host.replace(/^www\./, ''); } catch {}
    items.push({
      id: `link-${l.title}`,
      title: l.title,
      sub: `${host} — ${l.note || 'link'}`,
      group: 'links',
      searchText: `${l.title} ${host} ${l.note || ''}`,
      run: () => {
        window.open(l.url, '_blank', 'noopener,noreferrer');
      },
    });
  }

  // Actions
  items.push({
    id: 'act-lock',
    title: 'lock screen',
    sub: 'lock desktop session',
    group: 'actions',
    searchText: 'lock screen session exit',
    run: () => {
      window.dispatchEvent(new CustomEvent('agemo:lock'));
    },
  });

  items.push({
    id: 'act-keys',
    title: 'show keybinds',
    sub: 'toggle keyboard shortcuts overlay',
    group: 'actions',
    searchText: 'show keybinds keys overlay shortcuts help',
    run: () => {
      window.dispatchEvent(new CustomEvent('agemo:keys'));
    },
  });

  items.push({
    id: 'act-term',
    title: 'focus terminal',
    sub: 'scroll to workspace 1 and focus prompt',
    group: 'actions',
    searchText: 'focus terminal prompt kitty input',
    run: () => {
      const ws1 = document.getElementById('ws-home');
      if (ws1) ws1.scrollIntoView({ behavior: 'smooth' });
      const input = document.querySelector('.term__input');
      if (input) setTimeout(() => input.focus(), 150);
    },
  });

  for (const acc of ['blue', 'cyan', 'green', 'pink', 'purple', 'rose']) {
    items.push({
      id: `act-accent-${acc}`,
      title: `accent: ${acc}`,
      sub: `switch site theme colour to ${acc}`,
      group: 'actions',
      searchText: `accent: ${acc} theme color switch`,
      run: () => {
        setAccent(acc);
      },
    });
  }

  items.push({
    id: 'act-copy-url',
    title: 'copy page url',
    sub: 'copy current page URL to clipboard',
    group: 'actions',
    searchText: 'copy page url share clipboard',
    run: () => {
      try {
        navigator.clipboard.writeText(window.location.href);
      } catch {}
    },
  });

  return items;
}

export function openLauncher(trigger) {
  const root = document.getElementById('launcher-modal');
  if (!root) return;
  previousFocused = trigger || document.activeElement || document.querySelector('[data-launcher-trigger]');
  isLauncherOpen = true;
  root.classList.add('is-open');

  const input = root.querySelector('.launcher__input');
  if (input) {
    input.value = '';
    renderResults('');
    input.focus();
    setTimeout(() => input.focus(), 30);
  }
}

export function closeLauncher() {
  const root = document.getElementById('launcher-modal');
  if (!root) return;
  isLauncherOpen = false;
  root.classList.remove('is-open');

  const target = previousFocused || document.querySelector('[data-launcher-trigger]');
  if (target && typeof target.focus === 'function') {
    target.focus();
  }
}

function renderHighlightedText(container, text, matchIndices) {
  container.textContent = '';
  const idxSet = new Set(matchIndices);

  let currentSpan = null;
  let isMark = false;

  for (let i = 0; i < text.length; i++) {
    const markChar = idxSet.has(i);
    if (currentSpan === null || markChar !== isMark) {
      isMark = markChar;
      currentSpan = document.createElement(isMark ? 'mark' : 'span');
      if (isMark) currentSpan.className = 'launcher__mark';
      container.appendChild(currentSpan);
    }
    currentSpan.textContent += text[i];
  }
}

function renderResults(query) {
  const root = document.getElementById('launcher-modal');
  if (!root) return;

  const listEl = root.querySelector('.launcher__list');
  const emptyEl = root.querySelector('.launcher__empty');
  if (!listEl) return;

  listEl.textContent = '';
  activeIdx = 0;

  const allItems = buildAllItems();
  const trimmed = query.trim();

  if (!trimmed) {
    currentItems = allItems.map((item) => ({ item, indices: [] }));
  } else {
    const scored = [];
    for (const item of allItems) {
      // Test title first, then sub/searchText
      const titleMatch = fuzzyMatch(trimmed, item.title);
      const searchMatch = fuzzyMatch(trimmed, item.searchText);

      if (titleMatch || searchMatch) {
        const score = (titleMatch ? titleMatch.score * 2 : 0) + (searchMatch ? searchMatch.score : 0);
        const indices = titleMatch ? titleMatch.indices : [];
        scored.push({ item, score, indices });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    currentItems = scored;
  }

  if (currentItems.length === 0) {
    if (emptyEl) {
      emptyEl.style.display = 'block';
      emptyEl.textContent = `nothing matches "${query}" — try a workspace number`;
    }
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  currentItems.forEach(({ item, indices }, idx) => {
    const li = document.createElement('li');
    li.className = `launcher__item ${idx === 0 ? 'is-active' : ''}`;
    li.id = `launcher-opt-${item.id}`;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');

    const titleSpan = document.createElement('span');
    titleSpan.className = 'launcher__item-title';
    renderHighlightedText(titleSpan, item.title, indices);

    const subSpan = document.createElement('span');
    subSpan.className = 'launcher__item-sub';
    subSpan.textContent = item.sub;

    const groupBadge = document.createElement('span');
    groupBadge.className = 'launcher__item-badge';
    groupBadge.textContent = item.group;

    li.appendChild(titleSpan);
    li.appendChild(subSpan);
    li.appendChild(groupBadge);

    li.addEventListener('click', () => {
      closeLauncher();
      item.run();
    });

    listEl.appendChild(li);
  });

  updateActiveOption();
}

function updateActiveOption() {
  const root = document.getElementById('launcher-modal');
  if (!root) return;
  const items = Array.from(root.querySelectorAll('.launcher__item'));
  const input = root.querySelector('.launcher__input');

  items.forEach((item, idx) => {
    const isAct = idx === activeIdx;
    item.classList.toggle('is-active', isAct);
    item.setAttribute('aria-selected', isAct ? 'true' : 'false');
    if (isAct) {
      item.scrollIntoView({ block: 'nearest' });
      if (input) input.setAttribute('aria-activedescendant', item.id);
    }
  });
}

export function initLauncher() {
  const root = document.getElementById('launcher-modal');
  if (!root || root._launcherInit) return;
  root._launcherInit = true;

  window.addEventListener('agemo:launcher', openLauncher);
  window.addEventListener('agemo:close-launcher', closeLauncher);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isLauncherOpen) {
      e.preventDefault();
      closeLauncher();
    }
  });

  const scrim = root.querySelector('.launcher__scrim');
  if (scrim) scrim.addEventListener('click', closeLauncher);

  const input = root.querySelector('.launcher__input');
  if (input) {
    input.addEventListener('input', () => {
      renderResults(input.value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeLauncher();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentItems.length > 0) {
          activeIdx = (activeIdx + 1) % currentItems.length;
          updateActiveOption();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentItems.length > 0) {
          activeIdx = (activeIdx - 1 + currentItems.length) % currentItems.length;
          updateActiveOption();
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        activeIdx = 0;
        updateActiveOption();
      } else if (e.key === 'End') {
        e.preventDefault();
        activeIdx = Math.max(0, currentItems.length - 1);
        updateActiveOption();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentItems[activeIdx]) {
          const runFn = currentItems[activeIdx].item.run;
          closeLauncher();
          runFn();
        }
      }
    });
  }
}
