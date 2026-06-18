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

const IS_MOBILE = matchMedia('(pointer: coarse)').matches || innerWidth < 820;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const IND = '../china-industrial-software/assets/data/';
const TRAIL = IS_MOBILE ? 22 : 44;   // 轨迹历史采样数（每点实际尾长由数据决定）
const STRIDE = 10;                    // 每 STRIDE 帧采样一次 → 加大步幅=路径覆盖更长时间（双倍）、且更省
const CENTER = [0, 42, 0];           // 所有吸引子共用中心 → 重叠共舞
const SYSN = 15;                     // 系统总数
const SYS_AXIS = new Float32Array(SYSN * 3), SYS_SPIN = new Float32Array(SYSN);
const sysCos = new Float32Array(SYSN).fill(1), sysSin = new Float32Array(SYSN);
for (let s = 0; s < SYSN; s++) {     // 每个系统不同的自转轴 + 角速度
  let ax = Math.sin(s * 1.3 + 0.5), ay = Math.cos(s * 0.7 + 1.1), az = Math.sin(s * 2.1 + 0.3);
  const L = Math.hypot(ax, ay, az) || 1; SYS_AXIS[s * 3] = ax / L; SYS_AXIS[s * 3 + 1] = ay / L; SYS_AXIS[s * 3 + 2] = az / L;
  SYS_SPIN[s] = 0.04 + (s % 5) * 0.022;
}

// ---------- scene ----------
const container = document.getElementById('scene');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060e, 0.0019);

const camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 4000);
camera.position.set(0, 44, 150);

const renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const root = new THREE.Group();
scene.add(root);

// 背景：气候驱动的冷暖流体场（天穹 shader，按视角方向连续·无缝·不重复）
let climWarm = 0.5;
const bgMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  uniforms: { uTime: { value: 0 }, uWarm: { value: 0.5 }, uPulse: { value: 0 } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    precision mediump float;
    varying vec3 vDir; uniform float uTime; uniform float uWarm; uniform float uPulse;
    float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
      return mix(mix(mix(hash(i+vec3(0.,0.,0.)),hash(i+vec3(1.,0.,0.)),f.x), mix(hash(i+vec3(0.,1.,0.)),hash(i+vec3(1.,1.,0.)),f.x),f.y),
                 mix(mix(hash(i+vec3(0.,0.,1.)),hash(i+vec3(1.,0.,1.)),f.x), mix(hash(i+vec3(0.,1.,1.)),hash(i+vec3(1.,1.,1.)),f.x),f.y), f.z); }
    float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*noise(p); p=p*2.03+vec3(1.7); a*=0.5; } return s; }
    vec3 pal(float x){                                              // off-color 循环调色板（紫·蓝·青·绿·橄榄·橙·红·品）
      vec3 a = vec3(0.095, 0.095, 0.115), b = vec3(0.085, 0.075, 0.085), d = vec3(0.00, 0.33, 0.62);
      return a + b * cos(6.28318 * (x + d));
    }
    void main(){
      vec3 p = vDir*2.4; float t = uTime*0.03;
      float w = fbm(p*0.6 + vec3(t*0.2, t*0.1, 0.0));
      float f = fbm(p*1.1 + (w-0.5)*1.3 + vec3(0.0, t*0.6, t*0.2));
      float breathe = 0.5 + 0.5*sin(uTime*0.22) + uPulse*0.4;        // 缓慢呼吸（真机麦克风接管）
      float vert = (-vDir.y)*0.5 + 0.5;                              // 1=底部 0=顶部
      float hue = f*0.85 + (w-0.5)*0.45 + vert*0.18 + uTime*0.006 + (uWarm-0.5)*0.25 + 0.06;  // 走遍 off-color 全谱
      vec3 col = pal(hue);
      col *= 0.7 + 0.42*breathe;                                     // 整体随呼吸明暗起伏
      gl_FragColor = vec4(col, 1.0);
    }`
});
{ const bg = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 32), bgMat); bg.renderOrder = -1; bg.frustumCulled = false; scene.add(bg); }

const U = { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() }, uPulse: { value: 0 } };

const pointMaterial = new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
  vertexShader: `
    uniform float uTime; uniform float uPixelRatio; uniform float uPulse;
    attribute vec3 aColor; attribute float aSize; attribute float aTwinkle; attribute float aHaze; attribute float aOrbPhase; attribute float aVis; attribute float aGlow;
    varying vec3 vColor; varying float vHaze; varying float vDist;
    void main(){
      if (aVis < 0.5 || aGlow < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }   // 只有"光点型"实体才发光
      vHaze = aHaze;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vDist = -mv.z;
      float tw = 0.6 + aTwinkle*0.5*sin(uTime*1.4 + aOrbPhase*6.2831) + uPulse*0.4;
      vColor = aColor * tw;
      float sz = 0.25 + aSize * aSize * 0.3;                             // 平方映射：小更小、大更大
      float breath = 1.0 + 0.4 * sin(uTime*0.7 + aOrbPhase*6.2831);      // 呼吸般缩放（每点错相位）
      gl_PointSize = min(sz * breath * (1.0 + uPulse*0.35) * uPixelRatio * (380.0 / -mv.z), 66.0);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    varying vec3 vColor; varying float vHaze; varying float vDist;
    void main(){
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv) * 2.0; if (d > 1.0) discard;
      float core = smoothstep(0.36, 0.0, d);                                   // 白热核
      float glow = pow(1.0 - d, 2.6);                                          // 柔光晕
      float ring = smoothstep(0.07, 0.0, abs(d - 0.74)) * 0.4;                 // 极细镜环
      vec2 av = abs(uv) * 2.0;                                                 // 四芒衍射星芒
      float spike = (max(0.0, 1.0 - av.x) * max(0.0, 1.0 - av.y * 11.0) + max(0.0, 1.0 - av.y) * max(0.0, 1.0 - av.x * 11.0)) * 0.3;
      vec3 base = mix(vColor, vec3(dot(vColor, vec3(0.333))), 0.2);            // 略去正色
      vec3 col = mix(base, vec3(1.0), core * 0.75) * (core * 1.3 + glow * 0.5 + ring + spike);
      float a = core + glow * (0.4 + 0.4 * vHaze) + ring + spike;
      a *= clamp((110.0 - vDist) / 80.0, 0.28, 1.0);                    // 景深淡出
      if (a < 0.012) discard;
      gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
    }`
});

const trailMaterial = new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `attribute float aAge; attribute vec3 aColor; attribute float aVis; varying float vAge; varying vec3 vC; varying float vVis;
    void main(){ vAge = aAge; vC = aColor; vVis = aVis; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `varying float vAge; varying vec3 vC; varying float vVis; void main(){ if (vVis < 0.5) discard; float a = 1.0 - vAge; if (a <= 0.0) discard; a = a * 0.38; gl_FragColor = vec4(vC * (0.4 + 0.5 * a), a); }`
});

