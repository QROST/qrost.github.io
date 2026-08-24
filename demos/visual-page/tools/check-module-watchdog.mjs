#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const demos = [
  { name: 'visual-page', root: path.resolve(here, '..'), app: 'app.js' },
  { name: 'neon-abyss', root: path.resolve(here, '../../neon-abyss'), app: 'app-club.js' },
];

function element(text = '') {
  const classes = new Set();
  const attrs = new Map();
  return {
    textContent: text,
    hidden: true,
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
    },
    setAttribute: (name, value) => attrs.set(name, String(value)),
    removeAttribute: (name) => attrs.delete(name),
    _classes: classes,
    _attrs: attrs,
  };
}

function extractWatchdog(html) {
  const match = html.match(/<script id="module-watchdog">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('module-watchdog classic script is missing');
  return match[1];
}

function bootWatchdog(source) {
  const loading = element('original loading');
  const gateError = element();
  let timeoutCallback = null;
  let cleared = false;
  const window = { __ABYSS_MODULE_TIMEOUT_MS: 25 };
  const sandbox = {
    window,
    Number,
    document: { getElementById: (id) => id === 'loading' ? loading : id === 'module-error' ? gateError : null },
    setTimeout: (callback) => { timeoutCallback = callback; return 7; },
    clearTimeout: (id) => { if (id === 7) cleared = true; },
  };
  vm.runInNewContext(source, sandbox);
  return { window, loading, gateError, timeout: () => timeoutCallback(), wasCleared: () => cleared };
}

for (const demo of demos) {
  const html = fs.readFileSync(path.join(demo.root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(demo.root, demo.app), 'utf8');
  if (!/rel="modulepreload"[^>]+onerror="[^"]*__abyssModuleFallback/.test(html)) {
    throw new Error(`${demo.name}: modulepreload failure is not wired to the watchdog`);
  }
  if (!/type="module"[^>]+onerror="[^"]*__abyssModuleFallback/.test(html)) {
    throw new Error(`${demo.name}: application-module failure is not wired to the watchdog`);
  }
  if (!/window\.__abyssMarkModuleReady\(\)/.test(app)) {
    throw new Error(`${demo.name}: application module never disarms the watchdog`);
  }

  const source = extractWatchdog(html);
  const direct = bootWatchdog(source);
  direct.window.__abyssModuleFallback('fault-injection');
  if (direct.gateError.hidden || !direct.loading._classes.has('load-failed')) {
    throw new Error(`${demo.name}: direct module failure is not visible at both layers`);
  }
  if (direct.loading._attrs.get('role') !== 'alert' || !/failed to load/.test(direct.loading.textContent)) {
    throw new Error(`${demo.name}: loading fallback is not an accessible error`);
  }
  direct.window.__abyssMarkModuleReady();
  if (!direct.gateError.hidden || direct.loading._classes.has('load-failed') || direct.loading.textContent !== 'original loading' || !direct.wasCleared()) {
    throw new Error(`${demo.name}: late module success does not cleanly disarm/restore the watchdog`);
  }

  const timed = bootWatchdog(source);
  timed.timeout();
  if (timed.gateError.hidden || !timed.loading._classes.has('load-failed')) {
    throw new Error(`${demo.name}: timeout fault injection did not become visible`);
  }
  console.log(`OK: ${demo.name} pre-module error + timeout watchdog`);
}

const visualRoot = demos[0].root;
const visualApp = fs.readFileSync(path.join(visualRoot, 'app.js'), 'utf8');
const visualCss = fs.readFileSync(path.join(visualRoot, 'style.css'), 'utf8');
if (!/REDUCED_MOTION[\s\S]*prefers-reduced-motion/.test(visualApp)
    || !/visualTime = REDUCED_MOTION \? tElapsed \* 0\.05/.test(visualApp)
    || !/!REDUCED_MOTION && !dragging/.test(visualApp)
    || !/@media \(prefers-reduced-motion: reduce\)[\s\S]*#grain[\s\S]*animation: none/.test(visualCss)) {
  throw new Error('visual-page: reduced-motion does not suppress continuous movement layers');
}
console.log('OK: visual-page reduced-motion slows 3D time/drift and disables grain animation');
