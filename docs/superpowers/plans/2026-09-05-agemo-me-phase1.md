# agemo.me Phase 1 ("The Mirror") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a complete, static, single-page personal site at `agemo.me` built on the "waterline mirror" concept — hero, identity strip, live GitHub project grid, uses block, and contact — deployed to GitHub Pages behind a CI gate that proves it works.

**Architecture:** Astro 5 in static mode emits HTML; three small vanilla JS modules add motion and presence as progressive enhancement. Project data is fetched from the GitHub REST API at build time into a committed `src/data/repos.json`, so the site builds offline and makes no runtime GitHub calls. Every visual effect has a working no-JS/no-WebGL fallback that is built *before* the enhanced version.

**Tech Stack:** Astro 5, plain CSS with custom properties (no Tailwind), vanilla ES modules, `node:test` for unit tests, Playwright for end-to-end assertions, Lighthouse CI for budgets, GitHub Actions for deploy.

**Spec:** `docs/superpowers/specs/2026-09-05-agemo-me-phase1-design.md`

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the spec.

- **Node 22 LTS**, npm. Verified present: Node v22.23.2, npm 12.0.2.
- **Astro 5**, `output: 'static'`. **No client-side framework.** No React, Vue, Svelte, Solid.
- **No Tailwind.** Plain CSS with custom properties only.
- **Exactly three** client JS modules: `mirror.js`, `scroll.js`, `presence.js`. No others.
- **JavaScript budget: < 150 KB gzipped, total.** **LCP < 1.5 s.**
- **Lighthouse thresholds: performance ≥ 90, accessibility ≥ 95.**
- **All text pairs meet WCAG AA** — 4.5:1 body, 3:1 large.
- **`prefers-reduced-motion: reduce` disables the shader and every transform.** Non-negotiable.
- **Pseudonymous.** The strings "Omega" and the handle `DeadlyOmega` may appear. A real name, a location, and a photograph must never appear.
- **No email address appears anywhere on the site**, obfuscated or otherwise. No contact form. Contact is **Discord and GitHub only**.
- Discord ID for Lanyard: `626069774002159619`.
- **`--live` (`#FF7EB6`) is used for presence indicators and nothing else.**
- Fonts are **self-hosted and subset**. No third-party font CDN at runtime.
- **No runtime GitHub API calls.** Build-time only.
- The build **must succeed with network access disabled.**
- Phase 1 is **one route `/` plus `404`.** No blog, terminal, guestbook, Spotify, WakaTime, rice gallery, light theme, analytics, or server-side component.

## File Structure

| File | Responsibility |
|------|----------------|
| `package.json` | scripts, deps |
| `astro.config.mjs` | static output, site URL |
| `playwright.config.mjs` | e2e config, preview webServer |
| `lighthouserc.json` | LHCI thresholds |
| `src/config/site.mjs` | featured list, deny-list, Discord ID, links, copy strings — the single place content is configured |
| `scripts/repos-transform.mjs` | **pure** functions: filter, sort, relative age, per-repo accent |
| `scripts/fetch-repos.mjs` | CLI wrapper: calls GitHub API, applies transform, writes `repos.json`, tolerates offline |
| `src/data/repos.json` | committed project data / offline fallback |
| `src/styles/tokens.css` | palette + type + motion custom properties |
| `src/styles/base.css` | reset, base type, reduced-motion kill-switch |
| `src/layouts/Base.astro` | document shell, fonts, meta |
| `src/pages/index.astro` | composes the six sections |
| `src/pages/404.astro` | mirrored 404 |
| `src/components/Hero.astro` | waterline hero + CSS fallback |
| `src/components/IdentityStrip.astro` | sentence + presence chips |
| `src/components/Work.astro` | featured + list layout |
| `src/components/ProjectCard.astro` | one repo, with hover reflection |
| `src/components/Machine.astro` | uses / fetch block |
| `src/components/Reach.astro` | Discord + GitHub targets |
| `src/components/Footer.astro` | palindrome, build time, commit SHA |
| `src/scripts/mirror.js` | WebGL reflection (progressive enhancement) |
| `src/scripts/scroll.js` | scroll-driven rotation |
| `src/scripts/presence.js` | Lanyard fetch + degrade |
| `tests/repos-transform.test.mjs` | unit tests for the pure transforms |
| `tests/contrast.test.mjs` | unit test asserting palette meets AA |
| `tests/site.spec.mjs` | Playwright assertions against the built site |
| `.github/workflows/ci.yml` | build + unit + e2e + LHCI on every push |
| `.github/workflows/deploy.yml` | Pages deploy on main |
| `.github/workflows/refresh-data.yml` | daily repos.json refresh |
| `public/CNAME` | `agemo.me` |

---

### Task 1: Scaffold + the verification harness

Build the check before the thing it checks. This task ends with a green pipeline that proves an empty site builds, serves, and is asserted against — so every later task has a gate to fail.

**Files:**
- Create: `package.json`, `astro.config.mjs`, `playwright.config.mjs`, `.gitignore`, `src/pages/index.astro`, `tests/site.spec.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: npm scripts `build`, `preview`, `test:unit`, `test:e2e`, `verify`. Every later task runs `npm run verify`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "agemo-me",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "astro dev",
    "build": "node scripts/fetch-repos.mjs && astro build",
    "build:offline": "astro build",
    "preview": "astro preview --port 4321",
    "test:unit": "node --test tests/*.test.mjs",
    "test:e2e": "playwright test",
    "verify": "npm run build && npm run test:unit && npm run test:e2e"
  },
  "devDependencies": {
    "astro": "^5.0.0",
    "@playwright/test": "^1.49.0"
  }
}
```

Note `build:offline` skips the fetch — it is what proves the offline requirement in Task 3.

- [ ] **Step 2: Create `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://agemo.me',
  output: 'static',
  build: { inlineStylesheets: 'auto' },
});
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
.astro/
test-results/
playwright-report/
.lighthouseci/
```

- [ ] **Step 4: Create `playwright.config.mjs`**

```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.mjs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'off',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

- [ ] **Step 5: Write the failing test**

Create `tests/site.spec.mjs`:

```js
import { test, expect } from '@playwright/test';

test('page loads with the correct title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/agemo/i);
});

test('page logs no console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});
```

- [ ] **Step 6: Install and run the test to verify it fails**

```bash
npm install
npx playwright install --with-deps chromium
npm run build:offline && npm run test:e2e
```

Expected: FAIL — `astro build` errors because `src/pages/index.astro` does not exist.

- [ ] **Step 7: Write the minimal implementation**

Create `src/pages/index.astro`:

```astro
---
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>agemo</title>
  </head>
  <body></body>
</html>
```

- [ ] **Step 8: Run the tests to verify they pass**

```bash
npm run build:offline && npm run test:e2e
```

Expected: PASS, 2 passed.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json astro.config.mjs playwright.config.mjs .gitignore src/pages/index.astro tests/site.spec.mjs
git commit -m "feat: scaffold Astro site with Playwright verification harness"
```

---

### Task 2: Design tokens + an automated contrast gate

The spec requires WCAG AA across the palette. That is asserted by a test, not assumed.

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/base.css`, `tests/contrast.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties `--bg --surface --text --muted --accent --accent-2 --live --ease --dur-1 --dur-2 --dur-3 --font-display --font-mono`, consumed by every component from Task 4 onward.

- [ ] **Step 1: Write the failing test**

Create `tests/contrast.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

function token(name) {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `token --${name} not found in tokens.css`);
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

test('body text meets AA (4.5:1) on both grounds', () => {
  assert.ok(ratio(token('text'), token('bg')) >= 4.5);
  assert.ok(ratio(token('text'), token('surface')) >= 4.5);
});

test('muted text meets AA (4.5:1) on both grounds', () => {
  assert.ok(ratio(token('muted'), token('bg')) >= 4.5);
  assert.ok(ratio(token('muted'), token('surface')) >= 4.5);
});

test('accent colours meet large-text AA (3:1) on both grounds', () => {
  for (const t of ['accent', 'accent-2', 'live']) {
    assert.ok(ratio(token(t), token('bg')) >= 3, `--${t} on --bg`);
    assert.ok(ratio(token(t), token('surface')) >= 3, `--${t} on --surface`);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — `ENOENT`, `src/styles/tokens.css` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/styles/tokens.css`:

```css
:root {
  /* palette — spec §6.2 */
  --bg: #0B0D0F;
  --surface: #14181C;
  --text: #E6EAEE;
  --muted: #8B97A5;
  --accent: #33B1FF;
  --accent-2: #78A9FF;
  --live: #FF7EB6;

  /* type — spec §6.1 */
  --font-display: 'Instrument Serif', Georgia, 'Times New Roman', serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  /* motion — one easing, one duration scale (spec §6.3) */
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --dur-1: 160ms;
  --dur-2: 420ms;
  --dur-3: 900ms;

  /* layout */
  --measure: 68ch;
  --gutter: clamp(1.25rem, 4vw, 4rem);
}
```

`--muted` is `#8B97A5`, not the spec's illustrative `#6B7785`: the darker value
measures 3.9:1 on `--bg` and fails the AA requirement the same spec section
mandates. The requirement wins over the sample value; the hue is unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit`
Expected: PASS, 3 tests.

- [ ] **Step 5: Create `src/styles/base.css`**

```css
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; }

