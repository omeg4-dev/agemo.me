import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function token(name, source = css) {
  const stripped = stripComments(source);
  const m = stripped.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `token --${name} not found in source block`);
  return m[1];
}

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const [lightCss, darkCss] = css.split('@media');
assert.ok(lightCss && darkCss, 'expected light :root and @media dark blocks in tokens.css');

test('light theme text meets AA (4.5:1) on both paper grounds', () => {
  assert.ok(ratio(token('ink', lightCss), token('paper', lightCss)) >= 4.5, 'ink on paper');
  assert.ok(ratio(token('ink', lightCss), token('paper-2', lightCss)) >= 4.5, 'ink on paper-2');
  assert.ok(ratio(token('graphite', lightCss), token('paper', lightCss)) >= 4.5, 'graphite on paper');
  assert.ok(ratio(token('graphite', lightCss), token('paper-2', lightCss)) >= 4.5, 'graphite on paper-2');
});

test('light theme screen text meets AA (4.5:1) on screen ground', () => {
  assert.ok(ratio(token('screen-text', lightCss), token('screen', lightCss)) >= 4.5, 'screen-text on screen');
});

test('dark theme text meets AA (4.5:1) on both paper grounds', () => {
  assert.ok(ratio(token('ink', darkCss), token('paper', darkCss)) >= 4.5, 'dark ink on paper');
  assert.ok(ratio(token('ink', darkCss), token('paper-2', darkCss)) >= 4.5, 'dark ink on paper-2');
  assert.ok(ratio(token('graphite', darkCss), token('paper', darkCss)) >= 4.5, 'dark graphite on paper');
  assert.ok(ratio(token('graphite', darkCss), token('paper-2', darkCss)) >= 4.5, 'dark graphite on paper-2');
});

test('dark theme screen text meets AA (4.5:1) on screen ground', () => {
  assert.ok(ratio(token('screen-text', darkCss), token('screen', darkCss)) >= 4.5, 'dark screen-text on screen');
});

test('a commented-out token is not accepted', () => {
  const fixture = `:root {\n  /* --paper: #E9ECEF; */\n}`;
  assert.throws(() => token('paper', fixture));
});
