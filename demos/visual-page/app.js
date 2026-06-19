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
import {
  applyUi, registerPanelNode, renderCardHtml, sensorBtnLabel, toggleLang, isZh,
} from './i18n.js';

const IS_MOBILE = matchMedia('(pointer: coarse)').matches || innerWidth < 820;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const IND = '../china-industrial-software/assets/data/';
const PHARM = '../pharm-companies/assets/data/';   // 第三个数据源：全球医药公司图谱
const TRAIL = IS_MOBILE ? 22 : 44;   // 轨迹历史采样数（每点实际尾长由数据决定）
const STRIDE = 10;                    // 每 STRIDE 帧采样一次 → 加大步幅=路径覆盖更长时间（双倍）、且更省
const CENTER = [0, 42, 0];           // 所有吸引子共用中心 → 重叠共舞（呼吸吸气态）
const FEAT_DIM = 27;                 // SOM 特征维度：字段 0..19 + 类型 one-hot 20..26（7 类：含医药）
const SOM_L = [9, 7, 5];             // Kohonen 晶格维度 → 315 神经元
const SOM_R = [55, 120];             // 神经晶格→世界：环绕视角的球壳 内/外半径（非平面盒）
const SOM_EPOCHS = IS_MOBILE ? 14 : 26;
const SHRINK = 0.5;                  // 完全呼气（铺开）时混沌缩成锚点周围小笔触的比例
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
  uniforms: { uTime: { value: 0 }, uWarm: { value: 0.5 }, uPulse: { value: 0 }, uW: { value: new Float32Array(138) } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    precision highp float;
    varying vec3 vDir; uniform float uTime; uniform float uWarm; uniform float uPulse;
    uniform float uW[138];                                          // CPPN 权重（数据播种）：5→8→8→2 MLP
    float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
      return mix(mix(mix(hash(i+vec3(0.,0.,0.)),hash(i+vec3(1.,0.,0.)),f.x), mix(hash(i+vec3(0.,1.,0.)),hash(i+vec3(1.,1.,0.)),f.x),f.y),
                 mix(mix(hash(i+vec3(0.,0.,1.)),hash(i+vec3(1.,0.,1.)),f.x), mix(hash(i+vec3(0.,1.,1.)),hash(i+vec3(1.,1.,1.)),f.x),f.y), f.z); }
    float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*noise(p); p=p*2.03+vec3(1.7); a*=0.5; } return s; }
    vec3 pal(float x){                                              // off-color 循环调色板（紫·蓝·青·绿·橄榄·橙·红·品）
      vec3 a = vec3(0.095, 0.095, 0.115), b = vec3(0.085, 0.075, 0.085), d = vec3(0.00, 0.33, 0.62);
      return a + b * cos(6.28318 * (x + d));
    }
    // CPPN：一个数据播种的微型神经网络逐像素生成"梦的场" → 只驱动调色板参数/warp，锁住既有美学
    void cppn(vec3 dir, float tt, out float hueN, out float warpN){
      float inp[5];
      inp[0]=dir.x; inp[1]=dir.y; inp[2]=dir.z; inp[3]=sin(tt*0.05); inp[4]=cos(tt*0.05);
      float h1[8];
      for(int i=0;i<8;i++){ float s=uW[40+i]; for(int j=0;j<5;j++){ s+=uW[i*5+j]*inp[j]; } h1[i]=tanh(s); }       // tanh 层
      float h2[8];
      for(int i=0;i<8;i++){ float s=uW[112+i]; for(int j=0;j<8;j++){ s+=uW[48+i*8+j]*h1[j]; } h2[i]=sin(s); }     // sin 层 → 周期纹
      float o0=uW[136], o1=uW[137];
      for(int j=0;j<8;j++){ o0+=uW[120+j]*h2[j]; o1+=uW[128+j]*h2[j]; }
      hueN=tanh(o0); warpN=tanh(o1);
    }
    void main(){
      vec3 p = vDir*2.4; float t = uTime*0.03;
      float hueN, warpN; cppn(vDir, uTime, hueN, warpN);            // 神经场
      float w = fbm(p*0.6 + vec3(t*0.2, t*0.1, 0.0));
      float f = fbm(p*1.1 + (w-0.5)*1.3 + warpN*0.6 + vec3(0.0, t*0.6, t*0.2));   // warp 受神经场扰动
      float breathe = 0.5 + 0.5*sin(uTime*0.22) + uPulse*0.4;        // 缓慢呼吸（真机麦克风接管）
      float vert = (-vDir.y)*0.5 + 0.5;                              // 1=底部 0=顶部
      float hue = f*0.6 + (w-0.5)*0.35 + hueN*0.35 + vert*0.18 + uTime*0.006 + (uWarm-0.5)*0.25 + 0.06;  // 神经场 + 流体共定色相
      vec3 col = pal(hue);
      col *= 0.7 + 0.42*breathe;                                     // 整体随呼吸明暗起伏
      float redness = smoothstep(0.015, 0.16, col.r - max(col.g, col.b));   // 仅"红主导"像素（不含品红/橙）
      col *= mix(1.0, 0.40, redness);                                // 红 → 黑红（压暗，保留色相）；其余色不变
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
      float sz = 0.16 + aSize * 3.0;                                     // aSize 已是归一化幂曲线 → 群星(微)到日月(巨)
      float breath = 1.0 + 0.4 * sin(uTime*0.7 + aOrbPhase*6.2831);      // 呼吸般缩放（每点错相位）
      gl_PointSize = min(sz * breath * (1.0 + uPulse*0.35) * uPixelRatio * (380.0 / -mv.z), 150.0);
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

// SOM 神经晶格材质：neighbor 连线，亮度=神经元 density，整体随呼吸量 uOrg 浮现（呼气时心智显形）
const latticeMat = new THREE.ShaderMaterial({
  uniforms: { uOrg: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `attribute vec3 aColor; attribute float aGlow; varying vec3 vC; varying float vG; varying float vDist;
    void main(){ vC = aColor; vG = aGlow; vec4 mv = modelViewMatrix*vec4(position,1.0); vDist = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vC; varying float vG; varying float vDist; uniform float uOrg;
    void main(){ float f = clamp((220.0 - vDist)/170.0, 0.12, 1.0); float a = vG*uOrg*0.55*f; if (a < 0.004) discard; gl_FragColor = vec4(vC*(0.45+0.7*vG), a); }`
});

// ---------- builders (collect into plain arrays, finalize after counts known) ----------
const D = { sys: [], anc: [], scl: [], bh: [], prm: [], spd: [], seed: [], rot: [], tlen: [], col: [], sz: [], tw: [], hz: [], op: [], meta: [], feat: [], shape: [] };
function hash01(str) { let h = 2166136261; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100003) / 100003; }
// SOM 特征向量：typeId one-hot（×1.5 让分层占优）+ 调用方填充 0..19 的字段槽
function makeFeat(typeId) { const v = new Float32Array(FEAT_DIM); v[20 + typeId] = 1.5; return v; }
const setOrigin = (v, o) => { v[10] = o === 'domestic' ? 1 : 0; v[11] = o === 'open_source' ? 1 : 0; v[12] = (o !== 'domestic' && o !== 'open_source') ? 1 : 0; };
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
    const ci = addStar(csys, canc, cscl, cbh, b, spd, cseed, hue, sat, light, size, tw, hz, {
      kind: 'CITY',
      nameZh: ls.loc || ls.city,
      nameEn: ls.loc || ls.city,
      raw: { city: ls.city, prov: ls.prov, unit, comfort, elev, hazard: e.hazard?.top?.[0] || '' },
    }, null, ctail);
    const fv = makeFeat(0);   // 城市气候/房价 → 特征槽 0..9
    fv[0] = cf; fv[1] = clamp(tRange / 45, 0, 1); fv[2] = clamp(sun / 3500, 0, 1); fv[3] = clamp(pm / 85, 0, 1);
    fv[4] = clamp(elev / 4000, 0, 1); fv[5] = clamp(burden / 40, 0, 1); fv[6] = clamp((Math.log10(unit + 1) - 2.2) / 3, 0, 1);
    fv[7] = clamp(yld / 0.05, 0, 1); fv[8] = clamp((outflow + 30) / 60, 0, 1); fv[9] = clamp((annualMean + 10) / 40, 0, 1);
    D.feat[ci] = fv; D.shape[ci] = 0;   // 城市=发光点（密集星场背景）
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
    const ki = addStar(1, CENTER, 0.85, 0.0016, 28, 0.45, lz(), hueOf(k.origin), 0.7, 0.55, 3.0 + used * 0.04, 0.4, 0.25, {
      kind: 'KERNEL',
      nameZh: k.name_zh,
      nameEn: k.name_en,
      raw: { origin: k.origin, owner: k.owner || '', used },
    }, null, 6 + clamp(used / 30, 0, 1) * (TRAIL - 6));
    kIdx[k.id] = ki;
    const fv = makeFeat(2); setOrigin(fv, k.origin); fv[17] = clamp(used / 30, 0, 1); D.feat[ki] = fv;
    D.shape[ki] = used >= 20 ? 20 : used >= 12 ? 19 : used >= 6 ? 9 : used >= 3 ? 5 : 15;   // 内核=维度核心(仅43个)：被用越多维度越高 → 6-立方体(6D)/penteract(5D)/星状八面体/正十二面体/16-胞体(4D)
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
      kind: 'PRODUCT',
      nameZh: p.name_zh,
      nameEn: p.name_en,
      raw: {
        category: p.category_l2 || p.category_l1 || '',
        origin: p.origin,
        maturity: p.maturity || '—',
        localization: p.localization_depth || '—',
      },
    }, null, 5 + mat * (TRAIL - 6));
    pIdx[p.id] = i;
    const fv = makeFeat(1); setOrigin(fv, p.origin); fv[13] = mat;
    fv[14] = p.localization_depth === 'full' ? 1 : p.localization_depth === 'partial' ? 0.5 : 0.3;
    fv[15] = clamp(p.confidence ?? 0.8, 0, 1); fv[17] = clamp((kUsed[p.kernel_id] || 0) / 30, 0, 1);
    D.feat[i] = fv;
    D.shape[i] = p.maturity === 'high' ? 11 : p.maturity === 'medium' ? 1 : 16;   // 成熟度：高→超立方体(4D) / 中→方块 / 低→24-胞体(4D，替换正八面体)
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
      kind: 'BREAKTHROUGH',
      nameZh: m.headline_zh,
      nameEn: m.headline_en,
      raw: { y4, capability: m.capability_key || '', inc },
    }, [hash01('cap:' + (m.capability_key || 'x')) * 6.283, hash01('mp:' + (m.id || y4)) * 3.14 - 1.57, hash01('mr:' + (m.id || y4)) * 6.283], 7 + clamp(inc / 6, 0, 1) * (TRAIL - 7));
    const fv = makeFeat(3); fv[16] = yf; fv[18] = ev === 'audited' ? 1 : ev === 'case_study' ? 0.5 : 0; fv[19] = clamp(inc / 6, 0, 1); D.feat[i] = fv;
    D.shape[i] = ev === 'audited' ? 10 : ev === 'case_study' ? 12 : 18;   // 证据：审计→立方八面体 / 案例→五胞体 / 其余→八面体棱柱(4D胞柱，替换三棱柱)
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
    const pi = addStar(Psys, Panc, Pscl, Pbh, Pprm, 0.4 + tNorm * 0.5, Pseed, hue, 0.5, 0.6, 1.6 + tNorm * 3, 0.5, 0.3, {
      kind: 'POLICY',
      nameZh: p.title_zh,
      nameEn: p.title_en,
      raw: {
        y4,
        policyType: p.policy_type || '',
        targetValue: p.target_value,
        targetUnitZh: p.target_unit_zh,
        targetUnitEn: p.target_unit_en,
      },
    }, [hash01('pt:' + (p.policy_type || 'x')) * 6.283, yf * 3.14 - 1.0 + hash01('pp:' + (p.id || y4)) * 0.6, hash01('pr:' + (p.id || y4)) * 6.283], 5 + tNorm * (TRAIL - 6));
    const fv = makeFeat(4); fv[16] = yf; fv[18] = tNorm; D.feat[pi] = fv;
    D.shape[pi] = prog ? 7 : p.policy_type === 'fund' ? 11 : 17;   // 纲领→金字塔 / 资金→超立方体(4D) / 部委等→3-3多胞柱(4D，替换五棱柱)
  });

  // 厂商按出身分三种图案：国产→Dadras / 国外→Newton-Leipnik / 开源→Hadley
  vendors.forEach((v) => {
    let vsys, vseed, vscl;
    if (v.origin === 'domestic') { vsys = 5; vseed = dd(); vscl = 1.4; }
    else if (v.origin === 'open_source') { vsys = 13; vseed = hd(); vscl = 9; }
    else { vsys = 12; vseed = nl(); vscl = 14; }
    const vi = addStar(vsys, CENTER, vscl, 0.012, 0, 0.4, vseed,
      hueOf(v.origin), 0.4, 0.42, 2.4, 0.4, 0.5, {
      kind: 'VENDOR',
      nameZh: v.name_zh,
      nameEn: v.name_en,
      raw: { origin: v.origin, hqCity: v.hq_city || '', hqCountry: v.hq_country || '' },
    }, null, 4);
    const fv = makeFeat(5); setOrigin(fv, v.origin); D.feat[vi] = fv;
    D.shape[vi] = v.origin === 'domestic' ? 14 : v.origin === 'open_source' ? 12 : 13;   // 国产→陀螺椭圆环 / 开源→五胞体(4-单纯形) / 国外→环面纽结
  });

  pairs.forEach((bp) => { if (pIdx[bp.domestic_id] != null && pIdx[bp.international_id] != null) { BEAM.a.push(pIdx[bp.domestic_id]); BEAM.b.push(pIdx[bp.international_id]); BEAM.col.push(0.2, 0.8, 0.72); BEAM.w.push(1.0); } });

  return { products: products.length, vendors: vendors.length, kernels: kernels.length, milestones: milestones.length, policies: policies.length, pairs: pairs.length };
}

