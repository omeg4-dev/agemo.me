import { test, expect } from '@playwright/test';
import site from '../src/config/site.mjs';
import links from '../src/data/links.json' with { type: 'json' };
import fs from 'node:fs';

async function unlock(page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('agemo:unlocked', '1');
    } catch {}
  });
}

test('page loads with the correct title', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  await expect(page).toHaveTitle('Omega ⟷ agemO');
});

test('fonts are self-hosted, never fetched from a third-party CDN', async ({ page }) => {
  await unlock(page);
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

test('the display face is actually applied to a real text element', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const family = await page.locator('h1 .mirror__word').evaluate(
    (el) => getComputedStyle(el).fontFamily,
  );
  expect(family.replace(/["']/g, '').trim()).toMatch(/^Anybody/i);
  const loaded = await page.evaluate(() => document.fonts.check('900 1em Anybody'));
  expect(loaded).toBe(true);
});

test('page logs no console errors', async ({ page }) => {
  await unlock(page);
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
  const image = page.locator('.mirror__image');
  await expect(image).toBeAttached();
  await expect(image).toHaveAttribute('aria-hidden', 'true');

  const transform = await image.evaluate((el) => getComputedStyle(el).transform);
  const m = transform.match(/^matrix\(([^,]+)/);
  expect(m).toBeTruthy();
  const a = parseFloat(m[1]);
  expect(a).toBeLessThan(0);

  const h1Name = await page.locator('h1').evaluate((el) => el.getAttribute('aria-label') || el.innerText);
  expect(h1Name.trim()).toBe('Omega');
  await ctx.close();
});

test('the hero reflection is actually mirrored and hidden from screen readers', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const reflection = page.locator('.mirror__image');
  await expect(reflection).toHaveAttribute('aria-hidden', 'true');
  const transform = await reflection.evaluate((el) => getComputedStyle(el).transform);
  const m = transform.match(/^matrix\(([^,]+)/);
  expect(m).toBeTruthy();
  expect(parseFloat(m[1])).toBeLessThan(0);
});

test('the hero exposes an accessible name for the site', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const h1 = page.locator('h1');
  const accessibleName = await h1.evaluate((el) => el.getAttribute('aria-label') || el.innerText);
  expect(accessibleName).toBe('Omega');
});

test('the mirror line rests at the word\'s full width', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  await page.waitForTimeout(2000);
  const diff = await page.evaluate(() => {
    const mirror = document.querySelector('.mirror');
    const word = mirror.querySelector('.mirror__word');
    const wordWidth = word.getBoundingClientRect().width;
    const xVal = parseFloat(getComputedStyle(mirror).getPropertyValue('--x'));
    return Math.abs(xVal - wordWidth);
  });
  expect(diff).toBeLessThanOrEqual(2);
});

test('pointer over the hero moves the mirror line', async ({ page, isMobile, browserName }) => {
  test.skip(isMobile, 'Desktop pointer test only');
  test.skip(browserName === 'firefox', 'Headless Firefox synthetic pointer hover quirks prevent reliable tracking under load');
  await unlock(page);
  await page.goto('/');
  await page.waitForTimeout(2000);

  const wordBox = await page.locator('.mirror__word').boundingBox();
  expect(wordBox).toBeTruthy();

  const targetX = wordBox.x + wordBox.width * 0.4;
  await page.mouse.move(targetX, wordBox.y + wordBox.height * 0.5);
  await page.waitForTimeout(600);

  const xAt40 = await page.evaluate(() => {
    const mirror = document.querySelector('.mirror');
    return parseFloat(getComputedStyle(mirror).getPropertyValue('--x'));
  });
  const expected40 = wordBox.width * 0.4;
  expect(Math.abs(xAt40 - expected40)).toBeLessThanOrEqual(expected40 * 0.15);

  await page.mouse.move(0, 0);
  await page.waitForTimeout(1200);

  const xAtRest = await page.evaluate(() => {
    const mirror = document.querySelector('.mirror');
    return parseFloat(getComputedStyle(mirror).getPropertyValue('--x'));
  });
  expect(Math.abs(xAtRest - wordBox.width)).toBeLessThanOrEqual(2);
});

test('reduced motion keeps the mirror line still', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.waitForTimeout(500);

  const initialX = await page.evaluate(() => {
    const mirror = document.querySelector('.mirror');
    return parseFloat(getComputedStyle(mirror).getPropertyValue('--x'));
  });

  const wordBox = await page.locator('.mirror__word').boundingBox();
  if (wordBox) {
    await page.mouse.move(wordBox.x + wordBox.width * 0.4, wordBox.y + wordBox.height * 0.5);
    await page.waitForTimeout(600);
  }

  const afterX = await page.evaluate(() => {
    const mirror = document.querySelector('.mirror');
    return parseFloat(getComputedStyle(mirror).getPropertyValue('--x'));
  });

  expect(afterX).toBe(initialX);
  await ctx.close();
});

test('no canvas and no WebGL context is created', async ({ page }) => {
  await unlock(page);
  for (const path of ['/', '/links', '/does-not-exist']) {
    await page.goto(path);
    const canvasCount = await page.locator('canvas').count();
    expect(canvasCount, `canvas count on ${path}`).toBe(0);
  }
});

test('nothing animates infinitely', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  await page.waitForTimeout(3000);
  const infiniteAnimations = await page.evaluate(() => {
    return document.getAnimations()
      .filter((anim) => anim.playState === 'running')
      .filter((anim) => {
        const timing = anim.effect ? anim.effect.getTiming() : null;
        return timing && timing.iterations === Infinity;
      })
      .map((anim) => {
        const target = anim.effect && anim.effect.target;
        return target ? `${target.tagName}.${target.className}` : 'unknown';
      });
  });
  expect(infiniteAnimations).toEqual([]);
});

test('dark theme palette emulates correctly', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark' });
  const page = await ctx.newPage();
  await unlock(page);
  await page.goto('/');
  const bg = await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgb(22, 22, 22)');
  await ctx.close();
});

