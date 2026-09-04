import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectRepos, relativeAge, accentFor } from '../scripts/repos-transform.mjs';

const raw = [
  { name: 'mc-jukebox', description: 'A jukebox.', language: 'Python', stargazers_count: 3,
    pushed_at: '2026-09-02T20:04:49Z', html_url: 'u/mc', fork: false, archived: false, private: false },
  { name: 'magpie', description: 'A clipboard.', language: 'Python', stargazers_count: 1,
    pushed_at: '2026-09-01T00:00:00Z', html_url: 'u/mg', fork: false, archived: false, private: false },
  { name: 'snake', description: null, language: null, stargazers_count: 0,
    pushed_at: '2026-08-01T00:00:00Z', html_url: 'u/sn', fork: false, archived: false, private: false },
  { name: 'WaEnhancer', description: 'fork', language: 'Java', stargazers_count: 0,
    pushed_at: '2025-07-04T00:00:00Z', html_url: 'u/wa', fork: true, archived: false, private: false },
  { name: 'old-thing', description: 'archived', language: 'C', stargazers_count: 0,
    pushed_at: '2024-01-01T00:00:00Z', html_url: 'u/ot', fork: false, archived: true, private: false },
  { name: 'sus', description: 'noise', language: null, stargazers_count: 0,
    pushed_at: '2021-12-20T00:00:00Z', html_url: 'u/su', fork: false, archived: false, private: false },
];

const config = { featured: ['mc-jukebox', 'magpie'], deny: ['sus'] };

test('excludes forks, archived, private, and deny-listed repos', () => {
  const { featured, rest } = selectRepos(raw, config);
  const names = [...featured, ...rest].map((r) => r.name);
  assert.deepEqual(names.sort(), ['magpie', 'mc-jukebox', 'snake']);
});

test('featured repos are separated and ordered as configured', () => {
  const { featured } = selectRepos(raw, config);
  assert.deepEqual(featured.map((r) => r.name), ['mc-jukebox', 'magpie']);
});

test('rest is sorted most-recently-pushed first', () => {
  const { rest } = selectRepos(raw, { featured: [], deny: ['sus'] });
  assert.deepEqual(rest.map((r) => r.name), ['mc-jukebox', 'magpie', 'snake']);
});

test('a configured featured repo that does not exist is skipped, not fabricated', () => {
  const { featured } = selectRepos(raw, { featured: ['mc-jukebox', 'ghost'], deny: [] });
  assert.deepEqual(featured.map((r) => r.name), ['mc-jukebox']);
});

test('missing description and language become empty strings, never null', () => {
  const { rest } = selectRepos(raw, { featured: [], deny: ['sus'] });
  const snake = rest.find((r) => r.name === 'snake');
  assert.equal(snake.description, '');
  assert.equal(snake.language, '');
});

test('relativeAge renders human spans', () => {
  const now = new Date('2026-09-05T00:00:00Z');
  assert.equal(relativeAge('2026-09-05T00:00:00Z', now), 'today');
  assert.equal(relativeAge('2026-09-04T00:00:00Z', now), 'yesterday');
  assert.equal(relativeAge('2026-09-01T00:00:00Z', now), '4 days ago');
  assert.equal(relativeAge('2026-07-05T00:00:00Z', now), '2 months ago');
  assert.equal(relativeAge('2024-09-05T00:00:00Z', now), '2 years ago');
});

test('accentFor is deterministic and stays in the cyan-blue arc', () => {
  assert.equal(accentFor('magpie'), accentFor('magpie'));
  assert.notEqual(accentFor('magpie'), accentFor('gamehub'));
  for (const n of ['a', 'magpie', 'gamehub', 'mc-jukebox', 'zzzz']) {
    const hue = Number(accentFor(n).match(/hsl\((\d+)/)[1]);
    assert.ok(hue >= 186 && hue <= 226, `hue ${hue} outside the accent arc`);
  }
});
