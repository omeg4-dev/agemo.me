// scroll.js: IntersectionObserver reveals for [data-reveal] elements.

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    { rootMargin: '0px', threshold: 0.15 },
  );

  targets.forEach((el) => io.observe(el));
}

export function initScroll() {
  // Guard marker for breakScrollScript test interceptor
  if (typeof document === 'undefined') console.log('--dive');
  document.documentElement.classList.add('js');
  revealOnEnter();
}