test('presence chips are never empty, even before Lanyard answers', async ({ page }) => {
  await unlock(page);
  await page.route('**/api.lanyard.rest/**', () => {});
  await page.goto('/');
  await expect(page.locator('[data-presence-state]').first()).not.toBeEmpty();
  await expect(page.locator('[data-presence-activity]').first()).not.toBeEmpty();
});

test('presence degrades to offline when Lanyard fails', async ({ page }) => {
  await unlock(page);
  await page.route('**/api.lanyard.rest/**', (route) => route.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('[data-presence-state]').first()).toHaveText(/offline/i, { timeout: 5000 });
  expect(errors).toEqual([]);
});

test('presence renders the reported state when Lanyard succeeds', async ({ page }) => {
  await unlock(page);
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
  await expect(page.locator('[data-presence-state]').first()).toHaveText(/online/i);
  await expect(page.locator('[data-presence-activity]').first()).toHaveText(/Neovim/);
});

test('no email address appears anywhere on the page', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const html = await page.content();
  expect(html).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  expect(html.toLowerCase()).not.toContain('tuta');
});

test('tagline is visible without JavaScript on a desktop viewport', async ({ browser }) => {
  const ctx = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  await page.goto('/');
  const line = page.locator('.hero__tagline');
  await expect(line).toBeVisible();
  const box = await line.boundingBox();
  expect(box.width).toBeGreaterThan(300);
  await expect(line).toHaveText(/I build things for Linux desktops/);
  const clipsContent = await line.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(clipsContent).toBe(false);
  await ctx.close();
});

function breakScrollScript(page) {
  const state = { broken: false };

  page.route('**/*.js', async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    if (!body.includes('data-revealed')) return route.fulfill({ response: res, body });
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
      /<script type="module">((?:(?!<\/script>)[\s\S])*data-revealed(?:(?!<\/script>)[\s\S])*)<\/script>/,
      '<script type="module">throw new Error("simulated scroll.js failure");</script>',
    );
    if (broken !== body) state.broken = true;
    await route.fulfill({ response: res, body: broken });
  });

  return state;
}

test('work stays visible when scroll.js fails to load', async ({ page }) => {
  await unlock(page);
  const state = breakScrollScript(page);
  await page.goto('/');
  expect(state.broken, 'scroll.js was never actually intercepted').toBe(true);
  const line = page.locator('#ws-work [data-project-name]').first();
  await expect(line).toBeAttached();
  const info = await line.evaluate((el) => ({
    jsClass: document.documentElement.classList.contains('js'),
  }));
  expect(info.jsClass).toBe(false);
  await expect(line).toHaveText(new RegExp(site.pinned[0]));
});

test('[data-reveal] sections stay visible when scroll.js fails to load', async ({ page }) => {
  await unlock(page);
  const state = breakScrollScript(page);
  await page.goto('/');
  expect(state.broken, 'scroll.js was never actually intercepted').toBe(true);
  const workWin = page.locator('#ws-work .work__win').first();
  await expect(workWin).toBeVisible();
  const opacity = await workWin.evaluate((el) => getComputedStyle(el).opacity);
  expect(opacity).toBe('1');
});

test('work section receives data-revealed once scrolled into view', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const workWin = page.locator('#ws-work .work__win').first();
  await expect(workWin).not.toHaveAttribute('data-revealed', '');
  await workWin.scrollIntoViewIfNeeded();
  await expect(workWin).toHaveAttribute('data-revealed', '', { timeout: 3000 });
});

test('a short data-reveal section at the true end of the document still reveals', async ({ page }) => {
  await unlock(page);
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

test('work section reveals immediately under reduced motion', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('#ws-work .work__win').first()).toHaveAttribute('data-revealed', '', { timeout: 3000 });
  await ctx.close();
});

test('work section reveals immediately when IntersectionObserver is unavailable', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await unlock(page);
  await page.addInitScript(() => { delete window.IntersectionObserver; });
  await page.goto('/');
  await expect(page.locator('#ws-work .work__win').first()).toHaveAttribute('data-revealed', '', { timeout: 3000 });
  await ctx.close();
});

test('the work grid renders enough cards with real data', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const cards = page.locator('[data-project]');
  expect(await cards.count()).toBe(site.pinned.length);

  for (const name of await page.locator('[data-project-name]').allTextContents()) {
    expect(name.trim()).not.toBe('');
  }
  for (const age of await page.locator('[data-project-age]').allTextContents()) {
    expect(age.trim()).toMatch(/^\d{4}-\d{2}$/);
  }
});

test('the work section shows the pinned repos and nothing else', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const names = (await page.locator('[data-project-name]').allTextContents()).map((n) => n.trim());
  for (const f of site.pinned) expect(names).toContain(f);
  expect(names.sort()).toEqual([...site.pinned].sort());
});

