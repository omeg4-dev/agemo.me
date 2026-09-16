import { defineConfig, devices, firefox } from '@playwright/test';
import fs from 'node:fs';

const PORT = Number(process.env.PREVIEW_PORT ?? 4321);
const BASE = `http://localhost:${PORT}`;

const projects = [
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
];

// Add Firefox when enabled and installed
if (process.env.CI_FIREFOX !== '0') {
  try {
    if (fs.existsSync(firefox.executablePath())) {
      projects.push({
        name: 'firefox',
        use: {
          ...devices['Desktop Firefox'],
          viewport: { width: 1440, height: 900 },
        },
      });
    }
  } catch {}
}

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.mjs',
  grepInvert: process.env.SHOTS === '1' ? undefined : /@shots/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE,
    trace: 'off',
  },
  projects,
  webServer: {
    command: `npx astro preview --port ${PORT}`,
    url: BASE,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
