import { defineConfig } from 'astro/config';
import { execSync } from 'node:child_process';

function sha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch { return 'local'; }
}

export default defineConfig({
  site: 'https://agemo.me',
  output: 'static',
  build: { inlineStylesheets: 'auto' },
  vite: {
    define: {
      __BUILD_SHA__: JSON.stringify(sha()),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  },
});
