#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const checkOnly = process.argv.includes('--check');
const base = new URL('../', import.meta.url);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex').slice(0, 10);
const read = (name) => readFile(new URL(name, base));
const replaceOne = (source, pattern, replacement, label) => {
  let count = 0;
  const output = source.replace(pattern, (...args) => { count++; return replacement(...args); });
  if (count !== 1) throw new Error(`expected one ${label} reference, found ${count}`);
  return output;
};

const i18nVersion = digest(await read('i18n.js'));
const audioVersion = digest(await read('audio-club.js'));
const cssVersion = digest(await read('style-club.css'));
const appURL = new URL('app-club.js', base);
const appSource = await readFile(appURL, 'utf8');
let stampedApp = replaceOne(appSource, /(\.\/i18n\.js)(?:\?v=[^']*)?(')/g,
  (_m, name, quote) => `${name}?v=${i18nVersion}${quote}`, 'i18n.js');
stampedApp = replaceOne(stampedApp, /(\.\/audio-club\.js)(?:\?v=[^']*)?(')/g,
  (_m, name, quote) => `${name}?v=${audioVersion}${quote}`, 'audio-club.js');
const appVersion = digest(Buffer.from(stampedApp));

const indexURL = new URL('index.html', base);
const indexSource = await readFile(indexURL, 'utf8');
let stampedIndex = replaceOne(indexSource, /(href="style-club\.css)(?:\?v=[^"]*)?(")/g,
  (_m, name, quote) => `${name}?v=${cssVersion}${quote}`, 'style-club.css');
stampedIndex = replaceOne(stampedIndex, /(src="app-club\.js)(?:\?v=[^"]*)?(")/g,
  (_m, name, quote) => `${name}?v=${appVersion}${quote}`, 'app-club.js');

if (checkOnly && (stampedApp !== appSource || stampedIndex !== indexSource)) throw new Error('cache tokens stale; run tools/stamp-cache.mjs');
if (!checkOnly) {
  if (stampedApp !== appSource) await writeFile(appURL, stampedApp);
  if (stampedIndex !== indexSource) await writeFile(indexURL, stampedIndex);
}
console.log(`PASS: css=${cssVersion} i18n=${i18nVersion} audio=${audioVersion} app=${appVersion}${checkOnly ? ' (checked)' : ' (stamped)'}`);