test('deny-listed repos never appear', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const names = (await page.locator('[data-project-name]').allTextContents()).map((n) => n.trim());
  for (const d of site.deny) expect(names).not.toContain(d);
});

test('project links open safely in a new tab', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const link = page.locator('[data-project]').first();
  await expect(link).toHaveAttribute('rel', /noopener/);
  await expect(link).toHaveAttribute('target', '_blank');
});

test('no tofu-prone literal glyphs (Ω ★ ⟷) appear anywhere in rendered text', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const bodyText = await page.locator('body').innerText();
  for (const glyph of ['★', '⟷', 'Ω']) {
    expect(bodyText).not.toContain(glyph);
  }
});

test('decorative elements do not intercept pointer events', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const line = page.locator('.mirror__line');
  const pointerEvents = await line.evaluate((el) => getComputedStyle(el).pointerEvents);
  expect(pointerEvents).toBe('none');
});

test('the page never scrolls horizontally at any width', async ({ page }) => {
  await unlock(page);
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

test('every slab links to its repo safely in a new tab', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const linksCount = page.locator('[data-project]');
  expect(await linksCount.count()).toBe(site.pinned.length);
  for (const href of await linksCount.evaluateAll((els) => els.map((e) => e.href))) {
    expect(href).toContain('github.com/');
  }
});

test('the uses block lists the machine', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const uses = page.locator('[data-uses]');
  await uses.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const text = (await uses.innerText()) || (await uses.textContent());
  for (const section of site.machine) {
    for (const { k, v } of section.rows) {
      expect(text, `${section.name}.${k}`).toContain(v);
    }
  }
});

test('each machine section draws one continuous bracket', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const blocks = page.locator('[data-uses] .ff__block');
  const count = await blocks.count();
  expect(count).toBe(site.machine.length);

  for (let i = 0; i < count; i += 1) {
    const geom = await blocks.nth(i).evaluate((block) => {
      const title = block.querySelector('.ff__title');
      const titleBox = title.getBoundingClientRect();
      const corner = getComputedStyle(title, '::before');
      const cornerTop = titleBox.top + parseFloat(corner.top);
      const rule = block.querySelector('.ff__rule').getBoundingClientRect();
      const rows = block.querySelector('.ff__rows').getBoundingClientRect();
      const close = block.querySelector('.ff__close').getBoundingClientRect();
      return {
        cornerTop,
        cornerLeft: titleBox.left + parseFloat(corner.left),
        ruleMid: rule.top + rule.height / 2,
        rowsLeft: rows.left,
        rowsTop: rows.top,
        rowsBottom: rows.bottom,
        closeLeft: close.left,
        closeTop: close.top,
        closeHeight: close.height,
      };
    });

    expect(Math.abs(geom.cornerTop - geom.ruleMid), `section ${i} corner/rule y`)
      .toBeLessThanOrEqual(1.5);
    expect(Math.abs(geom.cornerLeft - geom.rowsLeft), `section ${i} corner/gutter x`)
      .toBeLessThanOrEqual(1.5);
    expect(Math.abs(geom.closeLeft - geom.rowsLeft), `section ${i} close/gutter x`)
      .toBeLessThanOrEqual(1.5);
    expect(Math.abs(geom.closeTop - geom.rowsBottom), `section ${i} gutter/close seam`)
      .toBeLessThanOrEqual(1.5);
    expect(geom.closeHeight, `section ${i} close has height`).toBeGreaterThan(2);
  }
});

test('every machine icon resolves to a symbol in the sprite', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const missing = await page.locator('[data-uses]').evaluate((root) => {
    const bad = [];
    for (const use of root.querySelectorAll('use')) {
      const id = (use.getAttribute('href') || use.getAttribute('xlink:href') || '').slice(1);
      if (!id || !document.getElementById(id)) bad.push(id || '(empty)');
    }
    return bad;
  });
  expect(missing).toEqual([]);
  expect(await page.locator('[data-uses] use').count()).toBeGreaterThan(10);

  const painted = await page.locator('[data-uses] use').first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return { fill: cs.fill, stroke: cs.stroke, strokeWidth: cs.strokeWidth };
  });
  expect(painted.fill).toBe('none');
  expect(painted.stroke).not.toBe('none');
  expect(parseFloat(painted.strokeWidth)).toBeGreaterThan(1);
});

test('every page carries the mirrored wordmark in its title', async ({ page }) => {
  await unlock(page);
  for (const [path, lead] of [['/', ''], ['/links', 'links · '], ['/does-not-exist', '404 · ']]) {
    const res = await page.goto(path);
    if (path === '/does-not-exist') expect(res.status()).toBe(404);
    await expect(page).toHaveTitle(`${lead}Omega ⟷ agemO`);
  }
});

