#!/usr/bin/env node
// check-rng.mjs — neon-abyss (audio-club.js) this._rng() 限域棘轮。
//
// 干什么：this._rng() 是唯一被推进的"熵源"（每次调用都会前进 _s 内部状态），
// 音乐引擎的确定性纪律要求它只出现在两类合法调用点——构造/setup 阶段一次性
// 抽取（如首个 cycle 的 style / reverb IR / noise buffer），或 _onBar() 每小节
// 边界（如动机变异 / cycle 风格轮换）。任何在 _scheduleStep() 或各乐器函数
// （_kick/_bass/_supersaw/...）里新增的 this._rng() 调用，都会打破"同一片宇宙
// → 同一首曲"的不变量（因为这些函数每帧/每步都跑，_rng() 状态会被步进节奏
// 污染，导致同一 sig 在不同帧率/设备上听出不同的曲）。
//
// 怎么判：单纯数 "this._rng()" 出现次数，与 EXPECTED 常量比对——这是个棘轮
// （ratchet），不是语义分析。数量变了不代表一定错，但必须有人去核对新增/减少
// 的调用点是否落在合法范围（_onBar 内部，或构造/start() 里的一次性 setup），
// 核对完再手动把 EXPECTED 改成新数字（连同这行注释一起更新，说明为什么变了）。
//
// 当前 HEAD 实测 5 处（2026-07-09）：
//   - start() 内 1 处：首个 cycle 风格抽取（this._pickStyle(this._rng())）
//   - _onBar() 内 2 处：动机变异 1 处 + cycle 风格轮换 1 处
//   - _reverbIR() / _noiseBuf() 各 1 处：均只在 start() 里被调用一次（噪声/混响
//     IR 是一次性建表，不在热路径），视为"构造/setup 一次性"合法用途。
const EXPECTED = 5;

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const argPath = process.argv[2];
const srcPath = argPath || fileURLToPath(new URL('../audio-club.js', import.meta.url));
const src = readFileSync(srcPath, 'utf8');

const matches = src.match(/this\._rng\(\)/g) || [];
const actual = matches.length;

console.log(`[check-rng] this._rng() 出现次数：actual=${actual}  expected=${EXPECTED}`);

if (actual !== EXPECTED) {
  console.error(`\n[check-rng] FAIL — 数量变了（${EXPECTED} → ${actual}）。`);
  console.error('核对步骤：');
  console.error('  1. grep -n "this\\._rng()" demos/neon-abyss/audio-club.js');
  console.error('  2. 对每个新增/减少的调用点确认：它是否只出现在 _onBar() 内部，或构造/start() 的一次性 setup 里');
  console.error('     （_scheduleStep() 及各 _kick/_bass/_supersaw/_arp/_lead/... 乐器函数内部禁止出现 this._rng()）。');
  console.error('  3. 确认无误后，把本文件顶部的 EXPECTED 常量改成新的 actual 值，并更新上方注释说明每个调用点的位置与理由。');
  process.exit(1);
}

console.log('[check-rng] 全绿。exit 0');
process.exit(0);
