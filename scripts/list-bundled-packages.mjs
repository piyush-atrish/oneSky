// Rebuilds scripts/bundled-packages.json from the Android release bundle's source map.
// Run from the repo root after the export below, then run generate-notices.mjs:
//
//   npx expo export --platform android --output-dir dist --dump-sourcemap --no-minify
//   node scripts/list-bundled-packages.mjs
//   node scripts/generate-notices.mjs
//
// Use it whenever dependencies change (for example after an Expo SDK upgrade).
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join('dist', '_expo', 'static', 'js', 'android');
if (!existsSync(dir)) throw new Error(`${dir} not found. Run the expo export command shown at the top of this file first.`);
const mapFile = readdirSync(dir).find((f) => f.endsWith('.map'));
if (!mapFile) throw new Error(`No .map file in ${dir}. Make sure --dump-sourcemap was used.`);

const map = JSON.parse(readFileSync(join(dir, mapFile), 'utf8'));
// Record the package DIRECTORY of every bundled file, so packages nested inside another package's own
// node_modules folder (for example node_modules/react-native/node_modules/scheduler) are found too.
const dirs = new Set();
for (const source of map.sources) {
  const i = source.lastIndexOf('node_modules/');
  if (i < 0) continue;
  const after = source.slice(i + 'node_modules/'.length).split('/');
  const name = after[0].startsWith('@') ? `${after[0]}/${after[1]}` : after[0];
  dirs.add(source.slice(0, i + 'node_modules/'.length).replace(/^[\\/]+/, '') + name);
}
const sorted = [...dirs].sort();
writeFileSync(new URL('./bundled-packages.json', import.meta.url), JSON.stringify(sorted, null, 1) + '\n');
console.log(`${sorted.length} package folders found in ${mapFile} (${map.sources.length} source files). Wrote scripts/bundled-packages.json`);