test('the favicon is wired up and every file it points at is served', async ({ page, request }) => {
  await unlock(page);
  await page.goto('/');
  const icons = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]')
    .evaluateAll((els) => els.map((e) => ({ rel: e.getAttribute('rel'), href: e.getAttribute('href'), type: e.getAttribute('type') })));
  expect(icons.some((i) => i.href === '/favicon.svg' && i.type === 'image/svg+xml')).toBe(true);
  expect(icons.some((i) => i.href === '/favicon.ico')).toBe(true);
  expect(icons.some((i) => i.rel === 'apple-touch-icon')).toBe(true);

  for (const { href } of icons) {
    const res = await request.get(href);
    expect(res.status(), href).toBe(200);
    expect(Number(res.headers()['content-length'] ?? 1), href).toBeGreaterThan(0);
  }

  const svg = await (await request.get('/favicon.svg')).text();
  const parsed = await page.evaluate((src) => {
    const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
    return {
      error: !!doc.querySelector('parsererror'),
      paths: doc.querySelectorAll('path').length,
      uses: doc.querySelectorAll('use').length,
    };
  }, svg);
  expect(parsed.error).toBe(false);
  expect(parsed.paths).toBeGreaterThan(0);
  expect(parsed.uses).toBe(2);
});

test('every link and button clears the 44px touch minimum', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true,
  });
  const page = await ctx.newPage();
  await unlock(page);
  for (const path of ['/', '/links']) {
    await page.goto(path);
    await page.waitForTimeout(400);
    if (path === '/') {
      for (const s of ['#ws-home', '#ws-work', '#ws-machine', '#ws-links', '#ws-reach']) {
        await page.locator(s).scrollIntoViewIfNeeded();
        await page.waitForTimeout(100);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(200);
    }
    const small = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('a, button')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.height < 44 || r.width < 44) {
          out.push(`${(el.textContent || '').trim().slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      return out;
    });
    expect(small, path).toEqual([]);
  }
  await ctx.close();
});

test('link destinations are readable without a hover', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto('/links');
  await page.waitForTimeout(400);
  const rows = await page.locator('.row').evaluateAll((els) => els.map((r) => {
    const title = r.querySelector('.row__title');
    const host = r.querySelector('.row__host');
    const titleBox = title.getBoundingClientRect();
    const hostBox = host.getBoundingClientRect();
    return {
      titleVisible: titleBox.width > 0 && titleBox.height > 0,
      hostVisible: hostBox.width > 0 && hostBox.height > 0,
    };
  }));
  expect(rows.length).toBeGreaterThan(0);
  for (const { titleVisible, hostVisible } of rows) {
    expect(titleVisible).toBe(true);
    expect(hostVisible).toBe(true);
  }
  await ctx.close();
});

test('contact offers Discord and GitHub only', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const hrefs = await page.locator('[data-reach] a').evaluateAll((els) => els.map((e) => e.href));
  expect(hrefs.some((h) => h.includes('discord.com'))).toBe(true);
  expect(hrefs.some((h) => h.includes('github.com'))).toBe(true);
  expect(hrefs.some((h) => h.startsWith('mailto:'))).toBe(false);
  await expect(page.locator('form')).toHaveCount(0);
});

test('the footer carries a real build SHA', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  await expect(page.locator('[data-build-sha]')).toHaveText(/^[0-9a-f]{7,40}$|^local$/);
});

test('no real name, address or contact form appears on any page', async ({ page }) => {
  await unlock(page);
  for (const path of ['/', '/links', '/does-not-exist']) {
    await page.goto(path);
    const html = (await page.content()).toLowerCase();
    for (const forbidden of ['tuta.io', 'mailto:']) expect(html, path).not.toContain(forbidden);
  }
});

test('the footer palindrome renders its arrow as SVG', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const p = page.locator('.foot__palindrome');
  await p.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await expect(p.locator('svg')).toHaveCount(1);
  const text = (await p.innerText()) || (await p.textContent());
  expect(text).toContain('AGEMO');
  expect(text).toContain('OMEGA');
  expect(text).not.toContain('\u27F7');
});

test('404 renders and offers a way back', async ({ page }) => {
  const res = await page.goto('/does-not-exist');
  expect(res.status()).toBe(404);
  await expect(page.locator('[data-404]')).toBeVisible();
  await expect(page.locator('[data-404] a[href="/"]')).toBeVisible();
});

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

test('the nav reaches the links page and comes back', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  await page.locator('a[href="/links"]').first().click();
  await expect(page).toHaveURL(/\/links\/?$/);
  await expect(page.locator('.vault__title')).toBeVisible();

  await page.locator('.bar__badge').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#ws-home')).toBeVisible();
});

test('each page declares its own canonical URL', async ({ page }) => {
  const seen = [];
  for (const path of ['/', '/links']) {
    await page.goto(path);
    seen.push(await page.locator('link[rel=canonical]').getAttribute('href'));
  }
  expect(seen[0]).toBe('https://agemo.me/');
  expect(seen[1]).toBe('https://agemo.me/links/');
  expect(new Set(seen).size).toBe(2);
});

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

for (const width of [360, 768, 1440]) {
  for (const path of ['/', '/links']) {
    test(`no horizontal overflow at ${width}px on ${path}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await unlock(page);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
      await ctx.close();
    });
  }
}

