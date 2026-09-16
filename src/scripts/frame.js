// frame.js: Shared, rAF-throttled scroll and pointermove listeners
const scrollSubscribers = new Set();
const pointerSubscribers = new Set();

let scrollRaf = 0;
let pointerRaf = 0;
let lastPointerEvt = null;

function runScroll() {
  scrollRaf = 0;
  const y = window.scrollY;
  for (const fn of scrollSubscribers) {
    fn(y);
  }
}

function runPointer() {
  pointerRaf = 0;
  if (!lastPointerEvt) return;
  const e = lastPointerEvt;
  for (const fn of pointerSubscribers) {
    fn(e);
  }
}

export function onScroll(fn) {
  scrollSubscribers.add(fn);
  return () => scrollSubscribers.delete(fn);
}

export function onPointerMove(fn) {
  pointerSubscribers.add(fn);
  return () => pointerSubscribers.delete(fn);
}

if (typeof window !== 'undefined') {
  window.addEventListener(
    'scroll',
    () => {
      if (!scrollRaf) {
        scrollRaf = requestAnimationFrame(runScroll);
      }
    },
    { passive: true },
  );

  window.addEventListener(
    'pointermove',
    (e) => {
      lastPointerEvt = e;
      if (!pointerRaf) {
        pointerRaf = requestAnimationFrame(runPointer);
      }
    },
    { passive: true },
  );
}
