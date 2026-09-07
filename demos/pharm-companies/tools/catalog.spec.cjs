const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');

// Network research is deliberately excluded: ECharts is served from the pinned
// npm package, all currency responses are fixtures, and other external requests fail.
async function openAtlas(page, { delayedFx = false, failedFx = false, cachedFx = false, throwCharts = false, failCore = false, failLayer = false } = {}) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let releaseFx;
  const gate = delayedFx ? new Promise(resolve => { releaseFx = resolve; }) : Promise.resolve();
  await page.addInitScript(({ cachedFx }) => {
    localStorage.setItem('pharm-companies-lang', 'en');
    if (cachedFx) localStorage.setItem('pharm-companies-fx-v1', JSON.stringify({ rates: { USD: 1, CNY: 8 }, updated: '2026-01-01T00:00:00.000Z' }));
  }, { cachedFx });
  await page.route('https://**/*', async route => {
    const url = route.request().url();
    if (url.includes('echarts@5.5.1/dist/echarts.min.js')) return route.fulfill({ path: require.resolve('echarts/dist/echarts.min.js'), contentType: 'application/javascript' });
    if (url.includes('open.er-api.com')) {
      await gate;
      return route.fulfill({ status: failedFx ? 503 : 200, contentType: 'application/json', body: JSON.stringify({ rates: { USD: 1, CNY: 8, EUR: 0.9 }, time_last_update_unix: 1767225600 }) });
    }
    return route.abort();
  });
  if (throwCharts) await page.route('**/pharm-companies/assets/js/app.js*', route => route.fulfill({
    contentType: 'application/javascript', body: "window.PHARM_MAP.render = function () { throw new Error('map fixture failure'); }; window.DEALS_GRAPH.render = function () { throw new Error('graph fixture failure'); };\n" + appSource,
  }));
  let coreFailed = failCore;
  if (failCore) await page.route('**/pharm-companies/assets/data/companies.json*', route => coreFailed ? route.fulfill({ status: 503, body: '{}' }) : route.continue());
  if (failLayer) await page.route('**/pharm-companies/assets/data/country-stats.json*', route => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/demos/pharm-companies/');
  return { errors, releaseFx, recoverCore: () => { coreFailed = false; } };
}

async function waitCatalog(page) {
  await expect(page.locator('#catalog-body tr[data-company]')).toHaveCount(100);
  await expect(page.locator('#init-error')).toBeHidden();
}

test('pending FX and failed map/graph leave catalog, products and healthy charts usable', async ({ page }) => {
  const { errors, releaseFx } = await openAtlas(page, { delayedFx: true, throwCharts: true });
  await waitCatalog(page);
  await expect(page.locator('#map-render-error')).toContainText('visualization could not be displayed');
  await expect(page.locator('#deals-render-error')).toContainText('visualization could not be displayed');
  await expect(page.locator('#fx-note')).toContainText('built-in reference rate estimates');
  await expect(page.locator('#fx-note')).toContainText('Fetching exchange rates');
  await expect(page.locator('#overview-chart canvas')).not.toHaveCount(0);
  await expect(page.locator('#policies-grid')).not.toBeEmpty();
  releaseFx();
  await expect(page.locator('#fx-note')).toContainText('Rates retrieved from provider');
  await expect(page.locator('#fx-note')).toContainText('2026-01-01T00:00:00.000Z');
  await expect(page.locator('#fx-note a')).toHaveText(' · ExchangeRate-API');
  await page.locator('#lang-toggle').click();
  await expect(page.locator('#fx-note')).toContainText('汇率已从提供方获取');
  await expect(page.locator('#map-render-error')).toContainText('本区图表未能显示');
  expect(errors).toEqual([]);
});

test('core failure is atomic and retryable; optional layer failure is local and truthful', async ({ page }) => {
  const { errors, recoverCore } = await openAtlas(page, { failCore: true, failLayer: true, failedFx: true });
  await expect(page.locator('#init-error')).toBeVisible();
  await expect(page.locator('#core-load-error-text')).not.toContainText('file://');
  expect(await page.evaluate(() => [PHARM_DATA.companies.length, PHARM_DATA.sites.length])).toEqual([0, 0]);
  recoverCore();
  await page.locator('#core-load-retry').click();
  await waitCatalog(page);
  await expect(page.locator('#countries-render-error')).toContainText('data did not finish loading');
  await expect(page.locator('#product-load-error')).toBeHidden();
  await expect(page.locator('#fx-note')).toContainText('built-in reference rate estimates');
  expect(errors).toEqual([]);
});

