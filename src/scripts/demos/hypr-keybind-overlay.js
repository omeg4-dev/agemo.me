// hypr-keybind-overlay.js: Interactive 60% keyboard demo
import { subscribeKeys } from '../keys.js';

const ROWS = [
  // Row 1: Numbers (span sum = 30)
  [
    { code: 'Escape', label: 'Esc', span: 2, site: 'Esc → dismiss / back' },
    { code: 'Digit1', label: '1', span: 2, site: '1 → scroll to home', hypr: 'SUPER + 1 → workspace 1' },
    { code: 'Digit2', label: '2', span: 2, site: '2 → scroll to work', hypr: 'SUPER + 2 → workspace 2' },
    { code: 'Digit3', label: '3', span: 2, site: '3 → scroll to machine', hypr: 'SUPER + 3 → workspace 3' },
    { code: 'Digit4', label: '4', span: 2, site: '4 → scroll to links', hypr: 'SUPER + 4 → workspace 4' },
    { code: 'Digit5', label: '5', span: 2, site: '5 → scroll to reach', hypr: 'SUPER + 5 → workspace 5' },
    { code: 'Digit6', label: '6', span: 2 },
    { code: 'Digit7', label: '7', span: 2 },
    { code: 'Digit8', label: '8', span: 2 },
    { code: 'Digit9', label: '9', span: 2 },
    { code: 'Digit0', label: '0', span: 2 },
    { code: 'Minus', label: '-', span: 2 },
    { code: 'Equal', label: '=', span: 2 },
    { code: 'Backspace', label: '⌫', span: 4 },
  ],
  // Row 2: QWERTY (span sum = 30)
  [
    { code: 'Tab', label: 'Tab', span: 3 },
    { code: 'KeyQ', label: 'Q', span: 2, hypr: 'SUPER + Q → open terminal' },
    { code: 'KeyW', label: 'W', span: 2 },
    { code: 'KeyE', label: 'E', span: 2, hypr: 'SUPER + E → open files' },
    { code: 'KeyR', label: 'R', span: 2, hypr: 'SUPER + R → open launcher' },
    { code: 'KeyT', label: 'T', span: 2, site: 't → focus terminal' },
    { code: 'KeyY', label: 'Y', span: 2 },
    { code: 'KeyU', label: 'U', span: 2 },
    { code: 'KeyI', label: 'I', span: 2 },
    { code: 'KeyO', label: 'O', span: 2 },
    { code: 'KeyP', label: 'P', span: 2 },
    { code: 'BracketLeft', label: '[', span: 2 },
    { code: 'BracketRight', label: ']', span: 2 },
    { code: 'Backslash', label: '\\', span: 3 },
  ],
  // Row 3: Home row (span sum = 30)
  [
    { code: 'CapsLock', label: 'Caps', span: 4 },
    { code: 'KeyA', label: 'A', span: 2 },
    { code: 'KeyS', label: 'S', span: 2 },
    { code: 'KeyD', label: 'D', span: 2 },
    { code: 'KeyF', label: 'F', span: 2, hypr: 'SUPER + F → toggle fullscreen' },
    { code: 'KeyG', label: 'G', span: 2 },
    { code: 'KeyH', label: 'H', span: 2 },
    { code: 'KeyJ', label: 'J', span: 2, site: 'j → next workspace' },
    { code: 'KeyK', label: 'K', span: 2, site: 'k → previous workspace' },
    { code: 'KeyL', label: 'L', span: 2 },
    { code: 'Semicolon', label: ';', span: 2 },
    { code: 'Quote', label: "'", span: 2 },
    { code: 'Enter', label: 'Enter', span: 4 },
  ],
  // Row 4: Bottom row (span sum = 30)
  [
    { code: 'ShiftLeft', label: 'Shift', span: 5, hypr: 'SUPER + SHIFT + 1-5 → move to workspace' },
    { code: 'KeyZ', label: 'Z', span: 2 },
    { code: 'KeyX', label: 'X', span: 2 },
    { code: 'KeyC', label: 'C', span: 2 },
    { code: 'KeyV', label: 'V', span: 2, hypr: 'SUPER + V → toggle float' },
    { code: 'KeyB', label: 'B', span: 2 },
    { code: 'KeyN', label: 'N', span: 2 },
    { code: 'KeyM', label: 'M', span: 2 },
    { code: 'Comma', label: ',', span: 2 },
    { code: 'Period', label: '.', span: 2 },
    { code: 'Slash', label: '/', span: 2, site: '/ → open launcher' },
    { code: 'ShiftRight', label: 'Shift', span: 5 },
  ],
  // Row 5: Modifiers (span sum = 30)
  [
    { code: 'ControlLeft', label: 'Ctrl', span: 3 },
    { code: 'MetaLeft', label: 'Super', span: 3, hypr: 'SUPER (hold) → show overlay' },
    { code: 'AltLeft', label: 'Alt', span: 3 },
    { code: 'Space', label: 'Space', span: 12 },
    { code: 'AltRight', label: 'Alt', span: 3 },
    { code: 'MetaRight', label: 'Super', span: 3, hypr: 'SUPER (hold) → show overlay' },
    { code: 'ControlRight', label: 'Ctrl', span: 3 },
  ],
];

