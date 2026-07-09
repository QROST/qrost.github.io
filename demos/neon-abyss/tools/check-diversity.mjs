#!/usr/bin/env node
// check-diversity.mjs — neon-abyss (audio-club.js) 跨 session 多样性分布检查。
//
// 干什么：audio-club.js 里"每宇宙一次性"的参数（mode / drumVar / leadContour /
// kickBoom / styleW）全部通过 _sigMix(salt) 从 musicDNA.sig 折叠而来。如果某个
// 折叠公式写挂了（比如恒等于某个常数、或值域被意外收窄），后果是"每次开页听起来
// 都一样"——这类回归在人耳里很隐蔽，但在数值分布上一眼可辨。
//
// 怎么判：用 60 个确定性的 _sig0（i * 2654435761 >>> 0，绝非 Math.random——
// 复刻的是 _rng() 同款乘法哈希家族思路，但这里只是造测试输入，不涉及引擎状态）
// 模拟每宇宙的选择，锁死 domType（domType 本身不是 sig 派生量，属于"数据聚合"
// 输入，见 start() 里 modeForDom(dna.domType)），只让 sig 变，断言各折叠公式
// 的输出分布足够展开。
//
// 源码漂移守卫：下面复刻的每个公式都从源码里原样摘出对应片段做逐字比对；哪个
// 片段找不到了，说明公式已经改过，本脚本的复刻可能过期 —— exit 2。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const argPath = process.argv[2];
const srcPath = argPath || fileURLToPath(new URL('../audio-club.js', import.meta.url));
const src = readFileSync(srcPath, 'utf8');

// ---------- 0. 源码漂移守卫（逐字比对关键折叠表达式）----------
const SIGMIX_FN = "_sigMix(salt) { let x = (this._sig0 ^ Math.imul((salt | 0) + 1, 0x9e3779b9)) | 0; x = Math.imul(x ^ (x >>> 16), 0x7feb352d); x = Math.imul(x ^ (x >>> 15), 0x846ca68b); x ^= x >>> 16; return x >>> 0; }";
const DRIFT_GUARDS = [
  { label: '_sigMix 折叠公式', needle: SIGMIX_FN },
  { label: 'mode 30% 相邻情绪翻转', needle: "this.modeName = (this._sigMix(30) % 10 < 3) ? _altMode[_baseMode] : _baseMode;" },
  { label: 'drumVar 折叠', needle: 'this.drumVar = this._sigMix(33) % 3;' },
  { label: '_leadContour 折叠', needle: 'this._leadContour = this._sigMix(34) % 3;' },
  { label: 'kickBoom ±0.15 扰动', needle: "kickBoom: clamp((_ph ? 0.12 : 0.55) + ((this._sigMix(32) % 31) - 15) / 100, 0.05, 0.7)," },
  { label: 'styleW polka/hardgroove sig 扰动', needle: "wp += (this._sigMix(35) % 100) / 100 * 0.35; wh += (this._sigMix(36) % 100) / 100 * 0.35;" },
  { label: 'modeForDom', needle: "const modeForDom = (dt) => (dt === 7) ? 'major' : (dt === 1) ? 'phrygian' : (dt === 2 || dt === 3 || dt === 5 || dt === 6) ? 'dorian' : 'minor';" },
];
const missingGuards = DRIFT_GUARDS.filter((g) => !src.includes(g.needle));
if (missingGuards.length) {
  console.error('[check-diversity] 源码漂移守卫失败 —— 以下片段在 audio-club.js 里找不到了（逐字比对）：');
  for (const g of missingGuards) console.error(`  - ${g.label}`);
  console.error('\n折叠公式可能已改过：请核对后更新本脚本里的复刻逻辑。');
  process.exit(2);
}

