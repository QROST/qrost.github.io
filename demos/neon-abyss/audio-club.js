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
//   · DJ-set 宏弧：15–25 分钟循环的"整晚旅程"（warmup → lift → peak → afterglow；日程长度/顺序/能量顶点
//     每宇宙由 sig 折叠(salt 41..46) × DNA 聚合量导出，见 _applyDNA 尾部 + _updateSetPhase）。
//     只读出口 getSetPhase() 供视觉侧做极轻分级（bloom 基线 ±10%），复用对象、零每帧分配。

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
  min: [0, 3, 7], maj: [0, 4, 7], min7: [0, 3, 7, 10], maj9: [0, 4, 7, 14],   // maj9 实为 add9 voicing：去 maj7(11) —— 11 与旋律高八度根(+12/+24)天生小二度/小九度撞（arp 锚根、lead 唱根时必刺），去源头；9th 色彩由 14 保留
  min9: [0, 3, 7, 10, 14],                                                     // （maj7 条目已删：progs 全表 0 使用，留着只会被未来误用再引回 11）
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
// 相邻情绪调式映射（多样性 pass 定义）：暗↔暗亮、明→暗亮、辛辣→标准暗（不跨到反差极端）。
// 两个消费者共用：_applyDNA 的 30% 情绪翻转 + DJ-set 宏弧 afterglow 调式转换（_updateSetPhase）。
// 所有 MODES 进行都已过 check-harmony 门禁 → 任意档间切换不会引入新的 m2/m9 撞车。
const _altMode = { minor: 'dorian', dorian: 'minor', major: 'dorian', phrygian: 'minor' };

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
    this.drumVar = 0; this._leadContour = 0; this._leadAlt = false;   // 鼓面变体 / lead 乐句轮廓（start() 按 sig 定）
    this._nat = null;   // 自然乐器（悦耳度二期）预渲染 buffer 缓存：breakdown 钢琴 / pluck 琶音（start 建，觉醒清）
    this._spicePrev = false; this._spiceSet = [2];   // arp spice 状态 + 安全扩展集（start 按 mode 定）
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
    // —— SOM 觉醒：页面在 SOM 训完前开声 → start() 吃 fallback DNA（沉睡态：编曲收敛、styleW 保守、hook/lead 按下不表）。
    //    SOM 训完、musicDNA 到位 → updateDNA() 排到下一个 8-bar 边界重推导 + 音乐化绽放（riser + 滤波扫频 + 编曲层展开），让"宇宙自组织完成"这一刻听得见。
    this._dnaIsFallback = false; this._pendingDNA = null; this._fallbackWarm = 0.5;
    this._awakenArmed = false; this._awakenBar = 0; this._awakenFire = false; this._awakenSweepUntil = 0;
    // —— DJ-set 宏弧（15–25 分钟循环的"整晚旅程"）：warmup → lift → peak → afterglow 相位机 ——
    //    日程与能量天花板在 _applyDNA 尾部由 sig 折叠(salt 41..46) × DNA 聚合量导出；相位只在 _onBar 边界解析（_updateSetPhase，纯函数、不推进 _rng）。
    this.setPhase = 'warmup'; this._phaseE = 0.34; this.phaseVis = 0.34;
    this._setStartBar = 0; this._setLen = BARS * 12; this._setSegPh = ['warmup']; this._setSegEnd = [BARS * 12];
    this._setPhaseE = { warmup: 0.34, lift: 0.62, peak: 0.9, afterglow: 0.42 };
    this._modeShiftOn = false; this._modeShifted = false; this._modeBase = 'minor'; this._baseProgIdxBase = 0;
    this._phaseInfo = { phase: 'warmup', energy: 0.34, energyVis: 0.34 };   // getSetPhase() 复用对象（视觉侧每帧读 → 零每帧分配）
  }

  start(ctx, opts = {}) {
    if (this.started) { try { ctx.resume && ctx.resume(); } catch (_) {} this.setMuted(false); return; }
    this.ctx = ctx; this.started = true;
    const t = ctx.currentTime;
    // 数据涌现签名 → 确定性 PRNG 种子（零 Math.random）。无 DNA 兜底也从 climWarm 派生（仍来自数据）。
    const dna = (opts && opts.sig != null) ? opts : null;
    const warmRaw = dna ? dna.warm : opts.climWarm;
    const warm = clamp(warmRaw == null ? 0.5 : warmRaw, 0, 1);
    this._fallbackWarm = warm;                                    // 兜底 warm 快照：fallback→真 DNA 前 _applyDNA 的 fallback 分支复用
    this._s = (dna ? (dna.sig >>> 0) : ((Math.round(warm * 1e6) ^ 0x9e3779b9) >>> 0)) | 0;
    // 全部依赖 dna 的推导抽到 _applyDNA（纯 _sigMix / _sig0 驱动，不碰 ctx、不推进 _rng）→ start 与"觉醒"共用一条推导路径。
    this._applyDNA(dna);
    this.bpm = this.bpmBase;                                      // start 时直接落速；觉醒时留给 update() 平滑 glide 到新 bpmBase
    this.cycleStyle = this.style = this._pickStyle(this._rng());  // 首个 cycle 按权重定味（开页惊喜）—— 唯一推进 _rng 的一处，仅 start
    this._steerStyle = null; this._steerHold = 0;

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
    this.leadBus = ctx.createGain(); this.leadBus.gain.value = 0.32;
    this._arpBaseGain = 0.26; this.arpBus = ctx.createGain(); this.arpBus.gain.value = this._arpBaseGain;
    // 微弱空间声像（可用时才启用，宁欠勿过）：leadBus/arpBus 各串一个 StereoPannerNode，承载视觉侧"当前主导簇"位置的极轻声像感。
    // 不支持 createStereoPanner 的浏览器 → 特性整体静默跳过，两条 bus 直连回原有路径。
    this.leadPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    this.arpPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (this.leadPan) { this.leadBus.connect(this.leadPan); this.leadPan.connect(this.scBus); this.leadPan.connect(revSend); }
    else { this.leadBus.connect(this.scBus); this.leadBus.connect(revSend); }
    if (this.arpPan) { this.arpBus.connect(this.arpPan); this.arpPan.connect(this.scBus); this.arpPan.connect(revSend); }
    else { this.arpBus.connect(this.scBus); this.arpBus.connect(revSend); }
    this.padBus = ctx.createGain(); this.padBus.gain.value = 0.22; this.padBus.connect(this.scBus); this.padBus.connect(revSend);

    // fx bus：riser / impact 走自己的通道（不受 sidechain，独立 swell/blast）。
    this.fxBus = ctx.createGain(); this.fxBus.gain.value = 0.5; this.fxBus.connect(mix);

    // 噪声 buffer（clap / riser / impact 共用）。
    this._noise = this._noiseBuf(3.0);
    this._nat = new Map();   // 自然乐器预渲染缓存（激励读 _noise → 依赖它先建好）

    this.master.gain.setTargetAtTime(0.85, t, 1.2);
    this.nextTime = t + 0.12;
  }

  // 全部依赖 musicDNA 的确定性推导（零 ctx、零 Math.random、只用 _sigMix/_sig0 无状态哈希 → 绝不推进 _rng 流）。
  //   start() 首次调用（dna 可为 null=兜底沉睡态）；updateDNA() 在觉醒边界二次调用（真 DNA）→ 同一路径重推导所有参数。
  _applyDNA(dna) {
    this.dna = dna;
    this._dnaIsFallback = !dna;
    this.debug.sig = dna ? (dna.sig >>> 0) : 0;
    const warmRaw = dna ? dna.warm : this._fallbackWarm;
    const warm = clamp(warmRaw == null ? 0.5 : warmRaw, 0, 1);
    // groove-style 隔离种子：_sig0 供位置哈希 _h / _sigMix（不随主 _s 前进）；_sV 供声部微抖（风格变动只扰它、不扰 A+B）。
    this._sig0 = (dna ? (dna.sig >>> 0) : (this._s >>> 0)) | 0;
    this._sV = (this._sig0 ^ 0x1234567) | 0;
    this._computeStyleWeights(dna);                          // A：每宇宙 groove 性格
    if (this._dnaIsFallback) this.styleW = { trance: 1, polka: 0, hardgroove: 0 };   // 沉睡态：styleW 保守（纯 trance，绝不 polka/hardgroove）

    // 调性根：warm(气候暖度) 定音区中心 → 但每次几乎相同；再叠一个来自 sig(整张密度场指纹, 每次真的变) 的更宽
    //   spread → 每次不同调，仍是"数据自组织指纹塑形音乐"（非随机）。
    const warmCtr = warm < 0.4 ? 43 : warm > 0.7 ? 49 : 46;
    this.keyRoot = warmCtr + (this._sigMix(1) % 10) - 2;      // 中心 −2..+7 半音，跨度更宽（avalanche 混，均匀）
    // 最密簇色相 → 整体移调（听见这片宇宙的主色）。
    const hueStar = dna ? clamp(dna.hueStar, 0, 0.999) : 0.5;
    this.sessKey = this.keyRoot + SESS_TRANSPOSE[Math.floor(hueStar * SESS_TRANSPOSE.length)];
    // 情绪模式：domType(主导数据集) 定基调 —— 但 domType 是聚合量(最密簇=最大数据集, argmax 每次相同)，单靠它 mode 每次恒定
    //   = "跨 session 熟悉感"的头号来源。sig 折叠(同 03bd523 哲学)：70% 保 domType 基调、30% 换到情绪相邻档（仍确定性、仍数据驱动）。
    const _baseMode = modeForDom(dna ? dna.domType : 0);
    this.modeName = (this._sigMix(30) % 10 < 3) ? _altMode[_baseMode] : _baseMode;
    this.progs = MODES[this.modeName].progs; this.scale = MODES[this.modeName].scale;
    this._spiceSet = [2];   // spice 安全集：只用 9th(add9) —— 对表里每种和弦都 consonant（6th 对小调 b3 是三全音，弃用）→ 最舒适
    // BPM：speedMean(全体星速均值) 近恒定 → 改由 speedSpread(簇速异质度, 会随聚类变) + sig(密度指纹) 驱动更宽区间
    //   128–146，每次不同速、仍数据驱动。start 直接落到 bpmBase；觉醒时只换 bpmBase，this.bpm 留给 update() 平滑 glide。
    this.bpmBase = clamp(Math.round(130 + (dna ? dna.speedSpread : 0.45) * 10 + ((this._sigMix(2) % 17) - 8)), 128, 146);
    // 呼吸弧调度（从 sig 派生，确定性）：每 2–4 个 cycle 一次深呼吸，相位错开 → 同宇宙同一条 tempo 旅程。
    this.breatherEvery = 2 + (this._sigMix(3) % 3);                 // 2 / 3 / 4 个 cycle 一次
    this.breatherPhase = this._sigMix(4) % this.breatherEvery;
    // 每宇宙音色签名（patch）：domType 定性格 + sig 定具体变体 → 波形/失谐/kick 质感/贝斯型，音色也每次不同（数据驱动）。
    const _pdt = (dna ? dna.domType : 0), _ph = (_pdt === 2 || _pdt === 1 || _pdt === 5);   // kernel/工业/vendor = 硬派
    this.patch = {
      leadSquare: (this._sigMix(7) % 3 === 0),           // 1/3 宇宙用方波 lead（更空/更硬）
      sawSpread: 5 + (this._sigMix(8) % 3) * 2,           // supersaw 失谐展开 5/7/9 cents（窄→宽，收窄防"走音"感）
      kickBoom: clamp((_ph ? 0.12 : 0.55) + ((this._sigMix(32) % 31) - 15) / 100, 0.05, 0.7),   // domType 定性格 + sig ±0.15 → kick 手感每宇宙微变（原先二值恒定）
      bassReese: _ph || (this._sigMix(9) % 4 === 0),      // 硬派 + 1/4 其它 → reese 双失谐锯贝斯
    };
    this.drumVar = this._sigMix(33) % 3;                  // 鼓面变体 0/1/2：four-on-floor kick 不动（trance 身份），hat/clap 织体换（原先全硬编码=主节奏每次一模一样）
    // 自然乐器（悦耳度二期，salt 52/53 两引擎均未占用）：~60% 宇宙 breakdown/intro 有情绪钢琴（trance 经典），
    // ~40% 宇宙 16 分琶音换 Karplus-Strong pluck（同一音高选择路径 → 和声枚举不动）。觉醒/重推导时缓存重建。
    this.patch.pianoBrk = (this._sigMix(52) % 10) < 6;
    this.patch.arpPluck = (this._sigMix(53) % 10) < 4;
    // 三期（salt 58/59 两引擎均未占用）：~40% 宇宙 breakdown 奇数小节竖琴琶音（与偶数小节钢琴成同和弦 call-response）；
    // ~40% 宇宙 pad 换 string-machine（Solina 式反相慢漩涡双锯）。
    this.patch.harpBrk = (this._sigMix(58) % 10) < 4;
    this.patch.strPad = (this._sigMix(59) % 10) < 4;
    if (this._nat) this._nat.clear();
    this._leadContour = this._sigMix(34) % 3;             // lead 乐句轮廓型：0=邻上摆 1=邻下摆 2=五度跳（原先 lead 只反复唱 colorN 单音=主旋律记忆点恒定）
    // speedSpread → arp swing（异质度高 → arp 更跳）。
    this.arpSwing = 0.04 + (dna ? dna.speedSpread : 0.45) * 0.06;
    // 进行索引：concentration 定基础 + sig(密度指纹, 每次真的变) 旋转 → 每次不同和声走向（concentration 近恒定 → 否则同一条进行）。
    this.baseProgIdx = (Math.floor(clamp(dna ? dna.concentration : 0.4, 0, 0.999) * this.progs.length) + this._sigMix(10)) % this.progs.length;
    // motif（旋律轮廓）：最密簇原型是"固定数据的簇均值"、每次几乎不变 → 旋律只换调不换曲（同 warm→调根 的恒定病）。
    //   用 sig(整张密度场指纹, 每次真的变) 给每位加偏移 → 每次不同旋律，且仍数据驱动（sig = 这片自组织的哈希，"听见这个宇宙"更贴切）。
    const _bm = (dna && dna.motif && dna.motif.length >= 8) ? dna.motif : [0, 2, 1, 3, 2, 0, 3, 1];
    this.motif = _bm.slice(0, 8).map((v, k) => (v + this._sigMix(20 + k)) % 5);
    this.curProgIdx = this.baseProgIdx;

    // —— DJ-set 宏弧日程（循环，非一次性）：1 cycle = BARS(48) 小节 ≈ 79–90s（bpm 128–146）→ 总长 12–16 cycle ≈ 15–24 min。
    //    日程长度/顺序/能量顶点 = sig 折叠(salt 41..46) × DNA 聚合量（concentration/speedSpread）共同导出 —— 每宇宙一场不同的"整晚"。
    const _cc = clamp(dna ? dna.concentration : 0.4, 0, 1);
    const _sp = clamp(dna ? dna.speedSpread : 0.45, 0, 1);
    const _apex = clamp(0.82 + _sp * 0.06 + (this._sigMix(43) % 13) / 100, 0.82, 1);   // 能量顶点 0.82..1.0（多值分布）
    this._setPhaseE = { warmup: 0.34, lift: 0.62, peak: _apex, afterglow: 0.42 };
    const _formR = (this._sigMix(41) % 100) / 100 + _sp * 0.25;                        // 簇速异质度高 → 更易双峰 set
    const _form = _formR < 0.45 ? 0 : (_formR < 0.8 ? 1 : 2);                          // 0=classic 单峰 1=twin-peak 双峰(peak–re-lift–peak) 2=slow-burn 慢烧(晚峰长暖场)
    const _j2 = this._sigMix(42) % 2, _j4 = this._sigMix(44) % 2, _j6 = this._sigMix(46) % 2;
    const _pk = Math.round(_cc * 2);                                                    // 组织越紧 → peak 越长（+0..2 cycle）
    let _segs;                                                                          // [[相位, cycle 数], ...]（一次性小分配，仅 start/觉醒各一次）
    if (_form === 0)      _segs = [['warmup', 3 + _j2], ['lift', 3], ['peak', 3 + _pk], ['afterglow', 2 + _j6]];
    else if (_form === 1) _segs = [['warmup', 2 + _j2], ['lift', 2], ['peak', 2 + Math.round(_cc)], ['lift', 1], ['peak', 2 + _j4], ['afterglow', 2]];
    else                  _segs = [['warmup', 4 + _j2], ['lift', 3 + _j4], ['peak', 3 + _pk], ['afterglow', 2]];
    let _totC = 0; for (const sg of _segs) _totC += sg[1];
    while (_totC < 12) { _segs[_segs.length - 1][1]++; _totC++; }                       // 兜底：总长 ≥ 12 cycle（~15 min 下限）
    this._setSegPh = _segs.map((sg) => sg[0]);
    this._setSegEnd = []; { let acc = 0; for (const sg of _segs) { acc += sg[1] * BARS; this._setSegEnd.push(acc); } this._setLen = acc; }
    this._modeShiftOn = (this._sigMix(45) % 3) === 0;                                   // 1/3 宇宙在 afterglow 转一次相邻情绪调式（_altMode 表，全部 MODES 已过和声门禁）
    this._modeBase = this.modeName; this._modeShifted = false; this._baseProgIdxBase = this.baseProgIdx;
    // set 起点（相位状态在觉醒时【重置】而非延续，理由）：fallback 沉睡期的日程来自兜底 sig、与真宇宙无关，延续它没有意义；
    //   重置保证真 DNA 的日程从头完整走一遍。且沉睡期音乐上就是这场 set 的 warm-up —— 觉醒绽放冲击 = set 正式抬升的那一刻，
    //   故觉醒(bar>0 且真 DNA)直接落到 lift 段起点（跳过 warmup 段，避免绽放后立刻被 warm-up 的 LP 天花板闷回去）；start(bar=0) 则从 warm-up 开场。
    this._setStartBar = (dna && this.bar > 0) ? (this.bar - this._setSegEnd[0]) : 0;
  }

  // SOM「觉醒」：页面若在 SOM 训完前开声，start() 吃 fallback DNA（沉睡态）。SOM 训完、musicDNA 到位后 app 调此。
  //   只有当前确为 fallback 启动才动作（幂等）；把真 DNA 排到下一个 8-bar 边界，届时 _onBar 重跑 _applyDNA + 触发音乐化绽放（riser+滤波扫频+编曲展开），绝不硬切。
  //   确定性：仅记 pending + 目标边界，绝不在此推进任何 PRNG 流。
  updateDNA(dna) {
    if (!this.started) return;
    if (!dna || dna.sig == null) return;
    if (!this._dnaIsFallback) return;                        // 已是真 DNA（或已觉醒）→ no-op
    this._pendingDNA = dna;
    if (!this._awakenArmed) {                                // 排到下一个 8-bar 边界（多次调用不推迟已排定时刻）
      this._awakenArmed = true;
      this._awakenBar = (Math.floor(this.bar / 8) + 1) * 8;
    }
  }

  update(s) {
    if (!this.started || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;

    // beatPulse 每帧自然衰减（kick 时 _kick() 会置 1）。视觉侧读 this.beatPulse。
    this.beatPulse *= 0.86;
    // DJ-set 相位能量平滑值（视觉基线用，getSetPhase().energyVis）：~2s glide，相位切换不产生视觉跳变。
    this.phaseVis += (this._phaseE - this.phaseVis) * clamp((s.dt || 0.016) * 0.5, 0, 1);

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

    // 段切换：进 drop 时 fire impact（一次性）。drop 强度上限随 set 相位缩放：peak 全力，warm-up/afterglow 收着砸。
    if (sec !== this.section) {
      if (sec === 'drop') this._impact(t, this.setPhase === 'peak' ? 1 : (0.6 + 0.4 * this._phaseE));
      this.section = sec;
    }

    // SOM 觉醒绽放：_onBar 已在 8-bar 边界落真 DNA + 解封编曲层 → 这帧在真实音频时刻放一记 impact + 开母线滤波扫频（沉睡沉底 → 豁然打开），让"宇宙自组织完成"这一刻听得见（音乐化，非硬切）。
    if (this._awakenFire) {
      this._impact(t);
      if (this.masterLP) { this.masterLP.frequency.cancelScheduledValues(t); this.masterLP.frequency.setValueAtTime(700, t); this.masterLP.frequency.setTargetAtTime(20000, t, 0.45); }
      this._awakenSweepUntil = t + 0.6;   // 扫频窗口：本窗内让下方 section LP 自动化让路，使一次性扫频跑完不被覆盖
      this._awakenFire = false;
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
    // DJ-set 能量天花板：单一母线 LP 公式承载相位分级 —— warm-up 高频收敛(≈10.8k，"夜刚开始")、lift 抬起、
    // peak 全开(apex=1 时 20k)、afterglow 回落。min() 语义：build 蓄力/呼吸谷的更低值原样保留。
    const phCap = 6000 + this._phaseE * 14000;
    if (lpT > phCap) lpT = phCap;
    if (this.masterLP && t >= (this._awakenSweepUntil || 0)) this.masterLP.frequency.setTargetAtTime(lpT, t, sec === 'drop' ? 0.02 : 0.14);   // drop 快开=砸；否则平滑（觉醒扫频窗内让路）

    const stepDur = (60 / this.bpm) / 4;
    while (this.nextTime < t + this.lookahead) {
      this._scheduleStep(this.nextTime, stepDur);
      this.nextTime += stepDur; this.step++; this.debug.steps++;
      if (this.step % 16 === 0) this._onBar();
    }

    // SOM 觉醒 riser：绽放前一小节渐强扫频（平方缓入），把"宇宙自组织完成"这一刻推上舞台；与下方 riser 驱动共用 _riserEnv。
    if (this._awakenArmed && this.bar === this._awakenBar - 1) {
      const frac = clamp((this.step % 16) / 16, 0, 1);
      this._riserEnv = Math.max(this._riserEnv, frac * frac);
    }

    // riser 持续音（build 段）：白噪带通扫频 + 音量 swell。节流到每拍一次，避免堆叠。
    if (this._riserEnv > 0.01 && this.step - this._lastRiserStep >= 4) {
      this._driveRiser(t); this._lastRiserStep = this.step;
    }
  }

  _onBar() {
    this.bar++;
    // SOM 觉醒：pending 真 DNA 到达排定的 8-bar 边界 → 重跑 _applyDNA 落真 DNA（_dnaIsFallback 翻假 → 编曲层解封），并 arm update() 在下一帧音频时刻放绽放冲击。
    if (this._awakenArmed && this._pendingDNA && this.bar >= this._awakenBar) {
      this._applyDNA(this._pendingDNA);                                     // bpmBase 换目标（this.bpm 不动 → update 平滑 glide）；只用 _sigMix，不推进 _rng
      this.cycleStyle = this._pickStyle(this._sigMix(40) / 4294967296);     // 立即揭示真宇宙 groove（无状态哈希 salt 40，不推进 _rng）；下方 this.style 本小节即采用
      this._pendingDNA = null; this._awakenArmed = false;
      this._awakenFire = true;                                              // update() 下一帧 fire impact + 开滤波扫频
    } else if (this._dnaIsFallback && !this._awakenArmed && this.bar >= 24) {
      // 失效兜底：SOM 无数据/被跳过 → updateDNA 永不到来。~40s 后就地觉醒到 fallback 编曲（参数无真 DNA 可落、保持 fallback），绝不留永眠态。
      this._dnaIsFallback = false; this._awakenFire = true;
    }
    // DJ-set 宏弧：相位解析（纯 bar+日程 函数 + 可选 afterglow 调式转换；无状态哈希级确定性，绝不推进 _rng）。
    this._updateSetPhase();
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
    // DJ-set 宏弧：warm-up / afterglow 保持纯 trance 身份 —— polka/hardgroove 是 set 中段(lift/peak)的 spice，开场与收尾不抢戏。
    if (this.setPhase === 'warmup' || this.setPhase === 'afterglow') this.style = 'trance';
    // DJ: polka 方波 stab 绝不压在 running drop 上（会把 drop 打成 whiplash）→ drop 段把 polka 顶成 trance（intro/build/breakdown 仍可 polka）。
    if (this.style === 'polka' && sectionOf(this.bar) === 'drop') this.style = 'trance';
    if (this.style !== prev) this._styleFill = true;   // 风格变了 → 本小节头补一记 tom 过渡
  }

  // —— DJ-set 宏弧：相位解析（_onBar 每小节调一次）。纯 (bar, 日程快照) 函数 + 零分配，绝不推进 _rng ——
  //    觉醒交互：沉睡态(_dnaIsFallback)锁 warm-up、绝不进 peak —— fallback 宇宙没资格开顶；觉醒后按真日程走。
  _updateSetPhase() {
    let ph;
    if (this._dnaIsFallback) {
      ph = 'warmup';
    } else {
      const off = (((this.bar - this._setStartBar) % this._setLen) + this._setLen) % this._setLen;
      let i = 0; while (i < this._setSegEnd.length - 1 && off >= this._setSegEnd[i]) i++;
      ph = this._setSegPh[i];
    }
    this.setPhase = ph;
    this._phaseE = this._setPhaseE[ph] != null ? this._setPhaseE[ph] : 0.5;
    // set 中段一次调式转换（仅 1/3 宇宙、仅 afterglow）：只转 _altMode 相邻情绪档（多样性 pass 定义、全部 MODES
    // 进行都过 check-harmony 门禁）。转换点=相位边界：start 起步时对齐 48 小节倍数、觉醒重置后对齐 8-bar 边界
    // （_awakenBar 是 8 的倍数 + 段长全是 48 的倍数）——两者都是 2-bar 和弦边界，lead delay 环恰在和弦边界收干
    // → 零跨调残响。回到 warmup 时自动还原基调。
    const want = this._modeShiftOn && !this._dnaIsFallback && ph === 'afterglow';
    if (want !== this._modeShifted) {
      this._modeShifted = want;
      const m = want ? _altMode[this._modeBase] : this._modeBase;
      this.modeName = m; this.progs = MODES[m].progs; this.scale = MODES[m].scale;
      this.baseProgIdx = this._baseProgIdxBase % this.progs.length; this.curProgIdx = this.baseProgIdx;
    }
  }

  // 只读接口（视觉侧）：当前 DJ-set 相位 + 能量。energy=相位目标能量（阶跃）；energyVis=引擎内平滑值（~2s glide，
  // 适合直接驱动视觉基线如 bloom/vignette）。复用 this._phaseInfo —— 每帧调用零分配。
  getSetPhase() { const p = this._phaseInfo; p.phase = this.setPhase; p.energy = this._phaseE; p.energyVis = this.phaseVis; return p; }

  _curProg() { return this.progs[this.curProgIdx] || this.progs[0]; }
  _chord() { const p = this._curProg(); return p[(this.bar >> 1) % p.length]; }

  // 声部微抖专用 PRNG（与主 _s 隔离）：风格切换改变声部调用次数时只扰它、不扰 _onBar 的 A+B 流。
  _rngV() { this._sV = (this._sV + 0x6D2B79F5) | 0; let x = this._sV; x = Math.imul(x ^ (x >>> 15), 1 | x); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }
  // 位置哈希 → [0,1)：纯 (宇宙,小节,步,salt) 函数，与调用顺序无关 → 风格/交互门控不会错位任何流。
  // _h salt 注册表（新增时查此处防撞号）：1/2/3 hardgroove tom+shaker · 4 lead 门 · 11/12 arp spice · 13 pluck 微移速。
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
    // sig 扰动：dt/speedSpread/concentration 全是近恒定聚合 → 三权重每次一模一样、风味出现率恒定（跨 session 熟悉感来源之一）。
    wp += (this._sigMix(35) % 100) / 100 * 0.35; wh += (this._sigMix(36) % 100) / 100 * 0.35;   // trance 基线 1.0 仍保底主导
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
    const asleep = this._dnaIsFallback;                        // SOM 觉醒前的沉睡态：编曲收敛（鼓+贝斯+pad 维持脉动），melodic 层（supersaw/arp/lead/hook）按下不表 → 觉醒时豁然展开
    const ph = this.setPhase, phE = this._phaseE;              // DJ-set 宏弧相位（_onBar 边界更新）→ 本步能量分级
    const drumOn = sec === 'build' || sec === 'drop';
    // intro 也打轻 kick 维持律动 —— 但 warm-up 相位扣留 intro kick（无鼓开场，"夜刚开始"）；drop 四踩全保留（trance 身份），
    // peak 相位 four-on-the-floor 必然完整。沉睡态豁免扣留：asleep 契约是"鼓+贝斯+pad 维持脉动"，beatPulse 视觉不断供。
    const kickOn = sec !== 'breakdown' && !(ph === 'warmup' && sec === 'intro' && !asleep);

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

    // —— kick：four-on-the-floor；hardgroove 更硬（加高通 click）。力度随 set 相位缩放（peak 显式满力=完整回归）——
    if (kickOn && step % 4 === 0) this._kick(t, (sec === 'drop' ? 1.0 : (sec === 'intro' ? 0.7 : 0.9)) * (ph === 'peak' ? 1 : (0.78 + 0.22 * phE)), style === 'hardgroove');
    if (drumOn && (step === 4 || step === 12)) this._clap(t, 0.7);
    // 鼓面变体（drumVar 0/1/2，sig 选）：kick 四踩是 trance 身份不动，hat/clap 织体每宇宙不同（原先全硬编码 = 主节奏跨 session 一模一样）。
    if (drumOn && this.drumVar === 1 && step === 7) this._clap(t, 0.26);                                        // v1：ghost clap（织体签名）
    if (drumOn && (step % 2 === 1 || this.drumVar === 2)) this._hat(t, (style === 'hardgroove' ? 0.34 : 0.3) * (step % 2 === 1 ? 1 : 0.55), false);   // v2：全 16 分 hat（偶数步弱填充）
    if (drumOn && this.drumVar === 1 && step % 8 === 6) this._hat(t, 0.38, false);                              // v1：反拍双击加密
    if (ph !== 'warmup' && sec === 'drop' && (this.drumVar === 1 ? step % 8 === 2 : step % 4 === 2)) this._hat(t, this.drumVar === 2 ? 0.32 : 0.4, true);   // 开镲密度/收放随变体；warm-up 相位扣留开镲（顶层律动留给 lift/peak）
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

    // —— 情绪钢琴（悦耳度二期，~60% 宇宙）：breakdown 和弦边界当家（无 kick → 不泵，正是裸露抒情的 hands-up 时刻；
    //    supersaw 已让位）；intro 更轻（"夜刚开始"的第一件乐器——intro 在 lift/peak 相位有 kick，此时钢琴走 chordBus 吃泵=
    //    经典 pumping trance piano，warmup 相位无鼓则安静开场）。沉睡态按下不表；polka 不配钢琴。——
    if (!asleep && this.patch.pianoBrk && step === 0 && (bar & 1) === 0 && style !== 'polka' && style !== 'hardgroove' && (sec === 'breakdown' || sec === 'intro')) {
      this._pianoChord(t, ch, sec === 'intro' ? 0.24 : 0.38);   // hardgroove 不配抒情钢琴（部落 breakdown 保持纯打击）
    }
    // —— Breakdown 竖琴琶音（三期，~40% 宇宙）：奇数小节 step 0——偶数小节钢琴陈述和弦、奇数小节竖琴把同一个和弦
    //    琶成流水（同和弦 call-response，评审确认结构优秀）。钢琴宇宙 +12 对话主角（vel 0.24）；非钢琴宇宙 +24 高一个
    //    八度洒在 supersaw 延音之上（vel 0.20，评审：同八度堆根音=flam 糊）。+24 套用 lead 同款 min9-b3 避让（跳过
    //    idx1）→ 音高集合 = lead 枚举声部子集，门禁零新增。走 arpBus（reverb+pan；breakdown 无 kick 不泵）。
    const harpNow = !asleep && this.patch.harpBrk && sec === 'breakdown' && step === 0 && (bar & 1) === 1 && style !== 'polka' && style !== 'hardgroove';
    if (harpNow) {
      const hT = CHORD[ch.c], up = this.patch.pianoBrk ? 12 : 24;
      const hv = (this.patch.pianoBrk ? 0.24 : 0.2) * (1.05 - 0.35 * this._phaseE);
      let kk = 0;
      for (let i = 0; i < hT.length; i++) {
        if (up === 24 && hT.length >= 5 && i === 1) continue;
        this._playNat(t + kk * 0.042, this._harpBuf(mtof(this.sessKey + ch.r + hT[i] + up)), hv, this.arpBus);
        kk++;
      }
    }

    // —— Supersaw stab：hardgroove 收敛让位打击；polka 更短更拨。沉睡态按下不表（觉醒时绽放）。
    //    钢琴宇宙的 breakdown 由钢琴当家 → supersaw 让位（纯音色替换，音高集合只减不增 → 和声门禁零歧义）——
    if (!asleep && sec !== 'intro' && step === 0) {
      if (style === 'hardgroove') { if (sec === 'drop') this._supersaw(t, ch, stepDur * 1.6, 0.32); }
      else if (!(sec === 'breakdown' && this.patch.pianoBrk && style !== 'polka')) this._supersaw(t, ch, stepDur * (style === 'polka' ? 1.4 : 3), sec === 'drop' ? (style === 'polka' ? 0.5 : 0.6) : 0.4);   // 只在钢琴真的接管时让位——polka 不配钢琴，supersaw 必须回来撑和声（verify 抓的 dropout 回归）
    }
    if (!asleep && sec === 'drop' && step === 8 && style === 'trance') this._supersaw(t, ch, stepDur * 2, 0.45);

    // —— Arp：16 分琶音（drop/build；breakdown 稀疏）；hardgroove 半密度让位打击。沉睡态收起；竖琴滚奏的落拍让位（防双拨弦根音 flam）——
    if (!asleep && !harpNow && (sec === 'drop' || sec === 'build' || (sec === 'breakdown' && step % 4 === 0)) && !(style === 'hardgroove' && step % 2 === 1)) {
      this._arp(t, ch, stepDur * 1.5, (sec === 'drop' && step === 0) ? 0.28 : 0.5, step);   // drop 头拍 supersaw stab 当家 → arp 让位（垂直密度=粗糙感的一部分）
    }

    // —— Lead：drop 段旋律；hardgroove 撤 lead（打击当家）。门用位置哈希 _h（不抽流 → 风格无关）。沉睡态 hook/lead 按下不表 ——
    if (!asleep && sec === 'drop' && step % 2 === 0 && style !== 'hardgroove' && this._h(4) < 0.6) {
      this._lead(t, ch, stepDur * 2, 0.4);
    }
    // —— Breakdown 主旋律 hook（DJ: track 需一条暴露的 topline —— rest 段唱、drop 段再现）：
    //    暴露、拉长的 topline → **永远和弦内音**（consonant；原来用音阶级数叠 ch.r，裸露且长音，不和谐最扎耳）；
    //    色彩来自选的是 3 音/5 音/9 音而非音阶步进。音由 (bar,step) 确定性索引 → 同宇宙同旋律。
    if (!asleep && sec === 'breakdown' && (step === 0 || step === 6 || step === 10)) {
      const mi = this.motif[(this.bar * 3 + (step === 0 ? 0 : step === 6 ? 1 : 2)) % this.motif.length];
      const tones = CHORD[ch.c];
      this._lead(t, ch, stepDur * 3, 0.34, this.sessKey + ch.r + tones[mi % tones.length] + 12);
    }
  }

  // ---------- 乐器 ----------
  _kick(t, vel, hard) {
    const o = this.ctx.createOscillator(); o.type = 'sine'; const g = this.ctx.createGain();
    // 硬攻击：50→110Hz 下扫比 lofi(115→42) 更利、attack 更快、tail 更长（sub 撑满）。
    const kb = this.patch.kickBoom * (0.8 + 0.2 * this._phaseE);   // 音色签名：boomy(长尾低扫) ↔ punchy(短)；set 相位微缩放（warm-up 收尾、peak 全 boom），确定性（相位是 bar 的纯函数）
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
    const nv = tones.length >= 5 ? 5 : 7;   // 五音和弦(min9/maj9)减声部：35 路→25 路，清低频浑浊（音乐理论 agent Fix 4）
    for (const semi of tones) {
      for (let v = 0; v < nv; v++) {
        const o = this.ctx.createOscillator(); o.type = 'sawtooth';
        const detune = (v - (nv >> 1)) * this.patch.sawSpread + (this._rngV() - 0.5) * 3;   // 失谐展开(patch 音色签名) + 微抖（隔离流）
        o.frequency.setValueAtTime(mtof(base + semi + 12), t); o.detune.setValueAtTime(detune, t);
        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(4000, t); lp.frequency.exponentialRampToValueAtTime(1200, t + dur * 0.5);   // 滤波包络（开→关）
        lp.Q.value = 2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel / nv * 0.5, t + 0.004);
        g.gain.setTargetAtTime(0.0001, t + dur * 0.3, dur * 0.4);
        o.connect(lp); lp.connect(g); g.connect(this.chordBus);
        o.start(t); o.stop(t + dur + 0.3);
      }
    }
    this.debug.chords++;
  }
  _pad(t, ch, dur, vel) {
    // 持续 pad：supersaw 的慢起版（attack 1s、长 release），intro/breakdown 漂浮垫底。
    // 只弹三和弦（前 3 音）：pad 是低区氛围垫，扩展音(9th)交给 stab/arp —— pad 的 9th(+14) 会与 arp 低八度 b3(+15) 半音撞（build 段同响）。
    const tones = CHORD[ch.c]; const base = this.sessKey + ch.r;
    if (this.patch.strPad) {
      // string-machine 变体（三期，~40% 宇宙，评审终版配方）：每声部双锯对称失谐 ±4¢（中心 = 原 _rngV 抽样 → 每声部
      // 恰好一次抽样、隔离流形状不变、整体不偏锐）+ 每声部一只反相慢漩涡 LFO（0.6+k·0.12Hz，声部序号定率零抽样——
      // Solina/ARP 弦乐机的 BBD 合唱感来自慢速去相关漩涡，齐相快颤只是"带颤音的 pad"）+ HP 160（提弦乐感、保 intro
      // 低频锚与根音基频）+ LP 1800→2200 + 起音 1.0→1.2s。同音高纯音色替换 → 门禁不动。双锯非相干求和 ≈ ×√2 → 每锯 ×0.70 补平。
      let k = 0;
      for (const semi of tones.slice(0, 3)) {
        const baseDet = -6 + this._rngV() * 12;
        const lfo = this.ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.6 + k * 0.12;
        const lg = this.ctx.createGain(); lg.gain.value = 5; lfo.connect(lg);
        const inv = this.ctx.createGain(); inv.gain.value = -1; lg.connect(inv);
        const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 160;
        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.5;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel / tones.length * 0.7, t + 1.2); g.gain.setTargetAtTime(0.0001, t + dur * 0.6, dur * 0.3);
        for (let s = 0; s < 2; s++) {
          const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(mtof(base + semi), t);
          o.detune.setValueAtTime(baseDet + (s ? 4 : -4), t);
          (s ? lg : inv).connect(o.detune);
          o.connect(hp); o.start(t); o.stop(t + dur + 1);
        }
        hp.connect(lp); lp.connect(g); g.connect(this.padBus);
        lfo.start(t); lfo.stop(t + dur + 1);
        k++;
      }
      return;
    }
    for (const semi of tones.slice(0, 3)) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(mtof(base + semi), t); o.detune.setValueAtTime(-6 + this._rngV() * 12, t);
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.5;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel / tones.length, t + 1.0); g.gain.setTargetAtTime(0.0001, t + dur * 0.6, dur * 0.3);
      o.connect(lp); lp.connect(g); g.connect(this.padBus);
      o.start(t); o.stop(t + dur + 1);
    }
  }
  _arp(t, ch, dur, vel, step) {
    // 16 分琶音 —— 舒适不变量：每个音默认是**当前和弦内音**；只允许极少数(~6% 弱拍)、来自"安全扩展集"(相对**和弦根** +ch.r)
    //   的经过音做 spice，且**下一音解决到和弦音**。绝不出 m2/三全音/大调上的 b3。（原来 spice 用 key 相对音阶不加 ch.r，
    //   在非主和弦上频繁撞 m2/三全音/M7、且 16%×8 拍≈每小节 1.3 个不解决 —— 那是"格外多不和谐"的元凶。）
    const mi = this.motif[this.motifPos % this.motif.length]; this.motifPos++;
    const tones = CHORD[ch.c];
    let note;
    if (step % 16 === 0) { note = this.sessKey + ch.r + tones[0] + 12; this._spicePrev = false; }   // 小节头锚和弦根音
    else if ((step % 2 === 1) && this._h(11) < 0.06) {                                               // 6% 弱拍 spice
      const s = this._spiceSet[(this._h(12) * this._spiceSet.length) | 0];                            // 安全扩展音（9/6，相对和弦根，+ch.r）
      note = this.sessKey + ch.r + s + 12; this._spicePrev = true;                                    // 标记：下一音须解决
    } else {
      let idx = mi % tones.length;
      const oct = Math.floor(mi / tones.length);
      if (oct > 0) idx = (mi & 1) ? 2 : 0;                                                            // 高八度只落根/五（trance 高区 power 感）：高区 3rd/9th 会与 stab 的 9th(+26) 半音/小九度撞
      if (this._spicePrev) { idx = 0; this._spicePrev = false; }                                      // spice 后解决到根音
      note = this.sessKey + ch.r + tones[idx] + 12 * oct + 12;                                        // 和弦内音，随轮廓升八度
    }
    const freq = mtof(note);
    // pluck 琶音变体（悦耳度二期，~40% 宇宙）：同一音高选择，音色换 Karplus-Strong 拨弦。
    // 微移速抖动走位置哈希 _h(13)（纯 (宇宙,bar,step) 函数、零流扰动，设计评审裁定优于 _rngV）；
    // 套用与 saw 路径同形的时值释放包络 → 16 分级联干净不糊。
    if (this.patch.arpPluck) {
      const rate = Math.pow(2, (this._h(13) * 8 - 4) / 1200);
      this._playNat(t, this._pluckBuf(freq), vel * 0.85, this.arpBus, { rate, lp: 4500, hold: dur * 0.4, rel: dur * 0.3 });
      this.debug.arps++;
      return;
    }
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
    this._lastLeadT = t;   // _focus 避让：lead 刚发声的窗口内不叠 focus 音（Fix 5）
    const tones = CHORD[ch.c];
    const colorN = (this._clHue != null) ? this._clHue : 0.5;   // 视野主导簇色相 → 选和弦内音
    let ti = Math.round(colorN * (tones.length - 1));
    if (forceNote == null) {                                    // lead 乐句摆动：交替 主音↔轮廓音 → 两音 hook。原先只反复唱 colorN 单音 = "长音+回声"记忆点每次相同（跨 session 熟悉感来源）。
      const L = tones.length, c = this._leadContour;            // 轮廓型每宇宙 sig 定：0=邻上摆 1=邻下摆 2=五度跳
      if (this._leadAlt) ti = c === 0 ? (ti + 1) % L : c === 1 ? (ti + L - 1) % L : (ti + 2) % L;
      this._leadAlt = !this._leadAlt;                           // 翻转次数=lead 调用次数（_h 位置哈希门控）→ 确定性保持
    }
    if (tones.length >= 5 && ti === 1) ti = 2;                  // min9 上 lead 不唱高八度 b3(+27)：与 stab 的 9th(+26) 小二度撞 → 改五度（放在乐句变换后 = 最终保证）
    const freq = mtof(forceNote != null ? forceNote : (this.sessKey + ch.r + tones[ti] + 24));
    const lw = this.patch.leadSquare ? 'square' : 'sawtooth';   // 音色签名：方波=更空/更硬
    const o = this.ctx.createOscillator(); o.type = lw; o.frequency.setValueAtTime(freq, t);
    const o2 = this.ctx.createOscillator(); o2.type = lw; o2.frequency.setValueAtTime(freq, t); o2.detune.setValueAtTime(7, t);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = this.patch.leadSquare ? 4200 : 6000;   // 方波 lead 收高频防刺耳
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.006); g.gain.setTargetAtTime(0.0001, t + dur * 0.5, dur * 0.4);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.leadBus);
    // delay：1/8 三连反馈。
    // delay：1/8 三连反馈。短反馈 + wet 低通（暗），且**每个 delay 环都预约在下一个和弦边界 ramp-kill** —— 旧方案只掐
    // "切换前最后一拍新建"的环，更早发的 lead 各自的反馈环(fb 0.24 ≈ 3-4 个回声 ≈ 1.5+ 拍)照样把旧和弦拖进新和弦。
    // 边界时刻可精确算出（和弦每 2 小节 = 32 步一换），fb/wet 在边界前 50ms 指数收干 → 跨和弦零残响，环内回声不受影响。
    const delay = this.ctx.createDelay(1.0); delay.delayTime.value = (60 / this.bpm / 2) * 0.667;
    const stepsTo = (32 - (this.step % 32)) % 32 || 32;                 // 距下一个和弦边界的步数（正好在边界 = 整段 32 步可用）
    const tB = t + stepsTo * (60 / this.bpm / 4);
    const fb = this.ctx.createGain(); fb.gain.value = 0.24; const wet = this.ctx.createGain(); wet.gain.value = 0.4;
    fb.gain.setTargetAtTime(0.0001, tB - 0.05, 0.025); wet.gain.setTargetAtTime(0.12, tB - 0.05, 0.03);
    const dlp = this.ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2200;   // wet 变暗 → 就算糊也不刺
    g.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(dlp); dlp.connect(wet); wet.connect(this.leadBus);
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
  _impact(t, sc) {
    // drop 起点一次性 impact：低 sine thud + 噪声 burst + 长 reverb 尾。sc=强度缩放（缺省 1）：DJ-set 宏弧的
    // drop 强度上限 —— warm-up/afterglow 收着砸、peak 全力（觉醒绽放不传 sc = 恒全力）。
    const k = sc == null ? 1 : sc;
    this._impactEnv = 1;
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(60, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.8);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.9 * k, t); g.gain.setTargetAtTime(0.0001, t + 0.1, 0.4);
    o.connect(g); g.connect(this.fxBus); g.connect(this.revSend); o.start(t); o.stop(t + 1.2);
    const src = this.ctx.createBufferSource(); src.buffer = this._noise;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000;
    const ng = this.ctx.createGain(); ng.gain.setValueAtTime(0.6 * k, t); ng.gain.setTargetAtTime(0.0001, t + 0.05, 0.15);
    src.connect(lp); lp.connect(ng); ng.connect(this.fxBus); src.start(t); src.stop(t + 0.5);
  }

  // sidechain duck：kick 触发，scBus gain 瞬跌 −8dB、150ms 恢复。
  _duck(t) {
    const g = this.scBus.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(0.4, t); g.setTargetAtTime(1, t + 0.001, 0.06);   // 指数恢复 → 更"泵"的 sidechain 呼吸（DJ：线性太 limp）
  }

  // ---------- 自然乐器（悦耳度二期：零采样、零新增 _rng —— 激励读 this._noise 确定性缓冲；预渲染 AudioBuffer 按音高缓存） ----------
  // Karplus-Strong pluck（trance 拨弦）：激励中亮（a=0.7），弦环 ~0.3s 衰到 −60dB —— 设计评审：138bpm 16 分 =108ms，
  // 0.5s ring 会 4–5 音叠糊，0.3s = 2–3 音干净级联。
  _pluckBuf(freq) {
    const key = 'g' + Math.round(freq * 4);
    let b = this._nat.get(key); if (b) return b;
    const sr = this.ctx.sampleRate, N = Math.max(2, Math.round(sr / freq)), ring = 0.3;
    const len = Math.floor(sr * (ring + 0.15)), d = new Float32Array(len);
    const src = this._noise.getChannelData(0), off = (Math.imul(N, 2654435761) >>> 0) % Math.max(1, src.length - N - 2);
    let lp = 0;
    for (let i = 0; i <= N; i++) { lp += 0.7 * (src[off + i] - lp); d[i] = lp; }
    const loss = Math.pow(0.001, 1 / (freq * ring));
    for (let i = N + 1; i < len; i++) d[i] = loss * 0.5 * (d[i - N] + d[i - N - 1]);
    let pk = 0; for (let i = 0; i < len; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; }
    if (pk > 0) { const s = 0.95 / pk; for (let i = 0; i < len; i++) d[i] *= s; }
    b = this.ctx.createBuffer(1, len, sr); b.getChannelData(0).set(d); this._nat.set(key, b); return b;
  }
  // 情绪钢琴（比 lofi 毛毡版亮，但设计评审收敛：7 分音 n^-1.6、顶分音再压 3dB——neon 母带本就 +1.5dB 高架亮，
  // 分音再多会在 2–4kHz 撞疲劳带；tau 上限 1.8s 防 2.4s 混响糊 + 递推长尾漂移）。2cos 递推，零逐样本 sin。
  _pianoBuf(freq) {
    const key = 'p' + Math.round(freq * 4);
    let b = this._nat.get(key); if (b) return b;
    const sr = this.ctx.sampleRate, len = Math.floor(sr * 2.0), d = new Float32Array(len);
    const tauB = clamp(1.6 * Math.sqrt(261 / freq), 0.5, 1.8);
    for (let n = 1; n <= 7; n++) {
      const fn = n * freq * Math.sqrt(1 + 0.00038 * n * n);
      if (fn > sr * 0.45) break;
      const amp = Math.pow(n, -1.6) * (n === 7 ? 0.7 : 1), tau = tauB / (1 + 0.6 * (n - 1));
      const w = 2 * Math.PI * fn / sr, dk = Math.exp(-1 / (tau * sr));
      const c1 = 2 * dk * Math.cos(w), c2 = dk * dk;
      let y1 = amp * dk * Math.sin(w), y0 = 0;
      d[1] += y1;
      for (let i = 2; i < len; i++) { const y = c1 * y1 - c2 * y0; y0 = y1; y1 = y; d[i] += y; }
    }
    const src = this._noise.getChannelData(0), off = (Math.imul(Math.round(freq * 4), 40503) >>> 0) % Math.max(1, src.length - 2000);
    let lp = 0;
    for (let i = 0; i < 1600 && i < len; i++) { lp += 0.16 * (src[off + i] - lp); d[i] += lp * 0.3 * Math.exp(-i / (sr * 0.018)); }   // 槌噪 thump
    const atk = Math.floor(sr * 0.008);
    for (let i = 0; i < atk; i++) d[i] *= i / atk;
    let pk = 0; for (let i = 0; i < len; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; }
    if (pk > 0) { const s = 0.95 / pk; for (let i = 0; i < len; i++) d[i] *= s; }
    b = this.ctx.createBuffer(1, len, sr); b.getChannelData(0).set(d); this._nat.set(key, b); return b;
  }
  // 竖琴（三期）：KS 弦，激励较暗（a=0.35，比 a=0.7 的 arp pluck 柔）；ring 随宇宙类型定——
  // 钢琴宇宙 1.6s（+12 对话主角）、非钢琴宇宙 1.2s（+24 洒在 supersaw 延音上的高光，短些防糊）。
  // ring 是宇宙不变量（pianoBrk 定）→ 缓存安全；_applyDNA 清缓存覆盖重推导。
  _harpBuf(freq) {
    const key = 'h' + Math.round(freq * 4);
    let b = this._nat.get(key); if (b) return b;
    const sr = this.ctx.sampleRate, N = Math.max(2, Math.round(sr / freq)), ring = this.patch.pianoBrk ? 1.6 : 1.2;
    const len = Math.floor(sr * (ring + 0.2)), d = new Float32Array(len);
    const src = this._noise.getChannelData(0), off = (Math.imul(N, 2654435761) >>> 0) % Math.max(1, src.length - N - 2);
    let lp = 0;
    for (let i = 0; i <= N; i++) { lp += 0.35 * (src[off + i] - lp); d[i] = lp; }
    const loss = Math.pow(0.001, 1 / (freq * ring));
    for (let i = N + 1; i < len; i++) d[i] = loss * 0.5 * (d[i - N] + d[i - N - 1]);
    let pk = 0; for (let i = 0; i < len; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; }
    if (pk > 0) { const s = 0.95 / pk; for (let i = 0; i < len; i++) d[i] *= s; }
    b = this.ctx.createBuffer(1, len, sr); b.getChannelData(0).set(d); this._nat.set(key, b); return b;
  }
  // 播放预渲染自然乐器：3ms 起坡（杀 KS 首样本非零的边界咔哒）+ 可选静态低通/音乐时值释放 + buffer 末尾闭。
  _playNat(t, buf, vel, dest, o) {
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    if (o && o.rate) src.playbackRate.value = o.rate;
    let head = src;
    if (o && o.lp) { const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp; src.connect(lp); head = lp; }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.003);
    if (o && o.hold != null) g.gain.setTargetAtTime(0.0001, t + o.hold, o.rel || 0.25);
    g.gain.setTargetAtTime(0, t + buf.duration - 0.05, 0.012);
    head.connect(g); g.connect(dest); src.start(t); src.stop(t + buf.duration + 0.05);
  }
  // Breakdown/intro 情绪钢琴和弦：三和弦+b7（tones 前 4 音）在 supersaw 的 +12 寄存器（音高集合是既有枚举声部的
  // 严格子集 → 和声门禁不动；不叠 close 9th 防中频糊）。音量随 DJ-set 相位收放（warmup 裸露、peak 让位 supersaw 墙），
  // 相位是 bar 的纯函数 → 确定性。
  _pianoChord(t, ch, vel) {
    const tones = CHORD[ch.c].slice(0, 4), base = this.sessKey + ch.r + 12;
    const v = vel * (1.05 - 0.35 * this._phaseE);
    for (let k = 0; k < tones.length; k++) this._playNat(t + k * 0.011, this._pianoBuf(mtof(base + tones[k])), v * (1 - k * 0.06), this.chordBus, { hold: 1.3, rel: 0.3 });
    this.debug.chords++;
  }

  // focus = "跟踪哪个数据" → 一记柔和 lead 音（视野→吟唱，原 audio.js 钩子）。
  _focus(focus, t) {
    const key = focus ? (focus.idx + ':' + focus.sys) : null;
    if (key === this._lastFocusKey) return; this._lastFocusKey = key;
    if (!focus) return;
    if (this._lastLeadT != null && Math.abs(t - this._lastLeadT) < 0.25) return;   // lead 正在唱 → 不叠打（Fix 5）
    const ch = this._chord(), tones = CHORD[ch.c], ti = Math.round((focus.tone || 0.5) * (tones.length - 1));
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(mtof(this.sessKey + ch.r + tones[ti] + 24), t);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3, t + 0.01); g.gain.setTargetAtTime(0.0001, t + 0.3, 0.4);
    o.connect(lp); lp.connect(g); g.connect(this.arpBus); g.connect(this.revSend);   // arpBus 受 sidechain duck → focus 音随泵呼吸、不顶 lead（Fix 5）
    o.start(t); o.stop(t + 1.5);
  }

  setMuted(b) { this.muted = b; if (this.master) this.master.gain.setTargetAtTime(b ? 0.0001 : 0.85, this.ctx.currentTime, 0.25); }

  // 微弱空间声像：x∈[-1,1]（主导簇质心投影的 NDC x）→ lead/arp 声像 ±0.25 上限；closeness∈[0,1]（相机贴近程度）
  // → arp 音量 ≤ +1.5dB（线性 ≤×1.19）柔性偏置。无 StereoPannerNode 支持时整体 no-op（特性静默跳过）。
  // 这是实时外部输入（视觉侧每帧/每 tick 投影），不派生任何音乐参数（调/速/和声/编曲一律不受影响）——不受 _rng/_sigMix 纪律约束。
  setSpatial(x, closeness) {
    if (!this.started || !this.ctx || (!this.leadPan && !this.arpPan)) return;
    const t = this.ctx.currentTime;
    const xc = clamp(x == null ? 0 : x, -1, 1) * 0.25;
    if (this.leadPan) this.leadPan.pan.setTargetAtTime(xc, t, 0.3);
    if (this.arpPan) this.arpPan.pan.setTargetAtTime(xc, t, 0.3);
    const cl = clamp(closeness == null ? 0 : closeness, 0, 1);
    if (this.arpBus) this.arpBus.gain.setTargetAtTime(this._arpBaseGain * (1 + cl * 0.19), t, 0.3);
  }

  // ---------- 工具 ----------
  _satCurve(drive) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * drive); } return c; }
  _reverbIR(sec) { const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) { const tt = i / len; d[i] = (this._rng() * 2 - 1) * Math.pow(1 - tt, 3.0); } } return b; }
  _noiseBuf(sec) { const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = this._rng() * 2 - 1; return b; }
  _rng() { this._s = (this._s == null ? 0x9e3779b9 : this._s + 0x6D2B79F5) | 0; let x = this._s; x = Math.imul(x ^ (x >>> 15), 1 | x); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }
}
