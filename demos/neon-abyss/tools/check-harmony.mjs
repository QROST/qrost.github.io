#!/usr/bin/env node
// check-harmony.mjs — neon-abyss (audio-club.js) 和声舒适不变量穷举。
//
// 干什么：对 CHORD 表里出现的每种和弦类型，精确复刻引擎"同响声部"的选音规则
// （bass / pad / stab / arp / lead / hook），枚举每个声部能产生的全部音高（相对
// 和弦根音的半音偏移，八度精确，因为 m2 vs m9 的区别就在于差 1 还是差 13），再
// 两两比较——出现 |差| ∈ {1, 13} 即视为撞车（小二度 / 小九度），除非落在白名单
// （引擎里 ~5% 概率出现、且下一音必解决的 +14 spice 音）。
//
// 为什么这样判：引擎注释本身记录过真实撞车案例（pad 9th(+14) 撞 arp 低八度
// b3(+15)、lead 高八度 b3(+27) 撞 stab 9th(+26)）并给出了对应修复（pad 砍到只留
// 三和弦、lead 的 min9 b3 改写为 5th）。本脚本把这些"曾经手工验证过一次就丢弃"
// 的推理，重新写成可重复运行的断言。
//
// 源码漂移守卫：如果下面三段特征代码在 audio-club.js 里找不到了，说明引擎的选音
// 规则已经改过、本脚本的提取逻辑可能已经过期 —— 脚本会 exit 2 并提示去核对/更新
// 规则，而不是悄悄用旧规则跑出一个虚假的"绿"。
//
// 用法：node check-harmony.mjs [可选：audio-club.js 的路径]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const argPath = process.argv[2];
const srcPath = argPath || fileURLToPath(new URL('../audio-club.js', import.meta.url));
const src = readFileSync(srcPath, 'utf8');

// ---------- 0. 源码漂移守卫 ----------
const DRIFT_GUARDS = [
  { label: 'pad 只弹前三音 (tones.slice(0, 3))', needle: 'tones.slice(0, 3)' },
  { label: 'arp 高八度只落根/五 (idx = (mi & 1) ? 2 : 0)', needle: 'idx = (mi & 1) ? 2 : 0' },
  { label: 'lead min9 上避让 b3 (ti === 1 时改写为 2)', needle: 'if (tones.length >= 5 && ti === 1) ti = 2;' },
];
const missingGuards = DRIFT_GUARDS.filter((g) => !src.includes(g.needle));
if (missingGuards.length) {
  console.error('[check-harmony] 源码漂移守卫失败 —— 以下特征代码在 audio-club.js 里找不到了：');
  for (const g of missingGuards) console.error(`  - ${g.label}\n    期望包含: ${JSON.stringify(g.needle)}`);
  console.error('\n提取规则可能已过期：请先确认引擎选音规则是否变了，再更新本脚本里对应的复刻逻辑。');
  process.exit(2);
}

// ---------- 1. 抽取 CHORD 表 ----------
const chordBlockMatch = src.match(/const CHORD = \{([\s\S]*?)\n\};/);
if (!chordBlockMatch) {
  console.error('[check-harmony] 找不到 "const CHORD = { ... };" 块 —— 源码漂移，exit 2。');
  process.exit(2);
}
const CHORD = {};
const chordEntryRe = /(\w+)\s*:\s*\[([^\]]*)\]/g;
let cm;
while ((cm = chordEntryRe.exec(chordBlockMatch[1]))) {
  CHORD[cm[1]] = cm[2].split(',').map((s) => parseInt(s.trim(), 10));
}
if (Object.keys(CHORD).length === 0) {
  console.error('[check-harmony] CHORD 表抽取到 0 个和弦类型 —— 正则可能与源码格式不匹配，exit 2。');
  process.exit(2);
}

// ---------- 2. 抽取 PROGS / MODES 里引用的 (r, c) 组合（仅用于诊断输出 + 完整性校验）----------
const progEntries = [];
const progRe = /\{\s*r:\s*(-?\d+)\s*,\s*c:\s*'(\w+)'\s*\}/g;
let pm;
while ((pm = progRe.exec(src))) progEntries.push({ r: parseInt(pm[1], 10), c: pm[2] });
if (progEntries.length === 0) {
  console.error('[check-harmony] 找不到任何 { r: N, c: \'type\' } 进行条目 —— 源码漂移，exit 2。');
  process.exit(2);
}
const referencedTypes = [...new Set(progEntries.map((p) => p.c))];
const orphanTypes = referencedTypes.filter((c) => !(c in CHORD));
if (orphanTypes.length) {
  console.error(`[check-harmony] 进行表引用了 CHORD 里不存在的和弦类型: ${orphanTypes.join(', ')} —— exit 2。`);
  process.exit(2);
}