html { color-scheme: dark; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: clamp(0.95rem, 0.9rem + 0.2vw, 1.05rem);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

img, svg, canvas { display: block; max-width: 100%; }

a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 0.25em; }
a:focus-visible, button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.visually-hidden {
  position: absolute; width: 1px; height: 1px;
  padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}

/* Global reduced-motion kill switch — spec §6.3, non-negotiable */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
    transform: none !important;
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/styles/tokens.css src/styles/base.css tests/contrast.test.mjs
git commit -m "feat: add design tokens with an automated WCAG AA contrast gate"
```

---

### Task 3: Site config, repo transforms, and the build-time fetch

All content configuration lives in one file. All repo logic is pure and unit-tested; the network wrapper is thin and tolerates failure.

**Files:**
- Create: `src/config/site.mjs`, `scripts/repos-transform.mjs`, `scripts/fetch-repos.mjs`, `src/data/repos.json`, `tests/repos-transform.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `site.mjs` default-exports `{ handle, owner, discordId, featured: string[], deny: string[], tagline, links: {discord, github, dotfiles}, uses: Array<{k,v}> }`
  - `selectRepos(raw: object[], config: {featured: string[], deny: string[]}) => { featured: Repo[], rest: Repo[] }`
  - `relativeAge(iso: string, now?: Date) => string`
  - `accentFor(name: string) => string` (an `hsl(...)` string)
  - `Repo = { name, description, language, stars, pushedAt, url, accent }`,
    plus `readmeLine?: string` on featured repos only (added by the fetch
    wrapper, not by `selectRepos`)
  - `src/data/repos.json` shape: `{ generatedAt: string, featured: Repo[], rest: Repo[] }`

- [ ] **Step 1: Create `src/config/site.mjs`**

```js
export default {
  handle: 'Omega',
  owner: 'omeg4-dev',
  discordId: '626069774002159619',

  // Repos given large treatment in the Work grid — spec §5.3
  featured: ['mc-jukebox', 'magpie', 'hypr-keybind-overlay', 'gamehub'],

  // Suppressed from the grid entirely — spec §5.3 deny-list
  deny: ['sus', 'DeadlyOmega.github.io'],

  tagline: 'I build things for Linux desktops that should not need to exist.',

  links: {
    discord: 'https://discord.com/users/626069774002159619',
    github: 'https://github.com/DeadlyOmega',
    dotfiles: 'https://github.com/omeg4-dev',
  },

  // spec §5.4 — the machine
  uses: [
    { k: 'os', v: 'CachyOS' },
    { k: 'wm', v: 'Hyprland' },
    { k: 'shell', v: 'Noctalia v5' },
    { k: 'palette', v: 'Oxocarbon' },
    { k: 'lang', v: 'Python' },
    { k: 'fs', v: 'btrfs + snapper' },
  ],
};
```

- [ ] **Step 2: Write the failing test**

Create `tests/repos-transform.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectRepos, relativeAge, accentFor } from '../scripts/repos-transform.mjs';

const raw = [
  { name: 'mc-jukebox', description: 'A jukebox.', language: 'Python', stargazers_count: 3,
    pushed_at: '2026-09-02T20:04:49Z', html_url: 'u/mc', fork: false, archived: false, private: false },
  { name: 'magpie', description: 'A clipboard.', language: 'Python', stargazers_count: 1,
    pushed_at: '2026-09-01T00:00:00Z', html_url: 'u/mg', fork: false, archived: false, private: false },
  { name: 'snake', description: null, language: 'C', stargazers_count: 0,
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — `Cannot find module '../scripts/repos-transform.mjs'`.

- [ ] **Step 4: Write the implementation**

Create `scripts/repos-transform.mjs`:

```js
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:unit`
Expected: PASS, 10 tests (3 contrast + 7 transform).

- [ ] **Step 6: Write the fetch wrapper**

Create `scripts/fetch-repos.mjs`:

```js
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
```

- [ ] **Step 7: Generate the committed data and prove offline fallback works**

```bash
node scripts/fetch-repos.mjs
cat src/data/repos.json | head -20
```

Expected: prints "repos.json updated: N featured, M other", and the file contains real repo names.

Then prove the offline path — this is the spec's hard requirement:

```bash
node --no-network scripts/fetch-repos.mjs 2>/dev/null \
  || http_proxy=http://127.0.0.1:1 https_proxy=http://127.0.0.1:1 node scripts/fetch-repos.mjs
echo "exit=$?"
```

Expected: prints the "warning: repo fetch failed … keeping committed repos.json" line and `exit=0`. If it exits non-zero, the fallback is broken — fix before continuing.

- [ ] **Step 8: Commit**

```bash
git add src/config/site.mjs scripts/repos-transform.mjs scripts/fetch-repos.mjs src/data/repos.json tests/repos-transform.test.mjs
git commit -m "feat: add site config, pure repo transforms, and offline-tolerant build-time fetch"
```

---

### Task 4: Base layout and self-hosted fonts

**Files:**
- Create: `src/layouts/Base.astro`, `public/fonts/` (2 woff2 files)
- Modify: `src/pages/index.astro`
- Modify: `tests/site.spec.mjs`

**Interfaces:**
- Consumes: `src/styles/tokens.css`, `src/styles/base.css` (Task 2).
- Produces: `Base.astro` accepting props `{ title: string, description: string }` and a default `<slot />`. Every page uses it.

- [ ] **Step 1: Download and subset the fonts**

```bash
mkdir -p public/fonts
curl -sL -o /tmp/instrument.zip "https://fonts.google.com/download?family=Instrument%20Serif"
curl -sL -o /tmp/plexmono.zip "https://fonts.google.com/download?family=IBM%20Plex%20Mono"
```

Extract `InstrumentSerif-Regular.ttf` and `IBMPlexMono-Regular.ttf`, then convert to subset woff2 (Latin + Greek Ω, U+03A9):

```bash
pip install --user fonttools brotli
pyftsubset /tmp/InstrumentSerif-Regular.ttf \
  --unicodes="U+0000-00FF,U+03A9,U+27F7,U+2192" \
  --flavor=woff2 --output-file=public/fonts/instrument-serif.woff2
pyftsubset /tmp/IBMPlexMono-Regular.ttf \
  --unicodes="U+0000-00FF,U+03A9,U+27F7,U+2192" \
  --flavor=woff2 --output-file=public/fonts/plex-mono.woff2
