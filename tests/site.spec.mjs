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
  const family = await page.locator('.identity__line').evaluate(
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
