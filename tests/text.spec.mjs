import { test, expect } from '@playwright/test';

const ZETA = '$$\\zeta(s) = \\sum_{n=1}^{\\infty} \\frac{1}{n^s} = \\prod_{p \\text{ prime}} \\left(1 - p^{-s}\\right)^{-1}$$';

async function open(page, { text } = {}) {
  await page.goto('/text/');
  await expect(page.locator('[data-tool]')).toHaveAttribute('data-ready', 'true');
  if (text !== undefined) {
    await page.fill('[data-input]', text);
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => document.fonts.ready);
  return page.locator('[data-sheet]');
}

test('what you type is written out, one glyph at a time', async ({ page }) => {
  await open(page, { text: 'hello there' });
  const words = page.locator('.hw-w');
  await expect(words).toHaveCount(2);
  await expect(words.first().locator('.hw-g')).toHaveCount(5);
  await expect(page.locator('[data-ink]')).toContainText('hello there');
  // No two glyphs are set down the same way.
  const rots = await page.$$eval('.hw-g', (gs) => gs.map((g) => g.dataset.r));
  expect(new Set(rots).size).toBeGreaterThan(3);
});

test('maths is typeset, including the zeta identity', async ({ page }) => {
  await open(page, { text: `Euler said:\n${ZETA}` });
  const math = page.locator('.hw-math .katex').first();
  await expect(math).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.hw-math--bad')).toHaveCount(0);
  await expect(page.locator('.hw-math--waiting')).toHaveCount(0);
  const text = await math.innerText();
  for (const symbol of ['∑', '∏', '∞', 'ζ']) expect(text).toContain(symbol);
  // The fraction is a real fraction, not a slash.
  await expect(page.locator('.katex .frac-line').first()).toBeVisible();
  // Letters are written by hand; the big operators keep KaTeX's own shapes.
  const hand = await page.$eval('.katex .mathnormal', (el) => getComputedStyle(el).fontFamily);
  expect(hand).toMatch(/Caveat/);
  const op = await page.$eval('.katex .op-symbol', (el) => getComputedStyle(el).fontFamily);
  expect(op).toMatch(/KaTeX/);
});

test('inline maths sits inside the sentence', async ({ page }) => {
  await open(page, { text: 'Euler: $e^{i\\pi} + 1 = 0$ — neat.' });
  await expect(page.locator('.hw-math .katex')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.hw-math--block')).toHaveCount(0);
});

test('the slider runs from scrawl to careful', async ({ page }) => {
  await open(page, { text: 'the quick brown fox jumps over the lazy dog' });
  const spread = async () => {
    const rots = await page.$$eval('.hw-g', (gs) => gs.map((g) => Math.abs(Number(g.dataset.r))));
    return rots.reduce((a, b) => a + b, 0) / rots.length;
  };
  const set = async (value) => {
    await page.$eval('[data-neat]', (el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    await page.waitForTimeout(120);
  };
  await set('100');
  const careful = await spread();
  await set('0');
  const scrawl = await spread();
  expect(scrawl).toBeGreaterThan(careful * 4);
  // The stroke wobble follows the same slider.
  const wobbleAt = () => page.$eval('[data-displace]', (el) => Number(el.getAttribute('scale')));
  expect(await wobbleAt()).toBeGreaterThan(3);
  await set('100');
  expect(await wobbleAt()).toBeLessThan(1);
});

test('paper: lined, squared, plain and none', async ({ page }) => {
  const sheet = await open(page, { text: 'paper' });
  for (const [label, id] of [['Squared', 'grid'], ['Plain', 'plain'], ['None', 'none'], ['Lined', 'lined']]) {
    await page.getByRole('radio', { name: label }).click();
    await expect(sheet).toHaveAttribute('data-paper', id);
    await expect(page.getByRole('radio', { name: label })).toHaveAttribute('aria-checked', 'true');
    const style = await sheet.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { image: cs.backgroundImage, color: cs.backgroundColor };
    });
    if (id === 'plain') expect(style.image).toBe('none');
    if (id === 'lined' || id === 'grid') expect(style.image).toContain('gradient');
    if (id === 'none') expect(style.color).toBe('rgba(0, 0, 0, 0)');
  }
});

test('the ink colour changes the writing', async ({ page }) => {
  const sheet = await open(page, { text: 'ink' });
  const colour = () => page.$eval('.hw-g', (g) => getComputedStyle(g).color);
  const navy = await colour();
  await page.getByRole('radio', { name: 'Red', exact: true }).click();
  await expect.poll(colour).not.toBe(navy);
});

test('copy puts a PNG on the clipboard', async ({ page, context, browserName }, info) => {
  test.skip(browserName !== 'chromium', 'only Chromium lets a test read the clipboard');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, { text: `A line, and maths: ${ZETA}` });
  await page.locator('.hw-math .katex').first().waitFor({ timeout: 15000 });
  await page.click('[data-copy]');
  await expect(page.locator('[data-tool]')).toHaveAttribute('data-copied', /\d+/, { timeout: 20000 });
  await expect(page.locator('[data-status]')).toContainText('Copied');
  const clip = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const type = items[0].types.find((t) => t.startsWith('image/'));
    const blob = await items[0].getType(type);
    const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    return { type, size: blob.size, head: [...head] };
  });
  expect(clip.type).toBe('image/png');
  expect(clip.size).toBeGreaterThan(5000);
  expect(clip.head).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
});