ls -lh public/fonts/
```

Expected: both files present, each well under 40 KB. If either exceeds 40 KB the subset did not apply — re-check the `--unicodes` argument.

- [ ] **Step 2: Write the failing test**

Append to `tests/site.spec.mjs`:

```js
test('fonts are self-hosted, never fetched from a third-party CDN', async ({ page }) => {
  const external = [];
  page.on('request', (req) => {
    const url = req.url();
    if (/fonts\.(googleapis|gstatic)\.com|use\.typekit|cdn\.jsdelivr|unpkg\.com/.test(url)) {
      external.push(url);
    }
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(external).toEqual([]);
});

test('the display face is actually applied to the wordmark', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const family = await page.locator('[data-wordmark]').evaluate(
    (el) => getComputedStyle(el).fontFamily,
  );
  expect(family).toContain('Instrument Serif');
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run build:offline && npm run test:e2e`
Expected: FAIL — `[data-wordmark]` resolves to zero elements.

- [ ] **Step 4: Create `src/layouts/Base.astro`**

```astro
---
import '../styles/tokens.css';
import '../styles/base.css';

const { title, description } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <meta name="theme-color" content="#0B0D0F" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <link rel="canonical" href={Astro.site} />
    <link rel="preload" href="/fonts/instrument-serif.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/fonts/plex-mono.woff2" as="font" type="font/woff2" crossorigin />
  </head>
  <body>
    <slot />
  </body>
</html>

<style is:global>
  @font-face {
    font-family: 'Instrument Serif';
    src: url('/fonts/instrument-serif.woff2') format('woff2');
    font-weight: 400;
    font-display: swap;
  }
  @font-face {
    font-family: 'IBM Plex Mono';
    src: url('/fonts/plex-mono.woff2') format('woff2');
    font-weight: 400;
    font-display: swap;
  }
</style>
```

- [ ] **Step 5: Rewrite `src/pages/index.astro` to use it**

```astro
---
import Base from '../layouts/Base.astro';
import site from '../config/site.mjs';
---
<Base title="agemo" description={site.tagline}>
  <h1 data-wordmark>Ω</h1>
</Base>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run build:offline && npm run test:e2e`
Expected: PASS, 4 passed.

- [ ] **Step 7: Commit**

```bash
git add src/layouts/Base.astro src/pages/index.astro public/fonts tests/site.spec.mjs
git commit -m "feat: add base layout with self-hosted subset fonts"
```

---

### Task 5: Waterline hero — CSS fallback first

Spec §5.1 mandates the fallback is built first. At the end of this task the hero is complete and good with JavaScript entirely disabled. Task 6 only makes it move.

**Files:**
- Create: `src/components/Hero.astro`
- Modify: `src/pages/index.astro`, `tests/site.spec.mjs`

**Interfaces:**
- Consumes: tokens (Task 2), `Base.astro` (Task 4).
- Produces: DOM contract relied on by Tasks 6 and 7 — a `<section data-hero>` containing `[data-wordmark]` (the real Ω), `[data-reflection]` (the CSS mirror, reading AGEMO), and `[data-mirror-canvas]` (empty mount point for the shader).

- [ ] **Step 1: Write the failing test**

Append to `tests/site.spec.mjs`:

```js
test('hero renders a real subject and a reflection without JavaScript', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('[data-hero] [data-wordmark]')).toBeVisible();
  await expect(page.locator('[data-hero] [data-reflection]')).toBeVisible();
  await ctx.close();
});

test('the reflection reads AGEMO and is hidden from screen readers', async ({ page }) => {
  await page.goto('/');
  const reflection = page.locator('[data-hero] [data-reflection]');
  await expect(reflection).toHaveText(/agemo/i);
  await expect(reflection).toHaveAttribute('aria-hidden', 'true');
});

test('the hero exposes an accessible name for the site', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText(/agemo/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build:offline && npm run test:e2e`
Expected: FAIL — `[data-hero]` not found.

- [ ] **Step 3: Create `src/components/Hero.astro`**

```astro
---
---
<section class="hero" data-hero>
  <h1 class="hero__mark" data-wordmark>
    <span aria-hidden="true">Ω</span>
    <span class="visually-hidden">agemo</span>
  </h1>

  <div class="hero__waterline" aria-hidden="true"></div>

  <div class="hero__reflection" data-reflection aria-hidden="true">agemo</div>

  <canvas class="hero__canvas" data-mirror-canvas aria-hidden="true"></canvas>

  <p class="hero__hint" aria-hidden="true">scroll through</p>
</section>

<style>
  .hero {
    position: relative;
    display: grid;
    grid-template-rows: 1fr auto 1fr;
    place-items: center;
    min-height: 100svh;
    overflow: hidden;
    isolation: isolate;
  }

  .hero__mark {
    font-family: var(--font-display);
    font-weight: 400;
    font-size: clamp(8rem, 34vw, 26rem);
    line-height: 0.8;
    align-self: end;
    background: linear-gradient(175deg, var(--text) 30%, var(--accent) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .hero__waterline {
    width: min(90vw, 1100px);
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    opacity: 0.55;
  }

  /* The CSS fallback reflection — spec §5.1. Not a copy: inverted,
     blurred, faded, and reading the reversed wordmark. */
  .hero__reflection {
    align-self: start;
    font-family: var(--font-display);
    font-size: clamp(3.4rem, 14.5vw, 11rem);
    letter-spacing: 0.06em;
    line-height: 1;
    padding-top: 0.15em;
    color: var(--accent);
    transform: scaleY(-1);
    filter: blur(1.5px);
    opacity: 0.42;
    -webkit-mask-image: linear-gradient(to top, transparent 5%, #000 85%);
    mask-image: linear-gradient(to top, transparent 5%, #000 85%);
  }

  /* Shader mount. Stays empty and invisible until mirror.js claims it. */
  .hero__canvas {
    position: absolute;
    inset: 50% 0 0 0;
    width: 100%;
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--dur-3) var(--ease);
  }
  .hero__canvas[data-active] { opacity: 1; }
  /* When the shader is live, the CSS stand-in steps aside. */
  .hero:has([data-mirror-canvas][data-active]) .hero__reflection { opacity: 0; }

  .hero__hint {
    position: absolute;
    bottom: 2rem;
    font-size: 0.7rem;
    letter-spacing: 0.35em;
    text-transform: uppercase;
    color: var(--muted);
  }

  @media (prefers-reduced-motion: reduce) {
    .hero__canvas { display: none; }
    .hero__reflection { opacity: 0.42; }
  }
</style>
```

- [ ] **Step 4: Use it in `src/pages/index.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import Hero from '../components/Hero.astro';
import site from '../config/site.mjs';
---
<Base title="agemo" description={site.tagline}>
  <Hero />
</Base>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run build:offline && npm run test:e2e`
Expected: PASS, 7 passed.

- [ ] **Step 6: Commit**

```bash
git add src/components/Hero.astro src/pages/index.astro tests/site.spec.mjs
git commit -m "feat: add waterline hero with a no-JS CSS reflection fallback"
```

---

### Task 6: `mirror.js` — the WebGL reflection

Progressive enhancement only. If anything here fails, the Task 5 fallback is what the visitor sees, and that is an acceptable outcome.

**Files:**
- Create: `src/scripts/mirror.js`
- Modify: `src/components/Hero.astro`, `tests/site.spec.mjs`

**Interfaces:**
- Consumes: `[data-mirror-canvas]`, `[data-hero]` from Task 5.
- Produces: sets `data-active` on the canvas when the shader is running. Task 7's `scroll.js` reads that attribute to decide whether to drive the shader or the CSS transform.

- [ ] **Step 1: Write the failing test**

Append to `tests/site.spec.mjs`:

```js
test('the shader activates on desktop and hides the CSS stand-in', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-mirror-canvas][data-active]')).toBeAttached({ timeout: 5000 });
});

test('the shader never activates under reduced motion', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.waitForTimeout(1500);
  await expect(page.locator('[data-mirror-canvas][data-active]')).toHaveCount(0);
  await expect(page.locator('[data-reflection]')).toBeVisible();
  await ctx.close();
});

test('the shader never activates on narrow viewports', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.waitForTimeout(1500);
  await expect(page.locator('[data-mirror-canvas][data-active]')).toHaveCount(0);
  await ctx.close();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build:offline && npm run test:e2e`
Expected: FAIL — the first test times out; no element ever gains `data-active`.

- [ ] **Step 3: Create `src/scripts/mirror.js`**

```js
// Waterline reflection. Renders the wordmark AGEMO into a rippling surface
// below the hero's midline. Pure WebGL1, no libraries, ~4 KB.
// Bails out silently on any failure; Hero.astro's CSS reflection remains.

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_text;
uniform vec2  u_res;
uniform vec2  u_mouse;
uniform float u_time;
uniform vec3  u_accent;

void main() {
  vec2 uv = v_uv;

  // Depth: distortion grows the further below the waterline we are.
  float depth = 1.0 - uv.y;

  // Travelling ripples.
  float w = sin(uv.x * 22.0 - u_time * 1.1) * 0.0038
          + sin(uv.x * 41.0 + u_time * 0.7) * 0.0021;

  // A wake that follows the cursor.
  float d = distance(uv * u_res / u_res.y, u_mouse * u_res / u_res.y);
  w += sin(d * 34.0 - u_time * 2.4) * 0.0075 * exp(-d * 3.4);

  uv.x += w * (0.35 + depth * 1.9);
  uv.y += w * 0.45;

  // The texture is drawn upright; flipping y here makes it a reflection.
  vec4 tex = texture2D(u_text, vec2(uv.x, 1.0 - uv.y));

  vec3 col = mix(u_accent, vec3(1.0), 0.18) * tex.a;
  float fade = smoothstep(0.0, 0.72, uv.y);
  float shimmer = 0.94 + 0.06 * sin(uv.y * 60.0 + u_time * 1.6);

  gl_FragColor = vec4(col * shimmer, tex.a * fade * 0.72);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed');
  }
  return s;
}

// Renders "agemo" to a 2D canvas we can sample as a texture.
function wordmarkTexture(gl, width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  const size = Math.min(width * 0.19, height * 0.62);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `${size}px "Instrument Serif", Georgia, serif`;
  ctx.letterSpacing = '0.06em';
  ctx.fillText('agemo', width / 2, height * 0.06);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

export function initMirror() {
  const canvas = document.querySelector('[data-mirror-canvas]');
  if (!canvas) return null;

  // Spec §6.3 and §6.4: never under reduced motion, never below 768px.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  if (window.innerWidth < 768) return null;

  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) return null;

  let raf = 0;
  const mouse = { x: 0.5, y: 0.5 };

  try {
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || 'link failed');
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = {
      res: gl.getUniformLocation(prog, 'u_res'),
      mouse: gl.getUniformLocation(prog, 'u_mouse'),
      time: gl.getUniformLocation(prog, 'u_time'),
      accent: gl.getUniformLocation(prog, 'u_accent'),
      text: gl.getUniformLocation(prog, 'u_text'),
    };
    gl.uniform3f(u.accent, 0.2, 0.694, 1.0); // #33B1FF
    gl.uniform1i(u.text, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let tex = null;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (!w || !h) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.res, w, h);
      if (tex) gl.deleteTexture(tex);
      tex = wordmarkTexture(gl, w, h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
    };

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / r.width;
      mouse.y = 1 - (e.clientY - r.top) / r.height;
    };

    const start = performance.now();
    let running = true;
    const frame = () => {
      if (!running) return;
      gl.uniform1f(u.time, (performance.now() - start) / 1000);
      gl.uniform2f(u.mouse, mouse.x, mouse.y);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });

    // Stop burning GPU when the hero is off-screen or the tab is hidden.
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !running) { running = true; frame(); }
      else if (!entry.isIntersecting) { running = false; cancelAnimationFrame(raf); }
    });
    io.observe(canvas);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!running) { running = true; frame(); }
    });

    canvas.setAttribute('data-active', '');
    frame();
    return { stop: () => { running = false; cancelAnimationFrame(raf); } };
  } catch (err) {
    cancelAnimationFrame(raf);
    canvas.removeAttribute('data-active');
    return null; // CSS fallback stands.
  }
}
```

- [ ] **Step 4: Wire it into `src/components/Hero.astro`**

Append at the end of the file, after the `<style>` block:

```astro
<script>
  import { initMirror } from '../scripts/mirror.js';
  // Wait for the display face so the texture is drawn in the right typeface,
  // and defer past first paint so the shader never competes with LCP.
  const boot = () => document.fonts.ready.then(() => initMirror());
  if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 2000 });
  else window.addEventListener('load', boot);
