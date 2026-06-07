#!/usr/bin/env node
'use strict';
/** Regenerate district romanizations in assets/data/geo-en.js (no CJK in EN labels). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pinyin, Pinyin } = require('pinyin');
const STYLE_NORMAL = Pinyin ? Pinyin.STYLE_NORMAL : 0;

const ROOT = path.resolve(__dirname, '..');
const run = (f) => {
  const s = { window: {} };
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), vm.createContext(s));
  return s.window;
};

const listings = run('assets/data/listings.js').HOUSING_LISTINGS || [];
const G = run('assets/data/geo-en.js').HOUSING_GEO_EN;

const distSet = new Set(listings.map((r) => r.dist).filter(Boolean));
const SUFFIX = [
  ['度假区', ' Resort'], ['街道', ' Subdistrict'], ['城区', ' urban area'], ['片区', ' area'],
  ['半岛', ' Peninsula'], ['小镇', ' Town'], ['广场', ' Plaza'], ['区', ' District'],
  ['县', ' County'], ['市', ' City'], ['镇', ' Town'], ['乡', ' Township'], ['村', ' Village'],
];

function syllables(text) {
  return pinyin(text, { style: STYLE_NORMAL, heteronym: false })
    .map((p) => {
      const w = p[0] || '';
      return w ? w.charAt(0).toUpperCase() + w.slice(1) : '';
    })
    .filter(Boolean)
    .join(' ');
}

function romanize(zh) {
  if (!zh) return zh;
  if (/[\/／]/.test(zh)) {
    return zh.split(/\s*[\/／]\s*/).map(romanize).join(' / ');
  }
  let base = zh;
  let suf = '';
  for (const [k, v] of SUFFIX) {
    if (zh.endsWith(k)) { base = zh.slice(0, -k.length); suf = v; break; }
  }
  const core = syllables(base.replace(/\s+/g, ''));
  const out = (core + suf).trim();
  return /[\u4e00-\u9fff]/.test(out) ? syllables(zh.replace(/\s+/g, '')) : out;
}

const district = {};
[...distSet].sort((a, b) => a.localeCompare(b, 'zh')).forEach((d) => { district[d] = romanize(d); });
Object.keys(G.district || {}).forEach((k) => { if (!district[k]) district[k] = romanize(k); });

const bad = Object.values(district).filter((v) => /[\u4e00-\u9fff]/.test(v));
if (bad.length) {
  console.error('Still have CJK in', bad.length, 'district labels:', bad.slice(0, 5));
  process.exit(1);
}

G.district = district;
const body = `/** Geographic English / romanized labels for EN UI. GENERATED — do not hand-edit. */\nwindow.HOUSING_GEO_EN = ${JSON.stringify(G, null, 2)};\n`;
fs.writeFileSync(path.join(ROOT, 'assets/data/geo-en.js'), body);
console.log('geo-en.js districts:', Object.keys(district).length, '— all CJK-free');
