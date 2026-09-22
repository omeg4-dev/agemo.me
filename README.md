# agemo.me

Personal site. Ω is the last letter; AGEMO is OMEGA reversed. The home page
opens on the word split by a mirror's edge — dark backing on one side, the
silvered side on the other — and scrolling walks each letter through its
partner and turns it over, so OMEGA ends as its own reflection.

Astro 5, static, no framework. Project data is fetched from the GitHub API at
build time into `src/data/repos.json`, so the site builds offline and makes no
runtime API calls.

## /text

A tool page: paste text, get it back as handwriting, with LaTeX between `$`
signs. `src/scripts/handwriting.js` holds the model (a seeded random hand:
per-glyph rotation, lift, size, pressure, plus per-word drift and slant),
`sheet-canvas.js` repaints the sheet onto a canvas for copy and download —
it reads back where every glyph landed rather than rasterising HTML, which
Safari on an iPad does not do reliably. KaTeX is vendored: run
`node scripts/vendor-katex.mjs` after bumping it to refresh `public/katex.css`
and `public/fonts/katex/`. Both the typesetter and its stylesheet load only
when a sheet actually contains maths.

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

`PREVIEW_PORT=4500 npx playwright test` moves the e2e preview server off 4321.
The config never reuses an existing server: a stale one serving an older
`dist/` once made a whole mutation-testing round report false greens.

