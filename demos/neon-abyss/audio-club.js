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
  min: [0, 3, 7], maj: [0, 4, 7], min7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], maj9: [0, 4, 7, 11, 14],
  min9: [0, 3, 7, 10, 14], min11: [0, 3, 7, 10, 17],
};
// Trance arp 音阶级数（自然小调扩展，跨两个八度）。落音由 musicDNA.motif 轮廓选。
const ARP_SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
// 每次加载的整体移调候选（保持小调听感、不刺耳）。
const SESS_TRANSPOSE = [0, 2, -2, 3, 5, -4, -5, 7];

// —— 情绪模式：每宇宙由 domType(主导数据集) 选一档 → 换和声进行集 + arp/lead 音阶 → 大小调/调式级情绪差异（数据驱动）。
//   "哪个数据世界当家"定基调：房价/政策=minor(严肃)，药品/药企=dorian(希望-小调)，猫=major(轻暖)，kernel/工业/vendor=phrygian(暗/硬)。
//   progs 里 r 相对调根(半音)，c 是和弦类型；scale 均 11 级跨两八度。
const MODES = {
  minor: { progs: PROGS, scale: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24] },
  major: { progs: [
    [{ r: 0, c: 'maj' }, { r: 7, c: 'maj' }, { r: 9, c: 'min' }, { r: 5, c: 'maj' }],    // I–V–vi–IV（经典 uplifting）
    [{ r: 0, c: 'maj9' }, { r: 5, c: 'maj' }, { r: 9, c: 'min7' }, { r: 7, c: 'maj' }],   // I–IV–vi–V
    [{ r: 9, c: 'min9' }, { r: 5, c: 'maj' }, { r: 0, c: 'maj' }, { r: 7, c: 'maj' }],    // vi–IV–I–V
  ], scale: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 19] },
  dorian: { progs: [
    [{ r: 0, c: 'min9' }, { r: 5, c: 'maj' }, { r: 0, c: 'min' }, { r: 10, c: 'maj' }],   // i–IV–i–bVII（dorian vamp，特征大 IV）
    [{ r: 0, c: 'min' }, { r: 5, c: 'maj9' }, { r: 2, c: 'min7' }, { r: 5, c: 'maj' }],    // i–IV–ii–IV
  ], scale: [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17] },
  phrygian: { progs: [
    [{ r: 0, c: 'min' }, { r: 1, c: 'maj' }, { r: 0, c: 'min' }, { r: 10, c: 'maj' }],     // i–bII–i–bVII（西班牙/暗）
    [{ r: 0, c: 'min9' }, { r: 10, c: 'maj' }, { r: 8, c: 'maj' }, { r: 5, c: 'min' }],    // i–bVII–bVI–iv（暗 aeolian，不叠 bII）
  ], scale: [0, 1, 3, 5, 7, 8, 10, 12, 13, 15, 17] },
};
const modeForDom = (dt) => (dt === 7) ? 'major' : (dt === 1) ? 'phrygian' : (dt === 2 || dt === 3 || dt === 5 || dt === 6) ? 'dorian' : 'minor';   // phrygian(最辛辣)只留最硬的 dt=1；其余暗调走 dorian(暗但好蹦)

