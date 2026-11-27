// Run before every deploy: `npm run bump`.
// Stamps a fresh ?v= on every local script, stylesheet and import, and writes
// version.json. Phones holding an older cached copy see the new version number
// and hop onto it (see the update check at the top of app.js).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const v = Date.now().toString(36);

for (const f of readdirSync(root).filter((n) => /\.(js|html)$/.test(n))) {
  const path = join(root, f);
  const src = readFileSync(path, 'utf8');
  const out = f.endsWith('.html')
    ? src.replace(/(href|src)="([\w-]+\.(?:js|css))(?:\?v=\w+)?"/g, `$1="$2?v=${v}"`)
    : src.replace(/(['"])\.\/([\w-]+\.(?:js|css))(?:\?v=\w+)?\1/g, `$1./$2?v=${v}$1`);
  if (out !== src) writeFileSync(path, out);
}
writeFileSync(join(root, 'version.json'), `${JSON.stringify({ v })}\n`);
console.log(`version ${v}`);
