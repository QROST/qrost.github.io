// 霓虹渊 · Neon Abyss — Data Abyss 的夜店变体（fork 自 visual-page/app.js）。
// 同一套混沌吸引子 + SOM + 数据驱动；视觉与音乐换成 Trance / 138 BPM：
//   · 角速度脉冲来源由 麦克风 改为 生成音频引擎的 beatPulse（每个 kick → 脉冲 → 加速整片宇宙）。
//   · 渲染管线加入 EffectComposer + UnrealBloomPass（夜店辉光的头号来源）。
//   · 配色调成霓虹饱和（品红/青/酸橙/橙）；节拍同步：相机微震 / FOV punch / bloom 强度脉冲。
//   · 去掉麦克风/陀螺仪/clubMode 律动模式（纯生成音乐）。静音态下可选按需重开麦克风（"带上你自己的 DJ"，见下方
//     「静音态 mic 驱动」小节）：只是给节拍脉冲换一个数据源，绝不碰 Sonifier 内部/音乐参数。

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
  applyUi, registerPanelNode, renderCardHtml, sensorBtnLabel, setLang, isZh,
} from './i18n.js?v=n1';
import { Sonifier } from './audio-club.js?v=n16';   // 生成式 Trance 音乐引擎（zero-dep Web Audio）+ beatPulse + groove-style(A/B/C) + DJ 呼吸弧 + 每宇宙调/速多样化

const sonifier = new Sonifier();   // 由「Motion & sound」按钮在用户手势内 start()

const IS_MOBILE = matchMedia('(pointer: coarse)').matches || innerWidth < 820;
const DEBUG = new URLSearchParams(location.search).has('debug');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const IND = '../china-industrial-software/assets/data/';
const PHARM = '../pharm-companies/assets/data/';   // 第三个数据源：全球医药公司图谱
const CATS_DATA = '../shelter-cats/assets/data/';  // 第四个数据源：全球收容所猫领养平台
const TRAIL = IS_MOBILE ? 30 : 72;   // 轨迹历史采样数=最长尾上限（每点实际尾长由数据 tlen 决定，公式按 TRAIL 自动缩放）。加长：44→72（补偿 MOTION/呼吸半速后变短的世界尾长）
const STRIDE = 20;                    // 每 STRIDE 帧采样一次 → 路径覆盖帧数 = TRAIL×STRIDE。10→20：免内存翻倍覆盖；因运动已半速，每段位移(snap=motion×STRIDE)≈原值 → 平滑度不降。合计最长尾世界距离 ≈ 原来的 1.6×
const TR_GRACE = 3;                   // 拖尾重入迟滞：离屏 < TR_GRACE 个采样(掠过屏幕边缘) → 桥接续画不闪；≥ 则整 ring 重置防长拖影
const MOTION = 0.5;                   // 全局运动降速系数（用户「整体降速 2×」）：缩放吸引子步长 + 系统自转 → 混沌轨迹/朝向不变，仅放慢演化速率；不动呼吸/明灭（那是氛围非位移）
const CENTER = [0, 42, 0];           // 所有吸引子共用中心 → 重叠共舞（呼吸吸气态）
const FEAT_DIM = 28;                 // SOM 特征维度：字段 0..19 + 类型 one-hot 20..27（8 类：含医药 + 收容所猫）
const SOM_L = [9, 7, 5];             // Kohonen 晶格维度 → 315 神经元
const SOM_R = [55, 120];             // 神经晶格→世界：环绕视角的球壳 内/外半径（非平面盒）
const SOM_EPOCHS = IS_MOBILE ? 14 : 26;
const SHRINK = 0.5;                  // 完全呼气（铺开）时混沌缩成锚点周围小笔触的比例
// —— 打破"所有吸引子共用 CENTER → 中央堆叠"：每个系统各有一个"吸气归位中心"，
//    散布在 CENTER 周围半径 SPREAD_R 的小球面上（黄金角螺旋 → 角向均匀）。
//    最深吸气态不再把全部实体堆成一坨，而是散成 15 个各居其位的松散子团；呼气照常展开到各自 SOM 壳坐标。
//    SPREAD_R 越大越散、越小越聚——"稍微分散"取中等值（相对 SOM 内壳 55 约 40%）。
const SPREAD_R = 24;
const SYSN = 15;                     // 系统总数
const SYS_AXIS = new Float32Array(SYSN * 3), SYS_SPIN = new Float32Array(SYSN);
const SYS_CTR = new Float32Array(SYSN * 3);   // 每系统吸气归位中心（CENTER + 球面散布偏移）
const sysCos = new Float32Array(SYSN).fill(1), sysSin = new Float32Array(SYSN);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
for (let s = 0; s < SYSN; s++) {     // 每个系统不同的自转轴 + 角速度 + 散布归位中心
  let ax = Math.sin(s * 1.3 + 0.5), ay = Math.cos(s * 0.7 + 1.1), az = Math.sin(s * 2.1 + 0.3);
  const L = Math.hypot(ax, ay, az) || 1; SYS_AXIS[s * 3] = ax / L; SYS_AXIS[s * 3 + 1] = ay / L; SYS_AXIS[s * 3 + 2] = az / L;
  SYS_SPIN[s] = 0.04 + (s % 5) * 0.022;
  const yy = 1 - (s + 0.5) / SYSN * 2;                       // +1..-1 均匀分层
  const rr = Math.sqrt(Math.max(0, 1 - yy * yy)), th = GOLDEN_ANGLE * s;
  const rad = SPREAD_R * (0.72 + 0.56 * ((s * 7 % SYSN) / SYSN));   // 半径略抖动 → 非完美空心球壳
  SYS_CTR[s * 3]     = CENTER[0] + Math.cos(th) * rr * rad;
  SYS_CTR[s * 3 + 1] = CENTER[1] + yy * rad;
  SYS_CTR[s * 3 + 2] = CENTER[2] + Math.sin(th) * rr * rad;
}

// ---------- scene ----------
const container = document.getElementById('scene');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060e, 0.0019);

const camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 4000);
camera.position.set(0, 44, 150);
// 开场镜头：SOM 计算/呼气揭示期间，焦距从开场值缓慢 zoom out 到 100（ease-in-out → 起步柔、到点平缓停住）；用户手动缩放即取消
let introZoom = true, introProg = 0;
const INTRO_DUR = 10, INTRO_FOV_START = camera.fov, INTRO_FOV_END = 100;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false });   // 不因弱 GPU 拒绝创建 → 任何设备都能开
} catch (err) {
  // WebGL 完全不可用（设置关闭/古董浏览器/受限环境）：构造函数同步抛出 → 后续所有顶层代码都会执行失败。
  // 把"Igniting the abyss…"换成明确文案，而不是让 loading 遮罩永远卡住、不给任何反馈；随后照常向外抛出以停止本模块剩余的初始化。
  const ld = document.getElementById('loading');
  if (ld) ld.textContent = 'WebGL not available in this browser · 此浏览器不支持 WebGL';
  throw err;
}
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_MOBILE ? 1.5 : 2));   // 移动端高清屏降采样：省 GPU 像素填充，肉眼几乎无损
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// WebGL 上下文丢失/恢复（手机切后台、内存压力、GPU 复位常触发）→ 阻止默认即可让浏览器自动恢复，避免永久黑屏
renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); }, false);
// 恢复后 Three 自动重传自身 GPU 资源；动态实例/位置缓冲每帧 needsUpdate=true → 下一帧自然重建

// ---------- 后处理：UnrealBloom ----------
// 夜店感的头号来源。原 Data Abyss（visual-page/app.js）明确"无 bloom"；此处必加。
// 移动端关闭 bloom（GPU 压力大、易掉帧）；桌面端开 bloom。
const BLOOM_ON = !IS_MOBILE;
let composer = null, bloomPass = null;
if (BLOOM_ON) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.5, 0.7);   // strength 0.7 · radius 0.5 · threshold 0.7（高阈值：只有真正亮的星核 bloom，背景星云不糊成白）
  composer.addPass(bloomPass);
}
const BLOOM_BASE = 0.7;   // bloom 基线强度（kick 时脉冲到 ~1.1）


// GPU 可绘制的最大点尺寸各异（部分移动 GPU 仅 64）→ 取真实上限，避免超限被驱动异常裁切；日月封顶 150
const _gl = renderer.getContext();
const MAX_PT = Math.min(150, ((_gl && _gl.getParameter(_gl.ALIASED_POINT_SIZE_RANGE)) || [1, 64])[1] || 64);

// 片元 highp 探测：现代 GPU 恒 true（Three 自动 prepend highp，CPPN 神经场精度不变）；极老 GPU（无 highp 片元，多为 2015 前 PowerVR/Mali-400）→ false，
// 届时 Three 自动降 mediump + 下方 bgMat 启用 mediump-safe hash 兜底，避免噪声碎裂/编译失败黑屏。探测失败按支持处理（现代设备绝对多数）→ 不误伤非老 GPU 效果。
const _hpf = _gl && _gl.getShaderPrecisionFormat && _gl.getShaderPrecisionFormat(_gl.FRAGMENT_SHADER, _gl.HIGH_FLOAT);
const FRAG_HIGHP = !_hpf || _hpf.precision > 0;

const root = new THREE.Group();
scene.add(root);

