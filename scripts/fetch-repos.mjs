import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import site from '../src/config/site.mjs';
import { selectRepos } from './repos-transform.mjs';

const OUT = fileURLToPath(new URL('../src/data/repos.json', import.meta.url));
const API = `https://api.github.com/users/${site.owner}/repos?per_page=100&type=owner`;

const headers = { accept: 'application/vnd.github+json', 'user-agent': 'agemo.me-build' };
if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

try {
  const res = await fetch(API, { headers, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);

  const { featured, rest } = selectRepos(await res.json(), site);
  if (featured.length + rest.length === 0) throw new Error('API returned zero eligible repos');

  // Spec §5.3: the hover reflection shows the README's opening line. Only
  // featured repos need it, so this is at most four extra requests.
  await Promise.all(featured.map(async (repo) => {
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

  writeFileSync(OUT, `${JSON.stringify({ generatedAt: new Date().toISOString(), featured, rest }, null, 2)}\n`);
  console.log(`repos.json updated: ${featured.length} featured, ${rest.length} other`);
} catch (err) {
  // Spec §4.3: the build must not fail when the API is unreachable.
  console.warn(`warning: repo fetch failed (${err.message}) — keeping committed repos.json`);
  if (!existsSync(OUT)) {
    console.error('fatal: no committed repos.json to fall back to');
    process.exit(1);
  }
}