// ---------- 第三数据源：全球医药公司图谱（pharm-companies） → 新的「医药」层（group 6） ----------
async function buildPharma() {
  const j = (p) => fetch(PHARM + p).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const manifest = await j('manifest.json');
  const shardFiles = (manifest && manifest.shards || []).map((s) => s.file);
  const [coData, siData, moData, brData, prData, ...shards] = await Promise.all([
    j('companies.json'), j('sites.json'), j('modalities.json'), j('breakthroughs.json'), j('comparisons/benchmark-pairs.json'),
    ...shardFiles.map((f) => j(f))
  ]);
  const companies = (coData && (coData.companies || coData)) || [];
  const sites = (siData && (siData.sites || siData)) || [];
  const modalities = (moData && (moData.modalities || moData)) || [];
  const milestones = (brData && (brData.milestones || brData)) || [];
  const pairs = (prData && (prData.pairs || prData)) || [];
  const products = shards.flatMap((d) => (d && (d.products || d)) || []);
  if (!companies.length) return { companies: 0 };

  const coMap = {}; companies.forEach((c) => { coMap[c.id] = c; });
  const RHUE = { greater_china: 345, north_america: 280, europe: 255, japan: 320, other_apac: 175, oceania: 160, mea: 30 };
  const rhue = (r) => (RHUE[r] != null ? RHUE[r] : 300);
  const pIdx = {};                                                  // id → 星索引（companies + products），供连线
  const rnd = () => Math.random() - 0.5;
  // 各亚型的吸引子播种
  const lz = () => [0.1 + rnd(), rnd(), 20 + rnd() * 2];            // Lorenz
  const lu = () => [0.1 + rnd(), rnd(), 18 + rnd() * 2];           // Lü
  const az = () => [rnd() * 0.3, rnd() * 0.3, rnd() * 0.3];        // Aizawa
  const ch = () => [-10 + rnd(), rnd(), 37 + rnd()];              // Chen

  // 站点（305，全球地理）→ 发光点；按公司所属地区着色；经纬度播种 Thomas → 全球版图被混沌卷入
  sites.forEach((st) => {
    if (st.lat == null || st.lng == null) return;
    const co = coMap[st.company_id], region = co ? co.region : 'other';
    const hi = rhue(region), conf = st.confidence ?? 0.7;
    const srev = (co && co.revenue && co.revenue.value) || 0;
    const ssz = (st.site_type === 'HQ' ? 2.0 : 1.2) + clamp((Math.log10(srev + 1) - 8) / 3, 0, 1) * 2.8;   // 站点大小随母公司营收 + HQ 加成 → 巨头总部=日月
    const i = addStar(0, CENTER, 8, 0.0022, 0.16, 0.5, [(st.lng - 100) * 0.05, -(st.lat - 30) * 0.05, (st.lat) * 0.0006],
      hi, 0.5, 0.5 + conf * 0.18, ssz, 0.5, clamp(1 - conf, 0, 1),
      { kind: 'PHARMA', nameZh: st.name_zh || st.name_en, nameEn: st.name_en || st.name_zh,
        kwZh: `${st.site_type || ''} · ${st.city || ''} · ${st.country || ''}`.trim(), kwEn: `${st.site_type || ''} · ${st.city || ''} · ${st.country || ''}`.trim() },
      null, 5);
    const fv = makeFeat(6); fv[0] = clamp((st.lat + 60) / 120, 0, 1); fv[1] = clamp((st.lng + 180) / 360, 0, 1); fv[4] = conf; D.feat[i] = fv; D.shape[i] = 0;
  });

  // 公司（128）→ 按 company_type 取一种简单立体（复活退役形）；地区着色；营收→大小
  const CO_SHAPE = { originator_bigpharma: 4, biotech: 2, cdmo_cro: 1, generics: 3, tcm: 6, vaccine: 7, biosimilar: 8, diversified: 10 };
  companies.forEach((c) => {
    const rev = (c.revenue && c.revenue.value) || 0, emp = (c.employees && c.employees.value) || 0;
    const sz = 1.8 + clamp((Math.log10(rev + 1) - 8) / 3, 0, 1) * 2.2;
    const i = addStar(3, CENTER, 15, 0.0032, 18, 0.4 + Math.random() * 0.3, az(),
      rhue(c.region), 0.6, 0.5 + (c.is_public ? 0.12 : 0), sz, 0.42, clamp(1 - (c.confidence ?? 0.8), 0, 1),
      { kind: 'PHARMA', nameZh: c.name_zh || c.name_en, nameEn: c.name_en || c.name_zh,
        kwZh: `${c.hq_city || ''} · ${c.country_display_zh || c.country || ''} · ${rev ? Math.round(rev / 1e8) + ' 亿' : ''}`.replace(/ · $/, ''),
        kwEn: `${c.hq_city || ''} · ${c.country || ''} · ${rev ? '$' + (rev / 1e9).toFixed(1) + 'B' : ''}`.replace(/ · $/, '') },
      null, 5 + clamp((Math.log10(rev + 1) - 8) / 3, 0, 1) * (TRAIL - 6));
    pIdx[c.id] = i;
    const fv = makeFeat(6); fv[0] = clamp((Math.log10(rev + 1) - 8) / 3, 0, 1); fv[1] = clamp((Math.log10(emp + 1) - 2) / 4, 0, 1);
    fv[2] = clamp(((c.founded || 1980) - 1900) / 130, 0, 1); fv[3] = c.is_public ? 1 : 0; fv[4] = clamp(c.confidence ?? 0.8, 0, 1); D.feat[i] = fv; D.shape[i] = CO_SHAPE[c.company_type] || 2;
  });

  // 产品（219）→ 八面体；按所属公司地区着色；重磅炸弹更大
  products.forEach((p) => {
    const co = coMap[p.company_id], region = (co && co.region) || p.region || 'other';
    const i = addStar(9, CENTER, 0.85, 0.0013, 24, 0.55, lu(),
      rhue(region), 0.62, 0.46, p.is_blockbuster ? 3.0 : 1.9, 0.4, 0.25,
      { kind: 'PHARMA', nameZh: p.name_zh || p.brand_name || p.name_en, nameEn: p.name_en || p.brand_name || p.name_zh,
        kwZh: `${p.modality_id || ''} · ${p.therapeutic_area_id || ''} · ${p.first_approval_year || ''}`.trim(),
        kwEn: `${p.modality_id || ''} · ${p.therapeutic_area_id || ''} · ${p.first_approval_year || ''}`.trim() },
      null, 5 + (p.is_blockbuster ? TRAIL - 6 : 0));
    pIdx[p.id] = i;
    const fv = makeFeat(6); fv[6] = clamp(((p.first_approval_year || 2000) - 1980) / 50, 0, 1); fv[7] = p.is_blockbuster ? 1 : 0; D.feat[i] = fv; D.shape[i] = 2;
  });

  // 药物模态（21）→ 星状八面体（核心平台，内圈）
  modalities.forEach((m) => {
    const i = addStar(1, CENTER, 0.85, 0.0016, 28, 0.45, lz(), 300, 0.55, 0.6, 3.2, 0.45, 0.2,
      { kind: 'PHARMA', nameZh: m.name_zh || m.name_en, nameEn: m.name_en || m.name_zh,
        kwZh: `${m.class || ''}`, kwEn: `${m.class || ''}` }, null, 7);
    const fv = makeFeat(6); fv[5] = 0.8; D.feat[i] = fv; D.shape[i] = 9;
  });

  // 突破（65）→ 四面锥；按所属公司地区着色；年份→彗尾
  milestones.forEach((m) => {
    const co = coMap[m.company_id], region = (co && co.region) || 'other';
    const y4 = clamp(parseInt((m.date || '2015').slice(0, 4)) || 2015, 2000, 2026);
    const i = addStar(6, CENTER, 0.9, 0.0009, 28, 0.4, ch(),
      rhue(region), 0.78, 0.6, 2.6, 0.85, 0.15,
      { kind: 'PHARMA', nameZh: m.headline_zh || m.headline_en, nameEn: m.headline_en || m.headline_zh,
        kwZh: `${y4} · ${m.therapeutic_area_id || ''}`, kwEn: `${y4} · ${m.therapeutic_area_id || ''}` },
      [hash01('pta:' + (m.therapeutic_area_id || 'x')) * 6.283, hash01('pm:' + (m.id || y4)) * 3.14 - 1.57, hash01('pr:' + (m.id || y4)) * 6.283],
      6 + clamp((y4 - 2010) / 16, 0, 1) * (TRAIL - 7));
    const fv = makeFeat(6); fv[6] = clamp((y4 - 1980) / 50, 0, 1); D.feat[i] = fv; D.shape[i] = 3;
  });

  // 对标连线（国产↔国外）：青紫光束
  pairs.forEach((bp) => { if (pIdx[bp.domestic_id] != null && pIdx[bp.international_id] != null) { BEAM.a.push(pIdx[bp.domestic_id]); BEAM.b.push(pIdx[bp.international_id]); BEAM.col.push(0.62, 0.3, 0.7); BEAM.w.push(1.0); } });

  return { companies: companies.length, sites: sites.length, products: products.length, modalities: modalities.length, milestones: milestones.length, pairs: pairs.length };
}

