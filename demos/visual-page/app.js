// 数渊 · Data Abyss
// A dreamy 3D data-cosmos. Two interwoven strata floating in fog + bloom:
//   下层 气候层  — 347 china-housing 城市，按经纬+海拔排成一片悬浮的中国浮雕
//   上层 自立层  — china-industrial-software 的产品/内核/突破/政策/厂商，结成发光的依赖星网
//
// 通感编码语法（映射不必符合逻辑，但要把数据用满）：
//   城市 city     位置=经度,纬度,海拔 · 大小=单价 · 色相=宜居天数 · 饱和=年温差
//                 亮度=日照 · 明灭幅度=灾害负担 · 明灭速度=楼龄 · 雾晕=PM2.5 · 暗淡=人口外流
//   产品 product  位置=按品类聚团/国产内·国外外 · 色=出身(国产金/国外蓝/开源绿)
//                 大小=成熟度 · 明灭=本地化深度 · 雾晕=1-置信度 · 连线=依赖的内核
//   内核 kernel   内圈大核 · 大小=被多少产品使用
//   突破 milestone 高度=年份(1993→2026) · 角度=攻克的能力 · 大小=证据等级 · 强脉冲
//                 红色连线=射向被替代的国外在位产品(incumbent)
//   政策 policy   高度=年份 · 大小=目标金额 · 色=政策类型
//   厂商 vendor   外圈微尘 · 色=出身
//   对标 pair     国产↔国外产品之间的青色光束

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const IS_MOBILE = matchMedia('(pointer: coarse)').matches || innerWidth < 820;
const IND = '../china-industrial-software/assets/data/';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- scene ----------
const container = document.getElementById('scene');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060e, 0.0034);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(0, 52, 168);

const renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const root = new THREE.Group();
scene.add(root);

// gradient backdrop sphere (deep indigo top -> black bottom)
{
  const geo = new THREE.SphereGeometry(900, 32, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(0x0a1230) }, bot: { value: new THREE.Color(0x030308) } },
    vertexShader: `varying float h; void main(){ h = normalize(position).y*0.5+0.5; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying float h; uniform vec3 top; uniform vec3 bot; void main(){ gl_FragColor = vec4(mix(bot, top, pow(h,1.4)), 1.0); }`
  });
  scene.add(new THREE.Mesh(geo, mat));
}

// ---------- shared point material (soft glowing sprites, twinkle, haze) ----------
const pointUniforms = {
  uTime: { value: 0 },
  uPixelRatio: { value: renderer.getPixelRatio() },
  uPulse: { value: 0 }
};
const pointMaterial = new THREE.ShaderMaterial({
  uniforms: pointUniforms,
  transparent: true, depthWrite: false, depthTest: true,
  blending: THREE.AdditiveBlending,
  vertexShader: `
    attribute float aSize; attribute vec3 aColor; attribute float aPhase;
    attribute float aTwinkle; attribute float aSpeed; attribute float aHaze;
    uniform float uTime; uniform float uPixelRatio; uniform float uPulse;
    varying vec3 vColor; varying float vHaze;
    void main(){
      vHaze = aHaze;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float tw = 0.62 + aTwinkle * 0.5 * sin(uTime * aSpeed * 1.7 + aPhase * 6.2831) + uPulse * 0.45;
      vColor = aColor * tw;
      float size = aSize * (1.0 + uPulse * 0.35);
      gl_PointSize = size * uPixelRatio * (320.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    varying vec3 vColor; varying float vHaze;
    void main(){
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      float core = smoothstep(0.5, 0.0, d);
      float halo = smoothstep(0.5, 0.12, d) * 0.55 * vHaze;
      float a = core + halo;
      if (a < 0.012) discard;
      gl_FragColor = vec4(vColor * (core * 1.7 + halo), a);
    }`
});