// 背景：气候驱动的冷暖流体场（天穹 shader，按视角方向连续·无缝·不重复）
let climWarm = 0.5;
const bgMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  uniforms: { uTime: { value: 0 }, uWarm: { value: 0.5 }, uPulse: { value: 0 }, uW: { value: new Float32Array(138) } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  // 精度交由 Three 按 GPU 自动 prepend（现代 highp / 老 GPU mediump）；仅老 GPU 注入 LOWP_HASH 切到 mediump-safe hash。现代路径无 define → 逐字不变。
  fragmentShader: (FRAG_HIGHP ? '' : '#define LOWP_HASH\n') + `
    varying vec3 vDir; uniform float uTime; uniform float uWarm; uniform float uPulse;
    uniform float uW[138];                                          // CPPN 权重（数据播种）：5→8→8→2 MLP
    #if __VERSION__ < 300
      float tanh(float x){ x = clamp(x, -5.0, 5.0); float e = exp(2.0*x); return (e - 1.0) / (e + 1.0); }   // ES1.00（WebGL1 老 GPU）无 tanh 内建 → polyfill；clamp 防 mediump exp 溢出（|x|>5 时 tanh≈±1，视觉无差）。WebGL2 走内建 tanh，此块被预处理跳过 → 现代逐字不变。
    #endif
    float hash(vec3 p){
    #ifdef LOWP_HASH
      p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z);   // mediump-safe：量级压进低值，避免 fract 丢精度致噪声碎裂（仅老 GPU）
    #else
      p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z));      // 原高精度 hash（现代 GPU 路径，逐字不变）
    #endif
    }
    float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
      return mix(mix(mix(hash(i+vec3(0.,0.,0.)),hash(i+vec3(1.,0.,0.)),f.x), mix(hash(i+vec3(0.,1.,0.)),hash(i+vec3(1.,1.,0.)),f.x),f.y),
                 mix(mix(hash(i+vec3(0.,0.,1.)),hash(i+vec3(1.,0.,1.)),f.x), mix(hash(i+vec3(0.,1.,1.)),hash(i+vec3(1.,1.,1.)),f.x),f.y), f.z); }
    float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*noise(p); p=p*2.03+vec3(1.7); a*=0.5; } return s; }
    vec3 pal(float x){                                              // 霓虹循环调色板（品红·青·酸橙·橙·紫），亮度适中 → 背景可读但不撞白点
      vec3 a = vec3(0.42, 0.40, 0.45), b = vec3(0.38, 0.34, 0.36), c = vec3(1.0, 1.0, 1.0), d = vec3(0.0, 0.33, 0.67);
      return a + b * cos(6.28318 * (c * x + d));   // IQ palette：亮度中心 0.42 + 振幅 0.38 → 峰值 ~0.80（背景稍亮、留出星点明亮余量）
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

const U = { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() }, uPulse: { value: 0 }, uMaxPt: { value: MAX_PT } };

const pointMaterial = new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
  vertexShader: `
    uniform float uTime; uniform float uPixelRatio; uniform float uPulse; uniform float uMaxPt;
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
      gl_PointSize = min(sz * breath * (1.0 + uPulse*0.35) * uPixelRatio * (320.0 / -mv.z), uMaxPt);   // 霓虹版：距离缩放 380→320（远距点更小，密集场不糊成片）
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    varying vec3 vColor; varying float vHaze; varying float vDist;
    void main(){
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv) * 2.0; if (d > 1.0) discard;
      float core = smoothstep(0.30, 0.0, d);                                   // 白热核（收紧：0.36→0.30）
      float glow = pow(1.0 - d, 4.5);                                          // 柔光晕（陡衰减 2.6→4.5 + 强度减半）→ 密集场点不糊成光斑
      float ring = smoothstep(0.07, 0.0, abs(d - 0.74)) * 0.4;                 // 极细镜环
      vec2 av = abs(uv) * 2.0;                                                 // 四芒衍射星芒
      float spike = (max(0.0, 1.0 - av.x) * max(0.0, 1.0 - av.y * 11.0) + max(0.0, 1.0 - av.y) * max(0.0, 1.0 - av.x * 11.0)) * 0.3;
      vec3 base = mix(vColor, vec3(dot(vColor, vec3(0.333))), 0.2);            // 略去正色
      // 霓虹版：核不向白靠拢（只提亮到自身色的 1.6×，而非 mix 到 vec3(1.0)）→ 星点保留霓虹色，不被 bloom 烧成白。
      vec3 coreCol = base * 1.6;
      vec3 col = mix(coreCol, base, 1.0 - core) * (core * 1.1 + glow * 0.28 + ring + spike);   // 核提亮(0.9→1.1)更可见；光晕压暗(0.5→0.28)不糊片
      float a = core * 1.05 + glow * (0.22 + 0.25 * vHaze) + ring + spike;     // 光晕 alpha 压低（0.4→0.22）→ 密集叠加不爆白
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

// 几何体棱线加粗（子集）：复用 beam 的屏幕空间 ribbon，但更实（高 alpha + 景深淡出）。只有数据最重要的一小撮棱走这里，
// 其余全部留 1px（零新增）。宽度 = 数据分布(静态) × 呼吸 × beat（每帧调制），移动端硬封顶边数+宽度。
const edgeRibbonMat = new THREE.ShaderMaterial({
  uniforms: { uRes: { value: new THREE.Vector2(innerWidth, innerHeight) }, uOpacity: { value: 0.9 } },
  transparent: true, depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide,
  vertexShader: `
    attribute vec3 aDir; attribute float aSide; attribute vec3 aColor; attribute float aWidth; attribute float aVis;
    uniform vec2 uRes; varying vec3 vC; varying float vVis; varying float vDist;
    void main(){
      vC = aColor; vVis = aVis;
      vec4 mvA = modelViewMatrix * vec4(position, 1.0); vDist = -mvA.z;
      vec4 cA = projectionMatrix * mvA;
      vec4 cB = projectionMatrix * modelViewMatrix * vec4(aDir, 1.0);
      float asp = uRes.x / uRes.y;
      vec2 d = cB.xy / cB.w - cA.xy / cA.w; d.x *= asp;
      float dl = length(d); d = dl > 0.0001 ? d / dl : vec2(1.0, 0.0);
      vec2 perp = vec2(-d.y, d.x); perp.x /= asp;
      cA.xy += perp * aSide * (aWidth / uRes.y) * 2.0 * cA.w;
      gl_Position = cA;
    }`,
  fragmentShader: `varying vec3 vC; varying float vVis; varying float vDist; uniform float uOpacity;
    void main(){ if (vVis < 0.5) discard; float f = clamp((110.0 - vDist)/80.0, 0.22, 1.0); gl_FragColor = vec4(vC, uOpacity*f); }`
});

// 几何体棱线材质：彩色细线 + 景深淡出。NormalBlending（非 Additive）→ 密集几何体聚拢时颜色不叠加烧白，只互相遮挡。
const solidLineMat = new THREE.ShaderMaterial({
  uniforms: { uOpacity: { value: 0.92 } }, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
  vertexShader: `attribute vec3 aColor; varying vec3 vC; varying float vDist;
    void main(){ vC = aColor; vec4 mv = modelViewMatrix*vec4(position,1.0); vDist = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vC; varying float vDist; uniform float uOpacity;
    void main(){ float f = clamp((110.0 - vDist)/80.0, 0.22, 1.0); gl_FragColor = vec4(vC, uOpacity*f); }`
});

// GPU instancing 可用性（几乎所有 WebGL 设备都支持；否则回退到 CPU 合并路径，保证任何设备可开）
const USE_INST = !!(renderer.capabilities.isWebGL2 || (renderer.extensions && renderer.extensions.has && renderer.extensions.has('ANGLE_instanced_arrays')));
// 几何体实例化材质：每实例 pos(3)+quat(4)+scale(3)+color(3)，纯四元数旋转 → 最普适、跨 GPU 稳（无 mat4 属性、少占顶点槽）
const instLineMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.NormalBlending,
  vertexShader: `attribute vec3 iPos; attribute vec4 iQuat; attribute vec3 iScl; attribute vec3 iColor;
    varying vec3 vC; varying float vDist;
    vec3 qrot(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }
    void main(){ vC = iColor; vec3 wp = iPos + qrot(iQuat, position*iScl); vec4 mv = modelViewMatrix*vec4(wp,1.0); vDist = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vC; varying float vDist;
    void main(){ float f = clamp((110.0 - vDist)/80.0, 0.22, 1.0); gl_FragColor = vec4(vC, 0.92*f); }`
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
    // —— 这轮 enrich 的新字段 → 更多元的动态通道 ——
    const humid = e.daily?.meanHumidityPct ?? 50, snow = e.daily?.snowDayCount ?? 0;
    const apparentComfort = e.daily?.apparentComfortDayCount ?? comfort;   // 体感舒适日数（apparentComfortDayCount，333 城有）
    const comfortGap = clamp((apparentComfort - comfort) / 120, -1, 1);    // 体感 vs 日历舒适之差（湿热体感更糟→负）
    const wind = e.daily?.windyDayCount ?? 0, extreme = e.daily?.extremeDayCount ?? 0;
    const aging = e.demographics?.aging65Plus ?? 0.12;
    const histRange = (e.histTempMax != null && e.histTempMin != null) ? (e.histTempMax - e.histTempMin) : 45;
    const builtY = e.builtYear ?? 2000;
    const seismic = ({ '高': 1, '中': 0.55, '低': 0.22 })[e.risk?.seismic] ?? 0.35;
    const P = e.pois || {}; const km = (k) => (P[k] && P[k].distKm != null ? P[k].distKm : null);
    const amen = [km('hospital_tier3'), km('hsr'), km('train'), km('airport'), km('metro'), km('mall'), km('hospital')].filter((x) => x != null);   // 便利设施扩充：地铁/商场/综合医院（metro 92·mall 194·hospital 337 城有）
    const conn = amen.length ? clamp(1 - Math.min(...amen) / 30, 0, 1) : 0.3;             // 便利设施越近→连通度高
    const lulu = ['chemical', 'incinerator', 'landfill', 'nuclear', 'substation', 'wastewater', 'sensitive'].map(km).filter((x) => x != null);
    const nuisance = lulu.length ? clamp(1 - Math.min(...lulu) / 8, 0, 1) : 0;             // 厌恶设施越近→越"紧张"

    const hue = 220 - cf * 162;
    const sat = (0.44 + clamp(tRange / 45, 0, 1) * 0.5) * (1 - clamp(snow / 150, 0, 1) * 0.28);   // 多雪→略去色（雪国发白）
    const light = (0.45 + clamp(sun / 3500, 0, 1) * 0.2) * (outflow < 0 ? 0.78 : 1) * (1 - aging * 0.3) * (1 + comfortGap * 0.08);   // 老龄→略暗；体感比日历更舒适→略亮
    const size = 1.6 + clamp(Math.log10(unit + 1) - 2.2, 0, 3) * 1.7;
    const tw = 0.22 + clamp(burden / 40, 0, 1) * 0.42 + nuisance * 0.34 + seismic * 0.04;   // 灾害 + 厌恶设施邻近 + 地震 → 越发颤动
    const hz = clamp(pm / 85, 0, 1) * 0.62 + clamp(humid / 100, 0, 1) * 0.42;               // 雾霾 + 潮湿 → 雾晕
    const agit = (1 + clamp(extreme / 120, 0, 1) * 0.5 + clamp(wind / 120, 0, 1) * 0.3) * (1 - aging * 0.35);   // 极端/多风→躁动，老龄→沉缓
    const spd = (0.5 + (yld > 0 ? clamp(yld / 0.05, 0, 1) : cf) * 0.8) * agit;              // 钱/宜居 × 气候躁动度
    const b = 0.15 + cf * 0.055 - clamp(histRange / 75, 0, 1) * 0.035;                       // 宜居越多越规整；大陆性极端→更混沌
    // 城市按年均温分三类气候云：冷→Thomas / 温→Sprott-B / 热→Lorenz-84（横向分开）
    const annualMean = months.reduce((a, m2) => a + m2, 0) / months.length;
    cs += annualMean; cn++;
    let csys, canc, cscl, cbh, cseed;
    if (annualMean < 8) { csys = 0; canc = CENTER; cscl = 7; cbh = 0.0025; cseed = [(e.lng - 104) * 0.05, -(e.lat - 35) * 0.05, elev * 0.0006]; }
    else if (annualMean < 18) { canc = CENTER; cscl = 9; cbh = 0.00113; if (sun > 2200) { csys = 14; cseed = [(Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)]; } else { csys = 7; cseed = [(Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5]; } }
    else { csys = 8; canc = CENTER; cscl = 8; cbh = 0.00113; cseed = [(Math.random() - 0.5), 1 + (Math.random() - 0.5), 1 + (Math.random() - 0.5)]; }
    const ctail = 4 + (clamp((Math.log10(unit + 1) - 2.2) / 3, 0, 1) * 0.6 + conn * 0.4) * (TRAIL - 5);   // 越贵 + 越连通(近高铁/机场/医院) → 彗尾越长
    const ci = addStar(csys, canc, cscl, cbh, b, spd, cseed, hue, sat, light, size, tw, hz, {
      id: ls.id,
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
    D.op[ci] = clamp((builtY - 1980) / 60, 0, 1);   // 呼吸/明灭相位 ← 楼龄：同龄楼群同步脉动（涌现时间结构）
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
      id: k.id,
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
      id: p.id,
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
    D.shape[i] = p.maturity === 'high' ? 11 : p.maturity === 'medium' ? 12 : 16;   // 成熟度：高→超立方体(4D) / 中→五胞体(4D) / 低→24-胞体(4D)。霓虹版偏梦幻：去方块，全高维
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
      id: m.id,
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
      id: p.id,
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
    D.shape[pi] = prog ? 14 : p.policy_type === 'fund' ? 11 : 17;   // 纲领→陀螺椭圆环 / 资金→超立方体(4D) / 部委等→3-3多胞柱(4D)。霓虹版偏梦幻：去金字塔
  });

  // 厂商按出身分三种图案：国产→Dadras / 国外→Newton-Leipnik / 开源→Hadley
  const vIdx = {};   // vendor id → 星索引，供 product↔vendor 关系光束
  vendors.forEach((v) => {
    let vsys, vseed, vscl;
    if (v.origin === 'domestic') { vsys = 5; vseed = dd(); vscl = 1.4; }
    else if (v.origin === 'open_source') { vsys = 13; vseed = hd(); vscl = 9; }
    else { vsys = 12; vseed = nl(); vscl = 14; }
    const vi = addStar(vsys, CENTER, vscl, 0.012, 0, 0.4, vseed,
      hueOf(v.origin), 0.4, 0.42, 2.4, 0.4, 0.5, {
      id: v.id,
      kind: 'VENDOR',
      nameZh: v.name_zh,
      nameEn: v.name_en,
      raw: { origin: v.origin, hqCity: v.hq_city || '', hqCountry: v.hq_country || '' },
    }, null, 4);
    vIdx[v.id] = vi;
    const fv = makeFeat(5); setOrigin(fv, v.origin); D.feat[vi] = fv;
    D.shape[vi] = v.origin === 'domestic' ? 14 : v.origin === 'open_source' ? 12 : 13;   // 国产→陀螺椭圆环 / 开源→五胞体(4-单纯形) / 国外→环面纽结
  });

  // 产品→所属厂商关系光束（vendor_id，325/325 全有）→ 让原本孤立的厂商点成为各自产品星座的中枢（冷灰·细，作底层脉络）
  let nPV = 0;
  products.forEach((p) => { if (p.vendor_id && vIdx[p.vendor_id] != null && pIdx[p.id] != null) { BEAM.a.push(pIdx[p.id]); BEAM.b.push(vIdx[p.vendor_id]); BEAM.col.push(0.32, 0.38, 0.42); BEAM.w.push(0.5); nPV++; } });

  pairs.forEach((bp) => { if (pIdx[bp.domestic_id] != null && pIdx[bp.international_id] != null) { BEAM.a.push(pIdx[bp.domestic_id]); BEAM.b.push(pIdx[bp.international_id]); BEAM.col.push(0.2, 0.8, 0.72); BEAM.w.push(1.0); } });

  return { products: products.length, vendors: vendors.length, kernels: kernels.length, milestones: milestones.length, policies: policies.length, pairs: pairs.length, vendorBeams: nPV };
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
  const deepCo = new Set();   // 有站点/产品的"深度"公司 → 几何体；其余"名册"公司 → 发光点（轻量，省性能但仍可见）
  sites.forEach((s) => deepCo.add(s.company_id)); products.forEach((p) => deepCo.add(p.company_id));
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
    const srev = (co && co.revenue && co.revenue.value) || 0, sub = st.is_subsidiary ? 0.7 : 1;   // 子公司站点略暗略小
    const ssz = ((st.site_type === 'HQ' ? 2.0 : 1.2) + clamp((Math.log10(srev + 1) - 8) / 3, 0, 1) * 2.8) * sub;   // 站点大小随母公司营收 + HQ 加成 → 巨头总部=日月
    const i = addStar(0, CENTER, 8, 0.0022, 0.16, 0.5, [(st.lng - 100) * 0.05, -(st.lat - 30) * 0.05, (st.lat) * 0.0006],
      hi, 0.5, (0.5 + conf * 0.18) * sub, ssz, 0.5, clamp(1 - conf, 0, 1),
      { id: st.id, kind: 'PHARMA', nameZh: st.name_zh || st.name_en, nameEn: st.name_en || st.name_zh,
        kwZh: `${st.site_type || ''} · ${st.city || ''} · ${st.country || ''}`.trim(), kwEn: `${st.site_type || ''} · ${st.city || ''} · ${st.country || ''}`.trim() },
      null, 5);
    const fv = makeFeat(6); fv[0] = clamp((st.lat + 60) / 120, 0, 1); fv[1] = clamp((st.lng + 180) / 360, 0, 1); fv[4] = conf; D.feat[i] = fv; D.shape[i] = 0;
  });

  // 公司（128）→ 按 company_type 取一种简单立体（复活退役形）；地区着色；营收→大小
  const CO_SHAPE = { originator_bigpharma: 4, biotech: 2, cdmo_cro: 16, generics: 9, tcm: 14, vaccine: 11, biosimilar: 12, diversified: 10 };   // 霓虹版偏梦幻：CDMO→24-胞体(4D) / 仿制→星状八面体 / 中药→陀螺环 / 疫苗→超立方体(4D) / 生物类似药→五胞体(4D)；原研/生物科技/综合保留数学体
  const num = (x) => (x == null ? 0 : (typeof x === 'object' ? (x.value || 0) : x));
  const ROLE_TW = { subsidiary: 0.55, affiliate: 0.7, 'flagship-listco': 0.22, 'group-holdco': 0.32 };   // 集团角色→明灭：被控股/松散关联的更躁，控股母体/旗舰更沉
  const ROLE_TIER = { 'group-holdco': 1.0, 'flagship-listco': 0.7, subsidiary: 0.45, affiliate: 0.25 };   // 控股层级 → SOM 特征
  companies.forEach((c) => {
    const rev = num(c.revenue), emp = num(c.employees), mcap = num(c.market_cap), rnd = num(c.rnd_spend);
    const magN = clamp((Math.log10(Math.max(rev, mcap * 0.5) + 1) - 8) / 3, 0, 1);   // 量级取营收/市值
    const rndInt = rev > 0 ? clamp(rnd / rev / 0.25, 0, 1) : 0;                        // 研发强度 R&D/营收 → 明灭
    const tierSlow = c.tier === 1 ? 0.55 : c.tier === 2 ? 0.8 : 1;                     // 头部药企更沉缓
    const sz = 1.8 + magN * 2.4;
    const tfN = Array.isArray(c.therapeutic_focus) ? c.therapeutic_focus.length : 0;   // 治疗领域跨度（therapeutic_focus，1801 家有）
    const sat = 0.6 - clamp((tfN - 1) / 6, 0, 1) * 0.2;                                 // 多领域→去色（多元巨头淡雅，专科药企鲜艳）
    const light = (0.5 + (c.is_public ? 0.12 : 0)) * (c.is_subsidiary ? 0.85 : 1);      // 子公司略暗 → 从属感（is_subsidiary，415 家）
    const tw = clamp(0.24 + rndInt * 0.4 + (ROLE_TW[c.group_role] || 0) * 0.45, 0, 1.1); // 研发强度 + 集团控股角色 → 明灭
    const i = addStar(3, CENTER, 15, 0.0032, 18, (0.35 + Math.random() * 0.25) * tierSlow, az(),
      rhue(c.region), sat, light, sz, tw, clamp(1 - (c.confidence ?? 0.8), 0, 1),
      { id: c.id, kind: 'PHARMA', nameZh: c.name_zh || c.name_en, nameEn: c.name_en || c.name_zh,
        kwZh: `${c.hq_city || ''} · ${c.country_display_zh || c.country || ''} · ${rev ? Math.round(rev / 1e8) + ' 亿' : ''}`.replace(/ · $/, ''),
        kwEn: `${c.hq_city || ''} · ${c.country || ''} · ${rev ? '$' + (rev / 1e9).toFixed(1) + 'B' : ''}`.replace(/ · $/, '') },
      null, 5 + magN * (TRAIL - 6));
    pIdx[c.id] = i;
    const fv = makeFeat(6); fv[0] = magN; fv[1] = clamp((Math.log10(emp + 1) - 2) / 4, 0, 1);
    fv[2] = clamp(((c.founded || 1980) - 1900) / 130, 0, 1); fv[3] = c.is_public ? 1 : 0; fv[4] = clamp(c.confidence ?? 0.8, 0, 1); fv[5] = rndInt;
    fv[16] = ROLE_TIER[c.group_role] || 0; fv[17] = clamp(tfN / 6, 0, 1);   // 控股层级 + 治疗领域跨度 → SOM 聚出集团表型（整合 vs 收购型 vs 分散）
    D.feat[i] = fv;
    D.shape[i] = deepCo.has(c.id) ? (CO_SHAPE[c.company_type] || 2) : 0;   // 深度公司=立体，名册公司=发光点（省性能）
  });

  // 产品（219）→ 八面体；按所属公司地区着色；重磅炸弹更大
  products.forEach((p) => {
    const co = coMap[p.company_id], region = (co && co.region) || p.region || 'other';
    const approved = p.approval_status === 'approved';
    const psz = p.is_blockbuster ? 3.0 : approved ? 2.1 : 1.5;   // 重磅 > 已批 > 临床
    const i = addStar(9, CENTER, 0.85, 0.0013, 24, approved ? 0.42 : 0.72, lu(),   // 临床期更躁动快、已批更沉稳
      rhue(region), 0.62, 0.46, psz, approved ? 0.3 : 0.55, 0.25,                    // 临床期明灭更颤
      { id: p.id, kind: 'PHARMA', nameZh: p.name_zh || p.brand_name || p.name_en, nameEn: p.name_en || p.brand_name || p.name_zh,
        kwZh: `${p.modality_id || ''} · ${p.therapeutic_area_id || ''} · ${p.first_approval_year || ''}`.trim(),
        kwEn: `${p.modality_id || ''} · ${p.therapeutic_area_id || ''} · ${p.first_approval_year || ''}`.trim() },
      null, 5 + (p.is_blockbuster ? TRAIL - 6 : 0));
    pIdx[p.id] = i;
    const fv = makeFeat(6); fv[6] = clamp(((p.first_approval_year || 2000) - 1980) / 50, 0, 1); fv[7] = p.is_blockbuster ? 1 : 0; D.feat[i] = fv; D.shape[i] = 2;
  });

  // 药物模态（21）→ 星状八面体（核心平台，内圈）
  modalities.forEach((m) => {
    const i = addStar(1, CENTER, 0.85, 0.0016, 28, 0.45, lz(), 300, 0.55, 0.6, 3.2, 0.45, 0.2,
      { id: m.id, kind: 'PHARMA', nameZh: m.name_zh || m.name_en, nameEn: m.name_en || m.name_zh,
        kwZh: `${m.class || ''}`, kwEn: `${m.class || ''}` }, null, 7);
    const fv = makeFeat(6); fv[5] = 0.8; D.feat[i] = fv; D.shape[i] = 9;
  });

  // 突破（65）→ 四面锥；按所属公司地区着色；年份→彗尾
  milestones.forEach((m) => {
    const co = coMap[m.company_id], region = (co && co.region) || 'other';
    const y4 = clamp(parseInt((m.date || '2015').slice(0, 4)) || 2015, 2000, 2026);
    const i = addStar(6, CENTER, 0.9, 0.0009, 28, 0.4, ch(),
      rhue(region), 0.78, 0.6, 2.6, 0.85, 0.15,
      { id: m.id, kind: 'PHARMA', nameZh: m.headline_zh || m.headline_en, nameEn: m.headline_en || m.headline_zh,
        kwZh: `${y4} · ${m.therapeutic_area_id || ''}`, kwEn: `${y4} · ${m.therapeutic_area_id || ''}` },
      [hash01('pta:' + (m.therapeutic_area_id || 'x')) * 6.283, hash01('pm:' + (m.id || y4)) * 3.14 - 1.57, hash01('pr:' + (m.id || y4)) * 6.283],
      6 + clamp((y4 - 2010) / 16, 0, 1) * (TRAIL - 7));
    const fv = makeFeat(6); fv[6] = clamp((y4 - 1980) / 50, 0, 1); D.feat[i] = fv; D.shape[i] = 3;
  });

  // 对标连线（国产↔国外）：青紫光束
  pairs.forEach((bp) => { if (pIdx[bp.domestic_id] != null && pIdx[bp.international_id] != null) { BEAM.a.push(pIdx[bp.domestic_id]); BEAM.b.push(pIdx[bp.international_id]); BEAM.col.push(0.62, 0.3, 0.7); BEAM.w.push(1.0); } });

  // —— 公司集团/控股关系图谱（新数据：parent_id 控股树 80 边 + group_id 集团归属 35 组）→ 关系光束 ——
  const groupHub = {};   // group_id → 中枢公司 id（优先 group-holdco，其次 flagship-listco，再退任意成员）
  companies.forEach((c) => {
    if (!c.group_id) return;
    const cur = groupHub[c.group_id], curRole = cur ? coMap[cur].group_role : null;
    if (c.group_role === 'group-holdco') groupHub[c.group_id] = c.id;
    else if (c.group_role === 'flagship-listco' && curRole !== 'group-holdco') groupHub[c.group_id] = c.id;
    else if (!cur) groupHub[c.group_id] = c.id;
  });
  const beamSeen = new Set();
  const addRel = (aId, bId, r, g, b, w) => {                            // 去重（同一对只画一条，控股边优先）
    if (aId === bId || pIdx[aId] == null || pIdx[bId] == null) return false;
    const lo = Math.min(pIdx[aId], pIdx[bId]), hi = Math.max(pIdx[aId], pIdx[bId]), k = lo + '|' + hi;
    if (beamSeen.has(k)) return false; beamSeen.add(k);
    BEAM.a.push(pIdx[aId]); BEAM.b.push(pIdx[bId]); BEAM.col.push(r, g, b); BEAM.w.push(w); return true;
  };
  let nOwn = 0, nGrp = 0;
  companies.forEach((c) => {
    if (c.parent_id && addRel(c.id, c.parent_id, 0.95, 0.55, 0.2, 1.2)) nOwn++;                                 // 控股边（暖橙·粗）：子公司→母公司
    const hub = c.group_id && groupHub[c.group_id];
    if (hub && hub !== c.id && addRel(c.id, hub, 0.85, 0.7, 0.32, 0.6)) nGrp++;                                  // 集团归属（柔金·细）：成员→集团中枢
  });

  return { companies: companies.length, sites: sites.length, products: products.length, modalities: modalities.length, milestones: milestones.length, pairs: pairs.length, groups: Object.keys(groupHub).length, rel: nOwn + nGrp };
}

// ---------- 第四数据源：全球收容所猫（shelter-cats）→ 每只猫一颗按真实毛色着色的星，按收容所地理播种成簇，暖光束连回各自收容所（星座式归属）----------
async function buildShelterCats() {
  const j = (p) => fetch(CATS_DATA + p).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const manifest = await j('manifest.json');
  if (!manifest) return { shelters: 0, cats: 0 };
  const [shData, enData, ...shardRes] = await Promise.all([
    j('shelters.json'), j('enums.json'),
    ...((manifest.shards || []).map((s) => j(s.file)))
  ]);
  const shelters = (shData && (shData.shelters || shData)) || [];
  const enums = enData || {};
  const cats = shardRes.flatMap((d) => (d && (d.cats || d)) || []);
  if (!shelters.length) return { shelters: 0, cats: 0 };

  const enLab = (grp, k, zh) => { const e = enums[grp] && enums[grp][k]; return (e && (zh ? e.zh : e.en)) || k || ''; };
  const colHexOf = (k) => (enums.colors && enums.colors[k] && enums.colors[k].hex) || '';
  const _cc = new THREE.Color(), _hsl = {};
  const coatHSL = (hex) => {                                   // 毛色 hex → HSL；抬亮去黑（加性混合下纯黑/极暗不可见），保留色相身份
    if (!hex) return [40, 0.4, 0.55];
    _cc.set(hex); _cc.getHSL(_hsl);
    return [_hsl.h * 360, clamp(_hsl.s * 0.7 + 0.25, 0.2, 0.85), clamp(_hsl.l * 0.5 + 0.42, 0.42, 0.72)];
  };
  const shById = {}; shelters.forEach((s) => { shById[s.id] = s; });
  const geoSeed = (s) => [(s.lng - 100) * 0.05, -(s.lat - 30) * 0.05, (s.lat) * 0.0006];   // 经纬度播种 Thomas（与医药站点同坐标系 → 同被全球混沌卷入）
  const catCount = {}; cats.forEach((c) => { catCount[c.shelter_id] = (catCount[c.shelter_id] || 0) + 1; });
  const rnd = () => Math.random() - 0.5;

  const shIdx = {};
  // 收容所（5）→ 暖琥珀星状八面体（一颗"家"的引导星）；尺寸随在册猫数（封顶 ≤4.5 → 不拉高 solidMax 致其他立体被归一化缩小）
  shelters.forEach((s) => {
    const n = catCount[s.id] || 0, gs = geoSeed(s);
    const sz = 3.2 + clamp(n / 60, 0, 1) * 1.3;
    const loc = `${s.city || ''}${s.state ? ' ' + s.state : ''}`;
    const i = addStar(0, CENTER, 7, 0.0018, 0.16, 0.2, gs, 38, 0.6, 0.6, sz, 0.35, 0.18,
      { id: s.id, kind: 'SHELTER', nameZh: s.name, nameEn: s.name,
        kwZh: `${loc} · ${s.country || ''} · ${n} 只猫`.replace(/^ · | · $/g, '').trim(),
        kwEn: `${loc} · ${s.country || ''} · ${n} cats`.replace(/^ · | · $/g, '').trim() },
      null, 8);
    shIdx[s.id] = i;
    const fv = makeFeat(7); fv[7] = clamp((s.lat + 60) / 120, 0, 1); fv[8] = clamp((s.lng + 180) / 360, 0, 1); fv[5] = clamp(n / 80, 0, 1); D.feat[i] = fv; D.shape[i] = 9;
  });

  // 猫（244）→ 按真实毛色着色的发光点；播种在所属收容所附近 → 5 个地理猫簇；可领养更亮更颤（在向你呼唤），长毛更朦胧，越老存在感越大
  const AGEN = { kitten: 0, young: 0.33, adult: 0.66, senior: 1 }, COATN = { short: 0, medium: 0.5, long: 1 }, SIZEN = { small: 0, medium: 0.5, large: 1 };
  cats.forEach((c) => {
    const sh = shById[c.shelter_id]; if (!sh) return;
    const gs = geoSeed(sh);
    const seed = [gs[0] + rnd() * 0.9, gs[1] + rnd() * 0.9, gs[2] + rnd() * 0.4];   // 收容所附近抖动 → 同所猫成簇
    const primary = (c.colors && c.colors[0]) || '';
    const [h, s, l] = coatHSL(colHexOf(primary));
    const adoptable = c.status === 'adoptable';
    const ageN = AGEN[c.age_bucket] != null ? AGEN[c.age_bucket] : 0.5;
    const sz = 1.6 + ageN * 1.0 + (adoptable ? 0.4 : 0);
    const tw = adoptable ? 0.7 : 0.3;                          // 可领养 → 更闪烁（呼唤领养）
    const hz = 0.15 + (COATN[c.coat_length] || 0) * 0.4;       // 长毛 → 更朦胧绒晕
    const loc = `${sh.city || ''}${sh.state ? ' ' + sh.state : ''}`;
    const i = addStar(0, CENTER, 6.5, 0.0018, 0.16, 0.42, seed, h, s, l, sz, tw, hz,
      { id: c.id, kind: 'CAT', nameZh: c.name || '猫', nameEn: c.name || 'Cat',
        kwZh: [enLab('colors', primary, 1), enLab('patterns', c.pattern, 1), enLab('age_bucket', c.age_bucket, 1), loc, enLab('status', c.status, 1)].filter(Boolean).join(' · '),
        kwEn: [enLab('colors', primary, 0), enLab('patterns', c.pattern, 0), enLab('age_bucket', c.age_bucket, 0), loc, enLab('status', c.status, 0)].filter(Boolean).join(' · ') },
      null, 5);
    const fv = makeFeat(7);
    fv[0] = ageN; fv[1] = c.sex === 'male' ? 1 : c.sex === 'female' ? 0 : 0.5; fv[2] = COATN[c.coat_length] || 0;
    fv[3] = SIZEN[c.size] != null ? SIZEN[c.size] : 0.5; fv[4] = adoptable ? 1 : 0;
    fv[7] = clamp((sh.lat + 60) / 120, 0, 1); fv[8] = clamp((sh.lng + 180) / 360, 0, 1); fv[9] = c.spayed_neutered ? 1 : 0;
    D.feat[i] = fv; D.shape[i] = 0;
    if (shIdx[c.shelter_id] != null) { BEAM.a.push(shIdx[c.shelter_id]); BEAM.b.push(i); BEAM.col.push(0.85, 0.55, 0.3); BEAM.w.push(0.6); }   // 暖光束：每只猫连回收容所 → 星座式归属
  });

  return { shelters: shelters.length, cats: cats.length };
}

