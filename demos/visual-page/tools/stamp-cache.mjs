#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const checkOnly = process.argv.includes('--check');
const audioURL = new URL('../audio.js', import.meta.url);
const appURL = new URL('../app.js', import.meta.url);
const styleURL = new URL('../style.css', import.meta.url);
const indexURL = new URL('../index.html', import.meta.url);

const digest = (bytes) => createHash('md5').update(bytes).digest('hex').slice(0, 10);

function replaceExactly(source, pattern, replacement, label) {
  let count = 0;
  const result = source.replace(pattern, (...args) => {
    count++;
    return replacement(...args);
  });
  if (count !== 1) throw new Error(`expected one ${label} cache reference, found ${count}`);
  return result;
}

const i18nVersion = digest(await readFile(new URL('../i18n.js', import.meta.url)));
const audioBytes = await readFile(audioURL);
const audioVersion = digest(audioBytes);
const appSource = await readFile(appURL, 'utf8');
let stampedApp = replaceExactly(
  appSource,
  /(\.\/audio\.js)(?:\?v=[^']*)?(')/g,
  (_match, path, quote) => `${path}?v=${audioVersion}${quote}`,
  'audio.js',
);

stampedApp = replaceExactly(stampedApp, /(\.\/i18n\.js)(?:\?v=[^']*)?(')/g,
  (_match, path, quote) => `${path}?v=${i18nVersion}${quote}`, 'i18n.js');

const appVersion = digest(Buffer.from(stampedApp));
const styleVersion = digest(await readFile(styleURL));
const indexSource = await readFile(indexURL, 'utf8');
let stampedIndex = replaceExactly(
  indexSource,
  /(src="app\.js)(?:\?v=[^"]*)?(")/g,
  (_match, path, quote) => `${path}?v=${appVersion}${quote}`,
  'app.js',
);
stampedIndex = replaceExactly(
  stampedIndex,
  /(href="style\.css)(?:\?v=[^"]*)?(")/g,
  (_match, path, quote) => `${path}?v=${styleVersion}${quote}`,
  'style.css',
);

// Keep the shared FX module on the exact token produced by Housing's build.
const housingIndex = await readFile(new URL('../../china-housing/index.html', import.meta.url), 'utf8');
const housingVersion = housingIndex.match(/src="assets\/js\/i18n\.js\?v=([a-f0-9]+)"/)?.[1];
if (!housingVersion) throw new Error('Housing i18n cache token missing; stamp Housing first');
stampedIndex = replaceExactly(stampedIndex, /(src="\.\.\/china-housing\/assets\/js\/i18n\.js)(?:\?v=[^"]*)?(")/g,
  (_m, path, quote) => `${path}?v=${housingVersion}${quote}`, 'Housing i18n.js');

if (checkOnly) {
  if (stampedApp !== appSource || stampedIndex !== indexSource) {
    throw new Error(`cache tokens stale; run node ${new URL(import.meta.url).pathname}`);
  }
} else {
  if (stampedApp !== appSource) await writeFile(appURL, stampedApp);
  if (stampedIndex !== indexSource) await writeFile(indexURL, stampedIndex);
}

console.log(`PASS: style.css?v=${styleVersion} audio.js?v=${audioVersion} → app.js?v=${appVersion}${checkOnly ? ' (checked)' : ' (stamped)'}`);
