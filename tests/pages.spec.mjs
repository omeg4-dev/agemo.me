import { test, expect } from '@playwright/test';

const DATA = 'https://dactylus.app/mc/stats/data';
const roster = [
  { uuid: 'a', name: 'Alpha', online: true, playtimeTicks: 72000 * 50, deaths: 3 },
  { uuid: 'b', name: 'Bravo', online: false, playtimeTicks: 72000 * 80, deaths: 9 },
  { uuid: 'c', name: '.BedrockC', online: false, playtimeTicks: 72000 * 5, deaths: 0 },
];
const detail = {
  a: { blocksMined: 500, mobKills: 40, distanceWalkedCm: 250000 },
  b: { blocksMined: 100, mobKills: 90, distanceWalkedCm: 900000 },
  c: { blocksMined: 900, mobKills: 1, distanceWalkedCm: 10 },
};

async function mockStats(page, { fail = false } = {}) {
  await page.route(`${DATA}/**`, (route) => {
    if (fail) return route.fulfill({ status: 503, body: '' });
    const url = route.request().url();
    const json = (b) => route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
    if (url.endsWith('/meta.json')) return json({ generatedAtEpochMs: Date.now() - 5 * 60000, playerCount: 3 });
    if (url.endsWith('/players.json')) return json(roster);
    const id = url.match(/player\/(\w+)\.json/)?.[1];
    return json({ ...roster.find((p) => p.uuid === id), ...detail[id] });
  });
  await page.route('https://mc-heads.net/**', (r) => r.fulfill({ status: 404, body: '' }));
}

test.describe('/jerkcraft', () => {
  test('scoreboard ranks players per board, from the server data', async ({ page }) => {
    await mockStats(page);
    await page.goto('/jerkcraft/');
    await expect(page.locator('[data-stats]')).toHaveAttribute('data-loaded', 'true');
    await expect(page.locator('[data-k="players"]')).toHaveText('3');
    await expect(page.locator('[data-k="hours"]')).toHaveText('135');
    await expect(page.locator('[data-k="online"]')).toHaveText('1');
    const names = () => page.locator('.mc-board .mc-name').evaluateAll((ns) => ns.map((n) => n.firstChild.textContent));
    expect(await names()).toEqual(['Bravo', 'Alpha', '.BedrockC']);
    await page.getByRole('tab', { name: 'Blocks mined' }).click();
    expect(await names()).toEqual(['.BedrockC', 'Alpha', 'Bravo']);
    await expect(page.getByRole('tab', { name: 'Blocks mined' })).toHaveAttribute('aria-selected', 'true');
    // Arrow keys move between tabs.
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Mob kills' })).toBeFocused();
    expect(await names()).toEqual(['Bravo', 'Alpha', '.BedrockC']);
    // Deaths skips players with none.
    await page.getByRole('tab', { name: 'Deaths' }).click();
    expect(await names()).toEqual(['Bravo', 'Alpha']);
    // Bedrock players don't get a Java skin request.
    await page.getByRole('tab', { name: 'Playtime' }).click();
    const srcs = await page.locator('.mc-head').evaluateAll((is) => is.map((i) => i.getAttribute('src')));
    expect(srcs[2]).toBeNull();
    await expect(page.locator('[data-updated]')).toContainText('5 min ago');
  });

  test('says so when the scoreboard is unreachable', async ({ page }) => {
    await mockStats(page, { fail: true });
    await page.goto('/jerkcraft/');
    await expect(page.locator('[data-stats]')).toHaveAttribute('data-loaded', 'error');
    await expect(page.locator('.mc-board')).toContainText('can’t be reached');
  });

  test('number keys jump along the hotbar', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'no keyboard on a phone');
    await mockStats(page);
    await page.goto('/jerkcraft/');
    await page.keyboard.press('3');
    await expect(page).toHaveURL(/#stats$/);
    await expect.poll(() => page.$eval('#stats', (s) => Math.abs(s.getBoundingClientRect().top)), { timeout: 3000 }).toBeLessThan(40);
    await expect(page.locator('[data-slot="stats"]')).toHaveAttribute('aria-current', 'true');
  });

  test('prints no server address', async ({ page }) => {
    await mockStats(page);
    await page.goto('/jerkcraft/');
    const html = await page.content();
    expect(html).not.toMatch(/ply\.gg|playit|\b\d{1,3}(\.\d{1,3}){3}\b|:\d{5}\b/);
  });
});

test.describe('/games', () => {
  test('every channel opens its preview, and it closes back to the tile', async ({ page }) => {
    await page.goto('/games/');
    const tiles = page.locator('.channel');
    await expect(tiles).toHaveCount(13);
    await tiles.nth(1).click();
    const dialog = page.locator('[data-preview]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h2')).toHaveText('Hot Potato');
    await expect(dialog).toContainText('2–4 players');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(tiles.nth(1)).toBeFocused();
  });

  test('the bar clock shows the time and the demos are real videos', async ({ page }) => {
    await page.goto('/games/');
    await expect(page.locator('[data-time]')).toHaveText(/^\d{1,2}:\d{2} [AP]M$/);
    for (const src of ['/media/gamehub.mp4', '/media/jukebox-live.mp4', '/media/gamehub.webp']) {
      const r = await page.request.get(src);
      expect(r.status(), src).toBe(200);
    }
    await expect(page.locator('#jukebox')).toBeVisible();
  });

  test('reduced motion stops the videos', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/games/');
    await page.waitForTimeout(500);
    const paused = await page.$$eval('video', (vs) => vs.map((v) => v.paused && v.controls));
    expect(paused).toEqual([true, true]);
  });
});

test.describe('/bot', () => {
  test('the board flips and settles on the real commands', async ({ page }) => {
    await page.goto('/bot/');
    const board = page.locator('[data-board]');
    await expect(board).toHaveAttribute('data-settled', 'true', { timeout: 8000 });
    const first = page.locator('tbody tr').first();
    await expect(first.locator('.c-dest')).toHaveText('Casino floor');
    const cells = await first.locator('.cell').allTextContents();
    expect(cells.join('')).toBe('/casino');
    await expect(page.locator('tbody tr')).toHaveCount(16);
  });

  test('lists no command that stays private', async ({ page }) => {
    await page.goto('/bot/');
    const text = await page.locator('body').innerText();
    for (const hidden of ['rothschild', 'schule_bild', 'ome_bild', 'zwanni', '/kill', '/reboot']) {
      expect(text.toLowerCase()).not.toContain(hidden);
    }
  });
});

test.describe('/abi', () => {
  test('pen marks draw as sections arrive, and the worked example adds up', async ({ page }) => {
    await page.goto('/abi/');
    await expect(page.locator('.title')).toHaveClass(/is-drawn/);
    const last = page.locator('[data-part]').last();
    await expect(last).not.toHaveClass(/is-drawn/);
    await last.scrollIntoViewIfNeeded();
    await expect(last).toHaveClass(/is-drawn/);
    await expect(page.locator('.boxed')).toHaveText('E: 2x₁ − x₂ + 3x₃ = 6');
  });

  test('stays pseudonymous: no school, state or year', async ({ page }) => {
    await page.goto('/abi/');
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/NRW|Nordrhein|20(2[5-9])|WebUntis|OneNote/);
  });
});

test('every project page leads back home', async ({ page }) => {
  for (const p of ['/jerkcraft/', '/games/', '/bot/', '/abi/']) {
    await page.goto(p);
    await expect(page.locator('a[href="/"]').first()).toBeVisible();
  }
});
