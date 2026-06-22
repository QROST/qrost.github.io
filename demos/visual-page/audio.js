// 数渊 · Data Abyss — 生成式数据音乐引擎（zero-dep, pure Web Audio）
// 把四套数据集 + 呼吸 + 视角，奏成一段永不重复的 lo-fi 电子曲。
// 设计语义（与视觉一致：你看到的，你听见）：
//   · climWarm           → 调式(冷=小调五声/Dorian、暖=大调五声) + 根音
//   · 视野内实体色相均值  → 主旋律音级（gaze 决定听到哪些音）
//   · 主导数据层(domGroup)→ 主音音色（看城市/工业/医药/猫 各有声相）= 变轨
//   · 呼吸 gOrg          → 曲式宏起伏：吸气(混沌·重叠)=稀疏，呼气(神经地图)=丰满 = 变轨
//   · yaw(左右)          → 声像 + 旋律走向；pitch(俯仰) → 母带亮度 + 八度；fov(变焦) → 混响空间 + 音符密度
//   · 动机变异 + 和弦进行 = 变奏；磁带 wow LFO 失谐 + 主音滑音 = 变音
//   · 黑胶噪底/底噪/低频嗡 = 环境床；麦克风 pulse → 推母带增益与滤波（环境声耦合）
// lo-fi 舒适地板：五声/Dorian 几乎不会撞出刺耳和声；先锋只来自音色/节奏/生成性/微分音漂移，不靠刺耳不协和。

const TAU = 6.283185307;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);   // MIDI → Hz

