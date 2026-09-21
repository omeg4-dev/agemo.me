import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rank, summary, ago } from '../src/scripts/jerkcraft.js';
import { settle } from '../src/scripts/board.js';
import { clockParts } from '../src/scripts/games.js';

const players = [
  { name: 'b', playtimeTicks: 144000, deaths: 2, online: true },
  { name: 'a', playtimeTicks: 144000, deaths: 0 },
  { name: 'c', playtimeTicks: 72000, deaths: 5 },
];

test('rank sorts high to low, ties by name, and drops zeros', () => {
  assert.deepEqual(rank(players, 'playtime').map((p) => p.name), ['a', 'b', 'c']);
  assert.deepEqual(rank(players, 'deaths').map((p) => p.name), ['c', 'b']);
  assert.equal(rank(players, 'playtime', 1).length, 1);
});

test('summary adds up hours and online players', () => {
  assert.deepEqual(summary(players), { players: 3, hours: 5, online: 1 });
});

test('ago reads naturally', () => {
  const now = 10 * 86_400_000;
  assert.equal(ago(now - 20_000, now), 'just now');
  assert.equal(ago(now - 12 * 60000, now), '12 min ago');
  assert.equal(ago(now - 3 * 3600000, now), '3 h ago');
  assert.equal(ago(now - 3 * 86_400_000, now), '3 days ago');
});

test('a flap scrambles, then locks letter by letter onto its text', () => {
  const target = 'ON TIME';
  assert.notEqual(settle(target, 0, 4), target);
  assert.equal(settle(target, 0, 4)[2], ' ', 'spaces never flap');
  assert.equal(settle(target, 4, 4)[0], 'O');
  assert.equal(settle(target, 4 + target.length, 4), target);
});

test('clock parts are a time and a short date', () => {
  const p = clockParts(new Date(2026, 8, 21, 21, 5));
  assert.equal(p.time, '9:05 PM');
  assert.equal(p.date, 'Mon, Sep 21');
});
