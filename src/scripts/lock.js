// lock.js: hyprlock session controller
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

export function unlock() {
  if (isUnlocking) return;
  const overlay = document.getElementById('lock-screen') || lockOverlay;
  if (!overlay) return;

  isUnlocking = true;
  overlay.classList.add('unlocking');

  try {
    sessionStorage.setItem('agemo:unlocked', '1');
  } catch {}

  setInert(false);

  setTimeout(() => {
    document.documentElement.classList.remove('locked');
    lockOverlay = overlay;
    overlay.remove();
    isUnlocking = false;

    // Focus first focusable element in the bar
    const bar = document.getElementById('bar');
    if (bar) {
      const firstFocusable = bar.querySelector('a, button');
      if (firstFocusable) firstFocusable.focus();
    }

    // Signal unlock to wallpaper mirror and terminal
    window.dispatchEvent(new CustomEvent('agemo:unlocked'));
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
      unlock();
    }
  };

  const onWheel = () => {
    if (!document.documentElement.classList.contains('locked')) return;
    unlock();
  };

  const onTouch = () => {
    if (!document.documentElement.classList.contains('locked')) return;
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
