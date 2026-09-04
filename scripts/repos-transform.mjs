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
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? 'last month' : `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'last year' : `${years} years ago`;
}

function normalise(r) {
  return {
    name: r.name,
    description: r.description ?? '',
    language: r.language ?? '',
    stars: r.stargazers_count ?? 0,
    pushedAt: r.pushed_at,
    url: r.html_url,
    accent: accentFor(r.name),
  };
}

export function selectRepos(raw, config) {
  const deny = new Set(config.deny ?? []);
  const eligible = raw
    .filter((r) => !r.fork && !r.archived && !r.private && !deny.has(r.name))
    .map(normalise);

  const byName = new Map(eligible.map((r) => [r.name, r]));

  const featured = (config.featured ?? [])
    .map((n) => byName.get(n))
    .filter(Boolean);

  const featuredNames = new Set(featured.map((r) => r.name));
  const rest = eligible
    .filter((r) => !featuredNames.has(r.name))
    .sort((a, b) => new Date(b.pushedAt) - new Date(a.pushedAt));

  return { featured, rest };
}