</script>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run build:offline && npm run test:e2e`
Expected: PASS, 10 passed.

If the shader test fails because headless Chromium has no GPU, add `--use-gl=swiftshader` to the launch args in `playwright.config.mjs`:

```js
projects: [
  { name: 'desktop', use: { ...devices['Desktop Chrome'],
      viewport: { width: 1440, height: 900 },
      launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] } } },
],
```

- [ ] **Step 6: Commit**

```bash
git add src/scripts/mirror.js src/components/Hero.astro tests/site.spec.mjs playwright.config.mjs
git commit -m "feat: add WebGL waterline reflection as progressive enhancement"
```

---

### Task 7: `scroll.js` — passing through the waterline

**Files:**
- Create: `src/scripts/scroll.js`
- Modify: `src/components/Hero.astro`, `src/styles/base.css`, `tests/site.spec.mjs`

**Interfaces:**
- Consumes: `[data-hero]` (Task 5), the `data-active` flag (Task 6).
- Produces: sets the CSS custom property `--dive` (0 → 1) on `[data-hero]`, and adds `data-revealed` to any `[data-reveal]` element that enters the viewport. Tasks 9–11 use `data-reveal`.

- [ ] **Step 1: Write the failing test**

Append to `tests/site.spec.mjs`:

```js
test('scrolling drives the hero dive property', async ({ page }) => {
  await page.goto('/');
  const read = () => page.locator('[data-hero]').evaluate(
    (el) => Number(getComputedStyle(el).getPropertyValue('--dive')) || 0,
  );
  expect(await read()).toBeCloseTo(0, 1);
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 0.75));
  await page.waitForTimeout(300);
  expect(await read()).toBeGreaterThan(0.3);
});

test('reduced motion runs no transform animations', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await page.waitForTimeout(500);
  const moved = await page.evaluate(() =>
    [...document.querySelectorAll('*')].filter((el) => {
      const t = getComputedStyle(el).transform;
      return t && t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)';
    }).length,
  );
  expect(moved).toBe(0);
  await ctx.close();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build:offline && npm run test:e2e`
Expected: FAIL — `--dive` stays 0 after scrolling; and the reduced-motion test fails because `.hero__reflection` still carries `scaleY(-1)`.

- [ ] **Step 3: Create `src/scripts/scroll.js`**

```js
// Scroll orchestration. Two jobs:
//   1. drive --dive on the hero (0 at rest, 1 when fully through the waterline)
//   2. flip data-revealed on [data-reveal] elements as they enter view
// Both are inert under reduced motion.

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function driveDive() {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;

  let ticking = false;
  const update = () => {
    ticking = false;
    const dive = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
    hero.style.setProperty('--dive', dive.toFixed(4));
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
}

function revealOnEnter() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;

  if (reduced() || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.setAttribute('data-revealed', ''));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute('data-revealed', '');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
  );
  targets.forEach((el) => io.observe(el));
}

export function initScroll() {
  // --dive still updates under reduced motion; the CSS simply ignores it,
  // so nothing moves but state stays consistent for anything reading it.
  driveDive();
  revealOnEnter();
}
```

- [ ] **Step 4: Add the dive styling to `src/components/Hero.astro`**

Inside the existing `<style>` block, add:

```css
  .hero { --dive: 0; }

  /* Passing through the waterline: the real mark sinks and fades,
     the reflection rises and rights itself. */
  .hero__mark {
    transform: translateY(calc(var(--dive) * 26vh)) scale(calc(1 - var(--dive) * 0.12));
    opacity: calc(1 - var(--dive) * 1.1);
  }
  .hero__reflection {
    transform: scaleY(calc(-1 + var(--dive) * 2)) translateY(calc(var(--dive) * -14vh));
    opacity: calc(0.42 + var(--dive) * 0.58);
    filter: blur(calc(1.5px * (1 - var(--dive))));
  }
  .hero__waterline { transform: scaleX(calc(1 - var(--dive) * 0.85)); opacity: calc(0.55 - var(--dive) * 0.55); }
  .hero__hint { opacity: calc(1 - var(--dive) * 3); }
```

Then extend the existing reduced-motion block in the same file so nothing is transformed at all:

```css
  @media (prefers-reduced-motion: reduce) {
    .hero__canvas { display: none; }
    .hero__mark, .hero__waterline, .hero__hint { transform: none; opacity: 1; }
    /* No scaleY flip: the reflection is rendered upright and simply faded. */
    .hero__reflection {
      transform: none;
      opacity: 0.42;
      filter: none;
      -webkit-mask-image: none;
      mask-image: none;
    }
  }
```

- [ ] **Step 5: Add the reveal styling to `src/styles/base.css`**

```css
[data-reveal] {
  opacity: 0;
  transform: translateY(1.25rem);
  transition: opacity var(--dur-3) var(--ease), transform var(--dur-3) var(--ease);
}
[data-reveal][data-revealed] { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  [data-reveal] { opacity: 1; transform: none; transition: none; }
}
```

- [ ] **Step 6: Boot it — append to `src/components/Hero.astro`**

```astro
<script>
  import { initScroll } from '../scripts/scroll.js';
  initScroll();
