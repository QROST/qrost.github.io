// 数渊 · Data Abyss — 生成式 lo-fi hip-hop 背景乐引擎 v3（zero-dep, pure Web Audio）
// 像 Lofi Girl 那样适合工作/学习的暖、慵懒、舒适背景音；数据做"点缀级"调味，舒适优先。
// v3 新增（在 v2 已调好的舒适基底上叠加，绝不破坏 cozy 包络）：
//   ① 每次打开都不同：每次加载一个随机 seed → 在"舒适白名单"里随机挑 调性移调 / 和弦进行库 / 鼓 groove 库 / motif / swing / 速度
//   ② 走向随"跟踪哪个数据"变：focus(点选追踪某颗星) → 按其数据层+色相 在乐句边界平滑转调(≤2半音/乐句)+换进行+调能量；松开平滑回基调
//   ③ 更丰富 variation：进行库 + groove 库 + 每4小节乐句重掷(comp/ghost/fill) + 间歇 breakdown(鼓 drop) + intro + 旋律 call-response/八度/经过音 + 贝斯 walking + 踩镲 triplet roll
// lofi 配方不变：软 kick + backbeat 军鼓 + swing 踩镲 / 暖 Rhodes FM 电钢爵士和弦 / 软贝斯 / 极稀疏只落和弦音的旋律 / 干暖"隔层玻璃"混音 + 黑胶噪 + kick sidechain 轻泵。

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const CHORD = { maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], maj9: [0, 4, 7, 11, 14], min9: [0, 3, 7, 10, 14], dom9: [0, 4, 7, 10, 14], min11: [0, 3, 7, 10, 17] };
// 和弦进行库（每首随机挑一个；每和弦 2 小节 → 8 小节大循环）。全部暖爵士、相对调性根 root（半音）→ 移调后仍协和
const PROGS = [
  [{ r: 0, c: 'maj9' }, { r: 9, c: 'min7' }, { r: 2, c: 'min9' }, { r: 7, c: 'dom9' }],   // I–vi–ii–V（经典 lofi）
  [{ r: 2, c: 'min9' }, { r: 7, c: 'dom9' }, { r: 0, c: 'maj9' }, { r: 9, c: 'min7' }],   // ii–V–I–vi
  [{ r: 9, c: 'min9' }, { r: 5, c: 'maj7' }, { r: 0, c: 'maj9' }, { r: 7, c: 'dom9' }],   // vi–IV–I–V
  [{ r: 0, c: 'maj9' }, { r: 5, c: 'maj7' }, { r: 9, c: 'min7' }, { r: 7, c: 'dom9' }],   // I–IV–vi–V
  [{ r: 0, c: 'maj7' }, { r: 4, c: 'min7' }, { r: 5, c: 'maj9' }, { r: 7, c: 'dom9' }],   // I–iii–IV–V
  [{ r: 9, c: 'min9' }, { r: 2, c: 'min11' }, { r: 7, c: 'dom9' }, { r: 0, c: 'maj9' }],  // vi–ii–V–I（jazzy）
];
// 鼓 groove 模板库（每首随机挑；step 0..15 = 16 分）
const GROOVES = [
  { kick: [0, 10], snare: [4, 12] },        // classic boom-bap
  { kick: [0, 6, 10], snare: [4, 12] },     // busy kick
  { kick: [0, 11], snare: [4, 12] },        // laid-back
  { kick: [0, 8], snare: [4, 12] },         // half-time feel
  { kick: [0, 10, 14], snare: [4, 12] },    // syncopated
  { kick: [0, 7, 10], snare: [4, 12] },     // "& of 2" push
];
// 跟踪某数据层 → 走向：{key:移调半音, prog:进行索引, energy:能量(影响旋律/踩镲密度)}
const TRACK = [
  { key: 0, prog: 0, energy: 0.5 },    // 0 CITY        家·稳
  { key: 2, prog: 3, energy: 0.55 },   // 1 PRODUCT
  { key: -3, prog: 5, energy: 0.4 },   // 2 KERNEL      深·内省
  { key: 4, prog: 1, energy: 0.7 },    // 3 BREAKTHROUGH 提气·上行
  { key: -5, prog: 2, energy: 0.3 },   // 4 POLICY      低沉·空旷
  { key: 2, prog: 3, energy: 0.5 },    // 5 VENDOR
  { key: 5, prog: 4, energy: 0.55 },   // 6 PHARMA      玻璃·明亮
  { key: 7, prog: 1, energy: 0.75 },   // 7 CAT/SHELTER 俏皮·上行
];
const SESS_TRANSPOSE = [0, 2, -2, 3, 5, -4, -5, 7];   // 每次加载的整体移调候选（都仍 cozy）
const MEL_TONE = [
  { ratio: 1, idx: 2.2, dec: 0.9 }, { ratio: 2, idx: 1.6, dec: 0.7 }, { ratio: 1, idx: 1.4, dec: 1.1 }, { ratio: 3, idx: 1.8, dec: 0.6 },
  { ratio: 1, idx: 1.0, dec: 1.3 }, { ratio: 2, idx: 2.0, dec: 0.7 }, { ratio: 1, idx: 1.6, dec: 1.0 }, { ratio: 1, idx: 2.4, dec: 0.8 },
];
// —— 每宇宙情绪倾向（借鉴 neon 02f30e0，但对 lofi 保守化）：由 domType(主导数据世界) 选一档情绪，只在**既有 cozy 进行库**里挑桶，
//   绝不换成 phrygian/hard 等会破坏慵懒感的调式 → 情绪有别、始终舒适。桶内再由 concentration+sig 变化（每宇宙一致的情绪 + 每次不同的曲）。
//   PROGS 分档：大调起(0/3/4)=暖亮上行，vi 小调起(2/5)=内省微忧，ii-V-I(1)=中性 jazzy。
const MOODS = {
  bright: [0, 3, 4],   // 家·稳 / 提气 / 药品玻璃 / 猫俏皮 → 温暖·明亮·上行
  mellow: [1, 0, 4],   // 产品 / vendor → 经典中性 chill
  wistful: [2, 5, 1],  // kernel 深·内省 / policy 低沉空旷 → 微忧·内省（含 1 增变化、不刺）
};
const moodForDom = (dt) => (dt === 3 || dt === 6 || dt === 7 || dt === 0) ? 'bright' : (dt === 2 || dt === 4) ? 'wistful' : 'mellow';