// ---------- builders ----------
const P = { pos: [], col: [], size: [], phase: [], tw: [], speed: [], haze: [], meta: [] };
const L = { pos: [], col: [] };
const tmpCol = new THREE.Color();

function addPoint(x, y, z, h, s, l, size, twinkle, speed, haze, meta) {
  tmpCol.setHSL((((h % 360) + 360) % 360) / 360, s, l);
  P.pos.push(x, y, z);
  P.col.push(tmpCol.r, tmpCol.g, tmpCol.b);
  P.size.push(size);
  P.phase.push(Math.random());
  P.tw.push(twinkle);
  P.speed.push(speed);
  P.haze.push(haze);
  P.meta.push(meta);
}
function addLine(a, b, r, g, bl) {
  L.pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
  L.col.push(r, g, bl, r, g, bl);
}

// golden-angle category/capability spreader
const _ang = {}; let _ai = 0;
const angleFor = (k) => (k in _ang ? _ang[k] : (_ang[k] = (_ai++) * 2.3999632));

// ===== 气候层 housing =====
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
    const built = e.builtYear ?? 2000;
    const elev = e.elevation ?? 60;
    const burden = (e.hazard?.hazards || []).reduce((s, h) => s + Math.pow(2, (h.freq || 1) - 1), 0);
    const area = ls.area || 60;
    const unit = (ls.priceWan * 10000) / area;               // 元/㎡
    const outflow = e.demographics?.popChangePct ?? 0;

    const x = (e.lng - 104) * 1.7;
    const z = -(e.lat - 35) * 2.2;
    const y = elev * 0.0045;

    const hue = 220 - clamp(comfort / 300, 0, 1) * 162;        // 蓝(少)→暖绿(多)
    const sat = 0.44 + clamp(tRange / 45, 0, 1) * 0.5;          // 大陆性越强越浓
    const light = (0.45 + clamp(sun / 3500, 0, 1) * 0.2) * (outflow < 0 ? 0.78 : 1); // 外流城黯淡
    const size = 1.6 + clamp(Math.log10(unit + 1) - 2.2, 0, 3) * 1.7; // 越贵越大
    const twinkle = 0.28 + clamp(burden / 40, 0, 1) * 0.72;      // 越危险越颤
    const speed = 0.3 + clamp((built - 1950) / 76, 0, 1) * 1.3;  // 越新越快
    const haze = clamp(pm / 85, 0, 1);                          // PM2.5 雾晕

    addPoint(x, y, z, hue, sat, light, size, twinkle, speed, haze, {
      k: '城市 CITY', name: ls.loc || ls.city,
      sub: `${ls.prov} · ${ls.city} · 单价 ${(unit / 10000).toFixed(1)} 万/㎡ · 宜居 ${comfort} 天 · 海拔 ${Math.round(elev)} m${e.hazard?.top?.[0] ? ' · ' + e.hazard.top[0] : ''}`
    });
    n++;
  }
  return n;
}

