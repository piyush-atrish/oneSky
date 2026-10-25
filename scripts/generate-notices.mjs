// Phase 3: builds src/data/thirdPartyNotices.ts from the packages that are actually bundled into the app.
// Run from the repo root after `npm ci`:   node scripts/generate-notices.mjs
//
// scripts/bundled-packages.json lists the JavaScript packages found in the Android release bundle
// (see "How the list was made" in docs/LICENSES-AUDIT.md). Re-create it whenever dependencies change:
//   npx expo export --platform android --dump-sourcemap --no-minify   then list the node_modules entries in the .map
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'src/data/thirdPartyNotices.ts';
const entries = JSON.parse(readFileSync(new URL('./bundled-packages.json', import.meta.url), 'utf8'));
// Each entry is a package folder such as "node_modules/react-native/node_modules/scheduler" (a bare package name also works).

const norm = (t) => t.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
const isCopyrightLine = (l) => /^\s*(copyright|\(c\)|©)/i.test(l);
const isTitleLine = (l) => /^\s*(the\s+)?mit\s+license\s*$/i.test(l);

// Standard texts (copyright line removed). Anything whose LICENSE file differs is kept in full instead.
const STANDARD = {
  MIT: `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`,
};
const squash = (t) => norm(t).replace(/\s+/g, ' ');

// Packages that are published to npm without a licence file. Their upstream repositories carry the standard MIT
// licence, with these copyright lines (read from each repository's LICENSE file on 2026-10-24):
//   github.com/react/react-native  - Copyright (c) Meta Platforms, Inc. and affiliates.
//   github.com/react/metro         - Copyright (c) Meta Platforms, Inc. and affiliates.
//   github.com/pmndrs/react-three-fiber - Copyright (c) 2019-2025 Poimandres
//   github.com/cosinekitty/astronomy    - Copyright (c) 2019-2025 Don Cross <cosinekitty@gmail.com>
const UPSTREAM_MIT = {
  '@react-native/assets-registry': 'Copyright (c) Meta Platforms, Inc. and affiliates.',
  '@react-native/asset-utils': 'Copyright (c) Meta Platforms, Inc. and affiliates.',
  '@react-native/js-polyfills': 'Copyright (c) Meta Platforms, Inc. and affiliates.',
  '@react-native/normalize-colors': 'Copyright (c) Meta Platforms, Inc. and affiliates.',
  '@react-native/virtualized-lists': 'Copyright (c) Meta Platforms, Inc. and affiliates.',
  'metro-runtime': 'Copyright (c) Meta Platforms, Inc. and affiliates.',
  '@react-three/fiber': 'Copyright (c) 2019-2025 Poimandres',
  'astronomy-engine': 'Copyright (c) 2019-2025 Don Cross <cosinekitty@gmail.com>',
};

function findLicenseFile(dir) {
  const f = readdirSync(dir).find((n) => /^(licen[sc]e|copying|notice)(\.(md|txt))?$/i.test(n));
  return f ? join(dir, f) : null;
}
function findPackageDir(entry) {
  const p = entry.startsWith('node_modules/') ? entry : join('node_modules', entry);
  return existsSync(join(p, 'package.json')) ? p : null;
}

const notices = [];
const fullTexts = {}; // key -> text, for packages whose licence text is not the standard MIT text
const problems = [];

