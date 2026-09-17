// notify.js: Noctalia-style toast notification manager (max 3, auto-dismiss 3.5s, pause on hover/focus)

let container = null;
const toasts = [];

export function initNotifications() {
  container = document.getElementById('notifications-root');
}

export function notify({ title = '', body = '', icon = '' } = {}) {
  if (!container) {
    container = document.getElementById('notifications-root');
    if (!container) return;
  }

  // Max 3 toasts: dismiss oldest if >= 3
  if (toasts.length >= 3) {
    const oldest = toasts[0];
    if (oldest) oldest.dismiss();
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');

  if (icon) {
    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast__icon';
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.textContent = icon;
    toast.appendChild(iconSpan);
  }

  const content = document.createElement('div');
  content.className = 'toast__content';

  if (title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'toast__title';
    titleEl.textContent = title;
    content.appendChild(titleEl);
  }

  if (body) {
    const bodyEl = document.createElement('div');
    bodyEl.className = 'toast__body';
    bodyEl.textContent = body;
    content.appendChild(bodyEl);
  }

  toast.appendChild(content);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast__close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Dismiss notification');
  closeBtn.textContent = '×';
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  let timer = null;
  let remaining = 3500;
  let startTime = Date.now();
  let isDismissed = false;

  function dismiss() {
    if (isDismissed) return;
    isDismissed = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    toast.classList.add('toast--leaving');
    const idx = toasts.indexOf(record);
    if (idx !== -1) toasts.splice(idx, 1);
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 280);
  }

  function pause() {
    if (isDismissed) return;
    if (timer) {
      clearTimeout(timer);
      timer = null;
      remaining -= Date.now() - startTime;
      if (remaining < 400) remaining = 400;
    }
  }

  function resume() {
    if (isDismissed) return;
    startTime = Date.now();
    timer = setTimeout(dismiss, remaining);
  }

  const record = { el: toast, dismiss };
  toasts.push(record);

  closeBtn.addEventListener('click', dismiss);
  toast.addEventListener('mouseenter', pause);
  toast.addEventListener('mouseleave', resume);
  toast.addEventListener('focusin', pause);
  toast.addEventListener('focusout', resume);

  resume();
}

export function triggerWelcomeToast() {
  try {
    if (sessionStorage.getItem('agemo:welcome-toasted')) return;
    sessionStorage.setItem('agemo:welcome-toasted', '1');
  } catch {}
  notify({
    title: 'welcome to cachyos',
    body: 'press / to search, ? for keys, or just scroll',
  });
}
