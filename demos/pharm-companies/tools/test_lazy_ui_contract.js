#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/pharm-companies.css'), 'utf8');

function requireMatch(value, pattern, message) {
  if (!pattern.test(value)) throw new Error(message);
}

requireMatch(app, /var ids = \['overview', 'map', 'catalog'/, 'first-screen overview/map are not lazy-load observation targets');
requireMatch(app, /new IntersectionObserver[\s\S]*ensureProducts\(\)/, 'product load is not gated by viewport observation');
requireMatch(app, /showProductLoadError\(error\)/, 'lazy failure is not exposed locally');
requireMatch(app, /product-load-retry[^\n]*ensureProducts\(\)/, 'lazy failure is not retryable from the UI');
requireMatch(app, /!D\.productsLoaded[\s\S]*tabPipeline[\s\S]*I18N\.t\('loading'\)/, 'product-dependent dialog tabs can flash no-data before loading');
requireMatch(app, /closePolicyModal[\s\S]*data-policy-link[\s\S]*policyReturn\.focus/, 'policy-to-company dialog focus chain cannot recover a lazy re-rendered policy chip');
if (/catch\(function \(error\)[\s\S]{0,160}init-error/.test(app)) {
  throw new Error('lazy product failure still opens the global initialization error');
}
requireMatch(html, /id="product-load-error"[^>]*role="alert"/, 'local product load alert is missing');
requireMatch(html, /id="product-load-retry"[^>]*type="button"/, 'local product retry button is missing');
requireMatch(css, /\.select\s*\{[^}]*max-width:\s*100%[^}]*min-width:\s*0/s, 'long select options can force page-level mobile overflow');

console.log('OK: first-screen lazy trigger, local retry UI, pre-load dialog, and mobile select contracts pass');
