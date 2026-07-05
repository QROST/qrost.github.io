// 霓虹渊 · Neon Abyss — 生成式 Trance / Progressive 引擎 v1（zero-dep, pure Web Audio）
// Data Abyss 的 lofi 引擎（audio.js）的"夜店变体"：保留"数据涌现 → 曲"的核心哲学，
// 把暖·慵懒·cozy 的 lofi 配方替换为亮·响·律动的 four-on-the-floor Trance。
//
// 保留自 audio.js：
//   · 零 Math.random —— 一切"不同"由 SOM 涌现签名 musicDNA.sig 派生的确定性 PRNG 驱动。
//   · 同一片宇宙 → 同一首曲；不同宇宙(SOM 不同) → 不同曲，且与所见相关。
//   · 读取同一份 musicDNA（hueStar / concentration / speedMean / speedSpread / domType / motif / sig）。
//     "你看着哪片自组织就听见它"的艺术钩子原样保留。
//
// 反转自 audio.js（lofi → trance）：
//   · BPM 76→87 → 固定 138（±speedMean 微调）
//   · boom-bap → four-on-the-floor（kick 落 0/4/8/12）
//   · 软 sine kick → 硬 sine 50→110Hz 下扫 + sub 长尾
//   · Rhodes maj9/min9（暖爵士）→ supersaw stabs（小调，detuned saws + 滤波包络）
//   · 母带暗暖（高频 −4dB）→ 母带亮响（高频 +3dB + 重限制器）
//   · 黑胶噪 → 去掉（干净数字）
//   · 4 小节乐句 → 32 小节 Trance 编排（intro / build / drop / breakdown / loop）
//
// 新增（audio.js 没有）：
//   · this.beatPulse（0..1）—— 每个 kick 触发 → 1，每帧衰减。供视觉侧 beat-sync（bloom 强度 / 相机微震 /
//     FOV punch / 粒子尺寸脉冲）。这是替代原 mic 驱动 pulse 的纯生成出口。
//   · 结构段：this.section ∈ {intro, build, drop, breakdown}。供视觉侧决定是否触发爆闪/剧扩。

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 小调和弦库（每首随机挑一个；每和弦 2 小节 → 8 小节和声循环）。
// Trance 的紧张感来自小调 + 偶尔的大七/⌀ 点缀；根 r 相对调性根（半音）。
const PROGS = [
  [{ r: 0, c: 'min' }, { r: 7, c: 'maj' }, { r: 3, c: 'maj' }, { r: 10, c: 'min9' }],   // i – VII – III – vi（经典 trance / AvB 系）
  [{ r: 0, c: 'min9' }, { r: 5, c: 'maj' }, { r: 8, c: 'min' }, { r: 7, c: 'maj' }],     // i – VI – iv – III
  [{ r: 9, c: 'min' }, { r: 4, c: 'min' }, { r: 0, c: 'maj' }, { r: 7, c: 'maj' }],      // vi – v – I – III
  [{ r: 0, c: 'min' }, { r: 7, c: 'maj' }, { r: 8, c: 'min9' }, { r: 5, c: 'maj' }],     // i – III – iv – VI（progressive）
  [{ r: 0, c: 'min9' }, { r: 9, c: 'min7' }, { r: 5, c: 'maj9' }, { r: 7, c: 'maj' }],   // i – vi – VI – III（暖 progressive）
  [{ r: 0, c: 'min' }, { r: 3, c: 'maj' }, { r: 7, c: 'maj' }, { r: 8, c: 'min' }],      // i – III – VII – iv（暗 progressive）
];
const CHORD = {
  min: [0, 3, 7], maj: [0, 4, 7], min7: [0, 3, 7, 10], maj9: [0, 4, 7, 11, 14],
  min9: [0, 3, 7, 10, 14], min11: [0, 3, 7, 10, 17],
};
// Trance arp 音阶级数（自然小调扩展，跨两个八度）。落音由 musicDNA.motif 轮廓选。
const ARP_SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
// 每次加载的整体移调候选（保持小调听感、不刺耳）。
const SESS_TRANSPOSE = [0, 2, -2, 3, 5, -4, -5, 7];

// 32 小节编排段：返回当前 bar 落在哪段。
// intro(0–7) → build(8–15) → drop(16–31) → breakdown(32–39) → 循环回 intro(0)。
// 总循环长度 = 40 小节。drop 是全开段（bloom/strobe 触发），breakdown 鼓撤。
const sectionOf = (bar) => {
  const b = ((bar % 40) + 40) % 40;
  if (b < 8) return 'intro';
  if (b < 16) return 'build';
  if (b < 32) return 'drop';
  return 'breakdown';
};

