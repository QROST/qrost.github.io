const { test, expect } = require('@playwright/test');
const { offline } = require('./offline.cjs');

async function autoPoints(page) {
  return page.locator('#china-map').evaluate(node => {
    const chart = window.echarts && window.echarts.getInstanceByDom(node);
    return (chart?.getOption().series || []).flatMap(series => series.data || []).map(point => ({
      id: point._id, kind: point._kind, output: point.value[2] ?? null,
      size: point.symbolSize, symbol: point.symbol || 'circle',
    }));
  });
}

async function shelterPoints(page) {
  return page.locator('#world-map').evaluate(node => {
    const chart = window.echarts && window.echarts.getInstanceByDom(node);
    return (chart?.getOption().series || []).flatMap(series => series.data || [])
      .filter(point => point._sid).map(point => ({ id: point._sid, count: point._n, size: point.symbolSize }));
  });
}

async function legendSamples(page) {
  return page.locator('#map-legend [data-legend-value]').evaluateAll(nodes => nodes.map(node => ({
    value: Number(node.dataset.legendValue), size: node.querySelector('.size-legend-dot').getBoundingClientRect().width,
  })));
}

async function expectLegendFits(page) {
  const dimensions = await page.locator('#map-legend').evaluate(node => ({
    scroll: node.scrollWidth, width: node.clientWidth,
    left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right,
    viewport: innerWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
  expect(dimensions.left).toBeGreaterThanOrEqual(0);
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('auto: output circles preserve magnitude across filters and explain unknowns and facilities', async ({ page }, testInfo) => {
  await offline(page);
  await page.addInitScript(() => localStorage.setItem('china-auto-lang', 'zh'));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/demos/china-auto/');
  await expect.poll(async () => (await autoPoints(page)).length).toBe(28);
  const original = await autoPoints(page);
  const byId = Object.fromEntries(original.map(point => [point.id, point]));
  expect(byId.chongqing.size).toBeGreaterThan(byId.guangzhou.size);
  expect(byId.guangzhou.size).toBeGreaterThan(byId.liuzhou.size);
  const unknown = original.filter(point => point.output === null);
  expect(unknown.length).toBeGreaterThan(0);
  for (const point of unknown) expect(point.symbol).toBe('emptyCircle');
  const legend = page.locator('#map-legend');
  await expect(legend).toContainText('2025 年产量（万辆）');
  await expect(legend).toContainText('产量未披露 / 待核实');
  await expectLegendFits(page);
  const samples = await legendSamples(page);
  const outputDomain = () => page.locator('#china-map').evaluate(node => {
    const map = window.echarts.getInstanceByDom(node).getOption().visualMap[0];
    return [map.min, map.max];
  });
  const domain = await outputDomain();

  for (const dimension of ['output', 'role', 'cluster']) {
    await page.locator('#map-reset').click();
    await page.locator(`[data-dim="${dimension}"]`).click();
    expect(await autoPoints(page)).toEqual(original);
    if (dimension !== 'output') {
      const swatches = await legend.locator('.dot').evaluateAll(nodes => nodes.map(node => ({
        width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height,
        color: getComputedStyle(node).backgroundColor,
      })));
      expect(swatches.length).toBeGreaterThan(1);
      for (const swatch of swatches) {
        expect(swatch.width).toBeGreaterThanOrEqual(8);
        expect(swatch.height).toBeGreaterThanOrEqual(8);
      }
      expect(new Set(swatches.map(swatch => swatch.color)).size).toBeGreaterThan(1);
    }
    for (const [selector, value] of [['#map-filter-role', 'headquarters'], ['#map-filter-cluster', 'greater-bay-area']]) {
      await page.locator(selector).selectOption(value);
      const filtered = await autoPoints(page);
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.length).toBeLessThan(original.length);
      expect(filtered.some(point => point.id === 'guangzhou')).toBe(true);
      for (const point of filtered) expect(point).toEqual(byId[point.id]);
      expect(await legendSamples(page)).toEqual(samples);
      if (dimension === 'output') expect(await outputDomain()).toEqual(domain);
    }
  }

  await page.locator('#map-reset').click();
  await page.locator('[data-layer="facilities"]').click();
  const facilities = await autoPoints(page);
  expect(facilities.length).toBeGreaterThan(0);
  expect(facilities.every(point => point.kind === 'facility')).toBe(true);
  expect(new Set(facilities.map(point => point.size)).size).toBe(1);
  await expect(legend).toContainText('不表示产能');
  await page.locator('#lang-toggle').click();
  await expect(legend).toContainText('location, not capacity');
  await expectLegendFits(page);
  await page.locator('[data-layer="cities"]').click();
  await expect(legend).toContainText('2025 output (10k vehicles)');
  await expect(legend).toContainText('Output undisclosed / unverified');
  await page.locator('#theme-toggle').click();
  expect(await autoPoints(page)).toEqual(original);
  expect(await legendSamples(page)).toEqual(samples);
  await expectLegendFits(page);
  await expect(page.locator('#china-map-error')).toBeHidden();
  expect(errors).toEqual([]);
  await legend.evaluate(node => node.scrollIntoView({ block: 'center' }));
  await legend.screenshot({ path: testInfo.outputPath('auto-size-legend.png') });
});

test('shelter: status changes counts on a fixed scale while catalog filters preserve map totals', async ({ page }, testInfo) => {
  await offline(page);
  await page.addInitScript(() => localStorage.setItem('shelter-cats-lang', 'en'));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/demos/shelter-cats/');
  await expect.poll(async () => (await shelterPoints(page)).length).toBeGreaterThan(0);
  await expect(page.locator('#data-warning')).toBeHidden();
  const legend = page.locator('#map-legend');
  const active = await shelterPoints(page);
  const samples = await legendSamples(page);
  await expect(legend).toContainText('Counts exclude adopted / removed records');
  await expectLegendFits(page);
  await page.locator('#f-adopted').check();
  const all = await shelterPoints(page);
  const counts = await page.evaluate(() => Object.fromEntries(window.SHELTERCATS_DATA.shelters.map(shelter => {
    const cats = window.SHELTERCATS_DATA.catsForShelter(shelter.id);
    return [shelter.id, { all: cats.length, active: cats.filter(cat => !['adopted', 'removed'].includes(cat.status)).length }];
  })));
  expect(all.length).toBe(active.length);
  expect(all.some(point => point.count > active.find(before => before.id === point.id).count)).toBe(true);
  for (const point of all) {
    const before = active.find(item => item.id === point.id);
    expect(point.count).toBe(counts[point.id].all);
    expect(before.count).toBe(counts[point.id].active);
    if (point.count > before.count) expect(point.size).toBeGreaterThan(before.size);
    else expect(point.size).toBe(before.size);
  }
  const byId = Object.fromEntries(all.map(point => [point.id, point]));
  expect(byId.austin_tx.size).toBeGreaterThan(byId.zaragoza_es.size);
  expect(byId.zaragoza_es.size).toBeGreaterThan(byId.sonoma_ca.size);
  expect(await legendSamples(page)).toEqual(samples);
  await expect(legend).toContainText('Counts include adopted / removed records');
  const beforeFilter = await page.locator('#result-count').textContent();
  await page.locator('#f-color').selectOption('black');
  await expect(page.locator('#result-count')).not.toHaveText(beforeFilter);
  expect(await shelterPoints(page)).toEqual(all);
  expect(await legendSamples(page)).toEqual(samples);

  await page.locator('#lang-toggle').click();
  await expect(legend).toContainText('猫咪记录数（只）');
  await expect(legend).toContainText('当前计数包含已领养 / 下架记录');
  await expect(page.locator('#f-color')).toHaveValue('black');
  await page.locator('#theme-toggle').click();
  expect(await shelterPoints(page)).toEqual(all);
  await expectLegendFits(page);
  await page.locator('#f-adopted').uncheck();
  expect(await shelterPoints(page)).toEqual(active);
  expect(await legendSamples(page)).toEqual(samples);
  await expect(legend).toContainText('当前计数不含已领养 / 下架记录');
  await expect(page.locator('#library-warning')).toBeHidden();
  expect(errors).toEqual([]);
  await legend.evaluate(node => node.scrollIntoView({ block: 'center' }));
  await legend.screenshot({ path: testInfo.outputPath('shelter-size-legend.png') });
});