test('save writes a PNG the size of the sheet', async ({ page }) => {
  await open(page, { text: 'save me' });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.click('[data-save]'),
  ]);
  expect(download.suggestedFilename()).toBe('handwriting.png');
  const size = await page.getAttribute('[data-tool]', 'data-exported');
  const [w, h] = size.split('x').map(Number);
  const sheet = await page.$eval('[data-sheet]', (el) => el.getBoundingClientRect().width);
  expect(w / sheet).toBeGreaterThanOrEqual(2);
  expect(h).toBeGreaterThan(200);
});

test('paste, example and clear work the quick way', async ({ page, browserName, context }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only here');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page);
  await page.evaluate(() => navigator.clipboard.writeText('from the clipboard'));
  await page.click('[data-paste]');
  await expect(page.locator('[data-input]')).toHaveValue('from the clipboard');
  await expect(page.locator('[data-ink]')).toContainText('from the clipboard');
  await page.click('[data-clear]');
  await expect(page.locator('[data-input]')).toHaveValue('');
  await expect(page.locator('.hw-g')).toHaveCount(0);
  await page.click('[data-sample]');
  await expect(page.locator('[data-input]')).toHaveValue(/handwriting/);
});

test('a long text makes a longer sheet, and a longer picture', async ({ page }) => {
  await open(page, { text: 'one short line' });
  const short = await page.$eval('[data-sheet]', (el) => el.getBoundingClientRect().height);
  await open(page, { text: Array.from({ length: 60 }, (_, i) => `line number ${i + 1} of the long text`).join('\n') });
  const long = await page.$eval('[data-sheet]', (el) => el.getBoundingClientRect().height);
  expect(long).toBeGreaterThan(short * 1.5);
  await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[data-save]')]);
  const [, h] = (await page.getAttribute('[data-tool]', 'data-exported')).split('x').map(Number);
  expect(h / long).toBeGreaterThanOrEqual(2);
});

test('the sheet is still there after a reload', async ({ page }) => {
  await open(page, { text: 'remember me' });
  await page.reload();
  await expect(page.locator('[data-tool]')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('[data-input]')).toHaveValue('remember me');
});

test('on an iPad the paper comes first and the buttons are thumb-sized', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 1366 }, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await open(page, { text: 'on the iPad' });
  const paper = await page.$eval('.pane--paper', (el) => el.getBoundingClientRect().top);
  const controls = await page.$eval('.pane:not(.pane--paper)', (el) => el.getBoundingClientRect().top);
  expect(paper).toBeLessThan(controls);
  const small = await page.$$eval('button, input[type="range"]', (els) => els
    .filter((el) => el.offsetParent !== null && el.getBoundingClientRect().height < 44)
    .map((el) => el.textContent.trim() || el.id));
  expect(small).toEqual([]);
  await ctx.close();
});
