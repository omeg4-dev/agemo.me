// The mirror line: drives the signature reflection of OMEGA / 404.
// Features:
// - Load intro: unfolds --x from 0 to --w over 1400ms with cubic-bezier(0.22, 1, 0.36, 1)
// - Waits for unlock if the page starts locked
// - Desktop fine pointer: --x follows pointer clamped to [0.08*w, w], eased at 18%/frame
// - Coarse/touch or unhovered: scroll drives --x from w down to 0.5*w over 60% hero height
// - Reduced motion: no intro, no tracking, no scroll effect; rest state only
// - Pauses when off-screen via IntersectionObserver
// - Subscribes to shared frame.js scroll & pointer listeners

import { onScroll, onPointerMove } from './frame.js';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// cubic-bezier(0.22, 1, 0.36, 1) solver
function solveEase(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let lo = 0;
  let hi = 1;
  let s = t;
  for (let i = 0; i < 8; i++) {
    const x = 3 * (1 - s) * (1 - s) * s * 0.22 + 3 * (1 - s) * s * s * 0.36 + s * s * s;
    if (Math.abs(x - t) < 0.001) break;
    if (x < t) lo = s;
    else hi = s;
    s = (lo + hi) / 2;
  }
  return 3 * (1 - s) * (1 - s) * s + 3 * (1 - s) * s * s + s * s * s;
}

export function initMirrorLine() {
  const mirror = document.querySelector('[data-mirror]');
  if (!mirror) return;

  const word = mirror.querySelector('.mirror__word');
  if (!word) return;

  const stage = mirror.closest('.ws-home__art') || mirror.closest('[data-hero]') || mirror.parentElement || mirror;

  // The word's box is sized from --w, so measuring the box would just read --w
  // back. Measure the glyphs instead, and divide out any ancestor transform
  // (the lock screen scales the page to 1.04), or the scale gets baked into --w.
  function textWidth() {
    const box = word.getBoundingClientRect();
    if (!box.width || !word.offsetWidth) return 0;
    const range = document.createRange();
    range.selectNodeContents(word);
    return range.getBoundingClientRect().width * (word.offsetWidth / box.width);
  }

  let w = textWidth() || word.getBoundingClientRect().width;
  let currentX = w;
  let targetX = w;
  let introRunning = false;
  let introStart = 0;
  const introDuration = 1400;
  let isHovering = false;
  let isIntersecting = true;
  let trackingRaf = 0;

  function setX(val) {
    currentX = val;
    mirror.style.setProperty('--x', `${val.toFixed(2)}px`);
  }

  function measure() {
    const measured = textWidth();
    if (measured > 0) {
      w = measured;
      mirror.style.setProperty('--w', `${w.toFixed(2)}px`);
      if (reduced()) {
        setX(w);
        return;
      }
      if (!isHovering && !introRunning) {
        setX(w);
        targetX = w;
      }
    }
  }

  // Measure initially
  measure();

  // Reduced motion short-circuit
  if (reduced()) {
    setX(w);
    return;
  }

  // IntersectionObserver pauses work when stage is off-screen
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isIntersecting = entry.isIntersecting;
          if (!isIntersecting) {
            if (trackingRaf) {
              cancelAnimationFrame(trackingRaf);
              trackingRaf = 0;
            }
          }
        }
      },
      { threshold: 0 },
    );
    io.observe(stage);
  }

  function stepIntro(now) {
    if (!introRunning) return;
    const elapsed = now - introStart;
    const progress = Math.min(1, elapsed / introDuration);
    const factor = solveEase(progress);
    setX(factor * w);

    if (progress < 1) {
      requestAnimationFrame(stepIntro);
    } else {
      introRunning = false;
      setX(w);
      targetX = w;
    }
  }

  function runIntro() {
    measure();
    if (reduced()) {
      setX(w);
      return;
    }
    introRunning = true;
    introStart = performance.now();
    setX(0);
    requestAnimationFrame(stepIntro);
    setTimeout(() => {
      if (introRunning) {
        introRunning = false;
        setX(w);
        targetX = w;
      }
    }, introDuration + 150);
  }

  function scheduleIntro() {
    const fontTimeout = new Promise((resolve) => setTimeout(resolve, 800));
    const fontsReady = 'fonts' in document ? document.fonts.ready : Promise.resolve();

    Promise.race([fontsReady, fontTimeout]).then(() => {
      if (document.documentElement.classList.contains('locked')) {
        window.addEventListener('agemo:unlocked', runIntro, { once: true });
      } else {
        runIntro();
      }
    });
  }

  scheduleIntro();

  // Desktop pointer tracking
  function stepTracking() {
    trackingRaf = 0;
    if (!isIntersecting) return;

    currentX += (targetX - currentX) * 0.18;

    if (Math.abs(targetX - currentX) < 0.5) {
      setX(targetX);
      return;
    }

    setX(currentX);
    trackingRaf = requestAnimationFrame(stepTracking);
  }

  function requestTracking() {
    if (!trackingRaf) {
      trackingRaf = requestAnimationFrame(stepTracking);
    }
  }

  onPointerMove((e) => {
    if (reduced() || !finePointer()) return;
    if (e.clientX === 0 && e.clientY === 0) {
      if (isHovering) {
        isHovering = false;
        targetX = w;
        requestTracking();
      }
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    const inStage = (
      e.clientX >= stageRect.left &&
      e.clientX <= stageRect.right &&
      e.clientY >= stageRect.top &&
      e.clientY <= stageRect.bottom
    );

    if (inStage) {
      if (introRunning) introRunning = false;
      isHovering = true;
      const wordRect = word.getBoundingClientRect();
      const rawX = e.clientX - wordRect.left;
      targetX = Math.max(0.08 * w, Math.min(w, rawX));
      requestTracking();
    } else if (isHovering) {
      isHovering = false;
      targetX = w;
      requestTracking();
    }
  });

  onScroll((scrollY) => {
    if (isHovering || reduced() || introRunning || !isIntersecting) return;
    const heroHeight = stage.offsetHeight || window.innerHeight;
    const scrollRatio = Math.min(1, Math.max(0, scrollY / (heroHeight * 0.6)));
    const newX = w - scrollRatio * (0.5 * w);
    setX(newX);
    targetX = newX;
  });

  window.addEventListener('resize', measure, { passive: true });
}
