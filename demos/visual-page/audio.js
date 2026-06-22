// 数渊 · Data Abyss — 生成式 lo-fi hip-hop 背景乐引擎（zero-dep, pure Web Audio）
// 目标：像 Lofi Girl 那样适合工作/学习的暖、慵懒、舒适背景音；数据只做"点缀级"调味，舒适优先。
// 配方（lofi hip-hop 的灵魂，而非 ambient drone）：
//   · 鼓组：软 kick + backbeat 军鼓 + swing 踩镲（72–82 BPM，慵懒摇头拍）——这才"能当背景学习"
//   · 和声：暖 Rhodes 电钢（FM tine）弹爵士和弦（maj7/min7/9th），经典 I–vi–ii–V 暖循环
//   · 贝斯：跟 kick 走根音，软三角波
//   · 旋律：极稀疏、只落和弦音、不滑音（避免 theremin 阴森感）
//   · 质感：干、暖、"隔层玻璃"低通 + 小房间混响 + 黑胶噪 + 轻磁带 wow + kick sidechain 轻泵
// 数据映射（点缀、不破坏舒适）：
//   · climWarm → 调性根音 + 速度（都保持暖/不阴）
//   · 呼吸 gOrg → 编曲起伏（呼气更满：旋律/ghost 踩镲/comp 出现；吸气收回到鼓+贝斯+和弦）
//   · 视野色相均值 → 旋律落音（snap 到和弦音）；主导层 → 旋律音色微调
//   · yaw → 旋律声像（仅 ±0.4）；pitch → 母带暖度微调（窄带）；fov → 混响空间；pulse(麦) → 轻推音量/滤波
//   · 选中星 → 一记柔和电钢音（它的"声音"）
//   · 变音=轻磁带 wow；变轨=按呼吸增减轨道 + 主导层换旋律音色；变奏=动机变异 + 8 小节末 fill

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 爵士和弦（半音集，含 7/9 音）
const CHORD = { maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], maj9: [0, 4, 7, 11, 14], min9: [0, 3, 7, 10, 14], dom9: [0, 4, 7, 10, 14] };
// 经典 lofi 暖循环 I–vi–ii–V（root=相对调性根的半音；每和弦 2 小节 → 8 小节大循环）
const PROG = [
  { r: 0, c: 'maj9' },   // Imaj9
  { r: 9, c: 'min7' },   // vi min7
  { r: 2, c: 'min9' },   // ii min9
  { r: 7, c: 'dom9' },   // V9
];
// 主导数据层 → 旋律音色微调（FM 比率 / 衰减）——温和，不做刺耳切换
const MEL_TONE = [
  { ratio: 1, idx: 2.2, dec: 0.9 },   // 0 CITY    暖电钢
  { ratio: 2, idx: 1.6, dec: 0.7 },   // 1 PRODUCT 稍亮
  { ratio: 1, idx: 1.4, dec: 1.1 },   // 2 KERNEL  柔
  { ratio: 3, idx: 1.8, dec: 0.6 },   // 3 BREAKTHROUGH 铃感
  { ratio: 1, idx: 1.0, dec: 1.3 },   // 4 POLICY  圆润
  { ratio: 2, idx: 2.0, dec: 0.7 },   // 5 VENDOR
  { ratio: 1, idx: 1.6, dec: 1.0 },   // 6 PHARMA  玻璃质
  { ratio: 1, idx: 2.4, dec: 0.8 },   // 7 CAT     俏皮
];

export class Sonifier {
  constructor() {
    this.ctx = null; this.started = false; this.muted = false;
    this.bpm = 76; this.step = 0; this.bar = 0; this.nextTime = 0; this.lookahead = 0.14;
    this.keyRoot = 48; this.dom = 0;
    this.motif = [0, 2, 1, 3, 2, 0, 3, 1]; this.motifPos = 0;
    this._lastFocusKey = null;
    this.debug = { steps: 0, kicks: 0, snares: 0, chords: 0, mels: 0 };
  }