// ---------- typed state (filled after build) ----------
let N = 0;
let sys, anc, scl, bh, prm, spd, state, posArr, trail, trailSrc, rotM, head = 0;
let pointsObj, trailObj, beamObj, beamIdxA, beamIdxB, beamPos, edgeRibObj, edgeRib = null;
let grp, segsG, pointVisArr, pointVisAttr, trailVisArr, trailVisAttr, beamVisArr, beamVisAttr, beamEnds;
let E = 0, emEnt, emLocal, entMat;   // 轨迹发射点：每个立体的每个顶点各一条
let featM = null, latticeObj = null, shapeArr = null, szCurve = null;   // SOM 特征矩阵 · 神经晶格 · 每星几何体形 id · 尺寸曲线[0,1]
const SZ_GAMMA = 2.2;   // 尺寸幂曲线：>1 → 多数微小、少数巨大（群星 + 日月大行星）
let prevPos = null;   // 上一帧世界位置 → 算速度方向（棱柱以运动方向为自转轴）
let visArr = null, cwArr = null, trOff = null;   // 视锥剔除 + 每实体到相机的距离（cw）→ 投影尺寸 LOD；trOff=连续离屏采样数（拖尾重入迟滞，消除边缘闪烁）
let gOrg = 0, breathT = 0, bPhase = null, bRate = null;   // 全局呼吸量(供晶格) + 相位累加器；bPhase/bRate=每实体(按 cluster)的呼吸相位偏移与速率 → 错峰 + 各异速
let somReady = false, bAmp = 0, bProg = 0;   // SOM 就绪前 bAmp=0（纯重叠混沌、不呼吸不展开）；就绪后从 0 平滑 ramp 到 1 → 随机运动态与神经地图态连续衔接（无瞬变跳位）。bProg=线性进度，bAmp=其 smootherstep 缓动（首尾更柔）
const BREATH_RAMP = 12;           // bAmp 0→1 的 ramp 时长(秒)：SOM 完成后呼气展开的揭示节奏。3.5→12 + ease，让展开慢慢来、更平缓
let audioCtx = null, audioTone = null, _aggTick = 0;   // 音乐：用户手势内创建的 AudioContext；每星音高种子(色相 0..1)；视野聚合节流计数
let musicDNA = null;                                    // 这片宇宙的涌现态→乐曲身份（buildSOM 后算；替代随机种子，每次开页 SOM 不同→DNA 不同→曲不同）
let clusterOf = null, clusterHue = null, clusterEnergy = null, somM = 0, clusterVote = null, clusterAnc = null;   // 每实体所属 SOM 簇 + 每簇色相/能量 + 簇数 + 视野投票（主导可见簇→实时旋律色）+ 每簇世界锚点（神经元固定坐标，供微弱空间声像投影）
const viewAgg = { n: 0, dom: 0, toneAvg: 0.5, szAvg: 0.3, clHue: 0.5, clEnergy: 0.3, domCluster: -1, counts: new Int32Array(8) };   // 视野内实体聚合 → 喂给音乐引擎（gaze + 主导可见簇 决定听到什么）；domCluster = 当前主导可见 SOM 簇索引（供空间声像投影）
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
  const mk = (edges, ellipsoid, spin, velAxis, cornerCap) => ({ edges: new Float32Array(edges), corners: dedup(edges, cornerCap || 99), ellipsoid: !!ellipsoid, spin, velAxis: !!velAxis });   // 默认取全部顶点 → 每个节点都拖尾；曲线类传小 cap
  // nD 形（4/5/6 维）：存 D 维顶点 + 棱 + 投影距 wdist + 自转基速 spin4；运行时逐帧 nD 旋转→透视投影到 3D（真·高维运动）
  const projND0 = (v, dim, wd) => { const c = v.slice(); for (let d = dim - 1; d >= 3; d--) { const k = wd / (wd - c[d]); for (let m = 0; m < d; m++) c[m] *= k; } return [c[0], c[1], c[2]]; };   // angle-0 投影（建静态棱/corners）
  const makeND = (V, E, dim, wd, spin4) => {
    const v3 = V.map((v) => projND0(v, dim, wd)), edges = [];
    for (const [u, v] of E) edges.push(v3[u][0], v3[u][1], v3[u][2], v3[v][0], v3[v][1], v3[v][2]);
    const verts4 = new Float32Array(V.length * dim); V.forEach((v, i) => { for (let k = 0; k < dim; k++) verts4[i * dim + k] = v[k]; });
    const edgeIdx = new Int16Array(E.length * 2); E.forEach((e, i) => { edgeIdx[i * 2] = e[0]; edgeIdx[i * 2 + 1] = e[1]; });
    return { edges: new Float32Array(edges), corners: dedup(edges, 99), ellipsoid: false, spin: 0.05, velAxis: false, is4d: true, verts4, edgeIdx, n4: V.length, ne: E.length, wdist: wd, spin4, dim };   // corners=全部顶点 → 每个节点都拖尾
  };
  const hcube = (dim, s) => { const V = [], E = [], N = 1 << dim;                                    // n-立方体：2^dim 顶点、Hamming=1 相邻 → dim·2^(dim-1) 棱
    for (let m = 0; m < N; m++) { const v = []; for (let k = 0; k < dim; k++) v.push(((m >> k) & 1) ? s : -s); V.push(v); }
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { let df = 0, x = i ^ j; while (x) { df += x & 1; x >>= 1; } if (df === 1) E.push([i, j]); } return { V, E }; };
  const autoEdgesND = (V, dim, tol) => { let mn = Infinity;                                          // 连接最短等长棱（正多胞体）
    const dist = (a, b) => { let s = 0; for (let k = 0; k < dim; k++) { const d = a[k] - b[k]; s += d * d; } return Math.sqrt(s); };
    for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) { const d = dist(V[i], V[j]); if (d < mn) mn = d; }
    const E = []; for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) if (Math.abs(dist(V[i], V[j]) - mn) < mn * (tol || 0.06)) E.push([i, j]); return E; };
  const tesseract4 = () => { const h = hcube(4, 0.5); return makeND(h.V, h.E, 4, 2.4, 0.34); };       // 8-胞体 16顶/32棱 · 霓虹版 spin4 0.16→0.34（更激进、更频繁的内外翻转）
  const fiveCell4 = () => { const r2 = Math.SQRT2, r6 = Math.sqrt(6), r12 = Math.sqrt(12), r20 = Math.sqrt(20), s = 0.72;
    const V = [[1 / r2, 1 / r6, 1 / r12, 1 / r20], [-1 / r2, 1 / r6, 1 / r12, 1 / r20], [0, -2 / r6, 1 / r12, 1 / r20], [0, 0, -3 / r12, 1 / r20], [0, 0, 0, -4 / r20]].map((p) => p.map((c) => c * s));
    const E = []; for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) E.push([i, j]); return makeND(V, E, 4, 2.0, 0.42); };   // 5-胞体（4-单纯形）K5 · spin4 0.22→0.42
  const cell16 = () => { const s = 0.72, V = []; for (let ax = 0; ax < 4; ax++) for (const sgn of [s, -s]) { const v = [0, 0, 0, 0]; v[ax] = sgn; V.push(v); }   // 16-胞体（4-正轴体）±e_i 8顶
    const E = []; for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) { let anti = true; for (let k = 0; k < 4; k++) if (V[i][k] !== -V[j][k]) anti = false; if (!anti) E.push([i, j]); } return makeND(V, E, 4, 2.2, 0.38); };   // 非对极相连 → 24棱 · spin4 0.2→0.38
  const cell24 = () => { const s = 0.5, V = [], pr = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];   // 24-胞体：(±1,±1,0,0) 全排列 24顶（唯一无三维对应）
    for (const [a, b] of pr) for (const sa of [s, -s]) for (const sb of [s, -s]) { const v = [0, 0, 0, 0]; v[a] = sa; v[b] = sb; V.push(v); }
    return makeND(V, autoEdgesND(V, 4, 0.06), 4, 2.4, 0.34); };   // 96棱 · spin4 0.18→0.34
  const duo33 = () => { const r = 0.5, T = 6.2831853, V = [], E = [];                                  // 3-3 多胞柱：三角×三角 9顶/18棱
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) V.push([r * Math.cos(i / 3 * T), r * Math.sin(i / 3 * T), r * Math.cos(j / 3 * T), r * Math.sin(j / 3 * T)]);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let j2 = j + 1; j2 < 3; j2++) E.push([i * 3 + j, i * 3 + j2]);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) for (let i2 = i + 1; i2 < 3; i2++) E.push([i * 3 + j, i2 * 3 + j]);
    return makeND(V, E, 4, 2.0, 0.38); };   // spin4 0.2→0.38
  const octaPrism = () => { const s = 0.62, wp = 0.45, oct = [], V = [];                               // 八面体棱柱：八面体×线段 12顶/30棱
    for (let ax = 0; ax < 3; ax++) for (const sgn of [s, -s]) { const v = [0, 0, 0]; v[ax] = sgn; oct.push(v); }
    const octE = autoEdgesND(oct, 3, 0.06);
    oct.forEach((v) => V.push([v[0], v[1], v[2], -wp])); oct.forEach((v) => V.push([v[0], v[1], v[2], wp]));
    const E = []; octE.forEach(([a, b]) => { E.push([a, b]); E.push([a + 6, b + 6]); }); for (let i = 0; i < 6; i++) E.push([i, i + 6]);
    return makeND(V, E, 4, 2.2, 0.38); };   // spin4 0.2→0.38
  const penteract = () => { const h = hcube(5, 0.42); return makeND(h.V, h.E, 5, 2.6, 0.30); };       // 5-立方体 32顶/80棱 · spin4 0.14→0.30
  const cube6 = () => { const h = hcube(6, 0.4); return makeND(h.V, h.E, 6, 2.8, 0.26); };            // 6-立方体 64顶/192棱 · spin4 0.12→0.26
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
  S[13] = mk(knot(2, 3, 56, 0.24), 0, 0.5, 0, 8);                                                     // 环面纽结 trefoil（曲线 → 8 点采样拖尾）
  S[14] = mk(ring(), 1, 0.7, 0, 8);                                                                   // 陀螺椭圆环（曲线 → 8 点采样拖尾）
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
const _vp = new THREE.Matrix4();   // view-projection（用于视锥剔除测试）
const _v3tmp = new Float32Array(64 * 3), _localDyn = new Float32Array(192 * 6), _cN = new Float32Array(6);   // nD 投影暂存（≤64 顶点 / ≤192 棱 / ≤6 维）
// 把 D 维顶点按角 a 旋转（数个 4D 平面）再逐维透视塌缩到 3D，存入 _v3tmp
function projectND(verts, n4, dim, wd, a) {
  // 霓虹版：次级旋转面速率提高（0.62→0.83、0.41→0.57）→ 多平面相位差更大 → 高维体形变更激进、更不规则、更梦幻。
  const c0 = Math.cos(a), s0 = Math.sin(a), c1 = Math.cos(a * 0.83), s1 = Math.sin(a * 0.83), c2 = Math.cos(a * 0.57), s2 = Math.sin(a * 0.57);
  for (let i = 0; i < n4; i++) {
    for (let k = 0; k < dim; k++) _cN[k] = verts[i * dim + k];
    { const x = _cN[0], w = _cN[dim - 1]; _cN[0] = x * c0 - w * s0; _cN[dim - 1] = x * s0 + w * c0; }       // 绕 (0, dim-1) 面
    { const y = _cN[1], w = _cN[dim - 1]; _cN[1] = y * c1 - w * s1; _cN[dim - 1] = y * s1 + w * c1; }       // 绕 (1, dim-1) 面
    if (dim >= 5) { const z = _cN[2], w = _cN[dim - 2]; _cN[2] = z * c2 - w * s2; _cN[dim - 2] = z * s2 + w * c2; }   // 5D+ 多一个旋转面
    for (let d = dim - 1; d >= 3; d--) { const k = wd / (wd - _cN[d]); for (let m = 0; m < d; m++) _cN[m] *= k; }     // 逐维透视塌缩到 3D
    _v3tmp[i * 3] = _cN[0]; _v3tmp[i * 3 + 1] = _cN[1]; _v3tmp[i * 3 + 2] = _cN[2];
  }
}
const GROUP_KEY = { CITY: 0, PRODUCT: 1, KERNEL: 2, BREAKTHROUGH: 3, POLICY: 4, VENDOR: 5, PHARMA: 6, CAT: 7, SHELTER: 7 };
const groupVis = [true, true, true, true, true, true, true, true];   // [7] = 收容所猫层（猫 + 收容所共用一个开关）

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
  for (let w = 0; w < 180; w++) for (let i = 0; i < N; i++) { const h = Math.min(bh[i] * spd[i], capOf(sys[i])); stepOne(i, h * 0.5); stepOne(i, h * 0.5); }   // 首屏前预展开吸引子；280→180 省时（混沌轨道几十步即铺开，云团仍是展开态）

  // initial world positions
  bPhase = new Float32Array(N); bRate = new Float32Array(N).fill(1);   // 呼吸相位偏移(默认0)+速率(默认1)：必须在首次 writeWorld 前分配；buildSOM 后按 cluster 数据填充（finalize 期默认=旧全局行为）
  for (let i = 0; i < N; i++) writeWorld(i);
  prevPos = Float32Array.from(posArr);   // 速度方向初值
  visArr = new Uint8Array(N).fill(1); cwArr = new Float32Array(N).fill(50); trOff = new Uint16Array(N);   // 视锥可见性 + 距离 + 离屏采样计数

  // group id per point (for show/hide toggles)
  grp = Uint8Array.from(D.meta.map((m) => (m && GROUP_KEY[m.kind] != null ? GROUP_KEY[m.kind] : 0)));
  shapeArr = new Uint8Array(N); for (let i = 0; i < N; i++) shapeArr[i] = D.shape[i] || 0;   // 每星几何体形 id
  // 尺寸曲线：发光点 / 几何体各按自身全局最大值归一化（连续量级·长尾的超群者→巨星），过幂曲线 → 群星 + 日月大行星，皆由数据决定
  { let pointMax = 1e-3, solidMax = 1e-3;
    for (let i = 0; i < N; i++) { if (shapeArr[i] === 0) { if (D.sz[i] > pointMax) pointMax = D.sz[i]; } else if (D.sz[i] > solidMax) solidMax = D.sz[i]; }
    szCurve = new Float32Array(N);
    for (let i = 0; i < N; i++) szCurve[i] = Math.pow(clamp(D.sz[i] / (shapeArr[i] === 0 ? pointMax : solidMax), 0, 1), SZ_GAMMA); }

  // 每星音高种子：颜色色相(0..1) → 音乐里映射到音阶级（"听见颜色"，与视觉数据编码一致）
  audioTone = new Float32Array(N);
  { const _ac = new THREE.Color(), _ah = {};
    for (let i = 0; i < N; i++) { _ac.setRGB(D.col[i * 3], D.col[i * 3 + 1], D.col[i * 3 + 2]); _ac.getHSL(_ah); audioTone[i] = _ah.h; } }

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

  // trail emitters: 每个实体只用「约一半」顶点发轨迹（数据驱动选哪些）→ 砍掉多余拖尾线（尤其高维多胞体 16~64 顶点的密簇）、减弱边缘闪烁、更省
  const emE = [], emL = [], emC = [], emT = [];
  for (let i = 0; i < N; i++) {
    const c = cornersOf(shapeArr[i]), cc = c.length / 3;
    let sel = null;
    if (cc > 2) {                                                  // 多顶点几何体抽稀（点/退化体保留全部）
      const sig = szCurve ? szCurve[i] : 0.5;                       // 数据量级(size)=「显著度」→ 越显著拖尾顶点越多（35%~70%，均值~½）：把数据编进拖尾密度
      const keep = Math.max(2, Math.round(cc * clamp(0.35 + sig * 0.35, 0.35, 0.7)));
      const off = (hash01('tv:' + i + ':' + sys[i] + ':' + Math.round((spd[i] || 0) * 97)) * cc) | 0;   // 「哪些顶点」由数据(系统/速度/身份)播种的偏移决定 → 抽象但确定
      sel = new Set();
      for (let j = 0; j < keep; j++) sel.add((Math.round(j * cc / keep) + off) % cc);   // 均匀抽 keep 个，整体绕几何体分布、不偏一侧
    }
    for (let q = 0; q < cc; q++) {
      if (sel && !sel.has(q)) continue;                            // 未入选顶点 → 不发轨迹
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

  // —— 几何体棱线加粗（子集）：把数据最重要(szCurve×复杂度)的 3D 形体的棱重画成可变宽 ribbon；其余全部留 1px（零新增）。
  //    仅 3D 形体（4D 逐帧 morph，静态棱会与之错位 → 排除，保 4D 的 1px morphing 棱）。移动端硬封顶边数 + 宽度。
  {
    const CAP = IS_MOBILE ? 120 : 320, MAXW = IS_MOBILE ? 2.2 : 3.6;
    const scored = [];
    for (let i = 0; i < N; i++) {
      const sid = shapeArr[i], sh = sid ? SHAPES[sid] : null;
      if (!sh || sh.is4d || !sh.edges || sh.edges.length < 6) continue;
      scored.push([i, (szCurve ? szCurve[i] : 0.5) * (1 + sh.edges.length / 6 * 0.02)]);   // 数据量级 × 复杂度(棱数)
    }
    scored.sort((a, b) => b[1] - a[1]);
    const rib = [];   // {gi, sid, o(边在 edges 起始下标), baseW, phase}
    for (let s = 0; s < scored.length && rib.length < CAP; s++) {
      const gi = scored[s][0], sid = shapeArr[gi], sh = SHAPES[sid], ne = sh.edges.length / 6;
      const bw = 0.7 + (szCurve ? clamp(szCurve[gi], 0, 1) : 0.5) * (MAXW - 0.7);
      for (let e = 0; e < ne && rib.length < CAP; e++) rib.push({ gi, sid, o: e * 6, baseW: bw, phase: hash01('rw' + gi + '_' + e) * 6.2831 });
    }
    if (rib.length) {
      const K = rib.length, V = K * 6;
      const rpos = new Float32Array(V * 3), rdir = new Float32Array(V * 3);
      const rside = new Float32Array(V), rcol = new Float32Array(V * 3), rwid = new Float32Array(V), rvis = new Float32Array(V).fill(1);
      for (let i = 0; i < K; i++) {
        const c = rib[i].gi * 3;
        for (let v = 0; v < 6; v++) { const idx = i * 6 + v;
          rside[idx] = beamSideTmpl[v]; rwid[idx] = rib[i].baseW;
          rcol[idx * 3] = D.col[c]; rcol[idx * 3 + 1] = D.col[c + 1]; rcol[idx * 3 + 2] = D.col[c + 2]; }
      }
      const rg = new THREE.BufferGeometry();
      const rposA = new THREE.BufferAttribute(rpos, 3).setUsage(THREE.DynamicDrawUsage);
      const rdirA = new THREE.BufferAttribute(rdir, 3).setUsage(THREE.DynamicDrawUsage);
      const rwidA = new THREE.BufferAttribute(rwid, 1).setUsage(THREE.DynamicDrawUsage);
      const rvisA = new THREE.BufferAttribute(rvis, 1).setUsage(THREE.DynamicDrawUsage);
      rg.setAttribute('position', rposA); rg.setAttribute('aDir', rdirA); rg.setAttribute('aSide', new THREE.BufferAttribute(rside, 1));
      rg.setAttribute('aColor', new THREE.BufferAttribute(rcol, 3)); rg.setAttribute('aWidth', rwidA); rg.setAttribute('aVis', rvisA);
      edgeRibObj = new THREE.Mesh(rg, edgeRibbonMat); edgeRibObj.frustumCulled = false; root.add(edgeRibObj);
      edgeRibObj.userData = { posA: rposA, dirA: rdirA, widA: rwidA, visA: rvisA, pos: rpos, dir: rdir, wid: rwid, vis: rvis };
      edgeRib = rib;
    }
  }
}

function writeWorld(i) {
  const o = i * 3, sy = sys[i], r = i * 9;
  const bph = breathT * bRate[i] + bPhase[i], boR = 0.5 - 0.5 * Math.cos(bph), g = boR * boR * (3 - 2 * boR) * bAmp;   // 每实体呼吸量：全局时间×个体速率 + 个体相位 → 簇间错峰、簇内相干、速率各异；× bAmp：SOM 就绪前=0(纯重叠混沌)→就绪后平滑长出，与随机运动态连续
  const s = scl[i] * (1 - (1 - SHRINK) * g);                  // 呼气铺开 → 混沌缩小
  const sc = sy * 3;                                          // 有效锚点：本族吸气归位中心(散布) ⇄ SOM 语义坐标
  const ax = SYS_CTR[sc] + (anc[o] - SYS_CTR[sc]) * g;
  const ay = SYS_CTR[sc + 1] + (anc[o + 1] - SYS_CTR[sc + 1]) * g;
  const az = SYS_CTR[sc + 2] + (anc[o + 2] - SYS_CTR[sc + 2]) * g;
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
// SOM 训练(W 权重 + 每星 BMU 分配)的 Worker 源：纯数学、不碰 DOM/THREE → 搬出主线程，训练期间 animate 照常跑混沌运动、零卡顿
const SOM_WORKER_SRC = `self.onmessage=function(e){
var F=e.data.featM,N=e.data.N,d=e.data.d,M=e.data.M,Lx=e.data.Lx,Ly=e.data.Ly,Lz=e.data.Lz,EP=e.data.epochs,TN=e.data.trainN,sigma0=e.data.sigma0;
var W=new Float32Array(M*d);
for(var n=0;n<M;n++){var r=(Math.random()*N)|0;W.set(F.subarray(r*d,r*d+d),n*d);}
var nx=function(q){return q%Lx;},ny=function(q){return ((q/Lx)|0)%Ly;},nz=function(q){return (q/(Lx*Ly))|0;};
var order=new Int32Array(N);for(var i=0;i<N;i++)order[i]=i;
var total=EP*TN,it=0;
for(var ep=0;ep<EP;ep++){
  for(var a=N-1;a>0;a--){var b=(Math.random()*(a+1))|0,t=order[a];order[a]=order[b];order[b]=t;}
  for(var s=0;s<TN;s++){
    var xi=order[s]*d,frac=it++/total;
    var alpha=0.5*Math.exp(-frac*3),sigma=sigma0*Math.exp(-frac*3),inv2s2=1/(2*sigma*sigma);
    var bmu=0,best=Infinity;
    for(var n2=0;n2<M;n2++){var wo=n2*d,acc=0;for(var k=0;k<d;k++){var er=F[xi+k]-W[wo+k];acc+=er*er;if(acc>=best)break;}if(acc<best){best=acc;bmu=n2;}}
    var bx=nx(bmu),by=ny(bmu),bz=nz(bmu),rad=Math.max(1,Math.ceil(sigma));
    for(var iz=Math.max(0,bz-rad);iz<=Math.min(Lz-1,bz+rad);iz++)
      for(var iy=Math.max(0,by-rad);iy<=Math.min(Ly-1,by+rad);iy++)
        for(var ix=Math.max(0,bx-rad);ix<=Math.min(Lx-1,bx+rad);ix++){
          var dd=(ix-bx)*(ix-bx)+(iy-by)*(iy-by)+(iz-bz)*(iz-bz);
          var h=alpha*Math.exp(-dd*inv2s2);if(h<1e-3)continue;
          var wo2=(ix+Lx*(iy+Ly*iz))*d;
          for(var k2=0;k2<d;k2++)W[wo2+k2]+=h*(F[xi+k2]-W[wo2+k2]);
        }
  }
}
var density=new Float32Array(M),bmuOf=new Int32Array(N);
for(var p=0;p<N;p++){var px=p*d,pb=0,pbest=Infinity;
  for(var n3=0;n3<M;n3++){var wo3=n3*d,acc2=0;for(var k3=0;k3<d;k3++){var er2=F[px+k3]-W[wo3+k3];acc2+=er2*er2;}if(acc2<pbest){pbest=acc2;pb=n3;}}
  density[pb]++;bmuOf[p]=pb;}
self.postMessage({W:W,bmuOf:bmuOf,density:density},[W.buffer,bmuOf.buffer,density.buffer]);
};`;

// 后处理（主线程，廉价 ~N+M：锚点/呼吸/clusterHue/musicDNA/晶格）——用 Worker(或兜底) 返回的 W/bmuOf/density，不含重训练
function somFinish(W, bmuOf, density) {
  const Lx = SOM_L[0], Ly = SOM_L[1], Lz = SOM_L[2], M = Lx * Ly * Lz, d = FEAT_DIM;
  const nx = (n) => n % Lx, ny = (n) => ((n / Lx) | 0) % Ly, nz = (n) => (n / (Lx * Ly)) | 0;
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
  const nSpd = new Float32Array(M), nCnt = new Float32Array(M);     // bmuOf 已由 worker 给出 → 这里只写锚点/相位、累计速度（无 BMU 搜索）
  clusterAnc = new Float32Array(M * 3);                             // 每簇（=神经元）固定世界锚点，供微弱空间声像投影（同簇成员的 anc 恒等，取一次即可）
  for (let i = 0; i < N; i++) {
    const bmu = bmuOf[i]; nSpd[bmu] += spd[i]; nCnt[bmu]++;
    const w = nodeWorld(nx(bmu), ny(bmu), nz(bmu)); anc[i * 3] = w[0]; anc[i * 3 + 1] = w[1]; anc[i * 3 + 2] = w[2];
    const bo = bmu * 3; clusterAnc[bo] = w[0]; clusterAnc[bo + 1] = w[1]; clusterAnc[bo + 2] = w[2];
    bPhase[i] = hash01('bp' + bmu) * TAU;                                  // 每神经元(=cluster)一个相位 → 簇间错峰、簇内同步
  }
  for (let i = 0; i < N; i++) { const bmu = bmuOf[i], avg = nCnt[bmu] ? nSpd[bmu] / nCnt[bmu] : 0.5;
    bRate[i] = clamp(0.5 + avg * 0.8, 0.5, 1.6); }                         // 呼吸速率 = 该 cluster 内几何体的平均(吸引子)速度 → 每簇一速、由数据定（速率各异→持续错峰、永不重新同步）
  let maxD = 1; for (let n = 0; n < M; n++) if (density[n] > maxD) maxD = density[n];

  // ---- 音乐 DNA：把这片宇宙的「涌现态」编码成乐曲身份（替代随机种子）。每次开页 SOM 自组织不同 → DNA 不同 → 乐曲不同，且与所见相关 ----
  somM = M; clusterOf = bmuOf; clusterVote = new Int32Array(M);
  clusterHue = new Float32Array(M); clusterEnergy = new Float32Array(M);
  { const hx = new Float32Array(M), hy = new Float32Array(M);                              // 每簇色相 = 成员色相的圆均值；能量 = 簇内平均(吸引子)速度
    for (let i = 0; i < N; i++) { const b = bmuOf[i], a = (audioTone ? audioTone[i] : 0.5) * TAU; hx[b] += Math.cos(a); hy[b] += Math.sin(a); }
    for (let n = 0; n < M; n++) { clusterHue[n] = (Math.atan2(hy[n], hx[n]) / TAU + 1) % 1; clusterEnergy[n] = nCnt[n] ? clamp((nSpd[n] / nCnt[n]) / 0.6, 0, 1) : 0.3; } }
  { let dStar = 0; for (let n = 0; n < M; n++) if (density[n] > density[dStar]) dStar = n;   // 最密簇 = 宇宙最大的自组织主题
    let populated = 0, sumD = 0; for (let n = 0; n < M; n++) { if (density[n] > 0) populated++; sumD += density[n]; }
    const meanD = sumD / Math.max(1, populated), concentration = clamp((density[dStar] / Math.max(1, meanD)) / 6, 0, 1);   // 峰/均 → 组织集中度
    let cs = 0, ccnt = 0; for (let n = 0; n < M; n++) if (nCnt[n] > 0) { cs += nSpd[n] / nCnt[n]; ccnt++; }
    const csMean = ccnt ? cs / ccnt : 0.5; let csVar = 0; for (let n = 0; n < M; n++) if (nCnt[n] > 0) { const v = nSpd[n] / nCnt[n] - csMean; csVar += v * v; }
    const speedSpread = clamp(Math.sqrt(ccnt ? csVar / ccnt : 0) / 0.4, 0, 1);
    const wStar = dStar * d, motif = []; for (let k = 0; k < 8; k++) motif.push(Math.floor(clamp(W[wStar + k], 0, 0.999) * 5));   // 最密簇学习原型(前8特征) → 动机轮廓
    let domType = 0; for (let k = 1; k < 8; k++) if (W[wStar + 20 + k] > W[wStar + 20 + domType]) domType = k;                   // 最密簇主导类型(one-hot 20..27)
    let h = 2166136261 >>> 0; const mix = (x) => { h = (h ^ ((Math.round(x * 100003) >>> 0))) >>> 0; h = Math.imul(h, 16777619) >>> 0; };   // 涌现签名：整片密度图+簇速+主题 的确定性 hash
    mix(climWarm); mix(concentration); mix(populated / M); mix(csMean); mix(speedSpread); mix(clusterHue[dStar]);
    for (let k = 0; k < 8; k++) mix(motif[k]); for (let n = 0; n < M; n++) mix(density[n] / maxD);
    musicDNA = { warm: climWarm, hueStar: clusterHue[dStar], concentration, populatedFrac: populated / M, speedMean: clamp(csMean / 0.6, 0, 1), speedSpread, domType, motif, sig: h >>> 0, clusters: populated };
  }

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

// 主线程同步训练兜底（无 Worker / Worker 失败时）：W 训练 + 全量 BMU 分配 → {W,bmuOf,density}
function somTrainSync() {
  const Lx = SOM_L[0], Ly = SOM_L[1], Lz = SOM_L[2], M = Lx * Ly * Lz, d = FEAT_DIM;
  const W = new Float32Array(M * d);
  for (let n = 0; n < M; n++) { const r = (Math.random() * N) | 0; W.set(featM.subarray(r * d, r * d + d), n * d); }
  const nx = (n) => n % Lx, ny = (n) => ((n / Lx) | 0) % Ly, nz = (n) => (n / (Lx * Ly)) | 0;
  const order = new Int32Array(N); for (let i = 0; i < N; i++) order[i] = i;
  const TRAIN_N = Math.min(N, 2800), sigma0 = Math.max(Lx, Ly, Lz) * 0.5, total = SOM_EPOCHS * TRAIN_N; let it = 0;
  for (let ep = 0; ep < SOM_EPOCHS; ep++) {
    for (let a = N - 1; a > 0; a--) { const b = (Math.random() * (a + 1)) | 0, t = order[a]; order[a] = order[b]; order[b] = t; }
    for (let s = 0; s < TRAIN_N; s++) {
      const xi = order[s] * d, frac = it++ / total;
      const alpha = 0.5 * Math.exp(-frac * 3), sigma = sigma0 * Math.exp(-frac * 3), inv2s2 = 1 / (2 * sigma * sigma);
      let bmu = 0, best = Infinity;
      for (let n = 0; n < M; n++) { const wo = n * d; let acc = 0; for (let k = 0; k < d; k++) { const e = featM[xi + k] - W[wo + k]; acc += e * e; if (acc >= best) break; } if (acc < best) { best = acc; bmu = n; } }
      const bx = nx(bmu), by = ny(bmu), bz = nz(bmu), rad = Math.max(1, Math.ceil(sigma));
      for (let iz = Math.max(0, bz - rad); iz <= Math.min(Lz - 1, bz + rad); iz++)
        for (let iy = Math.max(0, by - rad); iy <= Math.min(Ly - 1, by + rad); iy++)
          for (let ix = Math.max(0, bx - rad); ix <= Math.min(Lx - 1, bx + rad); ix++) {
            const dist2 = (ix - bx) * (ix - bx) + (iy - by) * (iy - by) + (iz - bz) * (iz - bz);
            const h = alpha * Math.exp(-dist2 * inv2s2); if (h < 1e-3) continue;
            const wo = (ix + Lx * (iy + Ly * iz)) * d;
            for (let k = 0; k < d; k++) W[wo + k] += h * (featM[xi + k] - W[wo + k]);
          }
    }
  }
  const density = new Float32Array(M), bmuOf = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    const xi = i * d; let bmu = 0, best = Infinity;
    for (let n = 0; n < M; n++) { const wo = n * d; let acc = 0; for (let k = 0; k < d; k++) { const e = featM[xi + k] - W[wo + k]; acc += e * e; } if (acc < best) { best = acc; bmu = n; } }
    density[bmu]++; bmuOf[i] = bmu;
  }
  return { W, bmuOf, density };
}

// 异步训练 SOM：优先 Worker（训练期间主线程动画不冻、星体保持自由运动）→ 完成回主线程做廉价后处理。Worker 不可用/失败 → 同步兜底
function buildSOM(onDone) {
  const done = (r) => { if (onDone) onDone(r); };
  if (!N || !featM) { done(null); return; }
  const Lx = SOM_L[0], Ly = SOM_L[1], Lz = SOM_L[2], M = Lx * Ly * Lz, d = FEAT_DIM;
  const TRAIN_N = Math.min(N, 2800), sigma0 = Math.max(Lx, Ly, Lz) * 0.5;
  const fallback = () => { const r = somTrainSync(); done(somFinish(r.W, r.bmuOf, r.density)); };
  if (typeof Worker === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) { fallback(); return; }
  try {
    const fm = featM.slice();                                              // 拷贝一份给 worker transfer（主线程保留 featM 供兜底）
    const url = URL.createObjectURL(new Blob([SOM_WORKER_SRC], { type: 'text/javascript' }));
    const w = new Worker(url);
    let settled = false;
    w.onmessage = (e) => { if (settled) return; settled = true; w.terminate(); URL.revokeObjectURL(url); done(somFinish(e.data.W, e.data.bmuOf, e.data.density)); };
    w.onerror = () => { if (settled) return; settled = true; w.terminate(); URL.revokeObjectURL(url); fallback(); };
    w.postMessage({ featM: fm, N, d, M, Lx, Ly, Lz, epochs: SOM_EPOCHS, trainN: TRAIN_N, sigma0 }, [fm.buffer]);
  } catch (_) { fallback(); }
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
// 视角追踪：点击一颗星 → 锁定它，相机连贯地飞过去、绕它转（拖动/陀螺=绕它转）；点空白 → 连贯退回正中心
const ORBIT_R = 8;
let focusIdx = -1, focusActive = false;
const _starSmooth = new THREE.Vector3(), _desPos = new THREE.Vector3(), _lookTmp = new THREE.Vector3(), _starNow = new THREE.Vector3();
const _camCur = new THREE.Vector3().copy(camPos), _lookCur = new THREE.Vector3(camPos.x, camPos.y, camPos.z + 1);
const _camFrom = new THREE.Vector3(), _lookFrom = new THREE.Vector3();   // 切换瞬间的相机/视向快照（缓入过渡起点）
let focusOnset = -1;                                                     // ≥0 = 正在做「切换缓入」过渡(秒)；-1 = 稳态
const TRANS = 0.62;                                                      // 缓入时长：smoothstep ease-in-out → 有参与感的引导式推镜、不突兀
const smoothstep01 = (x) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
// 由 pick handler 调用：记录本次切换的起点位姿并起跳缓入过渡（进焦/换焦/退焦通用）。
function beginFocusTransition() { _camFrom.copy(camera.position); _lookFrom.copy(_lookCur); focusOnset = 0; }
function applyLook(dt) {
  fwd.set(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw));
  const k = 1 - Math.exp(-dt / 0.20);   // 稳态临界阻尼跟随：时间常数 ~200ms（较旧 110ms 更柔）→ 跟踪连贯、不甩镜
  const trans = focusOnset >= 0 && focusOnset < TRANS;
  const s = trans ? smoothstep01(focusOnset / TRANS) : 1;               // ease-in-out：起步慢(引导)→中段快→收尾稳(不过冲)
  if (focusActive && focusIdx >= 0 && posArr) {
    const o = focusIdx * 3;
    _starSmooth.lerp(_starNow.set(posArr[o], posArr[o + 1], posArr[o + 2]), Math.min(1, dt * 4));   // 平滑跟踪目标（不追混沌瞬抖）
    const r = ORBIT_R + (szCurve ? szCurve[focusIdx] * 6 : 0);                          // 越大的目标，环绕半径越远
    _desPos.copy(_starSmooth).addScaledVector(fwd, -r);                                 // 近端环绕：相机在星的「视向后方」R 处 → 看向 +视向(=星)，不翻面
    if (trans) { _camCur.copy(_camFrom).lerp(_desPos, s); _lookCur.copy(_lookFrom).lerp(_starSmooth, s); }   // 缓入：从点击瞬间位姿 smoothstep 滑向环绕位姿
    else { _camCur.lerp(_desPos, k); _lookCur.lerp(_starSmooth, k); }                   // 稳态跟随
  } else {
    _lookTmp.copy(camPos).add(fwd);
    if (trans) { _camCur.copy(_camFrom).lerp(camPos, s); _lookCur.copy(_lookFrom).lerp(_lookTmp, s); }       // 退焦也缓入：平滑滑回中心视角
    else {
      _camCur.lerp(camPos, k);                                                          // 连贯退回中心
      if (_camCur.distanceToSquared(camPos) < 0.04) {                                   // 已归位 → 自由视角即时跟手（拖动无延迟）
        _camCur.copy(camPos); _lookCur.copy(_lookTmp);
        if (focusIdx >= 0) focusIdx = -1;
      } else {
        _lookCur.lerp(_lookTmp, k);                                                     // 退出过程中平滑看向
      }
    }
  }
  if (trans) { focusOnset += dt; if (focusOnset >= TRANS) focusOnset = -1; }            // 过渡计时 → 到点自动交回稳态跟随（速度在收尾→0，衔接无缝）
  camera.position.copy(_camCur);
  camera.lookAt(_lookCur);
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
    if (pinchPrev) { introZoom = false; camera.fov = clamp(camera.fov - (d - pinchPrev) * 0.10, 10, 125); camera.updateProjectionMatrix(); }   // 焦距范围：10~125（强长焦 + 广视角）；手动缩放取消开场动画
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
  introZoom = false;                                            // 手动滚轮取消开场缓慢拉远
  camera.fov = clamp(camera.fov + e.deltaY * 0.045, 10, 125);   // 焦距范围：10~125；步长 0.045 让范围好达到
  camera.updateProjectionMatrix();
}, { passive: false });
// 陀螺仪：以「增量」驱动 → 与手指拖动叠加共存、互不覆盖；避开绝对罗盘坐标导致的方向混乱
const GYRO_DZ = 0.25;                                         // 软死区阈值（度）：过滤传感器微抖（加大 → 手抖更不易触动镜头）
const GYRO_GAIN = 0.3;                                        // 陀螺→视角增益（<1 = 松散「非精确指引」；调小 → 镜头随陀螺移动更缓、更温和）
const GYRO_SMOOTH = 4.5;                                      // 速度低通强度（越小越平滑/越滞、越大越跟手；TC≈1/GYRO_SMOOTH s）→ 调小=加重阻尼，转头/手抖被更厚地平滑
const GYRO_MAX_STEP = 0.018;                                  // 单帧最大转角（弧度）限幅：快速转头或手抖也不会让镜头骤然翻转/跳跃
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

// ---------- 声音 / 律动 双模式 ----------
// 默认（进入页面）：自动播放由「视觉/SOM 涌现态」生成的音乐(sonifier)，不开麦克风 → 即「通过视觉生成音频」。
// 按下方按钮 → 「俱乐部律动」模式：音乐停、打开麦克风，画面随环境声(uPulse)脉冲式加速；再按一次切回音乐。
let muted = false, audioKicked = false;

// iOS Safari / Chrome@Android：AudioContext 必须「在用户手势的同步调用栈内」被创建 + 首次发声，
// 仅 resume() 一个 boot 阶段无手势创建的 suspended ctx 在手机上几乎必然静音。
// 策略：boot 时不创建 ctx；首个手势的同步栈内按 iOS 要求的顺序解锁 →
//   ① 在手势内 new AudioContext  ② 立刻播一段与 ctx 同采样率的(略长)静音 buffer 开声道
//   ③ ctx.resume()  ④ sonifier.start。resume 是异步的，故静音 buffer 必须先于 resume 播放。
// —— iOS 静音键逃逸：纯 AudioContext 在 iOS 上默认走 ambient 会话类别 → 跟随静音键被掐；
//    静音键本应只管通知、不该掐媒体。iOS 17+ 的官方修法（WebKit 维护者 bug 237322 确认）：
//    把 W3C Audio Session 类型设为 'playback' → Web Audio 无视静音键。设 type 不需要手势。
//    ⚠️ 关键教训：不要再依赖 window.webkitAudioContext 做 iOS 探测（新 Safari 可能已不暴露该别名，
//       之前那个 `&& !!webkitAudioContext` 让整个提升在 iOS 26 上被跳过 → 静音键照样掐）。
//    ⚠️ 也不要再用"静音 <audio> 促会话升级"那套老技巧：在新 iOS 上已失效（播 ~1s 即停），且会把会话
//       类别顶回 ambient、反而打断上面的 playback。故它只在完全没有 audioSession 的老 iOS(<16.4) 兜底。
const _isIosLike = /iP(hone|ad|od)/.test(navigator.platform) ||
  (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) {}   // boot 时先设一次
let _silentEl = null, _silentUrl = null;
function _makeDitherWavUrl(sr, frames) {                    // 极短 8-bit 单声道 dither WAV（127/129 交替）；仅老 iOS 兜底用
  const buf = new ArrayBuffer(44 + frames), dv = new DataView(buf); let p = 0;
  const u32 = (v) => { dv.setUint32(p, v, true); p += 4; }, u16 = (v) => { dv.setUint16(p, v, true); p += 2; };
  const str = (s) => { for (let i = 0; i < s.length; i++) dv.setUint8(p++, s.charCodeAt(i)); };
  str('RIFF'); u32(36 + frames); str('WAVE'); str('fmt '); u32(16); u16(1); u16(1); u32(sr); u32(sr); u16(1); u16(8); str('data'); u32(frames);
  for (let i = 0; i < frames; i++) dv.setUint8(p++, (i & 1) ? 129 : 127);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function promoteAudioSession() {                            // 每个手势里再设一次（会话类型可能被系统/其它音频重置）
  try {
    if (navigator.audioSession) { navigator.audioSession.type = 'playback'; return; }   // (A) iOS 17+：唯一可靠，成功即返回，绝不碰静音元素
  } catch (_) {}
  if (!_isIosLike || _silentEl) return;                    // (B) 仅无 audioSession 的老 iOS(<16.4) 才退回静音元素兜底
  try {
    _silentUrl = _makeDitherWavUrl(44100, 1024);
    const el = document.createElement('audio');
    el.loop = true; el.preload = 'auto'; el.volume = 1;
    el.setAttribute('playsinline', ''); el.setAttribute('webkit-playsinline', '');
    el.src = _silentUrl; document.body.appendChild(el); _silentEl = el;
    const pr = el.play(); if (pr && pr.catch) pr.catch(() => {});
  } catch (_) {}
}
function ensureCtx() {
  if (audioCtx) return audioCtx;
  // 优先复用 index.html 里 parse-time inline script 已经在 #ep-enter 点击手势内建好的 ctx
  // （window.__abyssAudio.ctx，见该文件注释）——避免二次 new AudioContext，也避免丢掉那次手势解锁的效果。
  if (window.__abyssAudio && window.__abyssAudio.ctx) {
    audioCtx = window.__abyssAudio.ctx; audioCtx._tries = audioCtx._tries || 0;
    return audioCtx;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { audioCtx = new AC(); audioCtx._tries = 0; }
  } catch (_) {}
  return audioCtx;
}
function recreateCtx() {                                    // 僵死 ctx 兜底：close 旧的、在同一手势内重建（手势内建的 ctx 直接 running）
  const old = audioCtx;
  try { old && old.removeEventListener('statechange', onAudioStateChange); } catch (_) {}
  try { old && old.state !== 'closed' && old.close(); } catch (_) {}   // fire-and-forget
  audioCtx = null;
  if (window.__abyssAudio && window.__abyssAudio.ctx === old) window.__abyssAudio.ctx = null;   // 清掉过期引用：避免 ensureCtx() 又把刚 close 的僵死 ctx 复用回来
  return ensureCtx();
}

// iOS/Safari 专用：在手势同步栈内播一段静音 buffer 才能真正打通声道。用 ctx 自身采样率、稍长（~50ms）更稳。
// 只要 ctx 还没 running 就每次手势重播一次静音源：iOS 某些版本要求每次 resume 前都有一次真实发声，
// 且首个手势创建的 ctx 若当时不是有效激活会僵死——重播静音源是最便宜的"每次有效手势都再试一次解锁"。
function primeAudioUnlock() {
  const ctx = audioCtx;
  if (!ctx || ctx.state === 'running') return;
  try {
    const len = Math.max(1, Math.floor(0.05 * ctx.sampleRate));   // ~50ms 静音，与 ctx 同采样率
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
  } catch (_) {}
}

function startMusic() {                                   // 提升会话 → 解锁 → resume → 僵死兜底 → 起 sonifier；幂等
  try {
    promoteAudioSession();                                // ① 手势内最先：iOS 会话提升（越过静音开关）
    let ctx = ensureCtx();                                // ② 手势内建/取 ctx
    if (!ctx) return;
    if (ctx.state === 'suspended' && (ctx._tries || 0) >= 2) {   // 前几次手势 resume 都没顶到 running（僵死）→ 本手势重建
      ctx = recreateCtx(); if (sonifier) sonifier.started = false;   // 强制在新 ctx 上重建音频图（旧 ctx 已 close，图已死）
      if (!ctx) return;
    }
    if (!ctx._abListen) { ctx._abListen = true; ctx.addEventListener('statechange', onAudioStateChange); }
    primeAudioUnlock();                                   // ③ 早于 resume：iOS 需在 resume(异步) 完成前有一次真实发声
    if (ctx.state !== 'running' && ctx.resume) {          // ④ resume（计数供僵死兜底判定）
      ctx._tries = (ctx._tries || 0) + 1;
      const p = ctx.resume(); if (p && p.then) p.then(onAudioStateChange, () => {});
    }
    sonifier.start(ctx, musicDNA || { climWarm });        // sonifier.start 幂等（内部 if(this.started) return）
    sonifier.setMuted(muted);
  } catch (_) {}
}

function updateModeBtn() {                                // 按钮文案反映当前模式（默认=播放）
  const btn = document.getElementById('enable');
  if (btn) btn.textContent = sensorBtnLabel(muted);
}

// 自动播放：浏览器 Autoplay Policy 硬约束 — 无 user gesture 时 AudioContext 必然 suspended、不出声。
// 策略：不在 boot 时创建 ctx（避免手机上制造无法发声的 suspended ctx）；boot 后只把 tip-text 提示亮起来，
// 首个 pointerdown/touchstart/click 的同步栈内 kickAudio() 解锁+起声。
function refreshAudioState() {
  if (!audioCtx) return 'pending';
  if (audioCtx.state === 'running') { sonifier.setMuted(muted); return 'running'; }
  if (audioCtx.state === 'closed') return 'denied';
  return 'pending';   // 'suspended'
}

function updateTipText(state) {                          // 底部 #tip-text：未出声时引导点一下；出声后清空
  const el = document.getElementById('tip-text');
  if (!el) return;
  el.textContent = state === 'running' ? '' : (isZh() ? '点按屏幕任意处开启声音' : 'tap anywhere to enable sound');
}

function onAudioStateChange() {
  const state = refreshAudioState();
  updateTipText(state);
  if (state === 'running') { audioKicked = true; document.body.classList.add('audio-on'); updateModeBtn(); updateMicBtn(); }
}

function kickAudio() {                                   // 首个手势内（点任意几何体/屏幕/按键都算）：解锁+起声（幂等）
  if (audioKicked) return;
  startMusic();          // 手势同步栈内：new ctx → 静音 buffer 解锁 → resume → start sonifier（iOS 必需的顺序）
  onAudioStateChange();
}
// 只挂「手势结束/离散激活」事件：touchend / click / pointerup / keydown。
// iOS/WebKit 只把这些当作有效 user-activation；touchstart/pointerdown/mousedown 是手势"开始"，
// 在 iOS 上不算激活——若在它们里 new AudioContext 会造出一个永久 suspended 的僵死 ctx，之后任何有效手势都救不回来（Mac Chrome 宽松故无此问题）。
// audioKicked 幂等，running 后全部 no-op。
['touchend', 'click', 'pointerup', 'keydown'].forEach((ev) => addEventListener(ev, kickAudio, { passive: true }));
// 页面从后台切回前台：移动端浏览器常把 AudioContext 自动 suspend；电话/Siri 会置 interrupted。回来后 resume；
// iOS 上顺带补一次会话提升（静音元素可能在打断中被释放）。
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (audioKicked) promoteAudioSession();   // 回前台重设 playback 会话类型（可能被系统/其它 app 重置回 ambient）
  if (audioCtx && (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted')) { try { audioCtx.resume(); } catch (_) {} }
});

function toggleMode() {                                   // 下方按钮：播放 ⇄ 静音（纯生成音乐；静音态另有独立的 mic 按钮，见下方小节）
  if (!audioKicked) { startMusic(); onAudioStateChange(); return; }   // 首次点：先解锁音频
  muted = !muted;
  if (!muted && micActive) disableMic();                  // 重新开声 → 让位回生成音乐的 beatPulse，停采+释放麦克风
  sonifier.setMuted(muted);
  updateModeBtn();
  updateMicBtn();
  // 按钮显隐由 CSS hover 接管（body.audio-on #enable）：点完鼠标仍悬停 → 保持可见，移开自然淡隐；不再用 JS 操作内联 opacity（会盖过 CSS）。
}
document.getElementById('enable').addEventListener('click', toggleMode);
updateModeBtn();

// ---------- 静音态 mic 驱动："带上你自己的 DJ" ----------
// 仅在「声音已静音 且 已过光敏警示门」时可用：把 pulse（原本由生成音乐引擎的 beatPulse 驱动、进而驱动
// bloom 脉冲/星体加速/相机微震/strobe 的那个单一变量）换成房间里真实声音源（用户自己的 DJ set / 音箱）的
// 振幅包络 + onset 检测。绝不碰 Sonifier 内部/音乐参数——mic 只是 pulse 的另一个数据源。
let micAnalyser = null, micBuf = null, micStream = null, micActive = false, micDenied = false;
let micEnvAvg = 0, micOnset = false, micPulseVal = 0;      // micBuf 每帧复用，零分配
const micBtn = document.getElementById('mic-enable');

function updateMicBtn() {                                 // 仅静音态 + 已过癫痫门时可见；mic 开时文案变"停用"（toggle 语义）
  if (!micBtn) return;
  const show = gateConfirmed && audioKicked && muted;
  micBtn.classList.toggle('mic-hidden', !show);
  micBtn.textContent = micActive
    ? (isZh() ? '停用麦克风 · Stop mic' : 'Stop mic · 停用麦克风')
    : (isZh() ? '用麦克风驱动 · Use mic' : 'Use mic · 用麦克风驱动');
  const lbl = micActive
    ? (isZh() ? '停用麦克风驱动画面' : 'Stop driving visuals with your microphone')
    : (isZh() ? '用麦克风驱动画面' : 'Drive visuals with your microphone');
  micBtn.setAttribute('aria-label', lbl); micBtn.title = lbl;   // a11y：aria-label/title 跟随 toggle 状态与语言（AGENTS.md §4.3）
}

async function enableMic() {                              // 打开麦克风分析节点（不接 destination → 无回授/无回声）；被拒/不可用 → 静默回退慢脉冲
  if (micActive) return;
  try {
    try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch (_) {}   // iOS：mic 录音需要 'play-and-record'（音乐已静音，输出路由无所谓）
    const ctx = ensureCtx();
    if (!ctx) throw new Error('no audio context');
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false } });
    const an = ctx.createAnalyser(); an.fftSize = 512;
    ctx.createMediaStreamSource(micStream).connect(an);
    micAnalyser = an; micBuf = new Uint8Array(an.frequencyBinCount);
    micEnvAvg = 0; micOnset = false; micPulseVal = 0; micActive = true; micDenied = false;
  } catch (_) {                                            // 拒绝/不可用 → 双语提示一次，不刷 console，回退到静音态原本的慢脉冲衰减
    micActive = false;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (__) {}
    if (!micDenied) {
      micDenied = true;
      const el = document.getElementById('tip-text');
      if (el) el.textContent = isZh() ? '麦克风权限被拒绝或不可用' : 'microphone access denied or unavailable';
    }
  }
  updateMicBtn();
}

