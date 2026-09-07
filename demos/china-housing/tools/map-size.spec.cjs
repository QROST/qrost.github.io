const { test, expect } = require('@playwright/test');
const { offline } = require('../../../tools/browser/offline.cjs');

async function points(page) {
  return page.locator('#china-map').evaluate(node => {
    const chart = window.echarts && window.echarts.getInstanceByDom(node);
    return (chart?.getOption().series?.[0]?.data || []).map(point => ({
      id: point.d.id, price: point.d.priceYuan, size: point.size,
    }));
  });
}

function expectPriceOrder(data) {
  const priced = data.filter(point => Number.isFinite(point.price) && point.price > 0)
    .sort((a, b) => a.price - b.price);
  expect(priced.length).toBeGreaterThan(20);
  expect(priced.at(-1).size).toBeGreaterThan(priced[0].size);
  for (let i = 1; i < priced.length; i++) {
    if (priced[i].price > priced[i - 1].price) expect(priced[i].size).toBeGreaterThan(priced[i - 1].size);
    else expect(priced[i].size).toBe(priced[i - 1].size);
  }
  return priced;
}

test('housing: higher total prices make larger dots, with a stable colour-independent size legend', async ({ page }, testInfo) => {
  await offline(page);
  await page.goto('/demos/china-housing/');
  await expect.poll(async () => (await points(page)).length).toBeGreaterThan(20);
  await page.evaluate(() => window.__setLang('zh'));
  const original = expectPriceOrder(await points(page));
  await expect(page.locator('#sec-geo-p')).toContainText('总价越高，圆点越大');
  const legend = page.locator('#map-size-legend');
  await expect(legend).toContainText('总价（人民币）');
  const reference = Object.fromEntries(original.map(point => [point.id, point.size]));
  for (const dimension of ['janTemp', 'priceWan', 'unitPrice']) {
    await page.locator(`[data-dim="${dimension}"]`).click();
    for (const point of await points(page)) expect(point.size).toBe(reference[point.id]);
  }
  for (const includeReference of [true, false]) {
    await page.locator('#tier1-toggle').setChecked(includeReference);
    const ordered = expectPriceOrder(await points(page));
    const samples = await legend.locator('.map-size-sample').evaluateAll(nodes => nodes.map(node => ({
      price: Number(node.dataset.priceYuan),
      size: node.querySelector('i').getBoundingClientRect().width,
    })));
    expect(samples[0].price).toBe(ordered[0].price);
    expect(samples.at(-1).price).toBe(ordered.at(-1).price);
    expect(samples[0].size).toBeCloseTo(ordered[0].size, 1);
    expect(samples.at(-1).size).toBeCloseTo(ordered.at(-1).size, 1);
  }
  await page.locator('#lang-toggle').click();
  await expect(legend).toContainText('total price (USD)');
  await expect(page.locator('#sec-geo-p')).toContainText('higher total price = larger dot');
  await page.locator('#theme-toggle').click();
  for (const point of await points(page)) expect(point.size).toBe(reference[point.id]);
  expect(await legend.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await legend.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('price-size-legend.png') });
});