  start(ctx, opts = {}) {
    if (this.started) { try { ctx.resume && ctx.resume(); } catch (_) {} this.setMuted(false); return; }
    this.ctx = ctx; this.started = true;
    const t = ctx.currentTime;
    const warm = clamp(opts.climWarm == null ? 0.5 : opts.climWarm, 0, 1);
    // climWarm → 暖调性根音 + 速度（都保持舒适区间；冷一点=略低略慢，暖一点=略高略快，绝不阴）
    this.keyRoot = warm < 0.4 ? 45 : warm > 0.7 ? 50 : 48;   // A2 / C3 / D3
    this.bpm = Math.round(72 + warm * 10);                    // 72–82 BPM
    this.subMidi = this.keyRoot;

    // ---------- 母带链：暖、干、"隔层玻璃" ----------
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.knee.value = 24; limiter.ratio.value = 4; limiter.attack.value = 0.004; limiter.release.value = 0.18;
    const master = ctx.createGain(); master.gain.value = 0;
    limiter.connect(master); master.connect(ctx.destination);
    this.master = master;

    const sat = ctx.createWaveShaper(); sat.curve = this._satCurve(1.3); sat.oversample = '2x';   // 轻磁带饱和
    const masterLP = ctx.createBiquadFilter(); masterLP.type = 'lowpass'; masterLP.frequency.value = 8500; masterLP.Q.value = 0.5;   // 暖低通（隔层玻璃，不刺）
    const hiShelf = ctx.createBiquadFilter(); hiShelf.type = 'highshelf'; hiShelf.frequency.value = 3200; hiShelf.gain.value = -4;    // 顶端轻压 → 更暖
    sat.connect(masterLP); masterLP.connect(hiShelf); hiShelf.connect(limiter);
    this.masterLP = masterLP;

    const mix = ctx.createGain(); mix.gain.value = 1; mix.connect(sat);   // 乐器总线（经母带 FX）
    this.mix = mix;

    // 小房间混响（干 lofi 只要一点点）
    const reverb = ctx.createConvolver(); reverb.buffer = this._reverbIR(1.4);
    const revSend = ctx.createGain(); revSend.gain.value = 0.1;
    const revRet = ctx.createGain(); revRet.gain.value = 0.8;
    revSend.connect(reverb); reverb.connect(revRet); revRet.connect(mix);
    this.revSend = revSend;

    // 轻磁带 wow（±4 cents，仅电钢/旋律）
    const wow = ctx.createGain(); wow.gain.value = 4;
    const lfoA = ctx.createOscillator(); lfoA.type = 'sine'; lfoA.frequency.value = 0.21;
    const lfoB = ctx.createOscillator(); lfoB.type = 'sine'; lfoB.frequency.value = 0.074; const lfoBg = ctx.createGain(); lfoBg.gain.value = 0.5;
    lfoA.connect(wow); lfoB.connect(lfoBg); lfoBg.connect(wow); lfoA.start(t); lfoB.start(t);
    this.wow = wow;

    // ---------- 分轨总线 ----------
    this.drumBus = ctx.createGain(); this.drumBus.gain.value = 0.9; this.drumBus.connect(mix);
    this.bassBus = ctx.createGain(); this.bassBus.gain.value = 0.8; this.bassBus.connect(mix);
    this.melBus = ctx.createGain(); this.melBus.gain.value = 0.5; this.melBus.connect(mix); this.melBus.connect(revSend);
    // 和弦总线 → sidechain duck（kick 触发轻泵）→ 颤音 → mix
    this.chordBus = ctx.createGain(); this.chordBus.gain.value = 0.42;
    this.chordDuck = ctx.createGain(); this.chordDuck.gain.value = 1;
    this.chordBus.connect(this.chordDuck); this.chordDuck.connect(mix); this.chordBus.connect(revSend);
    const trem = ctx.createGain(); trem.gain.value = 0.08; const tlfo = ctx.createOscillator(); tlfo.type = 'sine'; tlfo.frequency.value = 4.6;
    tlfo.connect(trem); trem.connect(this.chordBus.gain); tlfo.start(t);   // Rhodes 颤音（在基准 0.42 上 ±0.08）

    // ---------- 环境床：黑胶噪 + 底噪空气（直入 limiter，不被泵、不进暖低通 → 噼啪保持清晰）----------
    this.ambGain = ctx.createGain(); this.ambGain.gain.value = 0.0001; this.ambGain.connect(limiter);
    this._noise = this._noiseBuf(2.4);
    const crackle = ctx.createBufferSource(); crackle.buffer = this._noise; crackle.loop = true;
    const crBP = ctx.createBiquadFilter(); crBP.type = 'bandpass'; crBP.frequency.value = 2400; crBP.Q.value = 0.6;
    const crG = ctx.createGain(); crG.gain.value = 0.6; crackle.connect(crBP); crBP.connect(crG); crG.connect(this.ambGain); crackle.start(t);
    const air = ctx.createBufferSource(); air.buffer = this._noise; air.loop = true;
    const airLP = ctx.createBiquadFilter(); airLP.type = 'lowpass'; airLP.frequency.value = 2600; const airG = ctx.createGain(); airG.gain.value = 0.12;
    air.connect(airLP); airLP.connect(airG); airG.connect(this.ambGain); air.start(t);

    // ---------- focus 之声：选中星 → 一记柔和电钢音（短，不阴森）----------
    this.focBus = ctx.createGain(); this.focBus.gain.value = 0.7; this.focBus.connect(mix); this.focBus.connect(revSend);

    this.master.gain.setTargetAtTime(0.7, t, 1.5);   // 1.5s 柔和渐入
    this.nextTime = t + 0.12;
  }