// 关系连线：朝相机的 ribbon，宽度由数据驱动（aWidth）；实线 + 高透明
const beamMaterial = new THREE.ShaderMaterial({
  uniforms: { uRes: { value: new THREE.Vector2(innerWidth, innerHeight) } },
  transparent: true, depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide,
  vertexShader: `
    attribute vec3 aDir; attribute float aSide; attribute vec3 aColor; attribute float aWidth; attribute float aVis;
    uniform vec2 uRes; varying vec3 vC; varying float vVis;
    void main(){
      vC = aColor; vVis = aVis;
      vec4 cA = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vec4 cB = projectionMatrix * modelViewMatrix * vec4(aDir, 1.0);
      float asp = uRes.x / uRes.y;
      vec2 d = cB.xy / cB.w - cA.xy / cA.w; d.x *= asp;
      float dl = length(d); d = dl > 0.0001 ? d / dl : vec2(1.0, 0.0);
      vec2 perp = vec2(-d.y, d.x); perp.x /= asp;
      cA.xy += perp * aSide * (aWidth / uRes.y) * 2.0 * cA.w;
      gl_Position = cA;
    }`,
  fragmentShader: `varying vec3 vC; varying float vVis; void main(){ if (vVis < 0.5) discard; gl_FragColor = vec4(vC, 0.02); }`
});

