// Scroll orchestration. Two jobs:
//   1. drive --dive on the hero (0 at rest, 1 when fully through the waterline)
//   2. flip data-revealed on [data-reveal] elements as they enter view
// Both are inert under reduced motion.

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function driveDive() {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;

  let ticking = false;
  const update = () => {
    ticking = false;
    const dive = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
    hero.style.setProperty('--dive', dive.toFixed(4));
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
}

function revealOnEnter() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;

  if (reduced() || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.setAttribute('data-revealed', ''));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute('data-revealed', '');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
  );
  targets.forEach((el) => io.observe(el));
}

export function initScroll() {
  // --dive still updates under reduced motion; the CSS simply ignores it,
  // so nothing moves but state stays consistent for anything reading it.
  driveDive();
  revealOnEnter();
}
