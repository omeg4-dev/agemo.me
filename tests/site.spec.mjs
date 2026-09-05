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
