import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/site.css', import.meta.url), 'utf8');
const token = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
  assert.ok(m, `token --${name} missing`);
  return m[1];
};

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

// Every text/background pair the stylesheet actually uses, at WCAG AA.
const pairs = [
  ['silver', 'backing', 4.5],   // body text
  ['lead', 'backing', 4.5],     // mono labels on the dark side
  ['glass', 'backing', 4.5],    // accents, links, focus ring
  ['backing', 'silver', 4.5],   // text on the silvered side
  ['lead-dark', 'silver', 4.5], // labels on the silvered side
  ['backing', 'glass', 4.5],    // skip link, selection
];

for (const [fg, bg, min] of pairs) {
  test(`--${fg} on --${bg} is at least ${min}:1`, () => {
    const r = ratio(token(fg), token(bg));
    assert.ok(r >= min, `${r.toFixed(2)}:1`);
  });
}