// 几何体棱线材质：彩色加性细线 + 景深淡出
const solidLineMat = new THREE.ShaderMaterial({
  uniforms: { uOpacity: { value: 0.7 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `attribute vec3 aColor; varying vec3 vC; varying float vDist;
    void main(){ vC = aColor; vec4 mv = modelViewMatrix*vec4(position,1.0); vDist = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vC; varying float vDist; uniform float uOpacity;
    void main(){ float f = clamp((110.0 - vDist)/80.0, 0.22, 1.0); gl_FragColor = vec4(vC*0.85, uOpacity*f); }`
});

// ---------- builders (collect into plain arrays, finalize after counts known) ----------
const D = { sys: [], anc: [], scl: [], bh: [], prm: [], spd: [], seed: [], rot: [], tlen: [], col: [], sz: [], tw: [], hz: [], op: [], meta: [] };
function hash01(str) { let h = 2166136261; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100003) / 100003; }
const BEAM = { a: [], b: [], col: [], w: [] };
const beamEndTmpl = [0, 1, 1, 0, 1, 0], beamSideTmpl = [-1, -1, 1, -1, 1, 1];   // 2 三角形 = ribbon quad
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
  let n = 0, cs = 0, cn = 0;
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
    cs += annualMean; cn++;
    let csys, canc, cscl, cbh, cseed;
    if (annualMean < 8) { csys = 0; canc = CENTER; cscl = 7; cbh = 0.0025; cseed = [(e.lng - 104) * 0.05, -(e.lat - 35) * 0.05, elev * 0.0006]; }
    else if (annualMean < 18) { canc = CENTER; cscl = 9; cbh = 0.00113; if (sun > 2200) { csys = 14; cseed = [(Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)]; } else { csys = 7; cseed = [(Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5]; } }
    else { csys = 8; canc = CENTER; cscl = 8; cbh = 0.00113; cseed = [(Math.random() - 0.5), 1 + (Math.random() - 0.5), 1 + (Math.random() - 0.5)]; }
    const ctail = 5 + clamp((Math.log10(unit + 1) - 2.2) / 3, 0, 1) * (TRAIL - 6);   // 越贵彗尾越长
    addStar(csys, canc, cscl, cbh, b, spd, cseed, hue, sat, light, size, tw, hz, {
      k: '城市 CITY', name: ls.loc || ls.city,
      sub: `${ls.prov} · ${ls.city} · 单价 ${(unit / 10000).toFixed(1)} 万/㎡ · 宜居 ${comfort} 天 · 海拔 ${Math.round(elev)} m${e.hazard?.top?.[0] ? ' · ' + e.hazard.top[0] : ''}`
    }, null, ctail);
    n++;
  }
  climWarm = cn ? clamp((cs / cn - 5) / 18, 0.12, 0.9) : 0.5;   // 全国年均温 → 背景冷暖偏置
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

  const kIdx = {}, pIdx = {}, kUsed = {};
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
  const nl = () => [0.35 + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, -0.16 + (Math.random() - 0.5) * 0.2]; // Newton-Leipnik
  const hd = () => [(Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)];                           // Hadley

  kernels.forEach((k) => {
    const used = (k.used_by_product_ids || []).length; kUsed[k.id] = used;
    kIdx[k.id] = addStar(1, CENTER, 0.85, 0.0016, 28, 0.45, lz(), hueOf(k.origin), 0.7, 0.55, 3.0 + used * 0.04, 0.4, 0.25, {
      k: '内核 KERNEL', name: k.name_zh || k.name_en, sub: `${k.origin === 'domestic' ? '国产' : '国外'} · ${k.owner || ''} · 被 ${used} 个产品使用`
    }, null, 6 + clamp(used / 30, 0, 1) * (TRAIL - 6));
  });

  // 产品按出身分三种图案：国产→Lorenz蝴蝶 / 国外→Lü / 开源→Sprott-Linz F
  products.forEach((p) => {
    const mat = p.maturity === 'high' ? 1 : p.maturity === 'medium' ? 0.5 : 0;
    let psys, panc, pscl, pbh, pseed;
    if (p.origin === 'domestic') { psys = 1; panc = CENTER; pscl = 0.85; pbh = 0.0014; pseed = lz(); }
    else if (p.origin === 'open_source') { psys = 11; panc = CENTER; pscl = 8; pbh = 0.008; pseed = slf(); }
    else { psys = 9; panc = CENTER; pscl = 0.85; pbh = 0.0011; pseed = lu(); }
    const i = addStar(psys, panc, pscl, pbh, 24 + mat * 6, 0.5 + (1 - mat) * 0.8, pseed,
      hueOf(p.origin), 0.62, 0.42 + mat * 0.1,
      p.maturity === 'high' ? 3.0 : p.maturity === 'medium' ? 2.1 : 1.5,
      p.localization_depth === 'full' ? 0.25 : 0.45, clamp(1 - (p.confidence ?? 0.8), 0, 1), {
      k: '产品 PRODUCT', name: p.name_zh || p.name_en,
      sub: `${p.category_l2 || p.category_l1 || ''} · ${p.origin === 'domestic' ? '国产' : p.origin === 'open_source' ? '开源' : '国外'} · 成熟度 ${p.maturity || '—'} · 本地化 ${p.localization_depth || '—'}`
    }, null, 5 + mat * (TRAIL - 6));
    pIdx[p.id] = i;
    if (p.kernel_id && kIdx[p.kernel_id] != null) { const c = colOf(p.origin); BEAM.a.push(i); BEAM.b.push(kIdx[p.kernel_id]); BEAM.col.push(c[0], c[1], c[2]); BEAM.w.push(0.6 + clamp((kUsed[p.kernel_id] || 0) / 30, 0, 1) * 3.0); }
  });

  milestones.forEach((m) => {
    const y4 = clamp(parseInt((m.date || '2000').slice(0, 4)) || 2000, 1990, 2026);
    const yf = (y4 - 1990) / 36;
    const inc = (m.incumbent_product_ids || []).length;
    const ev = m.evidence_level;
    // 突破按性质拆三团（大幅降速，不再像苍蝇）：替代过→Chen / 实证审计→Nose-Hoover / 其余→Aizawa
    let msys, manc, mscl, mbh, mseed;
    if (inc > 0) { msys = 6; manc = CENTER; mscl = 0.9; mbh = 0.0009; mseed = [-10 + (Math.random() - 0.5), (Math.random() - 0.5), 37 + (Math.random() - 0.5)]; }
    else if (ev === 'audited') { msys = 10; manc = CENTER; mscl = 8; mbh = 0.0038; mseed = nh(); }
    else { msys = 3; manc = CENTER; mscl = 15; mbh = 0.0038; mseed = az(); }
    const i = addStar(msys, manc, mscl, mbh, 0, 0.3 + yf * 0.4, mseed,
      30 + inc * 4, 0.85, 0.6, ev === 'audited' ? 3.2 : ev === 'case_study' ? 2.4 : 1.8, 0.92, 0.1, {
      k: '突破 BREAKTHROUGH', name: m.headline_zh || m.headline_en || '突破',
      sub: `${y4} · 攻克 ${m.capability_key || ''}${inc ? ' · 替代 ' + inc + ' 款在位产品' : ''}`
    }, [hash01('cap:' + (m.capability_key || 'x')) * 6.283, hash01('mp:' + (m.id || y4)) * 3.14 - 1.57, hash01('mr:' + (m.id || y4)) * 6.283], 7 + clamp(inc / 6, 0, 1) * (TRAIL - 7));
    (m.incumbent_product_ids || []).forEach((iid) => { if (pIdx[iid] != null) { BEAM.a.push(i); BEAM.b.push(pIdx[iid]); BEAM.col.push(0.85, 0.22, 0.28); BEAM.w.push(0.6 + clamp(inc / 6, 0, 1) * 3.0); } });
  });

  policies.forEach((p) => {
    const y4 = clamp(parseInt((p.date || '2000').slice(0, 4)) || 2000, 1985, 2026);
    const yf = (y4 - 1985) / 41;
    const hue = { program: 265, fund: 190, fyp: 300, ministry: 170 }[p.policy_type] || 240;
    const tNorm = clamp(Math.log10((p.target_value || 1) + 1) / 3, 0, 1);
    // 政策按类型分两团：纲领/五年规划→Halvorsen / 资金·部委→Rössler
    const prog = p.policy_type === 'program' || p.policy_type === 'fyp';
    const Psys = prog ? 4 : 2, Panc = CENTER, Pscl = prog ? 1.8 : 1.7, Pbh = prog ? 0.002 : 0.004, Pseed = prog ? hv() : ro2(), Pprm = prog ? 0 : 5.7;
    addStar(Psys, Panc, Pscl, Pbh, Pprm, 0.4 + tNorm * 0.5, Pseed, hue, 0.5, 0.6, 1.6 + tNorm * 3, 0.5, 0.3, {
      k: '政策 POLICY', name: p.title_zh || p.title_en, sub: `${y4} · ${p.policy_type || ''}${p.target_value ? ' · ' + p.target_value + (p.target_unit_zh || '') : ''}`
    }, [hash01('pt:' + (p.policy_type || 'x')) * 6.283, yf * 3.14 - 1.0 + hash01('pp:' + (p.id || y4)) * 0.6, hash01('pr:' + (p.id || y4)) * 6.283], 5 + tNorm * (TRAIL - 6));
  });

  // 厂商按出身分三种图案：国产→Dadras / 国外→Newton-Leipnik / 开源→Hadley
  vendors.forEach((v) => {
    let vsys, vseed, vscl;
    if (v.origin === 'domestic') { vsys = 5; vseed = dd(); vscl = 1.4; }
    else if (v.origin === 'open_source') { vsys = 13; vseed = hd(); vscl = 9; }
    else { vsys = 12; vseed = nl(); vscl = 14; }
    addStar(vsys, CENTER, vscl, 0.012, 0, 0.4, vseed,
      hueOf(v.origin), 0.4, 0.42, 2.4, 0.4, 0.5, {
      k: '厂商 VENDOR', name: v.name_zh || v.name_en, sub: `${v.origin === 'domestic' ? '国产' : v.origin === 'open_source' ? '开源' : '国外'} · ${v.hq_city || ''} ${v.hq_country || ''}`
    }, null, 4);
  });

  pairs.forEach((bp) => { if (pIdx[bp.domestic_id] != null && pIdx[bp.international_id] != null) { BEAM.a.push(pIdx[bp.domestic_id]); BEAM.b.push(pIdx[bp.international_id]); BEAM.col.push(0.2, 0.8, 0.72); BEAM.w.push(1.0); } });

  return { products: products.length, vendors: vendors.length, kernels: kernels.length, milestones: milestones.length, policies: policies.length, pairs: pairs.length };
}

