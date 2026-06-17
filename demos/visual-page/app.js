// 数渊 · Data Abyss  (v3 — chaotic-attractor edition)
// 运动内核换成 CPU 积分的混沌动力系统（strange attractors），得到真正的非周期/混沌路径。
// 三套系统共存（"三体/多体"）：
//   cities      → Thomas attractor   · 混沌参数 b = 宜居度（舒适越多越规整）· 初值用经纬度播种
//   products    → Lorenz butterfly   · ρ = 成熟度
//   kernels     → Lorenz butterfly   · 与产品交织
//   milestones  → Rössler spiral     · c = 年份新近度
//   policies    → Rössler spiral     · c = 目标金额
//   vendors     → Thomas（外圈大尺度·慢）
// 角速度（积分步长）= 数据特征 · 麦克风 uPulse 加速整片宇宙。
// 视觉：大小/色相/明灭/雾晕仍数据驱动；无 bloom；每颗星拖 18 帧渐隐轨迹；连线=淡虚线（弱化）。

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const IS_MOBILE = matchMedia('(pointer: coarse)').matches || innerWidth < 820;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const IND = '../china-industrial-software/assets/data/';
const TRAIL = IS_MOBILE ? 14 : 26;   // 轨迹历史帧数上限（每点实际尾长由数据决定）

// ---------- scene ----------
const container = document.getElementById('scene');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060e, 0.0019);

const camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 4000);
camera.position.set(0, 48, 176);

const renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const root = new THREE.Group();
scene.add(root);

// gradient backdrop
{
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(0x0a1230) }, bot: { value: new THREE.Color(0x030308) } },
    vertexShader: `varying float h; void main(){ h = normalize(position).y*0.5+0.5; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying float h; uniform vec3 top; uniform vec3 bot; void main(){ gl_FragColor = vec4(mix(bot, top, pow(h,1.4)), 1.0); }`
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 24), mat));
}

const U = { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() }, uPulse: { value: 0 } };

const pointMaterial = new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
  vertexShader: `
    uniform float uTime; uniform float uPixelRatio; uniform float uPulse;
    attribute vec3 aColor; attribute float aSize; attribute float aTwinkle; attribute float aHaze; attribute float aOrbPhase;
    varying vec3 vColor; varying float vHaze;
    void main(){
      vHaze = aHaze;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float tw = 0.6 + aTwinkle*0.5*sin(uTime*1.4 + aOrbPhase*6.2831) + uPulse*0.4;
      vColor = aColor * tw;
      gl_PointSize = aSize * (1.0 + uPulse*0.3) * uPixelRatio * (320.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    varying vec3 vColor; varying float vHaze;
    void main(){
      vec2 uv = gl_PointCoord - 0.5; float d = length(uv);
      float core = smoothstep(0.5, 0.0, d);
      float halo = smoothstep(0.5, 0.14, d) * 0.4 * vHaze;
      float al = core + halo; if (al < 0.012) discard;
      gl_FragColor = vec4(vColor * (core*1.5 + halo), al);
    }`
});

