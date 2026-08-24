#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';

const checkOnly = process.argv.includes('--check');
const root = new URL('../', import.meta.url);
const cssURL = new URL('assets/css/tailwind-built.css', root);
const indexURL = new URL('index.html', root);
const cssVersion = createHash('sha256')
  .update(await readFile(cssURL))
  .digest('hex')
  .slice(0, 10);

const assetHash = createHash('sha1');
for (const directory of ['assets/data/', 'assets/js/']) {
  const dirURL = new URL(directory, root);
  const files = (await readdir(dirURL)).filter((name) => name.endsWith('.js')).sort();
  for (const name of files) assetHash.update(await readFile(new URL(name, dirURL)));
}
const assetVersion = assetHash.digest('hex').slice(0, 10);

const source = await readFile(indexURL, 'utf8');
let cssMatches = 0;
let stamped = source.replace(
  /(href="assets\/css\/tailwind-built\.css)(?:\?v=[^"]*)?(")/g,
  (_match, path, quote) => {
    cssMatches += 1;
    return `${path}?v=${cssVersion}${quote}`;
  },
);
let assetMatches = 0;
stamped = stamped.replace(
  /(src="assets\/(?:data|js)\/[^"?]+\.js)(?:\?v=[^"]*)?(")/g,
  (_match, path, quote) => {
    assetMatches += 1;
    return `${path}?v=${assetVersion}${quote}`;
  },
);

if (cssMatches !== 1) throw new Error(`expected one Tailwind CSS reference, found ${cssMatches}`);
if (!assetMatches) throw new Error('expected at least one local JS/data reference');
if (checkOnly && stamped !== source) throw new Error('CSS or local asset cache token is stale; run npm run build:css');
if (!checkOnly && stamped !== source) await writeFile(indexURL, stamped);

console.log(`PASS: tailwind-built.css=${cssVersion} local-assets=${assetVersion} (${assetMatches} tags)${checkOnly ? ' (checked)' : ' (stamped)'}`);
