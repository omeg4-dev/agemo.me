// The mirror line: drives the signature reflection of OMEGA / 404.
// Features:
// - Load intro: unfolds --x from 0 to --w over 1400ms with cubic-bezier(0.22, 1, 0.36, 1)
// - Desktop fine pointer: --x follows pointer clamped to [0.08*w, w], eased at 18%/frame
// - Coarse/touch or unhovered: scroll drives --x from w down to 0.5*w over 60% hero height
// - Reduced motion: no intro, no tracking, no scroll effect; rest state only
// - Pauses when off-screen via IntersectionObserver

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

  const stage = mirror.closest('[data-hero]') || mirror.parentElement || mirror;

  let w = word.getBoundingClientRect().width;
  let currentX = w;
  let targetX = w;
  let introRunning = false;
  let introStart = 0;
  const introDuration = 1400;
  let isHovering = false;
  let isIntersecting = true;
  let trackingRaf = 0;
  let scrollRaf = 0;

  function setX(val) {
    currentX = val;
    mirror.style.setProperty('--x', `${val.toFixed(2)}px`);
  }

  function measure() {
    const rect = word.getBoundingClientRect();
    if (rect.width > 0) {
      w = rect.width;
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

  // IntersectionObserver pauses work when hero is off-screen
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
            if (scrollRaf) {
              cancelAnimationFrame(scrollRaf);
              scrollRaf = 0;
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

  // Load intro starts after document.fonts.ready (capped at 800 ms)
  const fontTimeout = new Promise((resolve) => setTimeout(resolve, 800));
  const fontsReady = 'fonts' in document ? document.fonts.ready : Promise.resolve();

  Promise.race([fontsReady, fontTimeout]).then(() => {
    measure();
    if (reduced()) {
      setX(w);
      return;
    }
    introRunning = true;
    introStart = performance.now();
    setX(0);
    requestAnimationFrame(stepIntro);
  });

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

  stage.addEventListener(
    'pointermove',
    (e) => {
      if (reduced() || !finePointer() || introRunning) return;
      isHovering = true;
      const wordRect = word.getBoundingClientRect();
      const rawX = e.clientX - wordRect.left;
      targetX = Math.max(0.08 * w, Math.min(w, rawX));
      requestTracking();
    },
    { passive: true },
  );

  stage.addEventListener(
    'pointerleave',
    () => {
      if (reduced() || !finePointer()) return;
      isHovering = false;
      targetX = w;
      requestTracking();
    },
    { passive: true },
  );

  // Scroll effect for touch/coarse or desktop when not hovering
  function stepScroll() {
    scrollRaf = 0;
    if (!isIntersecting || isHovering || reduced() || introRunning) return;

    const heroHeight = stage.offsetHeight || window.innerHeight;
    const scrollRatio = Math.min(1, Math.max(0, window.scrollY / (heroHeight * 0.6)));
    const newX = w - scrollRatio * (0.5 * w);
    setX(newX);
    targetX = newX;
  }

  window.addEventListener(
    'scroll',
    () => {
      if (isHovering || reduced() || introRunning) return;
      if (!scrollRaf) {
        scrollRaf = requestAnimationFrame(stepScroll);
      }
    },
    { passive: true },
  );

  window.addEventListener('resize', measure, { passive: true });
}
