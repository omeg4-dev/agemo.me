import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const repos = JSON.parse(fs.readFileSync(new URL('../src/data/repos.json', import.meta.url))).pinned;
const links = JSON.parse(fs.readFileSync(new URL('../src/data/links.json', import.meta.url))).links;
const PAGES = ['/', '/links/', '/404.html'];

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // Lanyard is third-party and best-effort; its network failures are not ours.
    if (m.type() === 'error' && !/lanyard|Failed to load resource/i.test(m.text())) errors.push(m.text());
  });
  return errors;
}

async function scrollHeroTo(page, f) {
  await page.evaluate((f) => {
    const hero = document.querySelector('[data-hero]');
    scrollTo(0, (hero.offsetHeight - innerHeight) * f);
  }, f);
  await page.waitForTimeout(150);
}

/** Visual left edges of the five hero letters, in DOM order. */
const letterLefts = (page) =>
  page.$$eval('#hero-word .word__l', (ls) => ls.map((l) => l.getBoundingClientRect().left));

for (const path of PAGES) {
  test(`${path} loads without errors`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    expect(errors).toEqual([]);
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test(`${path} never scrolls sideways`, async ({ page }) => {
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(over, `overflow at ${width}px`).toBeLessThanOrEqual(0);
    }
  });

  test(`${path} has no email address or mailto`, async ({ page }) => {
    await page.goto(path);
    const html = await page.content();
    expect(html).not.toMatch(/mailto:/i);
    expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  });
}

test('the first Tab reaches the skip link, and focus is visible', async ({ page, browserName }, info) => {
  test.skip(info.project.name === 'mobile', 'no keyboard on a phone');
  await page.goto('/');
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toHaveClass(/skip/);
  const box = await focused.boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  expect(outline).toBe('solid');
});

test('scrolling turns OMEGA into its reflection', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await scrollHeroTo(page, 0);
  const start = await letterLefts(page);
  for (let i = 1; i < 5; i++) expect(start[i]).toBeGreaterThan(start[i - 1]);
  await expect(page.locator('#hero-word')).toHaveAttribute('aria-label', 'Omega');

  await scrollHeroTo(page, 1);
  const end = await letterLefts(page);
  // Order reversed: A, G, E, M, O left to right.
  for (let i = 1; i < 5; i++) expect(end[i]).toBeLessThan(end[i - 1]);
  // Each letter is turned over: its rotation matrix has a negative x scale.
  const flipped = await page.$$eval('#hero-word .word__l', (ls) =>
    ls.map((l) => new DOMMatrix(getComputedStyle(l).transform).m11));
  for (const m11 of flipped) expect(m11).toBeLessThan(-0.99);
  // The word still spans the same width, so nothing was lost off either side.
  expect(Math.abs((end[0] - end[4]) - (start[4] - start[0]))).toBeLessThan(40);
  await expect(page.locator('.hero__layer--backing [data-read]')).toHaveText('agemo');

  await scrollHeroTo(page, 0);
  await expect(page.locator('.hero__layer--backing [data-read]')).toHaveText('omega');
});

test('both layers move their letters in step', async ({ page }) => {
  await page.goto('/');
  await scrollHeroTo(page, 0.4);
  const tfs = await page.$$eval('.word', (ws) => ws.map((w) => [...w.children].map((l) => l.style.transform)));
  expect(tfs[0]).toEqual(tfs[1]);
  expect(tfs[0].some((t) => t && t !== 'none')).toBe(true);
});

test('the mirror edge rests on the middle and follows the mouse', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'touch screens have no hover pointer');
  await page.goto('/');
  const axisX = () => page.$eval('.hero__axis', (a) => a.getBoundingClientRect().left);
  const vw = page.viewportSize().width;
  // A scroll with no real pointer must not move it (Chrome's synthetic 0,0 move).
  await scrollHeroTo(page, 0.1);
  await page.waitForTimeout(400);
  expect(Math.abs((await axisX()) - vw / 2)).toBeLessThan(2);

  await page.mouse.move(vw * 0.25, 400, { steps: 4 });
  await expect.poll(axisX, { timeout: 3000 }).toBeLessThan(vw * 0.25 + 3);
  expect(await axisX()).toBeGreaterThan(vw * 0.25 - 3);
  // The silvered copy is clipped exactly at the edge.
  const clip = await page.$eval('.hero__layer--silver', (l) => getComputedStyle(l).clipPath);
  expect(clip).toMatch(/inset/);
});

