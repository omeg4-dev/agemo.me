// fuzzy.js: Shared fuzzy scorer and index highlighter
export function fuzzyMatch(query, text) {
  if (!query) return { score: 1, indices: [] };
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  let qIdx = 0;
  let score = 0;
  let consecutive = 0;
  const indices = [];

  for (let i = 0; i < t.length; i++) {
    if (qIdx < q.length && t[i] === q[qIdx]) {
      indices.push(i);
      qIdx++;
      // Word boundary bonus
      const isStart = i === 0 || /[\s\-_/.:]/.test(t[i - 1]);
      if (isStart) score += 15;
      // Consecutive bonus
      consecutive++;
      score += consecutive * 5;
    } else {
      consecutive = 0;
    }
  }

  if (qIdx === q.length) {
    // Shorter text penalty
    score -= t.length;
    return { score, indices };
  }
  return null;
}

/**
 * Returns an array of contiguous [start, end] ranges (exclusive end) from sorted indices.
 */
export function getHighlightRanges(indices) {
  if (!indices || !indices.length) return [];
  const ranges = [];
  let curStart = indices[0];
  let curEnd = indices[0] + 1;

  for (let i = 1; i < indices.length; i++) {
    if (indices[i] === curEnd) {
      curEnd = indices[i] + 1;
    } else {
      ranges.push([curStart, curEnd]);
      curStart = indices[i];
      curEnd = indices[i] + 1;
    }
  }
  ranges.push([curStart, curEnd]);
  return ranges;
}
