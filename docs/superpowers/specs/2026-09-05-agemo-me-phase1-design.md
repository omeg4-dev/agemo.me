# agemo.me — Phase 1: "The Mirror"

**Date:** 2026-09-05
**Status:** Approved, pending implementation plan
**Owner:** Omega (`DeadlyOmega` / `omeg4-dev`)

## 1. Purpose

`agemo.me` is a personal site serving four eventual roles: developer portfolio,
personal playground, live hub, and blog. Those roles are decomposed into four
phases so that a complete, shippable site exists early rather than a
half-finished everything.

**Phase 1, specified here, is the shell:** hero, identity, work, machine, reach.
It ships alone as a finished site. Later phases layer on top without
restructuring it.

| Phase | Scope | Spec |
|-------|-------|------|
| 1 | Shell: mirror hero, identity strip, project grid, uses, contact | this document |
| 2 | Blog: Markdown pipeline, post pages, RSS, `/writing` | future |
| 3 | Hub: Spotify now-playing, WakaTime, rice gallery, dotfiles | future |
| 4 | Playground: interactive terminal, snake-404, guestbook, easter eggs | future |

Phases 2–4 are named here only to constrain Phase 1's architecture. Nothing in
this document implements them.

## 2. Concept

Ω is the last letter of the Greek alphabet — the end. **AGEMO is OMEGA
reversed**: the end, read backwards, becomes a beginning.

The site is built on a **waterline**. Above it is the real page. Below it is a
reflection that is not a copy — it is inverted, distorted, and resolves into
different text. This is the organising metaphor for layout, motion, and the
hero, and it is unavailable to anyone else because it derives from the handle
itself.

The concept must be legible without explanation. A visitor who never reads a
word should still perceive "above / below, real / reflected".

## 3. Identity constraints

- **Pseudonymous.** "Omega" only. No real name, no location, no photograph.
- Public identity threads, in priority order: **Linux ricing / Wayland**,
  **Minecraft / modding**, **privacy / opsec**.
- Contact channels: **Discord** and **GitHub** only. No email address appears on
  the site in any form, obfuscated or otherwise. No contact form.

## 4. Architecture

### 4.1 Stack

- **Astro 5**, `output: 'static'`. No client-side framework. Astro emits HTML;
  JavaScript is added only where motion requires it.
- **Plain CSS with custom properties.** No Tailwind. The design is dominated by
  bespoke masks, layering, and motion, which utility classes obstruct rather
  than accelerate; hand-written CSS also keeps the payload minimal.
- **Three vanilla JS modules**, no others:
  - `mirror.js` — WebGL waterline reflection
  - `scroll.js` — scroll orchestration
  - `presence.js` — Lanyard presence fetch
- **Node 22 LTS**, npm.

### 4.2 Hosting and deployment

- Repository `omeg4-dev/agemo.me`, public.
- **GitHub Pages**, custom domain `agemo.me` via `public/CNAME`.
- DNS at Namecheap (domain registered, currently no A record): four A records to
  GitHub Pages apex IPs plus a `www` CNAME to `omeg4-dev.github.io`.
- Deploy via GitHub Actions on push to `main`.

### 4.3 Data

Project data is fetched from the **GitHub REST API at build time** and written
to `src/data/repos.json`. There are **no runtime GitHub API calls**, which
avoids client-side rate limiting and keeps the page static.

- Source: authenticated `GITHUB_TOKEN` within Actions; unauthenticated locally.
- `src/data/repos.json` is **committed to the repository** and rewritten in
  place by the fetch step. It is therefore always present as a fallback, and its
  diffs are reviewable.
- A **daily scheduled Actions rebuild** re-runs the fetch and commits the result
  if it changed, keeping relative timestamps ("last commit 4 days ago") honest.
- The build **must not fail** when the API is unreachable: the fetch step logs a
  warning and leaves the committed `repos.json` untouched. A site that cannot
  build offline is a defect.

Presence data comes from the **Lanyard API** at runtime, client-side, using
Discord ID `626069774002159619`. Lanyard failure degrades silently to an
"offline" chip. Presence is never required for page correctness.

## 5. Page structure

Phase 1 is a single route `/` plus a `404` page. No router, no nested layouts.

### 5.1 Waterline hero

Full viewport. A single **Ω** in a high-contrast display serif at large scale,
positioned above the vertical midpoint. Below the midpoint, a WebGL plane
renders a warped reflection of it that resolves into the wordmark **AGEMO**.

- Cursor movement ripples the reflective surface.
- On scroll, the hero rotates 180° about the waterline; the reflection becomes
  the real subject. The visitor scrolls *through* the mirror.
- **The CSS-only fallback is built first**: a mirrored copy with a gradient mask
  and blur. The hero must be complete and good with JavaScript disabled, WebGL
  unavailable, or the shader cut entirely.

### 5.2 Identity strip

One mono sentence, typed once on entry, never looping. Below it, three live
chips: Lanyard presence state, current activity, and a clock in the site
owner's timezone. Chips render in a resolved static state before Lanyard
responds; they never appear empty or shift layout on arrival.