function disableMic() {                                   // 停采所有轨 + 断开分析节点 + 释放引用（关闭系统麦克风指示灯，隐私；无泄漏）
  micActive = false;
  if (micStream) { try { micStream.getTracks().forEach((tr) => tr.stop()); } catch (_) {} micStream = null; }
  micAnalyser = null; micBuf = null; micEnvAvg = 0; micOnset = false; micPulseVal = 0;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) {}   // iOS：恢复只输出会话
  updateMicBtn();
}

async function toggleMic() {                              // 次级按钮：开 ⇄ 关（toggle，不影响主「声音」按钮/Sonifier）
  if (micActive) { disableMic(); return; }
  await enableMic();
}
if (micBtn) micBtn.addEventListener('click', toggleMic);
// 注：此处不在模块顶层立即调用 updateMicBtn() —— 它读 gateConfirmed，而该 let 声明在文件更下方的
// 「光敏性警示门」小节，此刻还在 TDZ 内。初始隐藏态已由 index.html 里 button 的 mic-hidden 默认 class
// 保证；真正的显隐刷新交给 onAudioStateChange / confirmGate / toggleMode / 语言切换等运行时回调触发。

// 每帧调用：振幅包络(EMA，复用 micBuf 零分配) 驱动基线脉冲；相对滚动均值的能量突变 = onset，专供 strobe 触发。
function updateMicPulse() {
  if (!micActive || !micAnalyser) { micOnset = false; return micPulseVal * 0.9; }
  micAnalyser.getByteFrequencyData(micBuf);
  let s = 0; for (let i = 0; i < micBuf.length; i++) s += micBuf[i];
  const energy = s / micBuf.length / 255;                 // 0..1 频域平均能量
  micOnset = energy > micEnvAvg * 1.6 + 0.05 && energy > 0.12;   // 相对滚动均值突变 + 绝对底噪门槛（防静默环境误触发）
  micEnvAvg = micEnvAvg * 0.92 + energy * 0.08;            // 慢速滚动均值，仅供 onset 相对判定
  micPulseVal = micOnset ? 1 : Math.max(energy * 1.4, micPulseVal * 0.82);   // 包络驱动基线 + onset 瞬时顶到 1
  return Math.min(micPulseVal, 1);
}

