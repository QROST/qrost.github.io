const { test, expect } = require('@playwright/test');
const { offline } = require('../../../tools/browser/offline.cjs');

// Deterministic tiles keep this a layout test. Real Leaflet CSS/JS and the
// production integrity attributes still pass through the browser unchanged.
const tile = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#d4e4d4"/><path d="M0 0H256V256H0Z M0 128H256 M128 0V256" fill="none" stroke="#809880"/></svg>';

async function expectMapLayout(page, selector, count) {
  const map = page.locator(selector);
  await expect(map.locator('.leaflet-tile-loaded').first()).toBeVisible();
  await expect(map.locator('.leaflet-tile').first()).toHaveCSS('position', 'absolute');
  await expect(map.locator('.leaflet-overlay-pane')).toHaveCSS('position', 'absolute');
  await expect(map.locator('path.leaflet-interactive')).toHaveCount(count);
  await expect.poll(() => map.evaluate(node => {
    const bounds = node.getBoundingClientRect();
    return [...node.querySelectorAll('path.leaflet-interactive')].every(path => {
      const box = path.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.left >= bounds.left &&
        box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom;
    });
  })).toBe(true);
  const tiles = await map.locator('.leaflet-tile-loaded').evaluateAll(nodes => nodes.map(node => ({
    naturalWidth: node.naturalWidth, width: node.getBoundingClientRect().width,
    height: node.getBoundingClientRect().height,
  })));
  expect(tiles.length).toBeGreaterThan(1);
  for (const image of tiles) {
    expect(image.naturalWidth).toBe(256);
    expect(image.width).toBe(256);
    expect(image.height).toBe(256);
  }
}

test('housing detail maps: rapid close and reopen cannot initialize the previous listing', async ({ page }, testInfo) => {
  await offline(page);
  await page.route(/^https:\/\/(server\.arcgisonline\.com|[abc]\.tile\.openstreetmap\.org)\//, route =>
    route.fulfill({ contentType: 'image/svg+xml', body: tile }));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/demos/china-housing/');
  await expect(page.locator('#table-body [data-open="2"]')).toBeAttached();
  // One event-loop turn reproduces clicks that outrun deferred map startup.
  await page.evaluate(() => {
    document.querySelector('#table-body [data-open="1"]').click();
    document.querySelector('[data-lm-tab="near"]').click();
    document.querySelector('#lm-close').click();
    document.querySelector('#table-body [data-open="2"]').click();
    document.querySelector('[data-lm-tab="near"]').click();
  });
  await expect(page.locator('#lm-title')).toContainText('双鸭山');
  await expect(page.locator('#lm-near-list')).toContainText('黑龙江龙煤矿业集团四方台矿医院');
  await expectMapLayout(page, '#lm-near-map', 11);
  expect(errors).toEqual([]);
  if (testInfo.project.name === 'touch') {
    const gate = page.locator('[data-touch-for="lm-near-map"]');
    await gate.click();
    await expect(gate).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#lm-close').click();
    await page.evaluate(() => {
      document.querySelector('#table-body [data-open="1"]').click();
      document.querySelector('[data-lm-tab="near"]').click();
    });
    await expect(page.locator('#lm-near-list')).toContainText('鹤岗市人民医院');
    await expect(gate).toHaveAttribute('aria-pressed', 'false');
  }
  await page.locator('#lm-close').click();
  await expect(page.locator('#listing-modal .leaflet-map-pane')).toHaveCount(0);
});

