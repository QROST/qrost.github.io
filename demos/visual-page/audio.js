// 数渊 · Data Abyss — 生成式 lo-fi hip-hop 背景乐引擎 v3（zero-dep, pure Web Audio）
// 像 Lofi Girl 那样适合工作/学习的暖、慵懒、舒适背景音；数据做"点缀级"调味，舒适优先。
// v3 新增（在 v2 已调好的舒适基底上叠加，绝不破坏 cozy 包络）：
//   ① 每次打开都不同：每次加载一个随机 seed → 在"舒适白名单"里随机挑 调性移调 / 和弦进行库 / 鼓 groove 库 / motif / swing / 速度
//   ② 走向随"跟踪哪个数据"变：focus(点选追踪某颗星) → 按其数据层+色相 在乐句边界平滑转调(≤2半音/乐句)+换进行+调能量；松开平滑回基调
//   ③ 更丰富 variation：进行库 + groove 库 + 每4小节乐句重掷(comp/ghost/fill) + 间歇 breakdown(鼓 drop) + intro + 旋律 call-response/八度/经过音 + 贝斯 walking + 踩镲 triplet roll
// lofi 配方不变：软 kick + backbeat 军鼓 + swing 踩镲 / 暖 Rhodes FM 电钢爵士和弦 / 软贝斯 / 极稀疏只落和弦音的旋律 / 干暖"隔层玻璃"混音 + 黑胶噪 + kick sidechain 轻泵。
// 悦耳度二期（2026-07-16）：自然乐器 ensemble —— 每宇宙/每磁带面由 sig 挑配器：尼龙吉他(Karplus-Strong 弦模型)可接管旋律/答句、
// 毛毡钢琴(非谐加法合成)可接管 comp 敲击；落拍 Rhodes pad 永不换（身份）。零采样零依赖、激励读确定性噪声缓冲 → 零新增 _rng 位点。

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
// 悦耳度 pass（2026-07-15 五视角评审）：FM idx 全表调暗——高位 2.0–2.4 的"DX 铃铛"起音边带正落 2–8kHz 疲劳带；
// 保持相对次序不变 = per-dom 音色差异照旧，只整体更暖。
const MEL_TONE = [
  { ratio: 1, idx: 1.6, dec: 0.9 }, { ratio: 2, idx: 1.3, dec: 0.7 }, { ratio: 1, idx: 1.2, dec: 1.1 }, { ratio: 3, idx: 1.4, dec: 0.6 },
  { ratio: 1, idx: 1.0, dec: 1.3 }, { ratio: 2, idx: 1.5, dec: 0.7 }, { ratio: 1, idx: 1.3, dec: 1.0 }, { ratio: 1, idx: 1.7, dec: 0.8 },
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
    this._awake = true; this._wakeAmt = 1; this._pendingDNA = null;           // SOM「觉醒」：fallback 启动=沉睡"未成形"态(_awake=false)，SOM 涌现完成后 updateDNA→乐句边界温柔成形
    // —— 磁带 A/B 面（lofi 无限电台）：同一片星海、同一 DNA，翻面 = 音乐重新做人。side 折进签名 → "另一首"，仍确定。
    this._side = 0; this._sig0Original = null; this._warm = 0.5;              // 当前面序号 / 原始涌现签名快照(翻面基准) / 当前 warm
    this._nat = null; this.ens = { mel: 0, comp: 0, pluckA: 0.45 };           // 自然乐器 buffer 缓存（start 建）/ 每宇宙 ensemble 配器（_applyDNA 推导）
    this._nextFlipBar = null; this._flipUntil = 0; this._reawakeBar = null;   // 下一次翻面的 bar 阈值 / 停带 SFX 接管 masterLP 的窗口末 / B 面回全觉醒的 bar
    this._userBusy = false;                                                   // app 报告"用户正在交互/有 focus" → 翻面顺延到下个乐句边界
    this.debug = { steps: 0, kicks: 0, snares: 0, chords: 0, mels: 0, mods: 0, sig: 0, awaken: 0, flips: 0 };
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
    this._applyDNA(dna, warm);                         // DNA→bpm/swing/prog/groove/motif/mood/timbre 全套推导（觉醒时可整套重跑，见 _applyDNA/updateDNA）
    this._awake = (dna != null);                       // 有真 DNA=直接成形；fallback(只 climWarm)=沉睡"未成形"态（仅鼓刷+极简 pad），待 SOM 涌现完成后 updateDNA 觉醒
    this._wakeAmt = this._awake ? 1 : 0;               // 低通/织体开合量（0=闷·极简, 1=全开）；update() 逐帧向 _awake 目标缓入 → 温柔成形
    this._scheduleNextFlip();                          // 排定 A 面时长（7–10 分钟，由签名导出）→ 到点在乐句边界翻到 B 面

    // ---------- 母带链（暖·干·隔层玻璃）----------
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.knee.value = 24; limiter.ratio.value = 4; limiter.attack.value = 0.004; limiter.release.value = 0.18;
    const master = ctx.createGain(); master.gain.value = 0; limiter.connect(master); master.connect(ctx.destination); this.master = master;
    const sat = ctx.createWaveShaper(); sat.curve = this._satCurve(1.15); sat.oversample = '4x';   // 悦耳度 pass：drive 1.3→1.15（瞬态不再撞进 tanh 硬拐）+ 4x 过采样压混叠
    const masterLP = ctx.createBiquadFilter(); masterLP.type = 'lowpass'; masterLP.frequency.value = 7200; masterLP.Q.value = 0.5;
    const hiShelf = ctx.createBiquadFilter(); hiShelf.type = 'highshelf'; hiShelf.frequency.value = 2800; hiShelf.gain.value = -8 + (this._sigMix(6) % 45) / 10;   // 每宇宙混音暖度 −8..−3.5（暗钝↔略亮，仍隔层玻璃；悦耳度 pass 整体下移 2dB、拐点 3200→2800）
    sat.connect(masterLP); masterLP.connect(hiShelf); hiShelf.connect(limiter); this.masterLP = masterLP; this.hiShelf = hiShelf;
    const mix = ctx.createGain(); mix.gain.value = 1; mix.connect(sat); this.mix = mix;
    const reverb = ctx.createConvolver(); reverb.buffer = this._reverbIR(1.4);
    const revSend = ctx.createGain(); revSend.gain.value = 0.1; const revRet = ctx.createGain(); revRet.gain.value = 0.8;
    revSend.connect(reverb); reverb.connect(revRet); revRet.connect(mix); this.revSend = revSend;
    const wow = ctx.createGain(); wow.gain.value = 4;
    const lfoA = ctx.createOscillator(); lfoA.type = 'sine'; lfoA.frequency.value = 0.21;
    const lfoB = ctx.createOscillator(); lfoB.type = 'sine'; lfoB.frequency.value = 0.074; const lfoBg = ctx.createGain(); lfoBg.gain.value = 0.5;
    lfoA.connect(wow); lfoB.connect(lfoBg); lfoBg.connect(wow); lfoA.start(t); lfoB.start(t); this.wow = wow;

    this.drumBus = ctx.createGain(); this.drumBus.gain.value = 0.78; this.drumBus.connect(mix);   // 悦耳度 pass 增益重排：鼓/贝斯让出 ~2dB 头顶空间给饱和器"圆化"而非"削顶"，master 0.7→0.8 补响度
    this.bassBus = ctx.createGain(); this.bassBus.gain.value = 0.72; this.bassBus.connect(mix);
    this.melBus = ctx.createGain(); this.melBus.gain.value = 0.5; this._melBaseGain = 0.5;
    // 微弱空间声像（借鉴 neon leadBus/arpBus 同构，lofi 侧只挑旋律性最强的 1 条：稀疏主旋律 melBus；pad/鼓/贝斯永远居中不动）。
    // createStereoPanner 不可用 → melPan=null，setSpatial 整体静默跳过，melBus 走原有直连（不改变现有听感）。
    this.melPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (this.melPan) { this.melBus.connect(this.melPan); this.melPan.connect(mix); this.melPan.connect(revSend); }
    else { this.melBus.connect(mix); this.melBus.connect(revSend); }
    this.chordBus = ctx.createGain(); this.chordBus.gain.value = 0.42;
    this.chordDuck = ctx.createGain(); this.chordDuck.gain.value = 1; this.chordBus.connect(this.chordDuck); this.chordDuck.connect(mix); this.chordBus.connect(revSend);
    // 毛毡钢琴专用兄弟总线（设计评审）：吃 kick duck（泵感=lofi 胶水）、但绕开 chordBus 的 5.3Hz tremolo——
    // 原声钢琴没有电钢颤音，走 tremolo 就"又是一台 Rhodes"；磁带同源感由 _playNat 的 wow→detune 提供。
    this.pianoBus = ctx.createGain(); this.pianoBus.gain.value = 0.38; this.pianoBus.connect(this.chordDuck); this.pianoBus.connect(revSend);
    const trem = ctx.createGain(); trem.gain.value = 0.05; const tlfo = ctx.createOscillator(); tlfo.type = 'sine'; tlfo.frequency.value = 5.3; tlfo.connect(trem); trem.connect(this.chordBus.gain); tlfo.start(t);   // 悦耳度 pass：深度 ±19%→±12%、频率避开 4Hz 波动强度峰（仍是经典 Rhodes 颤音区）

    // 悦耳度 pass：噪层不再裸奔——补一道 4.2k 低通再进 limiter（原先绕过整条暖化链，是唯一"永不软化"的常开元素）；
    // 噪带中心 2.4k→1.5k 移出 2–5kHz 耳敏峰（持续窄带噪最抗习惯化=长时疲劳头号源）。
    this.ambGain = ctx.createGain(); this.ambGain.gain.value = 0.0001;
    const ambLP = ctx.createBiquadFilter(); ambLP.type = 'lowpass'; ambLP.frequency.value = 4200; ambLP.Q.value = 0.5;
    this.ambGain.connect(ambLP); ambLP.connect(limiter);
    this._noise = this._noiseBuf(2.4);
    this._nat = new Map();   // 自然乐器预渲染缓存（激励读 _noise → 依赖它先建好；换 ctx 重建）
    const crackle = ctx.createBufferSource(); crackle.buffer = this._noise; crackle.loop = true;
    const crBP = ctx.createBiquadFilter(); crBP.type = 'bandpass'; crBP.frequency.value = 1500; crBP.Q.value = 0.55;
    const crG = ctx.createGain(); crG.gain.value = 0.45; crackle.connect(crBP); crBP.connect(crG); crG.connect(this.ambGain); crackle.start(t);
    const air = ctx.createBufferSource(); air.buffer = this._noise; air.loop = true;
    const airLP = ctx.createBiquadFilter(); airLP.type = 'lowpass'; airLP.frequency.value = 1900; const airG = ctx.createGain(); airG.gain.value = 0.12;
    air.connect(airLP); airLP.connect(airG); airG.connect(this.ambGain); air.start(t);

    this.focBus = ctx.createGain(); this.focBus.gain.value = 0.45; this.focBus.connect(mix); this.focBus.connect(revSend);   // 悦耳度 pass：focus 一次性高音区电钢 −4dB（原 0.7 在 +24 寄存器过于扎耳）
    this._rollLoop();   // 初始化首个乐句变化
    this.master.gain.setTargetAtTime(0.8, t, 1.5);
    this.nextTime = t + 0.12;
  }

  // 把这片宇宙的涌现 DNA 折成整套乐曲身份（速度/摇摆/情绪进行/groove/动机轮廓/音色签名）。
  // 从 start()（首次成形）与 _awaken()（SOM 涌现完成后觉醒重推导）两处调用；只用 _sigMix（与 _rng 状态隔离），
  // 故可在播放中于乐句边界安全重跑而不扰动人性化 PRNG 流。dna=null → 从 climWarm 兜底派生沉睡态身份（仍数据驱动，非随机）。
  _applyDNA(dna, warm) {
    this._warm = warm;   // 记住当前 warm → 翻面用同一 warm 重推导
    const sigRaw = (dna ? (dna.sig >>> 0) : ((Math.round(warm * 1e6) ^ 0x9e3779b9) >>> 0)) >>> 0;   // 原始涌现签名（同宇宙恒定；无 DNA 兜底从 climWarm 派生，仍来自数据非随机）
    this._sig0Original = sigRaw;   // 翻面基准：始终 = 当前 DNA 身份的原始签名（start/觉醒建立新身份时刷新；翻面用同一 dna → 幂等一致）
    // 磁带面：side=0 → A 面原曲（签名不变，与今日行为一致）；side≥1 → 把 side 折进签名 → 同宇宙"另一首"（bpm/进行/groove/motif/音色全变，仍确定）
    const _side = this._side || 0;
    this._sig0 = (_side === 0) ? sigRaw : (this._sideMix(sigRaw, _side) >>> 0);   // _sigMix 读 _sig0 → 全套一次性参数随面重生
    this._s = this._sig0 | 0;   // 人性化 PRNG 也随面重做人（仅在乐句边界重推导，安全；不影响已建的 reverb/noise 缓冲）
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
    // 自然乐器 ensemble（悦耳度二期，salt 50/51 两引擎均未占用）：每宇宙/每磁带面由 sig 挑配器。
    // 旋律 0=Rhodes 1=尼龙吉他 2=逐乐句交替；comp 敲击 0=Rhodes 1=毛毡钢琴。落拍主 pad 永远 Rhodes（lofi 身份
    // 与 wow 颤音不动）；只换既有音符路径的音色、音高选择零改动 → 和声枚举/门禁不受影响。
    const _eR = this._sigMix(50) % 20;
    this.ens = {
      mel: _eR < 12 ? 0 : _eR < 17 ? 1 : 2,                                          // 60% Rhodes / 25% 吉他 / 15% 对话（乐句 Rhodes、答句吉他——设计评审：逐音交替像坏音源，对话式才是编曲）
      comp: (this._sigMix(51) % 20) < 12 ? 0 : 1,                                    // 40% 宇宙 comp 换毛毡钢琴
      pluckA: 0.35 + ((this._sigMix(50) >>> 8) % 100) / 100 * 0.2,                   // 吉他激励亮度 0.35–0.55（暖尼龙↔略亮）
    };
    if (this._nat) this._nat.clear();                                                // 翻面/觉醒换 ensemble → 缓存重建（激励亮度随面变）
    // 每宇宙音色签名（借鉴 neon e731d85，保守化）：Rhodes 亮度 / kick 体量 / bass 暖度，由 domType(性格)+sig(变体) 定 → 音色也每次不同，仍全程 cozy。
    this.patch = {
      epBright: 0.85 + (this._sigMix(7) % 100) / 100 * 0.4,                                        // Rhodes FM 亮度 0.85–1.25×（暖钝↔明亮）
      kickBoom: (this.mood === 'wistful' ? 0.6 : this.mood === 'bright' ? 0.34 : 0.46) + (this._sigMix(8) % 20) / 100,   // 内省更 boomy·明亮更紧 ± sig 微变（仍软）
      bassWarm: 380 + (this._sigMix(9) % 130),                                                      // bass 低通 380–510（暖钝↔略清晰）
    };
    this.curKey = this.targetKey = this.sessKey;
    this.curProgIdx = this.targetProgIdx = this.baseProgIdx;
    this.subMidi = this.keyRoot;
    if (this.hiShelf && this.hiShelf.context === this.ctx) this.hiShelf.gain.setTargetAtTime(-8 + (this._sigMix(6) % 45) / 10, this.ctx.currentTime, 1.4);   // 觉醒时混音暖度随新签名温柔更新（start 期节点尚未建 → 跳过，由建链处赋值；ctx 重建恢复路径上旧 ctx 的残留节点也跳过，建链处会重赋）
  }

  // app.js 在 SOM 涌现完成后调用：若音乐仍以 fallback 沉睡态在播放，则登记"待觉醒"，在下一 4-bar 乐句边界整套重推导 DNA。
  // 幂等且安全：未播放 / 已是真 DNA（非 fallback） / 无有效 DNA → no-op。真正的重推导与低通开启在 _onBar 的边界处发生。
  updateDNA(dna) {
    if (!this.started || this.dna || !dna || dna.sig == null) return;   // 只在"播放中 + 当前为 fallback + 有真 DNA"时觉醒
    this._pendingDNA = dna;
  }

  // 乐句边界处的"觉醒"：整套 DNA 重推导 + 翻起 _awake → update() 逐帧把低通/织体从沉睡态温柔开启（无 riser，靠低通开合 + comp 层/旋律声部醒来）。
  _awaken(dna) {
    const warm = clamp(dna.warm == null ? 0.5 : dna.warm, 0, 1);
    this._applyDNA(dna, warm);
    this._awake = true; this.debug.awaken++;
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
    this._wakeAmt += ((this._awake ? 1 : 0) - this._wakeAmt) * clamp((s.dt || 0.016) / 2.6, 0, 1);   // 觉醒缓入：时间常数 ~2.6s，无 riser（沉睡→成形靠低通温柔开启 + 织体加厚，见 _scheduleStep）
    const lpBase = 6700 + pitchN * 1800 + pulse * 900, lpFloor = 1800;                               // lpFloor=沉睡态闷住的低通；悦耳度 pass：觉醒顶棚 7.6–11.2k→6.7–9.4k（lofi 母带该滚降的顶八度，镜头开合表现力保留）；暗端 6.7k 对齐 hat 高通 6.8k——再低 hat 整带落在低通裙边上、暗宇宙里会从律动中消失（round-2 裁定）
    if (!this._flipUntil || t >= this._flipUntil) this.masterLP.frequency.setTargetAtTime(lpFloor + this._wakeAmt * (lpBase - lpFloor), t, 0.3);   // 翻面停带 SFX 期间由急闭低通接管 masterLP，不与逐帧写冲突
    this.revSend.gain.setTargetAtTime(0.07 + fovN * 0.1, t, 0.3);
    this.master.gain.setTargetAtTime(0.8 + pulse * 0.1, t, 0.25);
    this.ambGain.gain.setTargetAtTime(0.02 + pulse * 0.02, t, 0.3);
    this._focus(s.focus, t);
    while (this.nextTime < t + this.lookahead) {
      const stepDur = (60 / this.bpm) / 4;   // 逐 step 读 this.bpm → 觉醒在乐句边界改 bpm 后下一 step 立即以新速度 spacing（nextTime 单调推进，无双触发）
      this._scheduleStep(this.nextTime, stepDur);
      this.nextTime += stepDur; this.step++; this.debug.steps++;
      if (this.step % 16 === 0) this._onBar(this.nextTime);   // 传下一 downbeat 时刻 → 翻面 SFX 精确对齐乐句边界
    }
  }

  _onBar(barT) {
    this.bar++;
    if (this._pendingDNA && this.bar % 4 === 0) { this._awaken(this._pendingDNA); this._pendingDNA = null; }   // SOM 涌现完成 → 在 4-bar 乐句边界整套重推导并觉醒（先于本 bar 的转调/换进行，让新身份即刻生效）
    if (this._reawakeBar != null && this.bar >= this._reawakeBar) { this._awake = true; this._reawakeBar = null; }   // 翻面后 B 面温柔展开数小节 → 回全觉醒
    if (this.bar % 2 === 0) { const k = (this.bar * 5) % this.motif.length; this.motif[k] = clamp(this.motif[k] + (this._rng() < 0.5 ? 1 : -1), 0, 5); }   // 动机变异
    if (this.bar % 4 === 0) {                                  // 乐句边界：磁带翻面 + 平滑转调（走向）+ 换进行 + 重掷变化
      // 磁带翻面（每面 7–10 分钟）：到点 + 已觉醒 + 无待觉醒 + 用户不忙 → 翻面；否则顺延到下个乐句边界（同一盘磁带，不重建宇宙）
      if (this._nextFlipBar != null && this.bar >= this._nextFlipBar && this._awake && !this._pendingDNA && !this._userBusy) {
        this._flipSide(barT != null ? barT : this.ctx.currentTime);
      }
      if (this.curKey !== this.targetKey) { this.curKey += clamp(this.targetKey - this.curKey, -2, 2); this.debug.mods++; }   // ≤2 半音/乐句 → 像有意的 key change
      this.curProgIdx = this.targetProgIdx;
      this._rollLoop();
    }
  }

  // 排定下一次翻面的 bar 阈值：每面 7–10 分钟，由签名(+side) 导出 → 确定且逐面不同。1 小节 = 240/bpm 秒。
  _scheduleNextFlip() {
    const mins = 7 + (this._sigMix(41 + (this._side & 7)) % 301) / 100;   // 7.00–10.00 分钟/面
    const bpm = this.bpm || 76;
    const bars = Math.max(16, Math.round(mins * bpm / 4));                 // bars = 分钟·60·bpm/240 = 分钟·bpm/4
    this._nextFlipBar = this.bar + bars;
  }

  // 磁带翻面：同一片星海、同一 DNA，音乐重新做人（side++ 折进签名 → 另一首，仍确定）。只从 _onBar 乐句边界调用。
  _flipSide(t) {
    this._side++; this.debug.flips++;
    this._applyDNA(this.dna, this._warm);              // 用同一 DNA + 新 side 整套重推导（bpm/进行/groove/motif/情绪/音色）
    this._lastFocusKey = null;                          // 让 focus 走向翻面后重新适用
    this._scheduleNextFlip();                           // 排下一面时长（由新 side 的签名导出 → 逐面不同）
    this._flipSfx(t);                                   // 磁带停带 SFX（合成，不引资源文件）
    this._awake = false; this._wakeAmt = 0.12;          // B 面沉睡→觉醒式温柔展开（借用低通开合，无 riser）
    this._reawakeBar = this.bar + 2;                    // ~2 小节后回全觉醒
    if (typeof window !== 'undefined' && window.dispatchEvent) {   // 通知视觉层做一次缓慢色相/曝光漂移（node/无 DOM 环境安全跳过）
      try { window.dispatchEvent(new CustomEvent('abyss-tapeflip', { detail: { side: this._side } })); } catch (_) {}
    }
  }

  // 磁带停带 SFX（~2.5s，全合成、不引资源）：主总线急闭低通 + 音乐渐隐 + 下坠 groan → 半秒黑胶噪爆 → 交还 masterLP 给 update() 温柔重开。
  _flipSfx(t) {
    const ctx = this.ctx, mix = this.mix, lp = this.masterLP;
    const T_STOP = 1.0, T_NOISE = 0.5;
    // A) 音乐总线渐隐 + 主低通急闭（停带的闷）
    mix.gain.cancelScheduledValues(t); mix.gain.setValueAtTime(mix.gain.value, t); mix.gain.linearRampToValueAtTime(0.12, t + T_STOP);
    lp.frequency.cancelScheduledValues(t); lp.frequency.setValueAtTime(Math.max(lp.frequency.value, 400), t); lp.frequency.exponentialRampToValueAtTime(300, t + T_STOP);
    // B) pitch 下坠 groan（saw 210→46Hz，模拟停带下坠）
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(46, t + T_STOP);
    const ol = ctx.createBiquadFilter(); ol.type = 'lowpass'; ol.frequency.setValueAtTime(1400, t); ol.frequency.exponentialRampToValueAtTime(240, t + T_STOP);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.16, t + 0.05); og.gain.setTargetAtTime(0.0001, t + T_STOP * 0.55, 0.28);
    og.gain.setTargetAtTime(0, t + T_STOP + 0.12, 0.015);   // 尾闭：stop 前收干净残余
    o.connect(ol); ol.connect(og); og.connect(mix); o.start(t); o.stop(t + T_STOP + 0.2);
    // C) 黑胶噪爆（复用 _noise 源）——悦耳度 pass：峰值 0.5→0.3、频带 1.8k→1.2k、尾巴放缓（涌起而非拍脸，被动聆听不受惊）
    const nt = t + T_STOP;
    const n = ctx.createBufferSource(); n.buffer = this._noise; n.loop = true;
    const nbp = ctx.createBiquadFilter(); nbp.type = 'bandpass'; nbp.frequency.value = 1200; nbp.Q.value = 0.5;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, nt); ng.gain.linearRampToValueAtTime(0.3, nt + 0.05); ng.gain.setTargetAtTime(0.0001, nt + 0.12, 0.22);
    ng.gain.setTargetAtTime(0, nt + T_NOISE + 0.1, 0.015);   // 尾闭
    n.connect(nbp); nbp.connect(ng); ng.connect(mix); n.start(nt); n.stop(nt + T_NOISE + 0.2);
    // D) B 面展开：恢复总线增益；masterLP 在窗口后交还 update()（沉睡→觉醒缓入低通）
    mix.gain.setTargetAtTime(1, nt + T_NOISE * 0.4, 0.5);
    this._flipUntil = t + T_STOP + T_NOISE + 0.1;   // 此窗口内 update() 不写 masterLP（交给停带急闭，避免逐帧写冲突）
  }

  // app.js 在 focus/拖动等交互时置位 → 翻面顺延到下个乐句边界（避免打断用户正在关注的乐句）。
  setUserBusy(b) { this._userBusy = !!b; }

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
    const awake = this._awake;                                 // 沉睡态（SOM 未涌现完成、fallback 启动）= 只有鼓刷 + 极简 pad 的"未成形"；觉醒 → kick/贝斯/comp 层/旋律声部醒来（织体加厚）

    // —— 鼓 ——（intro/drop 不打鼓，留 hats 轻点；沉睡态也只留 hats 当"鼓刷"，kick/军鼓/fill 待觉醒）
    if (!intro && !drop && awake) {
      if (gr.kick.indexOf(step) >= 0) this._kick(t, 0.88 + this._rng() * 0.1);
      if (gr.snare.indexOf(step) >= 0) this._snare(t, 0.52 + this._rng() * 0.1);
      if ((bar & 7) === 7 && (step === 13 || step === 14 || step === 15)) this._snare(t, 0.34 + this._rng() * 0.12);   // 8 小节末 fill
    }
    if (!intro && (step % 2 === 0 || (lv.ghostHat && ex > 0.4 && step % 2 === 1))) {
      const vel = (step % 4 === 0 ? 0.5 : 0.32) * (step % 2 === 1 ? 0.55 : 1) * (drop ? 0.6 : 1);
      this._hat(t, vel * (0.8 + this._rng() * 0.3) * (awake ? 1 : 0.62), step === 14);   // 沉睡态压低 = 轻柔"鼓刷"
    }
    if (!intro && !drop && awake && lv.hatRoll && step === 15) { for (let r = 0; r < 3; r++) this._hat(t + r * stepDur / 3, 0.22 + r * 0.04, false); }   // triplet roll fill

    // —— 贝斯 ——（drop 时保留 → 撑住；沉睡态无贝斯 → 待觉醒撑起低频）
    if (!intro && awake) {
      if (step === gr.kick[0] || step === 10) this._bass(t, mtof(key + ch.r - 12), stepDur * 5, 0.85);
      else if (step === 6 && ex > 0.4) this._bass(t, mtof(key + ch.r - 12 + 7), stepDur * 2, 0.5);
      else if (lv.walk && step === 14) this._bass(t, mtof(key + ch.r - 12 + 5), stepDur * 2, 0.42);   // walking 过渡音（4音过渡向下一和弦）
    }

    // —— 和弦 ——（intro/drop 也弹 → 漂浮感；沉睡态只留 step0 的极简 pad 且压低，comp 层待觉醒进来加厚织体）
    if (step === 0) this._strikeChord(t, ch, stepDur * 14, (intro || drop ? 0.42 : 0.5) * (awake ? 1 : 0.62));
    else if (awake && lv.compA && step === 6 && ex > 0.35) this._strikeChord(t, ch, stepDur * 2.4, 0.22, true);
    else if (awake && lv.compB && step === 11 && ex > 0.45) this._strikeChord(t, ch, stepDur * 2.2, 0.18, true);

    // —— 旋律 —— 极稀疏、只落和弦音；落音颜色=主导可见簇色相、密度=该簇能量+focus能量+呼吸（你看着哪片自组织→听见它）+ call-response/八度 ——（沉睡态旋律声部尚未醒来）
    const colorN = (this._clHue != null) ? this._clHue : this._toneAvg;   // 主导可见 SOM 簇色相（无则退回整体视野色相）
    const liveE = Math.max(this.trackEnergy, this._clEnergy || 0);
    const melHit = (step === 0 || step === 4 || step === 6 || step === 10 || step === 14);
    const melGate = (ex * 0.42 + liveE * 0.28 + (lv.melBusy ? 0.1 : 0));
    if (awake && !intro && melHit && this._rng() < melGate && (bar & 1) === 0) {
      const tones = CHORD[ch.c];
      let ti = (Math.round(colorN * (tones.length - 1)) + (this.motif[this.motifPos % this.motif.length] % tones.length)) % tones.length;
      this.motifPos++;
      const oct = 12 * (this._rng() < (0.12 + liveE * 0.15) ? 2 : 1);   // 悦耳度 pass：+24 高寄存器概率 0.2–0.4→0.12–0.27（高音 FM 边带是扎耳主力；配合 _epiano 键盘亮度跟随）
      // 撞车避让（harmony pass，2026-07-09）：oct=2 时若该 tone 与和弦内某音正好差 11 半音，
      // 二者的实际发声寄存器（tone+24 对 tone'+12）就贴到一个大七/小九度上（maj7 顶音 vs 高八度根音、
      // min9 的 9th vs 高八度 b3）——让位到五度(7)，全部 CHORD 类型都含 7，永不新撞。
      if (oct === 24 && tones.some((tj) => tj - tones[ti] === 11)) ti = tones.indexOf(7);
      this._mel(t, mtof(key + ch.r + tones[ti] + oct), stepDur * 3, 0.3, clamp(Math.sin(this._yaw) * 0.4, -0.5, 0.5), dom);
      this.lastMelStep = this.step;
    } else if (awake && !intro && !drop && (step === 7 || step === 11) && this.step - this.lastMelStep <= 4 && this._rng() < 0.4 * liveE + 0.15) {
      const tones = CHORD[ch.c], ti = (this._rng() * 3) | 0;   // call-response 答句：只落根/三/五（低位暖音，答句听感=收束而非新亮点；同一 _rng 位点，计数不变）
      this._mel(t, mtof(key + ch.r + tones[ti] + 12), stepDur * 2, 0.22, clamp(-Math.sin(this._yaw) * 0.4, -0.5, 0.5), dom, true);
    }
  }

  // ---------- 乐器 ----------
  _kick(t, vel) {
    const o = this.ctx.createOscillator(); o.type = 'sine'; const g = this.ctx.createGain();
    const kb = this.patch.kickBoom;   // 音色签名：boomy(低扫深·长尾) ↔ 略紧（内省↔明亮），仍是软 lofi kick
    o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(46 - kb * 8, t + 0.10 + kb * 0.05);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.005); g.gain.setTargetAtTime(0.0001, t + 0.04, 0.07 + kb * 0.06);
    g.gain.setTargetAtTime(0, t + 0.44, 0.015);   // 尾闭：stop 前把 ~2% 残余收干净（截断=低频扑声）
    o.connect(g); g.connect(this.drumBus); o.start(t); o.stop(t + 0.5); this._duck(t); this.debug.kicks++;
  }
  _snare(t, vel) {
    // 悦耳度 pass：噪带 1.9k→1.5k 移出 2–5kHz 耳敏峰、起音 3ms→6ms 圆化"纸壳裂"、三角波体加厚补暖；stop 余量放宽消截断。
    const src = this.ctx.createBufferSource(); src.buffer = this._noise; src.loop = true;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.7;
    const ng = this.ctx.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(vel, t + 0.006); ng.gain.setTargetAtTime(0.0001, t + 0.02, 0.055);
    src.connect(bp); bp.connect(ng); ng.connect(this.drumBus); src.start(t); src.stop(t + 0.35);
    const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 190;
    const og = this.ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(vel * 0.6, t + 0.003); og.gain.setTargetAtTime(0.0001, t + 0.02, 0.05);
    o.connect(og); og.connect(this.drumBus); o.start(t); o.stop(t + 0.3); this.debug.snares++;
  }
  _hat(t, vel, open) {
    // 悦耳度 pass（五视角一致的头号刺耳源）：原先只有 7.8k 高通=白噪敞到 Nyquist、每 8 分音符一次的"冰锥"；
    // 现在收成 6.8–9k 磁带钝化带 + 起音 1ms→3ms + 电平 −1.5dB → 暗色 tape hat。
    const src = this.ctx.createBufferSource(); src.buffer = this._noise; src.loop = true;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6800;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000; lp.Q.value = 0.7;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.45, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.006, open ? 0.07 : 0.022);
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(this.drumBus); src.start(t); src.stop(t + 0.32);
  }
  _bass(t, freq, dur, vel) {
    const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(freq, t);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = this.patch.bassWarm; lp.Q.value = 0.7;   // 每宇宙 bass 暖度签名
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.012); g.gain.setTargetAtTime(0.0001, t + dur * 0.6, dur * 0.4);
    g.gain.setTargetAtTime(0, t + dur + 0.14, 0.014);   // 尾闭：原 stop 时残余 ~22%=每个根音一记低频扑声；stop 前 60ms 收干净
    o.connect(lp); lp.connect(g); g.connect(this.bassBus); o.start(t); o.stop(t + dur + 0.2);
  }
  _epiano(t, freq, dur, vel, dest, ratio, idx, dec) {
    const car = this.ctx.createOscillator(); car.type = 'sine'; car.frequency.value = freq; this.wow.connect(car.detune);
    const mod = this.ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = freq * (ratio || 1);
    // 键盘亮度跟随（悦耳度 pass）：真 Rhodes 越往高音越纯，这里 FM 深度随音高衰减（600Hz 以上线性收到 0.55×），
    // 高寄存器不再喷 4–8kHz 起音边带；起音 6ms→10ms 圆化"铃铛铿"，亮度瞬态 0.4s→0.3s。
    const kbTame = clamp(1 - Math.max(0, freq - 600) / 3200 * 0.5, 0.55, 1);
    const mg = this.ctx.createGain(); mg.gain.setValueAtTime(freq * (idx || 2) * this.patch.epBright * kbTame, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, freq * 0.25), t + 0.3);   // Rhodes FM 亮度签名（每宇宙）
    mod.connect(mg); mg.connect(car.frequency);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.01); g.gain.setTargetAtTime(0.0001, t + 0.05, (dur || 1) * (dec || 0.9));
    const stopT = t + dur + 0.5;
    g.gain.setTargetAtTime(0, stopT - 0.05, 0.012);   // 尾闭：长和弦 stop 时残余可达 ~25%（最亮的乐器被硬切=每小节一记亮咔哒）；stop 前 50ms 收干净
    car.connect(g); g.connect(dest); car.start(t); mod.start(t); car.stop(stopT); mod.stop(stopT);
  }
  _strikeChord(t, ch, dur, vel, upper) {
    const tones = CHORD[ch.c], base = this.curKey + 12 + ch.r, list = upper ? tones.slice(1) : tones;
    // ensemble 配器（悦耳度二期）：钢琴宇宙的 comp 敲击（upper 变体）换毛毡钢琴——落拍主 pad 永远 Rhodes（lofi 身份）。
    // 同一 base+list 音高、同一错位 strum → 和声枚举不动，只换音色。
    if (upper && this.ens.comp === 1) {
      for (let k = 0; k < list.length; k++) this._playNat(t + k * 0.014, this._pianoBuf(mtof(base + list[k])), vel * (0.9 - k * 0.08) * 1.05, this.pianoBus, { hold: dur * 0.8, rel: 0.22 });
      this.debug.chords++; return;
    }
    for (let k = 0; k < list.length; k++) this._epiano(t + k * 0.012, mtof(base + list[k]), dur, vel * (0.9 - k * 0.08), this.chordBus, this.epRatio, 1.5, 0.85);   // 悦耳度 pass：和弦起音 FM idx 2.0→1.5（onset β 2.5→1.9，铃铛铿收敛为暖敲）
    this.debug.chords++;
  }
  _mel(t, freq, dur, vel, pan, dom, answer) {
    const tn = MEL_TONE[dom] || MEL_TONE[0];
    const pn = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const dest = pn || this.melBus; if (pn) { pn.pan.value = pan; pn.connect(this.melBus); }
    // ensemble 配器（悦耳度二期）：吉他宇宙 → 尼龙拨弦唱旋律；对话宇宙 → 乐句 Rhodes、答句吉他（借既有 call-response
    // 结构的两色对话，设计评审裁定：逐音交替像坏音源）。音高/时值/声像选择完全不变 → 只换乐器，和声枚举不动。
    const useG = this.ens.mel === 1 || (this.ens.mel === 2 && answer);
    if (useG) { this._playNat(t, this._pluckBuf(freq), vel * 0.7, dest); this.debug.mels++; return; }
    this._epiano(t, freq, dur, vel, dest, tn.ratio, tn.idx, tn.dec); this.debug.mels++;
  }
  // 悦耳度 pass：原先 setValueAtTime(0.5) 瞬时跳变=每记 kick 一次宽带咔哒；改 12ms 连续下坡，泵感保留。
  // （kick 最小间隔 ≥3 step ≈0.5s > 恢复段 0.21s，到点时增益必已回 1 → setValueAtTime(1) 无缝。）
  _duck(t) { const g = this.chordDuck.gain; g.cancelScheduledValues(t); g.setValueAtTime(1, t); g.linearRampToValueAtTime(0.55, t + 0.012); g.linearRampToValueAtTime(1, t + 0.21); }

  // ---------- 自然乐器（悦耳度二期：零采样、零新增 _rng —— 激励读 this._noise 确定性缓冲；预渲染 AudioBuffer 按音高缓存） ----------
  // Karplus-Strong 尼龙吉他拨弦：激励 = 一阶低通白噪段（系数 = 每宇宙 pluckA，暖尼龙↔略亮），
  // 弦环 y[i] = loss·(y[i-N]+y[i-N-1])/2，loss 定 ~1.5s 衰到 −60dB（高音自然更快，物理正确）。
  _pluckBuf(freq) {
    const key = 'g' + Math.round(freq * 4);
    let b = this._nat.get(key); if (b) return b;
    const sr = this.ctx.sampleRate, N = Math.max(2, Math.round(sr / freq)), ring = 1.5;
    const len = Math.floor(sr * (ring + 0.25)), d = new Float32Array(len);
    const src = this._noise.getChannelData(0), off = (Math.imul(N, 2654435761) >>> 0) % Math.max(1, src.length - N - 2);
    const a = this.ens.pluckA || 0.45;
    let lp = 0;
    for (let i = 0; i <= N; i++) { lp += a * (src[off + i] - lp); d[i] = lp; }
    const loss = Math.pow(0.001, 1 / (freq * ring));
    for (let i = N + 1; i < len; i++) d[i] = loss * 0.5 * (d[i - N] + d[i - N - 1]);
    let pk = 0; for (let i = 0; i < len; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; }
    if (pk > 0) { const s = 0.95 / pk; for (let i = 0; i < len; i++) d[i] *= s; }
    b = this.ctx.createBuffer(1, len, sr); b.getChannelData(0).set(d); this._nat.set(key, b); return b;
  }
  // 毛毡钢琴（设计评审配方）：8 分音 n^-1.4 给足音高定义，再烘焙 ~2.6kHz 一阶低通做毛毡阻尼——
  // "少分音装毛毡"只会像正弦；真毛毡 = 分音多 + 高频被毡压掉。轻非谐性（B=0.00038，弦刚性）、
  // 分音衰减随次数/音高加快（comp 用短 tau=断奏毛毡）、~400Hz 低通软槌噪 thunk、10ms 软起音。2cos 递推，零逐样本 sin。
  _pianoBuf(freq) {
    const key = 'p' + Math.round(freq * 4);
    let b = this._nat.get(key); if (b) return b;
    const sr = this.ctx.sampleRate, len = Math.floor(sr * 1.6), d = new Float32Array(len);
    const tauB = clamp(0.95 * Math.sqrt(261 / freq), 0.45, 1.1);
    for (let n = 1; n <= 8; n++) {
      const fn = n * freq * Math.sqrt(1 + 0.00038 * n * n);
      if (fn > sr * 0.45) break;
      const amp = Math.pow(n, -1.4), tau = tauB / (1 + 0.6 * (n - 1));
      const w = 2 * Math.PI * fn / sr, dk = Math.exp(-1 / (tau * sr));
      const c1 = 2 * dk * Math.cos(w), c2 = dk * dk;
      let y1 = amp * dk * Math.sin(w), y0 = 0;
      d[1] += y1;
      for (let i = 2; i < len; i++) { const y = c1 * y1 - c2 * y0; y0 = y1; y1 = y; d[i] += y; }
    }
    const src = this._noise.getChannelData(0), off = (Math.imul(Math.round(freq * 4), 40503) >>> 0) % Math.max(1, src.length - 2000);
    let th = 0;
    for (let i = 0; i < 1600 && i < len; i++) { th += 0.055 * (src[off + i] - th); d[i] += th * 0.5 * Math.exp(-i / (sr * 0.02)); }   // 软槌噪 thunk（~400Hz 低通、40ms 衰减，毛毡签名）
    let felt = 0; const fa = 1 - Math.exp(-2 * Math.PI * 2600 / sr);
    for (let i = 0; i < len; i++) { felt += fa * (d[i] - felt); d[i] = felt; }                                                        // 毛毡阻尼：整体 ~2.6kHz 一阶低通
    const atk = Math.floor(sr * 0.01);
    for (let i = 0; i < atk; i++) d[i] *= i / atk;
    let pk = 0; for (let i = 0; i < len; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; }
    if (pk > 0) { const s = 0.95 / pk; for (let i = 0; i < len; i++) d[i] *= s; }
    b = this.ctx.createBuffer(1, len, sr); b.getChannelData(0).set(d); this._nat.set(key, b); return b;
  }
  // 播放预渲染自然乐器：3ms 起坡（杀 KS 首样本非零的边界咔哒）+ 可选音乐时值释放（comp 短敲）+
  // buffer 末尾闭 + wow→detune（与 Rhodes 同一盘磁带的摆动，买回"数字太干净"的疏离感）。
  _playNat(t, buf, vel, dest, o) {
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    if (o && o.rate) src.playbackRate.value = o.rate;
    if (this.wow && src.detune) { try { this.wow.connect(src.detune); } catch (_) {} }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.003);
    if (o && o.hold != null) g.gain.setTargetAtTime(0.0001, t + o.hold, o.rel || 0.25);
    g.gain.setTargetAtTime(0, t + buf.duration - 0.05, 0.012);
    src.connect(g); g.connect(dest); src.start(t); src.stop(t + buf.duration + 0.05);
  }

  // focus = "跟踪哪个数据" → 设走向 target（乐句边界平滑趋近）+ 一记柔和电钢音
  _focus(focus, t) {
    const key = focus ? (focus.idx + ':' + focus.sys) : null;
    if (key === this._lastFocusKey) return; this._lastFocusKey = key;
    if (!focus) { this.targetKey = this.sessKey; this.targetProgIdx = this.baseProgIdx; this.trackEnergy = 0.5; return; }   // 松开 → 回基调
    const tr = TRACK[focus.group] || TRACK[0];
    const hueShift = (focus.tone > 0.66 ? 2 : focus.tone < 0.33 ? -2 : 0);   // 色相 → 额外微移调
    this.targetKey = clamp(this.sessKey + tr.key + hueShift, this.sessKey - 9, this.sessKey + 9);
    this.targetProgIdx = tr.prog; this.trackEnergy = tr.energy;
    const ch = this._chord(), tones = CHORD[ch.c];
    let ti = Math.round((focus.tone || 0.5) * (tones.length - 1));
    if (tones.some((tj) => tj - tones[ti] === 11)) ti = tones.indexOf(7);   // 同一撞车避让（focus 一次性电钢也落在 +24 register）
    this._epiano(t, mtof(this.curKey + 24 + ch.r + tones[ti]), 1.1, 0.32, this.focBus, 1, 1.4, 1.0);
  }

  // 微弱空间声像：app.js 每 ~250ms 传"主导可见 SOM 簇"质心投影 NDC x（-1..1，含陀螺导航路径同源） + closeness(0..1)。
  // x → melBus 常量声像（上限 ±0.25，与既有逐音符 yaw 宽度叠加不冲突）；closeness → 仅该声部 ≤+1.5dB 等效增益偏置。
  // x/closeness 缺省 (0,0) = 居中无偏置。melPan 为 null（无 StereoPannerNode 支持）或未 start() → no-op。
  setSpatial(x, closeness) {
    if (!this.melPan || !this.started) return;
    const t = this.ctx.currentTime;
    this.melPan.pan.setTargetAtTime(clamp(x || 0, -1, 1) * 0.25, t, 0.3);
    const g = this._melBaseGain * (1 + clamp(closeness || 0, 0, 1) * 0.1885);   // 10^(1.5/20)≈1.1885 → ≤+1.5dB
    this.melBus.gain.setTargetAtTime(g, t, 0.3);
  }

  setMuted(b) { this.muted = b; if (this.master) this.master.gain.setTargetAtTime(b ? 0.0001 : 0.8, this.ctx.currentTime, 0.25); }

  _satCurve(drive) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * drive); } return c; }
  // 悦耳度 pass：IR 烘焙时过一阶低通（a=0.35 ≈ 2.8kHz@44.1k）——白噪 IR 的平坦频谱会给每记 hat/军鼓/和弦
  // 印上 1.4s 亮金属尾（"廉价亮板混响"签名）；真实房间/板式混响高频衰减极快。电平不用补：ConvolverNode
  // 默认 normalize=true 做等功率归一，IR 的常数缩放不影响输出响度，只有频谱形状（此低通）起作用。
  // 同一 _rng 调用位点，计数不变。
  _reverbIR(sec) { const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { const tt = i / len; lp += 0.35 * ((this._rng() * 2 - 1) - lp); d[i] = lp * Math.pow(1 - tt, 3.2); } } return b; }
  _noiseBuf(sec) { const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = this._rng() * 2 - 1;
    for (let i = 0; i < 256; i++) { const w = i / 256; d[len - 256 + i] = d[len - 256 + i] * (1 - w) + d[i] * w; }   // loop 接缝交叉淡化：消常开噪层每 2.4s 一次的周期咔哒
    return b; }
  _rng() { this._s = (this._s == null ? 0x9e3779b9 : this._s + 0x6D2B79F5) | 0; let x = this._s; x = Math.imul(x ^ (x >>> 15), 1 | x); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }
  // 涌现签名的雪崩混合：sig(整张密度场指纹) + salt → 均匀散开的确定性整数。用于"每宇宙一次性"参数(速度/进行/groove/动机)，
  // 与 _rng 状态完全隔离（不推进 _s）→ 同宇宙恒定、同宇宙同曲，跨宇宙每次真的不同。（借鉴 neon-abyss audio-club.js）
  _sigMix(salt) { let x = ((this._sig0 || 0) ^ Math.imul((salt | 0) + 1, 0x9e3779b9)) | 0; x = Math.imul(x ^ (x >>> 16), 0x7feb352d); x = Math.imul(x ^ (x >>> 15), 0x846ca68b); x ^= x >>> 16; return x >>> 0; }
  // 磁带面混合：原始签名 + side → 均匀散开的新签名（side 0 由 _applyDNA 保持原曲，side≥1 各成"另一首"，仍确定）。与 _sig0 快照解耦，不推进 _rng。
  _sideMix(baseSig, side) { let x = ((baseSig >>> 0) ^ Math.imul((side | 0) + 1, 0x85ebca6b)) | 0; x = Math.imul(x ^ (x >>> 16), 0x7feb352d); x = Math.imul(x ^ (x >>> 15), 0x846ca68b); x ^= x >>> 16; return x >>> 0; }
}