// ---------- 焦点详情探查：实时显示 id + 定义轨迹的微分方程 + 当前公式参数 + 每个参数所映射的数据；实体名降为角落小字 ----------
// 每个吸引子的 ODE（与 stepOne 完全一致）；dv = 进入方程且数据可驱动的参数符号（仅 Thomas/Lorenz/Rössler），其余常数固定
const ATTRACTORS = {
  0: { n: 'Thomas', dv: 'b', ode: ['ẋ = sin y − b·x', 'ẏ = sin z − b·y', 'ż = sin x − b·z'] },
  1: { n: 'Lorenz', dv: 'ρ', ode: ['ẋ = 10(y − x)', 'ẏ = x(ρ − z) − y', 'ż = xy − 8⁄3·z'] },
  2: { n: 'Rössler', dv: 'c', ode: ['ẋ = −(y + z)', 'ẏ = x + 0.2y', 'ż = 0.2 + z(x − c)'] },
  3: { n: 'Aizawa', ode: ['ẋ = (z−0.7)x − 3.5y', 'ẏ = 3.5x + (z−0.7)y', 'ż = 0.6+0.95z − z³⁄3 − (x²+y²)(1+0.25z) + 0.1z·x³'] },
  4: { n: 'Halvorsen', ode: ['ẋ = −1.4x − 4y − 4z − y²', 'ẏ = −1.4y − 4z − 4x − z²', 'ż = −1.4z − 4x − 4y − x²'] },
  5: { n: 'Dadras', ode: ['ẋ = y − 3x + 2.7yz', 'ẏ = 1.7y − xz + z', 'ż = 2xy − 9z'] },
  6: { n: 'Chen', ode: ['ẋ = 35(y − x)', 'ẏ = −7x − xz + 28y', 'ż = xy − 3z'] },
  7: { n: 'Sprott-B', ode: ['ẋ = yz', 'ẏ = x − y', 'ż = 1 − xy'] },
  8: { n: 'Lorenz-84', ode: ['ẋ = −0.25x − y² − z² + 2', 'ẏ = −y + xy − 4xz + 1', 'ż = −z + 4xy + xz'] },
  9: { n: 'Lü', ode: ['ẋ = 36(y − x)', 'ẏ = −xz + 20y', 'ż = xy − 3z'] },
  10: { n: 'Nosé–Hoover', ode: ['ẋ = y', 'ẏ = −x + yz', 'ż = 1 − y²'] },
  11: { n: 'Sprott-Linz F', ode: ['ẋ = y + z', 'ẏ = −x + 0.5y', 'ż = x² − z'] },
  12: { n: 'Newton–Leipnik', ode: ['ẋ = −0.4x + y + 10yz', 'ẏ = −x − 0.4y + 5xz', 'ż = 0.175z − 5xy'] },
  13: { n: 'Hadley', ode: ['ẋ = −y² − z² − 0.2x + 1.6', 'ẏ = xy − 4xz − y + 1', 'ż = 4xy + xz − z'] },
  14: { n: 'Sprott-E', ode: ['ẋ = yz', 'ẏ = x² − y', 'ż = 1 − 4x'] },
};
// 数据→通道编码语法（每实体型固定）：[通道id, 中文数据源, 英文数据源]
const ENC = {
  city: [['eq', '宜居度 − 大陆性温差', 'livability − continental range'], ['speed', '钱(收益/宜居)×气候躁动(极端/多风)×老龄', 'money × climate agitation × aging'], ['scale', '气候带(冷/温/热)选吸引子族', 'climate zone picks attractor family'], ['size', '房价 ¥/㎡', 'housing price /m²'], ['hue', '宜居天数(冷蓝→热红)', 'livable days'], ['tw', '灾害+厌恶设施邻近+地震', 'hazards + LULU proximity + seismic'], ['hz', 'PM2.5 + 湿度', 'PM2.5 + humidity'], ['trail', '房价 + 便利连通度', 'price + amenity connectivity']],
  ind_kernel: [['eq', '固定常数', 'fixed constant'], ['size', '被产品使用数', '# products using it'], ['hue', '出身(国产/开源/国外)', 'origin'], ['beam', '→ 使用它的产品', '→ products using it']],
  ind_product: [['hue', '出身', 'origin'], ['size', '成熟度', 'maturity'], ['speed', '成熟度(越熟越稳)', 'maturity (mature=calmer)'], ['hz', '本地化深度', 'localization depth'], ['trail', '置信度', 'confidence'], ['beam', '→ 所用内核 / 国外对标', '→ kernel / intl benchmark']],
  ind_milestone: [['hue', '替代在位产品数', '# incumbents displaced'], ['size', '证据级别(审计/案例)', 'evidence level'], ['speed', '年份', 'year'], ['beam', '→ 被替代的在位产品', '→ displaced incumbents']],
  ind_policy: [['hue', '政策类型', 'policy type'], ['size', '目标数值量级', 'target magnitude'], ['scale', '纲领/规划 vs 资金·部委', 'program vs funding']],
  ind_vendor: [['hue', '出身', 'origin'], ['scale', '出身定吸引子', 'origin sets attractor'], ['beam', '→ 旗下产品(vendor_id)', '→ its products']],
  ph_site: [['eq', '固定 b', 'fixed b'], ['hue', '所属公司地区', 'parent company region'], ['size', '母公司营收 + HQ加成', 'parent revenue + HQ bonus'], ['hz', '置信度(低→雾)', 'confidence (low→hazy)'], ['ic', '经纬度播种', 'lat/lng seeded']],
  ph_company: [['hue', '地区', 'region'], ['size', '营收/市值量级', 'revenue/market-cap'], ['sat', '治疗领域跨度(多→淡)', 'therapeutic breadth'], ['light', '上市 + 是否子公司', 'public + subsidiary'], ['tw', '研发强度 + 集团控股角色', 'R&D intensity + group role'], ['speed', '梯队(头部更慢)', 'tier'], ['beam', '→ 母公司(parent_id) + 集团中枢(group_id)', '→ parent + group hub']],
  ph_product: [['hue', '地区', 'region'], ['size', '重磅/已批/临床', 'blockbuster/approved/clinical'], ['speed', '审批状态(临床更躁)', 'approval status'], ['trail', '重磅炸弹', 'blockbuster']],
  ph_modality: [['eq', '固定 ρ', 'fixed ρ'], ['size', '固定(核心平台)', 'fixed (core platform)']],
  ph_milestone: [['hue', '地区', 'region'], ['trail', '年份', 'year']],
  cat: [['hue', '真实毛色', 'actual coat color'], ['size', '年龄(幼→老)', 'age'], ['tw', '可领养→更闪', 'adoptable→twinkles'], ['hz', '毛长(长毛朦胧)', 'coat length'], ['ic', '所属收容所地理', 'shelter geo'], ['beam', '→ 所属收容所', '→ its shelter']],
  shelter: [['hue', '暖琥珀(家)', 'warm amber (home)'], ['size', '在册猫数', '# cats housed'], ['ic', '经纬度', 'lat/lng'], ['beam', '→ 旗下的猫', '→ its cats']],
};
function encKeyOf(kind, s) {
  switch (kind) {
    case 'CITY': return 'city'; case 'KERNEL': return 'ind_kernel'; case 'PRODUCT': return 'ind_product';
    case 'BREAKTHROUGH': return 'ind_milestone'; case 'POLICY': return 'ind_policy'; case 'VENDOR': return 'ind_vendor';
    case 'CAT': return 'cat'; case 'SHELTER': return 'shelter';
    case 'PHARMA': return s === 0 ? 'ph_site' : s === 3 ? 'ph_company' : s === 9 ? 'ph_product' : s === 1 ? 'ph_modality' : s === 6 ? 'ph_milestone' : 'ph_company';
    default: return null;
  }
}
const CHAN_LABEL = { dt: 'Δt', speed: 'speed', scale: 'scale', size: 'size', hue: 'hue', sat: 'sat', light: 'light', tw: 'twinkle', hz: 'haze', trail: 'trail', ic: 'init·cond', beam: 'beams' };
const _hsl2 = {};
function chanVal(id, i) {   // 通道当前值：从 typed arrays 实时取
  switch (id) {
    case 'eq': return prm[i].toFixed(2);
    case 'speed': return spd[i].toFixed(2);
    case 'scale': return scl[i].toFixed(1);
    case 'size': return (szCurve ? szCurve[i] : 0).toFixed(2);
    case 'hue': case 'sat': case 'light': {
      tmpCol.setRGB(D.col[i * 3], D.col[i * 3 + 1], D.col[i * 3 + 2]); tmpCol.getHSL(_hsl2);
      return id === 'hue' ? Math.round(_hsl2.h * 360) + '°' : (id === 'sat' ? _hsl2.s : _hsl2.l).toFixed(2);
    }
    case 'tw': return D.tw[i].toFixed(2);
    case 'hz': return D.hz[i].toFixed(2);
    case 'trail': return (D.tlen[i] || 0).toFixed(0);
    default: return '';
  }
}
// 「此刻在演奏什么」诗句：把选中实体的真实数据事实与正在发声的东西相连（斜体低亮小字）。
// 纯文案 + 随机挑一句（UI 瞬时层，Math.random 允许）；禁工程词，只留真实事实 + 乐感词 + 天文隐喻。
function nowPlayingLine(m, zh) {
  const r = m.raw || {};
  const nm = (zh ? (m.nameZh || m.nameEn) : (m.nameEn || m.nameZh)) || '';
  const pool = [];
  switch (m.kind) {
    case 'CITY': {
      const days = r.comfort;
      if (days != null) pool.push(zh
        ? `你正听着的这点暖，是 ${nm} ${days} 个宜居日攒下来的。`
        : `The warmth you're hearing is ${days} livable days, saved up by ${nm}.`);
      pool.push(zh
        ? `旋律悬在 ${r.prov || nm} 的上空，那里的夜比这里长一点。`
        : `The melody hangs over ${nm}, where the night runs a little longer.`);
      break;
    }
    case 'KERNEL': {
      const u = r.used;
      pool.push(zh
        ? `这条最沉的低音，托着${u != null ? ' ' + u + ' 款' : '一整代'}产品的地基。`
        : `That heaviest bassline carries ${u != null ? u + ' products' : 'a whole generation'} on its back.`);
      break;
    }
    case 'PRODUCT':
      pool.push(zh
        ? `${nm} 踩着四拍往前，是这片星海里的一颗小行星。`
        : `${nm} rides the four-count forward, a small planet in this sea of stars.`);
      break;
    case 'BREAKTHROUGH': {
      const y = r.y4;
      pool.push(zh
        ? `${y ? y + ' 年的' : '某一年的'}一次改写，此刻化成一记落下的鼓点。`
        : `A rewrite from ${y || 'some year'}, now a single kick, landing.`);
      break;
    }
    case 'POLICY': {
      const y = r.y4;
      pool.push(zh
        ? `一纸${y ? ' ' + y + ' 年' : ''}的远图，正在铺开的长音里慢慢展开。`
        : `A blueprint from ${y || 'years back'}, unfolding slow across a long, held chord.`);
      break;
    }
    case 'VENDOR': {
      const hq = [r.hqCity, r.hqCountry].filter(Boolean).join(zh ? ' ' : ', ');
      pool.push(zh
        ? `${nm} 悬在${hq ? ' ' + hq + ' ' : ''}上空，是这段旋律的一处支点。`
        : `${nm} hangs over ${hq || 'the map'}, a quiet pivot in this melody.`);
      break;
    }
    case 'PHARMA':
      pool.push(zh
        ? `鼓点落下的地方，${nm} 的灯还亮着，正在过夜。`
        : `Where the kick lands, the lights are still on at ${nm}, working the night.`);
      break;
    case 'CAT':
      pool.push(zh
        ? `低音里最软的那一下，是一只叫 ${nm} 的猫。`
        : `The softest touch in the bass is a cat named ${nm}.`);
      break;
    case 'SHELTER':
      pool.push(zh
        ? `那一簇暖光的源头，是 ${nm}——一屋子的猫在等。`
        : `The source of that warm cluster is ${nm} — a house full of waiting cats.`);
      break;
  }
  if (!pool.length) return '';
  return pool[(Math.random() * pool.length) | 0];
}