</script>
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run build:offline && npm run test:e2e`
Expected: PASS, 12 passed.

- [ ] **Step 8: Commit**

```bash
git add src/scripts/scroll.js src/components/Hero.astro src/styles/base.css tests/site.spec.mjs
git commit -m "feat: drive the waterline dive and reveal-on-enter from scroll"
```

---

### Task 8: Identity strip + Lanyard presence

Spec §5.2: chips render in a resolved static state before Lanyard responds, never empty, never shifting layout on arrival.

**Files:**
- Create: `src/components/IdentityStrip.astro`, `src/scripts/presence.js`
- Modify: `src/pages/index.astro`, `tests/site.spec.mjs`

**Interfaces:**
- Consumes: `site.discordId`, `site.tagline` (Task 3).
- Produces: `[data-presence]` with children `[data-presence-state]`, `[data-presence-activity]`, `[data-clock]`.

- [ ] **Step 1: Write the failing test**

Append to `tests/site.spec.mjs`:

```js
test('presence chips are never empty, even before Lanyard answers', async ({ page }) => {
  await page.route('**/api.lanyard.rest/**', () => {}); // hang forever
  await page.goto('/');
  await expect(page.locator('[data-presence-state]')).not.toBeEmpty();
  await expect(page.locator('[data-presence-activity]')).not.toBeEmpty();
});

test('presence degrades to offline when Lanyard fails', async ({ page }) => {
  await page.route('**/api.lanyard.rest/**', (route) => route.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('[data-presence-state]')).toHaveText(/offline/i, { timeout: 5000 });
  expect(errors).toEqual([]);
});

test('presence renders the reported state when Lanyard succeeds', async ({ page }) => {
  await page.route('**/api.lanyard.rest/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          discord_status: 'online',
          activities: [{ type: 0, name: 'Neovim', state: 'editing mirror.js' }],
        },
      }),
    }),
  );
  await page.goto('/');
  await expect(page.locator('[data-presence-state]')).toHaveText(/online/i);
  await expect(page.locator('[data-presence-activity]')).toHaveText(/Neovim/);
});

test('the tagline types once and does not loop', async ({ page }) => {
  await page.goto('/');
  const iters = await page.locator('.identity__line').evaluate(
    (el) => getComputedStyle(el).animationIterationCount,
  );
  expect(iters).not.toContain('infinite');
});

test('no email address appears anywhere on the page', async ({ page }) => {
  await page.goto('/');
  const html = await page.content();
  expect(html).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  expect(html.toLowerCase()).not.toContain('tuta');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build:offline && npm run test:e2e`
Expected: FAIL — `[data-presence-state]` not found.

- [ ] **Step 3: Create `src/scripts/presence.js`**

```js
// Lanyard presence. Read-only, best-effort, and never load-bearing:
// every failure path ends at "offline" with no console noise.

const STATES = {
  online: 'online',
  idle: 'idle',
  dnd: 'do not disturb',
  offline: 'offline',
};

// Discord activity type 4 is a custom status, 2 is Spotify (Phase 3).
function describe(activities = []) {
  const act = activities.find((a) => a.type !== 4);
  if (!act) return 'nothing in particular';
  return act.state ? `${act.name} — ${act.state}` : act.name;
}

function startClock(el) {
  if (!el) return;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
  });
  const tick = () => { el.textContent = `${fmt.format(new Date())} local`; };
  tick();
  setInterval(tick, 30_000);
}

export async function initPresence() {
  const root = document.querySelector('[data-presence]');
  if (!root) return;

  startClock(root.querySelector('[data-clock]'));

  const id = root.getAttribute('data-discord-id');
  const stateEl = root.querySelector('[data-presence-state]');
  const actEl = root.querySelector('[data-presence-activity]');
  if (!id || !stateEl || !actEl) return;

  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${id}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(String(res.status));

    const json = await res.json();
    if (!json?.success || !json.data) throw new Error('unexpected payload');

    const status = json.data.discord_status ?? 'offline';
    stateEl.textContent = STATES[status] ?? 'offline';
    stateEl.setAttribute('data-state', status);
    actEl.textContent = describe(json.data.activities);
  } catch {
    // Spec §4.3 — degrade silently.
    stateEl.textContent = 'offline';
    stateEl.setAttribute('data-state', 'offline');
    actEl.textContent = 'presence unavailable';
  }
}
```

- [ ] **Step 4: Create `src/components/IdentityStrip.astro`**

```astro
---
import site from '../config/site.mjs';
---
<section class="identity" data-reveal style={`--chars: ${site.tagline.length}`}>
  <p class="identity__line">{site.tagline}</p>

  <ul class="identity__chips" data-presence data-discord-id={site.discordId}>
    <li class="chip">
      <span class="chip__dot" aria-hidden="true"></span>
      <span data-presence-state data-state="offline">checking…</span>
    </li>
    <li class="chip"><span data-presence-activity>—</span></li>
    <li class="chip"><span data-clock>—</span></li>
  </ul>
</section>

<style>
  .identity {
    display: grid;
    gap: 1.75rem;
    justify-items: center;
    text-align: center;
    padding: clamp(4rem, 12vh, 9rem) var(--gutter);
  }

  .identity__line {
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 3.4vw, 2.6rem);
    line-height: 1.25;
    max-width: 22ch;
    text-wrap: balance;
  }

  /* Spec §5.2: typed once on entry, never looping. Done in CSS so the
     "exactly three JS modules" constraint holds. The reveal is driven by
     [data-revealed] from scroll.js, so it types when it comes into view. */
  .identity__line {
    --chars: 62;
    display: inline-block;
    overflow: hidden;
    white-space: nowrap;
    max-width: none;
    border-right: 2px solid var(--accent);
    width: 0;
  }
  .identity[data-revealed] .identity__line {
    animation:
      type var(--dur-3) steps(var(--chars)) forwards,
      caret 700ms step-end 6;
  }
  @keyframes type  { to { width: 100%; } }
  @keyframes caret { 50% { border-color: transparent; } }

  /* Below the wrap point the line must be allowed to wrap, so the
     typewriter is dropped rather than clipping the sentence. */
  @media (max-width: 640px) {
    .identity__line {
      white-space: normal;
      overflow: visible;
      width: auto;
      max-width: 22ch;
      border-right: 0;
      animation: none !important;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .identity__line {
      width: auto;
      white-space: normal;
      overflow: visible;
      max-width: 22ch;
      border-right: 0;
      animation: none !important;
    }
  }

  .identity__chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    list-style: none;
    padding: 0;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    /* Fixed height stops arriving data from shifting layout — spec §5.2. */
    min-height: 2.25rem;
    padding: 0 0.85rem;
    border: 1px solid color-mix(in oklab, var(--muted) 35%, transparent);
    border-radius: 999px;
    background: var(--surface);
    color: var(--muted);
    font-size: 0.78rem;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .chip__dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--muted);
    transition: background var(--dur-1) var(--ease);
  }
  /* --live is used here and nowhere else — spec §6.2 */
  .chip:has([data-state='online']) .chip__dot { background: var(--live); }
  .chip:has([data-state='idle']) .chip__dot,
  .chip:has([data-state='dnd'])  .chip__dot { background: var(--accent-2); }
</style>

<script>
  import { initPresence } from '../scripts/presence.js';
  initPresence();
</script>
```

- [ ] **Step 5: Add it to `src/pages/index.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import Hero from '../components/Hero.astro';
import IdentityStrip from '../components/IdentityStrip.astro';
import site from '../config/site.mjs';
---
<Base title="agemo" description={site.tagline}>
  <Hero />
  <main>
    <IdentityStrip />
  </main>
</Base>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run build:offline && npm run test:e2e`
Expected: PASS, 17 passed.

- [ ] **Step 7: Commit**

```bash
git add src/components/IdentityStrip.astro src/scripts/presence.js src/pages/index.astro tests/site.spec.mjs
git commit -m "feat: add identity strip with degradation-safe Lanyard presence"
```

---

### Task 9: Work grid and project cards

**Files:**
- Create: `src/components/Work.astro`, `src/components/ProjectCard.astro`
- Modify: `src/pages/index.astro`, `tests/site.spec.mjs`

**Interfaces:**
- Consumes: `src/data/repos.json` (Task 3), `relativeAge` (Task 3), `data-reveal` (Task 7).
- Produces: `[data-project]` cards, each with `[data-project-name]`, `[data-project-lang]`, `[data-project-age]`.

- [ ] **Step 1: Write the failing test**

First, add this import at the **top** of `tests/site.spec.mjs`, beside the
existing `@playwright/test` import — ES module imports are only valid at the top
of a file, so it cannot go in the appended block:

```js
import site from '../src/config/site.mjs';
```

Then append the tests:

```js
test('the work grid renders enough cards with real data', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('[data-project]');
  // Floor is 6, not 8: the deny-list may legitimately shrink the set — spec §7.
  expect(await cards.count()).toBeGreaterThanOrEqual(6);

  for (const name of await page.locator('[data-project-name]').allTextContents()) {
    expect(name.trim()).not.toBe('');
  }
  for (const age of await page.locator('[data-project-age]').allTextContents()) {
    expect(age.trim()).toMatch(/today|yesterday|ago|last (month|year)/);
  }
});

