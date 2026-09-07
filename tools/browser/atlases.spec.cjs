const { test, expect } = require('@playwright/test');
const { offline } = require('./offline.cjs');

const atlases = [
  ['china-auto', '#china-map', '#catalog-body tr', '#china-map-error'],
  ['pharm-companies', '#world-map', '#catalog-body tr', '#init-error'],
  ['shelter-cats', '#world-map', '.cat-card', '#init-error'],
  ['architecture-history', '#world-map', null, '#map-fallback'],
  ['china-housing', '#china-map', null, '#map-fallback'],
];

for (const [demo, surface, rows, fallback] of atlases) {
  test(`${demo}: cold map, bilingual theme switching and touch gate`, async ({ page }, testInfo) => {
    await offline(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/demos/${demo}/index.html`);
    await expect.poll(() => page.locator(surface).evaluate(node => {
      const chart = window.echarts && window.echarts.getInstanceByDom(node);
      return chart && chart.getOption().geo?.[0]?.map;
    })).toBeTruthy();
    await expect(page.locator(fallback)).toBeHidden();
    if (rows) await expect(page.locator(rows).first()).toBeVisible();

    const touch = testInfo.project.name === 'touch';
    const map = page.locator(surface);
    if (touch) {
      await expect(map).toHaveCSS('touch-action', 'pan-y');
      const toggle = page.locator(`[data-touch-for="${surface.slice(1)}"]`);
      await toggle.scrollIntoViewIfNeeded();
      // Scroll auto-relocks; activate only once the page has settled.
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await toggle.click();
      await expect(map).toHaveCSS('touch-action', 'none');
      await expect.poll(() => map.evaluate(node => window.echarts.getInstanceByDom(node).getOption().geo[0].roam)).toBe(true);
      await page.evaluate(() => window.scrollBy(0, 80));
      await expect(map).toHaveCSS('touch-action', 'pan-y');
      await page.setViewportSize({ width: 900, height: 1000 });
      await expect(map).toHaveCSS('touch-action', 'pan-y');
      await expect.poll(() => map.evaluate(node => window.echarts.getInstanceByDom(node).getOption().geo[0].roam)).toBe(false);
    }
    const initialLang = await page.locator('html').getAttribute('lang');
    const initialDark = await page.locator('html').evaluate(node => node.classList.contains('dark'));
    await page.locator('#lang-toggle').click();
    await expect.poll(() => page.locator('html').getAttribute('lang')).not.toBe(initialLang);
    await page.locator('#theme-toggle').click();
    await expect.poll(() => page.locator('html').evaluate(node => node.classList.contains('dark'))).toBe(!initialDark);
    await expect(page.locator(fallback)).toBeHidden();
    if (rows) await expect(page.locator(rows).first()).toBeVisible();
    if (demo === 'china-housing') {
      const zoom = () => map.evaluate(node => window.echarts.getInstanceByDom(node).getOption().geo[0].zoom);
      const before = await zoom();
      await page.locator('#map-zoom-in').click();
      await expect.poll(zoom).toBeGreaterThan(before);
      await page.locator('#map-zoom-out').click();
      await expect.poll(zoom).toBeCloseTo(before);
      await page.locator('#map-zoom-reset').click();
      await expect.poll(zoom).toBe(1);
    }
    expect(errors).toEqual([]);
    await map.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('map.png') });
  });
}

test('china-auto: failed chart rendering preserves city and organization catalogs', async ({ page }) => {
  await offline(page);
  await page.route('**/assets/js/map.js?*', async route => {
    const response = await route.fetch();
    return route.fulfill({ response, body: (await response.text()) + '\nwindow.CHINA_AUTO_MAP.render = function () { throw new Error("test map failure"); };' });
  });
  await page.goto('/demos/china-auto/index.html');
  await expect(page.locator('#catalog-body tr')).toHaveCount(28);
  await expect(page.locator('#china-map-error')).toBeVisible();
  await expect(page.locator('#orgs-body tr').first()).toBeVisible();
});

test('wfoe-china: real charts, responsive theme and calculator updates', async ({ page }, testInfo) => {
  await offline(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/demos/wfoe-china/');
  await expect.poll(() => page.evaluate(() => window.Chart && Object.keys(window.Chart.instances).length)).toBe(2);
  await expect(page.locator('#macro-data-fallback')).toBeHidden();
  await page.locator('#headcount-input').fill('3');
  await page.locator('#btn-rmb').click();
  await expect(page.locator('#micro-detail-list > div').last()).toContainText('¥470,820');
  await page.locator('#lang-toggle').click();
  await page.locator('#theme-toggle').click();
  await expect(page.locator('#macro-data-fallback')).toBeHidden();
  await page.locator('#micro-title-city').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('calculator.png') });
  expect(errors).toEqual([]);
});
