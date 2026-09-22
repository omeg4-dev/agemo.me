// The handwriting model: what makes typed text look written by a hand.
//
// Nothing here touches the DOM. A sheet is described by pure numbers so the
// preview and the exported image can be drawn from exactly the same values,
// and so the model can be tested.

/** Small, fast, seeded PRNG. Same seed, same hand. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * The slider, in one place. `neat` runs 0 (barely legible scrawl) to 1
 * (careful, even hand). Everything below scales off `mess`.
 */
export function hand(neat) {
  const mess = 1 - Math.min(1, Math.max(0, neat));
  return {
    mess,
    rotate: 0.7 + 9 * mess ** 1.2,      // degrees, per glyph
    lift: 0.005 + 0.055 * mess ** 1.4,  // em, per glyph, off the baseline
    creep: 0.004 + 0.055 * mess,        // em, per glyph, along the line
    squash: 0.01 + 0.11 * mess ** 1.3,  // per-glyph size difference
    press: 60 + 240 * mess,             // weight swing, ink pressure
    drift: 0.004 + 0.04 * mess,         // em, per word, baseline wander
    slant: 0.6 + 7 * mess,              // degrees, per word
    wobble: 0.35 + 4.2 * mess ** 1.4,   // px, stroke distortion
    grain: 0.018 + 0.03 * mess,         // stroke distortion frequency
    fade: 0.05 + 0.22 * mess,           // ink darkness swing
    // A second, looser hand takes over as the slider goes down.
    loose: mess < 0.35 ? 0 : (mess - 0.35) / 0.65,
  };
}

/** One glyph's deviation from the typeset ideal. */
export function glyph(rand, h) {
  const s = () => rand() * 2 - 1;
  return {
    rot: s() * h.rotate,
    dx: s() * h.creep,
    dy: s() * h.lift,
    scale: 1 + s() * h.squash,
    weight: Math.round(400 + rand() * h.press),
    alpha: 1 - rand() * h.fade,
    loose: rand() < h.loose * 0.55,
  };
}

/** A word sits on its own slightly wrong baseline, at its own slant. */
export function word(rand, h) {
  const s = () => rand() * 2 - 1;
  return { dy: s() * h.drift, skew: s() * h.slant };
}

/**
 * Splits input into prose and maths. `$$…$$` and `\[…\]` are display maths,
 * `$…$` and `\(…\)` inline. A backslash-escaped dollar is just a dollar.
 */
export function segments(src) {
  const out = [];
  let text = '';
  let i = 0;
  const push = (seg) => {
    if (text) { out.push({ type: 'text', value: text }); text = ''; }
    if (seg) out.push(seg);
  };
  while (i < src.length) {
    const rest = src.slice(i);
    if (rest.startsWith('\\$')) { text += '$'; i += 2; continue; }
    const open = [
      ['$$', '$$', true], ['\\[', '\\]', true], ['\\(', '\\)', false], ['$', '$', false],
    ].find(([o]) => rest.startsWith(o));
    if (open) {
      const [o, c, display] = open;
      const end = src.indexOf(c, i + o.length);
      if (end !== -1) {
        const value = src.slice(i + o.length, end).trim();
        if (value) push({ type: 'math', value, display });
        else push(null);
        i = end + c.length;
        continue;
      }
    }
    text += src[i];
    i += 1;
  }
  push(null);
  return out;
}

/** Paper the sheet can be written on. */
export const PAPERS = ['plain', 'lined', 'grid', 'none'];