// ---------- typed state (filled after build) ----------
let N = 0;
let sys, anc, scl, bh, prm, spd, state, posArr, trail, trailSrc, rotM, head = 0;
let pointsObj, trailObj, beamObj, beamIdxA, beamIdxB, beamPos;
let grp, segsG, pointVisArr, pointVisAttr, trailVisArr, trailVisAttr, beamVisArr, beamVisAttr, beamEnds;
let E = 0, emEnt, emLocal, entMat;   // 轨迹发射点：每个立体的每个顶点各一条
let featM = null, latticeObj = null, shapeArr = null, szCurve = null;   // SOM 特征矩阵 · 神经晶格 · 每星几何体形 id · 尺寸曲线[0,1]
const SZ_GAMMA = 2.2;   // 尺寸幂曲线：>1 → 多数微小、少数巨大（群星 + 日月大行星）
let prevPos = null;   // 上一帧世界位置 → 算速度方向（棱柱以运动方向为自转轴）
let gOrg = 0, breathT = 0;             // 呼吸量(0=重叠混沌 / 1=铺开成神经地图) · 呼吸相位累加器
// ---------- 几何体形库：常规多面体 + 特殊数学三维体（每个含棱线 edges + 轨迹发射点 corners）----------
const SHAPES = (() => {
  const edgesOf = (geo) => Array.from(new THREE.EdgesGeometry(geo, 1).attributes.position.array);   // 只取真实特征棱
  const cubeVerts = (a) => [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map((p) => p.map((c) => c * a));
  const CUBE_E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const segFrom = (verts, idx) => { const a = []; for (const [u, v] of idx) a.push(verts[u][0], verts[u][1], verts[u][2], verts[v][0], verts[v][1], verts[v][2]); return a; };
  const allPairs = (n) => { const a = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) a.push([i, j]); return a; };
  const autoEdges = (verts) => {                                   // 连接最短等长棱（正多面体类）
    let mn = Infinity;
    for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) { const d = Math.hypot(verts[i][0] - verts[j][0], verts[i][1] - verts[j][1], verts[i][2] - verts[j][2]); if (d < mn) mn = d; }
    const idx = [];
    for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) { if (Math.abs(Math.hypot(verts[i][0] - verts[j][0], verts[i][1] - verts[j][1], verts[i][2] - verts[j][2]) - mn) < mn * 0.06) idx.push([i, j]); }
    return segFrom(verts, idx);
  };
  const ring = () => { const seg = 28, T = 6.2831853, a = [];
    for (let i = 0; i < seg; i++) { const t0 = i / seg * T, t1 = (i + 1) / seg * T; a.push(Math.cos(t0), Math.sin(t0), 0, Math.cos(t1), Math.sin(t1), 0); }       // 环 A · XY 面
    for (let i = 0; i < seg; i++) { const t0 = i / seg * T, t1 = (i + 1) / seg * T; a.push(Math.cos(t0), 0, Math.sin(t0), Math.cos(t1), 0, Math.sin(t1)); }       // 环 B · XZ 面（正交→陀螺）
    return a; };
  const knot = (p, q, seg, sc) => { const a = [], pt = (t) => { const r = Math.cos(q * t) + 2; return [sc * r * Math.cos(p * t), sc * r * Math.sin(p * t), -sc * Math.sin(q * t)]; };
    let pr = pt(0); for (let k = 1; k <= seg; k++) { const c = pt(k / seg * 6.2831853); a.push(pr[0], pr[1], pr[2], c[0], c[1], c[2]); pr = c; } return a; };
  const stella = () => { const e = edgesOf(new THREE.TetrahedronGeometry(0.78)); return e.concat(e.map((v) => -v)); };                                            // 两个对偶四面体
  const cubocta = () => { const s = 0.6 / Math.SQRT2, v = [[1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0], [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1], [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1]].map((p) => p.map((c) => c * s)); return autoEdges(v); };
  const tesseract = () => { const idx = CUBE_E.concat(CUBE_E.map(([u, v]) => [u + 8, v + 8])); for (let i = 0; i < 8; i++) idx.push([i, i + 8]); return segFrom(cubeVerts(0.42).concat(cubeVerts(0.22)), idx); };   // 内外双立方体 + 连棱
  const fiveCell = () => { const s = 0.46, v = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((p) => p.map((c) => c * s)); v.push([0, 0, 0]); return segFrom(v, allPairs(5)); };   // 4-单纯形 Schlegel
  const dedup = (edges, n) => { const seen = new Set(), out = []; for (let i = 0; i + 2 < edges.length && out.length < n * 3; i += 3) { const k = edges[i].toFixed(2) + ',' + edges[i + 1].toFixed(2) + ',' + edges[i + 2].toFixed(2); if (!seen.has(k)) { seen.add(k); out.push(edges[i], edges[i + 1], edges[i + 2]); } } return out.length ? out : [0, 0, 0]; };
  const mk = (edges, ellipsoid, spin, velAxis) => ({ edges: new Float32Array(edges), corners: dedup(edges, ellipsoid ? 4 : 6), ellipsoid: !!ellipsoid, spin, velAxis: !!velAxis });
  // nD 形（4/5/6 维）：存 D 维顶点 + 棱 + 投影距 wdist + 自转基速 spin4；运行时逐帧 nD 旋转→透视投影到 3D（真·高维运动）
  const projND0 = (v, dim, wd) => { const c = v.slice(); for (let d = dim - 1; d >= 3; d--) { const k = wd / (wd - c[d]); for (let m = 0; m < d; m++) c[m] *= k; } return [c[0], c[1], c[2]]; };   // angle-0 投影（建静态棱/corners）
  const makeND = (V, E, dim, wd, spin4) => {
    const v3 = V.map((v) => projND0(v, dim, wd)), edges = [];
    for (const [u, v] of E) edges.push(v3[u][0], v3[u][1], v3[u][2], v3[v][0], v3[v][1], v3[v][2]);
    const verts4 = new Float32Array(V.length * dim); V.forEach((v, i) => { for (let k = 0; k < dim; k++) verts4[i * dim + k] = v[k]; });
    const edgeIdx = new Int16Array(E.length * 2); E.forEach((e, i) => { edgeIdx[i * 2] = e[0]; edgeIdx[i * 2 + 1] = e[1]; });
    return { edges: new Float32Array(edges), corners: dedup(edges, 6), ellipsoid: false, spin: 0.05, velAxis: false, is4d: true, verts4, edgeIdx, n4: V.length, ne: E.length, wdist: wd, spin4, dim };   // spin 0.05 → 也绕运动方向轻微自转
  };
  const hcube = (dim, s) => { const V = [], E = [], N = 1 << dim;                                    // n-立方体：2^dim 顶点、Hamming=1 相邻 → dim·2^(dim-1) 棱
    for (let m = 0; m < N; m++) { const v = []; for (let k = 0; k < dim; k++) v.push(((m >> k) & 1) ? s : -s); V.push(v); }
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { let df = 0, x = i ^ j; while (x) { df += x & 1; x >>= 1; } if (df === 1) E.push([i, j]); } return { V, E }; };
  const autoEdgesND = (V, dim, tol) => { let mn = Infinity;                                          // 连接最短等长棱（正多胞体）
    const dist = (a, b) => { let s = 0; for (let k = 0; k < dim; k++) { const d = a[k] - b[k]; s += d * d; } return Math.sqrt(s); };
    for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) { const d = dist(V[i], V[j]); if (d < mn) mn = d; }
    const E = []; for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) if (Math.abs(dist(V[i], V[j]) - mn) < mn * (tol || 0.06)) E.push([i, j]); return E; };
  const tesseract4 = () => { const h = hcube(4, 0.5); return makeND(h.V, h.E, 4, 2.4, 0.16); };       // 8-胞体 16顶/32棱
  const fiveCell4 = () => { const r2 = Math.SQRT2, r6 = Math.sqrt(6), r12 = Math.sqrt(12), r20 = Math.sqrt(20), s = 0.72;
    const V = [[1 / r2, 1 / r6, 1 / r12, 1 / r20], [-1 / r2, 1 / r6, 1 / r12, 1 / r20], [0, -2 / r6, 1 / r12, 1 / r20], [0, 0, -3 / r12, 1 / r20], [0, 0, 0, -4 / r20]].map((p) => p.map((c) => c * s));
    const E = []; for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) E.push([i, j]); return makeND(V, E, 4, 2.0, 0.22); };   // 5-胞体（4-单纯形）K5
  const cell16 = () => { const s = 0.72, V = []; for (let ax = 0; ax < 4; ax++) for (const sgn of [s, -s]) { const v = [0, 0, 0, 0]; v[ax] = sgn; V.push(v); }   // 16-胞体（4-正轴体）±e_i 8顶
    const E = []; for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) { let anti = true; for (let k = 0; k < 4; k++) if (V[i][k] !== -V[j][k]) anti = false; if (!anti) E.push([i, j]); } return makeND(V, E, 4, 2.2, 0.2); };   // 非对极相连 → 24棱
  const cell24 = () => { const s = 0.5, V = [], pr = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];   // 24-胞体：(±1,±1,0,0) 全排列 24顶（唯一无三维对应）
    for (const [a, b] of pr) for (const sa of [s, -s]) for (const sb of [s, -s]) { const v = [0, 0, 0, 0]; v[a] = sa; v[b] = sb; V.push(v); }
    return makeND(V, autoEdgesND(V, 4, 0.06), 4, 2.4, 0.18); };   // 96棱
  const duo33 = () => { const r = 0.5, T = 6.2831853, V = [], E = [];                                  // 3-3 多胞柱：三角×三角 9顶/18棱
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) V.push([r * Math.cos(i / 3 * T), r * Math.sin(i / 3 * T), r * Math.cos(j / 3 * T), r * Math.sin(j / 3 * T)]);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let j2 = j + 1; j2 < 3; j2++) E.push([i * 3 + j, i * 3 + j2]);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) for (let i2 = i + 1; i2 < 3; i2++) E.push([i * 3 + j, i2 * 3 + j]);
    return makeND(V, E, 4, 2.0, 0.2); };
  const octaPrism = () => { const s = 0.62, wp = 0.45, oct = [], V = [];                               // 八面体棱柱：八面体×线段 12顶/30棱
    for (let ax = 0; ax < 3; ax++) for (const sgn of [s, -s]) { const v = [0, 0, 0]; v[ax] = sgn; oct.push(v); }
    const octE = autoEdgesND(oct, 3, 0.06);
    oct.forEach((v) => V.push([v[0], v[1], v[2], -wp])); oct.forEach((v) => V.push([v[0], v[1], v[2], wp]));
    const E = []; octE.forEach(([a, b]) => { E.push([a, b]); E.push([a + 6, b + 6]); }); for (let i = 0; i < 6; i++) E.push([i, i + 6]);
    return makeND(V, E, 4, 2.2, 0.2); };
  const penteract = () => { const h = hcube(5, 0.42); return makeND(h.V, h.E, 5, 2.6, 0.14); };       // 5-立方体 32顶/80棱
  const cube6 = () => { const h = hcube(6, 0.4); return makeND(h.V, h.E, 6, 2.8, 0.12); };            // 6-立方体 64顶/192棱
  const S = [null];                                                                                  // 0 = 发光点（城市），无几何体
  S[1] = mk(edgesOf(new THREE.BoxGeometry(0.78, 0.78, 0.78)), 0, 0.10);                               // 方块
  S[2] = mk(edgesOf(new THREE.OctahedronGeometry(0.62)), 0, 0.11);                                    // 正八面体
  S[3] = mk(edgesOf(new THREE.TetrahedronGeometry(0.8)), 0, 0.12);                                    // 四面锥
  S[4] = mk(edgesOf(new THREE.IcosahedronGeometry(0.62)), 0, 0.09);                                   // 正二十面体
  S[5] = mk(edgesOf(new THREE.DodecahedronGeometry(0.6)), 0, 0.08);                                   // 正十二面体
  S[6] = mk(edgesOf(new THREE.CylinderGeometry(0.5, 0.5, 0.95, 5)), 0, 0.10, 1);                      // 五棱柱（轴向自转=运动方向）
  S[7] = mk(edgesOf(new THREE.ConeGeometry(0.58, 1.05, 4)), 0, 0.10);                                 // 金字塔
  S[8] = mk(edgesOf(new THREE.CylinderGeometry(0.55, 0.55, 0.95, 3)), 0, 0.11, 1);                    // 三棱柱（轴向自转=运动方向）
  S[9] = mk(stella(), 0, 0.10);                                                                       // 星状八面体 stella octangula
  S[10] = mk(cubocta(), 0, 0.09);                                                                     // 立方八面体 cuboctahedron
  S[11] = tesseract4();                                                                               // 超立方体：逐帧 4D 旋转→3D（内外翻转/展开）
  S[12] = fiveCell4();                                                                                // 五胞体：逐帧 4D 旋转→3D（顶点穿插涌动）
  S[13] = mk(knot(2, 3, 56, 0.24), 0, 0.5);                                                           // 环面纽结 trefoil
  S[14] = mk(ring(), 1, 0.7);                                                                         // 陀螺椭圆环
  S[15] = cell16();                                                                                   // 16-胞体（4D，8顶/24棱）
  S[16] = cell24();                                                                                   // 24-胞体（4D，24顶/96棱，唯一无三维对应）
  S[17] = duo33();                                                                                    // 3-3 多胞柱（4D，9顶/18棱）
  S[18] = octaPrism();                                                                                // 八面体棱柱（4D，12顶/30棱）
  S[19] = penteract();                                                                                // 5-立方体（5D，32顶/80棱）
  S[20] = cube6();                                                                                    // 6-立方体（6D，64顶/192棱）
  return S;
})();
function cornersOf(t) { return (t && SHAPES[t]) ? SHAPES[t].corners : [0, 0, 0]; }
let solidGroups = [];
const _dummy = new THREE.Object3D(), _q = new THREE.Quaternion(), _v = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _UP = new THREE.Vector3(0, 1, 0);
const _v3tmp = new Float32Array(64 * 3), _localDyn = new Float32Array(192 * 6), _cN = new Float32Array(6);   // nD 投影暂存（≤64 顶点 / ≤192 棱 / ≤6 维）
// 把 D 维顶点按角 a 旋转（数个 4D 平面）再逐维透视塌缩到 3D，存入 _v3tmp
function projectND(verts, n4, dim, wd, a) {
  const c0 = Math.cos(a), s0 = Math.sin(a), c1 = Math.cos(a * 0.62), s1 = Math.sin(a * 0.62), c2 = Math.cos(a * 0.41), s2 = Math.sin(a * 0.41);
  for (let i = 0; i < n4; i++) {
    for (let k = 0; k < dim; k++) _cN[k] = verts[i * dim + k];
    { const x = _cN[0], w = _cN[dim - 1]; _cN[0] = x * c0 - w * s0; _cN[dim - 1] = x * s0 + w * c0; }       // 绕 (0, dim-1) 面
    { const y = _cN[1], w = _cN[dim - 1]; _cN[1] = y * c1 - w * s1; _cN[dim - 1] = y * s1 + w * c1; }       // 绕 (1, dim-1) 面
    if (dim >= 5) { const z = _cN[2], w = _cN[dim - 2]; _cN[2] = z * c2 - w * s2; _cN[dim - 2] = z * s2 + w * c2; }   // 5D+ 多一个旋转面
    for (let d = dim - 1; d >= 3; d--) { const k = wd / (wd - _cN[d]); for (let m = 0; m < d; m++) _cN[m] *= k; }     // 逐维透视塌缩到 3D
    _v3tmp[i * 3] = _cN[0]; _v3tmp[i * 3 + 1] = _cN[1]; _v3tmp[i * 3 + 2] = _cN[2];
  }
}
const GROUP_KEY = { CITY: 0, PRODUCT: 1, KERNEL: 2, BREAKTHROUGH: 3, POLICY: 4, VENDOR: 5, PHARMA: 6 };
const groupVis = [true, true, true, true, true, true, true];