// 编排段：intro(0–7) → build(8–15) → drop(16–31) → breakdown(32–47) → 循环回 intro(0)。
// 总循环长度 = BARS=48 小节（breakdown 加长到 16 → 情绪中心有呼吸空间，DJ #4b）。所有 cycle 边界都用 BARS，防相位错位。
const BARS = 48;
const sectionOf = (bar) => {
  const b = ((bar % BARS) + BARS) % BARS;
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
    this.modeName = 'minor'; this.progs = PROGS; this.scale = MODES.minor.scale;   // 默认 minor；start() 按 domType 定
    this.patch = { leadSquare: false, sawSpread: 7, kickBoom: 0.35, bassReese: false };   // 音色签名；start() 按 domType+sig 定
    this.motif = [0, 2, 1, 3, 2, 0, 3, 1]; this.motifPos = 0;
    this._lastFocusKey = null;
    this.section = 'intro';
    // beatPulse：0..1。每个 kick 触发 → 1，update() 每帧自然衰减。供视觉 beat-sync 用（替代 mic pulse）。
    this.beatPulse = 0;
    // riser/impact 包络：build 段最后 8 小节 riser 渐强；drop 起点 impact 爆一下。
    this._riserEnv = 0; this._impactEnv = 0;
    this._riserOn = false; this._lastRiserStep = -999;
    this.debug = { steps: 0, kicks: 0, claps: 0, chords: 0, arps: 0, mods: 0, sig: 0 };
    // —— groove-style 系统：A 每宇宙权重 · B 每 cycle(48 小节)确定性轮换 · C 交互实时主导 ——
    this.style = 'trance';          // 本小节生效风格（_onBar 每小节解析）
    this.cycleStyle = 'trance';     // B：当前 cycle 的 ambient 风格
    this.styleW = { trance: 1, polka: 0, hardgroove: 0 };   // A：从 musicDNA 算的每宇宙权重
    this._steerStyle = null; this._steerHold = 0;           // C：交互主导风格 + 剩余保持秒数
    this._styleFill = false;        // 风格切换 → 本小节头补一记过渡 fill
    this._sig0 = 0; this._sV = 0;   // 位置哈希种子 / 声部微抖专用 PRNG（与主 _s 流隔离，保 A+B 确定性）
    // —— DJ-set 呼吸弧：每 breatherEvery 个 cycle(48 小节) 的第 breatherPhase 个做"深呼吸"（half-time + 轻降 BPM）——
    this.bpmBase = 138; this.breatherEvery = 3; this.breatherPhase = 2; this._htActive = false;
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
    // groove-style 隔离种子：_sig0 供位置哈希 _h（不随主 _s 前进）；_sV 供声部微抖（风格变动只扰它、不扰 A+B）。
    this._sig0 = (dna ? (dna.sig >>> 0) : (this._s >>> 0)) | 0;
    this._sV = (this._sig0 ^ 0x1234567) | 0;
    this._computeStyleWeights(dna);                              // A：每宇宙 groove 性格
    this.cycleStyle = this.style = this._pickStyle(this._rng()); // 首个 cycle 也按权重定味（开页惊喜）
    this._steerStyle = null; this._steerHold = 0;

    // 调性根：warm(气候暖度) 定音区中心 → 但每次几乎相同；再叠一个来自 sig(整张密度场指纹, 每次真的变) 的更宽
    //   spread → 每次不同调，仍是"数据自组织指纹塑形音乐"（非随机）。
    const warmCtr = warm < 0.4 ? 43 : warm > 0.7 ? 49 : 46;
    this.keyRoot = warmCtr + (this._sigMix(1) % 10) - 2;      // 中心 −2..+7 半音，跨度更宽（avalanche 混，均匀）
    // 最密簇色相 → 整体移调（听见这片宇宙的主色）。
    const hueStar = dna ? clamp(dna.hueStar, 0, 0.999) : 0.5;
    this.sessKey = this.keyRoot + SESS_TRANSPOSE[Math.floor(hueStar * SESS_TRANSPOSE.length)];
    // 情绪模式：domType(主导数据集) 定 minor/major/dorian/phrygian → 换进行集 + 音阶（大小调级情绪差异，数据驱动）。
    this.modeName = modeForDom(dna ? dna.domType : 0);
    this.progs = MODES[this.modeName].progs; this.scale = MODES[this.modeName].scale;
    // BPM：speedMean(全体星速均值) 近恒定 → 改由 speedSpread(簇速异质度, 会随聚类变) + sig(密度指纹) 驱动更宽区间
    //   128–146，每次不同速、仍数据驱动。
    this.bpm = clamp(Math.round(130 + (dna ? dna.speedSpread : 0.45) * 10 + ((this._sigMix(2) % 17) - 8)), 128, 146);
    // 呼吸弧调度（从 sig 派生，确定性）：每 2–4 个 cycle 一次深呼吸，相位错开 → 同宇宙同一条 tempo 旅程。
    this.bpmBase = this.bpm;
    this.breatherEvery = 2 + (this._sigMix(3) % 3);                 // 2 / 3 / 4 个 cycle 一次
    this.breatherPhase = this._sigMix(4) % this.breatherEvery;
    // 每宇宙音色签名（patch）：domType 定性格 + sig 定具体变体 → 波形/失谐/kick 质感/贝斯型，音色也每次不同（数据驱动）。
    const _pdt = (dna ? dna.domType : 0), _ph = (_pdt === 2 || _pdt === 1 || _pdt === 5);   // kernel/工业/vendor = 硬派
    this.patch = {
      leadSquare: (this._sigMix(7) % 3 === 0),           // 1/3 宇宙用方波 lead（更空/更硬）
      sawSpread: 5 + (this._sigMix(8) % 3) * 2,           // supersaw 失谐展开 5/7/9 cents（窄→宽，收窄防"走音"感）
      kickBoom: _ph ? 0.12 : 0.55,                        // 硬派 punchy(短) / 柔派 boomy(长尾)
      bassReese: _ph || (this._sigMix(9) % 4 === 0),      // 硬派 + 1/4 其它 → reese 双失谐锯贝斯
    };
    // speedSpread → arp swing（异质度高 → arp 更跳）。
    this.arpSwing = 0.04 + (dna ? dna.speedSpread : 0.45) * 0.06;
    // 进行索引：concentration 定基础 + sig(密度指纹, 每次真的变) 旋转 → 每次不同和声走向（concentration 近恒定 → 否则同一条进行）。
    this.baseProgIdx = (Math.floor(clamp(dna ? dna.concentration : 0.4, 0, 0.999) * this.progs.length) + this._sigMix(10)) % this.progs.length;
    // motif（旋律轮廓）：最密簇原型是"固定数据的簇均值"、每次几乎不变 → 旋律只换调不换曲（同 warm→调根 的恒定病）。
    //   用 sig(整张密度场指纹, 每次真的变) 给每位加偏移 → 每次不同旋律，且仍数据驱动（sig = 这片自组织的哈希，"听见这个宇宙"更贴切）。
    const _bm = (dna && dna.motif && dna.motif.length >= 8) ? dna.motif : [0, 2, 1, 3, 2, 0, 3, 1];
    this.motif = _bm.slice(0, 8).map((v, k) => (v + this._sigMix(20 + k)) % 5);
    this.curProgIdx = this.baseProgIdx;

    // ---------- 母带链（亮·响·数字）----------
    // 重限制器：threshold −6dB、ratio 12、attack 0.001s → 追求响度（Trance 母带就是"挤到贴脸"）。
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6; limiter.knee.value = 12; limiter.ratio.value = 12;
    limiter.attack.value = 0.001; limiter.release.value = 0.18;
    const master = ctx.createGain(); master.gain.value = 0; limiter.connect(master); master.connect(ctx.destination); this.master = master;
    // 高频 highshelf +3dB（反转 lofi 的 −4dB 暗暖）+ 轻激励器。
    const sat = ctx.createWaveShaper(); sat.curve = this._satCurve(1.15); sat.oversample = '2x';
    const hiShelf = ctx.createBiquadFilter(); hiShelf.type = 'highshelf'; hiShelf.frequency.value = 3500; hiShelf.gain.value = 1.5;
    sat.connect(hiShelf); hiShelf.connect(limiter);
    // 母线 lowpass：drop 全开、build 末段收窄蓄力、呼吸谷下沉（DJ: drop 要"挣来"——先 filter-down 再砸开）。
    const masterLP = ctx.createBiquadFilter(); masterLP.type = 'lowpass'; masterLP.frequency.value = 20000; masterLP.Q.value = 0.7; this.masterLP = masterLP;
    const mix = ctx.createGain(); mix.gain.value = 1; mix.connect(masterLP); masterLP.connect(sat); this.mix = mix;
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
    const b40 = ((this.bar % BARS) + BARS) % BARS;
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

    // —— C：交互实时主导 groove 风格（focus 强 / 高能注视 弱）。只置 flag，绝不抽 _rng → 不扰动 A+B 确定性流。——
    if (s.focus && s.focus.group != null) {
      this._steerStyle = this._styleForGroup(s.focus.group); this._steerHold = 3.5;   // 按住焦点强主导；松开后 3.5s 内衰减回 ambient
    } else if (s.view && s.view.clEnergy != null && s.view.clEnergy > 0.62 && this._steerHold <= 0) {
      this._steerStyle = 'hardgroove'; this._steerHold = 1.2;                          // 注视高能簇 → 软推硬核（不覆盖更强的 focus 保持）
    }
    if (this._steerHold > 0) this._steerHold -= (s.dt || 0.016);

    // —— DJ 呼吸弧：深呼吸 cycle 的 breakdown = 谷底（half-time + 轻降 ~5 BPM），其余回基准。
    //    真 BPM 平滑 glide：本引擎是 step-scheduler，改 stepDur 只重排后续音符、不 detune 持续音（修正 DJ 的顾虑）；
    //    beatPulse 随 kick 间距慢/快 → 画面同步呼吸。glide 收敛到确定目标（过渡曲线随帧率极微异，不可闻）。
    const cyc = Math.floor(this.bar / BARS);
    const breather = (cyc % this.breatherEvery) === this.breatherPhase;
    this._htActive = breather && sec === 'breakdown';
    const targetBpm = this._htActive ? (this.bpmBase - 5) : this.bpmBase;
    this.bpm += (targetBpm - this.bpm) * clamp((s.dt || 0.016) * 1.5, 0, 1);   // ~2 小节平滑滑到位

    // 母线 lowpass 自动化：drop 全开(snap)；build 末 2 小节收窄(filter-down 蓄力)；呼吸谷下沉。
    let lpT = 20000;
    if (this._htActive) lpT = 1400;                                     // 呼吸谷"下沉"
    else if (sec === 'build' && b40 >= 14) lpT = 2200 + (15 - b40) * 6000;   // bar14≈8200 → bar15≈2200
    if (this.masterLP) this.masterLP.frequency.setTargetAtTime(lpT, t, sec === 'drop' ? 0.02 : 0.14);   // drop 快开=砸；否则平滑

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
    // B：每 cycle(48 小节)边界确定性抽 ambient 风格（主 _s 流、每小节固定次数 → 同宇宙同序列）。
    if (this.bar % BARS === 0) this.cycleStyle = this._pickStyle(this._rng());
    // 解析本小节生效风格：C（交互主导，保持/衰减中）优先，否则 B（ambient cycle 风格）。切换只在小节边界 → 不破拍。
    const prev = this.style;
    this.style = (this._steerHold > 0 && this._steerStyle) ? this._steerStyle : this.cycleStyle;
    // 深呼吸 cycle 全程强制 trance（DJ RED flag：情绪 rest + 经典 trance re-lift 里绝不能出 polka 方波 stab）。
    if ((Math.floor(this.bar / BARS) % this.breatherEvery) === this.breatherPhase) this.style = 'trance';
    // DJ: polka 方波 stab 绝不压在 running drop 上（会把 drop 打成 whiplash）→ drop 段把 polka 顶成 trance（intro/build/breakdown 仍可 polka）。
    if (this.style === 'polka' && sectionOf(this.bar) === 'drop') this.style = 'trance';
    if (this.style !== prev) this._styleFill = true;   // 风格变了 → 本小节头补一记 tom 过渡
  }

  _curProg() { return this.progs[this.curProgIdx] || this.progs[0]; }
  _chord() { const p = this._curProg(); return p[(this.bar >> 1) % p.length]; }

  // 声部微抖专用 PRNG（与主 _s 隔离）：风格切换改变声部调用次数时只扰它、不扰 _onBar 的 A+B 流。
  _rngV() { this._sV = (this._sV + 0x6D2B79F5) | 0; let x = this._sV; x = Math.imul(x ^ (x >>> 15), 1 | x); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }
  // 位置哈希 → [0,1)：纯 (宇宙,小节,步,salt) 函数，与调用顺序无关 → 风格/交互门控不会错位任何流。
  _h(salt) { let x = (this._sig0 ^ Math.imul(this.bar + 1, 0x9e3779b9) ^ Math.imul(this.step + 1, 0x85ebca6b) ^ Math.imul((salt | 0) + 1, 0xc2b2ae35)) | 0; x = Math.imul(x ^ (x >>> 16), 0x7feb352d); x = Math.imul(x ^ (x >>> 15), 0x846ca68b); x ^= x >>> 16; return (x >>> 0) / 4294967296; }
  // 从密度指纹 _sig0 + salt 派生一个良好去相关的 uint32（avalanche）：用于每宇宙一次性的选调/速/呼吸调度，位切片会有偏、必须混。
  _sigMix(salt) { let x = (this._sig0 ^ Math.imul((salt | 0) + 1, 0x9e3779b9)) | 0; x = Math.imul(x ^ (x >>> 16), 0x7feb352d); x = Math.imul(x ^ (x >>> 15), 0x846ca68b); x ^= x >>> 16; return x >>> 0; }
  // A：musicDNA → 每宇宙 {trance,polka,hardgroove} 权重（trance 保底主导 → 风味"偶现"）。
  _computeStyleWeights(dna) {
    let wt = 1.0, wp = 0.0, wh = 0.0;
    const dt = dna ? dna.domType : 0;
    if (dt === 2 || dt === 1 || dt === 5) wh += 0.9;              // kernel / 工业产品 / vendor → 硬派
    else if (dt === 7 || dt === 6) wp += 0.9;                     // 收容所猫 / 医药 → 俏皮
    else wt += 0.4;                                               // 房价 / 政策 / 其它 → trance
    wh += (dna ? dna.speedSpread : 0.45) * 0.6;                   // 簇速异质 → 滚动 hard groove
    wp += (1 - (dna ? dna.concentration : 0.4)) * 0.5;           // 组织松散 → 弹跳 polka
    const s = wt + wp + wh || 1;
    this.styleW = { trance: wt / s, polka: wp / s, hardgroove: wh / s };
  }
  _pickStyle(r) { const w = this.styleW; return r < w.trance ? 'trance' : (r < w.trance + w.polka ? 'polka' : 'hardgroove'); }
  _styleForGroup(g) { return (g === 2 || g === 1 || g === 5) ? 'hardgroove' : ((g === 7 || g === 6) ? 'polka' : 'trance'); }

  _scheduleStep(gridT, stepDur) {
    const step = this.step % 16, bar = this.bar;
    const swing = (step % 2 === 1) ? stepDur * this.arpSwing : 0;
    const t = gridT + swing;
    const ch = this._chord();
    const sec = sectionOf(bar);
    const b40 = ((bar % BARS) + BARS) % BARS;
    const breather = (Math.floor(bar / BARS) % this.breatherEvery) === this.breatherPhase;
    const valley = breather && sec === 'breakdown';           // 深呼吸谷底（half-time 段）
    const style = this.style;                                  // 本小节生效 groove 风格（呼吸 cycle 已被 _onBar 强制 trance）
    const drumOn = sec === 'build' || sec === 'drop';
    const kickOn = sec !== 'breakdown';                        // intro 也打轻 kick 维持律动

    // 静音缺口：build 最后一小节的最后半拍全体静默 → 紧接的 drop 砸得更狠（DJ: re-lift 的 tension cue 必须有）。
    if (sec === 'build' && b40 === 15 && step >= 14) return;
    // build 末段加速拍手 roll（bar 14=8分、bar 15=16分）导入 drop。
    if (sec === 'build' && (b40 === 14 || b40 === 15) && step % (b40 === 15 ? 1 : 2) === 0) {
      this._clap(t, 0.22 + (b40 - 14) * 0.18 + step * 0.008);
    }
    // 深呼吸谷底：half-time kick（1&3）+ 一记长 sub + 稀疏 hat + 塌入过渡 → "歇一口气、慢下来"（BPM 亦已轻降 ~5）。
    if (valley) {
      if (step === 0 || step === 8) this._kick(t, 0.72, false);
      if (step === 4 || step === 12) this._hat(t, 0.18, false);
      if (step === 0) this._bass(t, mtof(this.sessKey + ch.r - 12), stepDur * 8, 0.55);
      if (b40 === 32 && step === 0) { this._tom(t, 100, 0.5); this._tom(t + stepDur * 0.5, 78, 0.45); }
    }

    // 风格切换过渡：本小节头一记下行 tom 三连，宣告 groove 变化（不破拍）。
    if (this._styleFill && step === 0) {
      this._tom(t, 180, 0.5); this._tom(t + stepDur * 0.5, 140, 0.45); this._tom(t + stepDur, 110, 0.5);
      this._styleFill = false;
    }

    // —— kick：four-on-the-floor；hardgroove 更硬（加高通 click）——
    if (kickOn && step % 4 === 0) this._kick(t, sec === 'drop' ? 1.0 : (sec === 'intro' ? 0.7 : 0.9), style === 'hardgroove');
    if (drumOn && (step === 4 || step === 12)) this._clap(t, 0.7);
    if (drumOn && step % 2 === 1) this._hat(t, style === 'hardgroove' ? 0.34 : 0.3, false);   // 16 分闭镲（off-beat）
    if (sec === 'drop' && step % 4 === 2) this._hat(t, 0.4, true);                            // off-beat 开镲（drop 专属）
    if (sec === 'drop' && (bar & 7) === 7 && step >= 13) this._clap(t, 0.4);                  // 8 小节末 fill

    // —— hardgroove 专属：切分滚动 tom（call-response）+ 16 分 shaker 滚（位置哈希门控，绝不抽流）——
    if (style === 'hardgroove' && drumOn) {
      if ((step === 3 || step === 6 || step === 7 || step === 10 || step === 14 || step === 15) && this._h(1) < 0.85) {
        this._tom(t, (step % 2 === 0 ? 120 : 165) + this._h(2) * 20, 0.42);
      }
      this._shaker(t, 0.15 + this._h(3) * 0.14 + (step % 4 === 2 ? 0.12 : 0));
    }

    // —— 贝斯：polka=落拍短断奏(oom)；trance/hardgroove=落拍长贝斯；hardgroove 另加反拍 rumble ghost ——
    if (drumOn && step % 4 === 0) {
      this._bass(t, mtof(this.sessKey + ch.r - 12), stepDur * (style === 'polka' ? 0.9 : 3.2), style === 'polka' ? 0.9 : 0.95);
    }
    if (style === 'hardgroove' && drumOn && (step === 6 || step === 14)) {
      this._bass(t, mtof(this.sessKey + ch.r - 12), stepDur * 1.1, 0.5);                       // 反拍切分低音（滚动 rumble）
    }
    if (sec === 'drop' && step === 14 && style !== 'polka') this._bass(t, mtof(this.sessKey + ch.r - 12 - 5), stepDur * 1.5, 0.5);

    // —— polka 专属：反拍 oom-pah "pah"（明亮八度断奏 stab，走 chordBus 吃泵）——
    if (style === 'polka' && drumOn && step % 4 === 2) this._oompah(t, ch, stepDur * 0.7, 0.4);

    // —— Pad：intro/breakdown/build 漂浮垫底；polka 撤 pad（要弹跳不要垫）——
    if (step === 0 && style !== 'polka' && (sec === 'intro' || sec === 'breakdown' || sec === 'build')) {
      this._pad(t, ch, stepDur * 15, 0.5);
    }

    // —— Supersaw stab：hardgroove 收敛让位打击；polka 更短更拨 ——
    if (sec !== 'intro' && step === 0) {
      if (style === 'hardgroove') { if (sec === 'drop') this._supersaw(t, ch, stepDur * 1.6, 0.32); }
      else this._supersaw(t, ch, stepDur * (style === 'polka' ? 1.4 : 3), sec === 'drop' ? (style === 'polka' ? 0.5 : 0.6) : 0.4);
    }
    if (sec === 'drop' && step === 8 && style === 'trance') this._supersaw(t, ch, stepDur * 2, 0.45);

    // —— Arp：16 分琶音（drop/build；breakdown 稀疏）；hardgroove 半密度让位打击 ——
    if ((sec === 'drop' || sec === 'build' || (sec === 'breakdown' && step % 4 === 0)) && !(style === 'hardgroove' && step % 2 === 1)) {
      this._arp(t, ch, stepDur * 1.5, 0.5, step);
    }

    // —— Lead：drop 段旋律；hardgroove 撤 lead（打击当家）。门用位置哈希 _h（不抽流 → 风格无关）。——
    if (sec === 'drop' && step % 2 === 0 && style !== 'hardgroove' && this._h(4) < 0.6) {
      this._lead(t, ch, stepDur * 2, 0.4);
    }
    // —— Breakdown 主旋律 hook（DJ: track 需一条暴露的 topline —— rest 段唱、drop 段再现）：
    //    暴露、拉长的 topline → **永远和弦内音**（consonant；原来用音阶级数叠 ch.r，裸露且长音，不和谐最扎耳）；
    //    色彩来自选的是 3 音/5 音/9 音而非音阶步进。音由 (bar,step) 确定性索引 → 同宇宙同旋律。
    if (sec === 'breakdown' && (step === 0 || step === 6 || step === 10)) {
      const mi = this.motif[(this.bar * 3 + (step === 0 ? 0 : step === 6 ? 1 : 2)) % this.motif.length];
      const tones = CHORD[ch.c];
      this._lead(t, ch, stepDur * 3, 0.34, this.sessKey + ch.r + tones[mi % tones.length] + 12);
    }
  }

  // ---------- 乐器 ----------
  _kick(t, vel, hard) {
    const o = this.ctx.createOscillator(); o.type = 'sine'; const g = this.ctx.createGain();
    // 硬攻击：50→110Hz 下扫比 lofi(115→42) 更利、attack 更快、tail 更长（sub 撑满）。
    const kb = this.patch.kickBoom;   // 音色签名：boomy(长尾低扫) ↔ punchy(短)
    o.frequency.setValueAtTime(110 - kb * 20, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.08 + kb * 0.05);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.002); g.gain.setTargetAtTime(0.0001, t + 0.06 + kb * 0.04, 0.18 + kb * 0.18);
    o.connect(g); g.connect(this.drumBus); o.start(t); o.stop(t + 0.6);
    // sub 长尾：再叠一层低 sine 撑 sub 能量。
    const sub = this.ctx.createOscillator(); sub.type = 'sine'; sub.frequency.setValueAtTime(50, t);
    const sg = this.ctx.createGain(); sg.gain.setValueAtTime(0.0001, t); sg.gain.linearRampToValueAtTime(vel * 0.5, t + 0.003); sg.gain.setTargetAtTime(0.0001, t + 0.08, 0.15);
    sub.connect(sg); sg.connect(this.drumBus); sub.start(t); sub.stop(t + 0.5);
    if (hard) {                       // hardgroove：加一记高通 click transient → 更"点"更硬更 tribal。
      const c = this.ctx.createBufferSource(); c.buffer = this._noise;
      const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
      const cg = this.ctx.createGain(); cg.gain.setValueAtTime(vel * 0.5, t); cg.gain.setTargetAtTime(0.0001, t + 0.004, 0.012);
      c.connect(hp); hp.connect(cg); cg.connect(this.drumBus); c.start(t); c.stop(t + 0.05);
    }
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
  _tom(t, freq, vel) {
    // 部落 tom/conga：pitched sine + 快速降调 + 一点带通噪声击感。走 drumBus（直连、不被 duck、punchy）。
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.14);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.004); g.gain.setTargetAtTime(0.0001, t + 0.05, 0.10);
    o.connect(g); g.connect(this.drumBus); o.start(t); o.stop(t + 0.4);
    const n = this.ctx.createBufferSource(); n.buffer = this._noise;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq * 1.5; bp.Q.value = 1.2;
    const ng = this.ctx.createGain(); ng.gain.setValueAtTime(vel * 0.25, t); ng.gain.setTargetAtTime(0.0001, t + 0.01, 0.03);
    n.connect(bp); bp.connect(ng); ng.connect(this.drumBus); n.start(t); n.stop(t + 0.15);
  }
  _shaker(t, vel) {
    // 16 分 shaker：高通短噪 tick（hardgroove 的滚动细碎质感）。走 drumBus。
    const src = this.ctx.createBufferSource(); src.buffer = this._noise;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.002); g.gain.setTargetAtTime(0.0001, t + 0.006, 0.02);
    src.connect(hp); hp.connect(g); g.connect(this.drumBus); src.start(t); src.stop(t + 0.08);
  }
  _oompah(t, ch, dur, vel) {
    // polka 反拍 "pah"：明亮上八度方波断奏 stab（手风琴/风琴俏皮感）。走 chordBus → 吃 sidechain 泵。
    const tones = CHORD[ch.c]; const base = this.sessKey + ch.r + 12;
    for (const semi of tones) {
      const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(mtof(base + semi), t);
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 1;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel / tones.length, t + 0.004); g.gain.setTargetAtTime(0.0001, t + dur * 0.25, dur * 0.25);
      o.connect(lp); lp.connect(g); g.connect(this.chordBus);
      o.start(t); o.stop(t + dur + 0.1);
    }
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
    if (this.patch.bassReese) {   // reese：第二路失谐锯 → 更 growly 更硬（音色签名）
      o2.detune.setValueAtTime(-9, t);
      const o3 = this.ctx.createOscillator(); o3.type = 'sawtooth'; o3.frequency.setValueAtTime(freq, t); o3.detune.setValueAtTime(9, t);
      o3.connect(sawG); o3.start(t); o3.stop(t + dur + 0.2);
    }
  }
  _supersaw(t, ch, dur, vel) {
    // Supersaw：7 路微失谐 sawtooth（±24 cents 展开）→ 低通滤波包络（开→关，Trance stab 标志）。
    const tones = CHORD[ch.c]; const base = this.sessKey + ch.r;
    for (const semi of tones) {
      for (let v = 0; v < 7; v++) {
        const o = this.ctx.createOscillator(); o.type = 'sawtooth';
        const detune = (v - 3) * this.patch.sawSpread + (this._rngV() - 0.5) * 3;   // 失谐展开(patch 音色签名) + 微抖（隔离流）
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
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(mtof(base + semi), t); o.detune.setValueAtTime(-6 + this._rngV() * 12, t);
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.5;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel / tones.length, t + 1.0); g.gain.setTargetAtTime(0.0001, t + dur * 0.6, dur * 0.3);
      o.connect(lp); lp.connect(g); g.connect(this.padBus);
      o.start(t); o.stop(t + dur + 1);
    }
  }
  _arp(t, ch, dur, vel, step) {
    // 16 分琶音：默认选**当前和弦内音**(root/3/5/7/9) → consonant（修：原来把 key 相对音阶叠到 ch.r 上，大调和弦上频繁
    //   b3 撞 3 —— 最刺耳的音程；改成和弦音后半首曲子的不和谐消失）。motif 轮廓 + 八度铺开仍"跑"；小节头锚根音 → hook 稳；
    //   ~16% 非拍点允许一个 key 相对音阶经过音做 spice（偶尔出彩；音阶本就相对调根，**不叠 ch.r**）。
    const mi = this.motif[this.motifPos % this.motif.length]; this.motifPos++;
    const tones = CHORD[ch.c];
    let note;
    if (step % 16 === 0) note = this.sessKey + ch.r + tones[0] + 12;                              // 小节头锚和弦根音
    else if ((step % 2 === 1) && this._h(11) < 0.16) note = this.sessKey + this.scale[(mi + 2) % 6] + 12;   // spice：key 相对经过音（不加 ch.r）
    else note = this.sessKey + ch.r + tones[mi % tones.length] + 12 * Math.floor(mi / tones.length) + 12;   // 和弦内音，随轮廓升八度
    const freq = mtof(note);
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t); o.detune.setValueAtTime(this._rngV() * 10 - 5, t);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.003); g.gain.setTargetAtTime(0.0001, t + dur * 0.4, dur * 0.3);
    o.connect(lp); lp.connect(g); g.connect(this.arpBus);
    o.start(t); o.stop(t + dur + 0.2);
    this.debug.arps++;
  }
  _lead(t, ch, dur, vel, forceNote) {
    // 亮 saw lead + delay（1/8 三连反馈）→ Trance 主旋律歌唱感。forceNote!=null 时用指定音（breakdown hook 走 motif+mode scale）。
    const tones = CHORD[ch.c];
    const colorN = (this._clHue != null) ? this._clHue : 0.5;   // 视野主导簇色相 → 选和弦内音
    const ti = Math.round(colorN * (tones.length - 1));
    const freq = mtof(forceNote != null ? forceNote : (this.sessKey + ch.r + tones[ti] + 24));
    const lw = this.patch.leadSquare ? 'square' : 'sawtooth';   // 音色签名：方波=更空/更硬
    const o = this.ctx.createOscillator(); o.type = lw; o.frequency.setValueAtTime(freq, t);
    const o2 = this.ctx.createOscillator(); o2.type = lw; o2.frequency.setValueAtTime(freq, t); o2.detune.setValueAtTime(7, t);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = this.patch.leadSquare ? 4200 : 6000;   // 方波 lead 收高频防刺耳
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
    g.cancelScheduledValues(t); g.setValueAtTime(0.4, t); g.setTargetAtTime(1, t + 0.001, 0.06);   // 指数恢复 → 更"泵"的 sidechain 呼吸（DJ：线性太 limp）
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
