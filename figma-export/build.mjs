// Builds figma-export/index.html: one offline page showing every screen, ready for html.to.design capture.
// Usage: node figma-export/build.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const screensDir = join(here, 'screens');
const screens = readdirSync(screensDir)
  .filter((f) => f.endsWith('.dc.html'))
  .map((file) => ({ file, src: readFileSync(join(screensDir, file), 'utf8') }));
const css = readFileSync(join(screensDir, 'shared.css'), 'utf8');
// keep the embedded JSON from closing its <script> tag early
const json = JSON.stringify(screens).replace(/</g, '\\u003c');

const out = readFileSync(join(here, 'template.html'), 'utf8')
  .replace('/*SHARED_CSS*/', () => css)
  .replace('/*SCREENS_JSON*/', () => json);

writeFileSync(join(here, 'index.html'), out);
console.log(`Wrote figma-export/index.html with ${screens.length} screens`);