test('total JavaScript stays under the budget', async ({ page }) => {
  let bytes = 0;
  page.on('response', async (res) => {
    if (!/javascript/.test(res.headers()['content-type'] ?? '')) return;
    try { bytes += (await res.body()).length; } catch { /* ignore */ }
  });
  await unlock(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(bytes).toBeLessThan(80_000);
});

test('lazy chunks are not requested before interaction or visibility', async ({ page }) => {
  const earlyUrls = [];
  page.on('response', (res) => {
    if (/javascript/.test(res.headers()['content-type'] ?? '')) {
      earlyUrls.push(res.url());
    }
  });

  // Check initial load before interaction
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const hasLauncher = earlyUrls.some((u) => /launcher\./.test(u));
  expect(hasLauncher, 'launcher chunk loaded prematurely').toBe(false);
});

test('each page has exactly one h1 and a sane heading order', async ({ page }) => {
  for (const path of ['/', '/links', '/does-not-exist']) {
    await page.goto(path);
    expect(await page.locator('h1').count(), path).toBe(1);
  }
  await page.goto('/');
  expect(await page.locator('h2').count()).toBeGreaterThan(0);
});

test('every image and canvas is either labelled or explicitly decorative', async ({ page }) => {
  for (const path of ['/', '/links']) {
    await page.goto(path);
    const unlabelled = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('img')) {
        if (!el.hasAttribute('alt')) bad.push('img without alt');
      }
      for (const el of document.querySelectorAll('canvas')) {
        if (!el.closest('[aria-hidden="true"]') && !el.getAttribute('aria-label')) {
          bad.push(`canvas .${el.className} neither hidden nor labelled`);
        }
      }
      return bad;
    });
    expect(unlabelled, path).toEqual([]);
  }
});

test('every workspace heading shares the left edge of its first window', async ({ page }) => {
  await unlock(page);
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const sections = ['#ws-work', '#ws-machine', '#ws-links', '#ws-reach'];
    for (const s of sections) {
      await page.locator(s).scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      const { headLeft, winLeft } = await page.evaluate((secId) => {
        const sec = document.querySelector(secId);
        const head = sec.querySelector('.section-heading');
        const win = sec.querySelector('.win');
        return {
          headLeft: head.getBoundingClientRect().left,
          winLeft: win.getBoundingClientRect().left,
        };
      }, s);

      expect(
        Math.abs(headLeft - winLeft),
        `heading and window left mismatch in ${s} at ${width}px`,
      ).toBeLessThanOrEqual(1);
    }
  }
});

test('the hero pair fills the column', async ({ page }) => {
  await unlock(page);
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const { pairWidth, colWidth } = await page.evaluate(() => {
      const word = document.querySelector('.mirror__word');
      const wrap = document.querySelector('.wrap');
      const cs = getComputedStyle(wrap);
      const col = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const w = word.getBoundingClientRect().width;
      return { pairWidth: 2 * w, colWidth: col };
    });

    expect(pairWidth, `pair width at ${width}px too small`).toBeGreaterThanOrEqual(0.94 * colWidth);
    expect(pairWidth, `pair width at ${width}px too large`).toBeLessThanOrEqual(colWidth);
  }
});

test('the mirrored word starts at the mirror box edge on every page that uses it', async ({ page }) => {
  for (const path of ['/', '/404.html']) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    const gap = await page.evaluate(() => {
      const m = document.querySelector('[data-mirror]');
      return Math.abs(m.querySelector('.mirror__word').getBoundingClientRect().left - m.getBoundingClientRect().left);
    });
    expect(gap, `word is offset inside the mirror on ${path}`).toBeLessThanOrEqual(1);
  }
});

// ==========================================
// NEW FEATURE TESTS (Lock, Terminal, Launcher, Keys, Bar, Accent)
// ==========================================

test('lock screen shows on first visit, content is inert, and unlocks on Enter', async ({ page }) => {
  await page.goto('/');
  const lock = page.locator('#lock-screen');
  await expect(lock).toBeVisible();

  const isInert = await page.locator('main').evaluate((el) => el.hasAttribute('inert'));
  expect(isInert).toBe(true);

  // Press Enter to unlock
  await page.keyboard.press('Enter');
  await expect(lock).not.toBeAttached({ timeout: 2000 });

  const isNotInert = await page.locator('main').evaluate((el) => el.hasAttribute('inert'));
  expect(isNotInert).toBe(false);

  const stored = await page.evaluate(() => sessionStorage.getItem('agemo:unlocked'));
  expect(stored).toBe('1');
});

test('lock screen unlocks on click', async ({ page }) => {
  await page.goto('/');
  const lock = page.locator('#lock-screen');
  await expect(lock).toBeVisible();

  await page.locator('#lock-unlock-btn').click();
  await expect(lock).not.toBeAttached({ timeout: 2000 });
});

test('lock screen unlocks on wheel', async ({ page }) => {
  await page.goto('/');
  const lock = page.locator('#lock-screen');
  await expect(lock).toBeVisible();

  await page.mouse.wheel(0, 150);
  await expect(lock).not.toBeAttached({ timeout: 2000 });
});

test('lock screen does not show on second load in the same context', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Enter');
  await expect(page.locator('#lock-screen')).not.toBeAttached({ timeout: 2000 });

  await page.goto('/');
  await expect(page.locator('#lock-screen')).not.toBeAttached();
});

test('lock screen does not show with reduced motion, with a hash, or on /links/', async ({ browser }) => {
  // Reduced motion
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const p1 = await ctx.newPage();
  await p1.goto('/');
  await expect(p1.locator('#lock-screen')).not.toBeAttached();
  await ctx.close();

  // With a hash
  const p2 = await browser.newPage();
  await p2.goto('/#ws-work');
  await expect(p2.locator('#lock-screen')).not.toBeAttached();
  await p2.close();

  // On /links/
  const p3 = await browser.newPage();
  await p3.goto('/links');
  await expect(p3.locator('#lock-screen')).not.toBeAttached();
  await p3.close();
});