// ===== 自立层 industrial =====
async function buildIndustrial() {
  const CATS = ['cad', 'cae', 'eda', 'bim-gis', 'mes-dcs', 'platform', 'slicers', 'open-source', 'plm', 'erp'];
  const j = (p) => fetch(IND + p).then((r) => r.json()).catch(() => null);
  const [cats, vend, kern, brk, pol, prs] = await Promise.all([
    Promise.all(CATS.map((c) => j('categories/' + c + '.json').then((d) => (d && d.products) || []))),
    j('vendors.json'), j('kernels.json'), j('breakthroughs.json'),
    j('policies.json'), j('comparisons/benchmark-pairs.json')
  ]);
  const products = cats.flat();
  const vendors = (vend && (vend.vendors || vend)) || [];
  const kernels = (kern && (kern.kernels || kern)) || [];
  const milestones = (brk && (brk.milestones || brk)) || [];
  const policies = (pol && (pol.policies || pol)) || [];
  const pairs = (prs && (prs.pairs || prs)) || [];

  const DY = 46;                  // dome center y
  const kpos = {}, ppos = {};
  const hueOf = (o) => (o === 'domestic' ? 44 : o === 'open_source' ? 140 : 210);
  const colorOf = (o) => (o === 'domestic' ? [0.95, 0.74, 0.32] : o === 'open_source' ? [0.45, 0.85, 0.5] : [0.34, 0.55, 0.95]);

  // kernels — inner core
  kernels.forEach((k, i) => {
    const a = i * 2.3999632, r = 13;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, y = DY + ((i % 5) - 2) * 5;
    kpos[k.id] = { x, y, z };
    const used = (k.used_by_product_ids || []).length;
    addPoint(x, y, z, hueOf(k.origin), 0.7, 0.62, 4.8 + used * 0.06, 0.4, 0.5, 0.25, {
      k: '内核 KERNEL', name: k.name_zh || k.name_en,
      sub: `${k.origin === 'domestic' ? '国产' : '国外'} · ${k.owner || ''} · 被 ${used} 个产品使用`
    });
  });

  // products — clustered by category, domestic inner / international outer
  products.forEach((p) => {
    const a = angleFor('cat:' + (p.category_l2 || p.category_l1 || 'x')) + (Math.random() - 0.5) * 0.55;
    const intl = p.origin !== 'domestic';
    const r = 25 + (intl ? 16 : 0) + Math.random() * 7;
    const mat = p.maturity === 'high' ? 1 : p.maturity === 'medium' ? 0.5 : 0;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const y = DY - 16 + mat * 30 + (Math.random() - 0.5) * 11;
    ppos[p.id] = { x, y, z };
    addPoint(x, y, z, hueOf(p.origin), 0.62, 0.5 + mat * 0.13,
      p.maturity === 'high' ? 3.5 : p.maturity === 'medium' ? 2.4 : 1.7,
      p.localization_depth === 'full' ? 0.25 : 0.62,
      0.6 + Math.random() * 0.7, clamp(1 - (p.confidence ?? 0.8), 0, 1), {
      k: '产品 PRODUCT', name: p.name_zh || p.name_en,
      sub: `${p.category_l2 || p.category_l1 || ''} · ${p.origin === 'domestic' ? '国产' : p.origin === 'open_source' ? '开源' : '国外'} · 成熟度 ${p.maturity || '—'} · 本地化 ${p.localization_depth || '—'}`
    });
    if (p.kernel_id && kpos[p.kernel_id]) {
      const c = colorOf(p.origin);
      addLine({ x, y, z }, kpos[p.kernel_id], c[0] * 0.5, c[1] * 0.5, c[2] * 0.6);
    }
  });

  // milestones — time helix (year=height), capability=angle, displacement beams to incumbents
  milestones.forEach((m) => {
    const y4 = clamp(parseInt((m.date || '2000').slice(0, 4)) || 2000, 1990, 2026);
    const yf = (y4 - 1990) / 36;
    const a = angleFor('cap:' + (m.capability_key || 'x')) + (Math.random() - 0.5) * 0.4;
    const r = 22 + Math.random() * 6;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, y = 26 + yf * 54;
    const ev = m.evidence_level;
    addPoint(x, y, z, 30 + (m.incumbent_product_ids || []).length * 4, 0.85, 0.6,
      ev === 'audited' ? 3.2 : ev === 'case_study' ? 2.4 : 1.8, 0.92, 1.0 + Math.random() * 0.8, 0.1, {
      k: '突破 BREAKTHROUGH', name: m.headline_zh || m.headline_en || '突破',
      sub: `${y4} · 攻克 ${m.capability_key || ''}${(m.incumbent_product_ids || []).length ? ' · 替代 ' + m.incumbent_product_ids.length + ' 款在位产品' : ''}`
    });
    (m.incumbent_product_ids || []).forEach((iid) => {
      if (ppos[iid]) addLine({ x, y, z }, ppos[iid], 0.85, 0.22, 0.28);
    });
  });

  // policies
  policies.forEach((p) => {
    const y4 = clamp(parseInt((p.date || '2000').slice(0, 4)) || 2000, 1985, 2026);
    const yf = (y4 - 1985) / 41;
    const a = angleFor('pol:' + (p.policy_type || 'x')) + Math.random() * 0.6;
    const r = 40 + Math.random() * 6;
    const hue = { program: 265, fund: 190, fyp: 300, ministry: 170 }[p.policy_type] || 240;
    const size = 1.6 + Math.min(3, Math.log10((p.target_value || 1) + 1));
    addPoint(Math.cos(a) * r, 22 + yf * 58, Math.sin(a) * r, hue, 0.5, 0.6, size, 0.5, 0.45, 0.3, {
      k: '政策 POLICY', name: p.title_zh || p.title_en,
      sub: `${y4} · ${p.policy_type || ''}${p.target_value ? ' · ' + p.target_value + (p.target_unit_zh || '') : ''}`
    });
  });

  // vendors — faint outer halo
  vendors.forEach((v, i) => {
    const a = i * 2.3999632, r = 72 + Math.random() * 14;
    addPoint(Math.cos(a) * r, 32 + ((i % 11) - 5) * 5, Math.sin(a) * r, hueOf(v.origin), 0.4, 0.42, 1.3, 0.4, 0.4, 0.5, {
      k: '厂商 VENDOR', name: v.name_zh || v.name_en,
      sub: `${v.origin === 'domestic' ? '国产' : v.origin === 'open_source' ? '开源' : '国外'} · ${v.hq_city || ''} ${v.hq_country || ''}`
    });
  });

  // benchmark pairs — domestic <-> international beams
  pairs.forEach((bp) => {
    if (ppos[bp.domestic_id] && ppos[bp.international_id])
      addLine(ppos[bp.domestic_id], ppos[bp.international_id], 0.2, 0.8, 0.72);
  });

  return { products: products.length, vendors: vendors.length, kernels: kernels.length, milestones: milestones.length, policies: policies.length, pairs: pairs.length };
}

