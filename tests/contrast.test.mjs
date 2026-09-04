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
  assert.ok(m, `token --${name} not found in tokens.css`);
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

test('body text meets AA (4.5:1) on both grounds', () => {
  assert.ok(ratio(token('text'), token('bg')) >= 4.5);
  assert.ok(ratio(token('text'), token('surface')) >= 4.5);
});

test('muted text meets AA (4.5:1) on both grounds', () => {
  assert.ok(ratio(token('muted'), token('bg')) >= 4.5);
  assert.ok(ratio(token('muted'), token('surface')) >= 4.5);
});

test('accent colours meet large-text AA (3:1) on both grounds', () => {
  for (const t of ['accent', 'accent-2', 'live']) {
    assert.ok(ratio(token(t), token('bg')) >= 3, `--${t} on --bg`);
    assert.ok(ratio(token(t), token('surface')) >= 3, `--${t} on --surface`);
  }
});

test('a commented-out token is not accepted', () => {
  const fixture = `:root {\n  /* --bg: #0B0D0F; */\n}`;
  assert.throws(() => token('bg', fixture));
});