// ---------- 3. 精确复刻每个声部的选音规则（相对和弦根音的半音偏移，八度精确）----------
// spice 白名单：安全扩展集 _spiceSet = [2] → note = root + 2 + 12 = +14（引擎里恒定，不随和弦类型变）。
const SPICE_OFFSET = 14;

function voicesFor(tones) {
  const L = tones.length;
  const entries = [];
  const push = (voice, value, wl = false) => entries.push({ voice, value, wl });

  // bass = root，固定低八度：sessKey + ch.r - 12 → 相对偏移 tones[0] - 12 = -12（root 恒为 0）。
  push('bass', tones[0] - 12);

  // pad = 和弦 tones 的前 3 个，不加八度偏移（sessKey + ch.r + semi）。
  for (const semi of tones.slice(0, 3)) push('pad', semi);

  // stab（supersaw）= 全部和弦 tones，统一 +12（sessKey + ch.r + semi + 12）。
  for (const semi of tones) push('stab', semi + 12);

  // arp：小节头锚根音(+12)；否则 idx = mi % L（mi ∈ motif 值域 0..4），
  // oct = floor(mi / L)；oct > 0 时 idx 被限制为高八度只落根/五 (0 或 2)；
  // note 偏移 = tones[idx] + 12*oct + 12。
  push('arp', tones[0] + 12); // 小节头锚根音（step % 16 === 0）
  for (let mi = 0; mi < 5; mi++) {
    const oct = Math.floor(mi / L);
    const idx = oct > 0 ? ((mi & 1) ? 2 : 0) : (mi % L);
    push('arp', tones[idx] + 12 * oct + 12);
  }
  // arp spice（~6% 弱拍，下一音必解决）：白名单，允许它与任何声部差 1/13。
  push('arp-spice', SPICE_OFFSET, true);

  // lead（drop 段自由旋律）：ti ∈ 0..L-1 全域可达（colorN 连续 + 轮廓摆动模 L）；
  // min9 型（L>=5）时 ti===1 被永久改写为 2（避 b3），freq 用 tones[ti] + 24。
  const leadTis = new Set();
  for (let ti = 0; ti < L; ti++) leadTis.add(ti);
  if (L >= 5) { leadTis.delete(1); leadTis.add(2); }
  for (const ti of leadTis) push('lead', tones[ti] + 24);

  // hook（breakdown 主旋律，forceNote 传入）：mi % L 覆盖全部 tones，统一 +12。
  for (const semi of tones) push('hook', semi + 12);

  return entries;
}

// ---------- 4. 两两枚举，检测 |差| ∈ {1, 13}（白名单豁免）----------
const violations = [];
let pairsChecked = 0;
for (const [type, tones] of Object.entries(CHORD)) {
  const entries = voicesFor(tones);
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      pairsChecked++;
      const a = entries[i], b = entries[j];
      if (a.wl || b.wl) continue; // 白名单豁免
      const diff = Math.abs(a.value - b.value);
      if (diff === 1 || diff === 13) {
        violations.push({ type, a, b, diff });
      }
    }
  }
}

// ---------- 5. 报告 ----------
console.log(`[check-harmony] CHORD 类型: ${Object.keys(CHORD).join(', ')}`);
console.log(`[check-harmony] 进行表引用的和弦类型: ${referencedTypes.join(', ')} (${progEntries.length} 个和弦实例, 完整性 OK)`);
console.log(`[check-harmony] 共枚举 ${Object.keys(CHORD).length} 种和弦类型 x 声部组合，两两比较 ${pairsChecked} 对`);

if (violations.length) {
  console.error(`\n[check-harmony] 发现 ${violations.length} 处 m2/m9 撞车：\n`);
  console.error('chord     voiceA      valA   voiceB      valB   diff');
  for (const v of violations) {
    console.error(
      `${v.type.padEnd(9)} ${v.a.voice.padEnd(11)} ${String(v.a.value).padStart(4)}   ${v.b.voice.padEnd(11)} ${String(v.b.value).padStart(4)}   ${v.diff}`
    );
  }
  console.error('\n[check-harmony] FAIL — exit 1');
  process.exit(1);
}

console.log('\n[check-harmony] 全绿：0 处 m2/m9 撞车。exit 0');
process.exit(0);