const trailMaterial = new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `attribute float aAge; attribute vec3 aColor; varying float vAge; varying vec3 vC;
    void main(){ vAge = aAge; vC = aColor; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `varying float vAge; varying vec3 vC; void main(){ float a = 1.0 - vAge; if (a <= 0.0) discard; a = a*a*0.6; gl_FragColor = vec4(vC*a, a); }`
});

// 关系连线：实线 + 半透明（normal blending，弱化）
const beamMaterial = new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
  vertexShader: `attribute vec3 aColor; varying vec3 vC;
    void main(){ vC = aColor; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 0.18); }`
});

// ---------- builders (collect into plain arrays, finalize after counts known) ----------
const D = { sys: [], anc: [], scl: [], bh: [], prm: [], spd: [], seed: [], rot: [], tlen: [], col: [], sz: [], tw: [], hz: [], op: [], meta: [] };
function hash01(str) { let h = 2166136261; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100003) / 100003; }
const BEAM = { a: [], b: [], col: [] };
const tmpCol = new THREE.Color();

// sys: 0 Thomas · 1 Lorenz · 2 Rössler
function addStar(sys, anc, scale, baseH, prm, spd, seed, h, s, l, size, twinkle, haze, meta, rot, tlen) {
  tmpCol.setHSL((((h % 360) + 360) % 360) / 360, s, l);
  D.sys.push(sys); D.anc.push(anc[0], anc[1], anc[2]); D.scl.push(scale); D.bh.push(baseH);
  D.prm.push(prm); D.spd.push(spd); D.seed.push(seed[0], seed[1], seed[2]);
  rot = rot || [0, 0, 0]; D.rot.push(rot[0], rot[1], rot[2]);
  D.tlen.push(tlen || TRAIL * 0.5);
  D.col.push(tmpCol.r, tmpCol.g, tmpCol.b); D.sz.push(size); D.tw.push(twinkle); D.hz.push(haze); D.op.push(Math.random());
  D.meta.push(meta);
  return D.sys.length - 1;
}

const _ang = {}; let _ai = 0;
const angleFor = (k) => (k in _ang ? _ang[k] : (_ang[k] = (_ai++) * 2.3999632));

function buildHousing() {
  const listings = window.HOUSING_LISTINGS || [];
  const enriched = window.HOUSING_ENRICHED || {};
  let n = 0;
  for (const ls of listings) {
    const e = enriched[String(ls.id)] || enriched[ls.id];
    if (!e || e.lat == null || e.lng == null) continue;
    const months = e.climate ? Object.keys(e.climate).map((m) => e.climate[m][0]) : [10];
    const tRange = months.length ? Math.max(...months) - Math.min(...months) : 20;
    const comfort = e.daily?.comfortDayCount ?? 110;
    const sun = e.daily?.sunshineHours ?? 1900;
    const pm = e.pm25Annual ?? 35;
    const elev = e.elevation ?? 60;
    const burden = (e.hazard?.hazards || []).reduce((s, h) => s + Math.pow(2, (h.freq || 1) - 1), 0);
    const unit = (ls.priceWan * 10000) / (ls.area || 60);
    const yld = ls.rent > 0 ? (ls.rent * 12) / (ls.priceWan * 10000) : 0;
    const outflow = e.demographics?.popChangePct ?? 0;
    const cf = clamp(comfort / 365, 0, 1);

    const hue = 220 - cf * 162;
    const sat = 0.44 + clamp(tRange / 45, 0, 1) * 0.5;
    const light = (0.45 + clamp(sun / 3500, 0, 1) * 0.2) * (outflow < 0 ? 0.78 : 1);
    const size = 1.6 + clamp(Math.log10(unit + 1) - 2.2, 0, 3) * 1.7;
    const tw = 0.28 + clamp(burden / 40, 0, 1) * 0.72;
    const hz = clamp(pm / 85, 0, 1);
    const spd = 0.5 + (yld > 0 ? clamp(yld / 0.05, 0, 1) : cf) * 0.9;   // 钱越快越快
    const b = 0.15 + cf * 0.06;                                         // 宜居越多越规整
    // 城市按年均温分三类气候云：冷→Thomas / 温→Sprott-B / 热→Lorenz-84（横向分开）
    const annualMean = months.reduce((a, m2) => a + m2, 0) / months.length;
    let csys, canc, cscl, cbh, cseed;
    if (annualMean < 8) { csys = 0; canc = [-58, 12, 0]; cscl = 7; cbh = 0.045; cseed = [(e.lng - 104) * 0.05, -(e.lat - 35) * 0.05, elev * 0.0006]; }
    else if (annualMean < 18) { csys = 7; canc = [0, 8, 0]; cscl = 9; cbh = 0.02; cseed = [(Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5]; }
    else { csys = 8; canc = [58, 12, -10]; cscl = 8; cbh = 0.02; cseed = [(Math.random() - 0.5), 1 + (Math.random() - 0.5), 1 + (Math.random() - 0.5)]; }
    const ctail = 5 + clamp((Math.log10(unit + 1) - 2.2) / 3, 0, 1) * (TRAIL - 6);   // 越贵彗尾越长
    addStar(csys, canc, cscl, cbh, b, spd, cseed, hue, sat, light, size, tw, hz, {
      k: '城市 CITY', name: ls.loc || ls.city,
      sub: `${ls.prov} · ${ls.city} · 单价 ${(unit / 10000).toFixed(1)} 万/㎡ · 宜居 ${comfort} 天 · 海拔 ${Math.round(elev)} m${e.hazard?.top?.[0] ? ' · ' + e.hazard.top[0] : ''}`
    }, null, ctail);
    n++;
  }
  return n;
}

async function buildIndustrial() {
  const CATS = ['cad', 'cae', 'eda', 'bim-gis', 'mes-dcs', 'platform', 'slicers', 'open-source', 'plm', 'erp'];
  const j = (p) => fetch(IND + p).then((r) => r.json()).catch(() => null);
  const [cats, vend, kern, brk, pol, prs] = await Promise.all([
    Promise.all(CATS.map((c) => j('categories/' + c + '.json').then((d) => (d && d.products) || []))),
    j('vendors.json'), j('kernels.json'), j('breakthroughs.json'), j('policies.json'), j('comparisons/benchmark-pairs.json')
  ]);
  const products = cats.flat();
  const vendors = (vend && (vend.vendors || vend)) || [];
  const kernels = (kern && (kern.kernels || kern)) || [];
  const milestones = (brk && (brk.milestones || brk)) || [];
  const policies = (pol && (pol.policies || pol)) || [];
  const pairs = (prs && (prs.pairs || prs)) || [];

  const kIdx = {}, pIdx = {};
  const hueOf = (o) => (o === 'domestic' ? 44 : o === 'open_source' ? 140 : 210);
  const colOf = (o) => (o === 'domestic' ? [0.55, 0.42, 0.18] : o === 'open_source' ? [0.24, 0.5, 0.28] : [0.2, 0.32, 0.55]);
  const lz = () => [0.1 + (Math.random() - 0.5), (Math.random() - 0.5), 20 + (Math.random() - 0.5) * 2];
  const az = () => [0.1 + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3];   // Aizawa
  const hv = () => [-5 + (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)];                       // Halvorsen
  const dd = () => [1.1 + (Math.random() - 0.5), 2.1 + (Math.random() - 0.5), -2 + (Math.random() - 0.5)];           // Dadras
  const lu = () => [0.1 + (Math.random() - 0.5), (Math.random() - 0.5), 18 + (Math.random() - 0.5) * 2];             // Lü
  const slf = () => [(Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)];                           // Sprott-Linz F
  const nh = () => [(Math.random() - 0.5), 4 + (Math.random() - 0.5), (Math.random() - 0.5)];                        // Nose-Hoover
  const ro2 = () => [(Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5)];                   // Rössler

  kernels.forEach((k) => {
    const used = (k.used_by_product_ids || []).length;
    kIdx[k.id] = addStar(1, [-26, 74, 0], 0.85, 0.0016, 28, 0.45, lz(), hueOf(k.origin), 0.7, 0.55, 3.0 + used * 0.04, 0.4, 0.25, {
      k: '内核 KERNEL', name: k.name_zh || k.name_en, sub: `${k.origin === 'domestic' ? '国产' : '国外'} · ${k.owner || ''} · 被 ${used} 个产品使用`
    }, null, 6 + clamp(used / 30, 0, 1) * (TRAIL - 6));
  });

  // 产品按出身分三种图案：国产→Lorenz蝴蝶 / 国外→Lü / 开源→Sprott-Linz F
  products.forEach((p) => {
    const mat = p.maturity === 'high' ? 1 : p.maturity === 'medium' ? 0.5 : 0;
    let psys, panc, pscl, pbh, pseed;
    if (p.origin === 'domestic') { psys = 1; panc = [-26, 74, 0]; pscl = 0.85; pbh = 0.002; pseed = lz(); }
    else if (p.origin === 'open_source') { psys = 11; panc = [4, 86, -18]; pscl = 8; pbh = 0.012; pseed = slf(); }
    else { psys = 9; panc = [30, 74, 0]; pscl = 0.85; pbh = 0.0016; pseed = lu(); }
    const i = addStar(psys, panc, pscl, pbh, 24 + mat * 6, 0.5 + (1 - mat) * 0.8, pseed,
      hueOf(p.origin), 0.62, 0.42 + mat * 0.1,
      p.maturity === 'high' ? 3.0 : p.maturity === 'medium' ? 2.1 : 1.5,
      p.localization_depth === 'full' ? 0.25 : 0.45, clamp(1 - (p.confidence ?? 0.8), 0, 1), {
      k: '产品 PRODUCT', name: p.name_zh || p.name_en,
      sub: `${p.category_l2 || p.category_l1 || ''} · ${p.origin === 'domestic' ? '国产' : p.origin === 'open_source' ? '开源' : '国外'} · 成熟度 ${p.maturity || '—'} · 本地化 ${p.localization_depth || '—'}`
    }, null, 5 + mat * (TRAIL - 6));
    pIdx[p.id] = i;
    if (p.kernel_id && kIdx[p.kernel_id] != null) { const c = colOf(p.origin); BEAM.a.push(i); BEAM.b.push(kIdx[p.kernel_id]); BEAM.col.push(c[0], c[1], c[2]); }
  });

  milestones.forEach((m) => {
    const y4 = clamp(parseInt((m.date || '2000').slice(0, 4)) || 2000, 1990, 2026);
    const yf = (y4 - 1990) / 36;
    const inc = (m.incumbent_product_ids || []).length;
    const ev = m.evidence_level;
    // 突破按性质拆三团（大幅降速，不再像苍蝇）：替代过→Chen / 实证审计→Nose-Hoover / 其余→Aizawa
    let msys, manc, mscl, mbh, mseed;
    if (inc > 0) { msys = 6; manc = [-34, 50, 0]; mscl = 0.9; mbh = 0.0012; mseed = [-10 + (Math.random() - 0.5), (Math.random() - 0.5), 37 + (Math.random() - 0.5)]; }
    else if (ev === 'audited') { msys = 10; manc = [34, 62, 0]; mscl = 8; mbh = 0.005; mseed = nh(); }
    else { msys = 3; manc = [34, 50, 0]; mscl = 15; mbh = 0.005; mseed = az(); }
    const i = addStar(msys, manc, mscl, mbh, 0, 0.3 + yf * 0.4, mseed,
      30 + inc * 4, 0.85, 0.6, ev === 'audited' ? 3.2 : ev === 'case_study' ? 2.4 : 1.8, 0.92, 0.1, {
      k: '突破 BREAKTHROUGH', name: m.headline_zh || m.headline_en || '突破',
      sub: `${y4} · 攻克 ${m.capability_key || ''}${inc ? ' · 替代 ' + inc + ' 款在位产品' : ''}`
    }, [hash01('cap:' + (m.capability_key || 'x')) * 6.283, hash01('mp:' + (m.id || y4)) * 3.14 - 1.57, hash01('mr:' + (m.id || y4)) * 6.283], 7 + clamp(inc / 6, 0, 1) * (TRAIL - 7));
    (m.incumbent_product_ids || []).forEach((iid) => { if (pIdx[iid] != null) { BEAM.a.push(i); BEAM.b.push(pIdx[iid]); BEAM.col.push(0.85, 0.22, 0.28); } });
  });

  policies.forEach((p) => {
    const y4 = clamp(parseInt((p.date || '2000').slice(0, 4)) || 2000, 1985, 2026);
    const yf = (y4 - 1985) / 41;
    const hue = { program: 265, fund: 190, fyp: 300, ministry: 170 }[p.policy_type] || 240;
    const tNorm = clamp(Math.log10((p.target_value || 1) + 1) / 3, 0, 1);
    // 政策按类型分两团：纲领/五年规划→Halvorsen / 资金·部委→Rössler
    const prog = p.policy_type === 'program' || p.policy_type === 'fyp';
    const Psys = prog ? 4 : 2, Panc = prog ? [0, 30, 0] : [0, 30, 16], Pscl = prog ? 1.8 : 1.7, Pbh = prog ? 0.01 : 0.02, Pseed = prog ? hv() : ro2(), Pprm = prog ? 0 : 5.7;
    addStar(Psys, Panc, Pscl, Pbh, Pprm, 0.4 + tNorm * 0.5, Pseed, hue, 0.5, 0.6, 1.6 + tNorm * 3, 0.5, 0.3, {
      k: '政策 POLICY', name: p.title_zh || p.title_en, sub: `${y4} · ${p.policy_type || ''}${p.target_value ? ' · ' + p.target_value + (p.target_unit_zh || '') : ''}`
    }, [hash01('pt:' + (p.policy_type || 'x')) * 6.283, yf * 3.14 - 1.0 + hash01('pp:' + (p.id || y4)) * 0.6, hash01('pr:' + (p.id || y4)) * 6.283], 5 + tNorm * (TRAIL - 6));
  });

  vendors.forEach((v) => {
    addStar(5, [0, 58, 0], 1.4, 0.012, 0, 0.4, dd(),
      hueOf(v.origin), 0.4, 0.42, 1.3, 0.4, 0.5, {
      k: '厂商 VENDOR', name: v.name_zh || v.name_en, sub: `${v.origin === 'domestic' ? '国产' : v.origin === 'open_source' ? '开源' : '国外'} · ${v.hq_city || ''} ${v.hq_country || ''}`
    }, null, 4);
  });

  pairs.forEach((bp) => { if (pIdx[bp.domestic_id] != null && pIdx[bp.international_id] != null) { BEAM.a.push(pIdx[bp.domestic_id]); BEAM.b.push(pIdx[bp.international_id]); BEAM.col.push(0.2, 0.8, 0.72); } });

  return { products: products.length, vendors: vendors.length, kernels: kernels.length, milestones: milestones.length, policies: policies.length, pairs: pairs.length };
}

// ---------- typed state (filled after build) ----------
let N = 0;
let sys, anc, scl, bh, prm, spd, state, posArr, trail, rotM, head = 0;
let pointsObj, trailObj, beamObj, beamIdxA, beamIdxB, beamPos;
let dustObj;

function finalize() {
  N = D.sys.length;
  sys = Uint8Array.from(D.sys); anc = Float32Array.from(D.anc); scl = Float32Array.from(D.scl);
  bh = Float32Array.from(D.bh); prm = Float32Array.from(D.prm); spd = Float32Array.from(D.spd);
  state = Float32Array.from(D.seed); posArr = new Float32Array(N * 3); trail = new Float32Array(N * TRAIL * 3);

  // per-point 3D orientation matrix (data-driven axis) → tilts each attractor out of its plane
  rotM = new Float32Array(N * 9);
  { const e = new THREE.Euler(), m4 = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      e.set(D.rot[i * 3 + 1], D.rot[i * 3], D.rot[i * 3 + 2], 'YXZ');
      m4.makeRotationFromEuler(e); const me = m4.elements, r = i * 9;
      rotM[r] = me[0]; rotM[r + 1] = me[4]; rotM[r + 2] = me[8];
      rotM[r + 3] = me[1]; rotM[r + 4] = me[5]; rotM[r + 5] = me[9];
      rotM[r + 6] = me[2]; rotM[r + 7] = me[6]; rotM[r + 8] = me[10];
    } }

  // warm-up: pre-spread the attractors so the cloud is already unfurled on first frame
  for (let w = 0; w < 280; w++) for (let i = 0; i < N; i++) { const h = Math.min(bh[i] * spd[i], capOf(sys[i])); stepOne(i, h * 0.5); stepOne(i, h * 0.5); }

  // initial world positions + seed trail
  for (let i = 0; i < N; i++) { writeWorld(i); for (let t = 0; t < TRAIL; t++) { const o = (i * TRAIL + t) * 3; trail[o] = posArr[i * 3]; trail[o + 1] = posArr[i * 3 + 1]; trail[o + 2] = posArr[i * 3 + 2]; } }

  // points
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(posArr, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(D.col, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(D.sz, 1));
  g.setAttribute('aTwinkle', new THREE.Float32BufferAttribute(D.tw, 1));
  g.setAttribute('aHaze', new THREE.Float32BufferAttribute(D.hz, 1));
  g.setAttribute('aOrbPhase', new THREE.Float32BufferAttribute(D.op, 1));
  pointsObj = new THREE.Points(g, pointMaterial); root.add(pointsObj);

  // trails (N * (TRAIL-1) segments)
  const segs = TRAIL - 1, tv = N * segs * 2;
  beamPos; // noop
  const tpos = new Float32Array(tv * 3), tage = new Float32Array(tv), tcol = new Float32Array(tv * 3);
  for (let i = 0; i < N; i++) {
    const tlenSeg = Math.max(3, Math.min(segs, Math.round(D.tlen[i])));   // 每点彗尾长度（数据驱动）
    const cr = D.col[i * 3], cg = D.col[i * 3 + 1], cb = D.col[i * 3 + 2];
    for (let k = 0; k < segs; k++) {
      const base = (i * segs + k) * 2;
      const dNew = segs - 1 - k;                            // 0 = 距头最近（最亮）
      tage[base] = (dNew + 1) / tlenSeg;                    // 旧端；> tlenSeg 时 age>1 → fragment discard
      tage[base + 1] = dNew / tlenSeg;                      // 新端（更亮）
      tcol[base * 3] = cr; tcol[base * 3 + 1] = cg; tcol[base * 3 + 2] = cb;
      tcol[base * 3 + 3] = cr; tcol[base * 3 + 4] = cg; tcol[base * 3 + 5] = cb;
    }
  }
  const tg = new THREE.BufferGeometry();
  const tposAttr = new THREE.BufferAttribute(tpos, 3).setUsage(THREE.DynamicDrawUsage);
  tg.setAttribute('position', tposAttr);
  tg.setAttribute('aAge', new THREE.BufferAttribute(tage, 1));
  tg.setAttribute('aColor', new THREE.BufferAttribute(tcol, 3));
  trailObj = new THREE.LineSegments(tg, trailMaterial); trailObj.frustumCulled = false; root.add(trailObj);
  trailObj.userData.pos = tpos; trailObj.userData.attr = tposAttr; trailObj.userData.segs = segs;

  // beams
  if (BEAM.a.length) {
    beamIdxA = Uint16Array.from(BEAM.a); beamIdxB = Uint16Array.from(BEAM.b);
    const nb = beamIdxA.length; beamPos = new Float32Array(nb * 2 * 3);
    const bend = new Float32Array(nb * 2), bcol = new Float32Array(nb * 2 * 3);
    for (let i = 0; i < nb; i++) {
      bend[i * 2] = 0; bend[i * 2 + 1] = 1;
      bcol[i * 6] = BEAM.col[i * 3]; bcol[i * 6 + 1] = BEAM.col[i * 3 + 1]; bcol[i * 6 + 2] = BEAM.col[i * 3 + 2];
      bcol[i * 6 + 3] = BEAM.col[i * 3]; bcol[i * 6 + 4] = BEAM.col[i * 3 + 1]; bcol[i * 6 + 5] = BEAM.col[i * 3 + 2];
    }
    const bg = new THREE.BufferGeometry();
    const bAttr = new THREE.BufferAttribute(beamPos, 3).setUsage(THREE.DynamicDrawUsage);
    bg.setAttribute('position', bAttr);
    bg.setAttribute('aEnd', new THREE.BufferAttribute(bend, 1));
    bg.setAttribute('aColor', new THREE.BufferAttribute(bcol, 3));
    beamObj = new THREE.LineSegments(bg, beamMaterial); beamObj.frustumCulled = false; root.add(beamObj);
    beamObj.userData.attr = bAttr;
  }
}

function writeWorld(i) {
  const o = i * 3, sy = sys[i], s = scl[i], r = i * 9;
  let cx = 0, cy = 0, cz = 0;                                  // per-attractor centering
  if (sy === 1) cz = 25; else if (sy === 3) cz = 0.6; else if (sy === 4) { cx = -2.4; cy = -2.4; cz = -2.4; } else if (sy === 6) cz = 22; else if (sy === 8) cx = 1; else if (sy === 9) cz = 20;
  const lx = (state[o] - cx) * s, ly = (state[o + 2] - cz) * s, lz = (state[o + 1] - cy) * s;   // attractor local frame (z→up)
  posArr[o] = anc[o] + rotM[r] * lx + rotM[r + 1] * ly + rotM[r + 2] * lz;        // rotate into data-driven axis
  posArr[o + 1] = anc[o + 1] + rotM[r + 3] * lx + rotM[r + 4] * ly + rotM[r + 5] * lz;
  posArr[o + 2] = anc[o + 2] + rotM[r + 6] * lx + rotM[r + 7] * ly + rotM[r + 8] * lz;
}
function capOf(s) { return s === 1 ? 0.011 : s === 3 ? 0.02 : s === 4 ? 0.01 : s === 5 ? 0.012 : s === 6 ? 0.004 : s === 7 ? 0.02 : s === 8 ? 0.02 : s === 9 ? 0.005 : s === 10 ? 0.02 : s === 11 ? 0.02 : s === 2 ? 0.045 : 0.05; }
function stepOne(i, h) {
  const o = i * 3; let x = state[o], y = state[o + 1], z = state[o + 2]; const s = sys[i], p = prm[i];
  let dx, dy, dz;
  if (s === 0) { dx = Math.sin(y) - p * x; dy = Math.sin(z) - p * y; dz = Math.sin(x) - p * z; }                 // Thomas
  else if (s === 1) { dx = 10 * (y - x); dy = x * (p - z) - y; dz = x * y - 2.667 * z; }                          // Lorenz
  else if (s === 2) { dx = -(y + z); dy = x + 0.2 * y; dz = 0.2 + z * (x - p); }                                  // Rössler
  else if (s === 3) { dx = (z - 0.7) * x - 3.5 * y; dy = 3.5 * x + (z - 0.7) * y; dz = 0.6 + 0.95 * z - z * z * z / 3 - (x * x + y * y) * (1 + 0.25 * z) + 0.1 * z * x * x * x; } // Aizawa
  else if (s === 4) { dx = -1.4 * x - 4 * y - 4 * z - y * y; dy = -1.4 * y - 4 * z - 4 * x - z * z; dz = -1.4 * z - 4 * x - 4 * y - x * x; } // Halvorsen
  else if (s === 5) { dx = y - 3 * x + 2.7 * y * z; dy = 1.7 * y - x * z + z; dz = 2 * x * y - 9 * z; }            // Dadras
  else if (s === 6) { dx = 35 * (y - x); dy = -7 * x - x * z + 28 * y; dz = x * y - 3 * z; }                       // Chen
  else if (s === 7) { dx = y * z; dy = x - y; dz = 1 - x * y; }                                                    // Sprott-B
  else if (s === 8) { dx = -0.25 * x - y * y - z * z + 2.0; dy = -y + x * y - 4 * x * z + 1; dz = -z + 4 * x * y + x * z; } // Lorenz-84
  else if (s === 9) { dx = 36 * (y - x); dy = -x * z + 20 * y; dz = x * y - 3 * z; }                               // Lü
  else if (s === 10) { dx = y; dy = -x + y * z; dz = 1 - y * y; }                                                  // Nose-Hoover
  else { dx = y + z; dy = -x + 0.5 * y; dz = x * x - z; }                                                          // Sprott-Linz F
  x += dx * h; y += dy * h; z += dz * h;
  if (!isFinite(x) || !isFinite(y) || !isFinite(z) || Math.abs(x) > 1e4 || Math.abs(y) > 1e4 || Math.abs(z) > 1e4) {
    x = s === 4 ? -5 + (Math.random() - 0.5) : s === 6 ? -10 + (Math.random() - 0.5) : (Math.random() - 0.5);
    y = (Math.random() - 0.5); z = (s === 1 || s === 6 || s === 9) ? 20 : (Math.random() - 0.5);
  }
  state[o] = x; state[o + 1] = y; state[o + 2] = z;
}

// ---------- controls + sensors ----------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.06;
controls.autoRotate = true; controls.autoRotateSpeed = 0.05;
controls.minDistance = 40; controls.maxDistance = 700; controls.enablePan = false;
controls.target.set(0, 42, 0);

let tiltX = 0, tiltZ = 0, gyroOn = false;
addEventListener('deviceorientation', (e) => { if (e.beta == null) return; gyroOn = true; tiltX = clamp((e.beta - 50) / 90, -1, 1) * 0.26; tiltZ = clamp(e.gamma / 90, -1, 1) * 0.26; });

let analyser = null, micBuf = null;
async function enableSensors() {
  try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) await DeviceOrientationEvent.requestPermission().catch(() => {}); } catch (_) {}
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC();
    ac.createMediaStreamSource(stream); const an = ac.createAnalyser(); an.fftSize = 256;
    ac.createMediaStreamSource(stream).connect(an); analyser = an; micBuf = new Uint8Array(an.frequencyBinCount);
  } catch (_) {}
  const btn = document.getElementById('enable');
  btn.textContent = analyser ? '感应已开启 · 出声让混沌加速' : '感应已请求（真机 https 下生效）';
  setTimeout(() => { btn.parentElement.style.opacity = '0.3'; }, 2600);
}
document.getElementById('enable').addEventListener('click', enableSensors);

// pick
const raycaster = new THREE.Raycaster(); raycaster.params.Points.threshold = 2.6;
const card = document.getElementById('card'); const ndc = new THREE.Vector2();
let downX = 0, downY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 7 || !pointsObj) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(pointsObj)[0];
  if (hit && D.meta[hit.index]) { const m = D.meta[hit.index]; card.innerHTML = `<div class="k">${m.k}</div><h3>${m.name || ''}</h3><p>${m.sub || ''}</p>`; card.classList.remove('hidden'); }
  else card.classList.add('hidden');
});

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); U.uPixelRatio.value = renderer.getPixelRatio(); });

// ---------- loop ----------
const clock = new THREE.Clock();
let pulse = 0;
function animate() {
  requestAnimationFrame(animate);
  U.uTime.value = clock.getElapsedTime();
  if (analyser) { analyser.getByteFrequencyData(micBuf); let s = 0; for (let i = 0; i < micBuf.length; i++) s += micBuf[i]; pulse = lerp(pulse, clamp(s / micBuf.length / 110, 0, 1), 0.2); }
  else pulse *= 0.95;
  U.uPulse.value = pulse;

  if (N) {
    const hmul = 0.5 + pulse * 1.3;          // 全局速度（已降速）
    head = (head + 1) % TRAIL;
    for (let i = 0; i < N; i++) {
      const h = Math.min(bh[i] * spd[i] * hmul, capOf(sys[i]));
      stepOne(i, h * 0.5); stepOne(i, h * 0.5);
      writeWorld(i);
      const to = (i * TRAIL + head) * 3; trail[to] = posArr[i * 3]; trail[to + 1] = posArr[i * 3 + 1]; trail[to + 2] = posArr[i * 3 + 2];
    }
    pointsObj.geometry.attributes.position.needsUpdate = true;

    // rebuild trail segments (oldest→newest)
    const tpos = trailObj.userData.pos, segs = trailObj.userData.segs;
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < segs; k++) {
        const a = (head + 1 + k) % TRAIL, b = (head + 2 + k) % TRAIL;
        const ao = (i * TRAIL + a) * 3, bo = (i * TRAIL + b) * 3;
        const w = ((i * segs + k) * 2) * 3;
        tpos[w] = trail[ao]; tpos[w + 1] = trail[ao + 1]; tpos[w + 2] = trail[ao + 2];
        tpos[w + 3] = trail[bo]; tpos[w + 4] = trail[bo + 1]; tpos[w + 5] = trail[bo + 2];
      }
    }
    trailObj.userData.attr.needsUpdate = true;

    if (beamObj) {
      for (let i = 0; i < beamIdxA.length; i++) {
        const a = beamIdxA[i] * 3, b = beamIdxB[i] * 3, w = i * 6;
        beamPos[w] = posArr[a]; beamPos[w + 1] = posArr[a + 1]; beamPos[w + 2] = posArr[a + 2];
        beamPos[w + 3] = posArr[b]; beamPos[w + 4] = posArr[b + 1]; beamPos[w + 5] = posArr[b + 2];
      }
      beamObj.userData.attr.needsUpdate = true;
    }
  }

  if (gyroOn) { root.rotation.x = lerp(root.rotation.x, tiltX, 0.05); root.rotation.z = lerp(root.rotation.z, tiltZ, 0.05); }
  controls.update();
  renderer.render(scene, camera);
}

// ---------- dust (static stars) ----------
function buildDust() {
  const Nd = IS_MOBILE ? 1100 : 2200;
  const pos = [], col = [], size = [], tw = [], hz = [], op = [];
  for (let i = 0; i < Nd; i++) {
    const r = 90 + Math.random() * 400, th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1);
    pos.push(Math.sin(ph) * Math.cos(th) * r, Math.cos(ph) * r * 0.6 + 45, Math.sin(ph) * Math.sin(th) * r);
    tmpCol.setHSL((210 + Math.random() * 60) / 360, 0.4, 0.5); col.push(tmpCol.r, tmpCol.g, tmpCol.b);
    size.push(0.5 + Math.random() * 0.9); tw.push(0.5 + Math.random() * 0.5); hz.push(0.6); op.push(Math.random());
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  g.setAttribute('aTwinkle', new THREE.Float32BufferAttribute(tw, 1));
  g.setAttribute('aHaze', new THREE.Float32BufferAttribute(hz, 1));
  g.setAttribute('aOrbPhase', new THREE.Float32BufferAttribute(op, 1));
  dustObj = new THREE.Points(g, pointMaterial); root.add(dustObj);
}

// ---------- boot ----------
(async function main() {
  let info = {};
  try { info = await buildIndustrial(); } catch (err) { console.warn('[数渊] industrial load failed (need http server):', err); }
  const cities = buildHousing();
  finalize();
  buildDust();
  console.log(`[数渊] ${cities} 城市 · ${info.products || 0} 产品 · ${info.kernels || 0} 内核 · ${info.milestones || 0} 突破 · ${info.policies || 0} 政策 · ${info.vendors || 0} 厂商 · ${N} 混沌星体 · ${beamIdxA ? beamIdxA.length : 0} 连线`);
  const ld = document.getElementById('loading'); ld.classList.add('gone'); setTimeout(() => ld.remove(), 1000);
  animate();
})();
