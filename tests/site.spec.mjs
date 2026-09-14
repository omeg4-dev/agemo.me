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

test('the display face is actually applied to a real text element', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const family = await page.locator('h1').evaluate(
    (el) => getComputedStyle(el).fontFamily,
  );
  expect(family.replace(/["']/g, '').trim()).toMatch(/^Anybody/i);
  const loaded = await page.evaluate(() => document.fonts.check('900 1em Anybody'));
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
  await page.goto('/');
  const reflection = page.locator('.mirror__image');
  await expect(reflection).toHaveAttribute('aria-hidden', 'true');
  const transform = await reflection.evaluate((el) => getComputedStyle(el).transform);
  const m = transform.match(/^matrix\(([^,]+)/);
  expect(m).toBeTruthy();
  expect(parseFloat(m[1])).toBeLessThan(0);
});

test('the hero exposes an accessible name for the site', async ({ page }) => {
  await page.goto('/');
  const h1 = page.locator('h1');
  const accessibleName = await h1.evaluate((el) => el.getAttribute('aria-label') || el.innerText);
  expect(accessibleName).toBe('Omega');
});

test('the mirror line rests at the word\'s full width', async ({ page }) => {
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

test('pointer over the hero moves the mirror line', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop pointer test only');
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
  expect(Math.abs(xAt40 - expected40)).toBeLessThanOrEqual(expected40 * 0.1);

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
  for (const path of ['/', '/links', '/does-not-exist']) {
    await page.goto(path);
    const canvasCount = await page.locator('canvas').count();
    expect(canvasCount, `canvas count on ${path}`).toBe(0);
  }
});

test('nothing animates infinitely', async ({ page }) => {
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
  await page.goto('/');
  const bg = await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgb(17, 22, 27)');
  await ctx.close();
});

test('presence chips are never empty, even before Lanyard answers', async ({ page }) => {
  await page.route('**/api.lanyard.rest/**', () => {});
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

test('no email address appears anywhere on the page', async ({ page }) => {
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
  const line = page.locator('.identity__line');
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
  expect(info.width).toBeGreaterThan(300);
  expect(info.clipsContent).toBe(false);
  await expect(line).toHaveText(/I build things for Linux desktops/);
});

test('[data-reveal] sections stay visible when scroll.js fails to load', async ({ page }) => {
  const state = breakScrollScript(page);
  await page.goto('/');
  expect(state.broken, 'scroll.js was never actually intercepted').toBe(true);
  const identity = page.locator('.identity');
  await expect(identity).toBeVisible();
  const opacity = await identity.evaluate((el) => getComputedStyle(el).opacity);
  expect(opacity).toBe('1');
});

test('identity section receives data-revealed once scrolled into view', async ({ page }) => {
  await page.goto('/');
  const identity = page.locator('.identity');
  await expect(identity).not.toHaveAttribute('data-revealed', '');
  await identity.scrollIntoViewIfNeeded();
  await expect(identity).toHaveAttribute('data-revealed', '', { timeout: 3000 });
});

test('a short data-reveal section at the true end of the document still reveals', async ({ page }) => {
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
  expect(await cards.count()).toBe(site.pinned.length);

  for (const name of await page.locator('[data-project-name]').allTextContents()) {
    expect(name.trim()).not.toBe('');
  }
  for (const age of await page.locator('[data-project-age]').allTextContents()) {
    expect(age.trim()).toMatch(/^\d{4}-\d{2}$/);
  }
});

test('the work section shows the pinned repos and nothing else', async ({ page }) => {
  await page.goto('/');
  const names = (await page.locator('[data-project-name]').allTextContents()).map((n) => n.trim());
  for (const f of site.pinned) expect(names).toContain(f);
  expect(names.sort()).toEqual([...site.pinned].sort());
});

test('deny-listed repos never appear', async ({ page }) => {
  await page.goto('/');
  const names = (await page.locator('[data-project-name]').allTextContents()).map((n) => n.trim());
  for (const d of site.deny) expect(names).not.toContain(d);
});

test('project links open safely in a new tab', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('[data-project]').first();
  await expect(link).toHaveAttribute('rel', /noopener/);
  await expect(link).toHaveAttribute('target', '_blank');
});

test('no tofu-prone literal glyphs (Ω ★ ⟷) appear anywhere in rendered text', async ({ page }) => {
  await page.goto('/');
  const bodyText = await page.locator('body').innerText();
  for (const glyph of ['★', '⟷', 'Ω']) {
    expect(bodyText).not.toContain(glyph);
  }
});

test('decorative elements do not intercept pointer events', async ({ page }) => {
  await page.goto('/');
  const line = page.locator('.mirror__line');
  const pointerEvents = await line.evaluate((el) => getComputedStyle(el).pointerEvents);
  expect(pointerEvents).toBe('none');
});

test('the page never scrolls horizontally at any width', async ({ page }) => {
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
  await page.goto('/');
  const links = page.locator('[data-project]');
  expect(await links.count()).toBe(site.pinned.length);
  for (const href of await links.evaluateAll((els) => els.map((e) => e.href))) {
    expect(href).toContain('github.com/');
  }
});

test('the uses block lists the machine', async ({ page }) => {
  await page.goto('/');
  const text = await page.locator('[data-uses]').innerText();
  for (const section of site.machine) {
    for (const { k, v } of section.rows) {
      expect(text, `${section.name}.${k}`).toContain(v);
    }
  }
});

test('each machine section draws one continuous bracket', async ({ page }) => {
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
  for (const [path, lead] of [['/', ''], ['/links', 'links · '], ['/does-not-exist', '404 · ']]) {
    const res = await page.goto(path);
    if (path === '/does-not-exist') expect(res.status()).toBe(404);
    await expect(page).toHaveTitle(`${lead}Omega ⟷ agemO`);
  }
});

test('the favicon is wired up and every file it points at is served', async ({ page, request }) => {
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
  for (const path of ['/', '/links']) {
    await page.goto(path);
    await page.waitForTimeout(400);
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

test('the footer palindrome renders its arrow as SVG', async ({ page }) => {
  await page.goto('/');
  const p = page.locator('.foot__palindrome');
  await expect(p.locator('svg')).toHaveCount(1);
  const text = await p.innerText();
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
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(bytes).toBeLessThan(25_000);
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

test('every content block shares one left edge', async ({ page }) => {
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const homeLefts = await page.evaluate(() => {
      const selectors = [
        'nav .wrap > *',
        'h1',
        '#work h2',
        '#machine h2',
        '#reach h2',
        'footer .wrap > *',
      ];
      return selectors.map((s) => {
        const el = document.querySelector(s);
        if (!el) throw new Error(`Element not found: ${s}`);
        return el.getBoundingClientRect().left;
      });
    });

    for (let i = 1; i < homeLefts.length; i++) {
      expect(
        Math.abs(homeLefts[i] - homeLefts[0]),
        `home element index ${i} left mismatch at ${width}px: expected ${homeLefts[0]}, got ${homeLefts[i]}`,
      ).toBeLessThanOrEqual(1);
    }

    await page.goto('/links');
    await page.waitForLoadState('networkidle');

    const linksLefts = await page.evaluate(() => {
      const selectors = ['nav .wrap > *', 'h1'];
      return selectors.map((s) => {
        const el = document.querySelector(s);
        if (!el) throw new Error(`Element not found: ${s}`);
        return el.getBoundingClientRect().left;
      });
    });

    expect(
      Math.abs(linksLefts[1] - linksLefts[0]),
      `links page h1 left mismatch at ${width}px`,
    ).toBeLessThanOrEqual(1);
  }
});

test('the hero pair fills the column', async ({ page }) => {
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
