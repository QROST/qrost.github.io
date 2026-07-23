#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const demo = path.resolve(here, '..');
let fakeViewportWidth = 1180;
let fakeViewportHeight = 720;
let fakePreviewSize = 168;
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
    this.className = '';
    this.dataset = {};
    this.style = { setProperty() {} };
    this.listeners = new Map();
    this.textContent = '';
    this.content = '';
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.options = [];
    this.focused = false;
    this.children = [];
    this._innerHTML = '';
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
  focus() { this.focused = true; }
  click() { this.dispatch('click'); }
  contains(node) {
    if (node === this) return true;
    return this.children.some((child) => child === node || (child && typeof child.contains === 'function' && child.contains(node)));
  }
  setPointerCapture() {}
  releasePointerCapture() {}
  appendChild(node) {
    this.children = this.children.filter((child) => child !== node);
    node.parentElement = this;
    this.children.push(node);
    return node;
  }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }
  querySelector(selector) {
    // Visual grids in the appearance panel use [data-key="..."] selectors. The
    // sandbox does not keep a real DOM tree, so let ensureChild create fresh
    // nodes on each first access and re-use them on subsequent passes.
    if (typeof selector === 'string' && selector.startsWith('[data-key=')) {
      const match = selector.match(/\[data-key="([^"]+)"\]/);
      if (!match) return null;
      const key = match[1];
      return this.children.find((child) => child && child.getAttribute('data-key') === key) || null;
    }
    return null;
  }
  querySelectorAll(selector) {
    if (typeof selector === 'string' && selector.startsWith('.')) {
      const name = selector.slice(1);
      return this.children.filter((child) => child && (
        (child.classList && child.classList.contains(name)) || String(child.className || '').split(/\s+/).includes(name)
      ));
    }
    if (selector === '[role="radio"]') {
      return this.children.filter((child) => child && child.getAttribute('role') === 'radio');
    }
    return [];
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(value) { this._innerHTML = String(value || ''); }
  get clientWidth() { return this.id === 'appearance-preview' ? fakePreviewSize : 168; }
  get clientHeight() { return this.id === 'appearance-preview' ? fakePreviewSize : 168; }
}

const contextCalls = [];
const contextPathCalls = [];
let recordContextCalls = false;
const contextMethods = new Proxy({}, {
  get(target, property) {
    if (!(property in target)) {
      target[property] = (...args) => {
        if (property === 'beginPath') {
          target.__pathQuadraticCount = 0;
          target.__pathBezierCount = 0;
          target.__pathClosed = false;
        }
        else if (property === 'quadraticCurveTo') {
          target.__pathQuadraticCount = (target.__pathQuadraticCount || 0) + 1;
        }
        else if (property === 'bezierCurveTo') {
          target.__pathBezierCount = (target.__pathBezierCount || 0) + 1;
        }
        else if (property === 'closePath') target.__pathClosed = true;
        if (recordContextCalls && (property === 'fill' || property === 'stroke')) {
          contextPathCalls.push({
            property: String(property),
            fillStyle: target.fillStyle,
            strokeStyle: target.strokeStyle,
            globalAlpha: target.globalAlpha,
            lineWidth: target.lineWidth,
            pathQuadraticCount: target.__pathQuadraticCount || 0,
            pathBezierCount: target.__pathBezierCount || 0,
            pathClosed: Boolean(target.__pathClosed),
          });
        }
        if (recordContextCalls) {
          contextCalls.push({
            property: String(property),
            args,
            fillStyle: target.fillStyle,
            strokeStyle: target.strokeStyle,
            globalAlpha: target.globalAlpha,
            lineWidth: target.lineWidth,
            pathQuadraticCount: target.__pathQuadraticCount || 0,
          });
        }
        return undefined;
      };
    }
    return target[property];
  },
  set(target, property, value) { target[property] = value; return true; },
});