### 5.3 Work

Project grid built from `repos.json`. Deliberately **non-uniform**:

- **Featured** (`mc-jukebox`, `magpie`, `hypr-keybind-overlay`, `gamehub`) get
  large treatment with their repository descriptions set as pull-quotes. Those
  descriptions are well-written and earn the space.
- **Remaining** public repositories compact into a dense list.
- Forks and archived repositories are excluded. Repositories may also be
  suppressed by an explicit deny-list in the same configuration that holds the
  featured set, so noise (`sus`, the GitHub Pages placeholder repo) can be
  dropped without code changes.
- Every card carries: language bar, star count, last-commit age.
- On hover, a reflection of the card appears beneath it, inverted, showing the
  first line of the README.

The featured set is configuration, not hardcoded markup — a list in one place.

### 5.4 The machine

A `uses` block styled as fetch output: CachyOS, Hyprland, Noctalia v5, Python,
the Oxocarbon palette. This is the owner's strongest public identity and
receives a full section. Ends with a link to the dotfiles repository.

### 5.5 Reach

Discord and GitHub. Two large mirrored targets. Nothing else.

### 5.6 Footer

`AGEMO ⟷ OMEGA`, the build timestamp, and the commit SHA the site was built
from.

## 6. Visual system

### 6.1 Typography

- **Instrument Serif** — Ω and headings. Its stroke contrast is what makes a
  reflection legible as a reflection.
- **IBM Plex Mono** — all other text. Oxocarbon derives from IBM Carbon; Plex is
  the honest pairing.
- Fonts are self-hosted and subset. No third-party font CDN at runtime.

### 6.2 Palette

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#0B0D0F` | page ground |
| `--surface` | `#14181C` | cards, raised blocks |
| `--text` | `#E6EAEE` | body |
| `--muted` | `#8B97A5` | secondary text, metadata |
| `--accent` | `#33B1FF` | primary accent |
| `--accent-2` | `#78A9FF` | gradient partner, hover |
| `--live` | `#FF7EB6` | live indicators **only** |

`--live` appears nowhere except presence indicators. Per-repository accents are
derived from a hash of the repository name and desaturated toward `--accent`, so
the grid never becomes a rainbow.

Contrast: all text pairs meet **WCAG AA** (4.5:1 body, 3:1 large). This is
verified by a unit test over `tokens.css`, not assumed.

`--muted` was originally drafted as `#6B7785`, which measures 4.27:1 on `--bg`
and 3.91:1 on `--surface` — it fails the AA requirement this same section
mandates. It is lightened to `#8B97A5` (6.55:1 and 6.00:1) at the same hue.

### 6.3 Motion

- One shared easing curve and one duration scale across the entire site.
- Scroll-driven animation via native CSS `scroll-timeline`, with an
  `IntersectionObserver` fallback.
- **`prefers-reduced-motion: reduce` disables the shader and every transform.**
  Non-negotiable.

### 6.4 Performance budget

- **< 150 KB JavaScript, gzipped**, total.
- **LCP < 1.5 s** on a simulated fast-3G profile.
- The shader lazy-initialises after first paint, and only at viewport widths
  above 768 px.

## 7. Verification

The check is built before the feature it checks. Nothing is reported as
complete without pasted output.

1. **`npm run build` exits 0**, including with network access disabled.
2. **Playwright check** against the built output, asserting:
   - hero canvas **or** CSS fallback is present
   - **≥ 6** project cards render with non-empty names, and every featured
     repository named in the configuration appears (the current public,
     non-fork, non-suppressed set is 6–8 depending on the deny-list, so a
     higher floor would break on a legitimate deny-list edit)
   - Lanyard chip resolves to a known state or degrades to "offline"
   - **zero** console errors
   - under `prefers-reduced-motion`, zero transform animations run
   - no horizontal overflow at 360 px, 768 px, and 1440 px widths
3. **Lighthouse CI**, thresholds: performance ≥ 90, accessibility ≥ 95.
4. Contrast assertion over the palette tokens (AA).

Items 1–3 run in CI on every push and block deployment on failure.

## 8. Risks

| Risk | Mitigation |
|------|-----------|
| WebGL reflection is the only genuinely hard component | Isolated in `mirror.js` behind a CSS fallback built first. Worst case is a site that is still good, just less alive. |
| GitHub API unavailable at build time | Build falls back to committed `repos.json`; failure to build offline is treated as a defect. |
| Lanyard unavailable or ID not visible to it | Chip degrades to "offline". Requires the owner to join the Lanyard Discord; the site is correct either way. |
| Scroll-driven rotation causes motion discomfort | `prefers-reduced-motion` disables it entirely; asserted in the Playwright check. |
| Concept reads as gimmick rather than identity | The metaphor is carried by layout and type, not only the shader, so it survives with the fallback. |

## 9. Out of scope for Phase 1

Blog and Markdown pipeline. Interactive terminal. Playable 404. Guestbook.
Spotify now-playing. WakaTime. Rice gallery. Light theme. Analytics. Email
contact. Any server-side component.
