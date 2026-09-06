import { test, expect } from '@playwright/test';
import site from '../src/config/site.mjs';
import links from '../src/data/links.json' with { type: 'json' };

test('page loads with the correct title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/agemo/i);
});

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

test('the wordmark renders as inline SVG, not a font-dependent glyph', async ({ page }) => {
  await page.goto('/');
  const d = await page.locator('[data-wordmark] svg path').first().getAttribute('d');
  expect(d).toBeTruthy();
  expect(d.length).toBeGreaterThan(0);
});

test('the display face is actually applied to a real text element', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  // The hero mark is an SVG (Task 4 addendum), so it carries no font-family.
  // [data-reflection] is the CSS fallback reflection text and is styled
  // with var(--font-display) — a real text node that actually uses the face.
  const family = await page.locator('[data-reflection]').evaluate(
    (el) => getComputedStyle(el).fontFamily,
  );
  expect(family).toContain('Instrument Serif');
  // getComputedStyle only reports the declared CSS value, not whether the
  // @font-face actually loaded — check document.fonts directly so a broken
  // font URL (404, corrupt file) fails this gate instead of passing silently.
  const loaded = await page.evaluate(() => {
    for (const f of document.fonts) {
      if (f.family.replace(/["']/g, '') === 'Instrument Serif') return f.status === 'loaded';
    }
    return false;
  });
  expect(loaded).toBe(true);
});

test('page logs no console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});

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

test('the shader genuinely renders varying pixels, not a flat clear', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-mirror-canvas][data-active]')).toBeAttached({ timeout: 5000 });
  // Give the ripple a moment to animate past the first frame.
  await page.waitForTimeout(300);
  const { distinctColours, anyOpaque } = await page.evaluate(() => {
    const canvas = document.querySelector('[data-mirror-canvas]');
    const gl = canvas.getContext('webgl');
    const w = canvas.width;
    const h = canvas.height;
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const seen = new Set();
    let anyOpaque = false;
    // Sample a grid rather than every pixel for speed.
    for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 64))) {
      for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 64))) {
        const i = (y * w + x) * 4;
        seen.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`);
        if (pixels[i + 3] > 10) anyOpaque = true;
      }
    }
    return { distinctColours: seen.size, anyOpaque };
  });
  // A shader that failed to draw (or only ran gl.clear) would read back as a
  // single uniform colour across the whole sampled grid, and the wordmark
  // texture would never contribute any non-transparent alpha.
  expect(distinctColours).toBeGreaterThan(1);
  expect(anyOpaque).toBe(true);
});

test('losing the WebGL context recovers to the CSS reflection cleanly', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-mirror-canvas][data-active]')).toBeAttached({ timeout: 5000 });

  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));

  const mechanism = await page.evaluate(() => {
    const canvas = document.querySelector('[data-mirror-canvas]');
    const gl = canvas.getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_lose_context');
    if (ext) {
      ext.loseContext();
      return 'WEBGL_lose_context';
    }
    // Fall back to a hand-dispatched event if the extension isn't
    // available under this browser/driver combination.
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    return 'dispatched-event';
  });

  await expect(page.locator('[data-mirror-canvas][data-active]')).toHaveCount(0, { timeout: 2000 });

  const reflVis = await page.evaluate(
    () => getComputedStyle(document.querySelector('[data-hero]')).getPropertyValue('--refl-vis').trim(),
  );
  expect(reflVis).toBe('1');

  const reflection = page.locator('[data-reflection]');
  await expect(reflection).toBeVisible();
  const opacity = await reflection.evaluate((el) => Number(getComputedStyle(el).opacity));
  expect(opacity).toBeGreaterThan(0);

  expect(errors).toEqual([]);
  test.info().annotations.push({ type: 'context-loss-mechanism', description: mechanism });
});

test('WebGL context creation failure falls back to the CSS reflection cleanly', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === 'webgl' || type === 'experimental-webgl') return null;
      return orig.call(this, type, ...args);
    };
  });
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await page.waitForTimeout(1500);
  await expect(page.locator('[data-mirror-canvas][data-active]')).toHaveCount(0);
  await expect(page.locator('[data-reflection]')).toBeVisible();
  const reflVis = await page.evaluate(
    () => getComputedStyle(document.querySelector('[data-hero]')).getPropertyValue('--refl-vis').trim(),
  );
  expect(reflVis).toBe('1');
  expect(errors).toEqual([]);
  await ctx.close();
});

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

// Task 7 review finding (Vacuous Assertion #5): the transform-only version
// of this test is redundant with base.css's global reduced-motion kill
// switch (`transform: none !important` on `*`), which passes on its own
// and never touches Hero.astro's own opacity resets at all. The reviewer
// proved the blindness empirically: removing BOTH the `opacity: 1` reset
// on .hero__mark/.hero__waterline/.hero__hint AND the
// `opacity: calc(0.42 * var(--refl-vis))` reset on .hero__reflection left
// the full suite green, while a real reduced-motion browser context showed
// .hero__mark genuinely fading 1 -> 0 across a scroll. Add opacity
// assertions, pre- and post-scroll, so those resets are load-bearing.
test('reduced motion runs no transform animations', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  const opacityOf = (sel) => page.locator(sel).evaluate((el) => getComputedStyle(el).opacity);

  // Pre-scroll (--dive: 0): both formulas coincidentally agree here, so
  // this half alone would not discriminate against the missing resets —
  // it's the post-scroll read below that does. Kept for a clear before/after.
  expect(await opacityOf('.hero__mark')).toBe('1');
  expect(await opacityOf('.hero__reflection')).toBe('0.42');

  await page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await page.waitForTimeout(500);

  const moved = await page.evaluate(() =>
    [...document.querySelectorAll('*')].filter((el) => {
      const t = getComputedStyle(el).transform;
      return t && t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)';
    }).length,
  );
  expect(moved).toBe(0);

  // Post-scroll (--dive ~ 1): without the reduced-motion opacity resets,
  // .hero__mark's normal formula (1 - dive * 1.1) clamps to 0, and
  // .hero__reflection's normal formula ((0.42 + dive * 0.58) * refl-vis)
  // rises to ~1 — both would diverge from the reduced-motion-frozen
  // values asserted here.
  expect(await opacityOf('.hero__mark')).toBe('1');
  expect(await opacityOf('.hero__reflection')).toBe('0.42');

  await ctx.close();
});

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

// Task 8 ledger — Defect 1: the brief's original CSS made .identity__line
// width:0 unconditionally, reachable only via a [data-revealed] animation
// gated on scroll.js's IntersectionObserver. With JavaScript disabled, on
// a viewport wider than 640px and without prefers-reduced-motion, the
// tagline rendered at zero width forever. This test runs with JS off,
// desktop viewport, no reduced-motion, and asserts the tagline is actually
// visible with real width and readable text.
test('tagline is visible without JavaScript on a desktop viewport', async ({ browser }) => {
  const ctx = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  await page.goto('/');
  const line = page.locator('.identity__line');
  await expect(line).toBeVisible();
  const box = await line.boundingBox();
  // A vacuous ">0" check is satisfied by a stray 2px caret border alone
  // (box-sizing:border-box lets a border render even at width:0 content).
  // Require enough width to actually carry the sentence, not just a sliver.
  expect(box.width).toBeGreaterThan(300);
  await expect(line).toHaveText(/I build things for Linux desktops/);
  const clipsContent = await line.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(clipsContent).toBe(false);
  await ctx.close();
});

// Post-commit finding (Task 8 ledger): flipping [data-reveal]/.identity__line
// to visible-by-default fixed the no-JS case, but the inline head bootstrap
// that set `html.js` ran unconditionally whenever JS was merely enabled —
// even if scroll.js itself (the only script that ever sets data-revealed)
// failed to load. That reproduced the exact same content-invisibility trap
// on a narrower trigger: JS on, scroll.js blocked/404/thrown. Observed on
// the pre-fix code: {"opacity":"1","width":2,"revealed":false,"jsClass":true}
// — a real failure hidden behind a `width > 0`-style vacuous check (the
// typewriter's 2px caret border alone satisfies that). Fixed by having
// scroll.js's initScroll() add the `js` class itself as its first act, so
// the hidden starting state is only ever reachable via the same script
// responsible for reversing it.
// Where scroll.js ends up in the build is not stable. Vite inlines a small
// module straight into an inline `<script type="module">`, but emits a
// separate `src=` chunk once it grows past its threshold — and it has now
// crossed that line in both directions as the page gained sections. A helper
// that handles only one of the two shapes silently stops intercepting
// anything the moment the other one applies, which is a route that never
// fires: a vacuous test that still reports green.
//
// So handle both, and return a state object the caller must assert on, so a
// helper that matched nothing can never pass unnoticed. scroll.js is
// identified by the `--dive` custom property, which nothing else sets.
function breakScrollScript(page) {
  const state = { broken: false };

  page.route('**/*.js', async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    if (!body.includes('--dive')) return route.fulfill({ response: res, body });
    state.broken = true;
    await route.fulfill({
      response: res,
      body: 'throw new Error("simulated scroll.js failure");',
    });
  });

  page.route('**/', async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    const broken = body.replace(
      /<script type="module">((?:(?!<\/script>)[\s\S])*--dive(?:(?!<\/script>)[\s\S])*)<\/script>/,
      '<script type="module">throw new Error("simulated scroll.js failure");</script>',
    );
    if (broken !== body) state.broken = true;
    await route.fulfill({ response: res, body: broken });
  });

  return state;
}

test('identity stays visible when scroll.js fails to load', async ({ page }) => {
  const state = breakScrollScript(page);
  await page.goto('/');
  expect(state.broken, 'scroll.js was never actually intercepted').toBe(true);
  const line = page.locator('.identity__line');
  await expect(line).toBeVisible();
  const info = await line.evaluate((el) => ({
    width: el.getBoundingClientRect().width,
    clipsContent: el.scrollWidth > el.clientWidth + 1,
    jsClass: document.documentElement.classList.contains('js'),
  }));
  expect(info.jsClass).toBe(false);
  // Same vacuous-check trap as Task 8's Defect 1: a bare `width > 0` is
  // satisfied by the 2px caret border alone. Require real width.
  expect(info.width).toBeGreaterThan(300);
  expect(info.clipsContent).toBe(false);
  await expect(line).toHaveText(/I build things for Linux desktops/);
});

// Sibling case flagged in the same finding: [data-reveal] sections (not
// just the tagline) stay opacity:0 forever under `html.js [data-reveal]`
// with no data-revealed ever set — worse than the tagline case because
// there is no partial rendering at all, the whole section just never
// appears.
test('[data-reveal] sections stay visible when scroll.js fails to load', async ({ page }) => {
  const state = breakScrollScript(page);
  await page.goto('/');
  expect(state.broken, 'scroll.js was never actually intercepted').toBe(true);
  const identity = page.locator('.identity');
  await expect(identity).toBeVisible();
  const opacity = await identity.evaluate((el) => getComputedStyle(el).opacity);
  expect(opacity).toBe('1');
});

// Task 8 ledger — data-reveal/data-revealed had no prior consumer or
// coverage; IdentityStrip is its first real user. Verify the observer
// path actually flips the attribute on scroll, so "never reveals" (the
// worst class of bug here) can't slip through silently.
test('identity section receives data-revealed once scrolled into view', async ({ page }) => {
  await page.goto('/');
  const identity = page.locator('.identity');
  await expect(identity).not.toHaveAttribute('data-revealed', '');
  await identity.scrollIntoViewIfNeeded();
  await expect(identity).toHaveAttribute('data-revealed', '', { timeout: 3000 });
});

// Task 7 reviewer's finding (surfaced during Task 8): a negative bottom
// rootMargin on the IntersectionObserver shrinks the effective root to the
// top 88% of the viewport. A [data-reveal] element that is the literal
// last thing on the page, short enough that maxScroll can never push its
// top above that shrunk threshold, can NEVER satisfy the observer — a
// silent, permanent content-invisibility trap for whatever section ends
// up last. Reproduce that exact worst case (a short fixture, genuinely
// last, scrolled to the true end of the document) rather than trusting
// that IdentityStrip's current height happens to clear the old threshold.
test('a short data-reveal section at the true end of the document still reveals', async ({ page }) => {
  // The fixture must be present in the INITIAL markup, not appended after
  // navigation: scroll.js's querySelectorAll('[data-reveal]') runs once,
  // early, and a dynamically-appended-after-load element would never be
  // observed regardless of the rootMargin fix under test — that would be
  // a test bug pretending to be a red result. Inject via response rewrite
  // so it's part of the document the browser actually parses.
  await page.route('**/', async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    const fixture = '<section data-reveal id="reveal-tail-fixture" style="height:80px">tail fixture</section>';
    await route.fulfill({ response: res, body: body.replace('</body>', `${fixture}</body>`) });
  });
  await page.goto('/');
  const fixture = page.locator('#reveal-tail-fixture');
  await expect(fixture).not.toHaveAttribute('data-revealed', '');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(fixture).toHaveAttribute('data-revealed', '', { timeout: 3000 });
});

// Reduced motion and "no IntersectionObserver" both short-circuit straight
// to data-revealed in scroll.js — verify both degrade to revealed rather
// than silently never revealing.
test('identity section reveals immediately under reduced motion', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('.identity')).toHaveAttribute('data-revealed', '', { timeout: 3000 });
  await ctx.close();
});

test('identity section reveals immediately when IntersectionObserver is unavailable', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => { delete window.IntersectionObserver; });
  await page.goto('/');
  await expect(page.locator('.identity')).toHaveAttribute('data-revealed', '', { timeout: 3000 });
  await ctx.close();
});

test('the work grid renders enough cards with real data', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('[data-project]');
  // Exactly the pins, no floor: "at least N" was the right shape when the grid
  // showed the whole account, but it cannot catch an over-wide selection now
  // that the set is meant to be closed.
  expect(await cards.count()).toBe(site.pinned.length);

  for (const name of await page.locator('[data-project-name]').allTextContents()) {
    expect(name.trim()).not.toBe('');
  }
  for (const age of await page.locator('[data-project-age]').allTextContents()) {
    expect(age.trim()).toMatch(/today|yesterday|ago|last (month|year)/);
  }
});

test('the work section shows the pinned repos and nothing else', async ({ page }) => {
  await page.goto('/');
  const names = (await page.locator('[data-project-name]').allTextContents()).map((n) => n.trim());
  for (const f of site.pinned) expect(names).toContain(f);
  // The point of the change is exclusion, not inclusion: an "every pinned repo
  // appears" assertion alone still passes with the whole account rendered.
  expect(names.sort()).toEqual([...site.pinned].sort());
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

// Whole-page sweep for every codepoint the font subset deliberately excludes
// (task-4-addendum.md / ledger T4). These must never appear as literal
// rendered text anywhere on the page — Ω and ⟷ ship as inline SVG (Hero,
// Footer) and ★ ships as inline SVG (ProjectCard). Do NOT assert these
// codepoints ARE in the font subset — they are intentionally absent.
test('no tofu-prone literal glyphs (Ω ★ ⟷) appear anywhere in rendered text', async ({ page }) => {
  await page.goto('/');
  const bodyText = await page.locator('body').innerText();
  for (const glyph of ['★', '⟷', 'Ω']) {
    expect(bodyText).not.toContain(glyph);
  }
});

// ── Ambient background layer ──────────────────────────────────────────
// The background is three stacked layers (Ambient.astro): an animated CSS
// aurora that must look finished on its own, a screen-blended WebGL
// caustics canvas over it, and a static vignette. The aurora is the
// no-JS/no-WebGL baseline, so most of these tests are about it surviving
// the shader's absence rather than about the shader itself.

test('the ambient shader claims its canvas and renders a varying field', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ambient-canvas][data-active]')).toBeAttached({ timeout: 8000 });
  // The field animates at 30fps; wait past the first frame so a shader that
  // drew exactly once cannot be mistaken for one that is running.
  await page.waitForTimeout(400);

  // The readback MUST happen inside a rAF callback. ambient.js creates its
  // context without preserveDrawingBuffer, so once the compositor has taken
  // the frame the drawing buffer is cleared to black — a plain
  // page.evaluate() readback reliably returns a single flat colour and this
  // test would fail against a shader that is drawing perfectly. Verified:
  // same page, same frame, plain readback gave distinct=1/maxSum=0 while
  // the rAF readback gave distinct=703/maxSum=139.
  const { distinctColours, nonBlack } = await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const canvas = document.querySelector('[data-ambient-canvas]');
      const gl = canvas.getContext('webgl');
      const w = canvas.width, h = canvas.height;
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const seen = new Set();
      let nonBlack = 0;
      for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 48))) {
        for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 48))) {
          const i = (y * w + x) * 4;
          seen.add(`${px[i]},${px[i + 1]},${px[i + 2]}`);
          if (px[i] + px[i + 1] + px[i + 2] > 6) nonBlack++;
        }
      }
      resolve({ distinctColours: seen.size, nonBlack });
    }));
  }));

  // A shader that linked but drew nothing reads back as one flat colour.
  // The caustics/motes/vignette must produce real variation AND actual
  // light — an all-black field would screen-blend to a no-op, i.e. the
  // canvas would be live but invisible, which is the failure this catches.
  expect(distinctColours).toBeGreaterThan(8);
  expect(nonBlack).toBeGreaterThan(20);
});

test('the ambient layer never intercepts pointer events', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ambient-canvas][data-active]')).toBeAttached({ timeout: 8000 });

  // .ambient is position:fixed across the entire viewport, so if it were
  // hit-testable it would swallow every click on the page. TWO independent
  // defences stop that — pointer-events:none, and content being lifted to
  // z-index 1 above it — and each needs its own assertion.
  //
  // Discrimination note: the elementFromPoint checks below do NOT fail when
  // pointer-events is flipped to auto, because the z-index defence alone
  // still keeps content on top. Verified by mutation. So the computed-style
  // assertion here is the one that actually guards pointer-events, and the
  // hit-testing assertions guard the stacking. Neither substitutes for the
  // other.
  const pointerEvents = await page.evaluate(() => {
    const root = document.querySelector('.ambient');
    return [root, ...root.querySelectorAll('*')].map((el) => getComputedStyle(el).pointerEvents);
  });
  expect(pointerEvents.length).toBeGreaterThan(1);
  for (const value of pointerEvents) expect(value).toBe('none');

  const topAtCentre = await page.evaluate(() => {
    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return el ? el.className.toString() : 'none';
  });
  expect(topAtCentre).not.toContain('ambient');

  const link = page.locator('[data-project] a').first();
  await link.scrollIntoViewIfNeeded();
  const box = await link.boundingBox();
  const topAtLink = await page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return el ? el.className.toString() : 'none';
    },
    [box.x + box.width / 2, box.y + 10],
  );
  expect(topAtLink).not.toContain('ambient');
});

test('scrolling drives the document depth property from 0 to 1', async ({ page }) => {
  await page.goto('/');
  const read = () => page.evaluate(
    () => Number(getComputedStyle(document.documentElement).getPropertyValue('--depth')),
  );
  expect(await read()).toBeCloseTo(0, 2);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  // At the very bottom of the document depth must reach exactly 1 — a
  // clamp that stops short means the background never reaches its
  // deepest state on any real screen.
  expect(await read()).toBeCloseTo(1, 2);
});

test('the aurora is a finished background on its own when WebGL is unavailable', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === 'webgl' || type === 'experimental-webgl') return null;
      return orig.call(this, type, ...args);
    };
  });
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await page.waitForTimeout(1500);
  await expect(page.locator('[data-ambient-canvas][data-active]')).toHaveCount(0);

  const aurora = page.locator('.ambient__aurora');
  await expect(aurora).toBeAttached();
  const { opacity, hasGradient, animated } = await aurora.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      opacity: Number(cs.opacity),
      hasGradient: cs.backgroundImage.includes('gradient'),
      animated: cs.animationName !== 'none' && parseFloat(cs.animationDuration) > 0.5,
    };
  });
  // Without these the fallback is a flat dark rectangle — technically
  // "present" but not a background anyone would call alive.
  expect(opacity).toBeGreaterThan(0.5);
  expect(hasGradient).toBe(true);
  expect(animated).toBe(true);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('reduced motion stops the ambient shader and freezes the aurora', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.waitForTimeout(1500);

  // ambient.js must decline to start at all, rather than starting and
  // being visually frozen — an always-on 30fps rAF loop is exactly the
  // battery cost a reduced-motion preference is asking us to avoid.
  await expect(page.locator('[data-ambient-canvas][data-active]')).toHaveCount(0);
  await expect(page.locator('.ambient__canvas')).toBeHidden();

  // The aurora stays, and stays visible — reduced motion removes movement,
  // not the background.
  const { display, opacity } = await page.locator('.ambient__aurora').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { display: cs.display, opacity: Number(cs.opacity) };
  });
  expect(display).not.toBe('none');
  expect(opacity).toBeGreaterThan(0.5);
  await ctx.close();
});

test('losing the ambient WebGL context leaves the aurora as the background', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ambient-canvas][data-active]')).toBeAttached({ timeout: 8000 });

  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));

  const mechanism = await page.evaluate(() => {
    const canvas = document.querySelector('[data-ambient-canvas]');
    const gl = canvas.getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_lose_context');
    if (ext) { ext.loseContext(); return 'WEBGL_lose_context'; }
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    return 'dispatched-event';
  });

  // Without this the canvas stays screen-blended over the aurora as a dead
  // black rectangle — screen(x, black) is a no-op, so the page would look
  // fine while silently having lost the whole caustics layer.
  await expect(page.locator('[data-ambient-canvas][data-active]')).toHaveCount(0, { timeout: 2000 });
  await expect(page.locator('.ambient__aurora')).toBeVisible();
  expect(errors).toEqual([]);
  test.info().annotations.push({ type: 'ambient-context-loss-mechanism', description: mechanism });
});

test('the page never scrolls horizontally at any width', async ({ page }) => {
  // Named for what it actually guards. The original intent was to prove
  // .ambient's `overflow: hidden` contains the aurora, which is deliberately
  // inset:-20% and scaled past 1 by its keyframes — but that assertion is
  // untestable and was proven so by mutation: flipping .ambient to
  // `overflow: visible` does NOT produce any horizontal overflow, because
  // position:fixed already clips its subtree to the viewport without
  // contributing to documentElement.scrollWidth. The overflow:hidden there
  // is belt-and-braces, not load-bearing, and no test can discriminate on
  // it. What this test does guard — a whole-page regression at five widths,
  // including any future background element that is NOT fixed — is real, so
  // it stays under an honest name.
  for (const width of [320, 375, 768, 1440, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBe(0);
  }
});

test('the hero reflection is actually mirrored, not an upright copy', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-mirror-canvas][data-active]')).toBeAttached({ timeout: 8000 });
  await page.waitForTimeout(400);

  // This was a real bug: the shader rendered the wordmark the right way up,
  // so the "reflection" under the waterline was a plain copy. The CSS
  // fallback (transform: scaleY(-1)) was correct the whole time, which is
  // what made it hard to see — the two paths disagreed and only the
  // fallback was ever eyeballed.
  //
  // Metric: where the ink starts and stops inside the wordmark band.
  // "agemo" with textBaseline 'top' leaves a large empty ascender gap above
  // the x-height glyphs and almost none below the g descender, so upright
  // and mirrored renders have opposite gap asymmetry. Centroid was tried
  // first and rejected — it shifts only ~5% of the band, inside the noise
  // the ripple already introduces.
  const r = await page.evaluate(() => {
    const canvas = document.querySelector('[data-mirror-canvas]');
    const gl = canvas.getContext('webgl');
    const w = canvas.width, h = canvas.height;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);

    const size = Math.min(w * 0.19, h * 0.62);
    const top = h * 0.06;
    const lo = Math.floor(top), hi = Math.ceil(top + size);

    const profile = (inkAt) => {
      const rows = [];
      for (let y = lo; y < hi; y++) rows.push(inkAt(y));
      return rows;
    };

    // readPixels is bottom-up; convert to rows measured from the top so
    // both profiles share one coordinate system.
    const shader = profile((yTop) => {
      const yGl = h - 1 - yTop;
      let s = 0;
      for (let x = 0; x < w; x += 2) s += px[(yGl * w + x) * 4 + 3];
      return s;
    });

    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `${size}px "Instrument Serif", Georgia, serif`;
    ctx.letterSpacing = '0.06em';
    ctx.fillText('agemo', w / 2, top);   // deliberately UPRIGHT: the reference
    const ref = ctx.getImageData(0, 0, w, h).data;
    const reference = profile((yTop) => {
      let s = 0;
      for (let x = 0; x < w; x += 2) s += ref[(yTop * w + x) * 4 + 3];
      return s;
    });

    // Asymmetry = empty rows above the ink minus empty rows below it.
    // Positive means the ink hugs the bottom of the band (upright).
    const asymmetry = (rows) => {
      const threshold = Math.max(...rows) * 0.06;
      let first = -1, last = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] > threshold) { if (first < 0) first = i; last = i; }
      }
      if (first < 0) return NaN;
      return first - (rows.length - 1 - last);
    };

    return { shader: asymmetry(shader), reference: asymmetry(reference), band: size };
  });

  // Vacuity guard: if an upright render were vertically symmetric there
  // would be nothing here to detect, and every assertion below would pass
  // against any orientation.
  expect(Math.abs(r.reference)).toBeGreaterThan(r.band * 0.08);
  expect(r.reference).toBeGreaterThan(0);

  // The rendered reflection must lean the other way.
  expect(r.shader).toBeLessThan(-r.band * 0.05);
});


// ---------------------------------------------------------------------------
// Work slabs — the 3D tilt, the pinned-only grid, and the specificity trap
// ---------------------------------------------------------------------------

// base.css's reveal rules are `html.js [data-reveal] { transform: ... }` and
// `[data-revealed] { transform: none }`, both of which outrank a plain `.slab`
// class selector. Putting the reveal and the tilt on one element therefore
// makes the tilt a silent no-op — the exact cross-cutting-CSS failure class
// this project has hit three times. Assert the split holds by reading the
// computed transform back, not by reading the source.
test('the slab tilt is not clobbered by the reveal transform', async ({ page }) => {
  await page.goto('/');
  const slab = page.locator('[data-slab]').first();
  await slab.scrollIntoViewIfNeeded();
  await expect(slab.locator('..')).toHaveAttribute('data-revealed', '');

  const before = await slab.evaluate((el) => getComputedStyle(el).transform);
  await slab.hover({ position: { x: 40, y: 40 } });
  const after = await slab.evaluate(async (el) => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return getComputedStyle(el).transform;
  });

  // A 3D tilt resolves to a matrix3d; "none" means the reveal rule won.
  expect(after).not.toBe('none');
  expect(after).not.toBe(before);
  expect(after).toContain('matrix3d');
});

test('the repo name decodes to its real value after a hover scramble', async ({ page }) => {
  await page.goto('/');
  const name = page.locator('[data-scramble]').first();
  const final = (await name.textContent()).trim();
  await name.hover();
  // The scramble replaces the text with noise mid-run; what matters is that
  // it always lands back on the exact original string.
  await expect(name).toHaveText(final, { timeout: 3000 });
});

test('every slab links to its repo safely in a new tab', async ({ page }) => {
  await page.goto('/');
  const links = page.locator('[data-slab] a.slab__hit');
  expect(await links.count()).toBe(site.pinned.length);
  for (const href of await links.evaluateAll((els) => els.map((e) => e.href))) {
    expect(href).toContain('github.com/');
  }
});

// ---------------------------------------------------------------------------
// Task 10 — the machine, reach, footer
// ---------------------------------------------------------------------------

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

test('no real name, address or contact form appears on any page', async ({ page }) => {
  for (const path of ['/', '/links', '/does-not-exist']) {
    await page.goto(path);
    const html = (await page.content()).toLowerCase();
    for (const forbidden of ['tuta.io', 'mailto:']) expect(html, path).not.toContain(forbidden);
  }
});

// The palindrome arrow must be an <svg>, never the literal ⟷ (U+27F7), which
// no face in the subset carries. Same defect class as the old star guard.
test('the footer palindrome renders its arrow as SVG', async ({ page }) => {
  await page.goto('/');
  const p = page.locator('.foot__palindrome');
  await expect(p.locator('svg')).toHaveCount(1);
  const text = await p.innerText();
  expect(text).toContain('AGEMO');
  expect(text).toContain('OMEGA');
  expect(text).not.toContain('\u27F7');
});

// ---------------------------------------------------------------------------
// Task 11 — the 404
// ---------------------------------------------------------------------------

test('404 renders and offers a way back', async ({ page }) => {
  const res = await page.goto('/does-not-exist');
  expect(res.status()).toBe(404);
  await expect(page.locator('[data-404]')).toBeVisible();
  await expect(page.locator('[data-404] a[href="/"]')).toBeVisible();
});

// ---------------------------------------------------------------------------
// The links page
// ---------------------------------------------------------------------------

test('every link in links.json is rendered, with a working href', async ({ page }) => {
  await page.goto('/links');
  const rows = page.locator('.row__hit');
  expect(await rows.count()).toBe(links.links.length);

  const hrefs = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  for (const link of links.links) expect(hrefs).toContain(link.url);

  const titles = (await page.locator('.row__title').allTextContents()).map((t) => t.trim());
  for (const link of links.links) expect(titles).toContain(link.title);
});

test('link rows open in a new tab without leaking the referrer window', async ({ page }) => {
  await page.goto('/links');
  for (const row of await page.locator('.row__hit').all()) {
    await expect(row).toHaveAttribute('target', '_blank');
    await expect(row).toHaveAttribute('rel', /noopener/);
  }
});

test('links are grouped by tag, one group per distinct tag', async ({ page }) => {
  await page.goto('/links');
  const expected = [...new Set(links.links.map((l) => l.tag || 'misc'))];
  await expect(page.locator('[data-link-group]')).toHaveCount(expected.length);
  const tags = (await page.locator('.group__tag').allTextContents()).map((t) => t.trim());
  expect(tags).toEqual(expected);
});

// The host line is the row's only statement of where the link actually goes,
// and it lives in a clipped box that only the hover slide reveals. If the
// slide stops working the destination becomes unknowable before clicking.
test('hovering a link row slides its host into view', async ({ page }) => {
  await page.goto('/links');
  const row = page.locator('.row').first();
  const stack = row.locator('.row__stack');

  const before = await stack.evaluate((el) => getComputedStyle(el).transform);
  await row.hover();
  const after = await stack.evaluate(async (el) => {
    await new Promise((r) => setTimeout(r, 600));
    return getComputedStyle(el).transform;
  });
  expect(before).toBe('none');
  expect(after).not.toBe('none');
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test('the nav reaches the links page and comes back', async ({ page }) => {
  await page.goto('/');
  await page.locator('.nav__link', { hasText: 'links' }).click();
  await expect(page).toHaveURL(/\/links\/?$/);
  await expect(page.locator('.vault__title')).toBeVisible();

  await page.locator('.nav__home').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('[data-hero]')).toBeVisible();
});

test('each page declares its own canonical URL', async ({ page }) => {
  const seen = [];
  for (const path of ['/', '/links']) {
    await page.goto(path);
    seen.push(await page.locator('link[rel=canonical]').getAttribute('href'));
  }
  expect(seen[0]).toBe('https://agemo.me/');
  // Astro's static build emits /links/index.html, so the canonical carries the
  // directory's trailing slash. Asserting the unslashed form would be
  // asserting a URL the site does not serve.
  expect(seen[1]).toBe('https://agemo.me/links/');
  expect(new Set(seen).size).toBe(2);
});

// Regression: the footer was omitted from base.css's `position: relative;
// z-index: 1` list and painted BEHIND the fixed ambient layer — its text was
// invisible on the real page while the whole suite stayed green, because
// nothing asserted paint order. elementFromPoint cannot catch this: the
// ambient sets pointer-events:none, so hit-testing reports the footer as the
// top element whether or not it is actually painted above the background.
// Assert the stacking contract itself instead.
test('every content region is stacked above the ambient background', async ({ page }) => {
  for (const [path, regions] of [
    ['/', ['.hero-stage', 'main', 'footer', '.nav']],
    ['/links', ['main', 'footer', '.nav']],
  ]) {
    await page.goto(path);
    const ambientZ = Number(
      await page.locator('.ambient').evaluate((el) => getComputedStyle(el).zIndex),
    );
    for (const sel of regions) {
      const s = await page.locator(sel).first().evaluate((el) => {
        const cs = getComputedStyle(el);
        return { position: cs.position, z: cs.zIndex };
      });
      // z-index is ignored outright on a statically positioned box, so the
      // position check is load-bearing, not decoration.
      expect(s.position, `${path} ${sel} position`).not.toBe('static');
      expect(Number(s.z), `${path} ${sel} z-index`).toBeGreaterThan(ambientZ);
    }
  }
});

// Regression: .row__stack was sized in `em`, which resolves against the
// stack's own inherited font-size rather than the clamped display size of the
// title inside it — a box a third the height of its content, guillotining
// every link title. Measure the box against the text it is supposed to hold.
test('link row titles are not clipped by their own box', async ({ page }) => {
  await page.goto('/links');
  for (const row of await page.locator('.row').all()) {
    const m = await row.locator('.row__stack').evaluate((el) => ({
      box: el.clientHeight,
      title: el.querySelector('.row__title').getBoundingClientRect().height,
    }));
    expect(m.title).toBeGreaterThan(0);
    expect(m.box).toBeGreaterThanOrEqual(m.title);
  }
});