test('all companies are reachable through keyboard pagination; filters reset the page on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await openAtlas(page, { failedFx: true });
  await waitCatalog(page);
  await page.waitForFunction(() => PHARM_DATA.productsLoaded);
  const total = await page.evaluate(() => PHARM_DATA.companies.length);
  const ids = [];
  do {
    ids.push(...await page.locator('#catalog-body tr[data-company]').evaluateAll(rows => rows.map(row => row.dataset.company)));
    if (await page.locator('#cat-next').isDisabled()) break;
    const prior = await page.locator('#cat-page-status').textContent();
    await page.locator('#cat-next').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#cat-page-status')).not.toHaveText(prior);
  } while (ids.length <= total);
  expect(ids.length).toBe(total);
  expect(new Set(ids).size).toBe(total);
  await expect(page.locator('#cat-next')).toBeDisabled();
  await page.locator('#cat-filter-tier').selectOption('roster');
  await expect(page.locator('#cat-page-status')).toContainText('Page 1 /');
  await expect(page.locator('#cat-prev')).toBeDisabled();
  const width = await page.evaluate(() => ({ body: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(width.body).toBeLessThanOrEqual(width.viewport);
  expect(errors).toEqual([]);
});

test('roster revenue display and ordering agree; recorded sites and products are accessible', async ({ page }) => {
  const { errors } = await openAtlas(page, { failedFx: true });
  await waitCatalog(page);
  await page.waitForFunction(() => PHARM_DATA.productsLoaded);
  await page.locator('#cat-filter-tier').selectOption('roster');
  await page.locator('#catalog-head button[data-sort="revenue"]').click();
  const rows = await page.locator('#catalog-body tr[data-company]').evaluateAll(nodes => nodes.map(row => ({ id: row.dataset.company, revenue: row.children[4].textContent, products: row.children[5].textContent })));
  const records = await page.evaluate(() => PHARM_DATA.companies.filter(c => c.tier === 'roster').map(c => ({ id: c.id, revenue: c.revenue, products: PHARM_DATA.productsForCompany(c.id).length })));
  for (const row of rows) {
    const record = records.find(c => c.id === row.id);
    expect(row.products).toBe(String(record.products));
    if (record.revenue && record.revenue.year) expect(row.revenue).toContain(String(record.revenue.year));
    if (!record.revenue || record.revenue.value == null) expect(row.revenue).toBe('—');
  }
  // Controlled conflicting revenue/market-cap values make mixing the two fail visibly.
  const ids = await page.evaluate(() => {
    const companies = PHARM_DATA.companies.filter(c => c.tier === 'roster').slice(0, 2);
    companies[0].revenue = { value: 1000000, currency: 'USD', year: 2024 }; companies[0].market_cap = { value: 99000000, currency: 'USD', year: 2025 };
    companies[1].revenue = { value: 2000000, currency: 'USD', year: 2024 }; companies[1].market_cap = { value: 1000000, currency: 'USD', year: 2025 };
    return companies.map(c => c.id);
  });
  await page.locator('#catalog-head button[data-sort="revenue"]').click();
  await expect(page.locator('[data-company="' + ids[0] + '"] td').nth(4)).toHaveText('$1M (2024)');
  await expect(page.locator('[data-company="' + ids[1] + '"] td').nth(4)).toHaveText('$2M (2024)');
  const sorted = await page.locator('#catalog-body tr[data-company]').evaluateAll(nodes => nodes.map(n => n.dataset.company));
  expect(sorted.indexOf(ids[1])).toBeLessThan(sorted.indexOf(ids[0]));
  const rosterId = await page.evaluate(() => PHARM_DATA.companies.find(c => c.tier === 'roster' && PHARM_DATA.productsForCompany(c.id).length && PHARM_DATA.sitesForCompany(c.id).length).id);
  await page.locator('[data-company="' + rosterId + '"]').click();
  await expect(page.locator('#company-modal-body')).not.toContainText('no deep profile');
  await page.locator('[data-tab="tabSites"]').click();
  await expect(page.locator('#company-modal-body')).not.toContainText('No data yet');
  await page.locator('[data-tab="tabPipeline"]').click();
  await expect(page.locator('#company-modal-body table tr')).not.toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#company-modal')).toBeHidden();
  expect(errors).toEqual([]);
});

test('failed FX retains dated cache with explicit estimate labeling', async ({ page }) => {
  const { errors } = await openAtlas(page, { failedFx: true, cachedFx: true });
  await waitCatalog(page);
  await expect(page.locator('#fx-note')).toContainText('Using cached rate estimates');
  await expect(page.locator('#fx-note')).toContainText('2026-01-01T00:00:00.000Z');
  await expect(page.locator('#fx-note')).not.toContainText('Fetching exchange rates');
  await expect(page.locator('#fx-note')).not.toContainText('Rates retrieved from provider');
  expect(errors).toEqual([]);
});