test('housing detail maps: imported offer and POI text remains literal, with web-only source links', async ({ page }) => {
  await offline(page);
  const literal = 'A & B <b>东院</b> "转角"';
  const updated = '2026-09 <em>待核验</em>';
  const validURL = 'https://example.com/offer?q=A&B=%22corner%22';
  await page.goto('/demos/china-housing/');
  await expect(page.locator('#table-body [data-open="1"]')).toBeAttached();
  await page.evaluate(({ literal, updated, validURL }) => {
    window.HOUSING_OFFERS['1'] = [validURL, 'javascript:void(0)', 'data:text/html,test'].map(sourceUrl => ({
      area: 60, priceWan: 2, unitPrice: 333, layout: literal, updated, sourceUrl,
    }));
    window.HOUSING_ENRICHED['1'].pois.hospital.name = literal;
    document.querySelector('#table-body [data-open="1"]').click();
  }, { literal, updated, validURL });
  await page.locator('#lm-offers summary').click();
  await expect(page.locator('#lm-offers tbody tr')).toHaveCount(3);
  await expect(page.locator('#lm-offers tbody tr').first()).toContainText(literal);
  await expect(page.locator('#lm-offers tbody tr').first()).toContainText(updated);
  await expect(page.locator('#lm-offers tbody b, #lm-offers tbody em')).toHaveCount(0);
  await expect(page.locator('#lm-offers a')).toHaveCount(1);
  await expect(page.locator('#lm-offers a')).toHaveAttribute('href', validURL);
  await page.locator('[data-lm-tab="near"]').click();
  await expect(page.locator('#lm-near-list')).toContainText(literal);
  await page.locator('#lm-near-map path[fill="#dc2626"]').dispatchEvent('click');
  await expect(page.locator('#lm-near-map .leaflet-popup-content')).toContainText(literal);
  await expect(page.locator('#lm-near-map .leaflet-popup-content b')).toHaveCount(0);
});

for (const listing of [
  { id: 1, lang: 'zh', dark: false, hospital: '鹤岗市人民医院' },
  { id: 50, lang: 'en', dark: true, hospital: '肥城市人民医院' },
]) {
  test(`housing detail maps: listing ${listing.id}, ${listing.lang}, ${listing.dark ? 'dark' : 'light'}`, async ({ page }, testInfo) => {
    await offline(page);
    await page.route(/^https:\/\/(server\.arcgisonline\.com|[abc]\.tile\.openstreetmap\.org)\//, route =>
      route.fulfill({ contentType: 'image/svg+xml', body: tile }));
    await page.addInitScript(({ lang, dark }) => {
      localStorage.setItem('housing-lang', lang);
      localStorage.setItem('housing-theme', dark ? 'dark' : 'light');
    }, listing);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (/integrity|digest/i.test(message.text())) errors.push(message.text());
    });
    await page.goto(`/demos/china-housing/#l=${listing.id}`);
    await expect(page.locator('#listing-modal')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', listing.lang === 'zh' ? 'zh-CN' : 'en');
    expect(await page.locator('html').evaluate(node => node.classList.contains('dark'))).toBe(listing.dark);
    await expectMapLayout(page, '#lm-sat-map', 1);
    // A correctly positioned overlay puts the community at the satellite centre.
    const offset = await page.locator('#lm-sat-map').evaluate(node => {
      const map = node.getBoundingClientRect();
      const pin = node.querySelector('path.leaflet-interactive').getBoundingClientRect();
      return [Math.abs(pin.x + pin.width / 2 - map.x - map.width / 2),
        Math.abs(pin.y + pin.height / 2 - map.y - map.height / 2)];
    });
    for (const distance of offset) expect(distance).toBeLessThanOrEqual(2);
    await page.screenshot({ path: testInfo.outputPath('satellite.png') });
    await page.locator('[data-lm-tab="near"]').click();
    // These two baked records each have ten located POIs plus the community.
    // Distance-only coast records and unlocated shops must not acquire pins.
    await expectMapLayout(page, '#lm-near-map', 11);
    await expect(page.locator('#lm-near-list')).toContainText(listing.hospital);
    await page.screenshot({ path: testInfo.outputPath('nearby.png') });
    await page.locator('[data-lm-tab="sat"]').click();
    await expectMapLayout(page, '#lm-sat-map', 1);
    await page.locator('#lm-close').click();
    await expect(page.locator('#listing-modal')).toBeHidden();
    expect(errors).toEqual([]);
  });
}
