#!/usr/bin/env node
/**
 * One-off analysis: extreme-day count sensitivity to cold/heat thresholds.
 * Reads assets/data/enriched.js + listings.js — no code changes to product.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function loadGlobal(file, varName) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const m = src.match(new RegExp(`window\\.${varName}\\s*=\\s*([\\s\\S]+?);\\s*$`));
  if (!m) throw new Error(`Cannot parse ${varName} from ${file}`);
  return eval(`(${m[1]})`);
}

const enriched = loadGlobal('assets/data/enriched.js', 'HOUSING_ENRICHED');
const listings = loadGlobal('assets/data/listings.js', 'HOUSING_LISTINGS');
const byId = Object.fromEntries(listings.map((r) => [String(r.id), r]));

function countExtreme(curve, coldFn, heatFn) {
  const tm = curve.tmean;
  const tx = curve.tmax;
  let cold = 0;
  let heat = 0;
  let total = 0;
  for (let i = 0; i < 365; i++) {
    const isCold = coldFn(tm[i]);
    const isHeat = heatFn(tx[i]);
    if (isCold) cold++;
    if (isHeat) heat++;
    if (isCold || isHeat) total++;
  }
  return { total, cold, heat };
}

const coldThresholds = [
  { key: 'cold<0', label: 'tmean < 0 (current)', fn: (t) => t != null && t < 0 },
  { key: 'cold<-5', label: 'tmean < -5', fn: (t) => t != null && t < -5 },
  { key: 'cold<-10', label: 'tmean < -10', fn: (t) => t != null && t < -10 },
  { key: 'no-cold', label: 'no cold extreme', fn: () => false },
];

const heatThresholds = [
  { key: 'heat>=33', label: 'tmax >= 33 (current)', fn: (t) => t != null && t >= 33 },
  { key: 'heat>=30', label: 'tmax >= 30', fn: (t) => t != null && t >= 30 },
];

function stats(arr) {
  const a = [...arr].sort((x, y) => x - y);
  const n = a.length;
  const sum = a.reduce((s, v) => s + v, 0);
  const median = n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
  return {
    n,
    mean: sum / n,
    median,
    min: a[0],
    max: a[n - 1],
    p25: a[Math.floor(n * 0.25)],
    p75: a[Math.floor(n * 0.75)],
    zeros: a.filter((v) => v === 0).length,
  };
}

const ids = Object.keys(enriched).filter((id) => enriched[id].daily?.curve?.tmean);
console.log(`Listings with daily curve: ${ids.length}\n`);

// Baseline from baked data
const baseline = ids.map((id) => ({
  id,
  count: enriched[id].daily.extremeDayCount,
  meta: byId[id],
}));

const baselineStats = stats(baseline.map((b) => b.count));
console.log('=== BASELINE (baked in enriched.js) ===');
console.log(JSON.stringify(baselineStats, null, 2));

// Recompute current from curves (sanity check)
const currentRecomputed = ids.map((id) => {
  const c = enriched[id].daily.curve;
  return countExtreme(c, coldThresholds[0].fn, heatThresholds[0].fn).total;
});
const reStats = stats(currentRecomputed);
const mismatch = ids.filter((id, i) => enriched[id].daily.extremeDayCount !== currentRecomputed[i]).length;
console.log(`\nRecomputed current (curve): mean=${reStats.mean.toFixed(1)} median=${reStats.median} mismatches vs baked=${mismatch}`);

// All combos
const combos = [];
for (const cold of coldThresholds) {
  for (const heat of heatThresholds) {
    const rows = ids.map((id) => {
      const c = enriched[id].daily.curve;
      const { total, cold: cd, heat: hd } = countExtreme(c, cold.fn, heat.fn);
      return { id, total, cold: cd, heat: hd, meta: byId[id] };
    });
    const totals = rows.map((r) => r.total);
    const st = stats(totals);
    const fromZero = rows.filter((r) => {
      const base = enriched[ids[rows.indexOf(r)]]?.daily?.extremeDayCount;
      // fix: use id lookup
      return false;
    });
    combos.push({ cold, heat, rows, st });
  }
}

// Fix fromZero logic
function analyzeCombo(cold, heat) {
  const rows = ids.map((id) => {
    const c = enriched[id].daily.curve;
    const baked = enriched[id].daily.extremeDayCount;
    const { total, cold: cd, heat: hd } = countExtreme(c, cold.fn, heat.fn);
    return { id, total, cold: cd, heat: hd, baked, delta: total - baked, meta: byId[id] };
  });
  const st = stats(rows.map((r) => r.total));
  const coldStats = stats(rows.map((r) => r.cold));
  const heatStats = stats(rows.map((r) => r.heat));
  const fromZero = rows.filter((r) => r.baked === 0 && r.total > 0);
  const toZero = rows.filter((r) => r.baked > 0 && r.total === 0);
  const bigIncrease = [...rows].sort((a, b) => b.delta - a.delta).slice(0, 8);
  const bigDecrease = [...rows].sort((a, b) => a.delta - b.delta).slice(0, 8);
  return { cold, heat, rows, st, coldStats, heatStats, fromZero, toZero, bigIncrease, bigDecrease };
}

console.log('\n=== THRESHOLD COMBOS (vs current baked counts) ===\n');
const results = [];
for (const cold of coldThresholds) {
  for (const heat of heatThresholds) {
    const r = analyzeCombo(cold, heat);
    results.push(r);
    const isCurrent = cold.key === 'cold<0' && heat.key === 'heat>=33';
    const tag = isCurrent ? ' [CURRENT]' : '';
    console.log(`--- ${cold.label} + ${heat.label}${tag} ---`);
    console.log(`  total extreme days: mean=${r.st.mean.toFixed(1)} median=${r.st.median} p25=${r.st.p25} p75=${r.st.p75} max=${r.st.max} zeros=${r.st.zeros}`);
    console.log(`  cold-only days:     mean=${r.coldStats.mean.toFixed(1)} median=${r.coldStats.median}`);
    console.log(`  heat-only days:     mean=${r.heatStats.mean.toFixed(1)} median=${r.heatStats.median}`);
    if (!isCurrent) {
      const deltas = r.rows.map((x) => x.delta);
      const dSt = stats(deltas);
      console.log(`  delta vs current:   mean=${dSt.mean.toFixed(1)} median=${dSt.median} min=${dSt.min} max=${dSt.max}`);
      console.log(`  0→>0 listings: ${r.fromZero.length}   >0→0 listings: ${r.toZero.length}`);
    }
    console.log('');
  }
}

// Focus: heat 30 with current cold
const heat30CurrentCold = results.find((r) => r.cold.key === 'cold<0' && r.heat.key === 'heat>=30');
const heat33Cold5 = results.find((r) => r.cold.key === 'cold<-5' && r.heat.key === 'heat>=33');
const heat33Cold10 = results.find((r) => r.cold.key === 'cold<-10' && r.heat.key === 'heat>=33');
const heat33NoCold = results.find((r) => r.cold.key === 'no-cold' && r.heat.key === 'heat>=33');
const heat30Cold5 = results.find((r) => r.cold.key === 'cold<-5' && r.heat.key === 'heat>=30');

function cityLabel(r) {
  const m = r.meta;
  return m ? `${m.prov}/${m.city}/${m.dist || ''}` : r.id;
}

function printAffected(title, rows, n = 12) {
  console.log(`\n### ${title}`);
  rows.slice(0, n).forEach((r) => {
    console.log(`  id=${r.id} ${cityLabel(r)}: ${r.baked}→${r.total} (cold ${r.cold}, heat ${r.heat})`);
  });
}

console.log('\n=== KEY SCENARIO DETAIL ===');

printAffected('Heat 30°C + cold<0: biggest increases', heat30CurrentCold.bigIncrease);
printAffected('Heat 30°C + cold<0: newly extreme (was 0)', heat30CurrentCold.fromZero.sort((a, b) => b.total - a.total));

printAffected('cold<-5 + heat>=33: biggest decreases', heat33Cold5.bigDecrease);
printAffected('cold<-10 + heat>=33: biggest decreases', heat33Cold10.bigDecrease);

// Province aggregation for heat 30
function provAgg(result) {
  const map = {};
  for (const r of result.rows) {
    const p = r.meta?.prov || '?';
    if (!map[p]) map[p] = { n: 0, totalDelta: 0, totalNew: 0, listings: [] };
    map[p].n++;
    map[p].totalDelta += r.delta;
    if (r.baked === 0 && r.total > 0) map[p].totalNew++;
    map[p].listings.push(r);
  }
  return Object.entries(map)
    .map(([prov, v]) => ({
      prov,
      n: v.n,
      avgDelta: v.totalDelta / v.n,
      newExtreme: v.totalNew,
      avgExtreme: v.listings.reduce((s, x) => s + x.total, 0) / v.n,
    }))
    .sort((a, b) => b.avgDelta - a.avgDelta);
}

console.log('\n### Provinces most affected by heat 30 (cold<0): avg delta');
provAgg(heat30CurrentCold).slice(0, 10).forEach((p) => {
  console.log(`  ${p.prov}: n=${p.n} avgΔ=${p.avgDelta.toFixed(1)} avgExtreme=${p.avgExtreme.toFixed(1)} newlyExtreme=${p.newExtreme}`);
});

console.log('\n### Southern listings (广东/广西/海南/福建) — cold days under current vs -5 vs -10');
const south = ['广东', '广西', '海南', '福建'];
for (const prov of south) {
  const subset = heat33Cold5.rows.filter((r) => r.meta?.prov === prov);
  if (!subset.length) continue;
  const cur = subset.reduce((s, r) => s + r.baked, 0) / subset.length;
  const c5 = subset.reduce((s, r) => s + countExtreme(enriched[r.id].daily.curve, coldThresholds[1].fn, heatThresholds[0].fn).total, 0) / subset.length;
  const c10 = subset.reduce((s, r) => s + countExtreme(enriched[r.id].daily.curve, coldThresholds[2].fn, heatThresholds[0].fn).total, 0) / subset.length;
  const cold0 = subset.reduce((s, r) => s + countExtreme(enriched[r.id].daily.curve, coldThresholds[0].fn, () => false).cold, 0) / subset.length;
  console.log(`  ${prov} n=${subset.length}: avg extreme cur=${cur.toFixed(1)} cold<-5=${c5.toFixed(1)} cold<-10=${c10.toFixed(1)} avg cold-only days (tmean<0)=${cold0.toFixed(1)}`);
}

// Northeast cold-dominated
console.log('\n### Northeast listings — cold threshold impact (heat>=33 unchanged)');
const northeast = ['黑龙江', '吉林', '辽宁', '内蒙古'];
for (const prov of northeast) {
  const subset = ids.map((id) => ({ id, meta: byId[id] })).filter((x) => x.meta?.prov === prov);
  if (!subset.length) continue;
  const avg = (coldFn) =>
    subset.reduce((s, { id }) => {
      const c = enriched[id].daily.curve;
      return s + countExtreme(c, coldFn, heatThresholds[0].fn).total;
    }, 0) / subset.length;
  console.log(
    `  ${prov} n=${subset.length}: avg extreme cold<0=${avg(coldThresholds[0].fn).toFixed(1)} cold<-5=${avg(coldThresholds[1].fn).toFixed(1)} cold<-10=${avg(coldThresholds[2].fn).toFixed(1)} no-cold heat-only=${avg(coldThresholds[3].fn).toFixed(1)}`,
  );
}

// Summary table for recommendation
console.log('\n=== SUMMARY TABLE ===');
console.log('cold_threshold | heat_threshold | mean | median | zeros | 0→>0 | >0→0');
for (const r of results) {
  const label = `${r.cold.key.padEnd(10)} | ${r.heat.key.padEnd(10)}`;
  const isCurrent = r.cold.key === 'cold<0' && r.heat.key === 'heat>=33';
  console.log(
    `${label} | ${r.st.mean.toFixed(1).padStart(5)} | ${String(r.st.median).padStart(6)} | ${String(r.st.zeros).padStart(5)} | ${String(isCurrent ? '—' : r.fromZero.length).padStart(4)} | ${String(isCurrent ? '—' : r.toZero.length).padStart(4)}`,
  );
}

// Recommended pair: heat30 + cold<-5
console.log('\n=== RECOMMENDED PAIR PREVIEW: cold<-5 + heat>=30 ===');
const rec = analyzeCombo(coldThresholds[1], heatThresholds[1]);
console.log(JSON.stringify(rec.st, null, 2));
console.log(`vs current: mean ${baselineStats.mean.toFixed(1)}→${rec.st.mean.toFixed(1)}, median ${baselineStats.median}→${rec.st.median}, zeros ${baselineStats.zeros}→${rec.st.zeros}`);
