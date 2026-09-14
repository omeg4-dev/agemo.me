import { defineConfig, devices } from '@playwright/test';

// The port is a variable, not three hardcoded copies.
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
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
  webServer: {
    command: `npx astro preview --port ${PORT}`,
    url: BASE,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
