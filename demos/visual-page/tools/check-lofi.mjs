#!/usr/bin/env node
// check-lofi.mjs — visual-page (audio.js) lofi 引擎三合一体检：
//   1) 和声舒适不变量穷举（m2/m9 撞车，声部规则按 lofi 引擎实际源码复刻——
//      lofi 没有 neon-abyss 那套 min9-b3 避让 / spice 白名单，规则更简单但不同，
//      不要照抄 neon 的 voicesFor()）。
//   2) sig 多样性折叠分布断言（bpm / swing / baseProgIdx / groove / motif）。
//   3) this._rng() 出现次数棘轮。
//
// 用法：node check-lofi.mjs [可选：audio.js 的路径]
//
// 源码漂移守卫：每个环节要用到的源码片段都逐字比对；找不到就 exit 2，不悄悄
// 用过期规则跑出虚假的绿。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const argPath = process.argv[2];
const srcPath = argPath || fileURLToPath(new URL('../audio.js', import.meta.url));
const src = readFileSync(srcPath, 'utf8');

let exitCode = 0;
const fail = () => { exitCode = 1; };

// =====================================================================
// 环节 1：和声舒适不变量穷举
// =====================================================================
console.log('=== [1/3] 和声穷举 (m2/m9) ===');
{
  // —— 声部规则来自实际读源码（audio.js），与 neon-abyss 不同：
  //   · chord（_strikeChord）：base = curKey + 12 + ch.r；list = 全部 tones 或 tones.slice(1)（"upper" 变体，
  //     去根音的 comp 敲击）。upper 是 full 的子集，枚举 full 即覆盖两者。→ 偏移 = tones[i] + 12（全部 i）。
  //   · bass（_scheduleStep 里 3 个分支）：root-12 / (root-12+7)=fifth-12 / (root-12+5)=walking-12。
  //     这三个偏移是常数，不依赖 tones 数组（bass 公式本身没有引用 tones，只有 ch.r + 固定半音）。
  //   · mel（主旋律 + call-response + focus 一次性电钢）：tones[ti] + 12 或 + 24（oct = 12*(1或2)）；
  //     ti 由 colorN/motif/_rng（主旋律）或 focus.tone（focus 电钢）决定，取值覆盖 0..tones.length-1 全域
  //     —— 但两处 +24 发声（主旋律 oct=2 分支、focus 电钢）都各有一条撞车避让（harmony pass，2026-07-09）：
  //     若 tones[ti] 与和弦内某音正好差 11 半音（tone+24 会贴到那个音的 chord register(+12) 上，大七/
  //     小九度），ti 让位到五度(tones.indexOf(7))；call-response 恒 +12，不受影响。故 +24 分支不覆盖被
  //     排除的 tone；voicesFor() 必须复刻这条排除规则，否则会枚举出运行时永不出现的假撞车。
  const DRIFT_GUARDS = [
    { label: '_strikeChord base 公式', needle: 'const tones = CHORD[ch.c], base = this.curKey + 12 + ch.r, list = upper ? tones.slice(1) : tones;' },
    { label: 'bass 主根音分支 (root-12)', needle: 'if (step === gr.kick[0] || step === 10) this._bass(t, mtof(key + ch.r - 12), stepDur * 5, 0.85);' },
    { label: 'bass 五度分支 (root-12+7)', needle: 'else if (step === 6 && ex > 0.4) this._bass(t, mtof(key + ch.r - 12 + 7), stepDur * 2, 0.5);' },
    { label: 'bass walking 分支 (root-12+5)', needle: 'else if (lv.walk && step === 14) this._bass(t, mtof(key + ch.r - 12 + 5), stepDur * 2, 0.42);' },
    { label: 'mel oct 公式 (12 或 24)', needle: 'const oct = 12 * (this._rng() < (0.2 + liveE * 0.2) ? 2 : 1);' },
    { label: 'mel 主音符调用 (+oct)', needle: 'this._mel(t, mtof(key + ch.r + tones[ti] + oct), stepDur * 3, 0.3,' },
    { label: 'mel call-response 调用 (+12)', needle: 'this._mel(t, mtof(key + ch.r + tones[ti] + 12), stepDur * 2, 0.22,' },
    { label: 'mel oct=2 撞车避让 (让位五度)', needle: 'if (oct === 24 && tones.some((tj) => tj - tones[ti] === 11)) ti = tones.indexOf(7);' },
    { label: 'focus 电钢撞车避让 (让位五度)', needle: 'if (tones.some((tj) => tj - tones[ti] === 11)) ti = tones.indexOf(7);' },
    { label: 'focus 电钢调用 (+24)', needle: 'this._epiano(t, mtof(this.curKey + 24 + ch.r + tones[ti]), 1.4, 0.32, this.focBus, 1, 2.2, 1.0);' },
  ];
  const missingGuards = DRIFT_GUARDS.filter((g) => !src.includes(g.needle));
  if (missingGuards.length) {
    console.error('[check-lofi/harmony] 源码漂移守卫失败 —— 以下特征代码找不到了：');
    for (const g of missingGuards) console.error(`  - ${g.label}`);
    console.error('提取规则可能已过期：请核对后更新脚本。exit 2。');
    process.exit(2);
  }

  const chordBlockMatch = src.match(/const CHORD = \{([\s\S]*?)\};/);
  if (!chordBlockMatch) { console.error('[check-lofi/harmony] 找不到 CHORD 表 —— 源码漂移，exit 2。'); process.exit(2); }
  const CHORD = {};
  const chordEntryRe = /(\w+)\s*:\s*\[([^\]]*)\]/g;
  let cm;
  while ((cm = chordEntryRe.exec(chordBlockMatch[1]))) {
    CHORD[cm[1]] = cm[2].split(',').map((s) => parseInt(s.trim(), 10));
  }
  if (Object.keys(CHORD).length === 0) { console.error('[check-lofi/harmony] CHORD 表抽取到 0 项，exit 2。'); process.exit(2); }

  const progEntries = [];
  const progRe = /\{\s*r:\s*(-?\d+)\s*,\s*c:\s*'(\w+)'\s*\}/g;
  let pm;
  while ((pm = progRe.exec(src))) progEntries.push({ r: parseInt(pm[1], 10), c: pm[2] });
  if (progEntries.length === 0) { console.error('[check-lofi/harmony] 找不到进行条目，exit 2。'); process.exit(2); }
  const referencedTypes = [...new Set(progEntries.map((p) => p.c))];
  const orphanTypes = referencedTypes.filter((c) => !(c in CHORD));
  if (orphanTypes.length) { console.error(`[check-lofi/harmony] 进行表引用了不存在的和弦类型: ${orphanTypes.join(', ')}，exit 2。`); process.exit(2); }

  function voicesFor(tones) {
    const L = tones.length;
    const entries = [];
    const push = (voice, value) => entries.push({ voice, value });
    // chord：strikeChord 全音 + 12（upper 变体是子集，已覆盖）。
    for (const semi of tones) push('chord', semi + 12);
    // bass：三个固定偏移，不依赖 tones。
    push('bass', -12);      // root - 12
    push('bass', -12 + 7);  // fifth - 12 = -5
    push('bass', -12 + 5);  // walking - 12 = -7
    // mel：tones[i] + 12（call-response / oct=1 分支）覆盖全域；tones[i] + 24（oct=2 分支，含 focus 电钢）
    // 排除撞车避让让位掉的 tone（与另一 tone 差 11 半音的那个）—— 复刻 _scheduleStep 里的
    // `if (oct === 24 && tones.some((tj) => tj - tones[ti] === 11)) ti = tones.indexOf(7);`。
    for (const semi of tones) {
      push('mel', semi + 12);
      const guarded = tones.some((tj) => tj - semi === 11);
      if (!guarded) push('mel', semi + 24);
    }
    return entries;
  }

  const violations = [];
  let pairsChecked = 0;
  for (const [type, tones] of Object.entries(CHORD)) {
    const entries = voicesFor(tones);
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        pairsChecked++;
        const a = entries[i], b = entries[j];
        const diff = Math.abs(a.value - b.value);
        if (diff === 1 || diff === 13) violations.push({ type, a, b, diff });
      }
    }
  }

  console.log(`CHORD 类型: ${Object.keys(CHORD).join(', ')}`);
  console.log(`进行表引用: ${referencedTypes.join(', ')} (${progEntries.length} 个和弦实例, 完整性 OK)`);
  console.log(`两两比较 ${pairsChecked} 对`);
  if (violations.length) {
    console.error(`发现 ${violations.length} 处 m2/m9 撞车（lofi 引擎无 spice 白名单，全部计入）：`);
    console.error('chord      voiceA   valA   voiceB   valB   diff');
    for (const v of violations) {
      console.error(`${v.type.padEnd(10)} ${v.a.voice.padEnd(8)} ${String(v.a.value).padStart(4)}   ${v.b.voice.padEnd(8)} ${String(v.b.value).padStart(4)}   ${v.diff}`);
    }
    fail();
  } else {
    console.log('0 处 m2/m9 撞车。');
  }
}

