const { test, expect } = require('@playwright/test');

// External requests are always intercepted. FX fixtures test the calculator's
// conversion behavior, not provider availability or current exchange rates.
async function openDashboard(page, { charts = 'absent', rate = 8, delayedFx = false } = {}) {
  const pageErrors = [];
  const fxRequests = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  let releaseFx;
  const fxGate = delayedFx ? new Promise((resolve) => { releaseFx = resolve; }) : Promise.resolve();
  await page.route('https://**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('api.exchangerate.host') || url.includes('open.er-api.com')) {
      fxRequests.push(url);
      await fxGate;
      if (rate === null) return route.fulfill({ status: 503, body: '{}' });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ rates: { CNY: rate } }) });
    }
    return route.abort();
  });
  if (charts !== 'absent') {
    await page.addInitScript((mode) => {
      window.__chartMocks = [];
      window.Chart = class {
        static defaults = { font: {} };
        constructor(context, config) {
          if (mode === 'constructor-failure') throw new Error('chart constructor fixture failure');
          this.data = config.data;
          this.options = config.options;
          window.__chartMocks.push(this);
        }
        update() {
          if (window.__throwChartUpdates) throw new Error('chart update fixture failure');
        }
        destroy() {}
      };
    }, charts);
  }
  await page.goto('/demos/wfoe-china/');
  await expect(page.locator('#micro-detail-list')).toContainText('Total Annual Cost');
  await expect(page.locator('#wfoe-steps-mount [data-wfoe-money="s05"]')).not.toBeEmpty();
  return { pageErrors, fxRequests, releaseFx };
}

async function expectTotal(page, city, formatted, cityLabel = city) {
  await expect(page.locator('#micro-detail-list > div').last()).toContainText(formatted);
  await expect(page.locator('#macro-data-fallback tbody tr').filter({ has: page.getByRole('rowheader', { name: cityLabel, exact: true }) })).toContainText(formatted);
}

