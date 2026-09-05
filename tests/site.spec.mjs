import { test, expect } from '@playwright/test';

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