export class Sonifier {
  constructor() {
    this.ctx = null; this.started = false; this.muted = false;
    this.bpm = 76; this.step = 0; this.bar = 0; this.nextTime = 0; this.lookahead = 0.14;
    this.keyRoot = 48; this.dom = 0;
    this.mood = 'mellow';                                                    // 每宇宙情绪档；start() 按 domType 定
    this.patch = { epBright: 1, kickBoom: 0.46, bassWarm: 420 };             // 每宇宙音色签名；start() 按 domType+sig 定
    this.motif = [0, 2, 1, 3, 2, 0, 3, 1]; this.motifPos = 0;
    this._lastFocusKey = null;
    this.trackEnergy = 0.5; this.lastMelStep = -9;
    this._clHue = null; this._clEnergy = 0;
    this.debug = { steps: 0, kicks: 0, snares: 0, chords: 0, mels: 0, mods: 0, sig: 0 };
  }

  start(ctx, opts = {}) {
    if (this.started) { try { ctx.resume && ctx.resume(); } catch (_) {} this.setMuted(false); return; }
    this.ctx = ctx; this.started = true;
    const t = ctx.currentTime;
    // 一切"不同"都来自这片宇宙的涌现态（SOM 自组织 + 数据），不是随机种子。
    // app.js 在 buildSOM 后算好 musicDNA（最密簇色相 / 组织集中度 / 簇数 / 簇速均值·异质度 / 最密簇学习原型 / 涌现签名）传入。
    // audio.js 内零 Math.random：同一片宇宙→同一首曲；不同宇宙(每次开页 SOM 不同)→不同曲，且与所见相关。
    const dna = (opts && opts.sig != null) ? opts : null;
    const warmRaw = dna ? dna.warm : opts.climWarm;
    const warm = clamp(warmRaw == null ? 0.5 : warmRaw, 0, 1);
    this._s = (dna ? (dna.sig >>> 0) : ((Math.round(warm * 1e6) ^ 0x9e3779b9) >>> 0)) | 0;   // 人性化微抖/噪声 PRNG 种子 = 宇宙涌现签名（确定性，非 Math.random）；无 DNA 兜底也从 climWarm 派生（仍来自数据，非随机）
    this._sig0 = this._s >>> 0;   // 原始涌现签名快照 → _sigMix 用（独立于 _rng 的推进，同宇宙恒定、跨宇宙每次真的变）
    this.dna = dna; this.debug.sig = dna ? (dna.sig >>> 0) : 0;

    this.keyRoot = warm < 0.4 ? 45 : warm > 0.7 ? 50 : 48;                          // climWarm → 暖基调（冷/温/暖）
    const hueStar = dna ? clamp(dna.hueStar, 0, 0.999) : 0.5;                       // 最密簇(宇宙最大自组织主题)的色相 → 整体移调（听见这片宇宙的主色）
    this.sessKey = this.keyRoot + SESS_TRANSPOSE[Math.floor(hueStar * SESS_TRANSPOSE.length)];
    // ⚠ 聚合-vs-指纹修复（借鉴 neon 03bd523）：warm/speedMean/speedSpread/concentration/populatedFrac/densest-motif 都是
    //   "固定数据的均值/展度"、每次加载近乎恒定 → 只 hueStar 与 sig 真正变。若速度/swing/进行/groove/旋律全靠这些均值，
    //   每次开页几乎同一首（只换调）。故让均值定"数据倾向"，再折入 sig(整张密度场指纹, 每次真的变) → 每次真的不同，且仍数据驱动。
    this.bpm = Math.round(72 + warm * 6 + (dna ? dna.speedMean : 0.5) * 5 + (this._sigMix(2) % 9) - 4);   // 均值定基 + sig ±4 → 速度 ~68–89（仍 cozy）
    this.swing = clamp(0.22 + (dna ? dna.speedSpread : 0.45) * 0.12 + (this._sigMix(3) % 70) / 1000, 0.20, 0.42);   // 异质度定基 + sig 微散 → swing 松散度
    // 情绪档：domType(主导数据世界) 定 bright/mellow/wistful → 只在对应 cozy 进行桶内挑（情绪有别、始终舒适）；桶内由 concentration+sig 变化。
    this.mood = moodForDom(dna ? dna.domType : 0);
    const _bucket = MOODS[this.mood];
    this.baseProgIdx = _bucket[(Math.floor(clamp(dna ? dna.concentration : 0.4, 0, 0.999) * _bucket.length) + this._sigMix(10)) % _bucket.length];   // 情绪桶 + 集中度定基 + sig 旋转
    this.groove = GROOVES[(Math.floor(clamp(dna ? dna.populatedFrac : 0.3, 0, 0.999) * GROOVES.length) + this._sigMix(11)) % GROOVES.length];   // 簇数定基 + sig 旋转 → 每次不同 groove
    const _bm = (dna && dna.motif && dna.motif.length >= 8) ? dna.motif.slice(0, 8) : [0, 2, 1, 3, 2, 0, 3, 1];   // 最密簇原型 = 近恒定聚合
    this.motif = _bm.map((v, k) => (Math.round(v) + this._sigMix(20 + k)) % 5);   // 每位折入 sig → 每次不同旋律轮廓（不再"同曲换调"），仍落和弦音故保持协和
    this.epRatio = (dna && (dna.domType % 3) === 1) ? 2 : 1;                         // 最大主题所属层 → 电钢音色
    // 每宇宙音色签名（借鉴 neon e731d85，保守化）：Rhodes 亮度 / kick 体量 / bass 暖度，由 domType(性格)+sig(变体) 定 → 音色也每次不同，仍全程 cozy。
    this.patch = {
      epBright: 0.85 + (this._sigMix(7) % 100) / 100 * 0.4,                                        // Rhodes FM 亮度 0.85–1.25×（暖钝↔明亮）
      kickBoom: (this.mood === 'wistful' ? 0.6 : this.mood === 'bright' ? 0.34 : 0.46) + (this._sigMix(8) % 20) / 100,   // 内省更 boomy·明亮更紧 ± sig 微变（仍软）
      bassWarm: 380 + (this._sigMix(9) % 130),                                                      // bass 低通 380–510（暖钝↔略清晰）
    };
    this.curKey = this.targetKey = this.sessKey;
    this.curProgIdx = this.targetProgIdx = this.baseProgIdx;
    this.subMidi = this.keyRoot;

    // ---------- 母带链（暖·干·隔层玻璃）----------
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.knee.value = 24; limiter.ratio.value = 4; limiter.attack.value = 0.004; limiter.release.value = 0.18;
    const master = ctx.createGain(); master.gain.value = 0; limiter.connect(master); master.connect(ctx.destination); this.master = master;
    const sat = ctx.createWaveShaper(); sat.curve = this._satCurve(1.3); sat.oversample = '2x';
    const masterLP = ctx.createBiquadFilter(); masterLP.type = 'lowpass'; masterLP.frequency.value = 8500; masterLP.Q.value = 0.5;
    const hiShelf = ctx.createBiquadFilter(); hiShelf.type = 'highshelf'; hiShelf.frequency.value = 3200; hiShelf.gain.value = -6 + (this._sigMix(6) % 45) / 10;   // 每宇宙混音暖度 −6..−1.5（暗钝↔略亮，仍隔层玻璃）
    sat.connect(masterLP); masterLP.connect(hiShelf); hiShelf.connect(limiter); this.masterLP = masterLP;
    const mix = ctx.createGain(); mix.gain.value = 1; mix.connect(sat); this.mix = mix;
    const reverb = ctx.createConvolver(); reverb.buffer = this._reverbIR(1.4);
    const revSend = ctx.createGain(); revSend.gain.value = 0.1; const revRet = ctx.createGain(); revRet.gain.value = 0.8;
    revSend.connect(reverb); reverb.connect(revRet); revRet.connect(mix); this.revSend = revSend;
    const wow = ctx.createGain(); wow.gain.value = 4;
    const lfoA = ctx.createOscillator(); lfoA.type = 'sine'; lfoA.frequency.value = 0.21;
    const lfoB = ctx.createOscillator(); lfoB.type = 'sine'; lfoB.frequency.value = 0.074; const lfoBg = ctx.createGain(); lfoBg.gain.value = 0.5;
    lfoA.connect(wow); lfoB.connect(lfoBg); lfoBg.connect(wow); lfoA.start(t); lfoB.start(t); this.wow = wow;

    this.drumBus = ctx.createGain(); this.drumBus.gain.value = 0.9; this.drumBus.connect(mix);
    this.bassBus = ctx.createGain(); this.bassBus.gain.value = 0.8; this.bassBus.connect(mix);
    this.melBus = ctx.createGain(); this.melBus.gain.value = 0.5; this.melBus.connect(mix); this.melBus.connect(revSend);
    this.chordBus = ctx.createGain(); this.chordBus.gain.value = 0.42;
    this.chordDuck = ctx.createGain(); this.chordDuck.gain.value = 1; this.chordBus.connect(this.chordDuck); this.chordDuck.connect(mix); this.chordBus.connect(revSend);
    const trem = ctx.createGain(); trem.gain.value = 0.08; const tlfo = ctx.createOscillator(); tlfo.type = 'sine'; tlfo.frequency.value = 4.6; tlfo.connect(trem); trem.connect(this.chordBus.gain); tlfo.start(t);

    this.ambGain = ctx.createGain(); this.ambGain.gain.value = 0.0001; this.ambGain.connect(limiter);
    this._noise = this._noiseBuf(2.4);
    const crackle = ctx.createBufferSource(); crackle.buffer = this._noise; crackle.loop = true;
    const crBP = ctx.createBiquadFilter(); crBP.type = 'bandpass'; crBP.frequency.value = 2400; crBP.Q.value = 0.6;
    const crG = ctx.createGain(); crG.gain.value = 0.6; crackle.connect(crBP); crBP.connect(crG); crG.connect(this.ambGain); crackle.start(t);
    const air = ctx.createBufferSource(); air.buffer = this._noise; air.loop = true;
    const airLP = ctx.createBiquadFilter(); airLP.type = 'lowpass'; airLP.frequency.value = 2600; const airG = ctx.createGain(); airG.gain.value = 0.12;
    air.connect(airLP); airLP.connect(airG); airG.connect(this.ambGain); air.start(t);

    this.focBus = ctx.createGain(); this.focBus.gain.value = 0.7; this.focBus.connect(mix); this.focBus.connect(revSend);
    this._rollLoop();   // 初始化首个乐句变化
    this.master.gain.setTargetAtTime(0.7, t, 1.5);
    this.nextTime = t + 0.12;
  }

