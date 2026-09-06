import { defineConfig, devices } from '@playwright/test';

// The port is a variable, not three hardcoded copies. A stray preview server
// left over from an earlier run used to collide with a fixed 4321 and the
// documented workaround (`npm run preview -- --port N`) is a silent no-op,
// because the npm script already passes its own --port and astro keeps the
// first one. Invoking astro directly is what makes the override real.
const PORT = Number(process.env.PREVIEW_PORT ?? 4321);
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.mjs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE,
    trace: 'off',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] } } },
  ],
  webServer: {
    command: `npx astro preview --port ${PORT}`,
    url: BASE,
    // Never reuse. Reusing meant a server started against an older dist/ kept
    // serving it, so mutations to src/ appeared to change nothing and every
    // mutation test reported a false green. A port collision failing loudly is
    // strictly better than a suite silently testing yesterday's build.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