function finalize() {
  N = D.sys.length;
  sys = Uint8Array.from(D.sys); anc = Float32Array.from(D.anc); scl = Float32Array.from(D.scl);
  bh = Float32Array.from(D.bh); prm = Float32Array.from(D.prm); spd = Float32Array.from(D.spd);
  state = Float32Array.from(D.seed); posArr = new Float32Array(N * 3);

  // 特征矩阵 featM(N×FEAT_DIM)：缺位填 0；字段列 0..19 做 min/max 归一化（类型 one-hot 列 20..25 保留偏置）
  featM = new Float32Array(N * FEAT_DIM);
  for (let i = 0; i < N; i++) { const fv = D.feat[i]; if (fv) featM.set(fv, i * FEAT_DIM); }
  for (let c = 0; c < 20; c++) {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < N; i++) { const v = featM[i * FEAT_DIM + c]; if (v < mn) mn = v; if (v > mx) mx = v; }
    const rng = mx - mn; if (rng > 1e-6) for (let i = 0; i < N; i++) { const k = i * FEAT_DIM + c; featM[k] = (featM[k] - mn) / rng; }
  }

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
  prevPos = Float32Array.from(posArr);   // 速度方向初值

  // group id per point (for show/hide toggles)
  grp = Uint8Array.from(D.meta.map((m) => (m && GROUP_KEY[m.kind] != null ? GROUP_KEY[m.kind] : 0)));
  shapeArr = new Uint8Array(N); for (let i = 0; i < N; i++) shapeArr[i] = D.shape[i] || 0;   // 每星几何体形 id
  // 尺寸曲线：发光点 / 几何体各按自身全局最大值归一化（连续量级·长尾的超群者→巨星），过幂曲线 → 群星 + 日月大行星，皆由数据决定
  { let pointMax = 1e-3, solidMax = 1e-3;
    for (let i = 0; i < N; i++) { if (shapeArr[i] === 0) { if (D.sz[i] > pointMax) pointMax = D.sz[i]; } else if (D.sz[i] > solidMax) solidMax = D.sz[i]; }
    szCurve = new Float32Array(N);
    for (let i = 0; i < N; i++) szCurve[i] = Math.pow(clamp(D.sz[i] / (shapeArr[i] === 0 ? pointMax : solidMax), 0, 1), SZ_GAMMA); }

  // points
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(posArr, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(D.col, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(szCurve, 1));   // 已是归一化幂曲线 [0,1]
  g.setAttribute('aTwinkle', new THREE.Float32BufferAttribute(D.tw, 1));
  g.setAttribute('aHaze', new THREE.Float32BufferAttribute(D.hz, 1));
  g.setAttribute('aOrbPhase', new THREE.Float32BufferAttribute(D.op, 1));
  pointVisArr = new Float32Array(N).fill(1);
  pointVisAttr = new THREE.BufferAttribute(pointVisArr, 1).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aVis', pointVisAttr);
  const glowArr = new Float32Array(N); for (let i = 0; i < N; i++) glowArr[i] = shapeArr[i] === 0 ? 1 : 0;   // 光点型（城市 + 医药站点）=发光，余皆几何体
  g.setAttribute('aGlow', new THREE.Float32BufferAttribute(glowArr, 1));
  pointsObj = new THREE.Points(g, pointMaterial); root.add(pointsObj);

  // trail emitters: 每个实体的每个顶点各发一条轨迹
  const emE = [], emL = [], emC = [], emT = [];
  for (let i = 0; i < N; i++) {
    const c = cornersOf(shapeArr[i]), cc = c.length / 3;
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
  const o = i * 3, sy = sys[i], s = scl[i] * (1 - (1 - SHRINK) * gOrg), r = i * 9;   // 呼气铺开 → 混沌缩小
  const ax = CENTER[0] + (anc[o] - CENTER[0]) * gOrg;         // 有效锚点：CENTER(重叠) ⇄ SOM 语义坐标
  const ay = CENTER[1] + (anc[o + 1] - CENTER[1]) * gOrg;
  const az = CENTER[2] + (anc[o + 2] - CENTER[2]) * gOrg;
  let cx = 0, cy = 0, cz = 0;                                  // per-attractor centering
  if (sy === 1) cz = 25; else if (sy === 3) cz = 0.6; else if (sy === 4) { cx = -2.4; cy = -2.4; cz = -2.4; } else if (sy === 6) cz = 22; else if (sy === 8) cx = 1; else if (sy === 9) cz = 20;
  const lx = (state[o] - cx) * s, ly = (state[o + 2] - cz) * s, lz = (state[o + 1] - cy) * s;   // attractor local frame (z→up)
  const ox = rotM[r] * lx + rotM[r + 1] * ly + rotM[r + 2] * lz;                  // data-driven orientation
  const oy = rotM[r + 3] * lx + rotM[r + 4] * ly + rotM[r + 5] * lz;
  const oz = rotM[r + 6] * lx + rotM[r + 7] * ly + rotM[r + 8] * lz;
  const ai = sy * 3, kx = SYS_AXIS[ai], ky = SYS_AXIS[ai + 1], kz = SYS_AXIS[ai + 2], cc = sysCos[sy], sn = sysSin[sy];
  const kd = (kx * ox + ky * oy + kz * oz) * (1 - cc);                            // per-system self-rotation (Rodrigues)
  posArr[o] = ax + ox * cc + (ky * oz - kz * oy) * sn + kx * kd;
  posArr[o + 1] = ay + oy * cc + (kz * ox - kx * oz) * sn + ky * kd;
  posArr[o + 2] = az + oz * cc + (kx * oy - ky * ox) * sn + kz * kd;
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

// ---------- SOM：Kohonen 自组织网络（boot 一次性整训）→ 写语义锚点 + 画神经晶格 ----------
function buildSOM() {
  if (!N || !featM) return null;
  const Lx = SOM_L[0], Ly = SOM_L[1], Lz = SOM_L[2], M = Lx * Ly * Lz, d = FEAT_DIM;
  const W = new Float32Array(M * d);
  for (let n = 0; n < M; n++) { const r = (Math.random() * N) | 0; W.set(featM.subarray(r * d, r * d + d), n * d); }   // init=随机样本
  const nx = (n) => n % Lx, ny = (n) => ((n / Lx) | 0) % Ly, nz = (n) => (n / (Lx * Ly)) | 0;
  const order = new Int32Array(N); for (let i = 0; i < N; i++) order[i] = i;
  const sigma0 = Math.max(Lx, Ly, Lz) * 0.5, total = SOM_EPOCHS * N; let it = 0;
  for (let ep = 0; ep < SOM_EPOCHS; ep++) {
    for (let a = N - 1; a > 0; a--) { const b = (Math.random() * (a + 1)) | 0, t = order[a]; order[a] = order[b]; order[b] = t; }   // shuffle
    for (let s = 0; s < N; s++) {
      const xi = order[s] * d, frac = it++ / total;
      const alpha = 0.5 * Math.exp(-frac * 3), sigma = sigma0 * Math.exp(-frac * 3), inv2s2 = 1 / (2 * sigma * sigma);
      let bmu = 0, best = Infinity;                                          // 竞争：找 BMU
      for (let n = 0; n < M; n++) { const wo = n * d; let acc = 0; for (let k = 0; k < d; k++) { const e = featM[xi + k] - W[wo + k]; acc += e * e; if (acc >= best) break; } if (acc < best) { best = acc; bmu = n; } }
      const bx = nx(bmu), by = ny(bmu), bz = nz(bmu), rad = Math.max(1, Math.ceil(sigma));
      for (let iz = Math.max(0, bz - rad); iz <= Math.min(Lz - 1, bz + rad); iz++)               // 邻域协同更新
        for (let iy = Math.max(0, by - rad); iy <= Math.min(Ly - 1, by + rad); iy++)
          for (let ix = Math.max(0, bx - rad); ix <= Math.min(Lx - 1, bx + rad); ix++) {
            const dist2 = (ix - bx) * (ix - bx) + (iy - by) * (iy - by) + (iz - bz) * (iz - bz);
            const h = alpha * Math.exp(-dist2 * inv2s2); if (h < 1e-3) continue;
            const wo = (ix + Lx * (iy + Ly * iz)) * d;
            for (let k = 0; k < d; k++) W[wo + k] += h * (featM[xi + k] - W[wo + k]);
          }
    }
  }
  // 每星→BMU→晶格坐标→世界坐标，写入 anc；累积 density
  // 晶格→世界：ix=经度（环视一圈）· iy=纬度（等面积、避开极点）· iz=球壳厚度；逐节点确定性抖动 → 不规律的有机球面
  const Rmin = SOM_R[0], Rmax = SOM_R[1], TAU = 6.2831853;
  const nodeWorld = (ix, iy, iz) => {
    const key = ix + '_' + iy + '_' + iz;
    const ja = hash01('na' + key), jb = hash01('nb' + key), jc = hash01('nc' + key);
    const theta = (ix / Lx) * TAU + (ja - 0.5) * 0.55;                                  // 经度 + 抖动
    let cphi = 1 - 2 * ((iy + 0.5) / Ly) + (jb - 0.5) * 0.22;                            // 等面积纬度 + 抖动
    cphi = Math.max(-0.985, Math.min(0.985, cphi));
    const phi = Math.acos(cphi), sphi = Math.sin(phi);
    const r = Rmin + (Lz > 1 ? iz / (Lz - 1) : 0) * (Rmax - Rmin) + (jc - 0.5) * 18;     // 壳厚 + 抖动
    return [CENTER[0] + r * sphi * Math.cos(theta), CENTER[1] + r * cphi, CENTER[2] + r * sphi * Math.sin(theta)];
  };
  const density = new Float32Array(M);
  for (let i = 0; i < N; i++) {
    const xi = i * d; let bmu = 0, best = Infinity;
    for (let n = 0; n < M; n++) { const wo = n * d; let acc = 0; for (let k = 0; k < d; k++) { const e = featM[xi + k] - W[wo + k]; acc += e * e; } if (acc < best) { best = acc; bmu = n; } }
    density[bmu]++;
    const w = nodeWorld(nx(bmu), ny(bmu), nz(bmu)); anc[i * 3] = w[0]; anc[i * 3 + 1] = w[1]; anc[i * 3 + 2] = w[2];
  }
  let maxD = 1; for (let n = 0; n < M; n++) if (density[n] > maxD) maxD = density[n];
  // 神经晶格：相邻神经元(+x/+y/+z)连线，aGlow=density 归一
  const segPos = [], segCol = [], segGlow = [], BASE = [0.42, 0.56, 0.82];
  const glowOf = (n) => 0.16 + 0.84 * (density[n] / maxD);
  const link = (na, nb) => {
    const a = nodeWorld(nx(na), ny(na), nz(na)), b = nodeWorld(nx(nb), ny(nb), nz(nb));
    segPos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    segCol.push(BASE[0], BASE[1], BASE[2], BASE[0], BASE[1], BASE[2]);
    segGlow.push(glowOf(na), glowOf(nb));
  };
  for (let iz = 0; iz < Lz; iz++) for (let iy = 0; iy < Ly; iy++) for (let ix = 0; ix < Lx; ix++) {
    const n = ix + Lx * (iy + Ly * iz);
    if (ix + 1 < Lx) link(n, n + 1);
    if (iy + 1 < Ly) link(n, n + Lx);
    if (iz + 1 < Lz) link(n, n + Lx * Ly);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(segPos, 3));
  lg.setAttribute('aColor', new THREE.Float32BufferAttribute(segCol, 3));
  lg.setAttribute('aGlow', new THREE.Float32BufferAttribute(segGlow, 1));
  latticeObj = new THREE.LineSegments(lg, latticeMat); latticeObj.frustumCulled = false; root.add(latticeObj);
  return { neurons: M, edges: segGlow.length / 2 };
}

// CPPN 权重：用数据聚合量确定性播种（mulberry32 PRNG）→ 上传到背景 shader
function seedCPPN(seedInt) {
  let s = seedInt >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const Wt = new Float32Array(138); for (let i = 0; i < 138; i++) Wt[i] = (rnd() * 2 - 1) * 1.3;
  return Wt;
}

// ---------- immersive look controller（相机在体系正中心，第一人称环视）----------
const camPos = new THREE.Vector3(CENTER[0], CENTER[1], CENTER[2]);
const cCenter = new THREE.Vector3(CENTER[0], CENTER[1], CENTER[2]);
let yaw = 0, pitch = 0, dragging = false, lastPX = 0, lastPY = 0, gyroOn = false;
const fwd = new THREE.Vector3();
// 视角追踪：点击一颗星 → 锁定它，相机以它为中心环绕（拖动/陀螺=绕它转）；点空白 → 缓缓退回正中心
const ORBIT_R = 6.5;
let focusIdx = -1, focusActive = false, focusBlend = 0;
const _starSmooth = new THREE.Vector3(), _desiredPos = new THREE.Vector3(), _freeLook = new THREE.Vector3(), _lookTmp = new THREE.Vector3(), _starNow = new THREE.Vector3();
function applyLook() {
  fwd.set(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw));
  _freeLook.copy(camPos).add(fwd);
  if (focusIdx >= 0 && posArr) {
    const o = focusIdx * 3;
    _starSmooth.lerp(_starNow.set(posArr[o], posArr[o + 1], posArr[o + 2]), 0.18);   // 平滑跟踪混沌中的目标
    _desiredPos.copy(_starSmooth).addScaledVector(fwd, ORBIT_R);                       // 相机 = 目标 + 视向·R → 环绕
    camera.position.copy(camPos).lerp(_desiredPos, focusBlend);
    camera.lookAt(_lookTmp.copy(_freeLook).lerp(_starSmooth, focusBlend));             // 看向目标（按 blend 平滑切入/退出）
  } else {
    camera.position.copy(camPos);
    camera.lookAt(_freeLook);
  }
}
// Pointer Events 统一：1 指 = 拖动环视；2 指 = 捏合调焦（FOV）。多指共存，桌面鼠标/滚轮照旧
const _ptrs = new Map();
let pinchPrev = 0;
const _dom = renderer.domElement;
_dom.addEventListener('pointerdown', (e) => {
  _ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (_ptrs.size >= 2) { pinchPrev = 0; dragging = false; } else { dragging = true; lastPX = e.clientX; lastPY = e.clientY; }
});
_dom.addEventListener('pointermove', (e) => {
  if (!_ptrs.has(e.pointerId)) return;
  _ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (_ptrs.size >= 2) {                                      // 双指捏合 → 焦距（捏开放大）
    const it = _ptrs.values(), p1 = it.next().value, p2 = it.next().value, d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    if (pinchPrev) { camera.fov = clamp(camera.fov - (d - pinchPrev) * 0.08, 22, 105); camera.updateProjectionMatrix(); }
    pinchPrev = d;
  } else if (dragging) {                                      // 单指拖动 → 环视
    yaw -= (e.clientX - lastPX) * 0.004; pitch = clamp(pitch - (e.clientY - lastPY) * 0.004, -1.45, 1.45);
    lastPX = e.clientX; lastPY = e.clientY;
  }
});
const _ptrEnd = (e) => {
  _ptrs.delete(e.pointerId); pinchPrev = 0;
  if (_ptrs.size === 1) { const p = _ptrs.values().next().value; lastPX = p.x; lastPY = p.y; dragging = true; }   // 双→单：续上拖动，不跳变
  else if (_ptrs.size === 0) dragging = false;
};
addEventListener('pointerup', _ptrEnd);
addEventListener('pointercancel', _ptrEnd);
_dom.addEventListener('wheel', (e) => {                       // 桌面滚轮 = 调焦距（FOV），相机不位移
  e.preventDefault();
  camera.fov = clamp(camera.fov + e.deltaY * 0.03, 22, 105);
  camera.updateProjectionMatrix();
}, { passive: false });
// 陀螺仪：以「增量」驱动 → 与手指拖动叠加共存、互不覆盖；避开绝对罗盘坐标导致的方向混乱
const GYRO_DZ = 0.15;                                         // 软死区阈值（度）：过滤传感器微抖
const gyroGate = (d) => { const a = Math.abs(d); return a < 1e-9 ? 0 : d * (a * a / (a * a + GYRO_DZ * GYRO_DZ)); };   // (a²)/(a²+t²)：噪声平方级衰减、大幅运动几乎不损
let gyroPrevA = null, gyroPrevB = null, gyroDYaw = 0, gyroDPitch = 0, gyroSmYaw = 0, gyroSmPitch = 0;
addEventListener('deviceorientation', (e) => {
  if (e.alpha == null) return; gyroOn = true;
  const A = e.alpha, B = e.beta == null ? 90 : e.beta;
  if (gyroPrevA !== null) {
    let dA = A - gyroPrevA; if (dA > 180) dA -= 360; else if (dA < -180) dA += 360;   // 罗盘 360° 环绕
    const dB = B - gyroPrevB;
    gyroDYaw += gyroGate(dA) * Math.PI / 180;                 // 软死区滤微抖 → 视角同向转（已修正左右反向）
    gyroDPitch += gyroGate(dB) * Math.PI / 180;               // 软死区滤微抖 → 视角俯仰（已修正上下反向）
  }
  gyroPrevA = A; gyroPrevB = B;
});

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
  btn.textContent = sensorBtnLabel(analyser);
  setTimeout(() => { btn.parentElement.style.opacity = '0.3'; }, 2600);
}
document.getElementById('enable').addEventListener('click', enableSensors);