// ---------- typed state (filled after build) ----------
let N = 0;
let sys, anc, scl, bh, prm, spd, state, posArr, trail, trailSrc, rotM, head = 0;
let pointsObj, trailObj, beamObj, beamIdxA, beamIdxB, beamPos;
let grp, segsG, pointVisArr, pointVisAttr, trailVisArr, trailVisAttr, beamVisArr, beamVisAttr, beamEnds;
let E = 0, emEnt, emLocal, entMat;   // 轨迹发射点：每个立体的每个顶点各一条
function cornersOf(t) {
  if (t === 0) return [0, 0, 0];                                                                                   // 城市=光点
  if (t === 1) { const h = 0.39, a = []; for (const x of [-h, h]) for (const y of [-h, h]) for (const z of [-h, h]) a.push(x, y, z); return a; }   // 方块 8 角（全部）
  if (t === 2) { const r = 0.5, a = []; for (let i = 0; i < 5; i++) { const an = i / 5 * 6.2832; a.push(Math.cos(an) * r, 0.475, Math.sin(an) * r); } return a; }   // 五棱柱 顶 5 角
  if (t === 3) { const s = 0.8 / Math.sqrt(3); return [s, s, s, -s, -s, s, -s, s, -s, s, -s, -s]; }               // 四面锥 4 角（全部）
  if (t === 4) { const r = 0.58, a = [0, 0.525, 0]; for (let i = 0; i < 4; i++) { const an = i / 4 * 6.2832; a.push(Math.cos(an) * r, -0.525, Math.sin(an) * r); } return a; }   // 金字塔 5（全部）
  const a = []; for (let i = 0; i < 4; i++) { const an = i / 4 * 6.2832; a.push(Math.cos(an), Math.sin(an), 0); } return a;   // 椭圆环 4 点
}
let solidGroups = [];
const _dummy = new THREE.Object3D(), _q = new THREE.Quaternion(), _v = new THREE.Vector3();
const GROUP_KEY = { '城市 CITY': 0, '产品 PRODUCT': 1, '内核 KERNEL': 2, '突破 BREAKTHROUGH': 3, '政策 POLICY': 4, '厂商 VENDOR': 5 };
const groupVis = [true, true, true, true, true, true];