  update(s) {
    if (!this.started || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    this.dom = (s.view && s.view.dom != null) ? s.view.dom : this.dom;
    const pitchN = clamp((s.pitch + 1.45) / 2.9, 0, 1);
    const fovN = clamp((s.fov - 10) / 115, 0, 1);
    const pulse = s.pulse || 0;
    this._exhale = s.gOrg == null ? 0.5 : s.gOrg;
    this._toneAvg = (s.view && s.view.toneAvg != null) ? s.view.toneAvg : 0.5;
    this._yaw = s.yaw || 0;

    // 连续控制（全部温和、窄带 → 不破坏舒适）
    this.masterLP.frequency.setTargetAtTime(7600 + pitchN * 2400 + pulse * 1200, t, 0.3);   // 暖低通仅在 7.6k–10k 窄带轻动
    this.revSend.gain.setTargetAtTime(0.07 + fovN * 0.1, t, 0.3);                            // 混响空间随变焦，幅度小
    this.master.gain.setTargetAtTime(0.7 + pulse * 0.1, t, 0.25);
    this.ambGain.gain.setTargetAtTime(0.02 + pulse * 0.02, t, 0.3);

    this._focus(s.focus, t);

    const stepDur = (60 / this.bpm) / 4;   // 16 分音符
    while (this.nextTime < t + this.lookahead) {
      this._scheduleStep(this.nextTime, stepDur);
      this.nextTime += stepDur; this.step++; this.debug.steps++;
      if (this.step % 16 === 0) this._onBar();
    }
  }

  _onBar() {
    this.bar++;
    if (this.bar % 2 === 0) { const k = (this.bar * 5) % this.motif.length; this.motif[k] = clamp(this.motif[k] + (((this.bar >> 1) & 1) ? 1 : -1), 0, 5); }   // 动机变异（变奏）
  }

  // 当前和弦（每 2 小节换一个）
  _chord() { return PROG[(this.bar >> 1) % PROG.length]; }

  _scheduleStep(gridT, stepDur) {
    const step = this.step % 16, bar = this.bar;
    const ex = this._exhale, dom = this.dom;
    // swing：16 分的"弱位"(奇数 step) 后挪 → 慵懒摇摆
    const swing = (step % 2 === 1) ? stepDur * 0.32 : 0;
    const hum = (this._rng() - 0.5) * 0.008;   // 人性化微抖
    const t = gridT + swing + hum;
    const ch = this._chord();

    // —— 鼓组 ——
    if (step === 0 || step === 10 || (step === 6 && (bar & 3) === 3)) this._kick(t, 0.9 + this._rng() * 0.08);   // kick：1 拍 + "3 拍 &"（切分）
    if (step === 4 || step === 12) this._snare(t, 0.62 + this._rng() * 0.1);                                     // 军鼓 backbeat（2、4 拍）
    if (step % 2 === 0 || (ex > 0.45 && step % 2 === 1)) {                                                        // 踩镲：8 分常驻；呼气满时加 16 分 ghost
      const vel = (step % 4 === 0 ? 0.5 : 0.32) * (step % 2 === 1 ? 0.6 : 1);
      this._hat(t, vel * (0.8 + this._rng() * 0.3), step === 14);                                                // 小节末开镲
    }
    // 8 小节末 fill：末小节后半加几记军鼓/镲
    if ((bar & 7) === 7 && (step === 13 || step === 14 || step === 15)) this._snare(t, 0.34 + this._rng() * 0.12);

    // —— 贝斯：跟 kick 走根音；6 步加一个 5 音过渡 ——
    if (step === 0 || step === 10) this._bass(t, mtof(this.keyRoot + ch.r - 12), stepDur * 5, 0.85);
    else if (step === 6 && ex > 0.4) this._bass(t, mtof(this.keyRoot + ch.r - 12 + 7), stepDur * 2, 0.5);

    // —— 和弦：小节首铺底；呼气时在 "2 拍 &"/"4 拍 &" 补软 comp ——
    if (step === 0) this._strikeChord(t, ch, stepDur * 14, 0.5);
    else if ((step === 6 || step === 11) && ex > 0.4) this._strikeChord(t, ch, stepDur * 2.4, 0.22, true);

    // —— 旋律：极稀疏，只落和弦音；呼气越满越愿意出声（变轨）——
    const melSteps = (step === 0 || step === 6 || step === 10 || step === 14);
    if (melSteps && this._rng() < (ex * 0.55 + 0.05) && (bar & 1) === 0) {
      const tones = CHORD[ch.c];
      const pickFromView = Math.round(this._toneAvg * (tones.length - 1));
      const pickFromMotif = this.motif[this.motifPos % this.motif.length] % tones.length; this.motifPos++;
      const ti = (pickFromView + pickFromMotif) % tones.length;
      const oct = 12 * (this._rng() < 0.3 ? 2 : 1);
      this._mel(t, mtof(this.keyRoot + ch.r + tones[ti] + oct), stepDur * 3, 0.3, clamp(Math.sin(this._yaw) * 0.4, -0.5, 0.5), dom);
    }
  }

  // ---------- 乐器 ----------
  _kick(t, vel) {
    const o = this.ctx.createOscillator(); o.type = 'sine';
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.005); g.gain.setTargetAtTime(0.0001, t + 0.04, 0.09);
    o.connect(g); g.connect(this.drumBus); o.start(t); o.stop(t + 0.45);
    this._duck(t); this.debug.kicks++;
  }
  _snare(t, vel) {
    const src = this.ctx.createBufferSource(); src.buffer = this._noise; src.loop = true;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8;
    const ng = this.ctx.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(vel, t + 0.003); ng.gain.setTargetAtTime(0.0001, t + 0.02, 0.055);
    src.connect(bp); bp.connect(ng); ng.connect(this.drumBus); src.start(t); src.stop(t + 0.25);
    const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 190;   // 软"身体"
    const og = this.ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(vel * 0.5, t + 0.003); og.gain.setTargetAtTime(0.0001, t + 0.02, 0.05);
    o.connect(og); og.connect(this.drumBus); o.start(t); o.stop(t + 0.2);
    this.debug.snares++;
  }
  _hat(t, vel, open) {
    const src = this.ctx.createBufferSource(); src.buffer = this._noise; src.loop = true;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7800;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.001); g.gain.setTargetAtTime(0.0001, t + 0.005, open ? 0.07 : 0.022);
    src.connect(hp); hp.connect(g); g.connect(this.drumBus); src.start(t); src.stop(t + 0.2);
  }
  _bass(t, freq, dur, vel) {
    const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(freq, t);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.7;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.012); g.gain.setTargetAtTime(0.0001, t + dur * 0.6, dur * 0.4);
    o.connect(lp); lp.connect(g); g.connect(this.bassBus); o.start(t); o.stop(t + dur + 0.2);
  }
  // Rhodes 电钢（FM tine）：carrier sine + modulator sine（index 衰减 → 铃感起音转圆润）
  _epiano(t, freq, dur, vel, dest, ratio, idx, dec) {
    const car = this.ctx.createOscillator(); car.type = 'sine'; car.frequency.value = freq; this.wow.connect(car.detune);
    const mod = this.ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = freq * (ratio || 1);
    const mg = this.ctx.createGain(); mg.gain.setValueAtTime(freq * (idx || 2), t); mg.gain.exponentialRampToValueAtTime(Math.max(1, freq * 0.25), t + 0.4);
    mod.connect(mg); mg.connect(car.frequency);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.006); g.gain.setTargetAtTime(0.0001, t + 0.05, (dur || 1) * (dec || 0.9));
    car.connect(g); g.connect(dest); car.start(t); mod.start(t); car.stop(t + dur + 0.5); mod.stop(t + dur + 0.5);
  }
  _strikeChord(t, ch, dur, vel, upper) {
    const tones = CHORD[ch.c]; const base = this.keyRoot + 12 + ch.r;   // 中音区 voicing
    const list = upper ? tones.slice(1) : tones;                        // comp 时只弹上方音（更轻）
    for (let k = 0; k < list.length; k++) {
      const m = base + list[k] - (upper ? 0 : (k === 0 ? 0 : 0));
      this._epiano(t + k * 0.012, mtof(m), dur, vel * (0.9 - k * 0.08), this.chordBus, 1, 2.0, 0.85);   // 轻琶 + 上方音递减
    }
    this.debug.chords++;
  }
  _mel(t, freq, dur, vel, pan, dom) {
    const tn = MEL_TONE[dom] || MEL_TONE[0];
    const pn = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const dest = pn || this.melBus; if (pn) { pn.pan.value = pan; pn.connect(this.melBus); }
    this._epiano(t, freq, dur, vel, dest, tn.ratio, tn.idx, tn.dec);
    this.debug.mels++;
  }
  _duck(t) {   // sidechain：kick 触发和弦/泵
    const g = this.chordDuck.gain; g.cancelScheduledValues(t); g.setValueAtTime(0.5, t); g.linearRampToValueAtTime(1, t + 0.2);
  }
  _focus(focus, t) {
    const key = focus ? (focus.idx + ':' + focus.sys) : null;
    if (key === this._lastFocusKey) return; this._lastFocusKey = key;
    if (!focus) return;
    const ch = this._chord(), tones = CHORD[ch.c];
    const ti = Math.round((focus.tone || 0.5) * (tones.length - 1));
    this._epiano(t, mtof(this.keyRoot + 24 + ch.r + tones[ti]), 1.4, 0.32, this.focBus, 1, 2.2, 1.0);   // 柔和电钢"它的声音"
  }

  setMuted(b) { this.muted = b; if (this.master) this.master.gain.setTargetAtTime(b ? 0.0001 : 0.7, this.ctx.currentTime, 0.25); }

  // ---------- 资源 ----------
  _satCurve(drive) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * drive); } return c; }
  _reverbIR(sec) { const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) { const tt = i / len; d[i] = (this._rng() * 2 - 1) * Math.pow(1 - tt, 3.2); } } return b; }
  _noiseBuf(sec) { const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = this._rng() * 2 - 1; return b; }
  _rng() { this._s = (this._s == null ? 0x9e3779b9 : this._s + 0x6D2B79F5) | 0; let x = this._s; x = Math.imul(x ^ (x >>> 15), 1 | x); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }
}