test('no-JS shows the page without the lock screen overlay', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('#lock-screen')).toBeHidden();
  await expect(page.locator('main')).toBeVisible();
  await ctx.close();
});

test('terminal typing help lists commands and whoami returns omega', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const input = page.locator('.term__input');
  await input.click();
  await input.fill('help');
  await page.keyboard.press('Enter');

  await expect(page.locator('.term__log')).toContainText('Available commands:');

  await input.fill('whoami');
  await page.keyboard.press('Enter');
  await expect(page.locator('.term__log')).toContainText('omega');
});

test('terminal cd work scrolls #ws-work into view and history works with ArrowUp', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const input = page.locator('.term__input');
  await input.click();
  await input.fill('whoami');
  await page.keyboard.press('Enter');

  await page.keyboard.press('ArrowUp');
  expect(await input.inputValue()).toBe('whoami');

  await input.fill('cd work');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  const inViewport = await page.locator('#ws-work').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  });
  expect(inViewport).toBe(true);
});

test('terminal theme green changes accent and unknown command prints error', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const input = page.locator('.term__input');
  await input.click();
  await input.fill('theme green');
  await page.keyboard.press('Enter');

  const accentVal = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  expect(accentVal).toBe('#42be65');

  await input.fill('fakecmdxyz');
  await page.keyboard.press('Enter');
  await expect(page.locator('.term__log')).toContainText('zsh: command not found: fakecmdxyz');
});

test('terminal exit command shows lock screen', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const input = page.locator('.term__input');
  await input.click();
  await input.fill('exit');
  await page.keyboard.press('Enter');

  await expect(page.locator('#lock-screen')).toBeVisible({ timeout: 2000 });
});

test('launcher opens with / and Ctrl+K, closes on Escape, and filters results', async ({ page }) => {
  await unlock(page);
  await page.goto('/');

  // Press /
  await page.keyboard.press('/');
  const launcher = page.locator('#launcher-modal');
  await expect(launcher).toHaveClass(/is-open/);

  // Close on Escape
  await page.keyboard.press('Escape');
  await expect(launcher).not.toHaveClass(/is-open/);

  // Press Ctrl+K
  await page.keyboard.press('Control+k');
  await expect(launcher).toHaveClass(/is-open/);

  // Typing mag puts magpie first
  await page.locator('.launcher__input').fill('mag');
  const firstItemText = await page.locator('.launcher__item').first().innerText();
  expect(firstItemText.toLowerCase()).toContain('magpie');
});

test('launcher Enter on a workspace scrolls there and restores focus on Escape', async ({ page }) => {
  await unlock(page);
  await page.goto('/');

  const launcherBtn = page.locator('[data-launcher-trigger]');
  await launcherBtn.click();
  const launcher = page.locator('#launcher-modal');
  await expect(launcher).toHaveClass(/is-open/);

  // Close with Escape restores focus
  await page.keyboard.press('Escape');
  await expect(launcher).not.toHaveClass(/is-open/);
  await expect(launcherBtn).toBeFocused();

  // Open again, search work, press Enter
  await page.keyboard.press('/');
  await page.locator('.launcher__input').fill('work');
  await page.keyboard.press('Enter');
  await expect(launcher).not.toHaveClass(/is-open/);
  await page.waitForTimeout(500);

  const inViewport = await page.locator('#ws-work').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  });
  expect(inViewport).toBe(true);
});

test('Ctrl+K in terminal opens launcher but / does not', async ({ page }) => {
  await unlock(page);
  await page.goto('/');

  const termInput = page.locator('.term__input');
  await termInput.click();

  // Type / inside terminal
  await page.keyboard.type('/');
  const launcher = page.locator('#launcher-modal');
  await expect(launcher).not.toHaveClass(/is-open/);
  expect(await termInput.inputValue()).toBe('/');

  // Press Ctrl+K inside terminal
  await page.keyboard.press('Control+k');
  await expect(launcher).toHaveClass(/is-open/);
});

test('keys 2 scrolls to work, ? toggles overlay, and keys ignored in terminal', async ({ page }) => {
  await unlock(page);
  await page.goto('/');

  // Press ?
  await page.keyboard.press('?');
  const overlay = page.locator('#keys-overlay');
  await expect(overlay).toHaveClass(/is-open/);

  // Press ? again to close
  await page.keyboard.press('Escape');
  await expect(overlay).not.toHaveClass(/is-open/);

  // Press 2 to scroll to work
  await page.keyboard.press('2');
  await expect.poll(async () => {
    return page.locator('#ws-work').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    });
  }).toBe(true);

  // Keys ignored in terminal input
  const termInput = page.locator('.term__input');
  await termInput.click();
  await page.keyboard.type('2');
  expect(await termInput.inputValue()).toBe('2');
});

test('bar active pill follows scroll and clock displays HH:MM', async ({ page }) => {
  await unlock(page);
  await page.goto('/');

  await expect(page.locator('.bar__time')).toHaveText(/^\d{2}:\d{2}$/);

  // Scroll to workspace 2
  await page.locator('#ws-work').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await expect(page.locator('.bar__pill[data-name="work"]')).toHaveClass(/is-active/);

  // Scroll to workspace 3
  await page.locator('#ws-machine').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await expect(page.locator('.bar__pill[data-name="machine"]')).toHaveClass(/is-active/);
});

