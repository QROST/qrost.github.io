#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');

async function exercise(failure) {
  const elements = {};
  const errors = [];
  const langCallbacks = [];
  let language = 'zh', failing = true;
  function element(id) {
    const classes = new Set(/error|warning|modal/.test(id) ? ['hidden'] : []), listeners = {};
    return {
      id, innerHTML: '', textContent: '', value: '', dataset: {}, style: {},
      classList: {
        contains: key => classes.has(key), add: key => classes.add(key), remove: key => classes.delete(key),
        toggle(key, enabled) { if (enabled === undefined) enabled = !classes.has(key); enabled ? classes.add(key) : classes.delete(key); },
      },
      addEventListener(name, fn) { (listeners[name] ||= []).push(fn); },
      fire(name, event) { (listeners[name] || []).forEach(fn => fn(event || { target: this })); },
      querySelectorAll: () => [], querySelector: () => null, setAttribute() {}, focus() {}, scrollIntoView() {},
    };
  }
  const get = id => elements[id] ||= element(id);
  const document = {
    readyState: 'loading', documentElement: element('root'), body: element('body'),
    getElementById: get, querySelectorAll: () => [], addEventListener() {}, contains: () => true,
  };
  const i18n = {
    t: key => language + ':' + key,
    name: row => row.name_zh || row.display_name_zh || row.legal_name_zh || row.id,
    pick: (zh, en) => language === 'en' ? en || zh || '' : zh || en || '',
    enumLabel: (_kind, value) => value || '', isEn: () => language === 'en',
    applyLangToUI() {}, onChange: fn => langCallbacks.push(fn),
    toggleLang() { language = language === 'zh' ? 'en' : 'zh'; langCallbacks.forEach(fn => fn()); },
  };
  const draw = id => () => {
    if (failing && (failure === id || failure === 'all')) throw new Error('Injected renderer failure: ' + id);
    if (failing && failure === 'missing-geo' && id === 'china-map') return false;
    return true;
  };
  const context = {
    document, location: { hash: '' }, localStorage: { setItem() {} },
    console: { error: (...args) => errors.push(args), warn() {}, log() {} },
    fetch: async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(ROOT, url.split('?')[0]), 'utf8')) }),
    window: {
      CHINA_AUTO_I18N: i18n, echarts: failure === 'no-echarts' ? undefined : {},
      CHINA_AUTO_MAP: { render: draw('china-map'), resize() {}, setTheme() {} },
      CHINA_AUTO_CHARTS: { renderOverview: draw('overview-chart'), renderClusterGraph: draw('cluster-graph'), resizeAll() {}, setTheme() {} },
      addEventListener() {}, requestAnimationFrame: fn => fn(),
    },
  };
  vm.createContext(context);
  for (const name of ['search.js', 'data-loader.js', 'app.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js', name), 'utf8'), context, { filename: name });
  }
  await context.window.CHINA_AUTO_APP.init();
  function catalogsRemainAvailable() {
    assert.ok(get('init-error').classList.contains('hidden'), failure + ': optional chart failure is not a global data failure');
    assert.match(get('catalog-body').innerHTML, /data-city=/, failure + ': city catalog rendered');
    assert.match(get('orgs-body').innerHTML, /data-org=/, failure + ': organization catalog rendered');
    assert.match(get('sources-body').innerHTML, /<td>/, failure + ': source table rendered');
    assert.match(get('cluster-cards').innerHTML, /data-cluster=/, failure + ': semantic cluster cards rendered');
  }
  catalogsRemainAvailable();
  assert.equal(get('runtime-warning').classList.contains('hidden'), false, failure + ': visible runtime notice');
  const affected = ['all', 'no-echarts'].includes(failure) ? ['overview-chart', 'china-map', 'cluster-graph'] : [failure === 'missing-geo' ? 'china-map' : failure];
  affected.forEach(id => assert.equal(get(id + '-error').classList.contains('hidden'), false, failure + ': local chart notice'));
  get('map-filter-role').fire('change');
  get('theme-toggle').fire('click');
  get('lang-toggle').fire('click');
  catalogsRemainAvailable();
  affected.forEach(id => assert.match(get(id + '-error').textContent, /^en:/, failure + ': dynamic warning translated'));
  context.window.CHINA_AUTO_APP.openCityModal(context.window.CHINA_AUTO_DATA.cities[0].id);
  assert.match(get('city-modal-body').innerHTML, /./, failure + ': detail remains available');
  failing = false;
  context.window.echarts = {};
  get('theme-toggle').fire('click');
  assert.equal(get('runtime-warning').classList.contains('hidden'), true, failure + ': warning clears after successful redraw');
  affected.forEach(id => assert.equal(get(id + '-error').classList.contains('hidden'), true));
  catalogsRemainAvailable();
  assert.ok(failure === 'no-echarts' || errors.length > 0, failure + ': renderer errors remain diagnosable');
  console.log('PASS · china-auto optional visualization failure · ' + failure);
}

(async () => {
  for (const failure of ['overview-chart', 'china-map', 'cluster-graph', 'all', 'no-echarts', 'missing-geo']) await exercise(failure);
})().catch(error => { console.error(error); process.exitCode = 1; });
