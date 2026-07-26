#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const checkOnly = process.argv.includes('--check');
const audioURL = new URL('../audio.js', import.meta.url);
const appURL = new URL('../app.js', import.meta.url);
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

const audioBytes = await readFile(audioURL);
const audioVersion = digest(audioBytes);
const appSource = await readFile(appURL, 'utf8');
const stampedApp = replaceExactly(
  appSource,
  /(\.\/audio\.js)(?:\?v=[^']*)?(')/g,
  (_match, path, quote) => `${path}?v=${audioVersion}${quote}`,
  'audio.js',
);

const appVersion = digest(Buffer.from(stampedApp));
const indexSource = await readFile(indexURL, 'utf8');
const stampedIndex = replaceExactly(
  indexSource,
  /(src="app\.js)(?:\?v=[^"]*)?(")/g,
  (_match, path, quote) => `${path}?v=${appVersion}${quote}`,
  'app.js',
);

if (checkOnly) {
  if (stampedApp !== appSource || stampedIndex !== indexSource) {
    throw new Error(`cache tokens stale; run node ${new URL(import.meta.url).pathname}`);
  }
} else {
  if (stampedApp !== appSource) await writeFile(appURL, stampedApp);
  if (stampedIndex !== indexSource) await writeFile(indexURL, stampedIndex);
}

console.log(`PASS: audio.js?v=${audioVersion} → app.js?v=${appVersion}${checkOnly ? ' (checked)' : ' (stamped)'}`);
