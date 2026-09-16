// terminal.js: Interactive terminal controller
import { run } from './terminal-commands.js';
import { setAccent, getAccent } from './accent.js';

const COMMANDS = [
  'help', 'whoami', 'hostname', 'uname', 'date', 'fastfetch', 'neofetch',
  'ls', 'cd', 'open', 'cat', 'links', 'theme', 'palindrome', 'echo',
  'clear', 'history', 'exit', 'sudo', 'paru', 'pacman', 'keys', 'launch', 'menu',
];

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initTerminal(root) {
  if (!root || root._termInitialized) return;
  root._termInitialized = true;

  const logEl = root.querySelector('.term__log');
  const inputEl = root.querySelector('.term__input');
  const bodyEl = root.querySelector('.win__body');
  if (!logEl || !inputEl || !bodyEl) return;

  const history = [];
  let historyIdx = -1;

  function scrollToBottom() {
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function createArrowSvg() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'term__arrow-svg');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M8 5l7 7-7 7');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    return svg;
  }

  function appendLineToLog(spans) {
    const lineDiv = document.createElement('div');
    lineDiv.className = 'term__line';

    for (const spanData of spans) {
      if (!spanData || (!spanData.text && !spanData.isArrow)) continue;

      if (spanData.isArrow) {
        lineDiv.appendChild(createArrowSvg());
        continue;
      }

      if (spanData.action) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `term__action-btn ${spanData.cls || ''}`;
        btn.textContent = spanData.text;
        btn.addEventListener('click', () => {
          const targetEl = document.getElementById(spanData.action);
          if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth' });
        });
        lineDiv.appendChild(btn);
        continue;
      }

      if (spanData.href) {
        const a = document.createElement('a');
        a.href = spanData.href;
        a.className = `term__link ${spanData.cls || ''}`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = spanData.text;
        lineDiv.appendChild(a);
        continue;
      }

      const span = document.createElement('span');
      if (spanData.cls) span.className = spanData.cls;
      span.textContent = spanData.text;
      lineDiv.appendChild(span);
    }

    logEl.appendChild(lineDiv);
  }

  function appendExecutedPrompt(cmdText) {
    const promptLine = document.createElement('div');
    promptLine.className = 'term__prompt-row';

    const userSpan = document.createElement('span');
    userSpan.className = 'term__user';
    userSpan.textContent = 'omega@cachyos';

    const tildeSpan = document.createElement('span');
    tildeSpan.className = 'term__path';
    tildeSpan.textContent = ' ~ ';

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'term__arrow';
    arrowSpan.appendChild(createArrowSvg());

    const spaceSpan = document.createElement('span');
    spaceSpan.textContent = ' ';

    const cmdSpan = document.createElement('span');
    cmdSpan.className = 'term__cmd-entered';
    cmdSpan.textContent = cmdText;

    promptLine.appendChild(userSpan);
    promptLine.appendChild(tildeSpan);
    promptLine.appendChild(arrowSpan);
    promptLine.appendChild(spaceSpan);
    promptLine.appendChild(cmdSpan);

    logEl.appendChild(promptLine);
  }

  function executeCommand(raw) {
    const trimmed = raw.trim();
    if (trimmed) {
      history.push(trimmed);
      historyIdx = history.length;
    }

    appendExecutedPrompt(raw);

    const ctx = {
      history,
      currentAccent: getAccent(),
    };

    const result = run(raw, ctx);

    for (const lineSpans of result.lines) {
      appendLineToLog(lineSpans);
    }

    // Execute effects
    for (const eff of result.effects) {
      if (eff.type === 'clear') {
        logEl.textContent = '';
      } else if (eff.type === 'scroll') {
        const el = document.querySelector(eff.target);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      } else if (eff.type === 'open') {
        window.open(eff.url, '_blank', 'noopener,noreferrer');
      } else if (eff.type === 'theme') {
        setAccent(eff.name);
      } else if (eff.type === 'exit') {
        window.dispatchEvent(new CustomEvent('agemo:lock'));
      } else if (eff.type === 'keys') {
        window.dispatchEvent(new CustomEvent('agemo:keys'));
      } else if (eff.type === 'launcher') {
        window.dispatchEvent(new CustomEvent('agemo:launcher'));
      }
    }

    inputEl.value = '';
    scrollToBottom();
  }

  // Keyboard controls on input
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(inputEl.value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      if (historyIdx > 0) {
        historyIdx -= 1;
        inputEl.value = history[historyIdx];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx < history.length - 1) {
        historyIdx += 1;
        inputEl.value = history[historyIdx];
      } else {
        historyIdx = history.length;
        inputEl.value = '';
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const val = inputEl.value.trimStart();
      if (!val) return;
      const match = COMMANDS.find((c) => c.startsWith(val.toLowerCase()));
      if (match) {
        inputEl.value = match;
      }
    } else if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      logEl.textContent = '';
    } else if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      appendExecutedPrompt(inputEl.value + '^C');
      inputEl.value = '';
      scrollToBottom();
    }
  });

  // Clicking anywhere inside terminal focuses input
  root.addEventListener('click', (e) => {
    if (e.target.closest('a') || e.target.closest('button')) return;
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) return;
    inputEl.focus();
  });

  // Autotype sequence on initial load after unlock
  function runAutotype() {
    const cmdStr = 'fastfetch --short';
    const isRed = reduced();

    if (isRed) {
      appendExecutedPrompt(cmdStr);
      appendLineToLog([
        { text: 'os: ', cls: 'cyan' },
        { text: 'CachyOS x86_64', cls: 'text' },
      ]);
      appendLineToLog([
        { text: 'wm: ', cls: 'purple' },
        { text: 'Hyprland 0.56.0 (Wayland)', cls: 'text' },
      ]);
      appendLineToLog([
        { text: 'shell: ', cls: 'green' },
        { text: 'zsh 5.9.2', cls: 'text' },
      ]);
      appendLineToLog([
        { text: 'cpu: ', cls: 'rose' },
        { text: 'AMD Ryzen 7 5700X (16) @ 4.67 GHz', cls: 'text' },
      ]);
      appendLineToLog([
        { text: 'type ', cls: 'dim' },
        { text: 'help', cls: 'accent bold' },
        { text: ', or press ', cls: 'dim' },
        { text: '/', cls: 'accent bold' },
        { text: ' for the launcher', cls: 'dim' },
      ]);
      scrollToBottom();
      return;
    }

    let charIdx = 0;
    const promptLine = document.createElement('div');
    promptLine.className = 'term__prompt-row';

    const userSpan = document.createElement('span');
    userSpan.className = 'term__user';
    userSpan.textContent = 'omega@cachyos';

    const tildeSpan = document.createElement('span');
    tildeSpan.className = 'term__path';
    tildeSpan.textContent = ' ~ ';

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'term__arrow';
    arrowSpan.appendChild(createArrowSvg());

    const spaceSpan = document.createElement('span');
    spaceSpan.textContent = ' ';

    const cmdSpan = document.createElement('span');
    cmdSpan.className = 'term__cmd-entered';

    promptLine.appendChild(userSpan);
    promptLine.appendChild(tildeSpan);
    promptLine.appendChild(arrowSpan);
    promptLine.appendChild(spaceSpan);
    promptLine.appendChild(cmdSpan);
    logEl.appendChild(promptLine);

    function typeNextChar() {
      if (charIdx < cmdStr.length) {
        cmdSpan.textContent += cmdStr[charIdx];
        charIdx++;
        setTimeout(typeNextChar, 28);
      } else {
        appendLineToLog([
          { text: 'os: ', cls: 'cyan' },
          { text: 'CachyOS x86_64', cls: 'text' },
        ]);
        appendLineToLog([
          { text: 'wm: ', cls: 'purple' },
          { text: 'Hyprland 0.56.0 (Wayland)', cls: 'text' },
        ]);
        appendLineToLog([
          { text: 'shell: ', cls: 'green' },
          { text: 'zsh 5.9.2', cls: 'text' },
        ]);
        appendLineToLog([
          { text: 'cpu: ', cls: 'rose' },
          { text: 'AMD Ryzen 7 5700X (16) @ 4.67 GHz', cls: 'text' },
        ]);
        appendLineToLog([
          { text: 'type ', cls: 'dim' },
          { text: 'help', cls: 'accent bold' },
          { text: ', or press ', cls: 'dim' },
          { text: '/', cls: 'accent bold' },
          { text: ' for the launcher', cls: 'dim' },
        ]);
        scrollToBottom();
      }
    }

    setTimeout(typeNextChar, 100);
  }

  if (document.documentElement.classList.contains('locked')) {
    window.addEventListener('agemo:unlocked', runAutotype, { once: true });
  } else {
    runAutotype();
  }
}
