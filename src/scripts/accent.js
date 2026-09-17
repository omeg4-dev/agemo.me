// accent.js: Runtime accent switching with localStorage persistence
import { notify } from './notify.js';

export const ACCENTS = {
  blue: { accent: '#78a9ff', accent2: '#be95ff' },
  cyan: { accent: '#3ddbd9', accent2: '#78a9ff' },
  green: { accent: '#42be65', accent2: '#3ddbd9' },
  pink: { accent: '#ee5396', accent2: '#be95ff' },
  purple: { accent: '#be95ff', accent2: '#ee5396' },
  rose: { accent: '#ff7eb6', accent2: '#be95ff' },
};

export function getAccent() {
  try {
    const saved = localStorage.getItem('agemo:accent');
    if (saved && Object.hasOwn(ACCENTS, saved)) {
      return saved;
    }
  } catch {}
  return 'blue';
}

export function setAccent(name, shouldNotify = true) {
  if (!name || !Object.hasOwn(ACCENTS, name)) {
    return false;
  }

  const pair = ACCENTS[name];
  document.documentElement.style.setProperty('--accent', pair.accent);
  document.documentElement.style.setProperty('--accent-2', pair.accent2);

  try {
    localStorage.setItem('agemo:accent', name);
  } catch {}

  const buttons = document.querySelectorAll('[data-accent-btn]');
  buttons.forEach((btn) => {
    btn.setAttribute('aria-pressed', btn.getAttribute('data-accent-btn') === name ? 'true' : 'false');
  });

  window.dispatchEvent(new CustomEvent('agemo:accent-changed', { detail: name }));

  if (shouldNotify) {
    notify({
      title: `accent · ${name}`,
      body: `theme accent updated to ${name}`,
      icon: '🎨',
    });
  }

  return true;
}