// pick
const raycaster = new THREE.Raycaster(); raycaster.params.Points.threshold = 2.6;
const card = document.getElementById('card'); const ndc = new THREE.Vector2();
let downX = 0, downY = 0, cardMeta = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 7 || !pointsObj) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(pointsObj)[0];
  if (hit && D.meta[hit.index]) {
    cardMeta = D.meta[hit.index];
    card.innerHTML = renderCardHtml(cardMeta);
    card.classList.remove('hidden');
    const o = hit.index * 3; _starSmooth.set(posArr[o], posArr[o + 1], posArr[o + 2]);   // 锚定起点，避免镜头长距飞扑
    focusIdx = hit.index; focusActive = true;                                              // 锁定追踪
  } else {
    cardMeta = null;
    card.classList.add('hidden');
    focusActive = false;                                                                    // 点空白 → 退回正中心
  }
});

document.getElementById('lang-toggle').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleLang();
  const lt = document.getElementById('lang-toggle');
  if (lt) lt.title = isZh() ? 'Switch to English' : 'Switch to 中文';
  applyUi({ analyser, cardMeta, cardEl: card });
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

  // 呼吸式自组织：CENTER(重叠混沌) ⇄ SOM 神经地图；mic 出声提速呼吸；smootherstep 在两端停留
  breathT += dt * (0.13 + pulse * 0.3);
  const oRaw = 0.5 - 0.5 * Math.cos(breathT);
  gOrg = oRaw * oRaw * (3 - 2 * oRaw);
  if (latticeObj) latticeMat.uniforms.uOrg.value = gOrg;   // 呼气时神经晶格显形

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
        const sg = solidGroups[g], lv = sg.lv, pos = sg.pos;
        let local = sg.local;
        for (let j = 0; j < sg.cnt; j++) {
          const gi = sg.gidx[j], o = gi * 3, vis = groupVis[grp[gi]] ? 1 : 0;
          if (sg.is4d) {                                          // 逐帧 nD 旋转→投影 3D（速率随数据 D.spd），每个实体各自的形状
            projectND(sg.verts4, sg.n4, sg.dim, sg.wdist, sg.spd4[j] * tElapsed + sg.phase[j]);
            for (let e2 = 0; e2 < sg.ne; e2++) { const u = sg.edgeIdx[e2 * 2] * 3, v2 = sg.edgeIdx[e2 * 2 + 1] * 3, o2 = e2 * 6;
              _localDyn[o2] = _v3tmp[u]; _localDyn[o2 + 1] = _v3tmp[u + 1]; _localDyn[o2 + 2] = _v3tmp[u + 2];
              _localDyn[o2 + 3] = _v3tmp[v2]; _localDyn[o2 + 4] = _v3tmp[v2 + 1]; _localDyn[o2 + 5] = _v3tmp[v2 + 2]; }
            local = _localDyn;
          }
          // 所有几何体：以「运动方向」为轴轻微自转（顺着各自轨迹流转）；方向先低通滤波 → 平滑不抖
          const o3 = j * 3, vx = posArr[o] - prevPos[o], vy = posArr[o + 1] - prevPos[o + 1], vz = posArr[o + 2] - prevPos[o + 2], vl = Math.hypot(vx, vy, vz);
          let dx = sg.vdir[o3], dy = sg.vdir[o3 + 1], dz = sg.vdir[o3 + 2];
          if (vl > 1e-6) {
            const sm = Math.min(1, dt * 5);
            dx += (vx / vl - dx) * sm; dy += (vy / vl - dy) * sm; dz += (vz / vl - dz) * sm;
            const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
            sg.vdir[o3] = dx; sg.vdir[o3 + 1] = dy; sg.vdir[o3 + 2] = dz;
          }
          _v.set(dx, dy, dz);
          if (sg.velAxis) { _q1.setFromUnitVectors(_UP, _v); _q2.setFromAxisAngle(_v, sg.speed[j] * tElapsed); _q.multiplyQuaternions(_q2, _q1); }   // 棱柱：长轴对齐 + 绕轴自旋（纺锤）
          else { _q.setFromAxisAngle(_v, sg.speed[j] * tElapsed); }   // 其余：绕运动方向轻微自转
          const sc = (0.05 + szCurve[gi] * 1.4) * (sg.ellipsoid ? ringBreath : sbreath) * vis;   // 群星(微) → 日月大行星(巨)，幂曲线·按层归一化·数据驱动
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
        if (shapeArr[gi] === 0) { trailSrc[eo] = posArr[gi * 3]; trailSrc[eo + 1] = posArr[gi * 3 + 1]; trailSrc[eo + 2] = posArr[gi * 3 + 2]; }
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

    if (prevPos) prevPos.set(posArr);   // 存本帧位置 → 下一帧算速度方向
  }

  if (gyroOn) {                                          // 泄漏积分 damper：每帧只应用一部分待发增量、余下顺延 → 平滑、保积分（不丢真实运动）
    const gsm = Math.min(1, dt * 14);
    gyroSmYaw = gyroDYaw * gsm; gyroDYaw -= gyroSmYaw;
    gyroSmPitch = gyroDPitch * gsm; gyroDPitch -= gyroSmPitch;
    yaw += gyroSmYaw; pitch = clamp(pitch + gyroSmPitch, -1.45, 1.45);
  }
  else if (!dragging && focusIdx < 0) yaw += 0.00016;    // 极缓自动巡游（仅自由模式）
  focusBlend += ((focusActive ? 1 : 0) - focusBlend) * Math.min(1, dt * 2.4);   // 锁定/解锁的平滑过渡
  if (!focusActive && focusBlend < 0.01) focusIdx = -1;                          // 完全退出后清空
  applyLook();
  renderer.render(scene, camera);
}

