// Regenerates public/katex.css and public/fonts/katex/ from the installed
// KaTeX package: only the woff2 faces, pointed at our own font path.
// Run after bumping katex: `node scripts/vendor-katex.mjs`.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const dist = new URL('node_modules/katex/dist/', root);
const outFonts = fileURLToPath(new URL('public/fonts/katex/', root));

mkdirSync(outFonts, { recursive: true });
for (const f of readdirSync(fileURLToPath(new URL('fonts/', dist)))) {
  if (f.endsWith('.woff2')) copyFileSync(fileURLToPath(new URL(`fonts/${f}`, dist)), `${outFonts}${f}`);
}

const version = JSON.parse(readFileSync(fileURLToPath(new URL('node_modules/katex/package.json', root)), 'utf8')).version;
let css = readFileSync(fileURLToPath(new URL('katex.min.css', dist)), 'utf8');
css = css.replace(/@font-face\{[^}]*\}/g, (face) => {
  const woff2 = face.match(/url\(fonts\/([\w-]+\.woff2)\)\s*format\("woff2"\)/);
  return woff2 ? face.replace(/src:[^;}]+/, `src:url(/fonts/katex/${woff2[1]}) format("woff2")`) : face;
});
writeFileSync(
  fileURLToPath(new URL('public/katex.css', root)),
  `/* KaTeX ${version}, MIT. Generated from node_modules by scripts/vendor-katex.mjs. */\n${css}`,
);
console.log(`katex.css written for ${version}`);