  update(s) {
    if (!this.started || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    this.dom = (s.view && s.view.dom != null) ? s.view.dom : this.dom;
    const pitchN = clamp((s.pitch + 1.45) / 2.9, 0, 1), fovN = clamp((s.fov - 10) / 115, 0, 1), pulse = s.pulse || 0;
    this._exhale = s.gOrg == null ? 0.5 : s.gOrg;
    this._toneAvg = (s.view && s.view.toneAvg != null) ? s.view.toneAvg : 0.5;
    // 主导可见 SOM 簇的色相/能量 → 旋律落音颜色/密度（你正看着哪片自组织）；低通平滑(~250ms)→ 平移视角穿簇时旋律色平滑过渡、不跳音
    const clH = (s.view && s.view.clHue != null) ? s.view.clHue : null;
    const clE = (s.view && s.view.clEnergy != null) ? s.view.clEnergy : 0;
    const sm = clamp((s.dt || 0.016) * 4, 0, 1);
    if (clH != null) {
      if (this._clHue == null) this._clHue = clH;
      else { let dl = clH - this._clHue; if (dl > 0.5) dl -= 1; else if (dl < -0.5) dl += 1; this._clHue = (this._clHue + dl * sm + 1) % 1; }   // 色相环就近插值（避开 0/1 跳变）
    }
    this._clEnergy += (clE - this._clEnergy) * sm;
    this._yaw = s.yaw || 0;
    this.masterLP.frequency.setTargetAtTime(7600 + pitchN * 2400 + pulse * 1200, t, 0.3);
    this.revSend.gain.setTargetAtTime(0.07 + fovN * 0.1, t, 0.3);
    this.master.gain.setTargetAtTime(0.7 + pulse * 0.1, t, 0.25);
    this.ambGain.gain.setTargetAtTime(0.02 + pulse * 0.02, t, 0.3);
    this._focus(s.focus, t);
    const stepDur = (60 / this.bpm) / 4;
    while (this.nextTime < t + this.lookahead) {
      this._scheduleStep(this.nextTime, stepDur);
      this.nextTime += stepDur; this.step++; this.debug.steps++;
      if (this.step % 16 === 0) this._onBar();
    }
  }

  _onBar() {
    this.bar++;
    if (this.bar % 2 === 0) { const k = (this.bar * 5) % this.motif.length; this.motif[k] = clamp(this.motif[k] + (this._rng() < 0.5 ? 1 : -1), 0, 5); }   // 动机变异
    if (this.bar % 4 === 0) {                                  // 乐句边界：平滑转调（走向）+ 换进行 + 重掷变化
      if (this.curKey !== this.targetKey) { this.curKey += clamp(this.targetKey - this.curKey, -2, 2); this.debug.mods++; }   // ≤2 半音/乐句 → 像有意的 key change
      this.curProgIdx = this.targetProgIdx;
      this._rollLoop();
    }
  }

  _rollLoop() {   // 每 4 小节重掷"小变化" → 没有两段完全一样
    this.lv = {
      compA: this._rng() < 0.7, compB: this._rng() < 0.5,
      ghostHat: this._rng() < (0.4 + this.trackEnergy * 0.4),
      melBusy: this._rng() < (0.3 + this.trackEnergy * 0.5),
      walk: this._rng() < 0.5, hatRoll: this._rng() < 0.3,
    };
  }

  _curProg() { return PROGS[this.curProgIdx] || PROGS[0]; }
  _chord() { const p = this._curProg(); return p[(this.bar >> 1) % p.length]; }

  _scheduleStep(gridT, stepDur) {
    const step = this.step % 16, bar = this.bar, ex = this._exhale, dom = this.dom, lv = this.lv, key = this.curKey, gr = this.groove;
    const swing = (step % 2 === 1) ? stepDur * this.swing : 0;
    const t = gridT + swing + (this._rng() - 0.5) * 0.008;
    const ch = this._chord();
    const intro = bar < 1;                                     // 开场 1 小节：仅和弦+噪底
    const drop = !intro && (bar % 16) < 2 && bar >= 4;         // 每 16 小节前 2 小节 breakdown（鼓 drop，和弦/旋律漂浮）

    // —— 鼓 ——（intro/drop 不打鼓，留 hats 轻点）
    if (!intro && !drop) {
      if (gr.kick.indexOf(step) >= 0) this._kick(t, 0.88 + this._rng() * 0.1);
      if (gr.snare.indexOf(step) >= 0) this._snare(t, 0.6 + this._rng() * 0.1);
      if ((bar & 7) === 7 && (step === 13 || step === 14 || step === 15)) this._snare(t, 0.34 + this._rng() * 0.12);   // 8 小节末 fill
    }
    if (!intro && (step % 2 === 0 || (lv.ghostHat && ex > 0.4 && step % 2 === 1))) {
      const vel = (step % 4 === 0 ? 0.5 : 0.32) * (step % 2 === 1 ? 0.55 : 1) * (drop ? 0.6 : 1);
      this._hat(t, vel * (0.8 + this._rng() * 0.3), step === 14);
    }
    if (!intro && !drop && lv.hatRoll && step === 15) { for (let r = 0; r < 3; r++) this._hat(t + r * stepDur / 3, 0.22 + r * 0.04, false); }   // triplet roll fill

    // —— 贝斯 ——（drop 时保留 → 撑住）
    if (!intro) {
      if (step === gr.kick[0] || step === 10) this._bass(t, mtof(key + ch.r - 12), stepDur * 5, 0.85);
      else if (step === 6 && ex > 0.4) this._bass(t, mtof(key + ch.r - 12 + 7), stepDur * 2, 0.5);
      else if (lv.walk && step === 14) this._bass(t, mtof(key + ch.r - 12 + 5), stepDur * 2, 0.42);   // walking 过渡音（4音过渡向下一和弦）
    }

    // —— 和弦 ——（intro/drop 也弹 → 漂浮感）
    if (step === 0) this._strikeChord(t, ch, stepDur * 14, intro || drop ? 0.42 : 0.5);
    else if (lv.compA && step === 6 && ex > 0.35) this._strikeChord(t, ch, stepDur * 2.4, 0.22, true);
    else if (lv.compB && step === 11 && ex > 0.45) this._strikeChord(t, ch, stepDur * 2.2, 0.18, true);

    // —— 旋律 —— 极稀疏、只落和弦音；落音颜色=主导可见簇色相、密度=该簇能量+focus能量+呼吸（你看着哪片自组织→听见它）+ call-response/八度 ——
    const colorN = (this._clHue != null) ? this._clHue : this._toneAvg;   // 主导可见 SOM 簇色相（无则退回整体视野色相）
    const liveE = Math.max(this.trackEnergy, this._clEnergy || 0);
    const melHit = (step === 0 || step === 4 || step === 6 || step === 10 || step === 14);
    const melGate = (ex * 0.42 + liveE * 0.28 + (lv.melBusy ? 0.1 : 0));
    if (!intro && melHit && this._rng() < melGate && (bar & 1) === 0) {
      const tones = CHORD[ch.c];
      const ti = (Math.round(colorN * (tones.length - 1)) + (this.motif[this.motifPos % this.motif.length] % tones.length)) % tones.length;
      this.motifPos++;
      const oct = 12 * (this._rng() < (0.2 + liveE * 0.2) ? 2 : 1);
      this._mel(t, mtof(key + ch.r + tones[ti] + oct), stepDur * 3, 0.3, clamp(Math.sin(this._yaw) * 0.4, -0.5, 0.5), dom);
      this.lastMelStep = this.step;
    } else if (!intro && !drop && (step === 7 || step === 11) && this.step - this.lastMelStep <= 4 && this._rng() < 0.4 * liveE + 0.15) {
      const tones = CHORD[ch.c], ti = (this._rng() * tones.length) | 0;   // call-response 答句
      this._mel(t, mtof(key + ch.r + tones[ti] + 12), stepDur * 2, 0.22, clamp(-Math.sin(this._yaw) * 0.4, -0.5, 0.5), dom);
    }
  }

  // ---------- 乐器 ----------
  _kick(t, vel) {
    const o = this.ctx.createOscillator(); o.type = 'sine'; const g = this.ctx.createGain();
    const kb = this.patch.kickBoom;   // 音色签名：boomy(低扫深·长尾) ↔ 略紧（内省↔明亮），仍是软 lofi kick
    o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(46 - kb * 8, t + 0.10 + kb * 0.05);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.005); g.gain.setTargetAtTime(0.0001, t + 0.04, 0.07 + kb * 0.06);
    o.connect(g); g.connect(this.drumBus); o.start(t); o.stop(t + 0.5); this._duck(t); this.debug.kicks++;
  }
  _snare(t, vel) {
    const src = this.ctx.createBufferSource(); src.buffer = this._noise; src.loop = true;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8;
    const ng = this.ctx.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(vel, t + 0.003); ng.gain.setTargetAtTime(0.0001, t + 0.02, 0.055);
    src.connect(bp); bp.connect(ng); ng.connect(this.drumBus); src.start(t); src.stop(t + 0.25);
    const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 190;
    const og = this.ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(vel * 0.5, t + 0.003); og.gain.setTargetAtTime(0.0001, t + 0.02, 0.05);
    o.connect(og); og.connect(this.drumBus); o.start(t); o.stop(t + 0.2); this.debug.snares++;
  }
  _hat(t, vel, open) {
    const src = this.ctx.createBufferSource(); src.buffer = this._noise; src.loop = true;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7800;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.001); g.gain.setTargetAtTime(0.0001, t + 0.005, open ? 0.07 : 0.022);
    src.connect(hp); hp.connect(g); g.connect(this.drumBus); src.start(t); src.stop(t + 0.2);
  }
  _bass(t, freq, dur, vel) {
    const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(freq, t);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = this.patch.bassWarm; lp.Q.value = 0.7;   // 每宇宙 bass 暖度签名
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.012); g.gain.setTargetAtTime(0.0001, t + dur * 0.6, dur * 0.4);
    o.connect(lp); lp.connect(g); g.connect(this.bassBus); o.start(t); o.stop(t + dur + 0.2);
  }
  _epiano(t, freq, dur, vel, dest, ratio, idx, dec) {
    const car = this.ctx.createOscillator(); car.type = 'sine'; car.frequency.value = freq; this.wow.connect(car.detune);
    const mod = this.ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = freq * (ratio || 1);
    const mg = this.ctx.createGain(); mg.gain.setValueAtTime(freq * (idx || 2) * this.patch.epBright, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, freq * 0.25), t + 0.4);   // Rhodes FM 亮度签名（每宇宙）
    mod.connect(mg); mg.connect(car.frequency);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.006); g.gain.setTargetAtTime(0.0001, t + 0.05, (dur || 1) * (dec || 0.9));
    car.connect(g); g.connect(dest); car.start(t); mod.start(t); car.stop(t + dur + 0.5); mod.stop(t + dur + 0.5);
  }
  _strikeChord(t, ch, dur, vel, upper) {
    const tones = CHORD[ch.c], base = this.curKey + 12 + ch.r, list = upper ? tones.slice(1) : tones;
    for (let k = 0; k < list.length; k++) this._epiano(t + k * 0.012, mtof(base + list[k]), dur, vel * (0.9 - k * 0.08), this.chordBus, this.epRatio, 2.0, 0.85);
    this.debug.chords++;
  }
  _mel(t, freq, dur, vel, pan, dom) {
    const tn = MEL_TONE[dom] || MEL_TONE[0];
    const pn = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const dest = pn || this.melBus; if (pn) { pn.pan.value = pan; pn.connect(this.melBus); }
    this._epiano(t, freq, dur, vel, dest, tn.ratio, tn.idx, tn.dec); this.debug.mels++;
  }
  _duck(t) { const g = this.chordDuck.gain; g.cancelScheduledValues(t); g.setValueAtTime(0.5, t); g.linearRampToValueAtTime(1, t + 0.2); }

  // focus = "跟踪哪个数据" → 设走向 target（乐句边界平滑趋近）+ 一记柔和电钢音
  _focus(focus, t) {
    const key = focus ? (focus.idx + ':' + focus.sys) : null;
    if (key === this._lastFocusKey) return; this._lastFocusKey = key;
    if (!focus) { this.targetKey = this.sessKey; this.targetProgIdx = this.baseProgIdx; this.trackEnergy = 0.5; return; }   // 松开 → 回基调
    const tr = TRACK[focus.group] || TRACK[0];
    const hueShift = (focus.tone > 0.66 ? 2 : focus.tone < 0.33 ? -2 : 0);   // 色相 → 额外微移调
    this.targetKey = clamp(this.sessKey + tr.key + hueShift, this.sessKey - 9, this.sessKey + 9);
    this.targetProgIdx = tr.prog; this.trackEnergy = tr.energy;
    const ch = this._chord(), tones = CHORD[ch.c], ti = Math.round((focus.tone || 0.5) * (tones.length - 1));
    this._epiano(t, mtof(this.curKey + 24 + ch.r + tones[ti]), 1.4, 0.32, this.focBus, 1, 2.2, 1.0);
  }

  setMuted(b) { this.muted = b; if (this.master) this.master.gain.setTargetAtTime(b ? 0.0001 : 0.7, this.ctx.currentTime, 0.25); }

  _satCurve(drive) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * drive); } return c; }
  _reverbIR(sec) { const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) { const tt = i / len; d[i] = (this._rng() * 2 - 1) * Math.pow(1 - tt, 3.2); } } return b; }
  _noiseBuf(sec) { const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = this._rng() * 2 - 1; return b; }
  _rng() { this._s = (this._s == null ? 0x9e3779b9 : this._s + 0x6D2B79F5) | 0; let x = this._s; x = Math.imul(x ^ (x >>> 15), 1 | x); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }
  // 涌现签名的雪崩混合：sig(整张密度场指纹) + salt → 均匀散开的确定性整数。用于"每宇宙一次性"参数(速度/进行/groove/动机)，
  // 与 _rng 状态完全隔离（不推进 _s）→ 同宇宙恒定、同宇宙同曲，跨宇宙每次真的不同。（借鉴 neon-abyss audio-club.js）
  _sigMix(salt) { let x = ((this._sig0 || 0) ^ Math.imul((salt | 0) + 1, 0x9e3779b9)) | 0; x = Math.imul(x ^ (x >>> 16), 0x7feb352d); x = Math.imul(x ^ (x >>> 15), 0x846ca68b); x ^= x >>> 16; return x >>> 0; }
}