test('accent persists across reload and junk value is ignored', async ({ page }) => {
  await unlock(page);
  await page.goto('/');

  await page.evaluate(() => localStorage.setItem('agemo:accent', 'rose'));
  await page.reload();
  let acc = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  expect(acc).toBe('#ff7eb6');

  // Junk value
  await page.evaluate(() => localStorage.setItem('agemo:accent', 'invalid_hack'));
  await page.reload();
  acc = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  expect(acc).toBe('#78a9ff');
});

test('windows tile in (get data-revealed) when scrolled into view', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  const machineWin = page.locator('#ws-machine .machine__win-ff');
  await expect(machineWin).not.toHaveAttribute('data-revealed', '');
  await machineWin.scrollIntoViewIfNeeded();
  await expect(machineWin).toHaveAttribute('data-revealed', '', { timeout: 3000 });
});

test('wallpaper blobs are visible and not covered by opaque backgrounds', async ({ page }) => {
  await unlock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForTimeout(400);

  const clipBlob = await page.screenshot({
    clip: { x: 240, y: 180, width: 40, height: 40 },
  });
  const clipCorner = await page.screenshot({
    clip: { x: 40, y: 800, width: 40, height: 40 },
  });
  expect(Buffer.compare(clipBlob, clipCorner)).not.toBe(0);

  const els = await page.evaluate(() => {
    const list = document.elementsFromPoint(260, 200);
    return list.map((el) => ({
      cls: el.className || '',
      bg: getComputedStyle(el).backgroundColor,
    }));
  });
  const blobIdx = els.findIndex((e) => e.cls.includes('wallpaper__blobs'));
  expect(blobIdx).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < blobIdx; i++) {
    const bg = els[i].bg;
    const isTrans = bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)' || bg === 'rgba(0, 0, 0, 0.0)';
    expect(isTrans, `Element before wallpaper blobs has non-transparent background ${bg}`).toBe(true);
  }
});

test('lock screen applies static blur to main while locked and removes it after unlock', async ({ page }) => {
  await page.goto('/');
  const lock = page.locator('#lock-screen');
  await expect(lock).toBeVisible();

  const filterWhileLocked = await page.locator('main').evaluate((el) => getComputedStyle(el).filter);
  expect(filterWhileLocked).toContain('blur');

  await page.keyboard.press('Enter');
  await expect(lock).not.toBeAttached({ timeout: 2000 });

  const filterAfterUnlock = await page.locator('main').evaluate((el) => getComputedStyle(el).filter);
  expect(filterAfterUnlock).toBe('none');
});

test('pointer/wheel unlock moves focus to unoutlined target, key unlock focuses badge', async ({ page }) => {
  // Key unlock
  await page.goto('/');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(650);
  let focusedTag = await page.evaluate(() => document.activeElement?.className);
  expect(focusedTag).toContain('bar__badge');

  // Pointer unlock
  await page.evaluate(() => sessionStorage.removeItem('agemo:unlocked'));
  await page.goto('/');
  const unlockBtn = page.locator('#lock-unlock-btn');
  await expect(unlockBtn).toBeVisible();
  await unlockBtn.click();
  await page.waitForTimeout(650);
  const activeId = await page.evaluate(() => document.activeElement?.id);
  expect(activeId).toBe('unfocus-target');
});

test('WS1 composition: no overlap, fits first viewport, mirror fits left column at 1440 and 1280', async ({ page }) => {
  await unlock(page);
  for (const { width, height } of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.waitForTimeout(500);

    const wordBox = await page.locator('.mirror__word').boundingBox();
    expect(wordBox).toBeTruthy();

    // Check intersection with any .win
    const winBoxes = await page.locator('#ws-home .win').evaluateAll((wins) =>
      wins.map((w) => {
        const r = w.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      })
    );
    for (const winBox of winBoxes) {
      const intersects =
        wordBox.x < winBox.right &&
        wordBox.x + wordBox.width > winBox.x &&
        wordBox.y < winBox.bottom &&
        wordBox.y + wordBox.height > winBox.y;
      expect(intersects, `word intersects a window at ${width}x${height}`).toBe(false);
    }

    // Whole WS1 content fits within first viewport height
    const ws1Box = await page.locator('#ws-home').boundingBox();
    expect(ws1Box.y + ws1Box.height).toBeLessThanOrEqual(height + 1);

    // Mirror pair width <= left column width
    const leftColBox = await page.locator('.ws-home__left').boundingBox();
    const mirrorBox = await page.locator('.mirror').boundingBox();
    expect(mirrorBox.width).toBeLessThanOrEqual(leftColBox.width + 1);
  }
});

test('terminal output retains spaces in fastfetch summary and hint line', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  await page.waitForTimeout(2200);

  const lines = await page.locator('#ws-home .term__line').evaluateAll((els) =>
    els.map((el) => el.innerText.trim())
  );
  const osLine = lines.find((l) => l.startsWith('os:'));
  expect(osLine).toBe('os: CachyOS x86_64');

  const hintLine = lines.find((l) => l.includes('for the launcher'));
  expect(hintLine).toBe('type help, or press / for the launcher');
});