const seen = new Set();
for (const entry of entries) {
  const dir = findPackageDir(entry);
  if (!dir) { problems.push(`${entry}: folder not found (run npm ci, then the export and list steps again)`); continue; }
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const name = pkg.name;
  if (seen.has(`${name}@${pkg.version}`)) continue; // same package and version bundled from two places
  seen.add(`${name}@${pkg.version}`);
  const license = typeof pkg.license === 'object' ? pkg.license.type : pkg.license ?? 'UNKNOWN';
  const file = findLicenseFile(dir);
  const raw = file ? readFileSync(file, 'utf8') : '';
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const copyright = lines.filter(isCopyrightLine).slice(0, 3).map((l) => l.trim()).join(' / ')
    || UPSTREAM_MIT[name]
    || (pkg.author ? `Copyright ${typeof pkg.author === 'string' ? pkg.author : pkg.author.name}` : '');
  if (!copyright) problems.push(`${name}: no copyright line found`);
  // Font packages ship a second file (LICENSE_FONT) with the licence of the fonts themselves (SIL OFL 1.1).
  const fontFile = readdirSync(dir).find((n) => /^licen[sc]e_font(\.(md|txt))?$/i.test(n));
  const fontRaw = fontFile ? readFileSync(join(dir, fontFile), 'utf8') : '';
  let textKey = null;
  if (license === 'MIT' && !fontRaw) {
    const body = norm(lines.filter((l) => !isCopyrightLine(l) && !isTitleLine(l)).join('\n'));
    if (squash(body) === squash(STANDARD.MIT)) textKey = 'MIT';
  }
  if (!textKey && !raw && license === 'MIT' && UPSTREAM_MIT[name]) textKey = 'MIT';
  if (!textKey) {
    if (!raw) problems.push(`${name}: no licence file found`);
    textKey = `${name}@${pkg.version}`;
    fullTexts[textKey] = norm(raw) + (fontRaw ? `\n\n----------\nFont licence (${fontFile}):\n\n${norm(fontRaw)}` : '');
  }
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? pkg.homepage ?? '';
  const fontCopyright = fontRaw.replace(/\r\n/g, '\n').split('\n').filter(isCopyrightLine).slice(0, 1).map((l) => l.trim());
  notices.push({ name: pkg.name, version: pkg.version, license, copyright: [copyright, ...fontCopyright.map((c) => `Fonts: ${c}`)].filter(Boolean).join(' / '), textKey, url: repo.replace(/^git\+/, '').replace(/\.git$/, '') });
}

notices.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
const texts = { MIT: STANDARD.MIT, ...fullTexts };
const used = new Set(notices.map((n) => n.textKey));
for (const k of Object.keys(texts)) if (!used.has(k)) delete texts[k];

const out = `/**
 * AUTO-GENERATED by scripts/generate-notices.mjs. Do not edit by hand.
 * Licence notices for the open-source JavaScript packages bundled into oneSky.
 * Packages with the standard MIT text share one copy of it ("MIT"); every other licence text is stored in full.
 */
export interface Notice {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly copyright: string;
  /** Key into LICENSE_TEXTS. */
  readonly textKey: string;
  readonly url: string;
}

export const NOTICES: readonly Notice[] = ${JSON.stringify(notices, null, 2)};

export const LICENSE_TEXTS: Readonly<Record<string, string>> = ${JSON.stringify(texts, null, 2)};
`;
writeFileSync(OUT, out);
console.log(`Wrote ${notices.length} notices and ${Object.keys(texts).length} licence texts to ${OUT}`);

// Licence mix, and a warning for anything that is not on the permissive allow-list.
const ALLOWED = /^(MIT|ISC|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|0BSD|CC0-1\.0|Unlicense|OFL-1\.1|MIT AND OFL-1\.1)$/;
const mix = {};
for (const n of notices) mix[n.license] = (mix[n.license] ?? 0) + 1;
console.log('Licence mix:', Object.entries(mix).map(([k, v]) => `${v} ${k}`).join(', '));
const review = notices.filter((n) => !ALLOWED.test(n.license));
if (review.length) {
  console.warn('REVIEW these licences before release (not on the permissive allow-list):\n - ' +
    review.map((n) => `${n.name}@${n.version}: ${n.license}`).join('\n - '));
  process.exitCode = 1;
}
if (problems.length) { console.warn('Check these:\n - ' + problems.join('\n - ')); process.exitCode = 1; }
