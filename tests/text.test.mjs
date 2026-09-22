import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segments, hand, glyph, word, rng, seedFrom } from '../src/scripts/handwriting.js';

test('prose and maths are told apart', () => {
  assert.deepEqual(segments('a $x^2$ b'), [
    { type: 'text', value: 'a ' },
    { type: 'math', value: 'x^2', display: false },
    { type: 'text', value: ' b' },
  ]);
  assert.deepEqual(segments('$$E = mc^2$$'), [{ type: 'math', value: 'E = mc^2', display: true }]);
  assert.deepEqual(segments('\\[a\\] and \\(b\\)'), [
    { type: 'math', value: 'a', display: true },
    { type: 'text', value: ' and ' },
    { type: 'math', value: 'b', display: false },
  ]);
});

test('an escaped dollar is just a dollar, and an unclosed one is text', () => {
  assert.deepEqual(segments('costs \\$5'), [{ type: 'text', value: 'costs $5' }]);
  assert.deepEqual(segments('half open $x + 1'), [{ type: 'text', value: 'half open $x + 1' }]);
});

test('the zeta example survives the split whole', () => {
  const src = '$$\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s} = \\prod_{p \\text{ prime}} \\left(1 - p^{-s}\\right)^{-1}$$';
  const [seg, ...rest] = segments(src);
  assert.equal(rest.length, 0);
  assert.equal(seg.type, 'math');
  assert.equal(seg.display, true);
  assert.equal(seg.value, src.slice(2, -2));
});

test('the slider only ever loosens the hand', () => {
  const careful = hand(1);
  const scrawl = hand(0);
  for (const key of ['rotate', 'lift', 'creep', 'squash', 'press', 'drift', 'slant', 'wobble', 'fade']) {
    assert.ok(scrawl[key] > careful[key], `${key}: ${scrawl[key]} should beat ${careful[key]}`);
  }
  assert.equal(careful.loose, 0, 'a careful hand never switches to the looser one');
  assert.ok(hand(0.5).rotate > hand(0.8).rotate);
});

test('a careful hand keeps every glyph nearly straight', () => {
  const h = hand(1);
  const rand = rng(1);
  for (let i = 0; i < 200; i++) {
    const g = glyph(rand, h);
    assert.ok(Math.abs(g.rot) <= h.rotate, 'rotation stays inside the band');
    assert.ok(Math.abs(g.rot) < 1, `a careful hand stays under a degree, got ${g.rot}`);
    assert.ok(Math.abs(g.dy) < 0.01 && Math.abs(g.dx) < 0.01);
    assert.ok(g.weight >= 400 && g.weight <= 400 + h.press);
    assert.ok(g.alpha > 0.9 && g.alpha <= 1);
  }
});

test('a scrawl is far more uneven than a careful hand', () => {
  const spread = (neat) => {
    const h = hand(neat);
    const rand = rng(99);
    let sum = 0;
    for (let i = 0; i < 500; i++) sum += Math.abs(glyph(rand, h).rot);
    return sum / 500;
  };
  assert.ok(spread(0) > spread(1) * 6, `${spread(0)} vs ${spread(1)}`);
  const w = word(rng(3), hand(0));
  assert.ok(Math.abs(w.skew) <= hand(0).slant);
});

test('the same text and slider always give the same hand', () => {
  const draw = () => {
    const rand = rng(seedFrom('hello|0.50'));
    return [glyph(rand, hand(0.5)), glyph(rand, hand(0.5))];
  };
  assert.deepEqual(draw(), draw());
  assert.notEqual(seedFrom('hello'), seedFrom('hellp'));
});