const previewContextCalls = [];
const previewPathCalls = [];
let recordPreviewContextCalls = false;
const previewContextMethods = new Proxy({}, {
  get(target, property) {
    if (!(property in target)) {
      target[property] = (...args) => {
        if (property === 'beginPath') {
          target.__pathQuadraticCount = 0;
          target.__pathBezierCount = 0;
          target.__pathClosed = false;
        }
        else if (property === 'quadraticCurveTo') {
          target.__pathQuadraticCount = (target.__pathQuadraticCount || 0) + 1;
        }
        else if (property === 'bezierCurveTo') {
          target.__pathBezierCount = (target.__pathBezierCount || 0) + 1;
        }
        else if (property === 'closePath') target.__pathClosed = true;
        if (recordPreviewContextCalls && (property === 'fill' || property === 'stroke')) {
          previewPathCalls.push({
            property: String(property),
            fillStyle: target.fillStyle,
            strokeStyle: target.strokeStyle,
            globalAlpha: target.globalAlpha,
            lineWidth: target.lineWidth,
            pathQuadraticCount: target.__pathQuadraticCount || 0,
            pathBezierCount: target.__pathBezierCount || 0,
            pathClosed: Boolean(target.__pathClosed),
          });
        }
        if (recordPreviewContextCalls) {
          previewContextCalls.push({
            property: String(property),
            args,
            fillStyle: target.fillStyle,
            strokeStyle: target.strokeStyle,
            globalAlpha: target.globalAlpha,
            lineWidth: target.lineWidth,
            pathQuadraticCount: target.__pathQuadraticCount || 0,
          });
        }
        return undefined;
      };
    }
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
  'world', 'canvas-error', 'behavior-label', 'pause-toggle', 'theme-toggle',
  'language-toggle', 'keyboard-instructions', 'appearance-toggle', 'appearance-panel',
  'appearance-close', 'appearance-pattern', 'appearance-colorway', 'appearance-white-level',
  'appearance-fur-length', 'appearance-randomize', 'appearance-reset',
  'appearance-preview', 'appearance-pattern-grid', 'appearance-colorway-grid',
  'appearance-colorway-meta', 'appearance-colorway-empty', 'appearance-white-level-group',
  'appearance-white-level-row',
]) ids.set(id, new FakeElement(id));
ids.get('world').getContext = () => contextMethods;
ids.get('appearance-preview').getContext = () => previewContextMethods;
ids.get('appearance-panel').hidden = true;

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
  createElement(tag) { return new FakeElement(typeof tag === 'string' ? tag : ''); },
  createElementNS(ns, tag) { return new FakeElement(typeof tag === 'string' ? tag : ''); },
  querySelector(selector) { return metas[selector] || null; },
  querySelectorAll(selector) {
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
for (const relative of ['assets/js/i18n.js', 'assets/js/gait.js', 'assets/js/appearance.js', 'assets/js/app.js']) {
  const source = fs.readFileSync(path.join(demo, relative), 'utf8');
  loadedSources.set(relative, source);
  vm.runInContext(source, sandbox, { filename: relative });
}
document.dispatch('DOMContentLoaded');

// Renderer topology is checked structurally because a fake Canvas cannot
// reliably distinguish an internal cap line from an external silhouette.
const appSource = loadedSources.get('assets/js/app.js');
const appearanceSource = loadedSources.get('assets/js/appearance.js');
const indexSource = fs.readFileSync(path.join(demo, 'index.html'), 'utf8');
const cssSource = fs.readFileSync(path.join(demo, 'assets', 'css', 'cat-and-mouse.css'), 'utf8');
const visualHarnessSource = fs.readFileSync(path.join(demo, 'tools/visual-harness.html'), 'utf8');
const shelterEnums = JSON.parse(fs.readFileSync(path.join(demo, '..', 'shelter-cats', 'assets', 'data', 'enums.json'), 'utf8'));
const tailRibbonSource = appSource.match(/function traceTailRibbon[\s\S]*?(?=\n  function tailRenderPoints)/)?.[0] || '';
const limbEnvelopeSource = appSource.match(/function limbCoatEnvelopeSamples[\s\S]*?(?=\n  function traceLegSilhouette)/)?.[0] || '';
const legSilhouetteSource = appSource.match(/function traceLegSilhouette[\s\S]*?(?=\n  function tracePawSilhouette)/)?.[0] || '';
const pawSilhouetteSource = appSource.match(/function tracePawSilhouette[\s\S]*?(?=\n  function strokePawOutline)/)?.[0] || '';
const pawOutlineSource = appSource.match(/function strokePawOutline[\s\S]*?(?=\n  function strokePawToes)/)?.[0] || '';
const earRendererSource = appSource.match(/function earAngle[\s\S]*?(?=\n  function drawCatShadow)/)?.[0] || '';
const earMotionSource = appSource.match(/function updateCat[\s\S]*?(?=\n  function planPawSwing)/)?.[0] || '';
const bodyFlankSource = appSource.match(/function strokeBodyFlanks[\s\S]*?(?=\n  function traceBodyFlankBand)/)?.[0] || '';
const drawShadowSource = appSource.match(/function drawCatShadow[\s\S]*?(?=\n  function (?:paintTailCoat|drawTail))/)?.[0] || '';
const drawTailSource = appSource.match(/function drawTail[\s\S]*?(?=\n  function drawLegs)/)?.[0] || '';
const drawLegsSource = appSource.match(/function drawLegs[\s\S]*?(?=\n  function bodyStations)/)?.[0] || '';
const tailFurFlowSource = appSource.match(/function paintTailFurFlow[\s\S]*?(?=\n  function drawTail)/)?.[0] || '';
const bodyMassSource = appSource.match(/function paintFurMassEnvelope[\s\S]*?(?=\n  function skinTopologySnapshot)/)?.[0] || '';
const bodyLockSource = appSource.match(/function appendBodyFurLock[\s\S]*?(?=\n  function bodyFlowBandPoints)/)?.[0] || '';
const bodyClumpSource = appSource.match(/function paintFurClumps[\s\S]*?(?=\n  function bodyFlowBandPoints)/)?.[0] || '';
const bodyFlowRibbonSource = appSource.match(/function paintFurFlowRibbons[\s\S]*?(?=\n  function paintBodyCoat)/)?.[0] || '';
const headPatchSource = appSource.match(/function appendHeadRuffPatch[\s\S]*?(?=\n  function paintHeadCoat)/)?.[0] || '';
const headMassSource = appSource.match(/function paintHeadFurMass[\s\S]*?(?=\n  function paintHeadCoat)/)?.[0] || '';
const previewFurFlowSource = appSource.match(/function paintPreviewFurFlow[\s\S]*?(?=\n  function paintPreviewBodyCoat)/)?.[0] || '';
const drawBodySource = appSource.match(/function drawBody[\s\S]*?(?=\n  function appendHeadRuffPatch)/)?.[0] || '';
const topDownFaceSource = appSource.match(/function drawTopDownFace[\s\S]*?(?=\n  function drawHead)/)?.[0] || '';
const drawHeadSource = appSource.match(/function drawHead\([\s\S]*?(?=\n  function drawMouse)/)?.[0] || '';
const mouseHiddenSource = appSource.match(/function mouseHiddenUnderCat[\s\S]*?(?=\n  function drawMouse)/)?.[0] || '';
for (const key of ['stateSit', 'stateLoaf', 'stateSideLie', 'stateRoll', 'stateCurl']) {
  const label = sandbox.CatMouseI18n.LABELS[key];
  assert.ok(label?.zh && label?.en, `${key} must remain bilingual`);
}
for (const key of [
  'appearanceToggleAria', 'appearancePatternLabel', 'appearanceColorwayLabel',
  'appearanceWhiteLevelLabel', 'appearanceFurLengthLabel', 'furShort', 'furMedium',
  'furLong', 'furHairless',
]) {
  const label = sandbox.CatMouseI18n.LABELS[key];
  assert.ok(label?.zh && label?.en, `${key} must remain bilingual`);
}
assert.deepEqual(
  Object.keys(sandbox.CatAppearance.COLORS).sort(),
  Object.keys(shelterEnums.colors).sort(),
  'appearance color tokens must match the Shelter Cats controlled vocabulary',
);
assert.deepEqual(
  Object.keys(sandbox.CatAppearance.PATTERNS).sort(),
  Object.keys(shelterEnums.patterns).sort(),
  'appearance pattern tokens must match the Shelter Cats controlled vocabulary',
);
assert.deepEqual(
  Object.keys(sandbox.CatAppearance.FUR_LENGTHS).sort(),
  Object.keys(shelterEnums.coat).sort(),
  'fur-length tokens must match the Shelter Cats controlled vocabulary',
);
assert.deepEqual(
  JSON.parse(JSON.stringify(sandbox.CatAppearance.normalize({}))),
  { pattern: 'tabby', colorway: 'orange', whiteLevel: 'low', furLength: 'short' },
  'default appearance must remain the existing ginger short-hair tabby',
);
assert.deepEqual(
  JSON.parse(JSON.stringify(sandbox.CatAppearance.validWhiteLevels('tortie'))),
  ['none'],
  'tortoiseshell with pale markings belongs in the calico category',
);
const expectedColorwayOptions = Object.entries(sandbox.CatAppearance.COLORWAYS)
  .flatMap(([pattern, colorways]) => Object.keys(colorways).map((colorway) => `${pattern}-${colorway}`))
  .sort();
const htmlColorwayOptions = Array.from(indexSource.matchAll(/<option value="([^"]+)" data-pattern="[^"]+"/g))
  .map((match) => match[1])
  .sort();
assert.deepEqual(htmlColorwayOptions, expectedColorwayOptions, 'HTML colorway options must cover the complete legal catalog');
assert.match(indexSource, /id="appearance-toggle"[\s\S]*aria-expanded="false"[\s\S]*aria-controls="appearance-panel"/, 'appearance disclosure must expose its panel relationship');
assert.doesNotMatch(indexSource, /id="appearance-panel"[^>]*role="menu"/, 'appearance settings are a form, not an ARIA menu');
assert.match(indexSource, /class="appearance-fields"[^>]*aria-hidden="true"[^>]*hidden/, 'legacy select state holders must stay out of the accessibility tree');
assert.doesNotMatch(indexSource, /aria-labelledby="appearance-(?:pattern|colorway|white-level|fur-length)"/, 'visual radiogroups must not derive names from hidden select values');
assert.match(indexSource, /id="appearance-fur-length"[\s\S]*value="short"[^>]*selected/, 'short hair must be the visible default');
assert.match(indexSource, /<canvas[^>]+id="appearance-preview"/, 'appearance panel must include a live mini-preview canvas');
assert.match(indexSource, /id="appearance-pattern-grid"[\s\S]*role="radiogroup"/, 'pattern chooser must be a radiogroup, not a menu');
assert.match(indexSource, /id="appearance-colorway-grid"[\s\S]*role="radiogroup"/, 'colorway chooser must be a radiogroup, not a menu');
assert.match(indexSource, /id="appearance-white-level-group"[\s\S]*role="radiogroup"/, 'white-level chooser must be a radiogroup, not a menu');
assert.match(indexSource, /class="appearance-row appearance-fur-select"[\s\S]*id="appearance-fur-length"/, 'fur length must remain a visible dropdown as requested');
assert.doesNotMatch(indexSource, /id="appearance-fur-length-group"/, 'fur length must not be replaced by a duplicate custom radiogroup');
assert.match(appSource, /function drawAppearancePreview\s*\(/, 'mini-preview renderer must be a named function');
assert.match(appSource, /function syncAppearanceVisual\s*\(/, 'visual UI must have a single sync entrypoint');
assert.match(appSource, /function wireRadioNavigation\s*\([\s\S]*ArrowLeft[\s\S]*ArrowRight/, 'custom radiogroups must support roving arrow-key navigation');
assert.match(appSource, /function patternGlyph\s*\(/, 'pattern chip glyphs must come from a single named helper');
assert.match(appSource, /function colorwayTileSvg\s*\(/, 'colorway swatch tiles must come from a single named helper');
for (const extra of (Object.keys(sandbox.CatAppearance.COLORWAYS.bicolor).concat(Object.keys(sandbox.CatAppearance.COLORWAYS.tuxedo)))) {
  if (['black-white', 'gray-white', 'orange-white', 'brown-cream'].includes(extra)) continue;
  assert.ok(
    indexSource.includes(`value="bicolor-${extra}"`) || indexSource.includes(`value="tuxedo-${extra}"`),
    `extended colorway ${extra} must be present in the HTML option catalog`,
  );
}
assert.match(appearanceSource, /Shelter records describe whole-coat categories; they do not annotate[\s\S]*per-part regions/, 'appearance model must preserve the shelter-data provenance boundary');
const appearanceSourceRule = cssSource.match(/\.appearance-source\s*\{[\s\S]*?\}/)?.[0] || '';
assert.match(appearanceSourceRule, /font-size:\s*0\.6rem/, 'appearance provenance text must remain readable at the compact size');
assert.doesNotMatch(appearanceSourceRule, /opacity\s*:/, 'appearance provenance text must not lose WCAG contrast through opacity');
assert.match(appSource, /const REST_POSES = Object\.freeze\(\['sit', 'loaf', 'sideLie', 'roll', 'curl'\]\)/, 'rest repertoire contract drifted');
assert.doesNotMatch(indexSource, /class="(?:gait-panel|interaction-help)"/, 'canvas must stay free of instructional HUD panels');
assert.doesNotMatch(appSource, /\b(?:gaitName|phaseElements|refreshPhaseUi)\b/, 'removed gait HUD must not retain runtime work');
assert.match(appSource, /function restPosePawTarget\s*\(/, 'rest poses must derive articulated paw targets');
assert.match(appSource, /function renderedFoot\s*\(/, 'rest poses must blend into the live limb renderer');
assert.match(appSource, /function drawRestPoseDetails\s*\(/, 'rest poses must retain pose-specific illustrated coat details');
assert.match(appSource, /function beginPoseTransition\s*\(/, 'rest poses must use continuous cross-pose mixing');
assert.match(appSource, /const POSE_CHANNEL_TIMING/, 'pose mixer must stage body, spine, paws, tail and detail channels');
assert.match(appSource, /function updateSleepMotion\s*\(/, 'rest poses must include layered sleeping motion');
assert.match(appSource, /function scheduleDreamTwitch\s*\(/, 'sleeping motion must schedule non-periodic local twitches');
assert.match(visualHarnessSource, /window\.__poseSheet\s*=\s*\(\)\s*=>/, 'visual harness must expose the rest-pose contact sheet');
assert.match(visualHarnessSource, /window\.__captureFrame\s*=\s*\(\)\s*=>/, 'visual harness must expose the captured-rest frame');
assert.match(visualHarnessSource, /window\.__transitionFrame\s*=\s*\(\)\s*=>/, 'visual harness must expose a mid-transition frame');
assert.match(visualHarnessSource, /window\.__sleepFrame\s*=\s*\(\)\s*=>/, 'visual harness must expose a sleeping micro-motion frame');
assert.match(visualHarnessSource, /window\.__headFrame\s*=\s*\(\)\s*=>/, 'visual harness must expose the side-lying head review frame');
assert.match(visualHarnessSource, /window\.__zoomHead\s*=\s*\(R\)\s*=>/, 'visual harness must expose a dedicated head crop');
assert.match(visualHarnessSource, /window\.__appearanceSheet\s*=\s*\(\)\s*=>/, 'visual harness must expose all eight coat patterns');
assert.match(visualHarnessSource, /window\.__furSheet\s*=\s*\(\)\s*=>/, 'visual harness must expose all four fur lengths');
assert.match(
  visualHarnessSource,
  /const furCases = \[[\s\S]*mode: 'sit'[\s\S]*mode: 'sideLie'[\s\S]*mode: 'curl'/,
  'fur contact sheet must attack straight, side-lying and curled silhouettes',
);
assert.match(
  visualHarnessSource,
  /colorway: 'orange'[\s\S]*colorway: 'black'[\s\S]*colorway: 'cream'/,
  'fur contact sheet must attack warm, near-black, and pale coat contrast',
);
assert.match(visualHarnessSource, /previewIdlePose\(mode, side, 0\.2\)/, 'fur contact sheet must settle every pose without hundreds of full-canvas frames');
assert.match(visualHarnessSource, /pattern: 'solid', colorway, whiteLevel: 'none', furLength/, 'fur contact sheet must isolate silhouette and flow from coat markings');
assert.match(appSource, /function paintTailCoat\s*\(/, 'tail markings must be recipe-driven');
assert.match(appSource, /function paintBodyCoat\s*\(/, 'body markings must be recipe-driven');
assert.match(appSource, /function paintHeadCoat\s*\(/, 'head markings must be recipe-driven');
assert.doesNotMatch(appSource, /function paint(?:Body|Head)FurFringe\s*\(/, 'closed geometric fringe blocks must not return');
for (const [label, source] of [
  ['body mass', bodyMassSource],
  ['body clumps', bodyClumpSource],
  ['body flow ribbons', bodyFlowRibbonSource],
  ['tail flow ribbons', tailFurFlowSource],
  ['head mass', headMassSource],
  ['preview mass', previewFurFlowSource],
]) {
  assert.ok(source, `${label} renderer must remain discoverable`);
  assert.doesNotMatch(source, /Math\.random\s*\(/, `${label} must remain temporally stable`);
  assert.doesNotMatch(source, /\.filter\s*=/, `${label} must not rely on per-frame blur`);
  assert.doesNotMatch(source, /furStrand|proxy hair|guard hair/i, `${label} must not return to strand-heavy rendering`);
}
assert.match(bodyMassSource, /const mass = coatMassConfig\(\);[\s\S]*if \(!mass\) return;/, 'body mass must gate short/hairless before Canvas work');
assert.match(bodyMassSource, /traceBodyFlankBand[\s\S]*ctx\.fill\(\)/, 'body undercoat depth must be a closed filled band');
assert.match(bodyLockSource, /bezierCurveTo[\s\S]*closePath[\s\S]*ctx\.fill\(\)/, 'body clumps must be broad closed locks');
assert.match(bodyFlowRibbonSource, /lineWidth = mass\.flowWidth[\s\S]*smoothOpenPath[\s\S]*ctx\.stroke\(\)/, 'body direction must use a few broad ribbons');
assert.match(tailFurFlowSource, /const mass = coatMassConfig\(\);[\s\S]*if \(!mass \|\| renderTail\.length < 3\) return;/, 'tail mass must gate short/hairless before Canvas work');
assert.match(
  tailFurFlowSource,
  /flowPoints\(1, 0\.46\)[\s\S]*flowPoints\(-1, 0\.38\)/,
  'tail ribbons must stay parametrically inside the authoritative plume',
);
assert.doesNotMatch(
  tailFurFlowSource,
  /traceTailRibbon[\s\S]*ctx\.clip\(\)/,
  'tail flow must not rebuild the full plume path for a redundant clip',
);
assert.match(headPatchSource, /bezierCurveTo[\s\S]*closePath[\s\S]*ctx\.fill\(\)/, 'head ruff must use closed cheek masses');
assert.match(headMassSource, /const mass = coatMassConfig\(\);[\s\S]*if \(!mass\) return;/, 'head mass must gate short/hairless before Canvas work');
assert.doesNotMatch(headMassSource, /traceHeadSilhouette[\s\S]*ctx\.clip\(\)/, 'head mass must avoid a redundant full-silhouette clip');
assert.match(previewFurFlowSource, /const mass = coatMassConfig\(\);[\s\S]*if \(!mass\) return;/, 'preview mass must gate short/hairless before Canvas work');
assert.match(previewFurFlowSource, /closePath[\s\S]*p\.fill\(\)/, 'preview must show closed broad locks instead of hairs');
assert.match(appSource, /const BODY_FUR_PROFILE = Object\.freeze/, 'body fur volume must use one explicit regional profile');
assert.match(appSource, /const FUR_MASS_STYLES = Object\.freeze/, 'medium and long coats must declare a shared mass vocabulary');
assert.match(appSource, /function coatMassConfig\s*\(/, 'all mass painters must share one length-gated configuration');
assert.doesNotMatch(appSource, /FUR_STRAND|FUR_COMPACT|prefilterFurStroke|updateFurLod|paintBodyUndercoatHalo/, 'obsolete strand and blur architecture must be removed');
assert.match(appSource, /function paintFurMassEnvelope\s*\(/, 'body must expose a filled mass layer');
assert.match(appSource, /function paintFurClumps\s*\(/, 'body must expose broad closed clumps');
assert.match(appSource, /function paintFurFlowRibbons\s*\(/, 'body must expose low-contrast flow ribbons');
assert.match(appSource, /function furGeometrySnapshot\s*\(/, 'fur geometry must expose a deterministic regression snapshot');
assert.match(appSource, /tailRootClearance = rearWidth - socketLateral - tailCoatRadius\(0, a\.scale\)/, 'tail seam oracle must use the rendered root radius');
const poseEnvelopeSource = appSource.match(/function poseEnvelopeSnapshot[\s\S]*?(?=\n  function drawNodeEllipse)/)?.[0] || '';
assert.match(poseEnvelopeSource, /const points = \[\.\.\.contours\.left, \.\.\.contours\.right\]/, 'pose envelope must use the authoritative filled body mass');
assert.match(poseEnvelopeSource, /tailCoatRadius\(t, a\.scale\)/, 'pose envelope must use the authoritative filled tail plume');
assert.match(poseEnvelopeSource, /limbMassSamples\.forEach[\s\S]*sample\.radius/, 'pose envelope must include medium/long limb coat mass');
assert.match(
  appSource,
  /function demoSnapshot[\s\S]*limbCoatEnvelopeSamples\(snapshotAnatomy\)[\s\S]*poseEnvelopeSnapshot\(snapshotAnatomy, snapshotLimbCoatSamples\)/,
  'snapshot must feed one shared rendered limb mass into geometry and pose-envelope checks',
);
assert.match(limbEnvelopeSource, /if \(!coatMassConfig\(\)\) return \[\];/, 'limb mass sampling must leave short/hairless geometry untouched');
assert.match(limbEnvelopeSource, /legRibbon\([\s\S]*ribbon\.points\.forEach/, 'limb mass sampling must reuse the rendered ribbon');
assert.match(
  mouseHiddenSource,
  /if \(!hidden && coatMassConfig\(\)\)[\s\S]*limbCoatEnvelopeSamples\(a\)[\s\S]*sample\.radius/,
  'mouse occlusion must include the rendered medium/long limb coat mass only',
);
assert.match(appSource, /function paintHairlessBodyDetails\s*\(/, 'hairless coats must retain subtle skin articulation');
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
assert.match(earRendererSource, /function traceHeadSilhouette[\s\S]*?traceSkullFront\(/, 'head fill must reuse the shared cheek-and-muzzle front path');
assert.match(earRendererSource, /function traceHeadCrown[\s\S]*?traceSkullFront\(/, 'crown stroke must reuse the shared cheek-and-muzzle front path');
assert.doesNotMatch(earRendererSource, /earInner|traceInnerEar|traceEarAccent|traceEarSilhouette|applyEarPose/, 'ears must not regress to separately painted tabs or high-contrast inner cores');
assert.match(earMotionSource, /earFlickPulse\s*\(/, 'ear motion must retain independent short flicks');
assert.match(earMotionSource, /EAR_PERK_BY_STATE/, 'ear motion must retain state-dependent perk variation');
assert.match(drawBodySource, /strokeBodyFlanks\s*\(/, 'torso must stroke only its open side contours');
assert.match(drawBodySource, /paintFurMassEnvelope\s*\(/, 'torso must layer filled undercoat depth inside its silhouette');
assert.match(drawBodySource, /paintFurClumps\s*\(/, 'torso must layer broad closed locks');
assert.match(drawBodySource, /paintFurFlowRibbons\s*\(/, 'torso must layer broad directional tone');
assert.doesNotMatch(drawBodySource, /ctx\.stroke\s*\(/, 'torso must not stroke its closed fill caps');
assert.doesNotMatch(bodyFlankSource, /closePath\s*\(|traceBodySilhouette\s*\(/, 'body flank strokes must stay open');
assert.equal((bodyFlankSource.match(/smoothOpenPath\s*\(/g) || []).length, 2, 'body must expose exactly two open flanks');
assert.equal((bodyFlankSource.match(/context\.stroke\s*\(/g) || []).length, 2, 'body must stroke each open flank once');
assert.ok(topDownFaceSource, 'top-down face renderer must remain discoverable');
assert.match(drawHeadSource, /drawTopDownFace\s*\(/, 'head must delegate its markings to the overhead face renderer');
assert.match(topDownFaceSource, /drawEyeLine\(c, a, -1\)[\s\S]*drawEyeLine\(c, a, 1\)/, 'overhead face must retain two restrained eyelid lines');
assert.match(topDownFaceSource, /drawNoseMark\s*\(/, 'overhead face must retain one small directional nose mark');
assert.match(appSource, /function drawEyeLine\s*\([\s\S]*quadraticCurveTo/, 'eyelids must remain soft open curves');
assert.doesNotMatch(appSource, /function (?:traceEye|drawEye|traceMuzzlePlane|drawHeadPlanes|drawMuzzleFeatures|drawFacialFur)\s*\(/, 'head must not regress to the over-detailed portrait stack');
assert.doesNotMatch(appSource, /eyeRing|eyeGlint/, 'head palette must not reintroduce jewel-like portrait eyes');
assert.match(appSource, /const HEAD_GEOMETRY = Object\.freeze/, 'head proportions must have an explicit harmony contract');
assert.match(drawHeadSource, /paintEarBacks\s*\(/, 'head must include inset pinna planes');
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
    snapshot.headGeometry.frontReach, snapshot.headGeometry.skullHalfWidth,
    snapshot.headGeometry.muzzleCornerForward, snapshot.headGeometry.muzzleHalfWidth,
    snapshot.headGeometry.visualRadius, snapshot.headGeometry.whiskerRows,
    snapshot.earGeometry.rearBaseForward, snapshot.earGeometry.frontBaseForward,
    snapshot.earGeometry.rearBaseOutward, snapshot.earGeometry.frontBaseOutward,
    snapshot.earGeometry.rootForward, snapshot.earGeometry.rootOutward,
    snapshot.earGeometry.tipForward, snapshot.earGeometry.tipOutward,
    snapshot.earGeometry.tipRound, snapshot.earGeometry.maxSwivel,
    snapshot.pounceGeometry.triggerMin, snapshot.pounceGeometry.triggerMax,
    snapshot.pounceGeometry.crouchAbort, snapshot.pounceGeometry.aimLeadSeconds,
    snapshot.pounceGeometry.forePawForward, snapshot.pounceGeometry.maxBodyTravel,
    snapshot.pounceGeometry.captureRadius,
    snapshot.mouse.rendered.x, snapshot.mouse.rendered.y,
    snapshot.capture.pointerX, snapshot.capture.pointerY,
    ...Object.values(snapshot.earLandmarks).flatMap((ear) => Object.values(ear).flatMap((point) => [point.x, point.y])),
    snapshot.mouse.x, snapshot.mouse.y, snapshot.mouse.speed,
    snapshot.rigScale, snapshot.turnVelocity, snapshot.rigCurvature,
    snapshot.skin.headSocketMargin, snapshot.skin.tailRootClearance, snapshot.skin.narrow,
    snapshot.furGeometry.maxBodyOffset, snapshot.furGeometry.minCentralBodyOffset,
    snapshot.furGeometry.bodyArea, snapshot.furGeometry.headRuff,
    snapshot.furGeometry.tailRootRadius, snapshot.furGeometry.maxTailRadius,
    snapshot.furGeometry.tailPlumeExpansion, snapshot.furGeometry.tailSampleCount,
    snapshot.furGeometry.limbMassSampleCount, snapshot.furGeometry.maxLimbMassRadius,
    ...snapshot.limbCoatSamples.flatMap((sample) => [sample.x, sample.y, sample.radius]),
    snapshot.poseEnvelope.left, snapshot.poseEnvelope.top,
    snapshot.poseEnvelope.right, snapshot.poseEnvelope.bottom,
    snapshot.support.foreBias, snapshot.support.hindBias, snapshot.support.combined,
    snapshot.idlePose.blend, snapshot.idlePose.side, snapshot.idlePose.rollWave,
    snapshot.idlePose.poseClock, snapshot.idlePose.sleepDepth, snapshot.idlePose.breath,
    snapshot.idlePose.transitionSway, snapshot.idlePose.transition.progress,
    snapshot.idlePose.transition.duration, snapshot.idlePose.twitch.value,
    snapshot.idlePose.twitch.side, snapshot.idlePose.twitch.count,
    snapshot.face.leftEyeOpen, snapshot.face.rightEyeOpen,
    ...Object.values(snapshot.idlePose.weights),
    ...Object.values(snapshot.idlePose.spineWeights),
    ...Object.values(snapshot.idlePose.pawWeights),
    ...Object.values(snapshot.idlePose.tailWeights),
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
    snapshot.headGeometry.frontReach >= 21.8 && snapshot.headGeometry.frontReach <= 23.6,
    `${label}: nose-peek apex escaped the lowered-head contract`,
  );
  assert.ok(
    snapshot.headGeometry.skullHalfWidth >= 16.4 && snapshot.headGeometry.skullHalfWidth <= 18.0,
    `${label}: skull width no longer matches the chamfered-square overhead contract`,
  );
  // 低头契约（2026-07-20 用户参考图第二轮）：俯视看到的是头顶——吻部藏在前额缘
  // 之下，只在中央露一小点鼻尖；前额缘几乎平直。旧的外凸吻块（muzzleHalfWidth 5 /
  // muzzleCornerForward 22.6 / frontReach 24.4）被下列窗口拒绝。
  assert.ok(
    snapshot.headGeometry.muzzleHalfWidth >= 2.6 && snapshot.headGeometry.muzzleHalfWidth <= 4,
    `${label}: nose peek vanished or regrew into a protruding muzzle`,
  );
  assert.ok(
    snapshot.headGeometry.muzzleCornerForward >= 20.5 && snapshot.headGeometry.muzzleCornerForward <= 22.3,
    `${label}: forehead edge left its lowered-head station`,
  );
  assert.ok(
    snapshot.rig.head.visualRadius <= snapshot.rig.shoulders.visualRadius * 1.40,
    `${label}: head became oversized relative to the shoulder mass`,
  );
  assert.equal(snapshot.headGeometry.whiskerRows, 2, `${label}: face regained excess whisker line density`);
  // 2026-07-20 低头重校（用户参考图第二轮）：耳朵盖住方形颅**离身体远的两个前角**
  // ——rearBase 在直侧缘上（全颅宽处）、frontBase 在前额缘上，耳尖沿对角线指向前外，
  // 读作"猫低着头前进"。上一稿"骑后角 + 正外张"（rearBase -13.5 / frontBase -1.6 /
  // 角度 1.29）被下列窗口拒绝。
  assert.ok(
    snapshot.earGeometry.rearBaseForward >= 6 && snapshot.earGeometry.rearBaseForward <= 11
      && snapshot.earGeometry.frontBaseForward >= 17.5 && snapshot.earGeometry.frontBaseForward <= 21,
    `${label}: ear base left the far (front) corner of the square skull`,
  );
  assert.ok(
    snapshot.earGeometry.rearBaseOutward >= 16.4 && snapshot.earGeometry.rearBaseOutward <= 17.6,
    `${label}: ear no longer attaches at the skull's full side width`,
  );
  assert.ok(
    neutralEarAngle >= 0.5 && neutralEarAngle <= 0.78,
    `${label}: neutral ears no longer extend the far-corner diagonal forward-outward`,
  );
  assert.ok(
    snapshot.earGeometry.tipRound >= 1.4 && snapshot.earGeometry.tipRound <= 2,
    `${label}: ear tip lost its restrained illustrated rounding`,
  );
  assert.ok(
    snapshot.earGeometry.rootForward + snapshot.earGeometry.tipForward >= 21.8
      && snapshot.earGeometry.rootForward + snapshot.earGeometry.tipForward <= 24.5,
    `${label}: neutral ear tips escaped the far corner station`,
  );
  assert.ok(
    neutralEarAngle - snapshot.earGeometry.maxSwivel > 0.42,
    `${label}: full ear swivel can flatten a pinna into a forward spike`,
  );
  for (const [earName, side] of [['left', -1], ['right', 1]]) {
    const ear = snapshot.earLandmarks[earName];
    const baseDx = ear.frontBase.x - ear.rearBase.x;
    const baseDy = ear.frontBase.y - ear.rearBase.y;
    const baseSpan = Math.hypot(baseDx, baseDy);
    const tipHeight = Math.abs(baseDx * (ear.tip.y - ear.rearBase.y) - baseDy * (ear.tip.x - ear.rearBase.x)) / baseSpan;
    const outerBase = Math.max(side * ear.rearBase.y, side * ear.frontBase.y);
    assert.ok(baseSpan >= 12 && baseSpan <= 14.5, `${label}: ${earName} ear lost its compact crown attachment`);
    // 2026-07-19 重校：耳尖高度从"低扇贝"窗口 [4,7.2] 上移——俯视猫的耳朵是
    // 醒目的三角 pinna，旧的 5.4 高度读作后脑上的波纹（用户反馈"畸形"主因之一）。
    assert.ok(tipHeight >= 7.8 && tipHeight <= 13.2, `${label}: ${earName} ear became a flat scallop or a tall horn`);
    // 低头前角耳：耳尖必须同时越过前额缘（向前）和侧缘（向外），才读作"盖住远角"。
    assert.ok(ear.tip.x > ear.frontBase.x + 1.8 && ear.tip.x < ear.frontBase.x + 5.5, `${label}: ${earName} ear tip left its far-corner diagonal`);
    assert.ok(side * ear.tip.y > side * ear.rearBase.y + 2.6, `${label}: ${earName} ear tip no longer clears the skull side`);
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
  const poseW = (mode) => snapshot.idlePose.weights[mode] || 0;
  const spineW = (mode) => snapshot.idlePose.spineWeights[mode] || 0;
  const poseStretchS = snapshot.idlePose.stretch || 0;
  const poseCompress = 1 - (poseW('sit') * 0.3 + poseW('loaf') * 0.34 + poseW('curl') * 0.1);
  const jointLengthFactor = {
    'pelvis-waist': poseCompress,
    'waist-shoulders': poseCompress * (1 + poseStretchS * 0.2),
    'shoulders-neck': (1 - poseW('sit') * 0.2 - poseW('loaf') * 0.3) * (1 + poseStretchS * 0.5),
    'neck-head': (1 - poseW('loaf') * 0.16) * (1 + poseStretchS * 0.35),
  };
  const bendFree = spineW('curl') * 0.85 + spineW('sideLie') * 0.3 + spineW('groom') * 0.3;
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
    const swayBound = (jointKey === 'pelvis-waist' ? 2.35 + 0.42 + 2.8 + 2.4
      : jointKey === 'waist-shoulders' ? 1.55 + 0.28 + 2.4 * 0.55 : 0) * snapshot.rigScale;
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

function assertPoseEnvelopeInsideViewport(snapshot, label) {
  assert.ok(snapshot.poseEnvelope.left >= -1, `${label}: visible coat escaped the left edge`);
  assert.ok(snapshot.poseEnvelope.top >= -1, `${label}: visible coat escaped the top edge`);
  assert.ok(snapshot.poseEnvelope.right <= snapshot.viewport.width + 1, `${label}: visible coat escaped the right edge`);
  assert.ok(snapshot.poseEnvelope.bottom <= snapshot.viewport.height + 1, `${label}: visible coat escaped the bottom edge`);
}

assert.ok(sandbox.__catMouseDemo, 'debug/test surface must be available');
step(120);
let snapshot = sandbox.__catMouseDemo.getSnapshot();
assertRigSnapshot(snapshot, 'initial prowl');
assert.equal(snapshot.behavior, 'prowl');
assert.equal(snapshot.viewport.width, 1180);
assert.equal(snapshot.viewport.height, 720);
const initialEarPerkMean = (snapshot.earPerk.left + snapshot.earPerk.right) * 0.5;

// Every canonical coat recipe and fur length must render through both theme
// palettes without mutating the locomotion/head contracts. Hairless smoke is
// intentionally normalized to a solid pigmented skin because smoke requires fur.
const representativeColorway = {
  solid: 'black',
  tabby: 'orange',
  bicolor: 'gray-white',
  tuxedo: 'black-white',
  calico: 'classic',
  tortie: 'classic',
  pointed: 'seal',
  smoke: 'black',
};
const geometryBeforeAppearance = JSON.stringify({
  headGeometry: snapshot.headGeometry,
  earGeometry: snapshot.earGeometry,
  pounceGeometry: snapshot.pounceGeometry,
  rig: snapshot.rig,
});
for (const pattern of Object.keys(sandbox.CatAppearance.PATTERNS)) {
  for (const selectedFur of Object.keys(sandbox.CatAppearance.FUR_LENGTHS)) {
    const whiteLevel = sandbox.CatAppearance.validWhiteLevels(pattern)[0];
    const applied = JSON.parse(JSON.stringify(sandbox.__catMouseDemo.setAppearance({
      pattern,
      colorway: representativeColorway[pattern],
      whiteLevel,
      furLength: selectedFur,
    })));
    const expectedPattern = pattern === 'smoke' && selectedFur === 'hairless' ? 'solid' : pattern;
    assert.equal(applied.pattern, expectedPattern, `${pattern}/${selectedFur}: canonical pattern drifted`);
    assert.equal(applied.furLength, selectedFur, `${pattern}/${selectedFur}: fur length drifted`);
    for (const theme of ['light', 'dark']) {
      sandbox.__catMouseDemo.setTheme(theme);
      const current = sandbox.__catMouseDemo.getSnapshot();
      finiteSnapshot(current);
      assert.equal(JSON.stringify({
        headGeometry: current.headGeometry,
        earGeometry: current.earGeometry,
        pounceGeometry: current.pounceGeometry,
        rig: current.rig,
      }), geometryBeforeAppearance, `${pattern}/${selectedFur}/${theme}: appearance changed rig geometry`);
      const resolved = sandbox.CatAppearance.resolvePalette(current.appearance, theme === 'dark');
      for (const key of ['fur', 'furLight', 'furDark', 'coatWhite', 'coatAccent', 'coatThird']) {
        assert.match(resolved[key], /^#[0-9a-f]{6}$/i, `${pattern}/${selectedFur}/${theme}: invalid ${key}`);
      }
    }
  }
}

const furSnapshotsByLength = Object.fromEntries(
  ['hairless', 'short', 'medium', 'long'].map((selectedFur) => {
    sandbox.__catMouseDemo.setAppearance({
      pattern: 'tabby', colorway: 'orange', whiteLevel: 'low', furLength: selectedFur,
    });
    return [selectedFur, JSON.parse(JSON.stringify(sandbox.__catMouseDemo.getSnapshot()))];
  }),
);
const furGeometryByLength = Object.fromEntries(
  Object.entries(furSnapshotsByLength).map(([selectedFur, current]) => [selectedFur, current.furGeometry]),
);
assert.equal(furGeometryByLength.short.maxBodyOffset, 0, 'short hair must preserve the established body silhouette');
assert.equal(furGeometryByLength.hairless.maxBodyOffset, 0, 'hairless skin must not grow a fur halo');
assert.equal(furGeometryByLength.short.representation, 'core-silhouette', 'short hair must retain the original core renderer');
assert.equal(furGeometryByLength.hairless.representation, 'core-silhouette', 'hairless skin must retain the original core renderer');
assert.equal(furGeometryByLength.medium.representation, 'layered-mass', 'medium hair must use filled coat masses');
assert.equal(furGeometryByLength.long.representation, 'layered-mass', 'long hair must use filled coat masses');
assert.ok(furGeometryByLength.medium.minCentralBodyOffset >= 2.5, 'medium hair needs a continuous filled central coat band');
assert.ok(furGeometryByLength.long.minCentralBodyOffset >= 4.5, 'long hair needs a deeper continuous filled central coat band');
assert.ok(furGeometryByLength.medium.maxBodyOffset >= 4, 'medium hair needs a readable continuous coat volume');
assert.ok(
  furGeometryByLength.long.maxBodyOffset >= furGeometryByLength.medium.maxBodyOffset + 3,
  'long hair must add another visible coat-volume step beyond medium hair',
);
assert.ok(furGeometryByLength.long.maxBodyOffset <= 9.5, 'long hair must not inflate the cat into a uniform blob');
assert.ok(
  furGeometryByLength.medium.bodyArea > furGeometryByLength.short.bodyArea
    && furGeometryByLength.long.bodyArea > furGeometryByLength.medium.bodyArea,
  'filled body area must increase monotonically from short to medium to long',
);
assert.ok(
  furGeometryByLength.long.bodyArea <= furGeometryByLength.short.bodyArea * 1.25,
  'long coat mass must preserve negative space instead of becoming a uniform blob',
);
for (const selectedFur of ['medium', 'long']) {
  const geometry = furGeometryByLength[selectedFur];
  assert.equal(geometry.bodyMassLayerCount, 3, `${selectedFur}: body must retain envelope, clump, and flow layers`);
  assert.equal(geometry.bodyClosedLockCount, 5, `${selectedFur}: body must use five broad closed locks`);
  assert.equal(geometry.bodyFlowRibbonCount, 2, `${selectedFur}: body must use two broad flow ribbons`);
  assert.equal(geometry.headMassPatchCount, 3, `${selectedFur}: head must use three broad ruff masses`);
  assert.equal(geometry.tailFlowRibbonCount, 2, `${selectedFur}: tail must use two broad flow ribbons`);
  assert.equal(geometry.lodInvariant, true, `${selectedFur}: primary coat mass must not change across DPR`);
  assert.ok(geometry.limbMassSampleCount > 0, `${selectedFur}: limb mass must expose rendered ribbon samples`);
  assert.notDeepEqual(geometry.leftBodyOffsets, geometry.rightBodyOffsets, `${selectedFur}: coat contour must avoid mirror symmetry`);
  for (const obsolete of ['bodyStrandCount', 'headStrandCount', 'tailStrandCount', 'bodyStroke', 'bundleSpread']) {
    assert.equal(obsolete in geometry, false, `${selectedFur}: obsolete strand metric ${obsolete} must stay removed`);
  }
}
for (const selectedFur of ['hairless', 'short']) {
  const geometry = furGeometryByLength[selectedFur];
  assert.equal(geometry.bodyClosedLockCount, 0, `${selectedFur}: core renderer must not receive mass locks`);
  assert.equal(geometry.bodyFlowRibbonCount, 0, `${selectedFur}: core renderer must not receive flow ribbons`);
  assert.equal(geometry.limbMassSampleCount, 0, `${selectedFur}: core renderer must not receive limb mass samples`);
  assert.equal(geometry.maxLimbMassRadius, 0, `${selectedFur}: core renderer must keep zero extra limb mass`);
  assert.ok(geometry.bodyOffsets.every((offset) => offset === 0), `${selectedFur}: body offsets must remain zero`);
}
const sharedTailRootRadius = furGeometryByLength.short.tailRootRadius;
assert.ok(sharedTailRootRadius > 0, 'shared rendered tail root radius must remain positive');
for (const selectedFur of ['hairless', 'short', 'medium', 'long']) {
  assert.equal(
    furGeometryByLength[selectedFur].tailSampleCount,
    furSnapshotsByLength[selectedFur].tailPoints.length,
    `${selectedFur}: fur geometry must sample the same socket-inclusive tail used by the renderer`,
  );
  assert.ok(
    Math.abs(furGeometryByLength[selectedFur].tailRootRadius - sharedTailRootRadius) < 0.001,
    `${selectedFur}: rendered tail root must preserve the shared socket radius (${furGeometryByLength[selectedFur].tailRootRadius})`,
  );
  assert.ok(
    furSnapshotsByLength[selectedFur].skin.tailRootClearance >= 3 * furSnapshotsByLength[selectedFur].rigScale,
    `${selectedFur}: rendered tail root escaped the pelvis envelope`,
  );
}
assert.ok(
  furGeometryByLength.medium.maxTailRadius > furGeometryByLength.short.maxTailRadius
    && furGeometryByLength.long.maxTailRadius > furGeometryByLength.medium.maxTailRadius
    && furGeometryByLength.long.maxTailRadius <= 20,
  `filled tail plume must grow monotonically while staying bounded: ${JSON.stringify(furGeometryByLength.long)}`,
);
assert.equal(furGeometryByLength.short.tailPlumeExpansion, 0, 'short hair must preserve the established tail taper');
assert.ok(
  furGeometryByLength.medium.tailPlumeExpansion > 0
    && furGeometryByLength.long.tailPlumeExpansion >= furGeometryByLength.medium.tailPlumeExpansion + 2
    && furGeometryByLength.long.tailPlumeExpansion <= 5.5,
  'tail plume must add a bounded, length-specific bell profile instead of uniform thickness',
);
assert.ok(
  furGeometryByLength.medium.headRuff > 0
    && furGeometryByLength.long.headRuff > furGeometryByLength.medium.headRuff,
  'cheek ruff volume must increase monotonically without changing the face front',
);
assert.deepEqual(
  [furGeometryByLength.long.bodyOffsets[0], furGeometryByLength.long.bodyOffsets.at(-1)],
  [0, 0],
  'fur expansion must taper to zero at the tail and head sockets',
);
assert.equal(furGeometryByLength.short.tailRadiusMultiplier, 1, 'short hair must preserve the established tail radius');
assert.equal(furGeometryByLength.short.limbRadiusMultiplier, 1, 'short hair must preserve the established limb radius');
assert.ok(
  furGeometryByLength.medium.limbRadiusMultiplier > 1
    && furGeometryByLength.long.limbRadiusMultiplier > furGeometryByLength.medium.limbRadiusMultiplier,
  'filled limb cuffs must grow monotonically for medium and long coats',
);
assert.ok(
  furGeometryByLength.long.maxLimbMassRadius > furGeometryByLength.medium.maxLimbMassRadius,
  'long limb coat mass must grow beyond medium while retaining one topology',
);
for (const selectedFur of ['medium', 'long']) {
  const current = furSnapshotsByLength[selectedFur];
  const groupedSamples = current.limbCoatSamples.reduce((groups, sample) => {
    if (!groups[sample.limb]) groups[sample.limb] = [];
    groups[sample.limb].push(sample);
    return groups;
  }, {});
  for (const [limb, samples] of Object.entries(groupedSamples)) {
    const sample = samples[Math.floor(samples.length / 2)];
    assert.equal(
      sandbox.__catMouseDemo.isPointHidden(sample.x, sample.y),
      true,
      `${selectedFur}/${limb}: mouse must be occluded under the filled limb ribbon`,
    );
  }
  for (const sample of current.limbCoatSamples) {
    assert.ok(current.poseEnvelope.left <= sample.x - sample.radius + 1e-6, `${selectedFur}: limb mass escaped pose envelope left`);
    assert.ok(current.poseEnvelope.top <= sample.y - sample.radius + 1e-6, `${selectedFur}: limb mass escaped pose envelope top`);
    assert.ok(current.poseEnvelope.right >= sample.x + sample.radius - 1e-6, `${selectedFur}: limb mass escaped pose envelope right`);
    assert.ok(current.poseEnvelope.bottom >= sample.y + sample.radius - 1e-6, `${selectedFur}: limb mass escaped pose envelope bottom`);
  }
}

function furDrawMetrics(selectedFur) {
  contextCalls.length = 0;
  contextPathCalls.length = 0;
  recordContextCalls = true;
  try {
    sandbox.__catMouseDemo.setAppearance({
      pattern: 'tabby', colorway: 'orange', whiteLevel: 'low', furLength: selectedFur,
    });
  } finally {
    recordContextCalls = false;
  }
  const quadratic = contextCalls.filter((call) => call.property === 'quadraticCurveTo').length;
  const bezier = contextCalls.filter((call) => call.property === 'bezierCurveTo').length;
  const fills = contextPathCalls.filter((call) => call.property === 'fill');
  const strokes = contextPathCalls.filter((call) => call.property === 'stroke');
  return {
    total: contextCalls.length,
    quadratic,
    bezier,
    curves: quadratic + bezier,
    fills: fills.length,
    closedFills: fills.filter((call) => call.pathClosed).length,
    strokes: strokes.length,
    broadStrokes: strokes.filter((call) => Number(call.lineWidth) >= 2.5).length,
  };
}
const shortFurMetrics = furDrawMetrics('short');
const mediumFurMetrics = furDrawMetrics('medium');
const longFurMetrics = furDrawMetrics('long');
assert.ok(
  mediumFurMetrics.closedFills >= shortFurMetrics.closedFills + 6,
  `medium coat must add at least six closed mass fills: ${JSON.stringify({ shortFurMetrics, mediumFurMetrics })}`,
);
assert.ok(
  longFurMetrics.closedFills === mediumFurMetrics.closedFills
    && longFurMetrics.strokes === mediumFurMetrics.strokes
    && longFurMetrics.total === mediumFurMetrics.total,
  `medium and long coats must share one draw topology: ${JSON.stringify({ mediumFurMetrics, longFurMetrics })}`,
);
assert.ok(
  mediumFurMetrics.curves - shortFurMetrics.curves <= 80
    && longFurMetrics.curves - shortFurMetrics.curves <= 80
    && longFurMetrics.fills - shortFurMetrics.fills <= 8
    && longFurMetrics.strokes - shortFurMetrics.strokes <= 4
    && longFurMetrics.total - shortFurMetrics.total <= 240,
  `layered coat mass must stay within the bounded Canvas budget: ${JSON.stringify({ shortFurMetrics, mediumFurMetrics, longFurMetrics })}`,
);

function furDrawSignature(selectedFur) {
  contextCalls.length = 0;
  recordContextCalls = true;
  try {
    sandbox.__catMouseDemo.setAppearance({
      pattern: 'solid', colorway: 'black', whiteLevel: 'none', furLength: selectedFur,
    });
  } finally {
    recordContextCalls = false;
  }
  return JSON.stringify(contextCalls);
}
const shortHairBaselineSignature = crypto.createHash('sha256')
  .update(furDrawSignature('short'))
  .digest('hex');
assert.equal(
  shortHairBaselineSignature,
  'fa1ae042956ae98264e722648bba2207b6171f731e32abbab2e1ab6f262f24cc',
  'short-hair main-canvas draw signature changed',
);
assert.equal(
  furDrawSignature('long'),
  furDrawSignature('long'),
  'fixed coat masses must render an identical long-hair call signature',
);

function appearanceDrawSignature(state) {
  contextCalls.length = 0;
  recordContextCalls = true;
  try {
    sandbox.__catMouseDemo.setAppearance(state);
  } finally {
    recordContextCalls = false;
  }
  return JSON.stringify(contextCalls.filter((call) => ['arc', 'ellipse', 'fill'].includes(call.property)));
}

const calicoDrawSignatures = ['low', 'medium', 'high'].map((whiteLevel) => appearanceDrawSignature({
  pattern: 'calico',
  colorway: 'classic',
  whiteLevel,
  furLength: 'short',
}));
assert.equal(new Set(calicoDrawSignatures).size, 3, 'all three calico pale-marking levels must render differently');

function previewDrawSignature(state) {
  previewContextCalls.length = 0;
  recordPreviewContextCalls = true;
  try {
    sandbox.__catMouseDemo.setAppearance(state);
  } finally {
    recordPreviewContextCalls = false;
  }
  return JSON.stringify(previewContextCalls.filter((call) => ['arc', 'ellipse', 'fill', 'stroke'].includes(call.property)));
}

function fullPreviewDrawSignature(state) {
  previewContextCalls.length = 0;
  recordPreviewContextCalls = true;
  try {
    sandbox.__catMouseDemo.setAppearance(state);
  } finally {
    recordPreviewContextCalls = false;
  }
  return JSON.stringify(previewContextCalls);
}

sandbox.__catMouseDemo.setAppearancePanelOpen(true);
const shortPreviewState = {
  pattern: 'solid', colorway: 'black', whiteLevel: 'none', furLength: 'short',
};
fullPreviewDrawSignature(shortPreviewState);
const shortPreviewBaselineSignature = crypto.createHash('sha256')
  .update(fullPreviewDrawSignature(shortPreviewState))
  .digest('hex');
assert.equal(
  shortPreviewBaselineSignature,
  '65c88950bea80049f5d8854242bbbfc7f3a5392b74a0ebd0bb3dca71cc91b637',
  'short-hair mini-preview draw signature changed',
);

const tabbyPreviewSignatures = ['none', 'low', 'medium'].map((whiteLevel) => previewDrawSignature({
  pattern: 'tabby',
  colorway: 'orange',
  whiteLevel,
  furLength: 'short',
}));
assert.equal(new Set(tabbyPreviewSignatures).size, 3, 'tabby mini-preview must reflect all three marking levels');
const calicoPreviewSignatures = ['low', 'medium', 'high'].map((whiteLevel) => previewDrawSignature({
  pattern: 'calico',
  colorway: 'classic',
  whiteLevel,
  furLength: 'short',
}));
assert.equal(new Set(calicoPreviewSignatures).size, 3, 'calico mini-preview must reflect all three marking levels');
const workingPreviewGetContext = ids.get('appearance-preview').getContext;
ids.get('appearance-preview').getContext = () => null;
assert.doesNotThrow(
  () => sandbox.__catMouseDemo.setAppearance(sandbox.CatAppearance.DEFAULT),
  'optional mini-preview must fail soft when its 2D context is unavailable',
);
ids.get('appearance-preview').getContext = workingPreviewGetContext;
sandbox.__catMouseDemo.setAppearancePanelOpen(false);
sandbox.__catMouseDemo.setTheme('light');
sandbox.__catMouseDemo.setAppearance(sandbox.CatAppearance.DEFAULT);
snapshot = sandbox.__catMouseDemo.getSnapshot();
assert.deepEqual(
  JSON.parse(JSON.stringify(snapshot.appearance)),
  { pattern: 'tabby', colorway: 'orange', whiteLevel: 'low', furLength: 'short' },
  'appearance reset must restore the ginger short-hair default',
);
assert.equal(
  JSON.parse(storage.get('qrost-cat-and-mouse-appearance-v1')).furLength,
  'short',
  'appearance selection must persist under the versioned key',
);

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
// A successful landing then becomes a persistent capture: the visible mouse
// follows the fore paws through a rest pose, tolerates small pointer jitter and
// releases only when the target makes a deliberate escape move.
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
  let captureEntry = null;
  let capturedRest = null;
  for (let frameIndex = 0; frameIndex < 720; frameIndex += 1) {
    step(1);
    const current = sandbox.__catMouseDemo.getSnapshot();
    assertRigSnapshot(current, 'leap chain');
    if (current.leapPhase) seenLeap.add(current.leapPhase);
    if (current.leapPhase === 'crouch' && !crouchEntry) crouchEntry = current;
    if (current.leapPhase === 'land' && !landing) landing = current;
    if (current.capture.active && !captureEntry) captureEntry = current;
    if (current.capture.active && current.idlePose.captured && current.idleMode) {
      capturedRest = current;
    }
    leapPounceRun = current.leapPhase === 'pounce' ? leapPounceRun + 1 : 0;
    maxLeapPounceRun = Math.max(maxLeapPounceRun, leapPounceRun);
    const anyPlanted = Object.values(current.feet).some((foot) => foot.planted);
    assert.ok(anyPlanted || current.leapPhase === 'pounce', 'all-airborne outside the pounce phase');
    if (capturedRest) break;
  }
  assert.ok(seenLeap.has('crouch'), 'stationary near target must trigger a crouch');
  assert.ok(seenLeap.has('pounce'), 'crouch must release into a pounce');
  assert.ok(seenLeap.has('land'), 'pounce must land');
  assert.ok(seenLeap.has('pin'), 'successful landing must become a persistent fore-paw pin');
  assert.ok(captureEntry, 'fore-paw pin never activated capture state');
  assert.ok(capturedRest, 'captured mouse never transitioned into a rest pose');
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

  step(90);
  let holding = sandbox.__catMouseDemo.getSnapshot();
  assert.equal(holding.capture.active, true, 'capture ended while the cat was resting');
  assert.equal(holding.mouse.active, true, 'captured target must remain logically active');
  assert.equal(holding.idlePose.captured, true, 'rest pose lost its capture ownership');
  assert.ok(
    ['sit', 'loaf', 'sideLie', 'roll', 'curl'].includes(holding.idleMode),
    `capture selected a non-rest pose: ${holding.idleMode}`,
  );
  const renderedForePawMidpoint = {
    x: (holding.renderFeet.rightFore.x + holding.renderFeet.leftFore.x) * 0.5,
    y: (holding.renderFeet.rightFore.y + holding.renderFeet.leftFore.y) * 0.5,
  };
  const heldMouseDistance = Math.hypot(
    holding.mouse.rendered.x - renderedForePawMidpoint.x,
    holding.mouse.rendered.y - renderedForePawMidpoint.y,
  );
  assert.ok(
    heldMouseDistance <= 12 * holding.rigScale,
    `captured mouse drifted ${heldMouseDistance.toFixed(2)}px from the resting fore paws`,
  );

  const captureRestModes = new Set();
  for (let frameIndex = 0; frameIndex < 2400; frameIndex += 1) {
    step(1);
    holding = sandbox.__catMouseDemo.getSnapshot();
    assert.equal(holding.capture.active, true, 'capture ended without an escape input');
    if (holding.idlePose.captured) {
      captureRestModes.add(holding.idleMode);
      assert.ok(
        ['sit', 'loaf', 'sideLie', 'roll', 'curl'].includes(holding.idleMode),
        `capture chained into an incompatible action: ${holding.idleMode}`,
      );
    } else {
      assert.equal(holding.leapPhase, 'pin', 'capture must alternate only between resting and fore-paw pinning');
    }
  }
  assert.ok(captureRestModes.size >= 1, 'long capture never held a complete rest pose');

  const capturePointer = { x: holding.capture.pointerX, y: holding.capture.pointerY };
  sandbox.__catMouseDemo.moveMouse(capturePointer.x + 6 * holding.rigScale, capturePointer.y);
  step(20);
  holding = sandbox.__catMouseDemo.getSnapshot();
  assert.equal(holding.capture.active, true, 'minor pointer jitter must not release capture');

  sandbox.__catMouseDemo.moveMouse(capturePointer.x + 32 * holding.rigScale, capturePointer.y);
  step(1);
  const escaped = sandbox.__catMouseDemo.getSnapshot();
  assert.equal(escaped.capture.active, false, 'deliberate target movement must release capture');
  assert.equal(escaped.idlePose.captured, false, 'capture ownership leaked after escape');
  assert.equal(escaped.mouse.active, true, 'escape movement should resume pursuit, not remove the target');
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
    step(82);
    const cleared = sandbox.__catMouseDemo.getSnapshot();
    assert.equal(cleared.behavior, 'prowl', `${mode}: clearing the pose did not resume prowl`);
    assert.equal(cleared.idlePose.visualMode, null, `${mode}: visual pose leaked after exit`);
    assert.equal(cleared.idlePose.blend, 0, `${mode}: pose blend did not settle back to zero`);
    assertRigSnapshot(cleared, `${mode} pose exit`);
  }
}

// A pose change must be a real cross-mix, not a diagnostic label change over
// a one-frame geometry swap. The body leads; paws and tail remain in the old
// support pattern until the new center of mass has started to settle.
{
  sandbox.__catMouseDemo.previewIdlePose('sit', 1);
  step(150);
  const before = sandbox.__catMouseDemo.getSnapshot();
  sandbox.__catMouseDemo.previewIdlePose('sideLie', 1);
  step(1);
  const first = sandbox.__catMouseDemo.getSnapshot();
  const rigJump = Math.max(...Object.keys(before.rig).map((name) => Math.hypot(
    first.rig[name].x - before.rig[name].x,
    first.rig[name].y - before.rig[name].y,
  )));
  const pawJump = Math.max(...Object.keys(before.renderFeet).map((name) => Math.hypot(
    first.renderFeet[name].x - before.renderFeet[name].x,
    first.renderFeet[name].y - before.renderFeet[name].y,
  )));
  assert.ok(rigJump < 7 * first.rigScale, `pose crossfade popped the rig by ${rigJump.toFixed(3)}px`);
  assert.ok(pawJump < 5 * first.rigScale, `pose crossfade popped a paw by ${pawJump.toFixed(3)}px`);
  assert.equal(first.idlePose.transition.active, true, 'pose-to-pose transition did not remain active');
  assert.equal(first.idlePose.transition.to, 'sideLie', 'pose mixer lost its destination');

  step(42);
  const middle = sandbox.__catMouseDemo.getSnapshot();
  assert.ok(middle.idlePose.weights.sit > 0.08, 'old torso pose vanished before weight transfer');
  assert.ok(middle.idlePose.weights.sideLie > 0.08, 'new torso pose did not enter during crossfade');
  assert.ok(middle.idlePose.pawWeights.sit > 0.03, 'old paw support vanished before the body settled');
  assert.ok(middle.idlePose.pawWeights.sideLie > 0.01, 'new paw support never joined the crossfade');
  assert.ok(Math.abs(middle.idlePose.transitionSway) > 0.08, 'pose transition lacks anticipatory weight transfer');
  assertRigSnapshot(middle, 'mid pose crossfade');

  step(150);
  const settled = sandbox.__catMouseDemo.getSnapshot();
  assert.equal(settled.idlePose.transition.active, false, 'pose crossfade did not settle');
  assert.ok(settled.idlePose.weights.sideLie > 0.999, 'destination pose did not reach full weight');
  assert.ok(settled.idlePose.weights.sit < 0.001, 'source pose leaked after crossfade');
  sandbox.__catMouseDemo.clearIdlePose();
  step(100);
}

// Deep rest carries a slow asymmetric breath plus sparse, localized dream
// twitches. The scheduler is deterministic for tests but deliberately
// non-periodic in duration, interval, side and body part.
{
  sandbox.__catMouseDemo.previewIdlePose('curl', -1);
  step(360);
  let sleeping = sandbox.__catMouseDemo.getSnapshot();
  assert.ok(sleeping.idlePose.sleepDepth > 0.72, 'curl did not deepen into sleep');
  assert.ok(sleeping.face.leftEyeOpen < 0.2 && sleeping.face.rightEyeOpen < 0.2, 'sleep did not soften both eyelids');
  const initialTwitchCount = sleeping.idlePose.twitch.count;
  let breathMin = sleeping.idlePose.breath;
  let breathMax = sleeping.idlePose.breath;
  let twitchPeak = 0;
  let observedTwitch = false;
  for (let frame = 0; frame < 900; frame += 1) {
    step(1);
    sleeping = sandbox.__catMouseDemo.getSnapshot();
    breathMin = Math.min(breathMin, sleeping.idlePose.breath);
    breathMax = Math.max(breathMax, sleeping.idlePose.breath);
    twitchPeak = Math.max(twitchPeak, Math.abs(sleeping.idlePose.twitch.value));
    if (sleeping.idlePose.twitch.count > initialTwitchCount && twitchPeak > 0.12) {
      observedTwitch = true;
      if (frame > 220) break;
    }
  }
  assert.ok(breathMax - breathMin > 1.15, 'sleeping breath lacks a visible inhale/exhale rhythm');
  assert.equal(observedTwitch, true, 'dream twitch scheduler did not produce a local micro-motion');
  assert.ok(twitchPeak < 1.001, 'dream twitch escaped its subtle normalized envelope');
  sandbox.__catMouseDemo.clearIdlePose();
  step(180);
  const awake = sandbox.__catMouseDemo.getSnapshot();
  assert.ok(awake.idlePose.sleepDepth < 0.02, 'sleep depth leaked into locomotion');
  assert.equal(awake.idlePose.twitch.active, false, 'dream twitch remained active after waking');
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
sandbox.__catMouseDemo.setAppearance({
  pattern: 'solid', colorway: 'black', whiteLevel: 'none', furLength: 'long',
});
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
    assertPoseEnvelopeInsideViewport(current, 'compact long-hair edge pursuit');
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
assert.ok(
  earAimMin < -0.01 && earAimMax > 0.01,
  `ears must swivel toward targets on both sides of the head (${earAimMin.toFixed(4)}..${earAimMax.toFixed(4)})`,
);
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
    assertPoseEnvelopeInsideViewport(current, `${rate} Hz compact long-hair turn`);
  }
  sandbox.__catMouseDemo.releaseMouse();
  step(Math.round(rate * 0.4), 1000 / rate);
}
sandbox.__catMouseDemo.setAppearance(sandbox.CatAppearance.DEFAULT);

// The coat is now a fixed, low-topology mass instead of a DPR-dependent field
// of proxy strands. Changing only DPR must therefore preserve both geometry
// and the exact Canvas topology at the minimum anatomy scale.
fakeViewportWidth = 360;
fakeViewportHeight = 480;
sandbox.devicePixelRatio = 1.1;
resizeObserverCallback();
const referenceDprMetrics = {};
const referenceDprGeometry = {};
const referenceDprSignatures = {};
function dprInvariantFurSignature(selectedFur) {
  return JSON.stringify(
    JSON.parse(furDrawSignature(selectedFur))
      .filter((call) => call.property !== 'setTransform'),
  );
}
for (const selectedFur of ['short', 'medium', 'long']) {
  referenceDprMetrics[selectedFur] = furDrawMetrics(selectedFur);
  referenceDprGeometry[selectedFur] = JSON.parse(JSON.stringify(
    sandbox.__catMouseDemo.getSnapshot().furGeometry,
  ));
  referenceDprSignatures[selectedFur] = dprInvariantFurSignature(selectedFur);
  assert.equal(
    referenceDprGeometry[selectedFur].lodInvariant,
    true,
    `${selectedFur}: fixed coat topology must declare DPR invariance`,
  );
}

// Adversarial browser zoom can combine the minimum anatomy scale with DPR
// below one. Filled masses must not thin out, switch topology, or disappear.
sandbox.devicePixelRatio = 0.75;
resizeObserverCallback();
const subpixelDprMetrics = {};
const subpixelDprGeometry = {};
for (const selectedFur of ['short', 'medium', 'long']) {
  subpixelDprMetrics[selectedFur] = furDrawMetrics(selectedFur);
  subpixelDprGeometry[selectedFur] = JSON.parse(JSON.stringify(
    sandbox.__catMouseDemo.getSnapshot().furGeometry,
  ));
  assert.deepEqual(
    subpixelDprGeometry[selectedFur],
    referenceDprGeometry[selectedFur],
    `${selectedFur}: DPR changes must preserve the authoritative filled geometry`,
  );
  assert.deepEqual(
    subpixelDprMetrics[selectedFur],
    referenceDprMetrics[selectedFur],
    `${selectedFur}: DPR changes must preserve the bounded draw budget`,
  );
  assert.equal(
    dprInvariantFurSignature(selectedFur),
    referenceDprSignatures[selectedFur],
    `${selectedFur}: DPR changes must not substitute or drop coat layers`,
  );
}

// The mini-preview adds another local transform after backing-store DPR. At
// 144px and DPR 0.75, medium/long still need closed masses rather than thin
// device-pixel-dependent strokes.
function previewMassMetrics(selectedFur) {
  previewContextCalls.length = 0;
  previewPathCalls.length = 0;
  recordPreviewContextCalls = true;
  try {
    sandbox.__catMouseDemo.setAppearance({
      pattern: 'solid', colorway: 'black', whiteLevel: 'none', furLength: selectedFur,
    });
  } finally {
    recordPreviewContextCalls = false;
  }
  const fills = previewPathCalls.filter((call) => call.property === 'fill');
  const strokes = previewPathCalls.filter((call) => call.property === 'stroke');
  return {
    total: previewContextCalls.length,
    fills: fills.length,
    closedFills: fills.filter((call) => call.pathClosed).length,
    strokes: strokes.length,
    broadStrokes: strokes.filter((call) => Number(call.lineWidth) >= 3.8).length,
  };
}

fakePreviewSize = 144;
sandbox.__catMouseDemo.setAppearancePanelOpen(true);
const compactPreviewMetrics = {
  short: previewMassMetrics('short'),
  medium: previewMassMetrics('medium'),
  long: previewMassMetrics('long'),
};
assert.ok(
  compactPreviewMetrics.medium.closedFills >= compactPreviewMetrics.short.closedFills + 3,
  `medium mini-preview must add closed body/head masses: ${JSON.stringify(compactPreviewMetrics)}`,
);
assert.ok(
  compactPreviewMetrics.long.closedFills === compactPreviewMetrics.medium.closedFills
    && compactPreviewMetrics.long.fills === compactPreviewMetrics.medium.fills
    && compactPreviewMetrics.long.strokes === compactPreviewMetrics.medium.strokes,
  `medium and long mini-previews must share one mass topology: ${JSON.stringify(compactPreviewMetrics)}`,
);
assert.ok(
  compactPreviewMetrics.long.broadStrokes >= compactPreviewMetrics.short.broadStrokes + 2,
  `long mini-preview must retain broad tail and coat-direction masses: ${JSON.stringify(compactPreviewMetrics)}`,
);
sandbox.__catMouseDemo.setAppearancePanelOpen(false);
fakePreviewSize = 168;
sandbox.__catMouseDemo.setAppearance({
  pattern: 'tabby', colorway: 'orange', whiteLevel: 'low', furLength: 'long',
});

// Repeated zoom crossings must remain a no-op for the fixed coat topology.
sandbox.devicePixelRatio = 0.95;
resizeObserverCallback();
const zoomGeometryA = JSON.parse(JSON.stringify(sandbox.__catMouseDemo.getSnapshot().furGeometry));
sandbox.devicePixelRatio = 1.1;
resizeObserverCallback();
const zoomGeometryB = JSON.parse(JSON.stringify(sandbox.__catMouseDemo.getSnapshot().furGeometry));
sandbox.devicePixelRatio = 0.95;
resizeObserverCallback();
const zoomGeometryC = JSON.parse(JSON.stringify(sandbox.__catMouseDemo.getSnapshot().furGeometry));
assert.deepEqual(zoomGeometryB, zoomGeometryA, 'zoom-in must not change long-coat mass geometry');
assert.deepEqual(zoomGeometryC, zoomGeometryA, 'zoom-back must not change long-coat mass geometry');

// Restore the compact browser baseline for the remaining UI checks.
fakeViewportWidth = 548;
fakeViewportHeight = 536;
sandbox.devicePixelRatio = 2;
resizeObserverCallback();

ids.get('appearance-toggle').dispatch('click');
assert.equal(ids.get('appearance-panel').hidden, false, 'appearance disclosure must open');
assert.equal(ids.get('appearance-toggle').getAttribute('aria-expanded'), 'true');
const orangeSwatchZh = ids.get('appearance-colorway-grid').children.find((node) => node.getAttribute('data-key') === 'orange');
assert.ok(orangeSwatchZh, 'visual colorway grid must render the selected orange swatch');
assert.equal(orangeSwatchZh.getAttribute('aria-label'), '橙虎斑', 'colorway swatches must expose localized names instead of raw keys');
assert.match(orangeSwatchZh.innerHTML, /橙虎斑/, 'visible colorway labels must be localized');
const tabbyChip = ids.get('appearance-pattern-grid').children.find((node) => node.getAttribute('data-key') === 'tabby');
const bicolorChip = ids.get('appearance-pattern-grid').children.find((node) => node.getAttribute('data-key') === 'bicolor');
assert.equal(tabbyChip.tabIndex, 0, 'selected pattern must be the radiogroup Tab stop');
assert.equal(bicolorChip.tabIndex, -1, 'unselected patterns must leave the radiogroup Tab order');
let patternArrowPrevented = false;
ids.get('appearance-pattern-grid').dispatch('keydown', {
  key: 'ArrowRight',
  target: tabbyChip,
  preventDefault() { patternArrowPrevented = true; },
});
assert.equal(patternArrowPrevented, true, 'pattern arrow navigation must prevent page scrolling');
assert.equal(sandbox.__catMouseDemo.getSnapshot().appearance.pattern, 'bicolor', 'ArrowRight must select the next enabled pattern');
assert.equal(bicolorChip.focused, true, 'arrow navigation must move focus with selection');
ids.get('appearance-reset').dispatch('click');
assert.deepEqual(
  ids.get('appearance-white-level-group').children.map((node) => node.getAttribute('data-key')),
  ['none', 'low', 'medium'],
  'dynamic marking controls must return to canonical order after pattern changes',
);
const calicoChip = ids.get('appearance-pattern-grid').children.find((node) => node.getAttribute('data-key') === 'calico');
assert.ok(calicoChip, 'visual pattern grid must render the calico chip');
calicoChip.dispatch('click');
assert.equal(sandbox.__catMouseDemo.getSnapshot().appearance.pattern, 'calico', 'visual pattern chips must update appearance state');
ids.get('appearance-reset').dispatch('click');
ids.get('appearance-fur-length').value = 'hairless';
ids.get('appearance-fur-length').dispatch('change');
const lowMarkingSegment = ids.get('appearance-white-level-group').children.find((node) => node.getAttribute('data-key') === 'low');
assert.equal(lowMarkingSegment.disabled, false, 'hairless cats must retain selectable pigment/marking regions');
assert.equal(lowMarkingSegment.getAttribute('aria-checked'), 'true', 'hairless selection must not hide the active marking state');
ids.get('appearance-reset').dispatch('click');
ids.get('appearance-pattern').value = 'calico';
ids.get('appearance-pattern').dispatch('change');
assert.equal(sandbox.__catMouseDemo.getSnapshot().appearance.pattern, 'calico');
assert.equal(sandbox.__catMouseDemo.getSnapshot().appearance.colorway, 'classic');
ids.get('appearance-white-level').value = 'high';
ids.get('appearance-white-level').dispatch('change');
ids.get('appearance-fur-length').value = 'long';
ids.get('appearance-fur-length').dispatch('change');
assert.deepEqual(
  JSON.parse(JSON.stringify(sandbox.__catMouseDemo.getSnapshot().appearance)),
  { pattern: 'calico', colorway: 'classic', whiteLevel: 'high', furLength: 'long' },
  'appearance form must update pattern, body-part mask and fur length together',
);
document.dispatch('keydown', { key: 'Escape', preventDefault() {} });
assert.equal(ids.get('appearance-panel').hidden, true, 'Escape must close the appearance panel');
assert.equal(ids.get('appearance-toggle').focused, true, 'Escape must return focus to the disclosure');
ids.get('appearance-reset').dispatch('click');
assert.equal(sandbox.__catMouseDemo.getSnapshot().appearance.furLength, 'short');

ids.get('language-toggle').dispatch('click');
assert.equal(documentElement.lang, 'en');
const orangeSwatchEn = ids.get('appearance-colorway-grid').children.find((node) => node.getAttribute('data-key') === 'orange');
assert.equal(orangeSwatchEn.getAttribute('aria-label'), 'Orange tabby', 'language changes must refresh colorway accessible names');
assert.match(orangeSwatchEn.innerHTML, /Orange tabby/, 'language changes must refresh visible colorway labels');
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
failureSandbox.CatAppearance = sandbox.CatAppearance;
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

console.log('check-runtime: capture/rest/escape, staged pose crossfades, sleep breath/twitches, restrained feline head, appearance taxonomy/fur matrix, seamless coat, bounded spine, anatomical reach, 548x536 edges, and accessible minimal UI OK');
