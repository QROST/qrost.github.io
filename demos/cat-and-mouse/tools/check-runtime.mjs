#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const demo = path.resolve(here, '..');

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
  getBoundingClientRect() { return { left: 0, top: 0, width: 1180, height: 720 }; }
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
    constructor(callback) { this.callback = callback; }
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

for (const relative of ['assets/js/i18n.js', 'assets/js/gait.js', 'assets/js/app.js']) {
  const source = fs.readFileSync(path.join(demo, relative), 'utf8');
  vm.runInContext(source, sandbox, { filename: relative });
}
document.dispatch('DOMContentLoaded');

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
    snapshot.mouse.x, snapshot.mouse.y, snapshot.mouse.speed,
    ...Object.values(snapshot.phases),
    ...Object.values(snapshot.feet).flatMap((foot) => [foot.x, foot.y, foot.angle, foot.lift]),
    snapshot.tailTip.x, snapshot.tailTip.y,
  ]) assert.ok(Number.isFinite(value), `runtime emitted a non-finite value: ${value}`);
}

assert.ok(sandbox.__catMouseDemo, 'debug/test surface must be available');
step(120);
let snapshot = sandbox.__catMouseDemo.getSnapshot();
finiteSnapshot(snapshot);
assert.equal(snapshot.behavior, 'prowl');
assert.equal(snapshot.viewport.width, 1180);
assert.equal(snapshot.viewport.height, 720);

let previousStance = snapshot;
for (let index = 0; index < 150; index += 1) {
  step(1);
  const current = sandbox.__catMouseDemo.getSnapshot();
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
sandbox.__catMouseDemo.moveMouse(snapshot.cat.x + 45, snapshot.cat.y);
let previousSettle = snapshot;
let sawSettleSwing = false;
for (let index = 0; index < 180; index += 1) {
  step(1);
  const current = sandbox.__catMouseDemo.getSnapshot();
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
finiteSnapshot(snapshot);
assert.equal(snapshot.behavior, 'watch');
assert.ok(Object.values(snapshot.feet).every((foot) => foot.planted && foot.lift === 0));
assert.equal(sawSettleSwing, true, 'an airborne paw should finish with a lift-and-place motion');
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
finiteSnapshot(snapshot);
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

console.log('check-runtime: canvas boot, 240+ frames, pointer, pursuit, keyboard, pause, i18n, and theme OK');
