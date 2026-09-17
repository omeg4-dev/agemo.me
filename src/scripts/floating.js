// floating.js: Floating draggable windows in WS1 (desktop only)

export function initFloating() {
  const ws1 = document.getElementById('ws-home');
  if (!ws1) return;

  const wins = [
    ws1.querySelector('.now-win'),
    ws1.querySelector('.term-win'),
  ].filter(Boolean);

  if (wins.length === 0) return;

  const canFloat = () => {
    return (
      window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
      window.innerWidth >= 1100
    );
  };

  wins.forEach((win) => {
    const bar = win.querySelector('.win__bar');
    if (!bar) return;

    bar.setAttribute('tabindex', '0');
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Draggable window. Alt+Arrow keys to move, double-click to reset');
    bar.classList.add('win__bar--draggable');

    let currentX = 0;
    let currentY = 0;
    let isDragging = false;
    let startPointerX = 0;
    let startPointerY = 0;
    let initialX = 0;
    let initialY = 0;

    function applyTransform(x, y, animate = false) {
      if (animate) {
        win.style.transition = 'transform var(--dur-2) var(--ease)';
        setTimeout(() => {
          win.style.transition = '';
        }, 260);
      } else {
        win.style.transition = '';
      }
      currentX = x;
      currentY = y;
      win.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      win.setAttribute('data-drag-x', String(Math.round(x)));
      win.setAttribute('data-drag-y', String(Math.round(y)));
    }

    function clampOffsets(x, y) {
      const wsRect = ws1.getBoundingClientRect();
      const winRect = win.getBoundingClientRect();

      // Current rect without current transform
      const unoffsetLeft = winRect.left - currentX;
      const unoffsetRight = winRect.right - currentX;
      const unoffsetTop = winRect.top - currentY;
      const unoffsetBottom = winRect.bottom - currentY;

      const minX = wsRect.left - unoffsetLeft;
      const maxX = wsRect.right - unoffsetRight;
      const minY = wsRect.top - unoffsetTop;
      const maxY = wsRect.bottom - unoffsetBottom;

      const clampedX = Math.max(minX, Math.min(maxX, x));
      const clampedY = Math.max(minY, Math.min(maxY, y));
      return { x: clampedX, y: clampedY };
    }

    bar.addEventListener('pointerdown', (e) => {
      if (!canFloat()) return;
      if (e.button !== 0) return; // Only main button

      isDragging = true;
      startPointerX = e.clientX;
      startPointerY = e.clientY;
      initialX = currentX;
      initialY = currentY;

      try {
        bar.setPointerCapture(e.pointerId);
      } catch {}

      win.classList.add('is-floating-dragging');
      bar.classList.add('is-grabbing');
    });

    bar.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startPointerX;
      const dy = e.clientY - startPointerY;
      const clamped = clampOffsets(initialX + dx, initialY + dy);
      applyTransform(clamped.x, clamped.y, false);
    });

    const stopDrag = (e) => {
      if (!isDragging) return;
      isDragging = false;
      win.classList.remove('is-floating-dragging');
      bar.classList.remove('is-grabbing');
      if (e && e.pointerId) {
        try {
          bar.releasePointerCapture(e.pointerId);
        } catch {}
      }
    };

    bar.addEventListener('pointerup', stopDrag);
    bar.addEventListener('pointercancel', stopDrag);

    // Double-click resets position
    bar.addEventListener('dblclick', () => {
      if (!canFloat()) return;
      applyTransform(0, 0, true);
    });

    // Keyboard Alt+Arrow keys move 24px
    bar.addEventListener('keydown', (e) => {
      if (!canFloat() || !e.altKey) return;
      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowLeft') dx = -24;
      else if (e.key === 'ArrowRight') dx = 24;
      else if (e.key === 'ArrowUp') dy = -24;
      else if (e.key === 'ArrowDown') dy = 24;

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        const clamped = clampOffsets(currentX + dx, currentY + dy);
        applyTransform(clamped.x, clamped.y, true);
      }
    });
  });

  // Window resize check
  window.addEventListener('resize', () => {
    if (!canFloat()) {
      wins.forEach((win) => {
        win.style.transform = '';
      });
    }
  });
}
