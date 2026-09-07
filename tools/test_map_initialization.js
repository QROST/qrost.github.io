#!/usr/bin/env node
'use strict';

// Run real touch-gate callbacks against map modules. ECharts requires a complete
// geo/series model before incremental onChange updates are safe to merge.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');

function exercise(module, coarseAtStart) {
  let coarse = coarseAtStart;
  const listeners = {};
  const timers = [];
  const charts = {};
  const nodes = {};
  function node(id) {
    const events = {}, classes = new Set(), attrs = {};
    return {
      id, style: {}, children: [], textContent: '', innerHTML: '',
      classList: { toggle(k, on) { on ? classes.add(k) : classes.delete(k); } },
      setAttribute(k, v) { attrs[k] = v; }, getAttribute(k) { return attrs[k]; },
      addEventListener(k, fn) { (events[k] ||= []).push(fn); },
      fire(k) { (events[k] || []).forEach(fn => fn({ preventDefault() {}, stopPropagation() {} })); },
      appendChild(child) { this.children.push(child); child.parentNode = this; },
      querySelector() { return null; },
      querySelectorAll() { return this.children.filter(x => x.isCanvas); },
      contains(target) { return target === this || this.children.includes(target); },
    };
  }
  for (const id of ['china-map', 'world-map', 'lineage-graph', 'map-legend', 'cluster-graph', 'cluster-graph-head', 'cluster-legend']) {
    nodes[id] = node(id);
    node(id + '-panel').appendChild(nodes[id]);
  }
  const i18n = {
    t: key => key, name: row => row.name || row.id, pick: (a, b) => a || b,
    enumLabel: (_kind, value) => value, isEn: () => false,
  };
  const context = {
    console, setTimeout: fn => { timers.push(fn); return timers.length; }, document: { documentElement: { classList: { contains: () => false } }, getElementById: id => nodes[id], createElement: () => node('') },
    getComputedStyle: () => ({ getPropertyValue: () => '#888888' }),
    navigator: { maxTouchPoints: 0 },
  };
  context.window = {
    CHINA_GEO: {}, WORLD_GEO: {},
    CHINA_AUTO_I18N: i18n, PHARM_I18N: i18n, SHELTERCATS_I18N: i18n, ARCH_I18N: i18n,
    matchMedia: () => ({ matches: coarse, addEventListener() {} }),
    addEventListener(k, fn) { (listeners[k] ||= []).push(fn); },
    setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {},
    requestAnimationFrame(fn) { fn(); return 1; }, cancelAnimationFrame() {},
    echarts: {
      registerMap() {}, getInstanceByDom: surface => charts[surface.id],
      init(surface) {
        const chart = {
          options: {}, calls: [], resized: 0, on() {}, off() {}, dispose() {}, getOption() { return this.options; },
          resize() { this.resized += 1; },
          setOption(option, replace) {
            const geo = Array.isArray(option.geo) ? option.geo[0] : option.geo;
            if (geo) {
              assert.ok(geo.map || (!replace && this.options.geo && this.options.geo.map), module + ': geo.map must exist before incremental update');
            }
            if (option.series && !geo && !this.options.geo) {
              assert.ok(option.series[0].type || (!replace && this.options.series && this.options.series[0].type), module + ': series.type must exist before incremental update');
            }
            this.calls.push(option);
            if (replace) this.options = {};
            if (geo) this.options.geo = { ...(this.options.geo || {}), ...geo };
            if (option.series) this.options.series = option.series.map((series, i) => ({ ...((this.options.series || [])[i] || {}), ...series }));
            // ECharts replaces its canvas on a full render; syncSurface must cover it.
            if (replace || surface.children.length === 0) surface.children = [{ isCanvas: true, style: {} }];
          },
        };
        charts[surface.id] = chart;
        return chart;
      },
    },
  };
  vm.createContext(context);
  for (const file of ['touch-gate.js', module === 'architecture-history' ? 'maps.js' : 'map.js', ...(module === 'china-auto' ? ['charts.js'] : [])]) {
    const source = 'demos/' + module + '/assets/js/' + file;
    vm.runInContext(fs.readFileSync(path.join(ROOT, source), 'utf8'), context, { filename: source });
  }
  const w = context.window;
  const opts = { cities: [], facilities: [], clusters: [], sites: [], shelters: [], getCompany: () => null };
  let render;
  if (module === 'architecture-history') {
    render = () => { w.ARCH_MAPS.renderWorld([], {}); w.ARCH_MAPS.renderLineage([], {}); };
  } else {
    const api = module === 'china-auto' ? w.CHINA_AUTO_MAP : module === 'pharm-companies' ? w.PHARM_MAP : w.SHELTERCATS_MAP;
    render = () => {
      api.render(opts);
      if (module === 'china-auto') w.CHINA_AUTO_CHARTS.renderClusterGraph({ cities: [{ id: 'city-test', name: 'City', role_tags: [] }], relations: [], clusters: [], layers: {} });
    };
  }
  const fireWindow = name => (listeners[name] || []).forEach(fn => fn({ target: null }));
  render();
  assert.ok(Object.keys(charts).length, module + ': rendered charts');
  for (const [id, chart] of Object.entries(charts)) {
    const surface = nodes[id];
    const initial = chart.calls[0].geo || chart.calls[0].series[0];
    assert.equal(initial.roam, !coarseAtStart, id + ': first complete render respects coarse pointer lock');
    assert.equal(surface.style.touchAction, coarse ? 'pan-y' : 'none');
    if (coarse) {
      surface.parentNode.children.find(child => child.type === 'button').fire('click');
      assert.equal(surface._qrostGate.isInteractive(), true, id + ': toggle unlocks');
      assert.equal(surface.style.touchAction, 'none');
      fireWindow('scroll');
      assert.equal(surface._qrostGate.isInteractive(), false, id + ': page scroll relocks');
    }
  }
  render();
  for (const [id, chart] of Object.entries(charts)) {
    assert.equal(nodes[id].children[0].style.touchAction, coarse ? 'pan-y' : 'none', id + ': redraw preserves canvas touch action');
    assert.equal((chart.options.geo || chart.options.series[0]).roam, !coarse);
  }
  // Viewport/posture transitions must resize charts and update input mode without reinitializing.
  for (const nextCoarse of [true, false, true]) {
    coarse = nextCoarse;
    fireWindow('orientationchange');
    while (timers.length) timers.shift()();
    for (const [id, chart] of Object.entries(charts)) {
      assert.equal(nodes[id]._qrostGate.isInteractive(), !coarse);
      assert.equal(nodes[id].style.touchAction, coarse ? 'pan-y' : 'none');
      assert.ok(chart.resized > 0, id + ': fold/unfold resizes chart');
    }
  }
  if (module === 'architecture-history') {
    w.ARCH_MAPS.dispose();
    render(); // Existing gate callbacks must also be safe after chart recreation.
  }
  console.log('PASS · ' + module + ' · ' + (coarseAtStart ? 'coarse' : 'fine') + ' pointer');
}

for (const module of ['china-auto', 'pharm-companies', 'shelter-cats', 'architecture-history']) {
  for (const coarse of [false, true]) exercise(module, coarse);
}
