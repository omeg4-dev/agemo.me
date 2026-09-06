const DAY = 86_400_000;

// Desaturated toward --accent (#33B1FF ≈ hue 206) so the grid never
// becomes a rainbow — spec §6.2.
const HUE_MIN = 186;
const HUE_SPAN = 40;

export function accentFor(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i += 1) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = HUE_MIN + (Math.abs(h) % HUE_SPAN);
  return `hsl(${hue} 78% 62%)`;
}

export function relativeAge(iso, now = new Date()) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'unknown';
  const days = Math.floor((now.getTime() - then) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? 'last month' : `${months} months ago`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? 'last year' : `${years} years ago`;
}

function normalise(r) {
  return {
    name: r.name,
    description: r.description ?? '',
    language: r.language ?? '',
    pushedAt: r.pushed_at,
    url: r.html_url,
    accent: accentFor(r.name),
  };
}

/**
 * The Work section shows GitHub-pinned repos only.
 *
 * `pinnedNames` is the live pin list when the build could reach the GraphQL
 * API, and `config.pinned` otherwise. Either way the deny-list still applies
 * and the result is ordered by `pinnedNames`, not by the REST payload — a
 * repo's position on the page is a deliberate choice, not an accident of
 * push time.
 */
export function selectPinned(raw, config, pinnedNames) {
  const deny = new Set(config.deny ?? []);
  const order = pinnedNames?.length ? pinnedNames : (config.pinned ?? []);

  const byName = new Map(
    raw
      .filter((r) => !r.archived && !r.private && !deny.has(r.name))
      .map((r) => [r.name, normalise(r)]),
  );

  return order.map((n) => byName.get(n)).filter(Boolean);
}