test.describe('reduced motion', () => {
  test('the word stays put and the hero is one screen', async ({ page }) => {
    // test.use({ reducedMotion }) does not reach the page in this setup;
    // emulateMedia does, and the first assertion proves it took.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    const h = await page.$eval('[data-hero]', (e) => e.offsetHeight);
    expect(h).toBeLessThanOrEqual((await page.evaluate(() => innerHeight)) + 1);
    await page.evaluate(() => scrollTo(0, 400));
    await page.waitForTimeout(200);
    const tfs = await page.$$eval('#hero-word .word__l', (ls) => ls.map((l) => l.style.transform));
    expect(tfs.every((t) => t === '')).toBe(true);
  });
});

test('pinned shows every pinned repo, linked to GitHub', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('#pinned .repo__link');
  await expect(rows).toHaveCount(repos.length);
  for (const [i, r] of repos.entries()) {
    await expect(rows.nth(i)).toHaveAttribute('href', r.url);
    await expect(rows.nth(i).locator('.repo__name')).toHaveText(r.name);
    if (r.description) await expect(rows.nth(i).locator('.repo__desc')).toHaveText(r.description);
  }
});

test('hovering a repo unfolds the reflection of its name', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'no hover on touch');
  await page.goto('/');
  const name = page.locator('#pinned .repo__name').first();
  const ghost = () => name.evaluate((n) => {
    const s = getComputedStyle(n, '::after');
    return { o: Number(s.opacity), m11: new DOMMatrix(s.transform).m11, text: s.content };
  });
  expect((await ghost()).o).toBe(0);
  await page.locator('#pinned .repo__link').first().hover();
  await expect.poll(async () => (await ghost()).m11, { timeout: 2000 }).toBeLessThan(-0.99);
  const g = await ghost();
  expect(g.o).toBeGreaterThan(0.3);
  // Firefox reports the unresolved attr() rather than the string it resolves to.
  expect([`"${repos[0].name}"`, 'attr(data-name)']).toContain(g.text);
  await expect(name).toHaveAttribute('data-name', repos[0].name);
});

test('elsewhere links to discord, github and the links page', async ({ page }) => {
  await page.goto('/');
  const hrefs = await page.$$eval('.way', (as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs).toEqual([
    expect.stringContaining('discord.com/users/'),
    'https://github.com/omeg4-dev',
    '/links/',
  ]);
});

test('hyprland and cachyos are mentioned, not the theme', async ({ page }) => {
  await page.goto('/');
  const text = (await page.locator('body').innerText()).toLowerCase();
  expect((text.match(/cachyos/g) ?? []).length).toBeLessThanOrEqual(1);
  // One mention in prose, plus wherever a repo's own description names it.
  const fromRepos = repos.filter((r) => /hyprland/i.test(r.description)).length;
  expect((text.match(/hyprland/g) ?? []).length).toBeLessThanOrEqual(1 + fromRepos);
});

test('links page lists every entry under its tag', async ({ page }) => {
  await page.goto('/links/');
  for (const l of links) {
    const row = page.locator(`a.repo__link[href="${l.url}"]`);
    await expect(row).toHaveCount(1);
    await expect(row.locator('.repo__name')).toHaveText(l.title);
    const tag = await row.evaluate((a) => a.closest('section').querySelector('h2').textContent);
    expect(tag).toBe(l.tag || 'misc');
  }
  await expect(page.locator('.nav a[aria-current="page"]')).toHaveText('links');
});

test('404 says so and leads home', async ({ page }) => {
  await page.goto('/404.html');
  await expect(page.locator('h1')).toHaveText('404');
  await expect(page.locator('a.home')).toHaveAttribute('href', '/');
});

test('tap targets are at least 44px tall', async ({ page }) => {
  await page.goto('/');
  const small = await page.$$eval('a', (as) => as
    .filter((a) => !a.classList.contains('skip') && a.offsetParent !== null)
    .map((a) => ({ t: a.textContent.trim(), h: a.getBoundingClientRect().height }))
    .filter((x) => x.h < 44));
  expect(small).toEqual([]);
});

test('screenshots @shots', async ({ page }, info) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  for (const f of [0, 0.3, 0.6, 1]) {
    await scrollHeroTo(page, f);
    await page.screenshot({ path: `test-results/shots/${info.project.name}-hero-${f}.png` });
  }
  for (const id of ['pinned', 'elsewhere']) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `test-results/shots/${info.project.name}-${id}.png` });
  }
  for (const p of ['/links/', '/404.html']) {
    await page.goto(p);
    await page.screenshot({ path: `test-results/shots/${info.project.name}${p.replace(/\W/g, '-')}.png`, fullPage: true });
  }
});
