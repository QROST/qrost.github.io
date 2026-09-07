const { test, expect } = require('@playwright/test');
const { offline } = require('../../../tools/browser/offline.cjs');

async function points(page) {
  return page.locator('#world-map').evaluate(node => {
    const chart = window.echarts && window.echarts.getInstanceByDom(node);
    return (chart?.getOption().series?.[0]?.data || []).map(point => ({
      id: point._site.id,
      region: point._co.region,
      color: point.itemStyle.color,
      size: point.symbolSize,
    }));
  });
}

for (const dimension of ['company_type', 'therapeutic_area', 'country']) {
  test(`pharma map: ${dimension} colors survive filtering and marker size represents sites`, async ({ page }, testInfo) => {
    await offline(page);
    await page.addInitScript(() => localStorage.setItem('pharm-companies-lang', 'en'));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/demos/pharm-companies/');
    await page.locator('#map').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.PHARM_DATA?.productsLoaded);
    await page.locator(`[data-dim="${dimension}"]`).click();
    await expect.poll(async () => (await points(page)).length).toBeGreaterThan(100);
    const all = await points(page);
    // Headquarters, labs and commercial sites are separate sites, not a magnitude scale.
    expect(new Set(all.map(point => point.size)).size).toBe(1);
    await expect(page.locator('#map-legend')).toContainText('one site each, not company scale');

    for (const region of ['latam', 'japan', 'greater_china']) {
      const expected = all.filter(point => point.region === region);
      expect(expected.length).toBeGreaterThan(0);
      expect(expected.length).toBeLessThan(all.length);
      await page.locator('#map-filter-region').selectOption(region);
      await expect.poll(async () => (await points(page)).length).toBe(expected.length);
      expect(await points(page)).toEqual(expected);
    }

    const filtered = await points(page);
    await page.locator('#lang-toggle').click();
    await expect(page.locator('#map-legend')).toContainText('大小不表示企业规模');
    expect(await points(page)).toEqual(filtered);

    await page.locator('#theme-toggle').click();
    const themed = await points(page);
    await page.locator('#map-reset').click();
    await expect.poll(async () => (await points(page)).length).toBe(all.length);
    expect((await points(page)).filter(point => point.region === 'greater_china')).toEqual(themed);
    await expect(page.locator('#map-render-error')).toBeHidden();
    expect(errors).toEqual([]);
    if (dimension === 'company_type') {
      await page.locator('#map-legend').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('map-semantics.png') });
    }
  });
}