export class Sonifier {
  constructor() {
    this.ctx = null; this.started = false; this.muted = false;
    this.bpm = 138; this.step = 0; this.bar = 0; this.nextTime = 0; this.lookahead = 0.14;
    this.keyRoot = 48;
    this.motif = [0, 2, 1, 3, 2, 0, 3, 1]; this.motifPos = 0;
    this._lastFocusKey = null;
    this.section = 'intro';
    // beatPulse：0..1。每个 kick 触发 → 1，update() 每帧自然衰减。供视觉 beat-sync 用（替代 mic pulse）。
    this.beatPulse = 0;
    // riser/impact 包络：build 段最后 8 小节 riser 渐强；drop 起点 impact 爆一下。
    this._riserEnv = 0; this._impactEnv = 0;
    this._riserOn = false; this._lastRiserStep = -999;
    this.debug = { steps: 0, kicks: 0, claps: 0, chords: 0, arps: 0, mods: 0, sig: 0 };
  }

  start(ctx, opts = {}) {
    if (this.started) { try { ctx.resume && ctx.resume(); } catch (_) {} this.setMuted(false); return; }
    this.ctx = ctx; this.started = true;
    const t = ctx.currentTime;
    // 数据涌现签名 → 确定性 PRNG 种子（零 Math.random）。无 DNA 兜底也从 climWarm 派生（仍来自数据）。
    const dna = (opts && opts.sig != null) ? opts : null;
    const warmRaw = dna ? dna.warm : opts.climWarm;
    const warm = clamp(warmRaw == null ? 0.5 : warmRaw, 0, 1);
    this._s = (dna ? (dna.sig >>> 0) : ((Math.round(warm * 1e6) ^ 0x9e3779b9) >>> 0)) | 0;
    this.dna = dna; this.debug.sig = dna ? (dna.sig >>> 0) : 0;

    // 调性根：warm 选冷/温/暖三档（A minor / D minor / C minor 区间）。
    this.keyRoot = warm < 0.4 ? 45 : warm > 0.7 ? 50 : 48;
    // 最密簇色相 → 整体移调（听见这片宇宙的主色）。
    const hueStar = dna ? clamp(dna.hueStar, 0, 0.999) : 0.5;
    this.sessKey = this.keyRoot + SESS_TRANSPOSE[Math.floor(hueStar * SESS_TRANSPOSE.length)];
    // BPM 134–142（speedMean 微调）。Trance 标准区间。
    this.bpm = Math.round(134 + (dna ? dna.speedMean : 0.5) * 8);
    // speedSpread → arp swing（异质度高 → arp 更跳）。
    this.arpSwing = 0.04 + (dna ? dna.speedSpread : 0.45) * 0.06;
    // concentration → 进行索引（越集中 → 越暗 progressive，越散 → 越开放）。
    this.baseProgIdx = Math.floor(clamp(dna ? dna.concentration : 0.4, 0, 0.999) * PROGS.length);
    // 最密簇学习原型 → arp 动机轮廓。
    this.motif = (dna && dna.motif && dna.motif.length >= 8) ? dna.motif.slice(0, 8) : [0, 2, 1, 3, 2, 0, 3, 1];
    this.curProgIdx = this.baseProgIdx;

    // ---------- 母带链（亮·响·数字）----------
    // 重限制器：threshold −6dB、ratio 12、attack 0.001s → 追求响度（Trance 母带就是"挤到贴脸"）。
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6; limiter.knee.value = 12; limiter.ratio.value = 12;
    limiter.attack.value = 0.001; limiter.release.value = 0.18;
    const master = ctx.createGain(); master.gain.value = 0; limiter.connect(master); master.connect(ctx.destination); this.master = master;
    // 高频 highshelf +3dB（反转 lofi 的 −4dB 暗暖）+ 轻激励器。
    const sat = ctx.createWaveShaper(); sat.curve = this._satCurve(1.15); sat.oversample = '2x';
    const hiShelf = ctx.createBiquadFilter(); hiShelf.type = 'highshelf'; hiShelf.frequency.value = 3500; hiShelf.gain.value = 3;
    sat.connect(hiShelf); hiShelf.connect(limiter);
    const mix = ctx.createGain(); mix.gain.value = 1; mix.connect(sat); this.mix = mix;
    // 长 reverb（2.4s IR，比 lofi 1.4s 长）+ 更湿 send → Trance 空间感。
    const reverb = ctx.createConvolver(); reverb.buffer = this._reverbIR(2.4);
    const revSend = ctx.createGain(); revSend.gain.value = 0.18; const revRet = ctx.createGain(); revRet.gain.value = 0.7;
    revSend.connect(reverb); reverb.connect(revRet); revRet.connect(mix); this.revSend = revSend;

    // ---------- Sidechain bus（kick 触发统一 duck → 整曲"喘气"感）----------
    // 所有非鼓声部 → scBus；kick 时 gain 瞬跌 −8dB、150ms 恢复。
    this.scBus = ctx.createGain(); this.scBus.gain.value = 1; this.scBus.connect(mix);

    this.drumBus = ctx.createGain(); this.drumBus.gain.value = 1.0; this.drumBus.connect(mix);   // 鼓直连 mix（不被 duck）
    this.bassBus = ctx.createGain(); this.bassBus.gain.value = 0.9; this.bassBus.connect(this.scBus);   // 贝斯也 sidechain（跟 kick 喘）
    this.chordBus = ctx.createGain(); this.chordBus.gain.value = 0.4; this.chordBus.connect(this.scBus); this.chordBus.connect(revSend);
    this.leadBus = ctx.createGain(); this.leadBus.gain.value = 0.32; this.leadBus.connect(this.scBus); this.leadBus.connect(revSend);
    this.arpBus = ctx.createGain(); this.arpBus.gain.value = 0.26; this.arpBus.connect(this.scBus); this.arpBus.connect(revSend);
    this.padBus = ctx.createGain(); this.padBus.gain.value = 0.22; this.padBus.connect(this.scBus); this.padBus.connect(revSend);

    // fx bus：riser / impact 走自己的通道（不受 sidechain，独立 swell/blast）。
    this.fxBus = ctx.createGain(); this.fxBus.gain.value = 0.5; this.fxBus.connect(mix);

    // 噪声 buffer（clap / riser / impact 共用）。
    this._noise = this._noiseBuf(3.0);

    this.master.gain.setTargetAtTime(0.85, t, 1.2);
    this.nextTime = t + 0.12;
  }