// 调式（半音偏移，相对根音）
const SCALES = {
  minorPent: [0, 3, 5, 7, 10],
  majorPent: [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};
// 和弦进行（音阶级根，停在协和区间内循环）
const PROG = [0, 3, 1, 4];
// 8 个数据层 → 主音音色（wave / 基准截止Hz / 滑音s / 八度偏移）= 变轨
const TIMBRE = [
  { w: 'triangle', cut: 1400, gl: 0.09, oct: 0 },   // 0 CITY    暖（家）
  { w: 'sawtooth', cut: 1100, gl: 0.05, oct: 0 },   // 1 PRODUCT 工业·略糙
  { w: 'sine', cut: 1900, gl: 0.13, oct: 1 },       // 2 KERNEL  内核·纯
  { w: 'sawtooth', cut: 2300, gl: 0.03, oct: 1 },   // 3 BREAKTHROUGH 突破·亮快
  { w: 'triangle', cut: 760, gl: 0.20, oct: -1 },   // 4 POLICY  低沉缓
  { w: 'square', cut: 1300, gl: 0.06, oct: 0 },     // 5 VENDOR  方波
  { w: 'sine', cut: 2000, gl: 0.10, oct: 1 },       // 6 PHARMA  玻璃质
  { w: 'triangle', cut: 1600, gl: 0.07, oct: 0 },   // 7 CAT/SHELTER 俏皮软
];

export class Sonifier {
  constructor() {
    this.ctx = null; this.started = false; this.muted = false;
    this.bpm = 70; this.step = 0; this.bar = 0; this.nextTime = 0;
    this.lookahead = 0.13;                       // 调度提前量（秒）
    this.scale = SCALES.minorPent; this.rootMidi = 45;
    this.chordDeg = 0; this.motif = [0, 2, 1, 3, 2, 4, 2, 1]; this.motifPos = 0;
    this.dom = 0; this.glide = 0.1;
    this._lastFocusKey = null;
    this.debug = { steps: 0, leads: 0, plucks: 0 };
  }

  // ---- 音阶工具 ----
  _degMidi(deg, base) {                          // 音阶级 → MIDI（跨八度环绕）
    const L = this.scale.length, o = Math.floor(deg / L), idx = ((deg % L) + L) % L;
    return base + this.scale[idx] + 12 * o;
  }
  _degFreq(deg, base) { return mtof(this._degMidi(deg, base)); }

  // ---- 启动（必须在用户手势内：resume 才生效）----
  start(ctx, opts = {}) {
    if (this.started) { try { ctx.resume && ctx.resume(); } catch (_) {} this.setMuted(false); return; }
    this.ctx = ctx; this.started = true;
    const t = ctx.currentTime;

    // 调式/根音由全国年均温（climWarm）定：冷→小调五声 / 温→Dorian / 暖→大调五声
    const warm = clamp(opts.climWarm == null ? 0.5 : opts.climWarm, 0, 1);
    if (warm < 0.34) { this.scale = SCALES.minorPent; this.rootMidi = 45; }
    else if (warm < 0.6) { this.scale = SCALES.dorian; this.rootMidi = 46; }
    else { this.scale = SCALES.majorPent; this.rootMidi = 48; }
    this.padBase = this.rootMidi + 12; this.leadBase = this.rootMidi + 24; this.subMidi = this.rootMidi;

    // ---------- 母带链：bus → 饱和 → 音色低通 →(dry)→ 压限 → master → 输出；音色低通 →(send)→ 混响 →(wet)→ 压限 ----------
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 26; comp.ratio.value = 3.2; comp.attack.value = 0.006; comp.release.value = 0.25;
    const master = ctx.createGain(); master.gain.value = 0;            // 渐入
    comp.connect(master); master.connect(ctx.destination);
    this.master = master; this.comp = comp;

    const sat = ctx.createWaveShaper(); sat.curve = this._satCurve(1.6); sat.oversample = '2x';
    const toneLP = ctx.createBiquadFilter(); toneLP.type = 'lowpass'; toneLP.frequency.value = 2600; toneLP.Q.value = 0.6;
    const dry = ctx.createGain(); dry.gain.value = 0.92;
    sat.connect(toneLP); toneLP.connect(dry); dry.connect(comp);
    this.toneLP = toneLP;

    const reverb = ctx.createConvolver(); reverb.buffer = this._reverbIR(2.7);
    const send = ctx.createGain(); send.gain.value = 0.28;
    const wet = ctx.createGain(); wet.gain.value = 0.9;
    toneLP.connect(send); send.connect(reverb); reverb.connect(wet); wet.connect(comp);
    this.reverbSend = send;

    const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(sat);
    this.bus = bus;

    // ---------- 磁带 wow/flutter：慢 LFO 之和 → 失谐(cents) → pads/lead.detune（lo-fi 变音核心）----------
    const wow = ctx.createGain(); wow.gain.value = 11;                // ±11 cents
    const lfo1 = ctx.createOscillator(); lfo1.type = 'sine'; lfo1.frequency.value = 0.17;
    const lfo2 = ctx.createOscillator(); lfo2.type = 'sine'; lfo2.frequency.value = 0.063;
    const wmix = ctx.createGain(); wmix.gain.value = 0.6;
    lfo1.connect(wow); lfo2.connect(wmix); wmix.connect(wow); lfo1.start(t); lfo2.start(t);
    this.wow = wow;

    // ---------- pads：3 振荡器持续和弦，频率仅随和弦变；增益随呼吸（呼气更厚）----------
    this.padGain = ctx.createGain(); this.padGain.gain.value = 0.0001;
    const padLP = ctx.createBiquadFilter(); padLP.type = 'lowpass'; padLP.frequency.value = 1500; padLP.Q.value = 0.4;
    this.padGain.connect(padLP); padLP.connect(bus); this.padLP = padLP;
    this.pads = [];
    for (let k = 0; k < 3; k++) {
      const o = ctx.createOscillator(); o.type = k === 0 ? 'triangle' : 'sawtooth';
      o.detune.value = (k - 1) * 6; wow.connect(o.detune);           // 受 wow 失谐
      const g = ctx.createGain(); g.gain.value = k === 0 ? 0.5 : 0.3;
      o.connect(g); g.connect(this.padGain); o.start(t); this.pads.push(o);
    }

    // ---------- sub：低频正弦，downbeat 触发 ----------
    this.subOsc = ctx.createOscillator(); this.subOsc.type = 'sine'; this.subOsc.frequency.value = mtof(this.subMidi);
    this.subGain = ctx.createGain(); this.subGain.gain.value = 0.0001;
    this.subOsc.connect(this.subGain); this.subGain.connect(bus); this.subOsc.start(t);

    // ---------- lead：单声部主旋律（滑音 legato），视角/视野驱动 ----------
    this.leadOsc = ctx.createOscillator(); this.leadOsc.type = 'triangle'; this.leadOsc.frequency.value = mtof(this.leadBase);
    wow.connect(this.leadOsc.detune);
    this.leadFilt = ctx.createBiquadFilter(); this.leadFilt.type = 'lowpass'; this.leadFilt.frequency.value = 1500; this.leadFilt.Q.value = 4;
    this.leadGain = ctx.createGain(); this.leadGain.gain.value = 0.0001;
    this.leadPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    this.leadOsc.connect(this.leadFilt); this.leadFilt.connect(this.leadGain);
    if (this.leadPan) { this.leadGain.connect(this.leadPan); this.leadPan.connect(bus); } else this.leadGain.connect(bus);
    this.leadOsc.start(t);

    // ---------- focus 之声：选中一颗星 → 持续吟唱它的「公式音」 ----------
    this.focOsc = ctx.createOscillator(); this.focOsc.type = 'sine'; this.focOsc.frequency.value = mtof(this.leadBase);
    this.focGain = ctx.createGain(); this.focGain.gain.value = 0.0001;
    const focDelay = ctx.createDelay(0.6); focDelay.delayTime.value = 0.28;
    const focFb = ctx.createGain(); focFb.gain.value = 0.32;
    this.focOsc.connect(this.focGain); this.focGain.connect(bus);
    this.focGain.connect(focDelay); focDelay.connect(focFb); focFb.connect(focDelay); focDelay.connect(bus);   // 简短回声
    this.focOsc.start(t);

    // ---------- 环境床：黑胶噪底 + 底噪空气 + 低频嗡 ----------
    this.ambGain = ctx.createGain(); this.ambGain.gain.value = 0.0001; this.ambGain.connect(comp);
    const noise = this._noiseBuf(2.2);
    const crackleSrc = ctx.createBufferSource(); crackleSrc.buffer = noise; crackleSrc.loop = true;
    const crackleBP = ctx.createBiquadFilter(); crackleBP.type = 'bandpass'; crackleBP.frequency.value = 1700; crackleBP.Q.value = 0.7;
    const crackleG = ctx.createGain(); crackleG.gain.value = 0.5;
    crackleSrc.connect(crackleBP); crackleBP.connect(crackleG); crackleG.connect(this.ambGain); crackleSrc.start(t);
    const airSrc = ctx.createBufferSource(); airSrc.buffer = noise; airSrc.loop = true;
    const airLP = ctx.createBiquadFilter(); airLP.type = 'lowpass'; airLP.frequency.value = 3600;
    const airG = ctx.createGain(); airG.gain.value = 0.18;
    airSrc.connect(airLP); airLP.connect(airG); airG.connect(this.ambGain); airSrc.start(t);
    const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = mtof(this.rootMidi - 24);
    const humG = ctx.createGain(); humG.gain.value = 0.06; hum.connect(humG); humG.connect(this.ambGain); hum.start(t);

    this._setChord(0, t);
    this.master.gain.setTargetAtTime(0.62, t, 1.4);                  // 1.4s 柔和渐入
    this.nextTime = t + 0.12;
  }

  // ---- 每帧驱动（rAF 调用）：连续控制 + 前瞻调度 ----
  update(s) {
    if (!this.started || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    this.dom = (s.view && s.view.dom != null) ? s.view.dom : this.dom;
    const tb = TIMBRE[this.dom] || TIMBRE[0];

    // 连续控制（setTargetAtTime 平滑，无 zipper）
    const pitchN = clamp((s.pitch + 1.45) / 2.9, 0, 1);             // 俯仰 0..1（低头→0 抬头→1）
    const fovN = clamp((s.fov - 10) / 115, 0, 1);                   // 焦距 0(长焦/近)..1(广角/远)
    const exhale = s.gOrg == null ? 0.5 : s.gOrg;                   // 呼吸 0(吸/混沌)..1(呼/神经地图)
    const pulse = s.pulse || 0;

    // 母带亮度：抬头更亮 + 麦克风推一点（环境声耦合）
    this.toneLP.frequency.setTargetAtTime(700 + pitchN * 5200 + pulse * 1400, t, 0.12);
    // 混响空间：广角(远)更深，长焦(近)更干
    this.reverbSend.gain.setTargetAtTime(0.12 + fovN * 0.4, t, 0.2);
    // pads 增益：呼气更厚；麦克风轻推
    this.padGain.gain.setTargetAtTime(0.05 + exhale * 0.14 + pulse * 0.03, t, 0.25);
    this.padLP.frequency.setTargetAtTime(900 + exhale * 2200, t, 0.3);
    // lead 音色随主导层（变轨）+ 滤波随呼气张开
    if (this.leadOsc.type !== tb.w) this.leadOsc.type = tb.w;
    this.leadFilt.frequency.setTargetAtTime(tb.cut * (0.6 + exhale * 0.7), t, 0.12);
    this.glide = tb.gl;
    if (this.leadPan) this.leadPan.pan.setTargetAtTime(clamp(Math.sin(s.yaw) * 0.7, -1, 1), t, 0.15);
    // 环境床：整体能量（呼气 + 麦克风）轻微起伏
    this.ambGain.gain.setTargetAtTime(0.018 + exhale * 0.014 + pulse * 0.02, t, 0.3);
    this.master.gain.setTargetAtTime(0.62 + pulse * 0.12, t, 0.2);

    // focus 之声：选中变化时起音/换音，松开时收声
    this._focus(s.focus, t);

    // 前瞻调度
    const stepDur = (60 / this.bpm) / 4;                            // 16 分音符
    while (this.nextTime < t + this.lookahead) {
      this._scheduleStep(this.nextTime, s, stepDur);
      this.nextTime += stepDur; this.step++; this.debug.steps++;
      if (this.step % 16 === 0) this._onBar(this.nextTime);
    }
  }

  _onBar(time) {
    this.bar++;
    // 动机变异（变奏）：小概率改一个音级、偶尔整体移位
    if (this.bar % 2 === 0) { const k = (this.bar * 7) % this.motif.length; this.motif[k] = clamp(this.motif[k] + (((this.bar >> 1) & 1) ? 1 : -1), -2, 6); }
    // 和弦进行（变奏）：每 4 小节换一级
    if (this.bar % 4 === 0) { this.chordDeg = PROG[(this.bar / 4) % PROG.length]; this._setChord(this.chordDeg, time); }
  }

  _scheduleStep(time, s, stepDur) {
    const step = this.step % 16, beat = step % 4;
    const exhale = s.gOrg == null ? 0.5 : s.gOrg;
    const fovN = clamp((s.fov - 10) / 115, 0, 1);
    const view = s.view || {};
    const toneAvg = view.toneAvg == null ? 0.5 : view.toneAvg;     // 视野内色相均值 → 旋律目标音级
    const pitchN = clamp((s.pitch + 1.45) / 2.9, 0, 1);
    const tb = TIMBRE[this.dom] || TIMBRE[0];

    // sub：每小节首拍 + 第三拍（呼气更明显）
    if (step === 0 || step === 8) this._sub(time, exhale);

    // lead：稀疏律动；近焦(长焦/zoom-in)更密集亲密、远焦(广角)更稀疏空旷
    const density = 0.32 + (1 - fovN) * 0.5 + exhale * 0.18;        // 0.32..1.0
    const leadHit = (step === 0) || (step === 6) || (step === 10 && density > 0.6) || (step === 3 && density > 0.78) || (step === 13 && density > 0.85);
    if (leadHit) {
      const m = this.motif[this.motifPos % this.motif.length]; this.motifPos++;
      const oct = tb.oct + Math.round(pitchN * 2 - 0.5);            // 抬头升八度
      const deg = this.chordDeg + m + Math.round(toneAvg * (this.scale.length - 1));
      this._lead(time, this._degFreq(deg, this.leadBase + 12 * oct));
    }

    // pluck 琶音：呼气丰满时点缀和弦音；声像随视野色相 + 步进展开
    if (exhale > 0.4 && (step % 2 === 1)) {
      if (((this.step * 2654435761) >>> 0) % 100 < (exhale * 46 + fovN * 14)) {
        const arpDeg = this.chordDeg + [0, 2, 4, 6][(this.step >> 1) % 4];
        const pan = clamp((toneAvg - 0.5) * 1.4 + Math.sin(this.step * 1.1) * 0.4, -1, 1);
        this._pluck(time, this._degFreq(arpDeg, this.leadBase + 12), pan, 0.06 + exhale * 0.05);
      }
    }

    // 黑胶噼啪：低概率瞬态（lo-fi 环境）
    if (((this.step * 40503 + 17) >>> 0) % 100 < 9) this._crackPop(time + (beat * 0.01));
  }

  // ---- 和弦：pads 三音 ramp 到新 voicing ----
  _setChord(rootDeg, time) {
    const degs = [rootDeg, rootDeg + 2, rootDeg + 4];
    for (let k = 0; k < this.pads.length; k++) {
      const f = this._degFreq(degs[k], this.padBase);
      this.pads[k].frequency.setTargetAtTime(f, time, 0.4);         // 平滑滑入，不跳变
    }
  }

  // ---- sub 触发 ----
  _sub(time, exhale) {
    const g = this.subGain.gain, peak = 0.16 + exhale * 0.08;
    this.subOsc.frequency.setTargetAtTime(mtof(this.subMidi), time, 0.05);
    g.cancelScheduledValues(time); g.setValueAtTime(Math.max(0.0001, g.value), time);
    g.linearRampToValueAtTime(peak, time + 0.03); g.setTargetAtTime(0.0001, time + 0.12, 0.34);
  }

  // ---- lead 单声部：滑音到目标 + AD 包络（legato 主旋律）----
  _lead(time, freq) {
    this.leadOsc.frequency.setTargetAtTime(freq, time, this.glide);   // 变音：portamento
    const g = this.leadGain.gain, peak = 0.15;
    g.cancelScheduledValues(time); g.setValueAtTime(Math.max(0.0001, g.value), time);
    g.linearRampToValueAtTime(peak, time + 0.03); g.setTargetAtTime(0.0001, time + 0.18, 0.42);
    this.debug.leads++;
  }

  // ---- pluck：瞬态琶音音（池化，奏后自销）----
  _pluck(time, freq, pan, vel) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.0; o2.detune.value = 4;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq * 4 + 800; f.Q.value = 2;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    const o2g = ctx.createGain(); o2g.gain.value = 0.4;
    o.connect(f); o2.connect(o2g); o2g.connect(f); f.connect(g);
    const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pn) { pn.pan.value = pan; g.connect(pn); pn.connect(this.bus); } else g.connect(this.bus);
    g.gain.setValueAtTime(0.0001, time); g.gain.linearRampToValueAtTime(vel, time + 0.006); g.gain.setTargetAtTime(0.0001, time + 0.04, 0.13);
    o.start(time); o2.start(time); o.stop(time + 0.7); o2.stop(time + 0.7);
    this.debug.plucks++;
  }

  // ---- 黑胶噼啪瞬态 ----
  _crackPop(time) {
    const ctx = this.ctx, b = ctx.createBuffer(1, 220, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (this._rng() * 2 - 1) * Math.pow(1 - i / d.length, 5);
    const src = ctx.createBufferSource(); src.buffer = b;
    const g = ctx.createGain(); g.gain.value = 0.05 + this._rng() * 0.05;
    src.connect(g); g.connect(this.ambGain); src.start(time); src.stop(time + 0.02);
  }

  // ---- focus 吟唱：选中星 → 它的「公式音」（音高=数据，音色=吸引子族）----
  _focus(focus, t) {
    const key = focus ? (focus.idx + ':' + focus.sys) : null;
    if (key === this._lastFocusKey) return;
    this._lastFocusKey = key;
    if (!focus) { this.focGain.gain.setTargetAtTime(0.0001, t, 0.25); return; }   // 松开 → 收声
    // 音高：实体色相音级（与 lead 同调式）+ 公式参数微调八度；音色由吸引子族选波形
    const deg = Math.round((focus.tone || 0.5) * (this.scale.length - 1));
    const oct = focus.prm != null ? clamp(Math.round((focus.prm % 12) / 6) - 1, -1, 1) : 0;
    this.focOsc.type = ['sine', 'triangle', 'sawtooth', 'square'][(focus.sys || 0) % 4];
    this.focOsc.frequency.setTargetAtTime(this._degFreq(deg, this.leadBase + 12 * oct), t, 0.08);
    this.focGain.gain.cancelScheduledValues(t);
    this.focGain.gain.setValueAtTime(Math.max(0.0001, this.focGain.gain.value), t);
    this.focGain.gain.linearRampToValueAtTime(0.11, t + 0.06); this.focGain.gain.setTargetAtTime(0.05, t + 0.4, 0.5);   // 起音→持续吟唱
  }

  setMuted(b) {
    this.muted = b;
    if (this.master) this.master.gain.setTargetAtTime(b ? 0.0001 : 0.62, this.ctx.currentTime, 0.25);
  }

  // ---- 资源构造 ----
  _satCurve(drive) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * drive); } return c; }
  _reverbIR(sec) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) { const tt = i / len; d[i] = (this._rng() * 2 - 1) * Math.pow(1 - tt, 2.6); } }
    return b;
  }
  _noiseBuf(sec) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = this._rng() * 2 - 1;
    return b;
  }
  // 确定性 PRNG（mulberry32）→ 噪声/混响可复现，不依赖 Math.random 全局态
  _rng() { this._s = (this._s == null ? 0x9e3779b9 : this._s + 0x6D2B79F5) | 0; let x = this._s; x = Math.imul(x ^ (x >>> 15), 1 | x); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }
}