function finalize() {
  N = D.sys.length;
  sys = Uint8Array.from(D.sys); anc = Float32Array.from(D.anc); scl = Float32Array.from(D.scl);
  bh = Float32Array.from(D.bh); prm = Float32Array.from(D.prm); spd = Float32Array.from(D.spd);
  state = Float32Array.from(D.seed); posArr = new Float32Array(N * 3);

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

  // initial world positions
  for (let i = 0; i < N; i++) writeWorld(i);

  // group id per point (for show/hide toggles)
  grp = Uint8Array.from(D.meta.map((m) => (m && GROUP_KEY[m.k] != null ? GROUP_KEY[m.k] : 0)));

  // points
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(posArr, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(D.col, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(D.sz, 1));
  g.setAttribute('aTwinkle', new THREE.Float32BufferAttribute(D.tw, 1));
  g.setAttribute('aHaze', new THREE.Float32BufferAttribute(D.hz, 1));
  g.setAttribute('aOrbPhase', new THREE.Float32BufferAttribute(D.op, 1));
  pointVisArr = new Float32Array(N).fill(1);
  pointVisAttr = new THREE.BufferAttribute(pointVisArr, 1).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aVis', pointVisAttr);
  const glowArr = new Float32Array(N); for (let i = 0; i < N; i++) glowArr[i] = grp[i] === 0 ? 1 : 0;   // 仅城市=光点型
  g.setAttribute('aGlow', new THREE.Float32BufferAttribute(glowArr, 1));
  pointsObj = new THREE.Points(g, pointMaterial); root.add(pointsObj);

  // trail emitters: 每个实体的每个顶点各发一条轨迹
  const emE = [], emL = [], emC = [], emT = [];
  for (let i = 0; i < N; i++) {
    const c = cornersOf(grp[i]), cc = c.length / 3;
    for (let q = 0; q < cc; q++) {
      emE.push(i); emL.push(c[q * 3], c[q * 3 + 1], c[q * 3 + 2]);
      emC.push(D.col[i * 3], D.col[i * 3 + 1], D.col[i * 3 + 2]); emT.push(D.tlen[i]);
    }
  }
  E = emE.length; emEnt = Int32Array.from(emE); emLocal = Float32Array.from(emL);
  trail = new Float32Array(E * TRAIL * 3); trailSrc = new Float32Array(E * 3); entMat = new Float32Array(N * 16);
  for (let e = 0; e < E; e++) { const gi = emEnt[e]; for (let t = 0; t < TRAIL; t++) { const o = (e * TRAIL + t) * 3; trail[o] = posArr[gi * 3]; trail[o + 1] = posArr[gi * 3 + 1]; trail[o + 2] = posArr[gi * 3 + 2]; } }

  const segs = TRAIL - 1, tv = E * segs * 2;
  const tpos = new Float32Array(tv * 3), tage = new Float32Array(tv), tcol = new Float32Array(tv * 3);
  for (let e = 0; e < E; e++) {
    const tlenSeg = Math.max(3, Math.min(segs, Math.round(emT[e])));
    const cr = emC[e * 3], cg = emC[e * 3 + 1], cb = emC[e * 3 + 2];
    for (let k = 0; k < segs; k++) {
      const base = (e * segs + k) * 2, dNew = segs - 1 - k;
      tage[base] = (dNew + 1) / tlenSeg; tage[base + 1] = dNew / tlenSeg;
      tcol[base * 3] = cr; tcol[base * 3 + 1] = cg; tcol[base * 3 + 2] = cb;
      tcol[base * 3 + 3] = cr; tcol[base * 3 + 4] = cg; tcol[base * 3 + 5] = cb;
    }
  }
  const tg = new THREE.BufferGeometry();
  const tposAttr = new THREE.BufferAttribute(tpos, 3).setUsage(THREE.DynamicDrawUsage);
  tg.setAttribute('position', tposAttr);
  tg.setAttribute('aAge', new THREE.BufferAttribute(tage, 1));
  tg.setAttribute('aColor', new THREE.BufferAttribute(tcol, 3));
  trailVisArr = new Float32Array(tv).fill(1);
  trailVisAttr = new THREE.BufferAttribute(trailVisArr, 1).setUsage(THREE.DynamicDrawUsage);
  tg.setAttribute('aVis', trailVisAttr);
  trailObj = new THREE.LineSegments(tg, trailMaterial); trailObj.frustumCulled = false; root.add(trailObj);
  trailObj.userData.pos = tpos; trailObj.userData.attr = tposAttr; trailObj.userData.segs = segs;
  segsG = segs;

  // beams — ribbon (6 verts/beam, 宽度 aWidth 由数据驱动)
  if (BEAM.a.length) {
    beamIdxA = Uint16Array.from(BEAM.a); beamIdxB = Uint16Array.from(BEAM.b);
    const nb = beamIdxA.length, V = nb * 6;
    beamPos = new Float32Array(V * 3);                          // own-end world pos (per frame)
    const bdir = new Float32Array(V * 3);                       // other-end world pos (per frame)
    const bside = new Float32Array(V), bcol = new Float32Array(V * 3), bwid = new Float32Array(V);
    beamVisArr = new Float32Array(V).fill(1); beamEnds = new Uint8Array(V);
    for (let i = 0; i < nb; i++) {
      const w = BEAM.w[i], ia = beamIdxA[i] * 3, ib = beamIdxB[i] * 3;   // 两端取各自点色 → ribbon 上渐变
      for (let v = 0; v < 6; v++) {
        const idx = i * 6 + v, c = beamEndTmpl[v] === 0 ? ia : ib;
        beamEnds[idx] = beamEndTmpl[v]; bside[idx] = beamSideTmpl[v]; bwid[idx] = w;
        bcol[idx * 3] = D.col[c]; bcol[idx * 3 + 1] = D.col[c + 1]; bcol[idx * 3 + 2] = D.col[c + 2];
      }
    }
    const bg = new THREE.BufferGeometry();
    const bposAttr = new THREE.BufferAttribute(beamPos, 3).setUsage(THREE.DynamicDrawUsage);
    const bdirAttr = new THREE.BufferAttribute(bdir, 3).setUsage(THREE.DynamicDrawUsage);
    bg.setAttribute('position', bposAttr);
    bg.setAttribute('aDir', bdirAttr);
    bg.setAttribute('aSide', new THREE.BufferAttribute(bside, 1));
    bg.setAttribute('aColor', new THREE.BufferAttribute(bcol, 3));
    bg.setAttribute('aWidth', new THREE.BufferAttribute(bwid, 1));
    beamVisAttr = new THREE.BufferAttribute(beamVisArr, 1).setUsage(THREE.DynamicDrawUsage);
    bg.setAttribute('aVis', beamVisAttr);
    beamObj = new THREE.Mesh(bg, beamMaterial); beamObj.frustumCulled = false; root.add(beamObj);
    beamObj.userData.posAttr = bposAttr; beamObj.userData.dirAttr = bdirAttr; beamObj.userData.dir = bdir;
  }
}

function writeWorld(i) {
  const o = i * 3, sy = sys[i], s = scl[i], r = i * 9;
  let cx = 0, cy = 0, cz = 0;                                  // per-attractor centering
  if (sy === 1) cz = 25; else if (sy === 3) cz = 0.6; else if (sy === 4) { cx = -2.4; cy = -2.4; cz = -2.4; } else if (sy === 6) cz = 22; else if (sy === 8) cx = 1; else if (sy === 9) cz = 20;
  const lx = (state[o] - cx) * s, ly = (state[o + 2] - cz) * s, lz = (state[o + 1] - cy) * s;   // attractor local frame (z→up)
  const ox = rotM[r] * lx + rotM[r + 1] * ly + rotM[r + 2] * lz;                  // data-driven orientation
  const oy = rotM[r + 3] * lx + rotM[r + 4] * ly + rotM[r + 5] * lz;
  const oz = rotM[r + 6] * lx + rotM[r + 7] * ly + rotM[r + 8] * lz;
  const ai = sy * 3, kx = SYS_AXIS[ai], ky = SYS_AXIS[ai + 1], kz = SYS_AXIS[ai + 2], cc = sysCos[sy], sn = sysSin[sy];
  const kd = (kx * ox + ky * oy + kz * oz) * (1 - cc);                            // per-system self-rotation (Rodrigues)
  posArr[o] = anc[o] + ox * cc + (ky * oz - kz * oy) * sn + kx * kd;
  posArr[o + 1] = anc[o + 1] + oy * cc + (kz * ox - kx * oz) * sn + ky * kd;
  posArr[o + 2] = anc[o + 2] + oz * cc + (kx * oy - ky * ox) * sn + kz * kd;
}
function capOf(s) { return s === 1 ? 0.011 : s === 3 ? 0.02 : s === 4 ? 0.01 : s === 5 ? 0.012 : s === 6 ? 0.004 : s === 7 ? 0.02 : s === 8 ? 0.02 : s === 9 ? 0.005 : s === 10 ? 0.02 : s === 11 ? 0.02 : s === 12 ? 0.01 : s === 13 ? 0.015 : s === 14 ? 0.02 : s === 2 ? 0.045 : 0.05; }
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
  else if (s === 11) { dx = y + z; dy = -x + 0.5 * y; dz = x * x - z; }                                            // Sprott-Linz F
  else if (s === 12) { dx = -0.4 * x + y + 10 * y * z; dy = -x - 0.4 * y + 5 * x * z; dz = 0.175 * z - 5 * x * y; } // Newton-Leipnik
  else if (s === 13) { dx = -y * y - z * z - 0.2 * x + 1.6; dy = x * y - 4 * x * z - y + 1; dz = 4 * x * y + x * z - z; } // Hadley
  else { dx = y * z; dy = x * x - y; dz = 1 - 4 * x; }                                                             // Sprott-E
  x += dx * h; y += dy * h; z += dz * h;
  if (!isFinite(x) || !isFinite(y) || !isFinite(z) || Math.abs(x) > 1e4 || Math.abs(y) > 1e4 || Math.abs(z) > 1e4) {
    x = s === 4 ? -5 + (Math.random() - 0.5) : s === 6 ? -10 + (Math.random() - 0.5) : (Math.random() - 0.5);
    y = (Math.random() - 0.5); z = (s === 1 || s === 6 || s === 9) ? 20 : (Math.random() - 0.5);
  }
  state[o] = x; state[o + 1] = y; state[o + 2] = z;
}

