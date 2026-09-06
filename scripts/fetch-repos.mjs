import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import site from '../src/config/site.mjs';
import { selectPinned } from './repos-transform.mjs';

const OUT = fileURLToPath(new URL('../src/data/repos.json', import.meta.url));
const REST = `https://api.github.com/users/${site.owner}/repos?per_page=100&type=owner`;

const headers = { accept: 'application/vnd.github+json', 'user-agent': 'agemo.me-build' };
if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

/**
 * The live pin list. GraphQL is the only API that exposes pins, and it
 * refuses unauthenticated requests — so without a token this returns null
 * and selectPinned falls back to site.pinned. That fallback is the reason
 * `npm run build` still produces the right page on a laptop with no
 * GITHUB_TOKEN exported.
 */
async function fetchPinnedNames() {
  if (!process.env.GITHUB_TOKEN) return null;
  const query = `{ user(login: "${site.owner}") {
    pinnedItems(first: 10, types: REPOSITORY) { nodes { ... on Repository { name } } }
  } }`;
  try {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`GraphQL returned ${res.status}`);
    const body = await res.json();
    const names = body?.data?.user?.pinnedItems?.nodes?.map((n) => n?.name).filter(Boolean);
    return names?.length ? names : null;
  } catch (err) {
    console.warn(`warning: pin list unavailable (${err.message}) — using site.pinned`);
    return null;
  }
}

try {
  const [res, pinnedNames] = await Promise.all([
    fetch(REST, { headers, signal: AbortSignal.timeout(15_000) }),
    fetchPinnedNames(),
  ]);
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);

  const pinned = selectPinned(await res.json(), site, pinnedNames);
  if (pinned.length === 0) throw new Error('no pinned repos survived selection');

  // Spec §5.3: the hover reflection shows the README's opening line. Four
  // repos, so four extra requests.
  await Promise.all(pinned.map(async (repo) => {
    try {
      const r = await fetch(
        `https://api.github.com/repos/${site.owner}/${repo.name}/readme`,
        { headers: { ...headers, accept: 'application/vnd.github.raw' }, signal: AbortSignal.timeout(10_000) },
      );
      if (!r.ok) return;
      const line = (await r.text())
        .split('\n')
        .map((l) => l.replace(/^#+\s*/, '').trim())
        .find((l) => l.length > 0 && !l.startsWith('!') && !l.startsWith('<'));
      repo.readmeLine = line ? line.slice(0, 140) : '';
    } catch {
      repo.readmeLine = ''; // best-effort; the card falls back to the description
    }
  }));

  writeFileSync(OUT, `${JSON.stringify({ generatedAt: new Date().toISOString(), pinned }, null, 2)}\n`);
  console.log(`repos.json updated: ${pinned.length} pinned (${pinnedNames ? 'live pins' : 'site.pinned fallback'})`);
} catch (err) {
  // Spec §4.3: the build must not fail when the API is unreachable.
  console.warn(`warning: repo fetch failed (${err.message}) — keeping committed repos.json`);
  if (!existsSync(OUT)) {
    console.error('fatal: no committed repos.json to fall back to');
    process.exit(1);
  }
}