// ---------- 1. 复刻 _sigMix（与源码逐字一致，见上方守卫）----------
function sigMix(sig0, salt) {
  let x = (sig0 ^ Math.imul((salt | 0) + 1, 0x9e3779b9)) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

// ---------- 2. 60 个确定性 sig0（不用 Math.random）----------
const N = 60;
const sig0s = Array.from({ length: N }, (_, i) => (Math.imul(i, 2654435761) >>> 0));

// ---------- 3. 锁死 domType=0（落在 else 分支：房价/政策/其它 → minor / trance 基线）----------
const DOM_TYPE = 0;
const baseMode = 'minor'; // modeForDom(0)
const altMode = { minor: 'dorian', dorian: 'minor', major: 'dorian', phrygian: 'minor' };
const _ph = (DOM_TYPE === 2 || DOM_TYPE === 1 || DOM_TYPE === 5); // kernel/工业/vendor 硬派旗标
const SPEED_SPREAD_FALLBACK = 0.45; // dna 缺省时的兜底值（start() 里 `dna ? dna.speedSpread : 0.45`）
const CONCENTRATION_FALLBACK = 0.4;

const modes = new Set();
const drumVars = new Set();
const leadContours = new Set();
const kickBooms = new Set();
const styleWTrance = new Set();

for (const sig0 of sig0s) {
  // mode：30% 概率翻到相邻情绪档。
  const mode = (sigMix(sig0, 30) % 10 < 3) ? altMode[baseMode] : baseMode;
  modes.add(mode);

  // drumVar / leadContour：0/1/2 三值折叠。
  drumVars.add(sigMix(sig0, 33) % 3);
  leadContours.add(sigMix(sig0, 34) % 3);

  // kickBoom：domType 定性格基线 + sig ±0.15 扰动。
  const kickBoom = Math.max(0.05, Math.min(0.7, (_ph ? 0.12 : 0.55) + ((sigMix(sig0, 32) % 31) - 15) / 100));
  kickBooms.add(Math.round(kickBoom * 1000) / 1000); // 浮点去噪到 3 位小数再计 distinct

  // styleW：_computeStyleWeights(dna) 的复刻（dna=null 兜底路径）。
  let wt = 1.0, wp = 0.0, wh = 0.0;
  wt += 0.4; // domType=0 落 else 分支（房价/政策/其它 → trance）
  wh += SPEED_SPREAD_FALLBACK * 0.6;
  wp += (1 - CONCENTRATION_FALLBACK) * 0.5;
  wp += (sigMix(sig0, 35) % 100) / 100 * 0.35;
  wh += (sigMix(sig0, 36) % 100) / 100 * 0.35;
  const s = wt + wp + wh || 1;
  styleWTrance.add(Math.round((wt / s) * 10000) / 10000);
}

// ---------- 4. 断言 ----------
const checks = [
  { name: 'mode 至少 2 种', ok: modes.size >= 2, detail: `{${[...modes].join(',')}}` },
  { name: 'drumVar 0/1/2 三值齐全', ok: [0, 1, 2].every((v) => drumVars.has(v)), detail: `{${[...drumVars].sort().join(',')}}` },
  { name: '_leadContour 0/1/2 三值齐全', ok: [0, 1, 2].every((v) => leadContours.has(v)), detail: `{${[...leadContours].sort().join(',')}}` },
  { name: 'kickBoom 至少 10 个 distinct', ok: kickBooms.size >= 10, detail: `${kickBooms.size} distinct` },
  { name: 'styleW.trance 连续分布，至少 20 个 distinct', ok: styleWTrance.size >= 20, detail: `${styleWTrance.size} distinct` },
];

console.log(`[check-diversity] N=${N} 个确定性 sig0，domType 锁死为 ${DOM_TYPE}（baseMode=${baseMode}）`);
let fail = false;
for (const c of checks) {
  console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}  —  ${c.detail}`);
  if (!c.ok) fail = true;
}

if (fail) {
  console.error('\n[check-diversity] FAIL — exit 1');
  process.exit(1);
}
console.log('\n[check-diversity] 全绿。exit 0');
process.exit(0);