// ---------- immersive look controller（相机在体系正中心，第一人称环视）----------
const camPos = new THREE.Vector3(CENTER[0], CENTER[1], CENTER[2]);
const cCenter = new THREE.Vector3(CENTER[0], CENTER[1], CENTER[2]);
let yaw = 0, pitch = 0, dragging = false, lastPX = 0, lastPY = 0, gyroOn = false, gyroYaw = 0, gyroPitch = 0;
const fwd = new THREE.Vector3();
function applyLook() {
  fwd.set(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw));
  camera.position.copy(camPos);
  camera.lookAt(camPos.x + fwd.x, camPos.y + fwd.y, camPos.z + fwd.z);
}
renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; lastPX = e.clientX; lastPY = e.clientY; });
addEventListener('pointerup', () => { dragging = false; });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  yaw -= (e.clientX - lastPX) * 0.004; pitch = clamp(pitch - (e.clientY - lastPY) * 0.004, -1.45, 1.45);
  lastPX = e.clientX; lastPY = e.clientY;
});
renderer.domElement.addEventListener('wheel', (e) => {       // 滚轮 = 调焦距（FOV），相机不位移
  e.preventDefault();
  camera.fov = clamp(camera.fov + e.deltaY * 0.03, 22, 105);
  camera.updateProjectionMatrix();
}, { passive: false });
addEventListener('deviceorientation', (e) => { if (e.alpha == null) return; gyroOn = true; gyroYaw = -e.alpha * Math.PI / 180; gyroPitch = clamp(((e.beta || 90) - 90) * Math.PI / 180, -1.3, 1.3); });

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

// HUD 静置淡隐（交互时浮现，让作品留白）
{ const hud = document.getElementById('hud'), tip = document.getElementById('tip'); let hudT;
  const showHud = () => { hud.style.opacity = ''; tip.style.opacity = ''; clearTimeout(hudT); hudT = setTimeout(() => { hud.style.opacity = '0'; tip.style.opacity = '0'; }, 5000); };
  addEventListener('pointermove', showHud); addEventListener('pointerdown', showHud); addEventListener('keydown', showHud); showHud(); }

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); U.uPixelRatio.value = renderer.getPixelRatio(); beamMaterial.uniforms.uRes.value.set(innerWidth, innerHeight); });

