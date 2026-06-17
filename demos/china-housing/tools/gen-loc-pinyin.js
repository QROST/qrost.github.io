#!/usr/bin/env node
'use strict';
/** Regenerate assets/data/loc-pinyin.js from listings.js + manual EN overrides. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pinyin } = require('pinyin');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets/data/loc-pinyin.js');

const MANUAL = {
  '侨鑫汇悦台': 'KWG Grand Mansion',
  '深圳湾1号': 'One Shenzhen Bay',
  '汤臣一品': 'Tomson Riviera',
  '翠湖天地六和': 'Lakeville Phase VI',
  '天玺': 'The Cullinan',
  '地利根德阁': 'Tregunter',
  '傲璇': 'Opus Hong Kong',
  '府都Double1': 'Fudu Double1',
  '90293': '90293',
  '94089': '94089',
  'Savoy': 'Savoy',
  'Colony Park': 'Colony Park',
  'D+公寓': 'D + Gong Yu',
};

function titleCaseSyllables(str) {
  return pinyin(str, { style: pinyin.STYLE_NORMAL })
    .map((a) => {
      const w = a[0] || '';
      if (/^\d+$/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

/** Split loc into CJK runs, digit runs, and other tokens. */
function tokenizeLoc(loc) {
  const tokens = [];
  let buf = '';
  let kind = null;
  const flush = () => {
    if (buf) tokens.push({ kind, text: buf });
    buf = '';
    kind = null;
  };
  for (const ch of loc) {
    const k = /[\u4e00-\u9fff]/.test(ch) ? 'cjk'
      : /\d/.test(ch) ? 'digit'
        : /[A-Za-z]/.test(ch) ? 'latin'
          : 'sym';
    if (kind !== k) flush();
    kind = k;
    buf += ch;
  }
  flush();
  return tokens;
}

function romanizeLoc(loc) {
  if (MANUAL[loc]) return MANUAL[loc];
  if (!/[\u4e00-\u9fff]/.test(loc)) return loc;
  const parts = [];
  for (const { kind, text } of tokenizeLoc(loc)) {
    if (kind === 'cjk') parts.push(titleCaseSyllables(text));
    else if (kind === 'digit') parts.push(text.split('').join(' '));
    else if (kind === 'latin') parts.push(text);
    else if (text === '（' || text === '(') parts.push('（');
    else if (text === '）' || text === ')') parts.push('）');
    else if (text === '·') parts.push('·');
    else if (text.trim()) parts.push(text.trim());
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

const box = { window: {} };
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/data/listings.js'), 'utf8'), box);
const locs = [...new Set((box.window.HOUSING_LISTINGS || []).map((r) => r.loc).filter(Boolean))].sort();

const map = {};
for (const loc of locs) map[loc] = romanizeLoc(loc);
Object.assign(map, MANUAL);

const lines = ['// Auto-maintained romanization for EN table cells (loc names).',
  '// Regenerate: node tools/gen-loc-pinyin.js',
  'window.HOUSING_LOC_PINYIN = {'];
for (const loc of Object.keys(map).sort()) {
  const py = map[loc].replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  lines.push(`  "${loc.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}": "${py}",`);
}
lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '');
lines.push('};', '');
fs.writeFileSync(OUT, lines.join('\n'));

const zhRe = /[\u4e00-\u9fff]/;
const bad = Object.entries(map).filter(([, v]) => zhRe.test(v));
if (bad.length) {
  console.error('CJK left in pinyin:', bad.slice(0, 10));
  process.exit(1);
}
console.log(`✓ wrote ${locs.length} loc entries → ${path.relative(ROOT, OUT)}`);