  update(s) {
    if (!this.started || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;

    // beatPulse 每帧自然衰减（kick 时 _kick() 会置 1）。视觉侧读 this.beatPulse。
    this.beatPulse *= 0.86;

    // riser / impact 包络：随 section 自然演化。build 段渐强；drop 起点爆。
    const sec = sectionOf(this.bar);
    const b40 = ((this.bar % 40) + 40) % 40;
    if (sec === 'build') {
      const frac = clamp((b40 - 8) / 8, 0, 1);   // 0..1 over build
      this._riserEnv = frac * frac;              // 缓入（平方）→ 末段急涨
    } else {
      this._riserEnv *= 0.9;                      // 出 build 段自然衰减
    }
    if (this._impactEnv > 0) this._impactEnv *= 0.82;

    // 段切换：进 drop 时 fire impact（一次性）。
    if (sec !== this.section) {
      if (sec === 'drop') this._impact(t);
      this.section = sec;
    }

    // 视野聚合（旋律落音颜色由视野主导簇色相驱动 —— 原 audio.js 的钩子）。
    const clH = (s.view && s.view.clHue != null) ? s.view.clHue : null;
    const sm = clamp((s.dt || 0.016) * 4, 0, 1);
    if (clH != null) {
      if (this._clHue == null) this._clHue = clH;
      else { let dl = clH - this._clHue; if (dl > 0.5) dl -= 1; else if (dl < -0.5) dl += 1; this._clHue = (this._clHue + dl * sm + 1) % 1; }
    }

    this._focus(s.focus, t);

    const stepDur = (60 / this.bpm) / 4;
    while (this.nextTime < t + this.lookahead) {
      this._scheduleStep(this.nextTime, stepDur);
      this.nextTime += stepDur; this.step++; this.debug.steps++;
      if (this.step % 16 === 0) this._onBar();
    }

    // riser 持续音（build 段）：白噪带通扫频 + 音量 swell。节流到每拍一次，避免堆叠。
    if (this._riserEnv > 0.01 && this.step - this._lastRiserStep >= 4) {
      this._driveRiser(t); this._lastRiserStep = this.step;
    }
  }

  _onBar() {
    this.bar++;
    // 动机变异（每 4 小节轻微改一个音 → 没有两段完全一样；确定性 PRNG）。
    if (this.bar % 4 === 0) { const k = (this.bar * 5) % this.motif.length; this.motif[k] = clamp(this.motif[k] + (this._rng() < 0.5 ? 1 : -1), 0, 5); }
    this.curProgIdx = this.baseProgIdx;
  }

  _curProg() { return PROGS[this.curProgIdx] || PROGS[0]; }
  _chord() { const p = this._curProg(); return p[(this.bar >> 1) % p.length]; }

  _scheduleStep(gridT, stepDur) {
    const step = this.step % 16, bar = this.bar;
    const swing = (step % 2 === 1) ? stepDur * this.arpSwing : 0;
    const t = gridT + swing;
    const ch = this._chord();
    const sec = sectionOf(bar);

    // —— 鼓：four-on-the-floor —— intro 仅稀 kick；build 加 clap；drop 全开；breakdown 鼓撤。
    const drumOn = sec === 'build' || sec === 'drop';
    const kickOn = sec !== 'breakdown';   // intro 也打轻 kick 维持律动
    if (kickOn && step % 4 === 0) this._kick(t, sec === 'drop' ? 1.0 : (sec === 'intro' ? 0.7 : 0.9));
    if (drumOn && (step === 4 || step === 12)) this._clap(t, 0.7);
    if (drumOn && step % 2 === 1) this._hat(t, 0.3, false);            // 16 分闭镲（off-beat）
    if (sec === 'drop' && step % 4 === 2) this._hat(t, 0.4, true);     // off-beat 开镲（drop 专属）
    // 8 小节末 fill（drum roll）：drop 段每 8 小节最后 1 拍密集军鼓。
    if (sec === 'drop' && (bar & 7) === 7 && step >= 13) this._clap(t, 0.4);

    // —— 贝斯：sub sine + saw，跟 kick 同步（step 0/4/8/12），强 sidechain 泵动 ——
    if (drumOn && step % 4 === 0) {
      this._bass(t, mtof(this.sessKey + ch.r - 12), stepDur * 3.2, 0.95);
    }
    // 贝斯 walking 过渡（drop 段 step 14 → 向下和弦铺垫张力）。
    if (sec === 'drop' && step === 14) this._bass(t, mtof(this.sessKey + ch.r - 12 - 5), stepDur * 1.5, 0.5);

    // —— Pad：intro/breakdown/build 漂浮的持续和弦垫底 ——
    if (step === 0 && (sec === 'intro' || sec === 'breakdown' || sec === 'build')) {
      this._pad(t, ch, stepDur * 15, 0.5);
    }

    // —— Supersaw stab：build/drop 段和弦 stabs ——
    if (sec !== 'intro' && step === 0) this._supersaw(t, ch, stepDur * 3, sec === 'drop' ? 0.6 : 0.4);
    if (sec === 'drop' && step === 8) this._supersaw(t, ch, stepDur * 2, 0.45);

    // —— Arp：16 分琶音（drop/build 段持续；breakdown 稀疏）——
    if (sec === 'drop' || sec === 'build' || (sec === 'breakdown' && step % 4 === 0)) {
      this._arp(t, ch, stepDur * 1.5, 0.5, step);
    }

    // —— Lead：drop 段 8 分音符旋律（亮 saw，加 delay）——
    if (sec === 'drop' && step % 2 === 0 && this._rng() < 0.6) {
      this._lead(t, ch, stepDur * 2, 0.4);
    }
  }

  // ---------- 乐器 ----------
  _kick(t, vel) {
    const o = this.ctx.createOscillator(); o.type = 'sine'; const g = this.ctx.createGain();
    // 硬攻击：50→110Hz 下扫比 lofi(115→42) 更利、attack 更快、tail 更长（sub 撑满）。
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.08);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.002); g.gain.setTargetAtTime(0.0001, t + 0.06, 0.18);
    o.connect(g); g.connect(this.drumBus); o.start(t); o.stop(t + 0.6);
    // sub 长尾：再叠一层低 sine 撑 sub 能量。
    const sub = this.ctx.createOscillator(); sub.type = 'sine'; sub.frequency.setValueAtTime(50, t);
    const sg = this.ctx.createGain(); sg.gain.setValueAtTime(0.0001, t); sg.gain.linearRampToValueAtTime(vel * 0.5, t + 0.003); sg.gain.setTargetAtTime(0.0001, t + 0.08, 0.15);
    sub.connect(sg); sg.connect(this.drumBus); sub.start(t); sub.stop(t + 0.5);
    this._duck(t);                   // 触发全局 sidechain
    this.beatPulse = 1;              // 视觉 beat-sync 出口：每个 kick → pulse 1
    this.debug.kicks++;
  }
  _clap(t, vel) {
    // 三层短噪声叠加（clap 的"拍拍拍"质感），2000–4000Hz 带通。
    for (let i = 0; i < 3; i++) {
      const src = this.ctx.createBufferSource(); src.buffer = this._noise;
      const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2500 + i * 400; bp.Q.value = 0.7;
      const g = this.ctx.createGain(); const off = i * 0.012;
      g.gain.setValueAtTime(0.0001, t + off); g.gain.linearRampToValueAtTime(vel * (1 - i * 0.2), t + off + 0.001); g.gain.setTargetAtTime(0.0001, t + off + 0.02, 0.04);
      src.connect(bp); bp.connect(g); g.connect(this.drumBus); src.start(t + off); src.stop(t + off + 0.2);
    }
    this.debug.claps++;
  }
  _hat(t, vel, open) {
    const src = this.ctx.createBufferSource(); src.buffer = this._noise; src.loop = true;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.001);
    g.gain.setTargetAtTime(0.0001, t + 0.005, open ? 0.09 : 0.025);
    src.connect(hp); hp.connect(g); g.connect(this.drumBus); src.start(t); src.stop(t + (open ? 0.25 : 0.12));
  }
  _bass(t, freq, dur, vel) {
    // sub sine（根）+ saw（谐波）双层；低通收紧。比 lofi(单一 triangle) 更厚更沉。
    const o1 = this.ctx.createOscillator(); o1.type = 'sine'; o1.frequency.setValueAtTime(freq, t);
    const o2 = this.ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.setValueAtTime(freq, t);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.008); g.gain.setTargetAtTime(0.0001, t + dur * 0.55, dur * 0.35);
    const sawG = this.ctx.createGain(); sawG.gain.value = 0.4; o2.connect(sawG); sawG.connect(lp); o1.connect(lp); lp.connect(g); g.connect(this.bassBus);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.2); o2.stop(t + dur + 0.2);
  }
  _supersaw(t, ch, dur, vel) {
    // Supersaw：7 路微失谐 sawtooth（±24 cents 展开）→ 低通滤波包络（开→关，Trance stab 标志）。
    const tones = CHORD[ch.c]; const base = this.sessKey + ch.r;
    for (const semi of tones) {
      for (let v = 0; v < 7; v++) {
        const o = this.ctx.createOscillator(); o.type = 'sawtooth';
        const detune = (v - 3) * 8 + (this._rng() - 0.5) * 4;   // ±24 cents 展开 + 微抖
        o.frequency.setValueAtTime(mtof(base + semi + 12), t); o.detune.setValueAtTime(detune, t);
        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(4000, t); lp.frequency.exponentialRampToValueAtTime(1200, t + dur * 0.5);   // 滤波包络（开→关）
        lp.Q.value = 2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel / 7 * 0.5, t + 0.004);
        g.gain.setTargetAtTime(0.0001, t + dur * 0.3, dur * 0.4);
        o.connect(lp); lp.connect(g); g.connect(this.chordBus);
        o.start(t); o.stop(t + dur + 0.3);
      }
    }
    this.debug.chords++;
  }
  _pad(t, ch, dur, vel) {
    // 持续 pad：supersaw 的慢起版（attack 1s、长 release），intro/breakdown 漂浮垫底。
    const tones = CHORD[ch.c]; const base = this.sessKey + ch.r;
    for (const semi of tones) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(mtof(base + semi), t); o.detune.setValueAtTime(-6 + this._rng() * 12, t);
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.5;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel / tones.length, t + 1.0); g.gain.setTargetAtTime(0.0001, t + dur * 0.6, dur * 0.3);
      o.connect(lp); lp.connect(g); g.connect(this.padBus);
      o.start(t); o.stop(t + dur + 1);
    }
  }
  _arp(t, ch, dur, vel, step) {
    // 16 分琶音：音符 = ARP_SCALE[motif 轮廓选] + octave up。亮 saw lead。
    const mi = this.motif[this.motifPos % this.motif.length]; this.motifPos++;
    const idx = mi % ARP_SCALE.length;
    const freq = mtof(this.sessKey + ch.r + ARP_SCALE[idx] + 12);
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t); o.detune.setValueAtTime(this._rng() * 10 - 5, t);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.003); g.gain.setTargetAtTime(0.0001, t + dur * 0.4, dur * 0.3);
    o.connect(lp); lp.connect(g); g.connect(this.arpBus);
    o.start(t); o.stop(t + dur + 0.2);
    this.debug.arps++;
  }
  _lead(t, ch, dur, vel) {
    // 亮 saw lead + delay（1/8 三连反馈）→ Trance 主旋律歌唱感。
    const tones = CHORD[ch.c];
    const colorN = (this._clHue != null) ? this._clHue : 0.5;   // 视野主导簇色相 → 选和弦内音
    const ti = Math.round(colorN * (tones.length - 1));
    const freq = mtof(this.sessKey + ch.r + tones[ti] + 24);
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t);
    const o2 = this.ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.setValueAtTime(freq, t); o2.detune.setValueAtTime(7, t);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.006); g.gain.setTargetAtTime(0.0001, t + dur * 0.5, dur * 0.4);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.leadBus);
    // delay：1/8 三连反馈。
    const delay = this.ctx.createDelay(1.0); delay.delayTime.value = (60 / this.bpm / 2) * 0.667;
    const fb = this.ctx.createGain(); fb.gain.value = 0.4; const wet = this.ctx.createGain(); wet.gain.value = 0.5;
    g.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(this.leadBus);
    o.start(t); o2.start(t); o.stop(t + dur + 0.3); o2.stop(t + dur + 0.3);
  }
  _driveRiser(t) {
    // build 段持续 riser：白噪带通扫频 200→8000Hz + 音量 swell（由 _riserEnv 驱动）。
    const env = this._riserEnv;
    const src = this.ctx.createBufferSource(); src.buffer = this._noise; src.loop = true;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 200 + env * 7800; bp.Q.value = 1.2;
    const g = this.ctx.createGain(); g.gain.value = env * 0.4;
    src.connect(bp); bp.connect(g); g.connect(this.fxBus);
    src.start(t); src.stop(t + 0.4);
  }
  _impact(t) {
    // drop 起点一次性 impact：低 sine thud + 噪声 burst + 长 reverb 尾。
    this._impactEnv = 1;
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(60, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.8);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.setTargetAtTime(0.0001, t + 0.1, 0.4);
    o.connect(g); g.connect(this.fxBus); g.connect(this.revSend); o.start(t); o.stop(t + 1.2);
    const src = this.ctx.createBufferSource(); src.buffer = this._noise;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000;
    const ng = this.ctx.createGain(); ng.gain.setValueAtTime(0.6, t); ng.gain.setTargetAtTime(0.0001, t + 0.05, 0.15);
    src.connect(lp); lp.connect(ng); ng.connect(this.fxBus); src.start(t); src.stop(t + 0.5);
  }

  // sidechain duck：kick 触发，scBus gain 瞬跌 −8dB、150ms 恢复。
  _duck(t) {
    const g = this.scBus.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(0.4, t); g.linearRampToValueAtTime(1, t + 0.15);
  }

  // focus = "跟踪哪个数据" → 一记柔和 lead 音（视野→吟唱，原 audio.js 钩子）。
  _focus(focus, t) {
    const key = focus ? (focus.idx + ':' + focus.sys) : null;
    if (key === this._lastFocusKey) return; this._lastFocusKey = key;
    if (!focus) return;
    const ch = this._chord(), tones = CHORD[ch.c], ti = Math.round((focus.tone || 0.5) * (tones.length - 1));
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(mtof(this.sessKey + ch.r + tones[ti] + 24), t);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3, t + 0.01); g.gain.setTargetAtTime(0.0001, t + 0.3, 0.4);
    o.connect(lp); lp.connect(g); g.connect(this.leadBus); g.connect(this.revSend);
    o.start(t); o.stop(t + 1.5);
  }

  setMuted(b) { this.muted = b; if (this.master) this.master.gain.setTargetAtTime(b ? 0.0001 : 0.85, this.ctx.currentTime, 0.25); }

  // ---------- 工具 ----------
  _satCurve(drive) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * drive); } return c; }
  _reverbIR(sec) { const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) { const tt = i / len; d[i] = (this._rng() * 2 - 1) * Math.pow(1 - tt, 3.0); } } return b; }
  _noiseBuf(sec) { const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = this._rng() * 2 - 1; return b; }
  _rng() { this._s = (this._s == null ? 0x9e3779b9 : this._s + 0x6D2B79F5) | 0; let x = this._s; x = Math.imul(x ^ (x >>> 15), 1 | x); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }
}