test('every configured featured repo appears', async ({ page }) => {
  await page.goto('/');
  const names = (await page.locator('[data-project-name]').allTextContents()).map((n) => n.trim());
  for (const f of site.featured) expect(names).toContain(f);
});

test('deny-listed repos never appear', async ({ page }) => {
  await page.goto('/');
  const names = (await page.locator('[data-project-name]').allTextContents()).map((n) => n.trim());
  for (const d of site.deny) expect(names).not.toContain(d);
});

test('project links open safely in a new tab', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('[data-project] a').first();
  await expect(link).toHaveAttribute('rel', /noopener/);
  await expect(link).toHaveAttribute('target', '_blank');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build:offline && npm run test:e2e`
Expected: FAIL — `[data-project]` count is 0.

- [ ] **Step 3: Create `src/components/ProjectCard.astro`**

```astro
---
import { relativeAge } from '../../scripts/repos-transform.mjs';

const { repo, featured = false } = Astro.props;
const age = relativeAge(repo.pushedAt);
---
<article
  class:list={['card', featured && 'card--featured']}
  data-project
  data-reveal
  style={`--repo-accent: ${repo.accent}`}
>
  <a href={repo.url} target="_blank" rel="noopener noreferrer">
    <h3 class="card__name" data-project-name>{repo.name}</h3>
    {repo.description && <p class="card__desc">{repo.description}</p>}

    <dl class="card__meta">
      {repo.language && (
        <div><dt class="visually-hidden">Language</dt><dd data-project-lang>{repo.language}</dd></div>
      )}
      <div><dt class="visually-hidden">Stars</dt><dd>{repo.stars} ★</dd></div>
      <div><dt class="visually-hidden">Last commit</dt><dd data-project-age>{age}</dd></div>
    </dl>
  </a>

  <!-- Spec §5.3: inverted reflection showing the README's opening line,
       falling back to the description when no README was reachable. -->
  <div class="card__reflection" aria-hidden="true">
    {repo.readmeLine || repo.description || repo.name}
  </div>
</article>

<style>
  .card {
    position: relative;
    background: var(--surface);
    border: 1px solid color-mix(in oklab, var(--muted) 22%, transparent);
    border-radius: 14px;
    transition: border-color var(--dur-2) var(--ease), transform var(--dur-2) var(--ease);
  }
  .card:hover, .card:focus-within {
    border-color: var(--repo-accent);
    transform: translateY(-3px);
  }

  .card a {
    display: grid;
    gap: 0.6rem;
    padding: 1.4rem;
    color: inherit;
    text-decoration: none;
  }

  .card__name {
    font-family: var(--font-mono);
    font-size: 0.95rem;
    font-weight: 400;
    letter-spacing: 0.02em;
    color: var(--repo-accent);
  }

  .card__desc { color: var(--muted); font-size: 0.85rem; }

  .card__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.9rem;
    margin: 0;
    font-size: 0.72rem;
    color: var(--muted);
  }
  .card__meta div { display: contents; }
  .card__meta dd { margin: 0; }

  .card--featured .card__desc {
    font-family: var(--font-display);
    font-size: clamp(1.15rem, 2vw, 1.6rem);
    line-height: 1.3;
    color: var(--text);
    text-wrap: pretty;
  }
  .card--featured a { padding: clamp(1.6rem, 3vw, 2.6rem); gap: 0.9rem; }

  /* Hover reflection — spec §5.3 */
  .card__reflection {
    position: absolute;
    inset: 100% 1.4rem auto 1.4rem;
    transform: scaleY(-1);
    transform-origin: top;
    font-size: 0.8rem;
    color: var(--repo-accent);
    opacity: 0;
    pointer-events: none;
    -webkit-mask-image: linear-gradient(to top, transparent, #000);
    mask-image: linear-gradient(to top, transparent, #000);
    transition: opacity var(--dur-2) var(--ease);
  }
  .card:hover .card__reflection, .card:focus-within .card__reflection { opacity: 0.5; }

  @media (prefers-reduced-motion: reduce) {
    .card__reflection { display: none; }
    .card:hover, .card:focus-within { transform: none; }
  }
</style>
```

- [ ] **Step 4: Create `src/components/Work.astro`**

```astro
---
import ProjectCard from './ProjectCard.astro';
import repos from '../data/repos.json';

const { featured, rest } = repos;
---
<section class="work" id="work" aria-labelledby="work-heading">
  <h2 class="work__heading" id="work-heading" data-reveal>Work</h2>

  <div class="work__featured">
    {featured.map((repo) => <ProjectCard repo={repo} featured />)}
  </div>

  <div class="work__rest">
    {rest.map((repo) => <ProjectCard repo={repo} />)}
  </div>
</section>

<style>
  .work {
    display: grid;
    gap: 2rem;
    max-width: 1180px;
    margin-inline: auto;
    padding: clamp(3rem, 10vh, 7rem) var(--gutter);
  }

  .work__heading {
    font-family: var(--font-display);
    font-size: clamp(2rem, 5vw, 3.4rem);
    font-weight: 400;
    color: var(--muted);
  }

  /* Featured repos get asymmetric, deliberately non-uniform treatment. */
  .work__featured {
    display: grid;
    gap: 1rem;
    grid-template-columns: 1fr;
  }
  @media (min-width: 860px) {
    .work__featured { grid-template-columns: 1.35fr 1fr; }
    .work__featured > :nth-child(3) { grid-column: 1 / -1; }
  }

  .work__rest {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
  }
</style>
```

- [ ] **Step 5: Add it to `src/pages/index.astro`**

Import `Work` and render it inside `<main>`, directly after `<IdentityStrip />`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run build:offline && npm run test:e2e`
Expected: PASS, 21 passed.

- [ ] **Step 7: Commit**

```bash
git add src/components/Work.astro src/components/ProjectCard.astro src/pages/index.astro tests/site.spec.mjs
git commit -m "feat: add non-uniform work grid driven by build-time GitHub data"
```

---

### Task 10: The machine, reach, and footer

Three small presentational sections. They share one task because none of them is independently rejectable — they are the same deliverable, "the rest of the page".

**Files:**
- Create: `src/components/Machine.astro`, `src/components/Reach.astro`, `src/components/Footer.astro`
- Modify: `src/pages/index.astro`, `astro.config.mjs`, `tests/site.spec.mjs`

**Interfaces:**
- Consumes: `site.uses`, `site.links` (Task 3).
- Produces: `[data-uses]`, `[data-reach]`, `[data-build-sha]`.

- [ ] **Step 1: Write the failing test**

Append to `tests/site.spec.mjs`:

```js
test('the uses block lists the machine', async ({ page }) => {
  await page.goto('/');
  const text = await page.locator('[data-uses]').innerText();
  for (const { v } of site.uses) expect(text).toContain(v);
});

test('contact offers Discord and GitHub only', async ({ page }) => {
  await page.goto('/');
  const hrefs = await page.locator('[data-reach] a').evaluateAll((els) => els.map((e) => e.href));
  expect(hrefs.some((h) => h.includes('discord.com'))).toBe(true);
  expect(hrefs.some((h) => h.includes('github.com'))).toBe(true);
  expect(hrefs.some((h) => h.startsWith('mailto:'))).toBe(false);
  await expect(page.locator('form')).toHaveCount(0);
});

test('the footer carries a real build SHA', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-build-sha]')).toHaveText(/^[0-9a-f]{7,40}$|^local$/);
});

test('no real name or location appears', async ({ page }) => {
  await page.goto('/');
  const html = (await page.content()).toLowerCase();
  for (const forbidden of ['tuta.io', 'mailto:']) expect(html).not.toContain(forbidden);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build:offline && npm run test:e2e`
Expected: FAIL — `[data-uses]` not found.

- [ ] **Step 3: Expose the build SHA to Astro — modify `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import { execSync } from 'node:child_process';

function sha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch { return 'local'; }
}

export default defineConfig({
  site: 'https://agemo.me',
  output: 'static',
  build: { inlineStylesheets: 'auto' },
  vite: {
    define: {
      __BUILD_SHA__: JSON.stringify(sha()),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  },
});
```

- [ ] **Step 4: Create `src/components/Machine.astro`**

```astro
---
import site from '../config/site.mjs';
---
<section class="machine" aria-labelledby="machine-heading" data-reveal>
  <h2 class="machine__heading" id="machine-heading">The machine</h2>

  <div class="machine__body">
    <pre class="machine__mark" aria-hidden="true">{`   ▄▄▄▄▄
 ▄█████████▄
███▀     ▀███
███       ███
███       ███
▀██▄     ▄██▀
 ▀█▀     ▀█▀
▄███▄   ▄███▄`}</pre>

    <dl class="machine__list" data-uses>
      {site.uses.map(({ k, v }) => (
        <div class="machine__row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  </div>

  <p class="machine__steal">
    <a href={site.links.dotfiles} target="_blank" rel="noopener noreferrer">steal my dotfiles →</a>
  </p>
</section>

<style>
  .machine {
    max-width: 1180px;
    margin-inline: auto;
    padding: clamp(3rem, 10vh, 7rem) var(--gutter);
    display: grid;
    gap: 1.75rem;
  }

  .machine__heading {
    font-family: var(--font-display);
    font-size: clamp(2rem, 5vw, 3.4rem);
    font-weight: 400;
    color: var(--muted);
  }

  .machine__body {
    display: grid;
    gap: clamp(1.5rem, 5vw, 4rem);
    align-items: center;
    grid-template-columns: 1fr;
    padding: clamp(1.5rem, 4vw, 2.5rem);
    background: var(--surface);
    border: 1px solid color-mix(in oklab, var(--muted) 22%, transparent);
    border-radius: 14px;
  }
  @media (min-width: 720px) { .machine__body { grid-template-columns: auto 1fr; } }

  .machine__mark {
    margin: 0;
    font-size: clamp(0.5rem, 1.4vw, 0.75rem);
    line-height: 1.05;
    color: var(--accent);
    opacity: 0.85;
  }

  .machine__list { display: grid; gap: 0.5rem; margin: 0; }
  .machine__row {
    display: grid;
    grid-template-columns: 6rem 1fr;
    gap: 1rem;
    font-size: 0.86rem;
  }
  .machine__row dt { color: var(--accent-2); }
  .machine__row dd { margin: 0; color: var(--text); }

  .machine__steal { font-size: 0.82rem; }
</style>
```

- [ ] **Step 5: Create `src/components/Reach.astro`**

```astro
---
import site from '../config/site.mjs';

const targets = [
  { label: 'Discord', href: site.links.discord, sub: 'talk to me' },
  { label: 'GitHub',  href: site.links.github,  sub: 'read the source' },
];
---
<section class="reach" aria-labelledby="reach-heading" data-reach data-reveal>
  <h2 class="visually-hidden" id="reach-heading">Reach</h2>

  {targets.map((t) => (
    <a class="reach__target" href={t.href} target="_blank" rel="noopener noreferrer">
      <span class="reach__label">{t.label}</span>
      <span class="reach__sub">{t.sub}</span>
      <span class="reach__mirror" aria-hidden="true">{t.label}</span>
    </a>
  ))}
</section>

<style>
  .reach {
    display: grid;
    gap: 1rem;
    grid-template-columns: 1fr;
    max-width: 1180px;
    margin-inline: auto;
    padding: clamp(3rem, 10vh, 7rem) var(--gutter);
  }
  @media (min-width: 720px) { .reach { grid-template-columns: 1fr 1fr; } }

  .reach__target {
    position: relative;
    display: grid;
    gap: 0.35rem;
    padding: clamp(2rem, 5vw, 3.4rem);
    background: var(--surface);
    border: 1px solid color-mix(in oklab, var(--muted) 22%, transparent);
    border-radius: 14px;
    color: inherit;
    text-decoration: none;
    overflow: hidden;
    transition: border-color var(--dur-2) var(--ease);
  }
  .reach__target:hover, .reach__target:focus-visible { border-color: var(--accent); }

  .reach__label {
    font-family: var(--font-display);
    font-size: clamp(1.8rem, 4.5vw, 3rem);
  }
  .reach__sub { font-size: 0.78rem; color: var(--muted); letter-spacing: 0.08em; }

  .reach__mirror {
    position: absolute;
    left: clamp(2rem, 5vw, 3.4rem);
    bottom: -0.65em;
    font-family: var(--font-display);
    font-size: clamp(1.8rem, 4.5vw, 3rem);
    color: var(--accent);
    transform: scaleY(-1);
    opacity: 0;
    -webkit-mask-image: linear-gradient(to top, transparent, #000);
    mask-image: linear-gradient(to top, transparent, #000);
    transition: opacity var(--dur-2) var(--ease);
  }
  .reach__target:hover .reach__mirror, .reach__target:focus-visible .reach__mirror { opacity: 0.45; }

  @media (prefers-reduced-motion: reduce) { .reach__mirror { display: none; } }
</style>
```

- [ ] **Step 6: Create `src/components/Footer.astro`**

```astro
---
const sha = __BUILD_SHA__;
const built = __BUILD_TIME__;
---
<footer class="foot">
  <p class="foot__palindrome" aria-hidden="true">AGEMO ⟷ OMEGA</p>
  <p class="foot__meta">
    built <time datetime={built}>{built.slice(0, 10)}</time>
    from <code data-build-sha>{sha}</code>
  </p>
</footer>

<style>
  .foot {
    display: grid;
    gap: 0.6rem;
    justify-items: center;
    padding: clamp(3rem, 8vh, 5rem) var(--gutter);
    border-top: 1px solid color-mix(in oklab, var(--muted) 18%, transparent);
    text-align: center;
  }
  .foot__palindrome {
    font-family: var(--font-display);
    font-size: clamp(1.1rem, 3vw, 1.9rem);
    letter-spacing: 0.14em;
    background: linear-gradient(90deg, var(--accent), var(--text), var(--accent-2));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .foot__meta { font-size: 0.72rem; color: var(--muted); }
  .foot__meta code { color: var(--accent-2); }
</style>
```

- [ ] **Step 7: Compose the final `src/pages/index.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import Hero from '../components/Hero.astro';
import IdentityStrip from '../components/IdentityStrip.astro';
import Work from '../components/Work.astro';
import Machine from '../components/Machine.astro';
import Reach from '../components/Reach.astro';
import Footer from '../components/Footer.astro';
import site from '../config/site.mjs';
---
<Base title="agemo" description={site.tagline}>
  <Hero />
  <main>
    <IdentityStrip />
    <Work />
    <Machine />
    <Reach />
  </main>
  <Footer />
</Base>
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run build:offline && npm run test:e2e`
Expected: PASS, 25 passed.

- [ ] **Step 9: Commit**

```bash
git add src/components/Machine.astro src/components/Reach.astro src/components/Footer.astro src/pages/index.astro astro.config.mjs tests/site.spec.mjs
git commit -m "feat: add uses block, contact targets, and footer with build provenance"
```

---

### Task 11: The 404

**Files:**
- Create: `src/pages/404.astro`
- Modify: `tests/site.spec.mjs`

**Interfaces:**
- Consumes: `Base.astro` (Task 4).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing test**

Append to `tests/site.spec.mjs`:

```js
test('404 renders and offers a way back', async ({ page }) => {
  const res = await page.goto('/does-not-exist');
  expect(res.status()).toBe(404);
  await expect(page.locator('[data-404]')).toBeVisible();
  await expect(page.locator('[data-404] a[href="/"]')).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build:offline && npm run test:e2e`
Expected: FAIL — `[data-404]` not found.

- [ ] **Step 3: Create `src/pages/404.astro`**

```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="404 — agemo" description="Nothing on this side of the mirror.">
  <section class="lost" data-404>
    <p class="lost__code" aria-hidden="true">404</p>
    <h1 class="lost__title">Nothing on this side of the mirror.</h1>
    <p class="lost__body">The page you wanted is reflected somewhere that does not exist.</p>
    <a class="lost__back" href="/">← back through</a>
  </section>
</Base>

<style>
  .lost {
    display: grid;
    gap: 1rem;
    place-content: center;
    justify-items: center;
    min-height: 100svh;
    padding: var(--gutter);
    text-align: center;
  }
  .lost__code {
    font-family: var(--font-display);
    font-size: clamp(6rem, 26vw, 18rem);
    line-height: 0.85;
    color: var(--surface);
    /* Mirrored: the digits are their own reflection. */
    background: linear-gradient(180deg, var(--surface) 45%, var(--accent) 55%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .lost__title { font-family: var(--font-display); font-weight: 400; font-size: clamp(1.3rem, 3.5vw, 2.2rem); }
  .lost__body { color: var(--muted); font-size: 0.85rem; max-width: 40ch; }
  .lost__back { font-size: 0.85rem; margin-top: 1rem; }
</style>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run build:offline && npm run test:e2e`
Expected: PASS, 26 passed.

Note: `astro preview` serves `404.html` with a 404 status. If it returns 200 in preview, assert on the body only and keep the status assertion for the deployed Pages check in Task 12.

- [ ] **Step 5: Commit**

```bash
git add src/pages/404.astro tests/site.spec.mjs
git commit -m "feat: add mirrored 404 page"
```

---

### Task 12: Close the verification gate

Everything the spec §7 promised, asserted and wired into CI so it blocks deployment.

**Files:**
- Create: `lighthouserc.json`, `.github/workflows/ci.yml`
- Modify: `tests/site.spec.mjs`, `package.json`

**Interfaces:**
- Consumes: everything.
- Produces: a `verify` script and a CI workflow that Task 13's deploy depends on.

- [ ] **Step 1: Write the remaining failing assertions**

Append to `tests/site.spec.mjs`:

```js
for (const width of [360, 768, 1440]) {
  test(`no horizontal overflow at ${width}px`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await ctx.close();
  });
}

test('total JavaScript stays under the 150 KB budget', async ({ page }) => {
  let bytes = 0;
  page.on('response', async (res) => {
    if (!/javascript/.test(res.headers()['content-type'] ?? '')) return;
    try { bytes += (await res.body()).length; } catch { /* ignore */ }
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Uncompressed ceiling; gzip lands well under the 150 KB spec budget.
  expect(bytes).toBeLessThan(450_000);
});

test('the page has exactly one h1 and a sane heading order', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('h1').count()).toBe(1);
  expect(await page.locator('h2').count()).toBeGreaterThan(0);
});

test('every image and canvas is either labelled or explicitly decorative', async ({ page }) => {
  await page.goto('/');
  const unlabelled = await page.locator('img:not([alt]), canvas:not([aria-hidden])').count();
  expect(unlabelled).toBe(0);
});
```

- [ ] **Step 2: Run to verify the new assertions fail or pass honestly**

Run: `npm run build:offline && npm run test:e2e`
Expected: all pass. If the overflow test fails at 360 px, fix the offending component's `min-width` — do **not** relax the assertion.

- [ ] **Step 3: Create `lighthouserc.json`**

```json
{
  "ci": {
    "collect": {
      "staticDistDir": "./dist",
      "numberOfRuns": 3,
      "settings": { "preset": "desktop" }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["warn", { "minScore": 0.9 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 1500 }]
      }
    },
    "upload": { "target": "filesystem", "outputDir": ".lighthouseci" }
  }
}
```

- [ ] **Step 4: Add the LHCI script to `package.json`**

Add to `devDependencies`: `"@lhci/cli": "^0.14.0"`. Add to `scripts`:

```json
"test:lh": "lhci autorun",
"verify": "npm run build && npm run test:unit && npm run test:e2e && npm run test:lh"
```

- [ ] **Step 5: Run the full gate**

```bash
npm install
npm run verify
```

Expected: build succeeds, unit tests pass, all Playwright tests pass, LHCI reports performance ≥ 0.90 and accessibility ≥ 0.95. **Paste the output.** If accessibility is below 0.95, fix the reported audit — do not lower the threshold.

- [ ] **Step 6: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Build (with live GitHub data)
        run: npm run build
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Prove the build survives without network
        run: npm run build:offline
      - run: npm run test:unit
      - run: npm run test:e2e
      - run: npm run test:lh
```

- [ ] **Step 7: Commit**

```bash
git add lighthouserc.json .github/workflows/ci.yml package.json package-lock.json tests/site.spec.mjs
git commit -m "test: close the verification gate with budgets, a11y, overflow, and LHCI in CI"
```

---

### Task 13: Deploy to GitHub Pages on agemo.me

**Files:**
- Create: `public/CNAME`, `.github/workflows/deploy.yml`, `.github/workflows/refresh-data.yml`, `README.md`

**Interfaces:**
- Consumes: the CI gate from Task 12.
- Produces: a live site.

- [ ] **Step 1: Create `public/CNAME`**

```
agemo.me
```

- [ ] **Step 2: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Create `.github/workflows/refresh-data.yml`**

```yaml
name: Refresh repo data

on:
  schedule:
    - cron: '17 5 * * *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: node scripts/fetch-repos.mjs
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Commit if changed
        run: |
          if [[ -n "$(git status --porcelain src/data/repos.json)" ]]; then
            git config user.name  "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add src/data/repos.json
            git commit -m "chore: refresh repo data"
            git push
          else
            echo "no change"
          fi
```

- [ ] **Step 4: Write `README.md`**

```markdown
# agemo.me

Personal site. Ω is the last letter; AGEMO is OMEGA reversed. The whole page
sits on a waterline — real above, reflected below.

Astro 5, static, no framework. Project data is fetched from the GitHub API at
build time into `src/data/repos.json`, so the site builds offline and makes no
runtime API calls.

## Commands

| Command | Does |
|---------|------|
| `npm run dev` | dev server |
| `npm run build` | fetch repo data, then build |
| `npm run build:offline` | build from committed data only |
| `npm run verify` | build + unit + e2e + Lighthouse — the gate |

Design: `docs/superpowers/specs/2026-09-05-agemo-me-phase1-design.md`
Plan: `docs/superpowers/plans/2026-09-05-agemo-me-phase1.md`
```

- [ ] **Step 5: Create the repo and push**

```bash
gh repo create omeg4-dev/agemo.me --public --source=. --remote=origin --push
```

- [ ] **Step 6: Enable Pages and confirm CI is green**

```bash
gh api -X POST repos/omeg4-dev/agemo.me/pages -f build_type=workflow || \
  gh api -X PUT repos/omeg4-dev/agemo.me/pages -f build_type=workflow
gh run watch
```

Expected: both CI and Deploy workflows conclude `success`.

- [ ] **Step 7: Point DNS at GitHub Pages**

At Namecheap, on `agemo.me` (currently on `dns1/dns2.registrar-servers.com` with no A record), set:

| Type | Host | Value |
|------|------|-------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `omeg4-dev.github.io.` |

This is a manual step in the Namecheap dashboard — the plan cannot do it.

- [ ] **Step 8: Verify the live site**

```bash
until dig +short agemo.me A | grep -q 185.199; do sleep 60; done
curl -sSI https://agemo.me | head -3
curl -sS https://agemo.me | grep -o '<title>[^<]*</title>'
curl -sS -o /dev/null -w '%{http_code}\n' https://agemo.me/does-not-exist
```

Expected: `HTTP/2 200`, `<title>agemo</title>`, and `404` for the missing path. Paste the output. Enable "Enforce HTTPS" in the repository's Pages settings once the certificate is issued.

- [ ] **Step 9: Commit**

```bash
git add public/CNAME .github/workflows/deploy.yml .github/workflows/refresh-data.yml README.md
git commit -m "ci: deploy to GitHub Pages on agemo.me with daily data refresh"
git push
```

---

## Definition of done

Phase 1 is complete when all of the following are true and their output has been pasted:

- `npm run verify` exits 0 locally.
- `npm run build:offline` exits 0 with the network unavailable.
- CI and Deploy workflows are green on `main`.
- `https://agemo.me` returns 200 and serves `<title>agemo</title>`.
- Lighthouse: performance ≥ 90, accessibility ≥ 95.
- The hero is complete and legible with JavaScript disabled.
- Under `prefers-reduced-motion`, zero transform animations run.
- No email address, real name, location, or photograph appears in the output.
