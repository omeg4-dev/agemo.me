// keys.js: Global keybinds listener, subscriber API, and overlay controller
import { notify } from './notify.js';

let isOverlayOpen = false;
let previousFocused = null;
let siteKeysSuspended = false;
const subscribers = new Set();
let keyHistory = [];

export function setSiteKeysSuspended(val) {
  siteKeysSuspended = Boolean(val);
}

export function subscribeKeys(sub) {
  subscribers.add(sub);
  return () => subscribers.delete(sub);
}

export function openKeysOverlay() {
  const overlay = document.getElementById('keys-overlay');
  if (!overlay) return;
  previousFocused = document.activeElement;
  isOverlayOpen = true;
  overlay.classList.add('is-open');
  const closeBtn = overlay.querySelector('.keys__close-btn');
  if (closeBtn) closeBtn.focus();
}

export function closeKeysOverlay() {
  const overlay = document.getElementById('keys-overlay');
  if (!overlay) return;
  isOverlayOpen = false;
  overlay.classList.remove('is-open');
  if (previousFocused && typeof previousFocused.focus === 'function') {
    previousFocused.focus();
  }
}

export function toggleKeysOverlay() {
  if (isOverlayOpen) {
    closeKeysOverlay();
  } else {
    openKeysOverlay();
  }
}

export function initKeys() {
  window.addEventListener('agemo:keys', toggleKeysOverlay);

  const overlay = document.getElementById('keys-overlay');
  if (overlay) {
    const closeBtn = overlay.querySelector('.keys__close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeKeysOverlay);

    const scrim = overlay.querySelector('.keys__scrim');
    if (scrim) scrim.addEventListener('click', closeKeysOverlay);

    // Trap focus inside dialog
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const focusables = Array.from(overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  window.addEventListener('keyup', (e) => {
    for (const sub of subscribers) {
      if (sub.onKeyUp) sub.onKeyUp(e);
    }
  });

  window.addEventListener('blur', () => {
    for (const sub of subscribers) {
      if (sub.onBlur) sub.onBlur();
    }
  });

  window.addEventListener('keydown', (e) => {
    // Ignore while locked
    if (document.documentElement.classList.contains('locked')) return;

    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    const isEditable = document.activeElement ? document.activeElement.isContentEditable : false;
    const isInput = activeTag === 'input' || activeTag === 'textarea' || isEditable;

    if (isInput) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('agemo:launcher'));
      }
      return;
    }

    // Always notify subscribers for keycap lighting (never preventDefault here)
    for (const sub of subscribers) {
      if (sub.onKeyDown) sub.onKeyDown(e);
    }

    // Easter egg: typing 'agemo' anywhere within 1.5s mirrors <main>
    if (e.key && e.key.length === 1 && /[a-z]/i.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const now = Date.now();
      keyHistory.push({ char: e.key.toLowerCase(), time: now });
      keyHistory = keyHistory.filter((k) => now - k.time <= 1500);
      const seq = keyHistory.map((k) => k.char).join('');
      if (seq.endsWith('agemo')) {
        keyHistory = [];
        const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const main = document.querySelector('main');
        if (!isReduced && main) {
          main.style.transition = 'transform var(--dur-2) var(--ease)';
          main.style.transform = 'scaleX(-1)';
          setTimeout(() => {
            main.style.transform = '';
            setTimeout(() => {
              main.style.transition = '';
            }, 300);
          }, 1400);
        }
        notify({
          title: 'omega ⟷ agemo',
          body: 'palindrome easter egg',
          icon: '⟷',
        });
      }
    }

    if (e.key === 'Escape') {
      if (isOverlayOpen) {
        e.preventDefault();
        closeKeysOverlay();
      }
      return;
    }

    // Check if site keybinds are suspended (e.g. game has focus)
    if (siteKeysSuspended || document.activeElement?.closest('[data-gamehub-tv]')) {
      return;
    }

    if (e.altKey) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('agemo:launcher'));
      return;
    }

    if (e.ctrlKey || e.metaKey) return;

    // Number keys 1-5
    if (['1', '2', '3', '4', '5'].includes(e.key)) {
      e.preventDefault();
      const wsNames = ['home', 'work', 'machine', 'links', 'reach'];
      const targetId = `ws-${wsNames[Number(e.key) - 1]}`;
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth' });
        history.replaceState(null, '', `#${targetId}`);
      }
      return;
    }

    if (e.key === '/') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('agemo:launcher'));
      return;
    }

    if (e.key === '?') {
      e.preventDefault();
      toggleKeysOverlay();
      return;
    }

    if (e.key === 't') {
      e.preventDefault();
      const ws1 = document.getElementById('ws-home');
      if (ws1) ws1.scrollIntoView({ behavior: 'smooth' });
      const termInput = document.querySelector('.term__input');
      if (termInput) {
        setTimeout(() => termInput.focus(), 120);
      }
      return;
    }

    if (e.key === 'j' || e.key === 'k') {
      e.preventDefault();
      const wsIds = ['ws-home', 'ws-work', 'ws-machine', 'ws-links', 'ws-reach'];
      const scrollMid = window.scrollY + window.innerHeight / 2;
      let curr = 0;
      wsIds.forEach((id, idx) => {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= scrollMid) {
          curr = idx;
        }
      });

      const next = e.key === 'j' ? Math.min(wsIds.length - 1, curr + 1) : Math.max(0, curr - 1);
      const targetEl = document.getElementById(wsIds[next]);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth' });
        history.replaceState(null, '', `#${wsIds[next]}`);
      }
      return;
    }
  });
}
