import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
const S = '/tmp/claude-1000/-home-omega/8d64af29-7bfc-4ba6-81ef-ef23b810aa86/scratchpad';
const srv = spawn('npx', ['astro', 'preview', '--port', '4393'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => console.log('pageerror', e.message));
await pg.goto('http://localhost:4393/text/', { waitUntil: 'networkidle' });
await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(800);
for (const [tag, neat] of [['neat', '95'], ['mid', '55'], ['scrawl', '5']]) {
  await pg.fill('#neat', neat).catch(() => {});
  await pg.$eval('#neat', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, neat);
  await pg.waitForTimeout(400);
  const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 20000 }), pg.click('[data-save]')]);
  await dl.saveAs(`${S}/export-${tag}.png`);
  console.log(tag, 'exported', await pg.getAttribute('[data-tool]', 'data-exported'));
}
await b.close(); srv.kill();