let _ins = null;   // 缓存逐帧更新的节点
function openInspector(i) {
  const m = D.meta[i]; if (!m || !card) return;
  const s = sys[i], A = ATTRACTORS[s] || ATTRACTORS[14], dv = A.dv, zh = isZh();
  const enc = ENC[encKeyOf(m.kind, s)] || [];
  const odeHtml = A.ode.map((l) => `<div>${dv ? l.replaceAll(dv, `<b>${dv}</b>`) : l}</div>`).join('');
  const rows = enc.filter((r) => r[0] !== 'eq' || dv).map(([cid, zs, es]) => {
    const lab = cid === 'eq' ? dv : (CHAN_LABEL[cid] || cid);
    const val = cid === 'eq' ? prm[i].toFixed(2) : chanVal(cid, i);
    return { lab, val, src: zh ? zs : es };
  }).filter((r) => r.val !== '' && r.val != null)   // 数据为空 → 整行隐藏（不显示「参数名 + 空」）
    .map((r) => `<div class="ir"><span class="ic">${r.lab}</span><span class="iv">${r.val}</span><span class="im">← ${r.src}</span></div>`).join('');
  const nm = (zh ? (m.nameZh || m.nameEn) : (m.nameEn || m.nameZh)) || '';
  const np = nowPlayingLine(m, zh);   // 「此刻在演奏什么」诗句：真实数据事实 ↔ 正在发声的东西
  card.classList.add('inspect');
  card.innerHTML =
    `<div class="ins-eq"><div class="ins-eqh">${A.n}<span class="ins-sys"> · sys ${s}</span>${dv ? ` · <b>${dv}</b> = ${prm[i].toFixed(2)}` : ''}</div>${odeHtml}</div>` +
    `<div class="ins-state">x <i data-l="x">·</i> y <i data-l="y">·</i> z <i data-l="z">·</i> <span class="ins-dt">Δt <i data-l="h">·</i></span></div>` +
    `<div class="ins-rows">${rows}</div>` +
    (np ? `<div class="ins-np">${np}</div>` : '') +   // 斜体低亮低语：不解释代码，只把此刻声音与这颗星的真实数据相连
    `<div class="ins-meta"><span class="ins-name">${nm}</span></div>`;   // id 隐藏（多为名称 slug 的重述，冗余）；脚注仅留极淡名字
  card.classList.remove('hidden');
  _ins = { i, x: card.querySelector('[data-l=x]'), y: card.querySelector('[data-l=y]'), z: card.querySelector('[data-l=z]'), h: card.querySelector('[data-l=h]') };
  updateInspector();
}
function updateInspector() {   // 逐帧：实时 trajectory 点 (x,y,z) + 当前有效步长 Δt
  if (!_ins || !focusActive || focusIdx !== _ins.i || !state) return;
  const i = _ins.i, o = i * 3;
  _ins.x.textContent = state[o].toFixed(2); _ins.y.textContent = state[o + 1].toFixed(2); _ins.z.textContent = state[o + 2].toFixed(2);
  const pulse = U.uPulse.value || 0, hmul = (0.5 + pulse * 1.3) * MOTION, slow = 1 - (szCurve ? szCurve[i] : 0) * 0.84;
  _ins.h.textContent = Math.min(bh[i] * spd[i] * hmul * slow, capOf(sys[i])).toExponential(1);
}

// pick
const raycaster = new THREE.Raycaster(); raycaster.params.Points.threshold = 3.6;   // 放宽命中半径 → 更少「点了没选中」
const card = document.getElementById('card'); const ndc = new THREE.Vector2();
let downX = 0, downY = 0, cardMeta = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 7 || !pointsObj) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  // 跟手拾取：阈值内的候选里选「离点击射线最近」(distanceToRay 最小 ≈ 手指对准的那颗)，而非 three 默认的「离相机最近」——
  // 后者常选到没对准、只是恰好离镜头近的星。且**排除当前已选中项**：用户点击永远是为了「切换」，已选中的几何体不该
  // 遮挡/吸走这一击（用户洞察）——这也解决了聚焦时选中星被环绕到近端、把后续点击全吸走的问题。
  const hits = raycaster.intersectObject(pointsObj);
  let hit = null;
  for (const h of hits) {
    if (h.index === focusIdx || !D.meta[h.index]) continue;
    if (!hit || h.distanceToRay < hit.distanceToRay) hit = h;
  }
  if (hit) {
    cardMeta = D.meta[hit.index];
    beginFocusTransition();                                                                // 记录起点位姿 → smoothstep 缓入（引导式推镜，不突兀）
    const o = hit.index * 3; _starSmooth.set(posArr[o], posArr[o + 1], posArr[o + 2]);      // 锚定跟踪目标
    focusIdx = hit.index; focusActive = true;                                              // 锁定追踪（选中态即时切换，参与感来自即时反馈；镜头再缓入）
    openInspector(hit.index);                                                              // 详情：公式 + 实时参数 + 数据映射（名字降为角落小字）
  } else {
    cardMeta = null;
    card.classList.add('hidden');
    if (focusActive) beginFocusTransition();                                                // 点空白 → 缓入滑回正中心（仅在原本聚焦时）
    focusActive = false;
  }
});

// ---------- 标题 = 三模式循环 toggle：隐藏 → EN → 中文（首屏默认隐藏文字；左上角 hover/触控 浮现大标题，点击进入 EN）----------
{
  const hud = document.getElementById('hud'), tip = document.getElementById('tip'), title = document.getElementById('title');
  let uiMode = 0;                                                   // 0 HIDDEN · 1 EN · 2 ZH（默认 0 = 首屏纯画面）
  let hudT = null, peekT = null, peeking = false, lastPtr = 'mouse';

  const applyLang = () => { applyUi({ clubMode: muted }); updateMicBtn(); if (focusActive && focusIdx >= 0) openInspector(focusIdx); refreshWhisper(); };   // 切语言后重渲染（含模式感知按钮 + mic 按钮文案 + 详情面板 + 环境低语）
  const showHud = () => {                                          // 静置淡隐：仅 EN/ZH 模式有效；隐藏模式由 CSS 接管标题浮现
    if (uiMode === 0) { hud.style.opacity = ''; tip.style.opacity = ''; clearTimeout(hudT); return; }
    hud.style.opacity = ''; tip.style.opacity = ''; clearTimeout(hudT);
    hudT = setTimeout(() => { hud.style.opacity = '0'; tip.style.opacity = '0'; }, 5000);
  };
  const hint = () => { title.title = uiMode === 0 ? 'Hidden  ·  hover/tap corner, click → English' : uiMode === 1 ? 'Title: English  ·  click → 中文' : '标题：中文  ·  点击 → 隐藏'; };
  const peek = (ms) => { peeking = true; title.classList.add('peek'); clearTimeout(peekT); peekT = setTimeout(() => { peeking = false; title.classList.remove('peek'); }, ms || 2800); };   // 触控/进隐藏：短暂浮现大标题
  const setMode = (m) => {
    uiMode = ((m % 3) + 3) % 3;
    if (uiMode === 1 && isZh()) { setLang('en'); applyLang(); }
    else if (uiMode === 2 && !isZh()) { setLang('zh'); applyLang(); }
    document.body.classList.toggle('ui-hidden', uiMode === 0);
    hint();
    if (uiMode === 0) { clearTimeout(hudT); hud.style.opacity = ''; tip.style.opacity = ''; peek(2800); }   // 进隐藏：停淡隐计时 + 给一次浮现确认
    else { title.classList.remove('peek'); peeking = false; showHud(); }
  };

  title.addEventListener('pointerdown', (e) => { lastPtr = e.pointerType || 'mouse'; }, true);
  title.addEventListener('click', (e) => {
    e.stopPropagation();
    if (uiMode !== 0) { setMode(uiMode + 1); return; }
    if (lastPtr === 'touch' && !peeking) peek(2800);               // 隐藏态触控：首点浮现、再点(浮现中)循环；桌面 hover 已显 → 直接循环
    else setMode(uiMode + 1);
  });
  title.addEventListener('keydown', (e) => {                       // 键盘可达：Enter/Space 等效点击（无 touch 概念 → 走桌面分支直接循环）
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    e.preventDefault(); e.stopPropagation();
    setMode(uiMode + 1);
  });

  addEventListener('pointermove', showHud); addEventListener('pointerdown', showHud); addEventListener('keydown', showHud);
  setMode(0);   // 首屏默认 = 隐藏文字（纯画面沉浸）+ 给一次浮现确认
}

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); U.uPixelRatio.value = renderer.getPixelRatio(); beamMaterial.uniforms.uRes.value.set(innerWidth, innerHeight); edgeRibbonMat.uniforms.uRes.value.set(innerWidth, innerHeight); if (composer) composer.setSize(innerWidth, innerHeight); });

// 视野内实体聚合 → 喂给音乐引擎：count/层 → 主导层(选音色=变轨)、色相均值 → 旋律目标音级（gaze 决定听到什么）。节流调用（音符级速率足矣）
function computeViewAgg() {
  if (!N || !visArr || !audioTone) return;
  const c = viewAgg.counts; c.fill(0);
  const vote = clusterVote; if (vote) vote.fill(0);
  let tone = 0, sz = 0, n = 0;
  for (let i = 0; i < N; i++) {
    if (!visArr[i] || !groupVis[grp[i]]) continue;
    c[grp[i]]++; tone += audioTone[i]; sz += szCurve ? szCurve[i] : 0.5; n++;
    if (vote && clusterOf) vote[clusterOf[i]]++;   // 视野内各 SOM 簇的实体数
  }
  if (n) {
    let dom = 0, dmax = -1; for (let k = 0; k < 8; k++) if (c[k] > dmax) { dmax = c[k]; dom = k; }
    viewAgg.dom = dom; viewAgg.toneAvg = tone / n; viewAgg.szAvg = sz / n;
    if (vote && clusterHue) {   // 主导可见簇(真实 SOM 神经元) → 其色相/能量 = 你正看着哪片自组织 → 实时旋律色/密度
      let vcl = 0, vmax = -1; for (let m = 0; m < somM; m++) if (vote[m] > vmax) { vmax = vote[m]; vcl = m; }
      if (vmax > 0) { viewAgg.clHue = clusterHue[vcl]; viewAgg.clEnergy = clusterEnergy[vcl]; viewAgg.domCluster = vcl; }   // domCluster 供微弱空间声像投影（updateSpatialAudio 低频消费）
    }
  }
  viewAgg.n = n;   // n==0 时保留上一帧 dom/tone/簇（避免视野扫空时乱跳）
}

// 微弱空间声像（"可以有微弱影响" —— 宁欠勿过）：每 ~250ms 把「主导可见 SOM 簇」的世界锚点投影到相机 NDC，
// 喂给 sonifier.setSpatial(x, closeness)。低频定时器，受 visibilitychange 暂停，不占每帧预算；不新增每帧分配
// （复用模块级 _vp，本函数本身也只在低频 tick 上跑）。簇数据不可用/簇锚点落相机背后 → setSpatial(0, 0)（居中、零偏置）。
function updateSpatialAudio() {
  if (!sonifier.started) return;
  const dc = viewAgg.domCluster;
  if (dc == null || dc < 0 || !clusterAnc) { sonifier.setSpatial(0, 0); return; }
  const o = dc * 3, x = clusterAnc[o], y = clusterAnc[o + 1], z = clusterAnc[o + 2];
  const m = _vp.elements;   // _vp 每帧在 animate() 里刷新为最新 projectionMatrix*matrixWorldInverse（视锥剔除用）→ 此处复用，零新分配
  const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (cw <= 0.05) { sonifier.setSpatial(0, 0); return; }   // 簇锚点在相机背后 → 投影无意义，居中兜底
  const cx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / cw;               // NDC x（setSpatial 内部再夹 [-1,1] × 0.25 上限）
  const closeness = clamp(1 - (cw - SOM_R[0]) / (SOM_R[1] - SOM_R[0]), 0, 1);   // 用 SOM 壳半径 [55,120] 归一「相机到簇锚点」距离
  sonifier.setSpatial(cx, closeness);
}
let _spatialTimer = null;
function startSpatialTimer() { if (_spatialTimer == null) _spatialTimer = setInterval(updateSpatialAudio, 250); }
function stopSpatialTimer() { if (_spatialTimer != null) { clearInterval(_spatialTimer); _spatialTimer = null; } }
document.addEventListener('visibilitychange', () => { if (document.hidden) stopSpatialTimer(); else startSpatialTimer(); });
if (!document.hidden) startSpatialTimer();

