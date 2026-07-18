#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const demo = path.resolve(here, '..');
let fakeViewportWidth = 1180;
let fakeViewportHeight = 720;
let resizeObserverCallback = null;

class FakeClassList {
  constructor(initial = []) { this.values = new Set(initial); }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const next = force === undefined ? !this.contains(name) : Boolean(force);
    if (next) this.add(name); else this.remove(name);
    return next;
  }
}

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.dataset = {};
    this.style = { setProperty() {} };
    this.listeners = new Map();
    this.textContent = '';
    this.content = '';
    this.hidden = false;
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  dispatch(type, event = {}) {
    const payload = {
      type,
      preventDefault() {},
      pointerType: 'mouse',
      pointerId: 1,
      timeStamp: clock,
      clientX: 0,
      clientY: 0,
      key: '',
      shiftKey: false,
      ...event,
    };
    for (const listener of this.listeners.get(type) || []) listener(payload);
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: fakeViewportWidth, height: fakeViewportHeight };
  }
  focus() {}
  setPointerCapture() {}
  releasePointerCapture() {}
}

const contextMethods = new Proxy({}, {
  get(target, property) {
    if (!(property in target)) target[property] = () => undefined;
    return target[property];
  },
  set(target, property, value) { target[property] = value; return true; },
});

let clock = 0;
let rafCounter = 0;
const rafQueue = [];
const pageListeners = new Map();
const storage = new Map();
const ids = new Map();

for (const id of [
  'world', 'canvas-error', 'behavior-label', 'gait-name', 'pause-toggle', 'theme-toggle',
  'language-toggle', 'keyboard-instructions',
]) ids.set(id, new FakeElement(id));
ids.get('world').getContext = () => contextMethods;

const limbElements = ['rightHind', 'rightFore', 'leftHind', 'leftFore'].map((limb) => {
  const element = new FakeElement();
  element.setAttribute('data-limb', limb);
  return element;
});

const metas = {
  'meta[name="theme-color"]': new FakeElement(),
  'meta[name="description"]': new FakeElement(),
  'meta[property="og:description"]': new FakeElement(),
  'meta[name="twitter:description"]': new FakeElement(),
  'meta[property="og:title"]': new FakeElement(),
  'meta[name="twitter:title"]': new FakeElement(),
};

const documentElement = new FakeElement('html');
const body = new FakeElement('body');
const document = {
  documentElement,
  body,
  visibilityState: 'visible',
  getElementById(id) { return ids.get(id) || null; },
  querySelector(selector) { return metas[selector] || null; },
  querySelectorAll(selector) {
    if (selector === '[data-limb]') return limbElements;
    if (selector === '[data-i18n]') return [];
    if (selector === '[data-i18n-aria-label]') return [];
    if (selector === '[data-i18n-title]') return [];
    return [];
  },
  addEventListener(type, listener) {
    if (!pageListeners.has(type)) pageListeners.set(type, []);
    pageListeners.get(type).push(listener);
  },
  dispatch(type, event = {}) {
    for (const listener of pageListeners.get(type) || []) listener(event);
  },
};

const mediaQueries = new Map();
function matchMedia(query) {
  if (!mediaQueries.has(query)) {
    mediaQueries.set(query, {
      matches: false,
      listeners: [],
      addEventListener(type, listener) { if (type === 'change') this.listeners.push(listener); },
    });
  }
  return mediaQueries.get(query);
}

const sandbox = {
  console,
  document,
  localStorage: {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, String(value)); },
  },
  performance: { now: () => clock },
  matchMedia,
  devicePixelRatio: 2,
  requestAnimationFrame(callback) { rafQueue.push(callback); return ++rafCounter; },
  cancelAnimationFrame() {},
  ResizeObserver: class {
    constructor(callback) {
      this.callback = callback;
      resizeObserverCallback = callback;
    }
    observe() { this.callback(); }
  },
  addEventListener(type, listener) {
    if (!pageListeners.has(`window:${type}`)) pageListeners.set(`window:${type}`, []);
    pageListeners.get(`window:${type}`).push(listener);
  },
  dispatchEvent() {},
  setTimeout,
  clearTimeout,
  Math,
  Object,
  Number,
  String,
  Boolean,
  Array,
  Map,
  Set,
  Date,
  JSON,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const loadedSources = new Map();
for (const relative of ['assets/js/i18n.js', 'assets/js/gait.js', 'assets/js/app.js']) {
  const source = fs.readFileSync(path.join(demo, relative), 'utf8');
  loadedSources.set(relative, source);
  vm.runInContext(source, sandbox, { filename: relative });
}
document.dispatch('DOMContentLoaded');

