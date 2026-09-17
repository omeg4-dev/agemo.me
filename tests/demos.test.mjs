import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fuzzyMatch, getHighlightRanges } from '../src/scripts/fuzzy.js';
import { TRACKS, OMEGA_LEAD, AGEMO_LEAD, CACHY_LEAD, OMEGA_BASS, AGEMO_BASS, CACHY_BASS } from '../src/scripts/melodies.js';

test('fuzzyMatch matches subsequences and returns score and indices', () => {
  const match = fuzzyMatch('rice', 'inspect the rice');
  assert.ok(match !== null);
  assert.ok(match.score > 0);
  assert.equal(match.indices.length, 4);

  // Non-match returns null
  assert.equal(fuzzyMatch('xyz', 'inspect the rice'), null);

  // Empty query matches with score 1
  const empty = fuzzyMatch('', 'anything');
  assert.deepEqual(empty, { score: 1, indices: [] });
});

test('getHighlightRanges produces contiguous ranges', () => {
  assert.deepEqual(getHighlightRanges([]), []);
  assert.deepEqual(getHighlightRanges([0, 1, 2]), [[0, 3]]);
  assert.deepEqual(getHighlightRanges([0, 1, 4, 5]), [[0, 2], [4, 6]]);
  assert.deepEqual(getHighlightRanges([3]), [[3, 4]]);
});

test('melody data: agemo lead is exactly omega lead reversed', () => {
  assert.equal(AGEMO_LEAD.length, OMEGA_LEAD.length);
  const expectedLead = OMEGA_LEAD.slice().reverse();
  assert.deepEqual(AGEMO_LEAD, expectedLead);

  assert.equal(AGEMO_BASS.length, OMEGA_BASS.length);
  const expectedBass = OMEGA_BASS.slice().reverse();
  assert.deepEqual(AGEMO_BASS, expectedBass);
});

test('melody data: every note length > 0', () => {
  for (const track of TRACKS) {
    for (const [note, len] of track.lead) {
      assert.ok(typeof len === 'number' && len > 0, `Track ${track.id} lead has invalid note length: ${len}`);
    }
    for (const [note, len] of track.bass) {
      assert.ok(typeof len === 'number' && len > 0, `Track ${track.id} bass has invalid note length: ${len}`);
    }
  }
});

test('melody data: loops are whole bars (each bar = 16 sixteenths)', () => {
  for (const track of TRACKS) {
    const totalLeadSixteenths = track.lead.reduce((sum, [, len]) => sum + len, 0);
    assert.equal(
      totalLeadSixteenths % 16,
      0,
      `Track ${track.id} lead total sixteenths (${totalLeadSixteenths}) must be a whole number of bars (divisible by 16)`,
    );
    assert.equal(
      totalLeadSixteenths,
      128,
      `Track ${track.id} lead loop must be exactly 8 bars (128 sixteenths)`,
    );

    const totalBassSixteenths = track.bass.reduce((sum, [, len]) => sum + len, 0);
    assert.equal(
      totalBassSixteenths % 16,
      0,
      `Track ${track.id} bass total sixteenths (${totalBassSixteenths}) must be a whole number of bars (divisible by 16)`,
    );
    assert.equal(
      totalBassSixteenths,
      128,
      `Track ${track.id} bass loop must be exactly 8 bars (128 sixteenths)`,
    );
  }
});