// ---------- atmospheric dust ----------
function buildDust() {
  const N = IS_MOBILE ? 1300 : 2600;
  const pos = [], col = [], size = [], phase = [], tw = [], speed = [], haze = [];
  for (let i = 0; i < N; i++) {
    const r = 60 + Math.random() * 320, th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1);
    pos.push(Math.sin(ph) * Math.cos(th) * r, Math.cos(ph) * r * 0.6 + 40, Math.sin(ph) * Math.sin(th) * r);
    tmpCol.setHSL((210 + Math.random() * 60) / 360, 0.4, 0.5);
    col.push(tmpCol.r, tmpCol.g, tmpCol.b);
    size.push(0.5 + Math.random() * 0.9); phase.push(Math.random());
    tw.push(0.5 + Math.random() * 0.5); speed.push(0.2 + Math.random() * 0.4); haze.push(1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  g.setAttribute('aTwinkle', new THREE.Float32BufferAttribute(tw, 1));
  g.setAttribute('aSpeed', new THREE.Float32BufferAttribute(speed, 1));
  g.setAttribute('aHaze', new THREE.Float32BufferAttribute(haze, 1));
  root.add(new THREE.Points(g, pointMaterial));
}

// ---------- composer / bloom ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), IS_MOBILE ? 0.7 : 0.95, 0.62, 0.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- controls ----------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.06;
controls.autoRotate = true; controls.autoRotateSpeed = 0.28;
controls.minDistance = 40; controls.maxDistance = 420;
controls.target.set(0, 38, 0);
controls.enablePan = false;

// gyro tilt (subtle parallax on the whole cosmos)
let tiltX = 0, tiltZ = 0, gyroOn = false;
addEventListener('deviceorientation', (e) => {
  if (e.beta == null) return;
  gyroOn = true;
  tiltX = clamp((e.beta - 50) / 90, -1, 1) * 0.26;
  tiltZ = clamp(e.gamma / 90, -1, 1) * 0.26;
});

// mic -> pulse
let analyser = null, micBuf = null;
async function enableSensors() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission)
      await DeviceOrientationEvent.requestPermission().catch(() => {});
  } catch (_) {}
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC(); const src = ac.createMediaStreamSource(stream);
    analyser = ac.createAnalyser(); analyser.fftSize = 256; src.connect(analyser);
    micBuf = new Uint8Array(analyser.frequencyBinCount);
  } catch (_) {}
  const btn = document.getElementById('enable');
  btn.textContent = analyser ? '感应已开启 · 对它说话，数渊会随声起伏' : '感应已请求（真机 https 下生效）';
  setTimeout(() => { btn.parentElement.style.opacity = '0.3'; }, 2600);
}
document.getElementById('enable').addEventListener('click', enableSensors);

