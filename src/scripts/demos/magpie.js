// magpie.js: Live clipboard history demo (memory-only, no persistence)
import { fuzzyMatch } from '../fuzzy.js';
import { notify } from '../notify.js';

function formatRelativeTime(ts) {
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 10) return 'now';
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour}h`;
}

function detectType(text) {
  if (/^#([0-9a-fA-F]{3,8})$/.test(text.trim())) {
    return { type: 'hex', color: text.trim() };
  }
  if (/^https?:\/\//i.test(text.trim())) {
    let host = text.trim();
    try {
      host = new URL(text.trim()).hostname;
    } catch {}
    return { type: 'url', host };
  }
  if (/^(\$|paru|pacman|hyprctl|git|cargo|pnpm|npm|cd|ls|curl|cat|nvim|vim|yay)\b/.test(text.trim())) {
    return { type: 'shell' };
  }
  return { type: 'text' };
}

export function mount(slot) {
  if (!slot) return;
  slot.textContent = '';

  const entries = [
    { text: 'paru -Syu', ts: Date.now() - 120000, isExample: true },
    { text: 'hyprctl reload', ts: Date.now() - 540000, isExample: true },
    { text: '#78a9ff', ts: Date.now() - 3600000, isExample: true },
  ];

  let searchQuery = '';

  const container = document.createElement('div');
  container.className = 'live-magpie';

  // Search input
  const searchWrap = document.createElement('div');
  searchWrap.className = 'live-magpie__search-wrap';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'live-magpie__search';
  searchInput.placeholder = 'search clips…';
  searchInput.setAttribute('aria-label', 'Search clipboard history');
  searchWrap.appendChild(searchInput);
  container.appendChild(searchWrap);

  // Clips list
  const listEl = document.createElement('div');
  listEl.className = 'live-magpie__list';
  listEl.setAttribute('role', 'list');
  container.appendChild(listEl);

  // Empty state
  const emptyEl = document.createElement('div');
  emptyEl.className = 'live-magpie__empty';
  emptyEl.style.display = 'none';
  container.appendChild(emptyEl);

  // Footer note
  const footerEl = document.createElement('footer');
  footerEl.className = 'live-magpie__footer';
  footerEl.textContent = 'lives in this tab only · nothing is saved or sent';
  container.appendChild(footerEl);

  slot.appendChild(container);

  function renderList() {
    listEl.textContent = '';
    const q = searchQuery.trim();

    let visible = [];
    if (!q) {
      visible = entries.map((e) => ({ entry: e, indices: [] }));
    } else {
      entries.forEach((e) => {
        const m = fuzzyMatch(q, e.text);
        if (m) {
          visible.push({ entry: e, score: m.score, indices: m.indices });
        }
      });
      visible.sort((a, b) => b.score - a.score);
    }

    if (visible.length === 0 && q) {
      emptyEl.textContent = `no clip matches "${q}"`;
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';

    visible.forEach(({ entry, indices }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'live-magpie__card';
      btn.setAttribute('role', 'listitem');
      btn.setAttribute('aria-label', `Copy ${entry.text}`);

      const left = document.createElement('div');
      left.className = 'live-magpie__card-left';

      const typeInfo = detectType(entry.text);
      if (typeInfo.type === 'hex') {
        const swatch = document.createElement('span');
        swatch.className = 'live-magpie__swatch';
        swatch.style.background = typeInfo.color;
        left.appendChild(swatch);
      } else if (typeInfo.type === 'url') {
        const urlIcon = document.createElement('span');
        urlIcon.className = 'live-magpie__icon live-magpie__icon--url';
        urlIcon.textContent = '↗';
        left.appendChild(urlIcon);
      } else if (typeInfo.type === 'shell') {
        const promptIcon = document.createElement('span');
        promptIcon.className = 'live-magpie__icon live-magpie__icon--shell';
        promptIcon.textContent = '$';
        left.appendChild(promptIcon);
      }

      const textSpan = document.createElement('span');
      textSpan.className = 'live-magpie__text';

      if (indices && indices.length > 0) {
        const idxSet = new Set(indices);
        let cur = '';
        let isMark = false;
        for (let i = 0; i < entry.text.length; i++) {
          const match = idxSet.has(i);
          if (match !== isMark) {
            if (cur) {
              const span = document.createElement(isMark ? 'mark' : 'span');
              if (isMark) span.className = 'live-magpie__mark';
              span.textContent = cur;
              textSpan.appendChild(span);
            }
            cur = '';
            isMark = match;
          }
          cur += entry.text[i];
        }
        if (cur) {
          const span = document.createElement(isMark ? 'mark' : 'span');
          if (isMark) span.className = 'live-magpie__mark';
          span.textContent = cur;
          textSpan.appendChild(span);
        }
      } else {
        textSpan.textContent = entry.text;
      }
      left.appendChild(textSpan);

      const meta = document.createElement('div');
      meta.className = 'live-magpie__meta';

      if (entry.isExample) {
        const tag = document.createElement('span');
        tag.className = 'live-magpie__tag';
        tag.textContent = 'example';
        meta.appendChild(tag);
      }

      const timeSpan = document.createElement('time');
      timeSpan.className = 'live-magpie__time';
      timeSpan.textContent = formatRelativeTime(entry.ts);
      meta.appendChild(timeSpan);

      btn.appendChild(left);
      btn.appendChild(meta);

      btn.addEventListener('click', async () => {
        let copied = false;
        try {
          await navigator.clipboard.writeText(entry.text);
          copied = true;
        } catch {
          try {
            const ta = document.createElement('textarea');
            ta.value = entry.text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            copied = document.execCommand('copy');
            document.body.removeChild(ta);
          } catch {}
        }

        if (copied) {
          // Move to top
          const curIdx = entries.indexOf(entry);
          if (curIdx > 0) {
            entries.splice(curIdx, 1);
            entries.unshift(entry);
          }
          entry.ts = Date.now();
          entry.isExample = false;

          const flash = document.createElement('span');
          flash.className = 'live-magpie__flash';
          flash.textContent = 'copied!';
          meta.prepend(flash);
          setTimeout(() => flash.remove(), 1200);

          notify({
            title: 'copied to clipboard',
            body: entry.text.slice(0, 32),
            icon: '📋',
          });
        } else {
          notify({
            title: 'copy blocked by the browser',
            body: 'permission denied',
            icon: '⚠',
          });
        }
      });

      listEl.appendChild(btn);
    });
  }

  function addClip(rawText, notifyUser = false) {
    if (!rawText) return;
    const cleaned = rawText.replace(/\s+/g, ' ').trim().slice(0, 140);
    if (!cleaned) return;
    if (entries.length > 0 && entries[0].text === cleaned) return;

    entries.unshift({
      text: cleaned,
      ts: Date.now(),
      isExample: false,
    });

    if (entries.length > 20) {
      entries.pop();
    }

    renderList();

    if (notifyUser) {
      notify({
        title: 'copied to clipboard',
        body: cleaned.slice(0, 32),
        icon: '📋',
      });
    }
  }

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderList();
  });

  // Global copy listener
  const onCopy = (e) => {
    let text = '';
    const sel = document.getSelection();
    if (sel && sel.toString()) {
      text = sel.toString();
    } else {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        const start = active.selectionStart;
        const end = active.selectionEnd;
        if (typeof start === 'number' && typeof end === 'number' && start !== end) {
          text = active.value.substring(start, end);
        }
      }
    }
    if (text) {
      addClip(text, false);
    }
  };

  const onAgemoCopied = (e) => {
    if (e.detail) {
      addClip(e.detail, false);
    }
  };

  document.addEventListener('copy', onCopy);
  document.addEventListener('agemo:copied', onAgemoCopied);

  // 15s timer for relative timestamps
  const timer = setInterval(() => {
    if (!document.hidden && slot.offsetParent !== null) {
      renderList();
    }
  }, 15000);

  renderList();

  return () => {
    document.removeEventListener('copy', onCopy);
    document.removeEventListener('agemo:copied', onAgemoCopied);
    clearInterval(timer);
  };
}