// Renderer topology is checked structurally because a fake Canvas cannot
// reliably distinguish an internal cap line from an external silhouette.
const appSource = loadedSources.get('assets/js/app.js');
const visualHarnessSource = fs.readFileSync(path.join(demo, 'tools/visual-harness.html'), 'utf8');
const tailRibbonSource = appSource.match(/function traceTailRibbon[\s\S]*?(?=\n  function tailRenderPoints)/)?.[0] || '';
const legSilhouetteSource = appSource.match(/function traceLegSilhouette[\s\S]*?(?=\n  function tracePawSilhouette)/)?.[0] || '';
const pawSilhouetteSource = appSource.match(/function tracePawSilhouette[\s\S]*?(?=\n  function strokePawOutline)/)?.[0] || '';
const pawOutlineSource = appSource.match(/function strokePawOutline[\s\S]*?(?=\n  function strokePawToes)/)?.[0] || '';
const earRendererSource = appSource.match(/function earAngle[\s\S]*?(?=\n  function drawCatShadow)/)?.[0] || '';
const earMotionSource = appSource.match(/function updateCat[\s\S]*?(?=\n  function planPawSwing)/)?.[0] || '';
const bodyFlankSource = appSource.match(/function strokeBodyFlanks[\s\S]*?(?=\n  function skinTopologySnapshot)/)?.[0] || '';
const drawShadowSource = appSource.match(/function drawCatShadow[\s\S]*?(?=\n  function drawTail)/)?.[0] || '';
const drawTailSource = appSource.match(/function drawTail[\s\S]*?(?=\n  function drawLegs)/)?.[0] || '';
const drawLegsSource = appSource.match(/function drawLegs[\s\S]*?(?=\n  function bodyStations)/)?.[0] || '';
const drawBodySource = appSource.match(/function drawBody[\s\S]*?(?=\n  function drawTopDownFace)/)?.[0] || '';
const topDownFaceSource = appSource.match(/function drawTopDownFace[\s\S]*?(?=\n  function drawHead)/)?.[0] || '';
const drawHeadSource = appSource.match(/function drawHead[\s\S]*?(?=\n  function drawMouse)/)?.[0] || '';
for (const key of ['stateSit', 'stateLoaf', 'stateSideLie', 'stateRoll', 'stateCurl']) {
  const label = sandbox.CatMouseI18n.LABELS[key];
  assert.ok(label?.zh && label?.en, `${key} must remain bilingual`);
}
assert.match(appSource, /const REST_POSES = Object\.freeze\(\['sit', 'loaf', 'sideLie', 'roll', 'curl'\]\)/, 'rest repertoire contract drifted');
assert.match(appSource, /function restPosePawTarget\s*\(/, 'rest poses must derive articulated paw targets');
assert.match(appSource, /function renderedFoot\s*\(/, 'rest poses must blend into the live limb renderer');
assert.match(appSource, /function drawRestPoseDetails\s*\(/, 'rest poses must retain pose-specific illustrated coat details');
assert.match(visualHarnessSource, /window\.__poseSheet\s*=\s*\(\)\s*=>/, 'visual harness must expose the rest-pose contact sheet');
assert.ok(tailRibbonSource, 'tail ribbon renderer must remain discoverable');
assert.doesNotMatch(tailRibbonSource, /closePath\s*\(/, 'tail ribbon must stay open at its hidden root');
assert.match(legSilhouetteSource, /traceVariableRibbon\s*\(/, 'legs must render as variable-width closed silhouettes');
assert.match(pawSilhouetteSource, /bezierCurveTo\s*\(/, 'paws must use a soft illustrated contour');
assert.doesNotMatch(pawSilhouetteSource, /(?:ellipse|arc)\s*\(/, 'paws must not regress to geometric ovals');
assert.doesNotMatch(pawOutlineSource, /closePath\s*\(/, 'paw outline must keep the hidden ankle join open');
assert.match(drawLegsSource, /traceLegSilhouette\s*\(/, 'leg renderer must fill the continuous fur silhouette');
assert.match(drawLegsSource, /tracePawSilhouette\s*\(/, 'leg renderer must finish in an illustrated paw');
assert.match(drawLegsSource, /strokePawOutline\s*\(/, 'paw outline must leave the ankle join open');
assert.doesNotMatch(drawLegsSource, /traceLegPath|ctx\.(?:ellipse|arc)\s*\(/, 'visible limbs must not regress to stroked bones or oval feet');
assert.doesNotMatch(drawShadowSource, /traceLegPath|ctx\.(?:ellipse|arc)\s*\(/, 'cat shadow must follow the illustrated limb silhouettes');
assert.match(earRendererSource, /cat\.ears\.(?:left|right)/, 'ear renderer must consume independent ear poses');
assert.match(earRendererSource, /cat\.earPerk\.(?:left|right)/, 'ear renderer must consume independent perk poses');
assert.match(earRendererSource, /function earLandmarks\s*\(/, 'ear renderer must derive crown-attached landmarks');
assert.match(earRendererSource, /rotatePoint\(neutralTip\.x, neutralTip\.y, earAngle\(side\)\)/, 'each ear tip must swivel while its roots stay fixed');
assert.match(earRendererSource, /EAR_GEOMETRY\.tipForward/, 'ear silhouette must use the forward-axis geometry contract');
assert.match(earRendererSource, /EAR_GEOMETRY\.tipRound/, 'ear silhouette must round the tip instead of drawing a sharp horn point');
assert.match(earRendererSource, /function traceHeadSilhouette[\s\S]*traceEarCrown/, 'filled skull and ears must share one continuous silhouette');
assert.match(earRendererSource, /function traceHeadCrown[\s\S]*traceEarCrown/, 'visible skull and ears must share one continuous outline');
assert.doesNotMatch(earRendererSource, /earInner|traceInnerEar|traceEarAccent|traceEarSilhouette|applyEarPose/, 'ears must not regress to separately painted tabs or high-contrast inner cores');
assert.match(earMotionSource, /earFlickPulse\s*\(/, 'ear motion must retain independent short flicks');
assert.match(earMotionSource, /EAR_PERK_BY_STATE/, 'ear motion must retain state-dependent perk variation');
assert.match(drawBodySource, /strokeBodyFlanks\s*\(/, 'torso must stroke only its open side contours');
assert.doesNotMatch(drawBodySource, /ctx\.stroke\s*\(/, 'torso must not stroke its closed fill caps');
assert.doesNotMatch(bodyFlankSource, /closePath\s*\(|traceBodySilhouette\s*\(/, 'body flank strokes must stay open');
assert.equal((bodyFlankSource.match(/smoothOpenPath\s*\(/g) || []).length, 2, 'body must expose exactly two open flanks');
assert.equal((bodyFlankSource.match(/context\.stroke\s*\(/g) || []).length, 2, 'body must stroke each open flank once');
assert.ok(topDownFaceSource, 'top-down face renderer must remain discoverable');
assert.match(drawHeadSource, /drawTopDownFace\s*\(/, 'head must delegate its markings to the overhead face renderer');
assert.equal((topDownFaceSource.match(/ctx\.stroke\s*\(/g) || []).length, 2, 'overhead crown must keep only three sparse marks');
assert.doesNotMatch(topDownFaceSource, /eyeYaw|lidDrift|lidArch/, 'overhead crown must not expose visible eyes');
assert.doesNotMatch(
  topDownFaceSource,
  /c\.(?:eye|cream|pupil)|ctx\.(?:ellipse|arc)\s*\(/,
  'overhead cat face must not regress to portrait eyes, cheek patches, or highlights',
);
assert.doesNotMatch(
  drawHeadSource,
  /c\.(?:eye|cream|pupil|mouseEar)|ctx\.(?:ellipse|arc)\s*\(/,
  'cat head shell must remain free of face-on features',
);
// Overhead whiskers ARE a signature feline silhouette feature (they protrude
// visibly from directly above); they live in a dedicated helper called by drawHead.
assert.match(appSource, /function drawWhiskers\s*\(/, 'overhead whiskers helper must exist');
assert.match(drawHeadSource, /drawWhiskers\s*\(/, 'head must paint its protruding whiskers');
assert.match(drawHeadSource, /traceHeadSilhouette\s*\(/, 'head fill must include the crown-attached ears');
assert.match(drawHeadSource, /traceHeadCrown\s*\(/, 'head stroke must follow the integrated ear crown');
assert.doesNotMatch(drawHeadSource, /traceEar|forEach\(\(side\)/, 'head renderer must not paint detached ear pieces');
for (const [label, source] of [['tail', drawTailSource], ['body', drawBodySource], ['head', drawHeadSource]]) {
  assert.match(source, /ctx\.fillStyle\s*=\s*c\.fur\s*;/, `${label} must start from the shared base coat`);
}

function step(frames, milliseconds = 1000 / 60) {
  for (let index = 0; index < frames; index += 1) {
    clock += milliseconds;
    const callback = rafQueue.shift();
    assert.equal(typeof callback, 'function', 'animation loop must schedule the next frame');
    callback(clock);
  }
}

function finiteSnapshot(snapshot) {
  for (const value of [
    snapshot.cat.x, snapshot.cat.y, snapshot.cat.heading, snapshot.cat.speed,
    snapshot.cat.acceleration, snapshot.cat.steerOmega,
    snapshot.ears.left, snapshot.ears.right,
    snapshot.earPerk.left, snapshot.earPerk.right,
    snapshot.earGeometry.rearBaseForward, snapshot.earGeometry.frontBaseForward,
    snapshot.earGeometry.rearBaseOutward, snapshot.earGeometry.frontBaseOutward,
    snapshot.earGeometry.rootForward, snapshot.earGeometry.rootOutward,
    snapshot.earGeometry.tipForward, snapshot.earGeometry.tipOutward,
    snapshot.earGeometry.tipRound, snapshot.earGeometry.maxSwivel,
    snapshot.pounceGeometry.triggerMin, snapshot.pounceGeometry.triggerMax,
    snapshot.pounceGeometry.crouchAbort, snapshot.pounceGeometry.aimLeadSeconds,
    snapshot.pounceGeometry.forePawForward, snapshot.pounceGeometry.maxBodyTravel,
    snapshot.pounceGeometry.captureRadius,
    ...Object.values(snapshot.earLandmarks).flatMap((ear) => Object.values(ear).flatMap((point) => [point.x, point.y])),
    snapshot.mouse.x, snapshot.mouse.y, snapshot.mouse.speed,
    snapshot.rigScale, snapshot.turnVelocity, snapshot.rigCurvature,
    snapshot.skin.headSocketMargin, snapshot.skin.tailRootClearance, snapshot.skin.narrow,
    snapshot.poseEnvelope.left, snapshot.poseEnvelope.top,
    snapshot.poseEnvelope.right, snapshot.poseEnvelope.bottom,
    snapshot.support.foreBias, snapshot.support.hindBias, snapshot.support.combined,
    snapshot.idlePose.blend, snapshot.idlePose.side, snapshot.idlePose.rollWave,
    ...Object.values(snapshot.rig).flatMap((segment) => [
      segment.x, segment.y, segment.angle, segment.visualRadius,
    ]),
    ...Object.values(snapshot.phases),
    ...Object.values(snapshot.feet).flatMap((foot) => [
      foot.x, foot.y, foot.angle, foot.lift, foot.swingProgress, foot.reach, foot.reachLimit,
    ]),
    ...Object.values(snapshot.renderFeet).flatMap((foot) => [
      foot.x, foot.y, foot.angle, foot.lift, foot.reach, foot.reachLimit,
    ]),
    ...snapshot.tailPoints.flatMap((point) => [point.x, point.y]),
    snapshot.tailTip.x, snapshot.tailTip.y,
  ]) assert.ok(Number.isFinite(value), `runtime emitted a non-finite value: ${value}`);
}

function catLocalPoint(snapshot, point) {
  const dx = point.x - snapshot.cat.x;
  const dy = point.y - snapshot.cat.y;
  const c = Math.cos(snapshot.cat.heading);
  const s = Math.sin(snapshot.cat.heading);
  return {
    forward: dx * c + dy * s,
    lateral: -dx * s + dy * c,
  };
}

const rigNames = ['pelvis', 'waist', 'shoulders', 'neck', 'head'];
const rigJoints = [
  ['pelvis', 'waist', 31, 0.12],
  ['waist', 'shoulders', 32, 0.18],
  ['shoulders', 'neck', 18, 0.30],
  ['neck', 'head', 15, 0.42],
];

function angleDistance(from, to) {
  return Math.abs(sandbox.CatGait.angleDelta(from, to));
}

function assertRigSnapshot(snapshot, label = 'rig') {
  finiteSnapshot(snapshot);
  assert.ok(Math.abs(snapshot.cat.steerOmega) <= 2.4 + 1e-6, `${label}: steering velocity escaped its profile limit`);
  assert.ok(Math.abs(snapshot.ears.left) <= snapshot.earGeometry.maxSwivel + 1e-6, `${label}: left ear escaped its swivel stop`);
  assert.ok(Math.abs(snapshot.ears.right) <= snapshot.earGeometry.maxSwivel + 1e-6, `${label}: right ear escaped its swivel stop`);
  assert.ok(snapshot.earPerk.left >= 0.66 && snapshot.earPerk.left <= 1, `${label}: left ear perk escaped bounds`);
  assert.ok(snapshot.earPerk.right >= 0.66 && snapshot.earPerk.right <= 1, `${label}: right ear perk escaped bounds`);
  const neutralEarAngle = Math.atan2(snapshot.earGeometry.tipOutward, snapshot.earGeometry.tipForward);
  assert.ok(
    snapshot.earGeometry.tipForward > Math.abs(snapshot.earGeometry.tipOutward) * 1.7,
    `${label}: neutral ears no longer point primarily forward`,
  );
  assert.ok(
    neutralEarAngle >= 0.4 && neutralEarAngle <= 0.56,
    `${label}: neutral ear splay regressed to horns or side fins`,
  );
  assert.ok(
    snapshot.earGeometry.frontBaseForward - snapshot.earGeometry.rearBaseForward
      >= Math.abs(snapshot.earGeometry.tipOutward) * 1.9,
    `${label}: crown attachment became too narrow to read as a feline pinna`,
  );
  assert.ok(
    snapshot.earGeometry.tipRound >= 0.8 && snapshot.earGeometry.tipRound <= 1.8,
    `${label}: ear tip lost its restrained illustrated rounding`,
  );
  assert.ok(
    snapshot.earGeometry.rootForward + snapshot.earGeometry.tipForward >= 19
      && snapshot.earGeometry.rootForward + snapshot.earGeometry.tipForward <= 23,
    `${label}: neutral ear tips escaped their crown station`,
  );
  assert.ok(
    neutralEarAngle + snapshot.earGeometry.maxSwivel < Math.PI / 4,
    `${label}: full ear swivel can rotate a pinna sideways`,
  );
  for (const [earName, side] of [['left', -1], ['right', 1]]) {
    const ear = snapshot.earLandmarks[earName];
    const baseDx = ear.frontBase.x - ear.rearBase.x;
    const baseDy = ear.frontBase.y - ear.rearBase.y;
    const baseSpan = Math.hypot(baseDx, baseDy);
    const tipHeight = Math.abs(baseDx * (ear.tip.y - ear.rearBase.y) - baseDy * (ear.tip.x - ear.rearBase.x)) / baseSpan;
    const outerBase = Math.max(side * ear.rearBase.y, side * ear.frontBase.y);
    assert.ok(baseSpan >= 11 && baseSpan <= 13.5, `${label}: ${earName} ear lost its compact crown attachment`);
    assert.ok(tipHeight >= 6.5 && tipHeight <= 10.5, `${label}: ${earName} ear became a flat tab or a tall horn`);
    assert.ok(ear.tip.x > ear.frontBase.x + 1.8 && ear.tip.x < 22, `${label}: ${earName} ear tip stopped leading from the crown`);
    assert.ok(side * ear.tip.y > outerBase + 1.45, `${label}: ${earName} ear tip no longer clears the skull laterally`);
    assert.ok(ear.root.x > ear.rearBase.x && ear.root.x < ear.frontBase.x, `${label}: ${earName} ear root detached from its base span`);
  }
  assert.ok(
    Math.abs(snapshot.cat.acceleration) <= 300 * snapshot.rigScale + 1e-6,
    `${label}: acceleration escaped its profile limit`,
  );
  assert.ok(snapshot.skin.narrow >= 0.94 && snapshot.skin.narrow <= 1, `${label}: coat width transition escaped bounds`);
  assert.ok(Math.abs(snapshot.support.foreBias) <= 1.001, `${label}: fore support bias escaped bounds`);
  assert.ok(Math.abs(snapshot.support.hindBias) <= 1.001, `${label}: hind support bias escaped bounds`);
  assert.ok(
    Object.values(snapshot.feet).some((foot) => foot.planted) || snapshot.leapPhase === 'pounce',
    `${label}: all four paws left support outside a pounce`,
  );   // 扑击的意义就是短暂腾空：仅 pounce 相位允许四爪离地（短暂性由 edge 循环里的连击计数器约束）
  for (const [limb, foot] of Object.entries(snapshot.feet)) {
    assert.ok(foot.swingProgress >= 0 && foot.swingProgress <= 1, `${label}: ${limb} swing progress escaped bounds`);
    assert.ok(
      foot.reach <= foot.reachLimit + 1e-6,
      `${label}: ${limb} overextended (${foot.reach.toFixed(3)} > ${foot.reachLimit.toFixed(3)})`,
    );
  }
  const bendSigns = [];
  const bendDetails = [];
  // 姿态形变模型（与 app.js positionRigNodes/updateRig 的公式一一对应；改那边必须同步这里）：
  // sit/loaf/curl 压缩骨节前后距（俯视收拢）、stretch 拉长前躯，curl/sideLie/groom 解锁脊柱弯度。
  const poseW = (mode) => (snapshot.idlePose.visualMode === mode ? snapshot.idlePose.blend : 0);
  const poseStretchS = snapshot.idlePose.stretch || 0;
  const poseCompress = 1 - (poseW('sit') * 0.3 + poseW('loaf') * 0.34 + poseW('curl') * 0.1);
  const jointLengthFactor = {
    'pelvis-waist': poseCompress,
    'waist-shoulders': poseCompress * (1 + poseStretchS * 0.2),
    'shoulders-neck': (1 - poseW('sit') * 0.2 - poseW('loaf') * 0.3) * (1 + poseStretchS * 0.5),
    'neck-head': (1 - poseW('loaf') * 0.16) * (1 + poseStretchS * 0.35),
  };
  const bendFree = poseW('curl') * 0.85 + poseW('sideLie') * 0.3 + poseW('groom') * 0.3;
  const jointBendExtra = {
    'pelvis-waist': bendFree * 0.5,
    'waist-shoulders': bendFree * 0.5,
    'shoulders-neck': bendFree * 0.45,
    'neck-head': bendFree * 0.4,
  };
  for (const [parentName, childName, restLength, limit] of rigJoints) {
    const parent = snapshot.rig[parentName];
    const child = snapshot.rig[childName];
    const jointKey = `${parentName}-${childName}`;
    const distance = Math.hypot(child.x - parent.x, child.y - parent.y);
    const expected = restLength * jointLengthFactor[jointKey] * snapshot.rigScale;
    // 侧摆斜边：pelvis/shoulders 的骨节偏移带已知上界的侧向分量（支撑摆 + 蓄势摆臀 wiggle ±2.8），
    // 实测骨距 = hypot(纵向, 侧向) ≥ 纵向 —— 上界按 positionRigNodes 的摆幅公式推导。
    const swayBound = (jointKey === 'pelvis-waist' ? 2.35 + 0.42 + 2.8
      : jointKey === 'waist-shoulders' ? 1.55 + 0.28 : 0) * snapshot.rigScale;
    const expectedMax = Math.hypot(expected, swayBound);
    const tolerance = Math.max(0.45, expected * 0.012);
    assert.ok(
      distance >= expected - tolerance && distance <= expectedMax + tolerance,
      `${label}: ${parentName}-${childName} chain stretched`,
    );
    const signedBend = sandbox.CatGait.angleDelta(parent.angle, child.angle);
    bendDetails.push(`${parentName}-${childName}:${signedBend.toFixed(4)}`);
    assert.ok(
      Math.abs(signedBend) <= limit + jointBendExtra[jointKey] + 1e-6,
      `${label}: ${parentName}-${childName} exceeded joint limit`,
    );
    if (Math.abs(signedBend) >= 0.025) bendSigns.push(Math.sign(signedBend));
  }
  let signChanges = 0;
  for (let index = 1; index < bendSigns.length; index += 1) {
    if (bendSigns[index] !== bendSigns[index - 1]) signChanges += 1;
  }
  assert.ok(
    signChanges <= 1,
    `${label}: articulated spine became an S-shaped snake (${bendDetails.join(', ')})`,
  );
  const curvature = sandbox.CatGait.angleDelta(snapshot.rig.pelvis.angle, snapshot.rig.head.angle);
  // 总弯度上限随姿态解锁（与 updateRig 的 0.84 + bendFree*1.6 一致）：curl 全量 ≈2.2rad 的环卷是真实猫姿
  assert.ok(
    Math.abs(curvature) <= 0.84 + bendFree * 1.6 + 1e-6,
    `${label}: total rig curvature exceeded limit`,
  );
  assert.ok(Math.abs(curvature - snapshot.rigCurvature) < 1e-9, `${label}: reported curvature drifted`);
  assert.ok(snapshot.skin.headSocketMargin >= 0.08, `${label}: neck cap escaped the hidden skull socket`);
  assert.ok(snapshot.skin.tailRootClearance >= 3 * snapshot.rigScale, `${label}: tail root escaped the pelvis envelope`);
}

function assertHeadInsideViewport(snapshot, padding = 1) {
  const head = snapshot.rig.head;
  assert.ok(head.x - head.visualRadius >= padding, 'head/ears crossed left viewport edge');
  assert.ok(head.y - head.visualRadius >= padding, 'head/ears crossed top viewport edge');
  assert.ok(head.x + head.visualRadius <= snapshot.viewport.width - padding, 'head/ears crossed right viewport edge');
  assert.ok(head.y + head.visualRadius <= snapshot.viewport.height - padding, 'head/ears crossed bottom viewport edge');
}

assert.ok(sandbox.__catMouseDemo, 'debug/test surface must be available');
step(120);
let snapshot = sandbox.__catMouseDemo.getSnapshot();
assertRigSnapshot(snapshot, 'initial prowl');
assert.equal(snapshot.behavior, 'prowl');
assert.equal(snapshot.viewport.width, 1180);
assert.equal(snapshot.viewport.height, 720);
const initialEarPerkMean = (snapshot.earPerk.left + snapshot.earPerk.right) * 0.5;

let previousStance = snapshot;
for (let index = 0; index < 150; index += 1) {
  step(1);
  const current = sandbox.__catMouseDemo.getSnapshot();
  assertRigSnapshot(current, 'prowl');
  for (const limb of ['rightHind', 'rightFore', 'leftHind', 'leftFore']) {
    if (previousStance.feet[limb].planted && current.feet[limb].planted) {
      const slip = Math.hypot(
        current.feet[limb].x - previousStance.feet[limb].x,
        current.feet[limb].y - previousStance.feet[limb].y,
      );
      assert.ok(slip < 1e-7, `${limb} stance paw slipped ${slip}px`);
      assert.ok(
        Math.abs(current.feet[limb].angle - previousStance.feet[limb].angle) < 1e-12,
        `${limb} stance paw rotated in place`,
      );
    }
  }
  previousStance = current;
}

snapshot = sandbox.__catMouseDemo.getSnapshot();
const registeredHindSteps = snapshot.touchdowns.filter((touchdown) => (
  touchdown.limb.endsWith('Hind') && Number.isFinite(touchdown.registerError)
));
assert.ok(registeredHindSteps.length >= 1, 'slow walk must place a hind paw into a recorded fore-paw track');
const maxRegisterError = Math.max(...registeredHindSteps.map((touchdown) => touchdown.registerError));
assert.ok(
  maxRegisterError <= 7 * snapshot.rigScale,
  `hind-paw direct register drifted ${maxRegisterError.toFixed(3)}px: ${JSON.stringify(registeredHindSteps)}`,
);

sandbox.__catMouseDemo.moveMouse(snapshot.cat.x + 45, snapshot.cat.y);
let previousSettle = snapshot;
let sawSettleSwing = false;
for (let index = 0; index < 180; index += 1) {
  step(1);
  const current = sandbox.__catMouseDemo.getSnapshot();
  assertRigSnapshot(current, 'settling');
  for (const limb of ['rightHind', 'rightFore', 'leftHind', 'leftFore']) {
    if (!current.feet[limb].planted && current.feet[limb].lift > 0.02) sawSettleSwing = true;
    if (previousSettle.feet[limb].planted && current.feet[limb].planted) {
      const slip = Math.hypot(
        current.feet[limb].x - previousSettle.feet[limb].x,
        current.feet[limb].y - previousSettle.feet[limb].y,
      );
      assert.ok(slip < 1e-7, `${limb} planted paw slipped while settling`);
      assert.ok(
        Math.abs(current.feet[limb].angle - previousSettle.feet[limb].angle) < 1e-12,
        `${limb} planted paw rotated while settling`,
      );
    }
  }
  previousSettle = current;
}
snapshot = sandbox.__catMouseDemo.getSnapshot();
assertRigSnapshot(snapshot, 'settled watch');
assert.equal(snapshot.behavior, 'watch');
assert.ok(
  (snapshot.earPerk.left + snapshot.earPerk.right) * 0.5 > initialEarPerkMean + 0.1,
  'watching ears must visibly perk above the walking pose',
);
assert.ok(Object.values(snapshot.feet).every((foot) => foot.planted && foot.lift === 0));
assert.equal(sawSettleSwing, true, 'an airborne paw should finish with a lift-and-place motion');
sandbox.__catMouseDemo.releaseMouse();
step(30);

// A new off-axis target must travel down the articulated chain head-first,
// while already planted paws remain locked in world space during the turn.
const articulationBaseline = sandbox.__catMouseDemo.getSnapshot();
const articulationAngle = articulationBaseline.cat.heading + 0.70;
sandbox.__catMouseDemo.moveMouse(
  articulationBaseline.cat.x + Math.cos(articulationAngle) * 180,
  articulationBaseline.cat.y + Math.sin(articulationAngle) * 180,
);
const firstResponseFrame = Object.fromEntries(rigNames.map((name) => [name, null]));
let previousArticulation = articulationBaseline;
let maxExercisedNeckBend = 0;
for (let frameIndex = 0; frameIndex < 36; frameIndex += 1) {
  step(1);
  const current = sandbox.__catMouseDemo.getSnapshot();
  assertRigSnapshot(current, 'head-first articulation');
  maxExercisedNeckBend = Math.max(
    maxExercisedNeckBend,
    angleDistance(current.rig.neck.angle, current.rig.head.angle),
  );
  for (const name of rigNames) {
    const response = angleDistance(articulationBaseline.rig[name].angle, current.rig[name].angle);
    if (firstResponseFrame[name] === null && response >= 0.035) firstResponseFrame[name] = frameIndex;
  }
  for (const limb of ['rightHind', 'rightFore', 'leftHind', 'leftFore']) {
    if (previousArticulation.feet[limb].planted && current.feet[limb].planted) {
      const slip = Math.hypot(
        current.feet[limb].x - previousArticulation.feet[limb].x,
        current.feet[limb].y - previousArticulation.feet[limb].y,
      );
      assert.ok(slip < 1e-7, `${limb} stance paw slipped during articulated turn`);
      assert.ok(
        Math.abs(current.feet[limb].angle - previousArticulation.feet[limb].angle) < 1e-12,
        `${limb} stance paw rotated during articulated turn`,
      );
    }
  }
  previousArticulation = current;
}
for (const name of rigNames) assert.notEqual(firstResponseFrame[name], null, `${name} never responded to turn`);
assert.ok(firstResponseFrame.head <= firstResponseFrame.neck, 'head must respond before neck');
assert.ok(firstResponseFrame.neck <= firstResponseFrame.shoulders, 'neck must respond before shoulders');
assert.ok(firstResponseFrame.shoulders <= firstResponseFrame.waist, 'shoulders must respond before waist');
assert.ok(firstResponseFrame.waist <= firstResponseFrame.pelvis, 'waist must respond before pelvis');
assert.ok(firstResponseFrame.head + 3 <= firstResponseFrame.pelvis, 'head needs visible lead over pelvis');
assert.ok(maxExercisedNeckBend >= 0.2, 'skin topology gate must run under a meaningful head-neck bend');
sandbox.__catMouseDemo.releaseMouse();
step(30);

const canvas = ids.get('world');
canvas.dispatch('pointerenter', { clientX: 850, clientY: 310, timeStamp: clock, pointerType: 'mouse' });
step(12);
snapshot = sandbox.__catMouseDemo.getSnapshot();
assert.equal(snapshot.mouse.active, true);
assert.equal(snapshot.behavior, 'observe');

step(55);
canvas.dispatch('pointermove', { clientX: 1070, clientY: 190, timeStamp: clock + 16, pointerType: 'mouse' });
clock += 16;
canvas.dispatch('pointermove', { clientX: 780, clientY: 520, timeStamp: clock + 16, pointerType: 'mouse' });
step(24);
snapshot = sandbox.__catMouseDemo.getSnapshot();
assertRigSnapshot(snapshot, 'pursuit');
assert.ok(['chase', 'stalk'].includes(snapshot.behavior), `unexpected pursuit behavior: ${snapshot.behavior}`);

canvas.dispatch('keydown', { key: 'ArrowLeft', shiftKey: true });
canvas.dispatch('keydown', { key: ' ' });
snapshot = sandbox.__catMouseDemo.getSnapshot();
assert.equal(snapshot.paused, true);
canvas.dispatch('keydown', { key: ' ' });
assert.equal(sandbox.__catMouseDemo.getSnapshot().paused, false);
canvas.dispatch('keydown', { key: 'Escape' });
step(20);
snapshot = sandbox.__catMouseDemo.getSnapshot();
assert.equal(snapshot.mouse.active, false);
assert.equal(snapshot.behavior, 'prowl');

// The leap chain must be exercised FOR REAL: park a stationary target at the new
// far edge of the crouch window and let the cat coil, pounce and land. Repeating
// the same test input removes the synthetic pointer velocity without advancing a
// frame. The crouch must begin beyond the former 150-unit threshold, and the
// landing must put the mouse at the fore-paw midpoint rather than under the waist.
{
  snapshot = sandbox.__catMouseDemo.getSnapshot();
  const toCenterX = fakeViewportWidth * 0.5 - snapshot.cat.x;
  const toCenterY = fakeViewportHeight * 0.5 - snapshot.cat.y;
  const toCenter = Math.hypot(toCenterX, toCenterY);
  const directionX = toCenter > 0.001 ? toCenterX / toCenter : 1;
  const directionY = toCenter > 0.001 ? toCenterY / toCenter : 0;
  const targetDistance = snapshot.pounceGeometry.triggerMax * snapshot.rigScale;
  const targetX = snapshot.cat.x + directionX * targetDistance;
  const targetY = snapshot.cat.y + directionY * targetDistance;
  for (let repeat = 0; repeat < 16; repeat += 1) {
    sandbox.__catMouseDemo.moveMouse(targetX, targetY);
  }
  const seenLeap = new Set();
  let leapPounceRun = 0;
  let maxLeapPounceRun = 0;
  let crouchEntry = null;
  let landing = null;
  for (let frameIndex = 0; frameIndex < 300; frameIndex += 1) {
    step(1);
    const current = sandbox.__catMouseDemo.getSnapshot();
    assertRigSnapshot(current, 'leap chain');
    if (current.leapPhase) seenLeap.add(current.leapPhase);
    if (current.leapPhase === 'crouch' && !crouchEntry) crouchEntry = current;
    if (current.leapPhase === 'land' && !landing) landing = current;
    leapPounceRun = current.leapPhase === 'pounce' ? leapPounceRun + 1 : 0;
    maxLeapPounceRun = Math.max(maxLeapPounceRun, leapPounceRun);
    const anyPlanted = Object.values(current.feet).some((foot) => foot.planted);
    assert.ok(anyPlanted || current.leapPhase === 'pounce', 'all-airborne outside the pounce phase');
    if (seenLeap.has('land') && !current.leapPhase) break;
  }
  assert.ok(seenLeap.has('crouch'), 'stationary near target must trigger a crouch');
  assert.ok(seenLeap.has('pounce'), 'crouch must release into a pounce');
  assert.ok(seenLeap.has('land'), 'pounce must land');
  assert.ok(maxLeapPounceRun > 0 && maxLeapPounceRun <= 32, `pounce suspension out of bounds (${maxLeapPounceRun} frames)`);
  const formerTriggerMax = 150 * crouchEntry.rigScale;
  const crouchDistance = Math.hypot(
    crouchEntry.mouse.x - crouchEntry.cat.x,
    crouchEntry.mouse.y - crouchEntry.cat.y,
  );
  assert.ok(
    crouchDistance > formerTriggerMax,
    `pounce did not start farther away (${crouchDistance.toFixed(2)} <= ${formerTriggerMax.toFixed(2)})`,
  );
  const forePawMidpoint = {
    x: (landing.feet.rightFore.x + landing.feet.leftFore.x) * 0.5,
    y: (landing.feet.rightFore.y + landing.feet.leftFore.y) * 0.5,
  };
  const pawCaptureDistance = Math.hypot(
    landing.mouse.x - forePawMidpoint.x,
    landing.mouse.y - forePawMidpoint.y,
  );
  const bodyCaptureDistance = Math.hypot(
    landing.mouse.x - landing.cat.x,
    landing.mouse.y - landing.cat.y,
  );
  const headingX = Math.cos(landing.cat.heading);
  const headingY = Math.sin(landing.cat.heading);
  const bodyToMouseForward = (landing.mouse.x - landing.cat.x) * headingX
    + (landing.mouse.y - landing.cat.y) * headingY;
  assert.ok(
    pawCaptureDistance <= 12 * landing.rigScale,
    `mouse missed the fore-paw capture zone by ${pawCaptureDistance.toFixed(2)}px`,
  );
  assert.ok(
    pawCaptureDistance * 2 < bodyCaptureDistance,
    'mouse must be materially closer to the fore paws than the body center',
  );
  assert.ok(
    Math.abs(bodyToMouseForward - landing.pounceGeometry.forePawForward * landing.rigScale)
      <= 8 * landing.rigScale,
    `body landing offset missed the fore-paw station (${bodyToMouseForward.toFixed(2)}px)`,
  );
  sandbox.__catMouseDemo.releaseMouse();
  step(30);
}

// Every illustrated rest pose gets a deterministic preview pass. This is both a
// runtime gate and the control surface used by visual-harness screenshots: the
// poses must remain distinct in paw layout, spine/tail gesture and layer order.
{
  const poses = [
    ['sit', 1],
    ['loaf', -1],
    ['sideLie', 1],
    ['roll', -1],
    ['curl', 1],
  ];
  for (const [mode, side] of poses) {
    sandbox.__catMouseDemo.previewIdlePose(mode, side);
    step(150);
    const current = sandbox.__catMouseDemo.getSnapshot();
    assert.equal(current.behavior, mode, `${mode}: preview did not hold its behavior`);
    assert.equal(current.idleMode, mode, `${mode}: idle state was not active`);
    assert.equal(current.idlePose.visualMode, mode, `${mode}: visual pose was not active`);
    assert.ok(current.idlePose.blend > 0.995, `${mode}: pose transition did not settle`);
    assert.equal(current.idlePose.side, side, `${mode}: requested side was not preserved`);
    assertRigSnapshot(current, `${mode} rest pose`);
    assert.ok(current.poseEnvelope.left >= -1, `${mode}: pose escaped the left edge`);
    assert.ok(current.poseEnvelope.top >= -1, `${mode}: pose escaped the top edge`);
    assert.ok(current.poseEnvelope.right <= current.viewport.width + 1, `${mode}: pose escaped the right edge`);
    assert.ok(current.poseEnvelope.bottom <= current.viewport.height + 1, `${mode}: pose escaped the bottom edge`);
    for (const [limb, foot] of Object.entries(current.renderFeet)) {
      assert.ok(foot.reach <= foot.reachLimit + 1e-6, `${mode}: rendered ${limb} escaped anatomical reach`);
    }

    if (mode === 'sit') {
      const hindSpan = Math.hypot(
        current.renderFeet.rightHind.x - current.renderFeet.leftHind.x,
        current.renderFeet.rightHind.y - current.renderFeet.leftHind.y,
      );
      const foreSpan = Math.hypot(
        current.renderFeet.rightFore.x - current.renderFeet.leftFore.x,
        current.renderFeet.rightFore.y - current.renderFeet.leftFore.y,
      );
      assert.ok(hindSpan > foreSpan * 1.8, 'sit: haunches must spread wider than the paired fore paws');
    } else if (mode === 'loaf') {
      const furthestPaw = Math.max(...Object.values(current.renderFeet).map((foot) => (
        Math.hypot(foot.x - current.cat.x, foot.y - current.cat.y)
      )));
      assert.ok(furthestPaw < 43 * current.rigScale, 'loaf: paws must tuck beneath the compact body');
    } else if (mode === 'sideLie') {
      const signedLaterals = Object.values(current.renderFeet).map((foot) => (
        catLocalPoint(current, foot).lateral * side
      ));
      assert.ok(Math.min(...signedLaterals) > 5 * current.rigScale, 'sideLie: all paws must settle to the lying side');
      assert.equal(
        Object.values(current.renderFeet).filter((foot) => foot.layer === 'over').length,
        2,
        'sideLie: exactly the upper pair of legs should cross the body',
      );
    } else if (mode === 'roll') {
      assert.ok(
        Object.values(current.renderFeet).every((foot) => foot.lift > 0.45 && foot.layer === 'over'),
        'roll: all four paws must lift above the belly',
      );
    } else if (mode === 'curl') {
      assert.ok(side * current.rigCurvature > 0.48, 'curl: spine must form a clear C-shaped bend');
      const tail = current.tailPoints;
      const firstHeading = Math.atan2(tail[2].y - tail[1].y, tail[2].x - tail[1].x);
      const lastHeading = Math.atan2(
        tail[tail.length - 1].y - tail[tail.length - 2].y,
        tail[tail.length - 1].x - tail[tail.length - 2].x,
      );
      const tailTurn = sandbox.CatGait.angleDelta(firstHeading, lastHeading) * side;
      assert.ok(tailTurn > 1.35, `curl: tail did not wrap around the body (${tailTurn.toFixed(3)})`);
    }
    sandbox.__catMouseDemo.clearIdlePose();
    step(8);
    const exiting = sandbox.__catMouseDemo.getSnapshot();
    assert.ok(exiting.idlePose.blend > 0.08, `${mode}: exit transition collapsed in one frame`);
    assert.ok(exiting.cat.speed < 0.01, `${mode}: cat started walking before the pose released`);
    step(37);
    const cleared = sandbox.__catMouseDemo.getSnapshot();
    assert.equal(cleared.behavior, 'prowl', `${mode}: clearing the pose did not resume prowl`);
    assert.equal(cleared.idlePose.visualMode, null, `${mode}: visual pose leaked after exit`);
    assert.equal(cleared.idlePose.blend, 0, `${mode}: pose blend did not settle back to zero`);
    assertRigSnapshot(cleared, `${mode} pose exit`);
  }
}

// The unforced idle scheduler must also fire on its own with no target; forced
// preview coverage above does not substitute for the real wander/dwell rhythm.
{
  const seenIdle = new Set();
  const hasExpanded = () => [...seenIdle].some((mode) => ['loaf', 'sideLie', 'roll', 'curl'].includes(mode));
  for (let frameIndex = 0; frameIndex < 9000 && !(seenIdle.size >= 2 && hasExpanded()); frameIndex += 1) {   // 时长/链化后闲态单集更长 → 放宽观察窗（确定性时间线，非侥幸重试）
    step(1);
    const current = sandbox.__catMouseDemo.getSnapshot();
    assertRigSnapshot(current, 'idle repertoire');
    if (current.idleMode) seenIdle.add(current.idleMode);
  }
  assert.ok(seenIdle.size >= 2, 'wander rhythm did not produce varied idle episodes');
  assert.ok(
    [...seenIdle].some((mode) => ['loaf', 'sideLie', 'roll', 'curl'].includes(mode)),
    'wander rhythm never selected an expanded illustrated rest pose',
  );
}

// Reproduce the user's 548x536 compact screenshot and drive the target to all
// four edges. The full head radius includes the compact ear tips.
assert.equal(typeof resizeObserverCallback, 'function');
fakeViewportWidth = 548;
fakeViewportHeight = 536;
resizeObserverCallback();
step(1);
snapshot = sandbox.__catMouseDemo.getSnapshot();
assert.equal(snapshot.viewport.width, 548);
assert.equal(snapshot.viewport.height, 536);
assertRigSnapshot(snapshot, 'compact resize');
assertHeadInsideViewport(snapshot);
for (const [mode, side] of [['sit', -1], ['loaf', 1], ['sideLie', -1], ['roll', 1], ['curl', -1]]) {
  sandbox.__catMouseDemo.previewIdlePose(mode, side);
  step(120);
  const compactPose = sandbox.__catMouseDemo.getSnapshot();
  assertRigSnapshot(compactPose, `compact ${mode} pose`);
  assert.ok(compactPose.poseEnvelope.left >= -1, `compact ${mode}: escaped left edge`);
  assert.ok(compactPose.poseEnvelope.top >= -1, `compact ${mode}: escaped top edge`);
  assert.ok(compactPose.poseEnvelope.right <= compactPose.viewport.width + 1, `compact ${mode}: escaped right edge`);
  assert.ok(compactPose.poseEnvelope.bottom <= compactPose.viewport.height + 1, `compact ${mode}: escaped bottom edge`);
  sandbox.__catMouseDemo.clearIdlePose();
  step(36);
}
const edgeTargets = [
  [fakeViewportWidth * 0.5, 8],
  [fakeViewportWidth - 8, fakeViewportHeight * 0.5],
  [fakeViewportWidth * 0.5, fakeViewportHeight - 8],
  [8, fakeViewportHeight * 0.5],
];
let sawReachRecovery = false;
let pounceRun = 0;
let earAimMin = Infinity;
let earAimMax = -Infinity;
let maxEarAsymmetry = 0;
let maxPerkAsymmetry = 0;
for (const [targetX, targetY] of edgeTargets) {
  sandbox.__catMouseDemo.moveMouse(targetX, targetY);
  for (let frameIndex = 0; frameIndex < 240; frameIndex += 1) {
    step(1);
    const current = sandbox.__catMouseDemo.getSnapshot();
    assertRigSnapshot(current, 'compact edge pursuit');
    assertHeadInsideViewport(current);
    const earAim = (current.ears.left + current.ears.right) * 0.5;
    earAimMin = Math.min(earAimMin, earAim);
    earAimMax = Math.max(earAimMax, earAim);
    maxEarAsymmetry = Math.max(maxEarAsymmetry, Math.abs(current.ears.left - current.ears.right));
    maxPerkAsymmetry = Math.max(maxPerkAsymmetry, Math.abs(current.earPerk.left - current.earPerk.right));
    if (Object.values(current.feet).some((foot) => foot.recoveryActive)) sawReachRecovery = true;
    pounceRun = current.leapPhase === 'pounce' ? pounceRun + 1 : 0;
    assert.ok(pounceRun <= 32, 'pounce suspension must stay a brief ballistic arc');
  }
  sandbox.__catMouseDemo.releaseMouse();
  step(24);
}
assert.equal(sawReachRecovery, true, 'compact edge turns must exercise anatomical reach recovery');
assert.ok(earAimMin < -0.025 && earAimMax > 0.025, 'ears must swivel toward targets on both sides of the head');
assert.ok(maxEarAsymmetry > 0.008, 'target-side ear must lead instead of moving as a rigid pair');
assert.ok(maxPerkAsymmetry > 0.008, 'target-side ear must perk independently');

for (const [rate, targetX, targetY] of [
  [30, 8, 8],
  [120, fakeViewportWidth - 8, fakeViewportHeight - 8],
]) {
  sandbox.__catMouseDemo.moveMouse(targetX, targetY);
  for (let frameIndex = 0; frameIndex < rate * 2; frameIndex += 1) {
    step(1, 1000 / rate);
    const current = sandbox.__catMouseDemo.getSnapshot();
    assertRigSnapshot(current, `${rate} Hz compact turn`);
    assertHeadInsideViewport(current);
  }
  sandbox.__catMouseDemo.releaseMouse();
  step(Math.round(rate * 0.4), 1000 / rate);
}

ids.get('language-toggle').dispatch('click');
assert.equal(documentElement.lang, 'en');
ids.get('theme-toggle').dispatch('click');
assert.equal(documentElement.classList.contains('dark'), true);
ids.get('pause-toggle').dispatch('click');
assert.equal(sandbox.__catMouseDemo.getSnapshot().paused, true);
clock += 16;
const pausedFrame = rafQueue.shift();
assert.equal(typeof pausedFrame, 'function');
pausedFrame(clock);
assert.equal(rafQueue.length, 0, 'paused canvas must stop scheduling animation frames');
ids.get('pause-toggle').dispatch('click');
assert.equal(sandbox.__catMouseDemo.getSnapshot().paused, false);
assert.equal(rafQueue.length, 1, 'resuming must restart the animation loop');

function tailDecay(rate) {
  let velocity = 1;
  for (let index = 0; index < rate; index += 1) velocity *= Math.pow(0.84, (1 / rate) * 60);
  return velocity;
}
assert.ok(Math.abs(tailDecay(30) - tailDecay(60)) < 1e-12);
assert.ok(Math.abs(tailDecay(60) - tailDecay(120)) < 1e-12);

const failureElements = new Map([
  ['world', new FakeElement('world')],
  ['canvas-error', new FakeElement('canvas-error')],
  ['behavior-label', new FakeElement('behavior-label')],
  ['gait-name', new FakeElement('gait-name')],
  ['pause-toggle', new FakeElement('pause-toggle')],
  ['theme-toggle', new FakeElement('theme-toggle')],
]);
failureElements.get('world').getContext = () => { throw new Error('simulated Canvas failure'); };
const failureHtml = new FakeElement('html');
const failureThemeMeta = new FakeElement();
let failureLanguage = 'zh';
const failureListeners = [];
const failureLabels = {
  canvasFailure: { zh: '画布失败', en: 'Canvas failed' },
  themeLightAria: { zh: '浅色', en: 'Light' },
  themeDarkAria: { zh: '深色', en: 'Dark' },
  themeLightTitle: { zh: '浅色', en: 'Light' },
  themeDarkTitle: { zh: '深色', en: 'Dark' },
};
const failureI18n = {
  t(key) { return failureLabels[key]?.[failureLanguage] ?? key; },
  onChange(listener) { failureListeners.push(listener); },
};
const failureDocument = {
  documentElement: failureHtml,
  body: new FakeElement('body'),
  getElementById(id) { return failureElements.get(id) || null; },
  querySelector(selector) { return selector === 'meta[name="theme-color"]' ? failureThemeMeta : null; },
};
const failureSandbox = {
  window: null,
  globalThis: null,
  document: failureDocument,
  localStorage: { setItem() {} },
  console,
};
failureSandbox.window = failureSandbox;
failureSandbox.globalThis = failureSandbox;
failureSandbox.CatGait = {};
failureSandbox.CatMouseI18n = failureI18n;
vm.createContext(failureSandbox);
vm.runInContext(fs.readFileSync(path.join(demo, 'assets/js/app.js'), 'utf8'), failureSandbox, { filename: 'app-failure.js' });
assert.equal(failureElements.get('canvas-error').hidden, false);
assert.equal(failureElements.get('canvas-error').textContent, '画布失败');
assert.equal(failureElements.get('pause-toggle').hidden, true);
assert.equal(failureElements.get('pause-toggle').disabled, true);
failureElements.get('theme-toggle').dispatch('click');
assert.equal(failureHtml.classList.contains('dark'), true);
failureLanguage = 'en';
failureListeners.forEach((listener) => listener());
assert.equal(failureElements.get('canvas-error').textContent, 'Canvas failed');
assert.equal(failureElements.get('theme-toggle').getAttribute('title'), 'Light');

console.log('check-runtime: five illustrated rest poses, fore-paw pounce capture, crown-integrated ears, seamless coat, bounded spine, anatomical reach, 548x536 edges, and UI OK');