// ---------- loop ----------
const clock = new THREE.Clock();
let pulse = 0, tElapsed = 0, spinTime = 0, frameCount = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); tElapsed += dt; U.uTime.value = tElapsed;
  if (analyser) { analyser.getByteFrequencyData(micBuf); let s = 0; for (let i = 0; i < micBuf.length; i++) s += micBuf[i]; pulse = lerp(pulse, clamp(s / micBuf.length / 110, 0, 1), 0.2); }
  else pulse *= 0.95;
  U.uPulse.value = pulse;
  bgMat.uniforms.uTime.value = tElapsed; bgMat.uniforms.uPulse.value = pulse;

  // 每系统各绕自己的轴自转（始终开启）
  spinTime += dt * (0.00024 + pulse * 0.0006);
  for (let s = 0; s < SYSN; s++) { const a = SYS_SPIN[s] * spinTime; sysCos[s] = Math.cos(a); sysSin[s] = Math.sin(a); }

  if (N) {
    const hmul = 0.5 + pulse * 1.3;          // 全局速度（已降速）
    for (let i = 0; i < N; i++) {
      const h = Math.min(bh[i] * spd[i] * hmul, capOf(sys[i]));
      stepOne(i, h * 0.5); stepOne(i, h * 0.5);
      writeWorld(i);
    }
    pointsObj.geometry.attributes.position.needsUpdate = true;

    // 几何体棱线：跟随混沌位置 + 各自缓慢自转 + 呼吸变径（CPU 变换合并 LineSegments）
    if (solidGroups.length) {
      const sbreath = 1.0 + 0.22 * Math.sin(tElapsed * 0.7), ringBreath = 1.0 + 0.18 * Math.sin(tElapsed * 0.5 + 1.0);
      for (let g = 0; g < solidGroups.length; g++) {
        const sg = solidGroups[g], local = sg.local, lv = sg.lv, pos = sg.pos;
        for (let j = 0; j < sg.cnt; j++) {
          const gi = sg.gidx[j], o = gi * 3, vis = groupVis[grp[gi]] ? 1 : 0;
          _q.setFromAxisAngle(_v.set(sg.axis[j * 3], sg.axis[j * 3 + 1], sg.axis[j * 3 + 2]), sg.speed[j] * tElapsed);
          const sc = (0.08 + D.sz[gi] * 0.075) * (sg.ellipsoid ? ringBreath : sbreath) * vis;
          _dummy.position.set(posArr[o], posArr[o + 1], posArr[o + 2]);
          _dummy.quaternion.copy(_q);
          _dummy.scale.set(sc, sg.ellipsoid ? sc * 0.74 : sc, sc);
          _dummy.updateMatrix();
          const e = _dummy.matrix.elements, base = j * lv * 3;
          for (let v = 0; v < lv; v++) {
            const li = v * 3, lx = local[li], ly = local[li + 1], lz = local[li + 2], k = base + li;
            pos[k] = e[0] * lx + e[4] * ly + e[8] * lz + e[12];
            pos[k + 1] = e[1] * lx + e[5] * ly + e[9] * lz + e[13];
            pos[k + 2] = e[2] * lx + e[6] * ly + e[10] * lz + e[14];
          }
          entMat.set(e, gi * 16);                                // 存实体矩阵，供每个顶点的轨迹用
        }
        sg.posAttr.needsUpdate = true;
      }
    }

    // 每 STRIDE 帧采样一次轨迹（让缓慢运动也能拉出可见路径）
    frameCount++;
    if (frameCount % STRIDE === 0) {
      for (let e = 0; e < E; e++) {                              // 每个顶点发射点的世界位置
        const gi = emEnt[e], eo = e * 3;
        if (grp[gi] === 0) { trailSrc[eo] = posArr[gi * 3]; trailSrc[eo + 1] = posArr[gi * 3 + 1]; trailSrc[eo + 2] = posArr[gi * 3 + 2]; }
        else { const m = gi * 16, lx = emLocal[eo], ly = emLocal[eo + 1], lz = emLocal[eo + 2];
          trailSrc[eo] = entMat[m] * lx + entMat[m + 4] * ly + entMat[m + 8] * lz + entMat[m + 12];
          trailSrc[eo + 1] = entMat[m + 1] * lx + entMat[m + 5] * ly + entMat[m + 9] * lz + entMat[m + 13];
          trailSrc[eo + 2] = entMat[m + 2] * lx + entMat[m + 6] * ly + entMat[m + 10] * lz + entMat[m + 14]; }
      }
      head = (head + 1) % TRAIL;
      for (let e = 0; e < E; e++) { const to = (e * TRAIL + head) * 3, s3 = e * 3; trail[to] = trailSrc[s3]; trail[to + 1] = trailSrc[s3 + 1]; trail[to + 2] = trailSrc[s3 + 2]; }
      const tpos = trailObj.userData.pos, segs = trailObj.userData.segs;
      for (let e = 0; e < E; e++) {
        for (let k = 0; k < segs; k++) {
          const a = (head + 1 + k) % TRAIL, b = (head + 2 + k) % TRAIL;
          const ao = (e * TRAIL + a) * 3, bo = (e * TRAIL + b) * 3, w = ((e * segs + k) * 2) * 3;
          tpos[w] = trail[ao]; tpos[w + 1] = trail[ao + 1]; tpos[w + 2] = trail[ao + 2];
          tpos[w + 3] = trail[bo]; tpos[w + 4] = trail[bo + 1]; tpos[w + 5] = trail[bo + 2];
        }
      }
      trailObj.userData.attr.needsUpdate = true;
    }

    if (beamObj) {
      const bp = beamObj.userData.posAttr.array, bd = beamObj.userData.dir;
      for (let i = 0; i < beamIdxA.length; i++) {
        const aP = beamIdxA[i] * 3, bP = beamIdxB[i] * 3;
        for (let v = 0; v < 6; v++) {
          const e = i * 6 + v, o = e * 3, useA = beamEnds[e] === 0, own = useA ? aP : bP, oth = useA ? bP : aP;
          bp[o] = posArr[own]; bp[o + 1] = posArr[own + 1]; bp[o + 2] = posArr[own + 2];
          bd[o] = posArr[oth]; bd[o + 1] = posArr[oth + 1]; bd[o + 2] = posArr[oth + 2];
        }
      }
      beamObj.userData.posAttr.needsUpdate = true; beamObj.userData.dirAttr.needsUpdate = true;
    }
  }

  if (gyroOn) { yaw = lerp(yaw, gyroYaw, 0.12); pitch = lerp(pitch, gyroPitch, 0.12); }
  else if (!dragging) yaw += 0.0016;     // 缓慢自动巡游
  applyLook();
  renderer.render(scene, camera);
}

