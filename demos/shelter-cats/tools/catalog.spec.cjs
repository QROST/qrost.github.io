const { test, expect } = require('@playwright/test');
const { offline } = require('../../../tools/browser/offline.cjs');
const manifest = require('../assets/data/manifest.json');
const destination = '/demos/shelter-cats/index.html';

test.beforeEach(async ({ page }) => { await offline(page); });

test('every cached cat is reachable, language retains filters and modal colors render', async ({ page }) => {
  await page.goto(destination);
  await expect(page.locator('.cat-card')).toHaveCount(48);
  await page.locator('#f-adopted').check();
  const seen = new Set();
  while (true) {
    for (const id of await page.locator('.cat-card').evaluateAll(nodes => nodes.map(node => node.dataset.id))) {
      expect(seen.has(id)).toBe(false); seen.add(id);
    }
    if (await page.locator('#cat-next').isDisabled()) break;
    await page.locator('#cat-next').click();
  }
  expect(seen.size).toBe(manifest.total_cats);
  await page.locator('#f-color').selectOption('black');
  const before = await page.locator('#result-count').textContent();
  await page.locator('#lang-toggle').click();
  await expect(page.locator('#f-color')).toHaveValue('black');
  expect((await page.locator('#result-count').textContent()).match(/^\d+/)[0]).toBe(before.match(/^\d+/)[0]);
  await page.locator('.cat-card').first().click();
  await expect(page.locator('#cat-modal-body dd .swatch').first()).toBeVisible();
  await expect(page.locator('#cat-modal-body')).not.toContainText('<span');
  await page.keyboard.press('Escape');
  await expect(page.locator('#cat-modal')).toBeHidden();
});

test('required header failure is recoverable without reloading the page', async ({ page }) => {
  let broken = true;
  await page.route('**/assets/data/shelters.json?*', route => broken ? route.fulfill({ status: 503, body: 'offline' }) : route.fallback());
  await page.goto(destination);
  await expect(page.locator('#init-error')).toBeVisible();
  await expect(page.locator('.cat-card')).toHaveCount(0);
  broken = false;
  await page.locator('#init-retry').click();
  await expect(page.locator('#init-error')).toBeHidden();
  await expect(page.locator('#kpi-cats')).toHaveText(String(manifest.total_cats));
  await expect(page.locator('.cat-card')).toHaveCount(48);
});

test('missing shard is explicit; retry restores counts without duplicates', async ({ page }) => {
  let broken = true;
  const shard = manifest.shards[0];
  await page.route(`**/assets/data/${shard.file}?*`, route => broken ? route.fulfill({ status: 503, body: 'offline' }) : route.fallback());
  await page.goto(destination);
  await expect(page.locator('#data-warning')).toBeVisible();
  await expect(page.locator('#kpi-cats')).toHaveText(String(manifest.total_cats - shard.count));
  await expect(page.locator('#data-warning-text')).toContainText(`${manifest.total_cats - shard.count} / ${manifest.total_cats}`);
  await expect.poll(() => page.evaluate(region => {
    const chart = window.echarts.getInstanceByDom(document.getElementById('world-map'));
    return chart && chart.getOption().series[0].data.some(point => point._shelter.region === region);
  }, shard.region)).toBe(false);
  await page.locator('#f-region').selectOption(shard.region);
  await expect(page.locator('#cat-empty')).toContainText(/尚未加载|have not loaded/);
  broken = false;
  await page.locator('#data-retry').click();
  await expect(page.locator('#data-warning')).toBeHidden();
  await expect(page.locator('#f-region')).toHaveValue(shard.region);
  await expect(page.locator('#kpi-cats')).toHaveText(String(manifest.total_cats));
  const ids = await page.evaluate(() => window.SHELTERCATS_DATA.cats.map(c => c.id));
  expect(new Set(ids).size).toBe(manifest.total_cats);
});

test('a map exception leaves a usable searchable cat catalog', async ({ page }) => {
  await page.route('**/assets/js/map.js?*', async route => {
    const response = await route.fetch();
    return route.fulfill({ response, body: (await response.text()) + '\nwindow.SHELTERCATS_MAP.render = function () { throw new Error("test map failure"); };' });
  });
  await page.goto(destination);
  await expect(page.locator('#library-warning')).toBeVisible();
  await expect(page.locator('.cat-card')).toHaveCount(48);
  const name = await page.evaluate(() => window.SHELTERCATS_DATA.cats.find(c => c.status !== 'removed').name);
  await page.locator('#f-search').fill(name);
  await expect(page.locator('.cat-card').first()).toBeVisible();
  await expect(page.locator('#init-error')).toBeHidden();
});

test('missing geography is visible while the catalog remains usable', async ({ page }) => {
  await page.route('**/assets/js/world-geo.js?*', route => route.abort());
  await page.goto(destination);
  await expect(page.locator('#library-warning')).toBeVisible();
  await expect(page.locator('.cat-card')).toHaveCount(48);
  await expect(page.locator('#init-error')).toBeHidden();
});
