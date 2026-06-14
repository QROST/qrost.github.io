/**
 * Lazy-load category JSON shards via manifest.json.
 */
(function () {
  'use strict';

  const BASE = 'assets/data/';
  // Cache-bust the data shards (manifest, vendors, category JSON, etc.) so that
  // returning visitors pick up data changes. Bump on any data-file edit.
  const DATA_VERSION = '20260614f';
  let manifest = null;
  let vendors = null;
  let kernels = null;
  let marketStats = null;
  let policies = null;
  let benchmarkPairs = null;
  let breakthroughs = null;
  const categoryCache = {};
  let allProducts = null;
  const vendorMap = {};
  const kernelMap = {};

  async function fetchJson(path) {
    const sep = path.indexOf('?') === -1 ? '?' : '&';
    const r = await fetch(path + sep + 'v=' + DATA_VERSION);
    if (!r.ok) throw new Error(`fetch ${path}: ${r.status}`);
    return r.json();
  }

  async function loadManifest() {
    if (manifest) return manifest;
    manifest = await fetchJson(BASE + 'manifest.json');
    return manifest;
  }

  async function loadVendors() {
    if (vendors) return vendors;
    const data = await fetchJson(BASE + 'vendors.json');
    vendors = data.vendors || data;
    vendors.forEach((v) => { vendorMap[v.id] = v; });
    return vendors;
  }

  async function loadKernels() {
    if (kernels) return kernels;
    const data = await fetchJson(BASE + 'kernels.json');
    kernels = data.kernels || data;
    kernels.forEach((k) => { kernelMap[k.id] = k; });
    return kernels;
  }

  async function loadMarketStats() {
    if (marketStats) return marketStats;
    marketStats = await fetchJson(BASE + 'market-stats.json');
    return marketStats;
  }

  async function loadPolicies() {
    if (policies) return policies;
    policies = await fetchJson(BASE + 'policies.json');
    return policies;
  }

  async function loadBenchmarkPairs() {
    if (benchmarkPairs) return benchmarkPairs;
    const data = await fetchJson(BASE + 'comparisons/benchmark-pairs.json');
    benchmarkPairs = data.pairs || data;
    return benchmarkPairs;
  }

  async function loadBreakthroughs() {
    if (breakthroughs) return breakthroughs;
    breakthroughs = await fetchJson(BASE + 'breakthroughs.json');
    return breakthroughs;
  }

  async function loadCategory(catId) {
    if (categoryCache[catId]) return categoryCache[catId];
    const m = await loadManifest();
    const entry = (m.categories || []).find((c) => c.id === catId);
    const file = entry ? entry.file : `categories/${catId}.json`;
    const data = await fetchJson(BASE + file);
    const products = data.products || [];
    categoryCache[catId] = products;
    return products;
  }

  async function loadAllProducts() {
    if (allProducts) return allProducts;
    const m = await loadManifest();
    const cats = m.categories || [];
    const lists = await Promise.all(cats.map((c) => loadCategory(c.id)));
    allProducts = lists.flat();
    return allProducts;
  }

  function getVendor(id) {
    return vendorMap[id] || null;
  }

  function getKernel(id) {
    return kernelMap[id] || null;
  }

  function getProductById(id) {
    if (!allProducts) return null;
    return allProducts.find((p) => p.id === id) || null;
  }

  /** Products referencing a kernel_id (catalog cross-ref). */
  function getProductsByKernel(kernelId) {
    return (allProducts || []).filter((p) => p.kernel_id === kernelId);
  }

  /** Domestic-origin products per kernel (for table KPI). */
  function countDomesticProductsForKernel(kernelId) {
    return getProductsByKernel(kernelId).filter((p) => p.origin === 'domestic').length;
  }

  function kernelDisplayName(k) {
    if (!k) return '';
    const I18N = window.INDUSTRIAL_I18N;
    if (I18N && I18N.isEn && I18N.isEn()) return k.name_en || k.name_zh;
    return k.name_zh || k.name_en;
  }

  function productKernelLabel(p) {
    if (!p) return '';
    const k = p.kernel_id ? getKernel(p.kernel_id) : null;
    if (k) return kernelDisplayName(k);
    return p.kernel || '';
  }

  async function initCore() {
    await Promise.all([
      loadManifest(), loadVendors(), loadKernels(), loadMarketStats(), loadPolicies(), loadBenchmarkPairs(),
    ]);
    await loadAllProducts();
  }

  window.INDUSTRIAL_CATALOG = {
    initCore,
    loadManifest,
    loadVendors,
    loadKernels,
    loadMarketStats,
    loadPolicies,
    loadBenchmarkPairs,
    loadBreakthroughs,
    loadCategory,
    loadAllProducts,
    getVendor,
    getKernel,
    getProductById,
    getProductsByKernel,
    countDomesticProductsForKernel,
    kernelDisplayName,
    productKernelLabel,
    get vendorMap() { return vendorMap; },
    get kernelMap() { return kernelMap; },
    get manifest() { return manifest; },
    get allProducts() { return allProducts || []; },
    get allKernels() { return kernels || []; },
  };
})();