// ---------- 几何体变体：每类一种缓慢自转的线框立体（围绕发光核） ----------
function buildSolids() {
  const edgesOf = (geo) => new THREE.EdgesGeometry(geo, 1).attributes.position.array.slice();   // 只取真实特征棱
  const ringEllipse = () => { const seg = 28, T = 6.2831853, a = [];
    for (let i = 0; i < seg; i++) { const t0 = i / seg * T, t1 = (i + 1) / seg * T; a.push(Math.cos(t0), Math.sin(t0), 0, Math.cos(t1), Math.sin(t1), 0); }       // 环 A · XY 面
    for (let i = 0; i < seg; i++) { const t0 = i / seg * T, t1 = (i + 1) / seg * T; a.push(Math.cos(t0), 0, Math.sin(t0), Math.cos(t1), 0, Math.sin(t1)); }       // 环 B · XZ 面（正交→陀螺）
    return new Float32Array(a); };
  const locals = [
    edgesOf(new THREE.OctahedronGeometry(0.62)),          // 0 城市 八面体（12 棱）
    edgesOf(new THREE.BoxGeometry(0.78, 0.78, 0.78)),     // 1 产品 方块（12 棱）
    edgesOf(new THREE.CylinderGeometry(0.5, 0.5, 0.95, 5)), // 2 内核 五棱柱（15 棱）
    edgesOf(new THREE.TetrahedronGeometry(0.8)),          // 3 突破 四面锥（6 棱）
    edgesOf(new THREE.ConeGeometry(0.58, 1.05, 4)),       // 4 政策 金字塔（8 棱）
    ringEllipse()                                          // 5 厂商 椭圆环（呼吸变径外轮廓）
  ];
  const buckets = [[], [], [], [], [], []];
  for (let i = 0; i < N; i++) buckets[grp[i]].push(i);
  for (let t = 0; t < 6; t++) {
    const list = buckets[t], cnt = list.length; if (!cnt || t === 0) continue;   // 城市为光点型，不建立体
    const local = locals[t], lv = local.length / 3;
    const pos = new Float32Array(cnt * lv * 3), colA = new Float32Array(cnt * lv * 3);
    const gidx = new Int32Array(cnt), axis = new Float32Array(cnt * 3), speed = new Float32Array(cnt);
    for (let j = 0; j < cnt; j++) {
      const gi = list[j]; gidx[j] = gi;
      let ax = Math.random() - 0.5, ay = Math.random() - 0.5, az = Math.random() - 0.5;
      const L = Math.hypot(ax, ay, az) || 1; axis[j * 3] = ax / L; axis[j * 3 + 1] = ay / L; axis[j * 3 + 2] = az / L;
      speed[j] = (t === 5 ? 0.5 + Math.random() * 0.9 : 0.05 + Math.random() * 0.15);   // 厂商环更快、更灵动
      const cr = D.col[gi * 3], cg = D.col[gi * 3 + 1], cb = D.col[gi * 3 + 2];
      for (let v = 0; v < lv; v++) { const k = (j * lv + v) * 3; colA[k] = cr; colA[k + 1] = cg; colA[k + 2] = cb; }
    }
    const g = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', posAttr);
    g.setAttribute('aColor', new THREE.BufferAttribute(colA, 3));
    const mesh = new THREE.LineSegments(g, solidLineMat); mesh.frustumCulled = false; root.add(mesh);
    solidGroups.push({ posAttr, pos, local, lv, cnt, gidx, axis, speed, ellipsoid: t === 5 });
  }
}

// ---------- show / hide groups ----------
function updateVisibility() {
  if (!N) return;
  for (let i = 0; i < N; i++) pointVisArr[i] = groupVis[grp[i]] ? 1 : 0;
  pointVisAttr.needsUpdate = true;
  if (trailVisArr) {
    for (let e = 0; e < E; e++) { const v = groupVis[grp[emEnt[e]]] ? 1 : 0, b0 = e * segsG * 2, b1 = (e + 1) * segsG * 2; for (let t = b0; t < b1; t++) trailVisArr[t] = v; }
    trailVisAttr.needsUpdate = true;
  }
  if (beamVisArr) {
    for (let i = 0; i < beamIdxA.length; i++) { const v = (groupVis[grp[beamIdxA[i]]] && groupVis[grp[beamIdxB[i]]]) ? 1 : 0; for (let q = 0; q < 6; q++) beamVisArr[i * 6 + q] = v; }
    beamVisAttr.needsUpdate = true;
  }
}

function buildPanel() {
  const panel = document.createElement('div'); panel.id = 'panel';
  const groups = [['城市 气候', 0], ['产品', 1], ['内核', 2], ['突破', 3], ['政策', 4], ['厂商', 5]];
  const mkRow = (label, checked, onToggle) => {
    const row = document.createElement('label'); row.className = 'prow';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = checked;
    cb.addEventListener('change', () => onToggle(cb.checked));
    const sp = document.createElement('span'); sp.textContent = label;
    row.appendChild(cb); row.appendChild(sp); return row;
  };
  const h = document.createElement('div'); h.className = 'phead'; h.textContent = '数据体系'; panel.appendChild(h);
  groups.forEach(([label, gi]) => panel.appendChild(mkRow(label, true, (on) => { groupVis[gi] = on; updateVisibility(); })));
  const h2 = document.createElement('div'); h2.className = 'phead'; h2.textContent = '元素'; panel.appendChild(h2);
  panel.appendChild(mkRow('连线', true, (on) => { if (beamObj) beamObj.visible = on; }));
  panel.appendChild(mkRow('拖尾', true, (on) => { if (trailObj) trailObj.visible = on; }));
  document.body.appendChild(panel);
  panel.style.display = 'none';                                  // 默认隐藏；按 D 可临时唤出调参
  addEventListener('keydown', (e) => { if (e.key === 'd' || e.key === 'D') panel.style.display = panel.style.display === 'none' ? 'flex' : 'none'; });
}

// ---------- boot ----------
(async function main() {
  let info = {};
  try { info = await buildIndustrial(); } catch (err) { console.warn('[数渊] industrial load failed (need http server):', err); }
  const cities = buildHousing();
  bgMat.uniforms.uWarm.value = climWarm;
  finalize();
  buildSolids();
  buildPanel();
  console.log(`[数渊] ${cities} 城市 · ${info.products || 0} 产品 · ${info.kernels || 0} 内核 · ${info.milestones || 0} 突破 · ${info.policies || 0} 政策 · ${info.vendors || 0} 厂商 · ${N} 混沌星体 · ${beamIdxA ? beamIdxA.length : 0} 连线`);
  const ld = document.getElementById('loading'); ld.classList.add('gone'); setTimeout(() => ld.remove(), 1000);
  animate();
})();
