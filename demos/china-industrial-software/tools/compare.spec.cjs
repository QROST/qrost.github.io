const { test, expect } = require('@playwright/test');
const { offline } = require('../../../tools/browser/offline.cjs');
const fs = require('node:fs');
const echarts = fs.readFileSync(require.resolve('echarts/dist/echarts.min.js'), 'utf8');

async function prepare(page) {
  await offline(page);
  // Seed the unrelated sunburst with the locked local 5.5.1 build at normal
  // script time: ECharts needs documentElement, so addInitScript is too early.
  // Production retains its 5.5.0 CDN/SRI; comparison itself no longer uses it.
  await page.route('**/china-industrial-software/assets/js/charts.js?*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: echarts + '\n' + await response.text() });
  });
  await page.addInitScript(() => {
    localStorage.setItem('industrial-software-lang', 'zh');
    localStorage.setItem('industrial-software-theme', 'light');
  });
}

const selectedHeaders = page => page.locator('#compare-table thead th[scope="col"]').filter({ hasText: /\S/ });
const pricingCells = page => page.locator('#compare-table tr[data-field="pricing"] td');

test('CIS: source fields replace ratings while deep links, four slots and keyboard controls work', async ({ page }, testInfo) => {
  await prepare(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/demos/china-industrial-software/#product=cscec-digital');
  await expect(page.locator('#product-modal')).toBeVisible();
  await expect(page.locator('#modal-title')).toContainText('中建数字建造');
  await page.locator('#modal-compare-add').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#product-modal')).toBeHidden();
  await expect(page).not.toHaveURL(/#product=/);
  const open = page.locator('#catalog-compare-btn');
  await open.click();
  await expect(page.locator('#compare-modal-close')).toBeFocused();
  await page.locator('#compare-search').selectOption('pyrevit');
  await expect(selectedHeaders(page)).toHaveText(['中建数字建造', 'pyRevit']);
  await expect(pricingCells(page)).toHaveText(['询价', '免费']);
  await expect(page.locator('#compare-radar-chart')).toHaveCount(0);
  await expect(page.locator('#compare-modal canvas')).toHaveCount(0);
  await expect(page.locator('#compare-modal')).not.toContainText('能力雷达');
  await page.locator('#compare-search').selectOption('revit');
  await page.locator('#compare-search').selectOption('speckle');
  await page.locator('#compare-search').selectOption('archicad');
  await expect(selectedHeaders(page)).toHaveText(['中建数字建造', 'pyRevit', 'Revit', 'Speckle']);
  await expect(pricingCells(page)).toHaveText(['询价', '免费', '高价位', '免费']);
  const remove = page.getByRole('button', { name: '移除 中建数字建造', exact: true });
  await remove.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '移除 pyRevit', exact: true })).toBeFocused();
  await expect(selectedHeaders(page)).toHaveText(['pyRevit', 'Revit', 'Speckle']);
  await page.locator('#compare-clear').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#compare-table')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#compare-modal')).toBeHidden();
  await expect(open).toBeFocused();
  await page.locator('#lang-toggle').click();
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await open.click();
  await expect(pricingCells(page)).toHaveText(['Free', 'High', 'Free']);
  await expect(page.locator('[data-i18n="compareModalDesc"]')).toContainText('quotes and unknown values are unscored');
  await expect(page.getByRole('button', { name: 'Remove pyRevit', exact: true })).toBeVisible();
  const withinViewport = await page.locator('#compare-table').evaluate(el => {
    const rect = el.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth && el.scrollWidth >= el.clientWidth;
  });
  expect(withinViewport).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('cis-factual-comparison.png') });
  await page.locator('#compare-clear').click();
  await expect(page.locator('#compare-table table')).toHaveCount(0);
  await expect(page.locator('#compare-table')).toContainText('Pick from catalog');
  await expect(page.locator('#compare-slots .filled')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('CIS: missing source pricing remains unknown without an invented score', async ({ page }) => {
  await prepare(page);
  // All published records currently have pricing. This browser-only fixture
  // removes one field to verify missing-data behavior without changing research.
  await page.route('**/assets/data/categories/bim-gis.json?*', async route => {
    const response = await route.fetch();
    const payload = await response.json();
    const product = payload.products.find(p => p.id === 'cscec-digital');
    expect(product).toBeTruthy();
    delete product.pricing;
    await route.fulfill({ response, json: payload });
  });
  await page.goto('/demos/china-industrial-software/');
  await expect.poll(() => page.evaluate(() => !!window.__industrialSoftwareTest)).toBe(true);
  await page.locator('#catalog-compare-btn').click();
  await page.locator('#compare-search').selectOption('cscec-digital');
  await page.locator('#compare-search').selectOption('pyrevit');
  await expect(pricingCells(page)).toHaveText(['未知', '免费']);
  await page.keyboard.press('Escape');
  await page.locator('#lang-toggle').click();
  await page.locator('#catalog-compare-btn').click();
  await expect(pricingCells(page)).toHaveText(['Unknown', 'Free']);
  await expect(page.locator('#compare-modal canvas')).toHaveCount(0);
});