// ---------- 环境低语：section/set 相位切换时，一句与当前声音相关的数据诗句淡入 ~8s 后淡出 ----------
// 让访客知道"此刻在演奏什么数据"，但保持神秘感——禁工程词，只留真实数据事实 + 乐感词 + 天文隐喻。
// 数据规模 COSMOS 由 main() 填；真实名字池懒建。选择用 Math.random（UI 瞬时层，确定性纪律不适用）。
let COSMOS = null;   // { cities, products, kernels, breakthroughs, policies, vendors, pharmaCo, sites, drugs, cats, shelters }
const whisperEl = (() => { const el = document.createElement('div'); el.id = 'whisper'; el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); return el; })();
let _namePools = null;
function namePools() {   // 从 D.meta 一次性抽真实名字（此函数仅在 ≥90s 一次的低语触发时调用，非每帧）
  if (_namePools) return _namePools;
  const p = { city: [], pharma: [], cat: [], shelter: [] };
  for (let i = 0; i < D.meta.length; i++) {
    const m = D.meta[i]; if (!m) continue;
    const nz = m.nameZh, ne = m.nameEn; if (!nz && !ne) continue;
    if (m.kind === 'CITY') p.city.push([nz || ne, ne || nz]);
    else if (m.kind === 'PHARMA') p.pharma.push([nz || ne, ne || nz]);
    else if (m.kind === 'CAT') p.cat.push([nz || ne, ne || nz]);
    else if (m.kind === 'SHELTER') p.shelter.push([nz || ne, ne || nz]);
  }
  _namePools = p; return p;
}
const _pick = (a) => (a && a.length ? a[(Math.random() * a.length) | 0] : null);
// 模板骨架（12 条）：need = 必须存在的数据槽；mood 与当前段落的声音质地对齐（kick=有力鼓点段 / pad=铺开和声段 / any=通用）。
// zh/en 各自独立创作（非翻译腔）。名字槽是 [zh, en]，渲染时按当前语言取一侧。
const WHISPERS = [
  { need: ['cities'], mood: 'pad', make: (S, zh) => zh
    ? `你听到的这点暖，是南北 ${S.cities} 座城的天气，一起呼吸。`
    : `That warmth you hear is the weather of ${S.cities} cities, breathing together.` },
  { need: ['cityName'], mood: 'any', make: (S, zh) => zh
    ? `旋律正落在 ${S.cityName[0]} 的上空，那里的夜比这里长。`
    : `The melody is settling over ${S.cityName[1]}, where the night runs longer.` },
  { need: ['pharmaCo'], mood: 'kick', make: (S, zh) => zh
    ? `鼓点落下的地方，${S.pharmaCo} 家药厂正在过夜。`
    : `Where the kick lands, ${S.pharmaCo} drugmakers are working through the night.` },
  { need: ['cats'], mood: 'any', make: (S, zh) => zh
    ? `高音里最轻的那一串，是 ${S.cats} 只还在等家的猫。`
    : `The lightest run up top is ${S.cats} cats still waiting for a home.` },
  { need: ['catName'], mood: 'pad', make: (S, zh) => zh
    ? `有一只叫 ${S.catName[0]} 的猫，藏在这段和声的最软处。`
    : `A cat named ${S.catName[1]} is hiding in the softest part of this chord.` },
  { need: ['shelterName'], mood: 'any', make: (S, zh) => zh
    ? `那一簇暖光的源头，是 ${S.shelterName[0]}，一屋子的猫。`
    : `The source of that warm cluster is ${S.shelterName[1]}, a house full of cats.` },
  { need: ['products'], mood: 'kick', make: (S, zh) => zh
    ? `四拍稳稳向前，托着 ${S.products} 件机器背后的野心。`
    : `The four-count keeps rolling, carrying the ambition behind ${S.products} machines.` },
  { need: ['policies'], mood: 'pad', make: (S, zh) => zh
    ? `铺开的长音下面，压着 ${S.policies} 纸还没说完的远图。`
    : `Under that long, held chord lie ${S.policies} blueprints, still unfinished.` },
  { need: ['sites'], mood: 'kick', make: (S, zh) => zh
    ? `散在全球的 ${S.sites} 座厂房与实验室，此刻一起打着这个四拍。`
    : `${S.sites} plants and labs scattered across the globe are all keeping this four-count.` },
  { need: [], mood: 'pad', make: (S, zh) => zh
    ? `此刻发声的，是房子、药、机器与猫，挤在同一片星海里。`
    : `What's sounding now is houses, medicine, machines and cats, crowded into one sea of stars.` },
  { need: [], mood: 'any', make: (S, zh) => zh
    ? `每一次和弦转身，都是过去某一年的一次改写。`
    : `Every turn of the chord is a rewrite from some year now gone.` },
  { need: ['cats', 'cities'], mood: 'any', make: (S, zh) => zh
    ? `一头是 ${S.cities} 座城的天气，一头是 ${S.cats} 只猫，都在这一段旋律里。`
    : `On one side, the weather of ${S.cities} cities; on the other, ${S.cats} cats — both inside this one melody.` },
];
function _whisperSlotsBuild() {
  const C = COSMOS || {}, P = namePools();
  return {
    cities: C.cities || 0, pharmaCo: C.pharmaCo || 0, cats: C.cats || 0, shelters: C.shelters || 0,
    products: C.products || 0, policies: C.policies || 0, sites: C.sites || 0,
    cityName: _pick(P.city), catName: _pick(P.cat), shelterName: _pick(P.shelter),
  };
}
function _whisperMood(sec, ph) {
  if (sec === 'drop') return 'kick';
  if (sec === 'breakdown' || sec === 'intro') return 'pad';
  if (ph === 'peak') return 'kick';
  return 'any';
}
let _lastSec = null, _lastPhase = null, _lastWhisperT = -1e9, _whisperShowing = false;
let _whisperTpl = null, _whisperSlots = null, _wHold = 0, _wClear = 0;
function refreshWhisper() { if (_whisperShowing && _whisperTpl) whisperEl.textContent = _whisperTpl.make(_whisperSlots, isZh()); }   // 语言切换时重渲染当前低语（数据槽不变，仅换语言侧）
function fireWhisper(sec, ph, t) {
  const S = _whisperSlotsBuild();
  const ok = WHISPERS.filter((w) => w.need.every((k) => { const v = S[k]; return typeof v === 'number' ? v > 0 : !!v; }));
  if (!ok.length) return;
  const want = _whisperMood(sec, ph);
  let cand = ok.filter((w) => w.mood === want || w.mood === 'any');
  if (!cand.length) cand = ok;
  _whisperTpl = cand[(Math.random() * cand.length) | 0]; _whisperSlots = S;
  whisperEl.textContent = _whisperTpl.make(S, isZh());
  _whisperShowing = true; _lastWhisperT = t;
  whisperEl.classList.add('show');
  clearTimeout(_wHold); clearTimeout(_wClear);
  _wHold = setTimeout(() => whisperEl.classList.remove('show'), 7000);                                      // 淡入(CSS ~1.1s) + 停留 → 7s 后开始淡出
  _wClear = setTimeout(() => { _whisperShowing = false; whisperEl.textContent = ''; _whisperTpl = null; }, 8400);   // 淡出完成后清空（总可见 ~8s）
}
const WHISPER_GAP = 90;   // 节流：两条低语间隔 ≥90s
function maybeWhisper(t) {   // 每帧调用，仅做字符串比较（零分配）；真正触发才建槽（≥90s 一次）
  if (!sonifier.started || !COSMOS) return;
  const sec = sonifier.section, ph = sonifier.setPhase;
  if (_lastSec === null) { _lastSec = sec; _lastPhase = ph; return; }   // 首帧只记基线，不触发
  const changed = (sec !== _lastSec) || (ph !== _lastPhase);
  _lastSec = sec; _lastPhase = ph;
  if (!changed || _whisperShowing || t - _lastWhisperT < WHISPER_GAP) return;
  fireWhisper(sec, ph, t);
}

