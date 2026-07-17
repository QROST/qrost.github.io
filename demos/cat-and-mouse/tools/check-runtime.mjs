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
assert.match(earRendererSource, /context\.rotate\s*\(earAngle\(side\)\)/, 'each ear silhouette must swivel around its root');
assert.match(earRendererSource, /EAR_GEOMETRY\.tipForward/, 'ear silhouette must use the forward-axis geometry contract');
assert.match(earRendererSource, /EAR_GEOMETRY\.tipRound/, 'ear silhouette must round the tip instead of drawing a sharp horn point');
assert.doesNotMatch(earRendererSource, /earInner|traceInnerEar|traceEarAccent/, 'ears must not regress to high-contrast horn-like inner cores');
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
  /c\.(?:eye|cream|pupil|whisker)|ctx\.(?:ellipse|arc)\s*\(/,
  'overhead cat face must not regress to portrait eyes, cheek patches, highlights, or whiskers',
);
assert.doesNotMatch(
  drawHeadSource,
  /c\.(?:eye|cream|pupil|mouseEar|whisker)|ctx\.(?:ellipse|arc)\s*\(/,
  'cat head shell must remain free of face-on features',
);
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
    snapshot.earGeometry.rootForward, snapshot.earGeometry.tipForward,
    snapshot.earGeometry.tipOutward, snapshot.earGeometry.tipRound,
    snapshot.earGeometry.baseOutward, snapshot.earGeometry.maxSwivel,
    snapshot.mouse.x, snapshot.mouse.y, snapshot.mouse.speed,
    snapshot.rigScale, snapshot.turnVelocity, snapshot.rigCurvature,
    snapshot.skin.headSocketMargin, snapshot.skin.tailRootClearance, snapshot.skin.narrow,
    snapshot.support.foreBias, snapshot.support.hindBias, snapshot.support.combined,
    ...Object.values(snapshot.rig).flatMap((segment) => [
      segment.x, segment.y, segment.angle, segment.visualRadius,
    ]),
    ...Object.values(snapshot.phases),
    ...Object.values(snapshot.feet).flatMap((foot) => [
      foot.x, foot.y, foot.angle, foot.lift, foot.swingProgress, foot.reach, foot.reachLimit,
    ]),
    snapshot.tailTip.x, snapshot.tailTip.y,
  ]) assert.ok(Number.isFinite(value), `runtime emitted a non-finite value: ${value}`);
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
    snapshot.earGeometry.tipForward > Math.abs(snapshot.earGeometry.tipOutward) * 1.8,
    `${label}: neutral ears no longer point primarily forward`,
  );
  assert.ok(
    neutralEarAngle >= 0.24 && neutralEarAngle <= 0.52,
    `${label}: neutral ear splay regressed to horns or side fins`,
  );
  assert.ok(
    snapshot.earGeometry.tipForward < snapshot.earGeometry.baseOutward * 1.5,
    `${label}: ear triangle became too tall and narrow`,
  );
  assert.ok(
    snapshot.earGeometry.baseOutward >= Math.abs(snapshot.earGeometry.tipOutward) * 1.75,
    `${label}: ear root became too narrow to read as a feline pinna`,
  );
  assert.ok(
    snapshot.earGeometry.tipRound >= 0.8 && snapshot.earGeometry.tipRound <= 1.8,
    `${label}: ear tip lost its restrained illustrated rounding`,
  );
  assert.ok(
    snapshot.earGeometry.rootForward + snapshot.earGeometry.tipForward > 21.1,
    `${label}: ear tips no longer clear the forehead`,
  );
  assert.ok(
    neutralEarAngle + snapshot.earGeometry.maxSwivel < Math.PI / 4,
    `${label}: full ear swivel can rotate a pinna sideways`,
  );
  assert.ok(
    Math.abs(snapshot.cat.acceleration) <= 300 * snapshot.rigScale + 1e-6,
    `${label}: acceleration escaped its profile limit`,
  );
  assert.ok(snapshot.skin.narrow >= 0.94 && snapshot.skin.narrow <= 1, `${label}: coat width transition escaped bounds`);
  assert.ok(Math.abs(snapshot.support.foreBias) <= 1.001, `${label}: fore support bias escaped bounds`);
  assert.ok(Math.abs(snapshot.support.hindBias) <= 1.001, `${label}: hind support bias escaped bounds`);
  assert.ok(Object.values(snapshot.feet).some((foot) => foot.planted), `${label}: all four paws left support at once`);
  for (const [limb, foot] of Object.entries(snapshot.feet)) {
    assert.ok(foot.swingProgress >= 0 && foot.swingProgress <= 1, `${label}: ${limb} swing progress escaped bounds`);
    assert.ok(
      foot.reach <= foot.reachLimit + 1e-6,
      `${label}: ${limb} overextended (${foot.reach.toFixed(3)} > ${foot.reachLimit.toFixed(3)})`,
    );
  }
  const bendSigns = [];
  const bendDetails = [];
  for (const [parentName, childName, restLength, limit] of rigJoints) {
    const parent = snapshot.rig[parentName];
    const child = snapshot.rig[childName];
    const distance = Math.hypot(child.x - parent.x, child.y - parent.y);
    const expected = restLength * snapshot.rigScale;
    const tolerance = Math.max(0.45, expected * 0.012);
    assert.ok(Math.abs(distance - expected) <= tolerance, `${label}: ${parentName}-${childName} chain stretched`);
    const signedBend = sandbox.CatGait.angleDelta(parent.angle, child.angle);
    bendDetails.push(`${parentName}-${childName}:${signedBend.toFixed(4)}`);
    assert.ok(Math.abs(signedBend) <= limit + 1e-6, `${label}: ${parentName}-${childName} exceeded joint limit`);
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
  assert.ok(Math.abs(curvature) <= 0.84 + 1e-6, `${label}: total rig curvature exceeded limit`);
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
const edgeTargets = [
  [fakeViewportWidth * 0.5, 8],
  [fakeViewportWidth - 8, fakeViewportHeight * 0.5],
  [fakeViewportWidth * 0.5, fakeViewportHeight - 8],
  [8, fakeViewportHeight * 0.5],
];
let sawReachRecovery = false;
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

console.log('check-runtime: short broad cat ears, illustrated paws, seamless coat, bounded spine, anatomical reach, 548x536 edges, and UI OK');
