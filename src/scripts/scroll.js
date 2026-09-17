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
    { rootMargin: '0px', threshold: 0.05 },
  );

  targets.forEach((el) => io.observe(el));
}

export function initScroll() {
  document.documentElement.classList.add('js');
  revealOnEnter();
}
