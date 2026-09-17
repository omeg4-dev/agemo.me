// lock.js: hyprlock session controller
import { triggerWelcomeToast } from './notify.js';

let lockOverlay = null;
let isUnlocking = false;

function updateLockClock() {
  const now = new Date();
  const timeEl = document.getElementById('lock-time');
  const dateEl = document.getElementById('lock-date');

  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  const msToNext = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 50;
  setTimeout(updateLockClock, msToNext);
}

function setInert(state) {
  const targets = [
    document.querySelector('main'),
    document.getElementById('bar'),
    document.querySelector('footer'),
  ].filter(Boolean);

  targets.forEach((el) => {
    if (state) {
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.removeAttribute('inert');
      el.removeAttribute('aria-hidden');
    }
  });
}

let unlockViaKey = false;

export function unlock() {
  if (isUnlocking) return;
  const overlay = document.getElementById('lock-screen') || lockOverlay;
  if (!overlay) return;

  isUnlocking = true;
  document.documentElement.classList.add('unlocking');
  overlay.classList.add('unlocking');

  try {
    sessionStorage.setItem('agemo:unlocked', '1');
  } catch {}

  setInert(false);

  setTimeout(() => {
    document.documentElement.classList.remove('locked', 'unlocking');
    lockOverlay = overlay;
    overlay.remove();
    isUnlocking = false;

    // Focus target: badge on key unlock, suppressed outline tabindex -1 on pointer/wheel unlock
    if (unlockViaKey) {
      const bar = document.getElementById('bar');
      if (bar) {
        const badge = bar.querySelector('.bar__badge');
        if (badge) badge.focus();
      }
    } else {
      let unfocus = document.getElementById('unfocus-target');
      if (!unfocus) {
        unfocus = document.createElement('div');
        unfocus.id = 'unfocus-target';
        unfocus.tabIndex = -1;
        unfocus.style.position = 'fixed';
        unfocus.style.top = '0';
        unfocus.style.left = '0';
        unfocus.style.width = '0';
        unfocus.style.height = '0';
        unfocus.style.outline = 'none';
        unfocus.setAttribute('aria-hidden', 'true');
        document.body.prepend(unfocus);
      }
      unfocus.focus({ preventScroll: true });
    }
    unlockViaKey = false;

    // Signal unlock to wallpaper mirror and terminal
    window.dispatchEvent(new CustomEvent('agemo:unlocked'));
    triggerWelcomeToast();
  }, 550);
}

export function showLock() {
  if (!lockOverlay) {
    lockOverlay = document.getElementById('lock-screen');
  }
  if (!lockOverlay) return;

  try {
    sessionStorage.removeItem('agemo:unlocked');
  } catch {}

  document.documentElement.classList.add('locked');
  lockOverlay.classList.remove('unlocking');
  if (!lockOverlay.parentElement) {
    document.body.appendChild(lockOverlay);
  }
  setInert(true);
  updateLockClock();

  const btn = document.getElementById('lock-unlock-btn');
  if (btn) {
    btn.focus();
    setTimeout(() => btn.focus(), 50);
  }

  bindEvents(lockOverlay);
}

let eventsBound = false;
function bindEvents(overlay) {
  const onTrigger = () => {
    unlockViaKey = false;
    unlock();
  };

  const onKeyDown = (e) => {
    if (!document.documentElement.classList.contains('locked')) return;
    if (e.key === 'Tab') {
      // Focus trap
      e.preventDefault();
      const btn = document.getElementById('lock-unlock-btn');
      if (btn) btn.focus();
      return;
    }
    // Enter, Space, Escape, or any printable key
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape' || e.key.length === 1) {
      e.preventDefault();
      unlockViaKey = true;
      unlock();
    }
  };

  const onWheel = () => {
    if (!document.documentElement.classList.contains('locked')) return;
    unlockViaKey = false;
    unlock();
  };

  const onTouch = () => {
    if (!document.documentElement.classList.contains('locked')) return;
    unlockViaKey = false;
    unlock();
  };

  overlay.addEventListener('click', onTrigger);
  if (!eventsBound) {
    eventsBound = true;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
  }
}

export function initLock() {
  const overlay = document.getElementById('lock-screen');
  if (!overlay) return;
  lockOverlay = overlay;

  // Listen for external lock request (e.g. terminal exit)
  window.addEventListener('agemo:lock', () => {
    showLock();
  });

  if (!document.documentElement.classList.contains('locked')) {
    overlay.remove();
    setInert(false);
    return;
  }

  setInert(true);
  updateLockClock();
  bindEvents(overlay);

  const btn = document.getElementById('lock-unlock-btn');
  if (btn) {
    setTimeout(() => btn.focus(), 50);
  }
}
