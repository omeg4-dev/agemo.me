import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://agemo.me',
  output: 'static',
  build: { inlineStylesheets: 'auto' },
});
