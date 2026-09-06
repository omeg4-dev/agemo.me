# agemo.me

Personal site. Ω is the last letter; AGEMO is OMEGA reversed. The whole page
sits on a waterline — real above, reflected below.

Astro 5, static, no framework. Project data is fetched from the GitHub API at
build time into `src/data/repos.json`, so the site builds offline and makes no
runtime API calls.

## Adding a link to /links

Edit `src/data/links.json` and append an object to `links`:

```json
{ "title": "FMHY", "url": "https://fmhy.net", "tag": "resources", "note": "One line." }
```

`title` and `url` are required. `tag` groups the rows (default `misc`); groups
appear in the order their first member appears in the file, and rows appear in
file order within a group. `note` is optional. Commit and push — the deploy
workflow rebuilds the page. Nothing else needs touching.

## Which repos appear

`/` shows the repos pinned on the GitHub profile, in pin order, and nothing
else. The build reads the live pin list from the GraphQL API; `site.pinned` in
`src/config/site.mjs` is the order used as a fallback when no token is
available (GraphQL refuses unauthenticated requests), so keep it in step with
what is actually pinned. `site.deny` still excludes a repo even if it is
pinned.

## Commands

| Command | Does |
|---------|------|
| `npm run dev` | dev server |
| `npm run build` | fetch repo data, then build |
| `npm run build:offline` | build from committed data only |
| `npm run verify` | build + unit + e2e + Lighthouse — the gate |

Design: `docs/superpowers/specs/2026-09-05-agemo-me-phase1-design.md`
Plan: `docs/superpowers/plans/2026-09-05-agemo-me-phase1.md`