// ---------- 几何体变体：每类一种缓慢自转的线框立体（围绕发光核） ----------
function buildSolids() {
  const buckets = {};                                            // 按几何体形 id 分桶（跨数据层，shape 0=点不建）
  for (let i = 0; i < N; i++) { const sid = shapeArr[i]; if (!sid || !SHAPES[sid]) continue; (buckets[sid] || (buckets[sid] = [])).push(i); }
  for (const sidKey in buckets) {
    const sid = +sidKey, list = buckets[sid], cnt = list.length, shape = SHAPES[sid];
    const local = shape.edges, lv = local.length / 3;
    const pos = new Float32Array(cnt * lv * 3), colA = new Float32Array(cnt * lv * 3);
    const gidx = new Int32Array(cnt), speed = new Float32Array(cnt), vdir = new Float32Array(cnt * 3);   // vdir = 平滑后的运动方向（所有几何体共用）
    const spd4 = shape.is4d ? new Float32Array(cnt) : null, phase = shape.is4d ? new Float32Array(cnt) : null;
    for (let j = 0; j < cnt; j++) {
      const gi = list[j]; gidx[j] = gi;
      vdir[j * 3] = 0; vdir[j * 3 + 1] = 1; vdir[j * 3 + 2] = 0;   // 初始方向
      speed[j] = shape.spin * (0.4 + (D.spd[gi] || 0.5));          // 自转速率随数据 D.spd（轻微、绕运动方向）
      if (shape.is4d) { spd4[j] = shape.spin4 * (0.4 + (D.spd[gi] || 0.5)); phase[j] = hash01('p4' + gi) * 6.2831853; }   // 4D 旋转速率随数据 D.spd；相位去同步
      const cr = D.col[gi * 3], cg = D.col[gi * 3 + 1], cb = D.col[gi * 3 + 2];
      for (let v = 0; v < lv; v++) { const k = (j * lv + v) * 3; colA[k] = cr; colA[k + 1] = cg; colA[k + 2] = cb; }
    }
    const g = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', posAttr);
    g.setAttribute('aColor', new THREE.BufferAttribute(colA, 3));
    const mesh = new THREE.LineSegments(g, solidLineMat); mesh.frustumCulled = false; root.add(mesh);
    solidGroups.push({ posAttr, pos, local, lv, cnt, gidx, speed, vdir, ellipsoid: shape.ellipsoid, velAxis: shape.velAxis,
      is4d: shape.is4d, verts4: shape.verts4, edgeIdx: shape.edgeIdx, n4: shape.n4, ne: shape.ne, wdist: shape.wdist, dim: shape.dim, spd4, phase });
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
  const groups = [
    ['panelCities', 0], ['panelProducts', 1], ['panelKernels', 2],
    ['panelBreakthroughs', 3], ['panelPolicies', 4], ['panelVendors', 5], ['panelPharma', 6],
  ];
  const mkRow = (i18nKey, checked, onToggle) => {
    const row = document.createElement('label'); row.className = 'prow';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = checked;
    cb.addEventListener('change', () => onToggle(cb.checked));
    const sp = document.createElement('span');
    row.appendChild(cb); row.appendChild(sp);
    registerPanelNode('rows', i18nKey, sp);
    return row;
  };
  const h = document.createElement('div'); h.className = 'phead';
  registerPanelNode('heads', 'panelLayers', h);
  panel.appendChild(h);
  groups.forEach(([key, gi]) => panel.appendChild(mkRow(key, true, (on) => { groupVis[gi] = on; updateVisibility(); })));
  const h2 = document.createElement('div'); h2.className = 'phead';
  registerPanelNode('heads', 'panelEffects', h2);
  panel.appendChild(h2);
  panel.appendChild(mkRow('panelBeams', true, (on) => { if (beamObj) beamObj.visible = on; }));
  panel.appendChild(mkRow('panelTrails', true, (on) => { if (trailObj) trailObj.visible = on; }));
  panel.appendChild(mkRow('panelLattice', true, (on) => { if (latticeObj) latticeObj.visible = on; }));
  document.body.appendChild(panel);
  panel.style.display = 'none';
  addEventListener('keydown', (e) => { if (e.key === 'd' || e.key === 'D') panel.style.display = panel.style.display === 'none' ? 'flex' : 'none'; });
}

// ---------- boot ----------
(async function main() {
  let info = {}, pharma = {};
  try { info = await buildIndustrial(); } catch (err) { console.warn('[Data Abyss] industrial load failed (need http server):', err); }
  try { pharma = await buildPharma(); } catch (err) { console.warn('[Data Abyss] pharma load failed:', err); }
  const cities = buildHousing();
  bgMat.uniforms.uWarm.value = climWarm;
  // CPPN 背景：用数据聚合量确定性播种神经权重（这场梦由数据塑形）
  const cppnSeed = (Math.round(climWarm * 1000) * 131 + (info.products || 0) * 17 + (info.milestones || 0) * 7 + (info.policies || 0) * 3 + cities) >>> 0;
  bgMat.uniforms.uW.value = seedCPPN(cppnSeed);
  finalize();
  const som = buildSOM();   // boot 一次性整训 Kohonen 网络 → 语义锚点 + 神经晶格
  buildSolids();
  buildPanel();
  applyUi({ skipEnable: true });
  console.log(`[Data Abyss] ${cities} cities · ${info.products || 0} products · ${info.kernels || 0} kernels · ${info.milestones || 0} breakthroughs · ${info.policies || 0} policies · ${info.vendors || 0} vendors · pharma[${pharma.companies || 0} co / ${pharma.sites || 0} sites / ${pharma.products || 0} drugs / ${pharma.modalities || 0} mod / ${pharma.milestones || 0} bk] · ${N} bodies · ${beamIdxA ? beamIdxA.length : 0} beams · SOM ${som ? som.neurons + ' neurons / ' + som.edges + ' edges' : 'skipped'}`);
  const ld = document.getElementById('loading'); ld.classList.add('gone'); setTimeout(() => ld.remove(), 1000);
  animate();
})();
