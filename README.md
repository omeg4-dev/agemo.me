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