// =====================================================================
// 环节 2：sig 多样性分布断言
// =====================================================================
console.log('\n=== [2/3] sig 多样性分布 ===');
{
  const SIGMIX_FN = "_sigMix(salt) { let x = ((this._sig0 || 0) ^ Math.imul((salt | 0) + 1, 0x9e3779b9)) | 0; x = Math.imul(x ^ (x >>> 16), 0x7feb352d); x = Math.imul(x ^ (x >>> 15), 0x846ca68b); x ^= x >>> 16; return x >>> 0; }";
  const DRIFT_GUARDS = [
    { label: '_sigMix 折叠公式', needle: SIGMIX_FN },
    { label: 'bpm 折叠', needle: 'this.bpm = Math.round(72 + warm * 6 + (dna ? dna.speedMean : 0.5) * 5 + (this._sigMix(2) % 9) - 4);' },
    { label: 'swing 折叠', needle: 'this.swing = clamp(0.22 + (dna ? dna.speedSpread : 0.45) * 0.12 + (this._sigMix(3) % 70) / 1000, 0.20, 0.42);' },
    { label: 'baseProgIdx 折叠', needle: 'this.baseProgIdx = _bucket[(Math.floor(clamp(dna ? dna.concentration : 0.4, 0, 0.999) * _bucket.length) + this._sigMix(10)) % _bucket.length];' },
    { label: 'groove 折叠', needle: 'this.groove = GROOVES[(Math.floor(clamp(dna ? dna.populatedFrac : 0.3, 0, 0.999) * GROOVES.length) + this._sigMix(11)) % GROOVES.length];' },
    { label: 'motif 折叠', needle: 'this.motif = _bm.map((v, k) => (Math.round(v) + this._sigMix(20 + k)) % 5);' },
    { label: 'moodForDom', needle: "const moodForDom = (dt) => (dt === 3 || dt === 6 || dt === 7 || dt === 0) ? 'bright' : (dt === 2 || dt === 4) ? 'wistful' : 'mellow';" },
  ];
  const missingGuards = DRIFT_GUARDS.filter((g) => !src.includes(g.needle));
  if (missingGuards.length) {
    console.error('[check-lofi/diversity] 源码漂移守卫失败 —— 以下片段找不到了：');
    for (const g of missingGuards) console.error(`  - ${g.label}`);
    console.error('exit 2。');
    process.exit(2);
  }

  const MOODS = { bright: [0, 3, 4], mellow: [1, 0, 4], wistful: [2, 5, 1] }; // 与源码 MOODS 表一致（PROGS 索引）
  const GROOVES_LEN = 6;

  function sigMix(sig0, salt) {
    let x = ((sig0 || 0) ^ Math.imul((salt | 0) + 1, 0x9e3779b9)) | 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    x ^= x >>> 16;
    return x >>> 0;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const N = 60;
  const sig0s = Array.from({ length: N }, (_, i) => (Math.imul(i, 2654435761) >>> 0));

  // domType 锁死 = 0 → mood = moodForDom(0) = 'bright'（落 (dt===0) 分支）。
  const DOM_TYPE = 0;
  const mood = 'bright';
  const bucket = MOODS[mood];
  const WARM = 0.5, SPEED_MEAN = 0.5, SPEED_SPREAD = 0.45, CONCENTRATION = 0.4, POPULATED_FRAC = 0.3;

  const bpms = new Set(), swings = new Set(), baseProgIdxs = new Set(), grooveIdxs = new Set(), motif0s = new Set();

  for (const sig0 of sig0s) {
    const bpm = Math.round(72 + WARM * 6 + SPEED_MEAN * 5 + (sigMix(sig0, 2) % 9) - 4);
    bpms.add(bpm);

    const swing = clamp(0.22 + SPEED_SPREAD * 0.12 + (sigMix(sig0, 3) % 70) / 1000, 0.20, 0.42);
    swings.add(Math.round(swing * 10000) / 10000);

    const baseProgIdx = bucket[(Math.floor(clamp(CONCENTRATION, 0, 0.999) * bucket.length) + sigMix(sig0, 10)) % bucket.length];
    baseProgIdxs.add(baseProgIdx);

    const grooveIdx = (Math.floor(clamp(POPULATED_FRAC, 0, 0.999) * GROOVES_LEN) + sigMix(sig0, 11)) % GROOVES_LEN;
    grooveIdxs.add(grooveIdx);

    // motif fallback = [0, 2, 1, 3, 2, 0, 3, 1]；只跟踪位 0（v=0）足以证明折叠公式在动。
    motif0s.add((Math.round(0) + sigMix(sig0, 20)) % 5);
  }

  const checks = [
    { name: 'bpm 至少 5 个 distinct', ok: bpms.size >= 5, detail: `${bpms.size} distinct` },
    { name: 'swing 至少 20 个 distinct', ok: swings.size >= 20, detail: `${swings.size} distinct` },
    { name: 'baseProgIdx 至少 2 个 distinct', ok: baseProgIdxs.size >= 2, detail: `{${[...baseProgIdxs].sort().join(',')}}` },
    { name: 'groove 至少 4 个 distinct', ok: grooveIdxs.size >= 4, detail: `{${[...grooveIdxs].sort().join(',')}}` },
    { name: 'motif[0] 至少 3 个 distinct', ok: motif0s.size >= 3, detail: `{${[...motif0s].sort().join(',')}}` },
  ];

  console.log(`N=${N} 个确定性 sig0，domType 锁死为 ${DOM_TYPE}（mood=${mood}）`);
  for (const c of checks) {
    console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}  —  ${c.detail}`);
    if (!c.ok) fail();
  }
}

// =====================================================================
// 环节 3：this._rng() 计数棘轮
// =====================================================================
console.log('\n=== [3/3] this._rng() 计数棘轮 ===');
{
  // 当前 HEAD 实测 18 处（2026-07-09，grep -o 逐次匹配计数——注意部分行一行内有
  // 2 处调用，按行数数会少算，必须用 -o 逐次匹配）。lofi 引擎（audio.js v3）与
  // neon-abyss 不同：它把 _rng() 大量用于 _scheduleStep() 每步的人性化微抖/概率
  // 触发（"极稀疏只落和弦音的旋律"靠逐步掷骰子实现，见文件头注释①②③），这是
  // 既有设计、不是本脚本要纠正的对象——本脚本只做计数棘轮：数量变了就要求人核对
  // 新增/减少的调用点是否合理，再手动更新 EXPECTED。
  const EXPECTED = 18;
  const matches = src.match(/this\._rng\(\)/g) || [];
  const actual = matches.length;
  console.log(`this._rng() 出现次数：actual=${actual}  expected=${EXPECTED}`);
  if (actual !== EXPECTED) {
    console.error(`FAIL — 数量变了（${EXPECTED} → ${actual}）。`);
    console.error('核对步骤：grep -n "this\\._rng()" demos/visual-page/audio.js，确认每个新增/减少调用点的合理性后更新本文件顶部 EXPECTED。');
    fail();
  } else {
    console.log('PASS');
  }
}

console.log(exitCode === 0 ? '\n[check-lofi] 全绿。exit 0' : '\n[check-lofi] FAIL — exit 1');
process.exit(exitCode);
