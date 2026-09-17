// demos-loader.js: Single IntersectionObserver for lazy loading the 4 live project demos

export function initDemosLoader() {
  const slots = document.querySelectorAll('.demo-slot[data-demo]');
  if (slots.length === 0) return;

  const loaded = new Set();

  function loadDemo(slot) {
    const name = slot.getAttribute('data-demo');
    if (!name || loaded.has(name)) return;
    loaded.add(name);

    if (name === 'hypr-keybind-overlay') {
      import('./demos/hypr-keybind-overlay.js')
        .then((mod) => mod.mount(slot))
        .catch((err) => console.warn('Failed to load hypr-keybind-overlay demo', err));
    } else if (name === 'magpie') {
      import('./demos/magpie.js')
        .then((mod) => mod.mount(slot))
        .catch((err) => console.warn('Failed to load magpie demo', err));
    } else if (name === 'gamehub') {
      import('./demos/gamehub.js')
        .then((mod) => mod.mount(slot))
        .catch((err) => console.warn('Failed to load gamehub demo', err));
    } else if (name === 'mc-jukebox') {
      import('./demos/mc-jukebox.js')
        .then((mod) => mod.mount(slot))
        .catch((err) => console.warn('Failed to load mc-jukebox demo', err));
    }
  }

  function loadAll() {
    slots.forEach((s) => loadDemo(s));
  }

  // Pre-load jukebox if terminal or launcher triggers play before scroll
  window.addEventListener('agemo:jukebox-play', () => {
    const jbSlot = document.querySelector('.demo-slot[data-demo="mc-jukebox"]');
    if (jbSlot) loadDemo(jbSlot);
  }, { once: true });

  if (!('IntersectionObserver' in window)) {
    loadAll();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadAll();
          observer.disconnect();
        }
      });
    },
    {
      rootMargin: '300px 0px',
    },
  );

  slots.forEach((s) => observer.observe(s));
}
