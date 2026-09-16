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

test('text tokens meet AA (4.5:1) on wallpaper (--base00) and window body (--base01)', () => {
  const base00 = token('base00');
  const base01 = token('base01');

  // --base05 (primary text)
  assert.ok(ratio(token('base05'), base00) >= 4.5, 'base05 on base00');
  assert.ok(ratio(token('base05'), base01) >= 4.5, 'base05 on base01');

  // --base04 (secondary text)
  assert.ok(ratio(token('base04'), base00) >= 4.5, 'base04 on base00');
  assert.ok(ratio(token('base04'), base01) >= 4.5, 'base04 on base01');

  // --text-dim (muted text)
  // --win-bg is rgba(22, 22, 22 / 0.82) over --base00 (#161616), which blends to ~#181818.
  // --base01 (#262626) is brighter than --win-bg, so testing against --base01 covers the worst-case ground.
  assert.ok(ratio(token('text-dim'), base00) >= 4.5, 'text-dim on base00');
  assert.ok(ratio(token('text-dim'), base01) >= 4.5, 'text-dim on base01');
});

test('terminal accent colours meet AA (4.5:1) on window body ground (--base01)', () => {
  const base01 = token('base01');
  for (const name of ['blue', 'cyan', 'green', 'rose', 'purple']) {
    assert.ok(ratio(token(name), base01) >= 4.5, `${name} on base01`);
  }
});

test('a commented-out token is not accepted', () => {
  const fixture = `:root {\n  /* --base00: #161616; */\n}`;
  assert.throws(() => token('base00', fixture));
});
