#!/usr/bin/env node
'use strict';
/** Regenerate district romanizations in assets/data/geo-en.js (no CJK in EN labels). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pinyin } = require('pinyin');
// This pinyin build has no numeric STYLE_NORMAL constant (Pinyin.STYLE_NORMAL===undefined →
// style:undefined falls back to TONED output). The string 'normal' is the tone-free style.
const STYLE_NORMAL = 'normal';

const ROOT = path.resolve(__dirname, '..');
const run = (f) => {
  const s = { window: {} };
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), vm.createContext(s));
  return s.window;
};

const listings = run('assets/data/listings.js').HOUSING_LISTINGS || [];
const G = run('assets/data/geo-en.js').HOUSING_GEO_EN;

const distSet = new Set(listings.map((r) => r.dist).filter(Boolean));
// NB: no ['城区', ' urban area'] rule — it misfires on names like 防城区/海城区 (防城|区, not
// 防|城区), eating the 城. Plain ['区',' District'] yields "Fang Cheng District". (HEAD used
// 'urban area' 0×, so dropping it is safe.)
const SUFFIX = [
  ['度假区', ' Resort'], ['街道', ' Subdistrict'], ['片区', ' area'],
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

// ADDITIVE-ONLY: preserve existing hand-tuned entries (heteronyms like 六安→Lu'an, 厦门→Xiamen
// that blind pinyin gets wrong); only fill MISSING / CJK-tainted keys with tone-free pinyin.
const district = Object.assign({}, G.district || {});
[...distSet].sort((a, b) => a.localeCompare(b, 'zh')).forEach((d) => {
  if (!district[d] || /[一-鿿]/.test(district[d])) district[d] = romanize(d);
});

const bad = Object.values(district).filter((v) => /[\u4e00-\u9fff]/.test(v));
if (bad.length) {
  console.error('Still have CJK in', bad.length, 'district labels:', bad.slice(0, 5));
  process.exit(1);
}

G.district = district;

// City labels: concatenated-pinyin style ("七台河市"→"Qitaihe"), composites split on
// "-"/"－" and joined ("红河州-个旧市"→"Honghe-Gejiu"). Only fill MISSING / CJK-tainted
// keys — preserve existing hand-tuned romanizations (159 baseline).
function romanizeCityPart(zh) {
  const base = zh.replace(/(自治州|地区|自治县|市|县|区|州|盟)$/, '');
  const core = pinyin(base.replace(/\s+/g, ''), { style: STYLE_NORMAL, heteronym: false })
    .map((p) => p[0] || '').filter(Boolean).join('');
  return core ? core.charAt(0).toUpperCase() + core.slice(1) : zh;
}
function romanizeCity(zh) {
  return zh.split(/\s*[-－]\s*/).map(romanizeCityPart).join('-');
}
const cityMap = Object.assign({}, G.city || {});
new Set(listings.map((r) => r.city).filter(Boolean)).forEach((c) => {
  if (!cityMap[c] || /[一-鿿]/.test(cityMap[c])) cityMap[c] = romanizeCity(c);
});
const badCity = Object.entries(cityMap).filter(([, v]) => /[一-鿿]/.test(v));
if (badCity.length) {
  console.error('Still have CJK in', badCity.length, 'city labels:', badCity.slice(0, 5));
  process.exit(1);
}
G.city = cityMap;

const body = `/** Geographic English / romanized labels for EN UI. GENERATED — do not hand-edit. */\nwindow.HOUSING_GEO_EN = ${JSON.stringify(G, null, 2)};\n`;
fs.writeFileSync(path.join(ROOT, 'assets/data/geo-en.js'), body);
console.log('geo-en.js districts:', Object.keys(district).length, 'cities:', Object.keys(cityMap).length, '— all CJK-free');