// ---------- pick / inspect ----------
let dataPoints = null;
const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 1.6;
const card = document.getElementById('card');
const ndc = new THREE.Vector2();
let downX = 0, downY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 7 || !dataPoints) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(dataPoints)[0];
  if (hit && P.meta[hit.index]) {
    const m = P.meta[hit.index];
    card.innerHTML = `<div class="k">${m.k}</div><h3>${m.name || ''}</h3><p>${m.sub || ''}</p>`;
    card.classList.remove('hidden');
  } else card.classList.add('hidden');
});

// ---------- resize ----------
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth, innerHeight);
  pointUniforms.uPixelRatio.value = renderer.getPixelRatio();
});

// ---------- loop ----------
const clock = new THREE.Clock();
let pulse = 0;
function animate() {
  requestAnimationFrame(animate);
  pointUniforms.uTime.value = clock.getElapsedTime();
  if (analyser) {
    analyser.getByteFrequencyData(micBuf);
    let s = 0; for (let i = 0; i < micBuf.length; i++) s += micBuf[i];
    pulse = lerp(pulse, clamp(s / micBuf.length / 110, 0, 1), 0.2);
  } else pulse *= 0.95;
  pointUniforms.uPulse.value = pulse;
  bloom.strength = (IS_MOBILE ? 0.7 : 0.95) + pulse * 0.7;
  if (gyroOn) { root.rotation.x = lerp(root.rotation.x, tiltX, 0.05); root.rotation.z = lerp(root.rotation.z, tiltZ, 0.05); }
  controls.update();
  composer.render();
}

// ---------- boot ----------
(async function main() {
  let info = {};
  try { info = await buildIndustrial(); } catch (err) { console.warn('[数渊] industrial load failed (need http server):', err); }
  const cities = buildHousing();
  buildDust();

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P.pos, 3));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(P.col, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(P.size, 1));
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(P.phase, 1));
  g.setAttribute('aTwinkle', new THREE.Float32BufferAttribute(P.tw, 1));
  g.setAttribute('aSpeed', new THREE.Float32BufferAttribute(P.speed, 1));
  g.setAttribute('aHaze', new THREE.Float32BufferAttribute(P.haze, 1));
  dataPoints = new THREE.Points(g, pointMaterial);
  root.add(dataPoints);

  if (L.pos.length) {
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(L.pos, 3));
    lg.setAttribute('color', new THREE.Float32BufferAttribute(L.col, 3));
    root.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false
    })));
  }

  console.log(`[数渊] ${cities} 城市 · ${info.products || 0} 产品 · ${info.kernels || 0} 内核 · ${info.milestones || 0} 突破 · ${info.policies || 0} 政策 · ${info.vendors || 0} 厂商 · ${P.meta.length} 总星体`);
  const ld = document.getElementById('loading');
  ld.classList.add('gone'); setTimeout(() => ld.remove(), 1000);
  animate();
})();