// ---------- loop ----------
const clock = new THREE.Clock();
let pulse = 0, tElapsed = 0, spinTime = 0, frameCount = 0;
let _fovPunchApplied = 0;   // 上一帧叠加的 FOV punch（下一帧开头撤销 → 避免 kick punch 累积漂移）
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); tElapsed += dt; U.uTime.value = tElapsed;
  // 撤销上一帧叠加的 FOV punch → 还原到"基础 FOV"（intro-zoom / 手动缩放设的值），再由下方 beat-sync 重新叠加。避免累积漂移。
  if (_fovPunchApplied) { camera.fov -= _fovPunchApplied; _fovPunchApplied = 0; }
  // 脉冲来源：默认 = 生成音频引擎的 beatPulse（每个 kick → 1，引擎内每帧自衰减）。
  // 静音态下若用户开了「带上你自己的 DJ」mic 驱动，pulse 换成房间真实声音的振幅包络（updateMicPulse，零每帧分配）。
  pulse = micActive ? updateMicPulse() : (sonifier.started ? sonifier.beatPulse : (pulse * 0.9));
  U.uPulse.value = pulse;
  bgMat.uniforms.uTime.value = tElapsed; bgMat.uniforms.uPulse.value = pulse;

  // 开场缓慢 zoom out → FOV 到 100（smootherstep：起步柔、临近 100 减速、平缓停住）；一旦用户手动缩放即取消（introZoom=false）
  if (introZoom) {
    introProg = Math.min(1, introProg + dt / INTRO_DUR);
    const e = introProg * introProg * (3 - 2 * introProg);
    camera.fov = INTRO_FOV_START + (INTRO_FOV_END - INTRO_FOV_START) * e;
    camera.updateProjectionMatrix();
    if (introProg >= 1) introZoom = false;
  }

  // ---------- 节拍同步视觉（放在 intro-zoom/手动缩放之后，以加法叠加，不覆盖基础 FOV）----------
  // 每个 kick → pulse≈1 → 相机微震 + FOV punch + bloom 强度脉冲 + drop 段频闪。drop 段触发更剧烈。
  const inDrop = sonifier.started && sonifier.section === 'drop';
  const shake = pulse * (inDrop ? 0.04 : 0.02);
  camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake;   // 微震：kick 瞬间抖动 ±shake
  // FOV punch：在 intro/手动缩放设的基础 FOV 上叠加（_fovPunchApplied 记录本帧叠加量，下一帧开头撤销 → 不累积漂移）。
  _fovPunchApplied = pulse * (inDrop ? 2.5 : 1.2);
  camera.fov += _fovPunchApplied; camera.updateProjectionMatrix();
  // bloom 强度脉冲：基线 → kick/mic-onset 瞬时更强。基线另随 DJ-set 宏弧相位 ±~10% 缓变（warm-up 稍暗 → peak 稍亮）：
  // getSetPhase() 返回引擎内复用对象、energyVis 已在引擎侧平滑（~2s glide）→ 零每帧分配、零额外平滑成本。
  if (bloomPass) {
    const setE = sonifier.started ? sonifier.getSetPhase().energyVis : 0.6;   // 0.34(warm-up)..1.0(peak apex)；未起声取中性 0.6（因子≈0.99）
    bloomPass.strength = BLOOM_BASE * (0.83 + 0.27 * setE) + pulse * (inDrop ? 0.7 : 0.4);
  }
  // 频闪：仅当用户已过光敏警示门（gateConfirmed）。生成音乐态 = drop 段每个 kick（pulse > 0.6）闪一下；
  // mic 驱动态 = 改为 onset 检测（updateMicPulse 里算好的 micOnset），与「原本的 drop 段」逻辑解耦——房间声音没有 drop 段概念。
  const strobeFire = micActive ? micOnset : (inDrop && pulse > 0.6);
  if (strobeEl && gateConfirmed && strobeFire) { strobeEl.classList.add('strobe-on'); clearTimeout(strobeEl._t); strobeEl._t = setTimeout(() => strobeEl.classList.remove('strobe-on'), 70); }

  // 呼吸式自组织：CENTER(重叠混沌) ⇄ SOM 神经地图；mic 出声提速呼吸；smootherstep 在两端停留
  // SOM 就绪前不推进呼吸(breathT=0、bAmp=0 → 纯重叠混沌运动)；就绪后 bAmp 从 0 平滑 ramp → 从随机运动态连续呼气展开成神经地图，无瞬变
  if (somReady) { breathT += dt * (0.065 + pulse * 0.15); bProg = Math.min(1, bProg + dt / BREATH_RAMP); bAmp = bProg * bProg * (3 - 2 * bProg); }   // 整体半速；每实体再 × bRate。bAmp = smootherstep(bProg) → 揭示首尾更柔、更平缓
  const oRaw = 0.5 - 0.5 * Math.cos(breathT);
  gOrg = oRaw * oRaw * (3 - 2 * oRaw) * bAmp;   // × bAmp：晶格随展开平滑显形（就绪前 = 0，不显）
  if (latticeObj) latticeMat.uniforms.uOrg.value = gOrg;   // 呼气时神经晶格显形

  // 每系统各绕自己的轴自转（始终开启）
  spinTime += dt * (0.00024 + pulse * 0.0006) * MOTION;   // 随全局降速一并放慢
  for (let s = 0; s < SYSN; s++) { const a = SYS_SPIN[s] * spinTime; sysCos[s] = Math.cos(a); sysSin[s] = Math.sin(a); }

  if (N) {
    const hmul = (0.5 + pulse * 1.3) * MOTION;   // 全局速度 × MOTION（用户「降速 2×」：基线 0.5→0.25，mic 提速也等比放慢）
    for (let i = 0; i < N; i++) {
      const slow = 1 - szCurve[i] * 0.84;     // 越大(数据越超群)→越慢：日月大行星沉缓、群星颗粒灵动 → 速度差更广
      const h = Math.min(bh[i] * spd[i] * hmul * slow, capOf(sys[i]));
      stepOne(i, h * 0.5); stepOne(i, h * 0.5);
      writeWorld(i);
    }
    pointsObj.geometry.attributes.position.needsUpdate = true;

    // 视锥剔除：屏外实体跳过最贵的几何体变换 / 4D 投影 / 拖尾重建（屏内一模一样，仅省看不见的算力）
    _vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    { const m = _vp.elements;
      for (let i = 0; i < N; i++) {
        const o = i * 3, x = posArr[o], y = posArr[o + 1], z = posArr[o + 2];
        const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
        cwArr[i] = cw > 0.5 ? cw : 0.5;                              // 到相机距离（供投影尺寸 LOD）
        if (cw <= 0.05) { visArr[i] = 0; continue; }                // 背后 → 剔除
        if (cw < 14) { visArr[i] = 1; continue; }                   // 近处大体可能中心出框 → 保留（余量加大）
        const cx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / cw, cy = (m[1] * x + m[5] * y + m[9] * z + m[13]) / cw;
        visArr[i] = (cx > -2.8 && cx < 2.8 && cy > -2.8 && cy < 2.8) ? 1 : 0;   // 视锥内（±2.8 大余量 → 转视角时边缘不闪）
      }
    }

    // 几何体棱线：跟随混沌位置 + 各自缓慢自转 + 呼吸变径（CPU 变换合并 LineSegments）
    if (solidGroups.length) {
      const sbreath = 1.0 + 0.22 * Math.sin(tElapsed * 0.7), ringBreath = 1.0 + 0.18 * Math.sin(tElapsed * 0.5 + 1.0);
      const lodK = Math.tan(camera.fov * Math.PI / 360) * 0.013;   // morph-LOD 阈值随焦距：投影 <~5px 才冻结 4D 形变（子像素，看不出）
      for (let g = 0; g < solidGroups.length; g++) {
        const sg = solidGroups[g], lv = sg.lv, pos = sg.pos, inst = sg.inst;
        let local = sg.local;
        for (let j = 0; j < sg.cnt; j++) {
          const gi = sg.gidx[j], o = gi * 3, vis = groupVis[grp[gi]] ? 1 : 0;
          if (!visArr[gi]) continue;                              // 屏外 → 跳过（位置留旧值，本就不可见；回到视野内下一帧即更新）
          const sc = sg.cmplx * (0.05 + szCurve[gi] * 1.4) * (sg.ellipsoid ? ringBreath : sbreath) * vis;   // 数据量级(szCurve) × 复杂度 → 高维体更大
          if (sg.is4d) {                                          // 逐帧 nD 旋转→投影 3D；但投影 <~5px 时冻结 morph 用静态形（看不出，省 projectND）
            if (sc >= cwArr[gi] * lodK) {
              projectND(sg.verts4, sg.n4, sg.dim, sg.wdist, sg.spd4[j] * tElapsed + sg.phase[j]);
              for (let e2 = 0; e2 < sg.ne; e2++) { const u = sg.edgeIdx[e2 * 2] * 3, v2 = sg.edgeIdx[e2 * 2 + 1] * 3, o2 = e2 * 6;
                _localDyn[o2] = _v3tmp[u]; _localDyn[o2 + 1] = _v3tmp[u + 1]; _localDyn[o2 + 2] = _v3tmp[u + 2];
                _localDyn[o2 + 3] = _v3tmp[v2]; _localDyn[o2 + 4] = _v3tmp[v2 + 1]; _localDyn[o2 + 5] = _v3tmp[v2 + 2]; }
              local = _localDyn;
            } else { local = sg.local; }                          // LOD：冻结 morph（静态 Schlegel 投影）
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
          _dummy.position.set(posArr[o], posArr[o + 1], posArr[o + 2]);
          _dummy.quaternion.copy(_q);
          _dummy.scale.set(sc, sg.ellipsoid ? sc * 0.74 : sc, sc);
          _dummy.updateMatrix();
          const e = _dummy.matrix.elements;
          if (inst) {                                            // GPU：写每实例 pos/quat/scale，逐顶点变换交给 GPU
            const p3 = j * 3, q4 = j * 4;
            sg.iPos[p3] = posArr[o]; sg.iPos[p3 + 1] = posArr[o + 1]; sg.iPos[p3 + 2] = posArr[o + 2];
            sg.iQuat[q4] = _q.x; sg.iQuat[q4 + 1] = _q.y; sg.iQuat[q4 + 2] = _q.z; sg.iQuat[q4 + 3] = _q.w;
            sg.iScl[p3] = sc; sg.iScl[p3 + 1] = sg.ellipsoid ? sc * 0.74 : sc; sg.iScl[p3 + 2] = sc;
          } else { const base = j * lv * 3;                       // CPU 回退：逐顶点变换写入大缓冲
            for (let v = 0; v < lv; v++) {
              const li = v * 3, lx = local[li], ly = local[li + 1], lz = local[li + 2], k = base + li;
              pos[k] = e[0] * lx + e[4] * ly + e[8] * lz + e[12];
              pos[k + 1] = e[1] * lx + e[5] * ly + e[9] * lz + e[13];
              pos[k + 2] = e[2] * lx + e[6] * ly + e[10] * lz + e[14];
            }
          }
          entMat.set(e, gi * 16);                                // 存实体矩阵，供每个顶点的轨迹用（拖尾不变）
        }
        if (inst) { sg.iPosAttr.needsUpdate = true; sg.iQuatAttr.needsUpdate = true; sg.iSclAttr.needsUpdate = true; } else sg.posAttr.needsUpdate = true;
      }
    }

    // —— 几何体棱线加粗子集：世界端点 = entMat[gi] × 局部棱顶点（同拖尾算法）；宽 = 数据分布 × 呼吸 × beat；离屏即隐(LOD)。——
    if (edgeRibObj) {
      const u = edgeRibObj.userData, rp = u.pos, rd = u.dir, rw = u.wid, rv = u.vis;
      const MAXW = IS_MOBILE ? 2.2 : 3.6, beat = 1 + (U.uPulse.value || 0) * 0.9;
      for (let i = 0, base = 0; i < edgeRib.length; i++, base += 6) {
        const R = edgeRib[i], gi = R.gi, m = gi * 16;
        if (!visArr[gi]) { for (let v = 0; v < 6; v++) rv[base + v] = 0; continue; }   // 离屏 → 隐
        const ed = SHAPES[R.sid].edges, o = R.o;
        const ax = ed[o], ay = ed[o + 1], az = ed[o + 2], bx = ed[o + 3], by = ed[o + 4], bz = ed[o + 5];
        const Ax = entMat[m] * ax + entMat[m + 4] * ay + entMat[m + 8] * az + entMat[m + 12];
        const Ay = entMat[m + 1] * ax + entMat[m + 5] * ay + entMat[m + 9] * az + entMat[m + 13];
        const Az = entMat[m + 2] * ax + entMat[m + 6] * ay + entMat[m + 10] * az + entMat[m + 14];
        const Bx = entMat[m] * bx + entMat[m + 4] * by + entMat[m + 8] * bz + entMat[m + 12];
        const By = entMat[m + 1] * bx + entMat[m + 5] * by + entMat[m + 9] * bz + entMat[m + 13];
        const Bz = entMat[m + 2] * bx + entMat[m + 6] * by + entMat[m + 10] * bz + entMat[m + 14];
        const w = Math.min(MAXW, R.baseW * (1 + 0.22 * Math.sin(tElapsed * 0.7 + R.phase)) * beat);   // 呼吸 × beat 脉冲
        for (let v = 0; v < 6; v++) { const e = base + v, e3 = e * 3, useA = beamEndTmpl[v] === 0;
          rp[e3] = useA ? Ax : Bx; rp[e3 + 1] = useA ? Ay : By; rp[e3 + 2] = useA ? Az : Bz;
          rd[e3] = useA ? Bx : Ax; rd[e3 + 1] = useA ? By : Ay; rd[e3 + 2] = useA ? Bz : Az;
          rw[e] = w; rv[e] = 1; }
      }
      u.posA.needsUpdate = true; u.dirA.needsUpdate = true; u.widA.needsUpdate = true; u.visA.needsUpdate = true;
    }

    // 每 STRIDE 帧采样一次轨迹（让缓慢运动也能拉出可见路径）
    frameCount++;
    if (frameCount % STRIDE === 0) {
      const tpos = trailObj.userData.pos, segs = trailObj.userData.segs;
      head = (head + 1) % TRAIL;
      for (let e = 0; e < E; e++) {
        const gi = emEnt[e], eo = e * 3;
        if (!visArr[gi]) continue;                               // 屏外发射点 → 跳过采样+重建（拖尾冻结，不可见）
        if (shapeArr[gi] === 0) { trailSrc[eo] = posArr[gi * 3]; trailSrc[eo + 1] = posArr[gi * 3 + 1]; trailSrc[eo + 2] = posArr[gi * 3 + 2]; }
        else { const m = gi * 16, lx = emLocal[eo], ly = emLocal[eo + 1], lz = emLocal[eo + 2];
          trailSrc[eo] = entMat[m] * lx + entMat[m + 4] * ly + entMat[m + 8] * lz + entMat[m + 12];
          trailSrc[eo + 1] = entMat[m + 1] * lx + entMat[m + 5] * ly + entMat[m + 9] * lz + entMat[m + 13];
          trailSrc[eo + 2] = entMat[m + 2] * lx + entMat[m + 6] * ly + entMat[m + 10] * lz + entMat[m + 14]; }
        const off = trOff[gi];
        if (off >= TR_GRACE) {                                   // 离屏够久(位置已漂远) → 整 ring 填当前位置，避免拖出长拖影
          for (let t = 0; t < TRAIL; t++) { const to = (e * TRAIL + t) * 3; trail[to] = trailSrc[eo]; trail[to + 1] = trailSrc[eo + 1]; trail[to + 2] = trailSrc[eo + 2]; }
        } else {                                                 // 在屏 / 短暂掠过边缘 → 只把跳过的槽(含当前)桥接为当前位置 → 续画不闪、也不拉长线
          for (let g = 0; g <= off; g++) { const to = (e * TRAIL + ((head - g + TRAIL) % TRAIL)) * 3; trail[to] = trailSrc[eo]; trail[to + 1] = trailSrc[eo + 1]; trail[to + 2] = trailSrc[eo + 2]; }
        }
        for (let k = 0; k < segs; k++) {                         // 重建该发射点的所有段
          const a = (head + 1 + k) % TRAIL, b = (head + 2 + k) % TRAIL;
          const ao = (e * TRAIL + a) * 3, bo = (e * TRAIL + b) * 3, w = ((e * segs + k) * 2) * 3;
          tpos[w] = trail[ao]; tpos[w + 1] = trail[ao + 1]; tpos[w + 2] = trail[ao + 2];
          tpos[w + 3] = trail[bo]; tpos[w + 4] = trail[bo + 1]; tpos[w + 5] = trail[bo + 2];
        }
      }
      trailObj.userData.attr.needsUpdate = true;
      for (let gi = 0; gi < N; gi++) trOff[gi] = visArr[gi] ? 0 : (trOff[gi] < 255 ? trOff[gi] + 1 : 255);   // 连续离屏采样计数（迟滞：短暂掠过边缘不触发重置 → 不闪）
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

  if (gyroOn) {                                          // 陀螺 = 松散「指向性」导航（非精确）：对「每帧角速度」低通(滤手抖) × 半增益(松散) + 每帧全消费(不积分 → 无蓄量蠕动；停手时速度自然衰减 → 平滑滑停、绝不震荡)
    const a = Math.min(1, dt * GYRO_SMOOTH);             // 速度低通：gyroDYaw/gyroDPitch = 本帧累计(已门控)增量 = 目标角速度
    gyroSmYaw += (gyroDYaw - gyroSmYaw) * a;             // 慢倾平滑跟随、快抖被滤（一阶低通不过冲 → 不会有延迟震动）
    gyroSmPitch += (gyroDPitch - gyroSmPitch) * a;
    gyroDYaw = 0; gyroDPitch = 0;                        // 增量已消费 → 不再积分累蓄（消除传感器精度 gap 引起的蠕动）
    const dYaw = clamp(gyroSmYaw * GYRO_GAIN, -GYRO_MAX_STEP, GYRO_MAX_STEP);     // 限幅：单帧转角封顶 → 快速转头/手抖不致镜头翻转跳跃
    const dPitch = clamp(gyroSmPitch * GYRO_GAIN, -GYRO_MAX_STEP, GYRO_MAX_STEP);
    yaw += dYaw; pitch = clamp(pitch + dPitch, -1.45, 1.45);   // 低增益 + 限幅 → 松散、温和、不突跳的指向性导航
  }
  else if (!dragging && focusIdx < 0) yaw += 0.0005;    // 自动巡游（仅自由模式）：比 Data Abyss 快 3× → 夜店节奏感
  applyLook(dt);   // 焦点切换/退出由 applyLook 内的临界阻尼跟随处理（连贯不跳）
  if (focusActive) updateInspector();   // 详情面板逐帧刷新 trajectory 点 (x,y,z) + 有效步长 Δt

  // 生成式数据音乐：呼吸=曲式、视角=空间乐器、视野=旋律、焦点=吟唱（仅在用户开声后运行）
  if (sonifier.started) {
    if ((_aggTick++ & 3) === 0) computeViewAgg();   // 视野聚合节流（每 4 帧）→ 音符级足够
    sonifier.update({
      dt, t: tElapsed, pulse, gOrg, breathT,
      yaw, pitch, fov: camera.fov,
      focus: (focusActive && focusIdx >= 0 && sys) ? { idx: focusIdx, sys: sys[focusIdx], prm: prm[focusIdx], tone: audioTone ? audioTone[focusIdx] : 0.5, group: grp[focusIdx], spd: spd[focusIdx] } : null,
      view: viewAgg,
    });
  }
  maybeWhisper(tElapsed);   // 环境低语：段落/相位切换时的数据诗句（内部自门控 started + ≥90s 节流）
  if (composer) composer.render(); else renderer.render(scene, camera);   // bloom 开 → 走 composer（含 bloom pass）；否则直渲
}

// ---------- 几何体变体：每类一种缓慢自转的线框立体（围绕发光核） ----------
function buildSolids() {
  const buckets = {};                                            // 按几何体形 id 分桶（跨数据层，shape 0=点不建）
  for (let i = 0; i < N; i++) { const sid = shapeArr[i]; if (!sid || !SHAPES[sid]) continue; (buckets[sid] || (buckets[sid] = [])).push(i); }
  for (const sidKey in buckets) {
    const sid = +sidKey, list = buckets[sid], cnt = list.length, shape = SHAPES[sid];
    const local = shape.edges, lv = local.length / 3;
    // 复杂度因子：边越多(越高维/复杂)整体越大 → 多维展开看得清，不缩成点。lv/2=棱数
    let cmplx = 1.0 + clamp(Math.log2(Math.max(lv / 2, 6) / 6) / 5.2, 0, 1) * 1.4;
    if (shape.is4d) cmplx *= 1 + (shape.dim - 3) * 0.1;   // 高维额外加成（4D×1.1 / 5D×1.2 / 6D×1.3）
    const gidx = new Int32Array(cnt), speed = new Float32Array(cnt), vdir = new Float32Array(cnt * 3);   // vdir = 平滑后的运动方向（所有几何体共用）
    const spd4 = shape.is4d ? new Float32Array(cnt) : null, phase = shape.is4d ? new Float32Array(cnt) : null;
    for (let j = 0; j < cnt; j++) {
      const gi = list[j]; gidx[j] = gi;
      vdir[j * 3] = 0; vdir[j * 3 + 1] = 1; vdir[j * 3 + 2] = 0;   // 初始方向
      speed[j] = shape.spin * (0.4 + (D.spd[gi] || 0.5));          // 自转速率随数据 D.spd（轻微、绕运动方向）
      if (shape.is4d) { spd4[j] = shape.spin4 * (0.7 + (D.spd[gi] || 0.5)); phase[j] = hash01('p4' + gi) * 6.2831853; }   // 4D 旋转速率随数据 D.spd；霓虹版基线 0.4→0.7（更频繁）；相位去同步
    }
    const common = { lv, cnt, gidx, speed, vdir, cmplx, ellipsoid: shape.ellipsoid, velAxis: shape.velAxis };
    if (USE_INST && !shape.is4d) {
      // GPU 实例化：base 几何体一份 + 每实例 pos/quat/scale/color → 逐顶点变换交给 GPU（省 CPU，跨设备稳）
      const ig = new THREE.InstancedBufferGeometry();
      ig.setAttribute('position', new THREE.Float32BufferAttribute(local, 3));
      const iPos = new Float32Array(cnt * 3), iQuat = new Float32Array(cnt * 4), iScl = new Float32Array(cnt * 3), iCol = new Float32Array(cnt * 3);
      for (let j = 0; j < cnt; j++) { const gi = gidx[j]; iCol[j * 3] = D.col[gi * 3]; iCol[j * 3 + 1] = D.col[gi * 3 + 1]; iCol[j * 3 + 2] = D.col[gi * 3 + 2]; iQuat[j * 4 + 3] = 1; }   // 颜色静态；quat 初值 identity
      const iPosAttr = new THREE.InstancedBufferAttribute(iPos, 3).setUsage(THREE.DynamicDrawUsage);
      const iQuatAttr = new THREE.InstancedBufferAttribute(iQuat, 4).setUsage(THREE.DynamicDrawUsage);
      const iSclAttr = new THREE.InstancedBufferAttribute(iScl, 3).setUsage(THREE.DynamicDrawUsage);
      ig.setAttribute('iPos', iPosAttr); ig.setAttribute('iQuat', iQuatAttr); ig.setAttribute('iScl', iSclAttr);
      ig.setAttribute('iColor', new THREE.InstancedBufferAttribute(iCol, 3));
      ig.instanceCount = cnt;
      const mesh = new THREE.LineSegments(ig, instLineMat); mesh.frustumCulled = false; root.add(mesh);
      solidGroups.push(Object.assign({ inst: true, iPos, iQuat, iScl, iPosAttr, iQuatAttr, iSclAttr, is4d: false }, common));
    } else {
      // CPU 合并路径（4D 形 / 不支持 instancing 时的回退）：逐帧把每顶点变换写进大缓冲
      const pos = new Float32Array(cnt * lv * 3), colA = new Float32Array(cnt * lv * 3);
      for (let j = 0; j < cnt; j++) { const gi = gidx[j], cr = D.col[gi * 3], cg = D.col[gi * 3 + 1], cb = D.col[gi * 3 + 2];
        for (let v = 0; v < lv; v++) { const k = (j * lv + v) * 3; colA[k] = cr; colA[k + 1] = cg; colA[k + 2] = cb; } }
      const g = new THREE.BufferGeometry();
      const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('position', posAttr); g.setAttribute('aColor', new THREE.BufferAttribute(colA, 3));
      const mesh = new THREE.LineSegments(g, solidLineMat); mesh.frustumCulled = false; root.add(mesh);
      solidGroups.push(Object.assign({ posAttr, pos, local, is4d: shape.is4d, verts4: shape.verts4, edgeIdx: shape.edgeIdx, n4: shape.n4, ne: shape.ne, wdist: shape.wdist, dim: shape.dim, spd4, phase }, common));
    }
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
    ['panelBreakthroughs', 3], ['panelPolicies', 4], ['panelVendors', 5], ['panelPharma', 6], ['panelCats', 7],
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
  panel.appendChild(mkRow('panelSound', true, (on) => { sonifier.setMuted(!on); }));   // 静音/取消静音（需先点「Motion & sound」起声）
  document.body.appendChild(panel);
  panel.style.display = 'none';
  addEventListener('keydown', (e) => { if (e.key === 'd' || e.key === 'D') panel.style.display = panel.style.display === 'none' ? 'flex' : 'none'; });
}

// ---------- 光敏性警示门 + 频闪触发 ----------
// gateConfirmed：用户点「我已知悉」后才为 true；此前 drop 段不触发 strobe（仍出声出画，只是不白闪）。
let gateConfirmed = false;
const strobeEl = document.getElementById('strobe');
const gate = document.getElementById('epilepsy-gate');
const epEnter = document.getElementById('ep-enter');
function confirmGate() {                                    // 「我已知悉」确认后的统一流程；可能来自本模块的 click 监听，也可能是下面的冷网竞态兜底补跑
  if (gateConfirmed) return;
  gateConfirmed = true;
  kickAudio();   // 「我已知悉」这次手势本身就是 iOS 上有效的 user-activation → 同步栈内解锁+起声（kickAudio→startMusic→ensureCtx 会优先复用 __abyssAudio.ctx）
  updateMicBtn();   // mic 按钮的显隐条件之一是 gateConfirmed，门刚过时刷新一次（此时通常仍是"播放"态，按钮仍隐藏，直到用户静音）
  if (gate) { gate.classList.add('gone'); setTimeout(() => gate.remove(), 700); }
}
if (epEnter) {
  epEnter.addEventListener('click', confirmGate, { once: true });
}
// 冷网竞态兜底：index.html 里的 parse-time inline script 早于本 module 就绪，直接在 #ep-enter 的点击
// 手势同步栈内建好了 AudioContext（window.__abyssAudio.entered）。若本模块加载完成时那次点击已经发生
// 且被上面刚注册的监听器错过（module 还没到位），这里补跑一次确认流程——门语义不破坏：entered 只在
// inline script 里真实的 click 回调中才会置位，不是"假装知悉"。
if (window.__abyssAudio && window.__abyssAudio.entered) confirmGate();

// ---------- boot ----------

(async function main() {
  let info = {}, pharma = {}, scats = {};
  try { info = await buildIndustrial(); } catch (err) { if (DEBUG) console.warn('[Data Abyss] industrial load failed (need http server):', err); }
  try { pharma = await buildPharma(); } catch (err) { if (DEBUG) console.warn('[Data Abyss] pharma load failed:', err); }
  try { scats = await buildShelterCats(); } catch (err) { if (DEBUG) console.warn('[Data Abyss] shelter-cats load failed:', err); }
  const cities = buildHousing();
  COSMOS = {   // 数据规模快照 → 环境低语的数量槽（缺数据的层为 0，模板会自动跳过）
    cities, products: info.products || 0, kernels: info.kernels || 0,
    breakthroughs: (info.milestones || 0) + (pharma.milestones || 0),
    policies: info.policies || 0, vendors: info.vendors || 0,
    pharmaCo: pharma.companies || 0, sites: pharma.sites || 0, drugs: pharma.products || 0,
    cats: scats.cats || 0, shelters: scats.shelters || 0,
  };
  bgMat.uniforms.uWarm.value = climWarm;
  // CPPN 背景：用数据聚合量确定性播种神经权重（这场梦由数据塑形）
  const cppnSeed = (Math.round(climWarm * 1000) * 131 + (info.products || 0) * 17 + (info.milestones || 0) * 7 + (info.policies || 0) * 3 + cities) >>> 0;
  bgMat.uniforms.uW.value = seedCPPN(cppnSeed);
  finalize();
  buildSolids();
  buildPanel();
  applyUi({ skipEnable: true });
  // 先出混沌团并开跑：首屏 = 重叠态（此刻 anc 全 = CENTER → 呼气不展开，正是 inhale 视觉），不等最重的 SOM。
  const ld = document.getElementById('loading'); ld.classList.add('gone'); setTimeout(() => ld.remove(), 1000);
  if (DEBUG) console.log(`[Data Abyss] ${cities} cities · ${info.products || 0} products · ${info.kernels || 0} kernels · ${info.milestones || 0} breakthroughs · ${info.policies || 0} policies · ${info.vendors || 0} vendors · pharma[${pharma.companies || 0} co / ${pharma.sites || 0} sites / ${pharma.products || 0} drugs / ${pharma.modalities || 0} mod / ${pharma.milestones || 0} bk] · cats[${scats.cats || 0} / ${scats.shelters || 0} shelters] · ${N} bodies · ${E} trail-emitters · ${beamIdxA ? beamIdxA.length : 0} beams · rel[pharma ${pharma.rel || 0} edges/${pharma.groups || 0} groups · vendor ${info.vendorBeams || 0}] · SOM training deferred…`);
  // 音乐：boot 后不立即创建 AudioContext（手机浏览器在无手势时创建的 ctx 会进入 suspended 且之后难以解锁）。
  // 仅亮起底部 tip-text 引导；首个 pointerdown/touchstart/click 的同步栈内 kickAudio() 解锁+起声。
  updateTipText(refreshAudioState());
  animate();
  // SOM（最重的计算）在 Web Worker 里训练 → 训练全程主线程 animate 照常跑、星体保持自由混沌运动、零卡顿；训完回主线程做廉价后处理(~N+M)无缝长出神经骨架。
  // 首帧后再 kickoff（让首屏先绘制，featM 拷贝/postMessage 不挤进首帧）。首次呼气展开远在 ~24s 后、SOM 早已训完 → 观感零损失。
  requestAnimationFrame(() => buildSOM((som) => {
    for (let i = 0; i < N; i++) writeWorld(i); if (prevPos) prevPos.set(posArr);   // SOM 设好 anc/bPhase/bRate；此刻 bAmp 仍 = 0 → effAnc≈CENTER、位置与上一帧一致（重叠态），无跳变
    somReady = true;   // 解锁呼吸：从这帧起 bAmp 从 0 平滑 ramp → 星体连续地呼气展开成神经地图（与之前的随机运动态无缝衔接）
    // SOM「觉醒」：若用户在 SOM 训完前已开声，sonifier 以 fallback DNA 沉睡启动 → 此刻 musicDNA 到位，交给引擎在下一个 8-bar 边界重推导 + 音乐化绽放（内部幂等：非 fallback 启动则 no-op）。
    if (musicDNA) sonifier.updateDNA(musicDNA);
    if (DEBUG) console.log(`[Data Abyss] SOM ${som ? som.neurons + ' neurons / ' + som.edges + ' edges' : 'skipped'}${musicDNA ? ` · musicDNA[hue ${musicDNA.hueStar.toFixed(2)} · conc ${musicDNA.concentration.toFixed(2)} · clusters ${musicDNA.clusters} · spd ${musicDNA.speedMean.toFixed(2)}±${musicDNA.speedSpread.toFixed(2)} · domType ${musicDNA.domType} · sig ${musicDNA.sig}]` : ''} (trained off-thread)`);
  }));
})();