test('Chart CDN failure preserves numbers, inputs, language, and a later FX update', async ({ page }) => {
  const { pageErrors, fxRequests, releaseFx } = await openDashboard(page, { delayedFx: true });
  await expect(page.locator('[data-chart-unavailable]')).toHaveCount(2);
  await expect(page.locator('#macro-data-fallback tbody tr')).toHaveCount(24);
  await expect(page.locator('#fx-status-chip')).toHaveText('Checking FX…');
  await expectTotal(page, 'Shanghai', '$21,797');

  await page.locator('#headcount-input').fill('3');
  await expectTotal(page, 'Shanghai', '$65,392');
  releaseFx();
  await expect(page.locator('#fx-status-chip')).toHaveText('Live rate');
  await expectTotal(page, 'Shanghai', '$58,853');
  await expect(page.locator('[data-wfoe-money="s05"]')).toContainText('8.00');
  expect(fxRequests).toHaveLength(1);

  await page.locator('#btn-rmb').click();
  await expectTotal(page, 'Shanghai', '¥470,820');
  await page.locator('#btn-senior').click();
  await expectTotal(page, 'Shanghai', '¥1,029,420');
  await page.locator('#city-nav-select').selectOption('beijing');
  await expectTotal(page, 'Beijing', '¥1,077,300');
  await page.locator('#btn-overhead-include').click();
  await expectTotal(page, 'Beijing', '¥1,321,320');

  await page.locator('#lang-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('[data-chart-unavailable]').first()).toContainText('图表暂不可用');
  await expect(page.locator('#micro-title-city')).toHaveText('北京');
  await expect(page.locator('#micro-desc-text')).toContainText('并非已核实的现行地方费率');
  await expect(page.locator('#micro-detail-list')).toContainText('模型剩余项');
  await expectTotal(page, 'beijing', '¥1,321,320', '北京');

  await page.locator('#btn-international-show').click();
  await expect(page.locator('#macro-data-fallback tbody tr')).toHaveCount(33);
  await page.locator('#city-nav-select').selectOption('losangeles');
  await expect(page.locator('#international-alert')).toBeVisible();
  await expectTotal(page, 'losangeles', '¥3,155,520', '洛杉矶');
  await page.locator('#btn-international-hide').click();
  await expect(page.locator('#city-nav-select')).toHaveValue('shanghai');
  await expect(page.locator('#macro-data-fallback tbody tr')).toHaveCount(24);

  await page.locator('#lang-toggle').click();
  await expect(page.locator('[data-chart-unavailable]').first()).toContainText('Charts unavailable');
  await expect(page.locator('#micro-desc-text')).toContainText('not verified current local rates');
  await expectTotal(page, 'Shanghai', '$156,578');
  await page.locator('#theme-toggle').click();
  expect(pageErrors).toEqual([]);
});

test('Chart constructor failure and offline FX preserve fallback totals and fee rendering', async ({ page }) => {
  const { pageErrors, fxRequests } = await openDashboard(page, { charts: 'constructor-failure', rate: null });
  await expect(page.locator('#fx-status-chip')).toHaveText('Offline · fallback 7.2');
  await expectTotal(page, 'Shanghai', '$21,797');
  expect(fxRequests).toHaveLength(2);
  await page.locator('#city-nav-select').selectOption('hongkong');
  await expect(page.locator('#sar-alert')).toBeVisible();
  // Junior pay is below this existing model's MPF ceiling; senior pay hits it.
  await expectTotal(page, 'Hong Kong', '$31,500');
  await page.locator('#btn-senior').click();
  await expectTotal(page, 'Hong Kong', '$62,325');
  await page.locator('#btn-junior').click();
  await page.locator('#city-nav-select').selectOption('macau');
  await expectTotal(page, 'Macau', '$25,089');
  await expect(page.locator('[data-domestic-fee="d01"]')).not.toBeEmpty();
  await expect(page.locator('[data-jv-money="jv01"]')).not.toBeEmpty();
  expect(pageErrors).toEqual([]);
});

test('Chart updates match itemized totals; a later rendering failure switches to the numeric table', async ({ page }) => {
  const { pageErrors } = await openDashboard(page, { charts: 'mock', rate: 7.2 });
  await expect(page.locator('#fx-status-chip')).toHaveText('Live rate');
  await expect(page.locator('#macro-data-fallback')).toBeHidden();
  await expect(page.locator('[data-chart-unavailable]')).toHaveCount(0);
  await page.locator('#btn-overhead-include').click();
  await page.locator('#headcount-input').fill('7');
  // Independent view agreement across every currently offered city catches
  // rounding drift between stacked bars, donut slices and numeric totals.
  const cities = await page.locator('#city-nav-select option').evaluateAll((options) => options.map((option) => option.value));
  for (const city of cities) {
    await page.locator('#city-nav-select').selectOption(city);
    const values = await page.evaluate(() => {
      const [bar, donut] = window.__chartMocks;
      const cityName = document.getElementById('micro-title-city').textContent;
      const i = bar.data.labels.indexOf(cityName);
      return {
        bar: bar.data.datasets.reduce((sum, dataset) => sum + dataset.data[i], 0),
        donut: donut.data.datasets[0].data.reduce((sum, amount) => sum + amount, 0),
        detail: document.querySelector('#micro-detail-list > div:last-child').textContent.replace(/\D/g, ''),
      };
    });
    expect(values.donut, city).toBe(values.bar);
    expect(Number(values.detail), city).toBe(values.bar);
  }
  const sevenOrder = await page.evaluate(() => window.__chartMocks[0].data.labels.slice());
  await page.locator('#headcount-input').fill('1');
  expect(await page.evaluate(() => window.__chartMocks[0].data.labels)).toEqual(sevenOrder);

  await page.evaluate(() => { window.__throwChartUpdates = true; });
  await page.locator('#btn-rmb').click();
  await expect(page.locator('[data-chart-unavailable]')).toHaveCount(2);
  await expect(page.locator('#macro-data-fallback tbody tr')).toHaveCount(24);
  await page.locator('#city-nav-select').selectOption('shanghai');
  await expectTotal(page, 'Shanghai', '¥231,340');
  await page.locator('#lang-toggle').click();
  await expect(page.locator('[data-chart-unavailable]').first()).toContainText('图表暂不可用');
  expect(pageErrors).toEqual([]);
});