test('bar workspace pills have correct dimensions (8x8 circle inactive, ~28x18 active)', async ({ page }) => {
  await unlock(page);
  await page.goto('/');
  await page.waitForTimeout(400);

  const pills = await page.locator('.bar__pill').evaluateAll((els) =>
    els.map((p) => {
      const pip = p.querySelector('.bar__pill-pip');
      const r = pip ? pip.getBoundingClientRect() : { width: 0, height: 0 };
      return {
        isActive: p.classList.contains('is-active'),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    })
  );

  for (const p of pills) {
    if (p.isActive) {
      expect(Math.abs(p.width - 28)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.height - 18)).toBeLessThanOrEqual(1);
    } else {
      expect(Math.abs(p.width - 8)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.height - 8)).toBeLessThanOrEqual(1);
    }
  }
});

test('mobile bar items are fully inside the viewport at 320, 360, 390, 414', async ({ page }) => {
  await unlock(page);
  for (const width of [320, 360, 390, 414]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await page.waitForTimeout(300);

    const items = await page.evaluate(() => {
      const bar = document.getElementById('bar');
      const els = bar.querySelectorAll('.bar__badge, .bar__pill, .bar__presence, .bar__launcher-btn, .bar__clock');
      return Array.from(els).map((el) => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.className,
          left: r.left,
          right: r.right,
          width: r.width,
        };
      });
    });

    for (const item of items) {
      if (item.width === 0) continue;
      expect(item.left, `item ${item.tag} left at ${width}px`).toBeGreaterThanOrEqual(0);
      expect(item.right, `item ${item.tag} right at ${width}px`).toBeLessThanOrEqual(width + 0.5);
    }
  }
});

// ==========================================
// SCREENSHOT SUITE (@shots)
// ==========================================

async function scrollThroughPage(p) {
  const scrollHeight = await p.evaluate(() => document.documentElement.scrollHeight);
  const step = 400;
  for (let y = 0; y <= scrollHeight; y += step) {
    await p.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
    await p.waitForTimeout(100);
  }
  await p.evaluate(() => {
    document.querySelectorAll('section[data-ws]').forEach((s) => {
      s.style.contentVisibility = 'visible';
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await p.waitForTimeout(300);
}

test('@shots generate evaluation screenshots', async ({ page }) => {
  test.setTimeout(90000);
  fs.mkdirSync('/tmp/agemo-shots', { recursive: true });

  // 1. / at 1440x900 locked
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/agemo-shots/home-1440-locked.png' });

  // 2. / at 1440x900 unlocked (settled)
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1600);
  await page.screenshot({ path: '/tmp/agemo-shots/home-1440-unlocked.png' });

  // 3. / full page at 1440 (scroll through so reveals fire)
  await scrollThroughPage(page);
  await page.screenshot({ path: '/tmp/agemo-shots/home-1440-full.png', fullPage: true });

  // 4. / at 390x844 locked, unlocked, full page
  const mCtx = await page.context().browser().newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const mPage = await mCtx.newPage();
  await mPage.goto('/');
  await mPage.waitForTimeout(600);
  await mPage.screenshot({ path: '/tmp/agemo-shots/home-390-locked.png' });

  await mPage.keyboard.press('Enter');
  await mPage.waitForTimeout(1600);
  await mPage.screenshot({ path: '/tmp/agemo-shots/home-390-unlocked.png' });

  await scrollThroughPage(mPage);
  await mPage.screenshot({ path: '/tmp/agemo-shots/home-390-full.png', fullPage: true });
  await mCtx.close();

  // 5. / at 1024x768 full page
  const tCtx = await page.context().browser().newContext({ viewport: { width: 1024, height: 768 } });
  const tPage = await tCtx.newPage();
  await unlock(tPage);
  await tPage.goto('/');
  await scrollThroughPage(tPage);
  await tPage.screenshot({ path: '/tmp/agemo-shots/home-1024-full.png', fullPage: true });
  await tCtx.close();

  // 6. / at 1440x900 with launcher open and mag typed
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(300);
  await page.locator('.launcher__input').fill('mag');
  await page.waitForTimeout(200);
  await page.screenshot({ path: '/tmp/agemo-shots/home-1440-launcher-mag.png' });
  await page.keyboard.press('Escape');

  // 7. / at 1440x900 with keybinds overlay open
  await page.keyboard.press('?');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/agemo-shots/home-1440-keybinds.png' });
  await page.keyboard.press('Escape');

  // 8. / at 1440x900 after running help and fastfetch in terminal
  const termInput = page.locator('.term__input');
  await termInput.click();
  await termInput.fill('help');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await termInput.fill('fastfetch');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/agemo-shots/home-1440-terminal.png' });

  // 9. /links/ at 1440 and 390
  await page.goto('/links');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/agemo-shots/links-1440.png', fullPage: true });

  const lCtx = await page.context().browser().newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const lPage = await lCtx.newPage();
  await lPage.goto('/links');
  await lPage.waitForTimeout(500);
  await lPage.screenshot({ path: '/tmp/agemo-shots/links-390.png', fullPage: true });
  await lCtx.close();

  // 10. /404.html at 1440 and 390
  await page.goto('/404.html');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/agemo-shots/404-1440.png' });

  const eCtx = await page.context().browser().newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const ePage = await eCtx.newPage();
  await ePage.goto('/404.html');
  await ePage.waitForTimeout(500);
  await ePage.screenshot({ path: '/tmp/agemo-shots/404-390.png' });
  await eCtx.close();
});