export function mount(slot) {
  if (!slot) return;
  slot.textContent = '';

  let mode = 'site'; // 'site' | 'hyprland'
  let superTimer = null;

  const wrapper = document.createElement('div');
  wrapper.className = 'live-kb';

  // Toggle chip row
  const toggleRow = document.createElement('div');
  toggleRow.className = 'live-kb__toggles';

  const siteChip = document.createElement('button');
  siteChip.type = 'button';
  siteChip.className = 'live-kb__chip is-active';
  siteChip.textContent = 'site binds';
  siteChip.setAttribute('aria-pressed', 'true');

  const hyprChip = document.createElement('button');
  hyprChip.type = 'button';
  hyprChip.className = 'live-kb__chip';
  hyprChip.textContent = 'hyprland binds';
  hyprChip.setAttribute('aria-pressed', 'false');

  const exampleTag = document.createElement('span');
  exampleTag.className = 'live-kb__example-tag';
  exampleTag.textContent = '(example binds)';
  exampleTag.style.display = 'none';

  toggleRow.appendChild(siteChip);
  toggleRow.appendChild(hyprChip);
  toggleRow.appendChild(exampleTag);
  wrapper.appendChild(toggleRow);

  // Keyboard grid container
  const board = document.createElement('div');
  board.className = 'live-kb__board';
  board.setAttribute('role', 'group');
  board.setAttribute('aria-label', 'Interactive 60% keyboard');

  const allKeyButtons = [];

  ROWS.forEach((row, rowIdx) => {
    const rowEl = document.createElement('div');
    rowEl.className = `live-kb__row ${rowIdx === 0 ? 'live-kb__row--nums' : ''}`;

    row.forEach((k) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'live-kb__key';
      btn.setAttribute('data-code', k.code);
      btn.style.gridColumn = `span ${k.span}`;
      btn.tabIndex = -1;

      const labelSpan = document.createElement('span');
      labelSpan.className = 'live-kb__key-label';
      labelSpan.textContent = k.label;
      btn.appendChild(labelSpan);

      // Site dot
      if (k.site) {
        const dot = document.createElement('span');
        dot.className = 'live-kb__dot';
        dot.setAttribute('aria-hidden', 'true');
        btn.appendChild(dot);
      }

      btn.addEventListener('mouseenter', () => updateCaption(k));
      btn.addEventListener('focus', () => updateCaption(k));
      btn.addEventListener('mouseleave', clearCaption);
      btn.addEventListener('blur', clearCaption);

      btn.addEventListener('click', () => {
        if (k.site) {
          executeSiteAction(k.code);
        }
      });

      rowEl.appendChild(btn);
      allKeyButtons.push({ btn, data: k });
    });

    board.appendChild(rowEl);
  });

  if (allKeyButtons.length > 0) {
    allKeyButtons[0].btn.tabIndex = 0;
  }

  // Roving tabindex navigation inside keyboard
  board.addEventListener('keydown', (e) => {
    const idx = allKeyButtons.findIndex((item) => item.btn === document.activeElement);
    if (idx === -1) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (idx + 1) % allKeyButtons.length;
      allKeyButtons[idx].btn.tabIndex = -1;
      allKeyButtons[next].btn.tabIndex = 0;
      allKeyButtons[next].btn.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (idx - 1 + allKeyButtons.length) % allKeyButtons.length;
      allKeyButtons[idx].btn.tabIndex = -1;
      allKeyButtons[prev].btn.tabIndex = 0;
      allKeyButtons[prev].btn.focus();
    }
  });

  wrapper.appendChild(board);

  // Caption line
  const caption = document.createElement('div');
  caption.className = 'live-kb__caption';
  caption.setAttribute('aria-live', 'polite');
  caption.textContent = 'press any physical key or click a highlighted key';
  wrapper.appendChild(caption);

  slot.appendChild(wrapper);

  function updateMode(newMode) {
    mode = newMode;
    const isSite = mode === 'site';
    siteChip.classList.toggle('is-active', isSite);
    siteChip.setAttribute('aria-pressed', isSite ? 'true' : 'false');
    hyprChip.classList.toggle('is-active', !isSite);
    hyprChip.setAttribute('aria-pressed', !isSite ? 'true' : 'false');
    exampleTag.style.display = isSite ? 'none' : 'inline';

    allKeyButtons.forEach(({ btn, data }) => {
      const isBound = isSite ? Boolean(data.site) : Boolean(data.hypr);
      btn.classList.toggle('is-bound', isBound);
    });

    caption.textContent = isSite
      ? 'press any key or click a dot-marked site key'
      : 'hyprland example binds: SUPER+Q (term), SUPER+R (launcher), SUPER+1-5';
  }

  siteChip.addEventListener('click', () => updateMode('site'));
  hyprChip.addEventListener('click', () => updateMode('hyprland'));
  updateMode('site');

  function updateCaption(k) {
    if (mode === 'site' && k.site) {
      caption.textContent = k.site;
    } else if (mode === 'hyprland' && k.hypr) {
      caption.textContent = k.hypr;
    } else if (k.label) {
      caption.textContent = `key: ${k.label}`;
    }
  }

  function clearCaption() {
    caption.textContent = mode === 'site'
      ? 'press any key or click a dot-marked site key'
      : 'hyprland example binds: SUPER+Q (term), SUPER+R (launcher), SUPER+1-5';
  }

  function executeSiteAction(code) {
    if (code === 'Digit1') {
      document.getElementById('ws-home')?.scrollIntoView({ behavior: 'smooth' });
    } else if (code === 'Digit2') {
      document.getElementById('ws-work')?.scrollIntoView({ behavior: 'smooth' });
    } else if (code === 'Digit3') {
      document.getElementById('ws-machine')?.scrollIntoView({ behavior: 'smooth' });
    } else if (code === 'Digit4') {
      document.getElementById('ws-links')?.scrollIntoView({ behavior: 'smooth' });
    } else if (code === 'Digit5') {
      document.getElementById('ws-reach')?.scrollIntoView({ behavior: 'smooth' });
    } else if (code === 'KeyT') {
      document.getElementById('ws-home')?.scrollIntoView({ behavior: 'smooth' });
      const input = document.querySelector('.term__input');
      if (input) setTimeout(() => input.focus(), 150);
    } else if (code === 'Slash') {
      window.dispatchEvent(new CustomEvent('agemo:launcher'));
    } else if (code === 'Escape') {
      window.dispatchEvent(new CustomEvent('agemo:close-launcher'));
    }
  }

  // Shared keys subscriber
  const unsub = subscribeKeys({
    onKeyDown(e) {
      const code = e.code;
      const keyEl = board.querySelector(`[data-code="${code}"]`);
      if (keyEl) {
        keyEl.classList.add('is-lit', 'is-pressed');
      }

      if (code === 'MetaLeft' || code === 'MetaRight') {
        if (!superTimer) {
          superTimer = setTimeout(() => {
            caption.textContent = "holding SUPER shows the overlay — that's the whole idea of the project";
          }, 400);
        }
      }
    },
    onKeyUp(e) {
      const code = e.code;
      const keyEl = board.querySelector(`[data-code="${code}"]`);
      if (keyEl) {
        keyEl.classList.remove('is-lit', 'is-pressed');
      }

      if (code === 'MetaLeft' || code === 'MetaRight') {
        if (superTimer) {
          clearTimeout(superTimer);
          superTimer = null;
        }
      }
    },
    onBlur() {
      board.querySelectorAll('.is-lit, .is-pressed').forEach((el) => {
        el.classList.remove('is-lit', 'is-pressed');
      });
      if (superTimer) {
        clearTimeout(superTimer);
        superTimer = null;
      }
    },
  });

  return unsub;
}
