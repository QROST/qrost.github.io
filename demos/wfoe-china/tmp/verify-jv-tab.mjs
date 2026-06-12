/**
 * One-shot JV tab smoke test — run: node tmp/verify-jv-tab.mjs
 * Requires: python3 -m http.server 8765 in demo root (or set BASE_URL).
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8765/';

async function main() {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];

    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    await page.goto(BASE, { waitUntil: 'networkidle' });

    const tabs = await page.$$eval('.step-item', (els) =>
        els.map((el) => ({
            target: el.getAttribute('data-target'),
            text: el.textContent.trim().slice(0, 40)
        }))
    );
    console.log('Tabs:', JSON.stringify(tabs, null, 2));
    if (tabs[2]?.target !== 'step-jv') {
        throw new Error('Expected 3rd tab data-target=step-jv, got ' + JSON.stringify(tabs[2]));
    }

    await page.click('[data-target="step-jv"]');
    await page.waitForSelector('#jv-steps-mount [data-step-flow]', { timeout: 10000 });

    const rowCount = await page.locator('#jv-steps-mount .step-flow-row').count();
    console.log('JV step rows:', rowCount);
    if (rowCount !== 12) throw new Error('Expected 12 JV steps, got ' + rowCount);

    const moreCount = await page.locator('#jv-steps-mount details.wfoe-details').count();
    console.log('More/details blocks:', moreCount);
    if (moreCount < 12) throw new Error('Expected details on all steps');

    await page.locator('#jv-steps-mount summary.step-flow-more').first().click();
    await page.waitForTimeout(100);
    const open = await page.locator('#jv-steps-mount details.wfoe-details[open]').count();
    console.log('Open details after click:', open);
    if (open < 1) throw new Error('More toggle did not open');

    const moneyEn = await page.locator('[data-jv-money="jv01"]').first().innerText();
    console.log('jv01 money (EN):', moneyEn.slice(0, 80));
    if (!moneyEn.includes('¥') && !moneyEn.includes('Est')) {
        throw new Error('jv01 money cell empty or unexpected: ' + moneyEn);
    }
    if (!moneyEn.includes('$')) {
        throw new Error('EN mode should show USD in jv01 money');
    }

    await page.click('#lang-toggle');
    await page.waitForTimeout(300);
    const moneyZh = await page.locator('[data-jv-money="jv01"]').first().innerText();
    console.log('jv01 money (ZH):', moneyZh.slice(0, 80));
    if (moneyZh.includes('$')) {
        throw new Error('ZH mode should be RMB-only on jv01 money');
    }
    if (!moneyZh.includes('¥')) {
        throw new Error('ZH mode should show RMB on jv01 money');
    }

    const titleZh = await page.locator('#jv-jv01 .step-flow-title').innerText();
    console.log('jv01 title (ZH):', titleZh.slice(0, 60));
    if (!titleZh.includes('伙伴')) {
        throw new Error('ZH title not applied on jv01');
    }

    if (errors.length) {
        console.error('Page errors:', errors);
        throw new Error('Console/page errors during test');
    }

    console.log('\nPASS — JV tab integration verified');
    await browser.close();
}

main().catch((e) => {
    console.error('FAIL:', e.message);
    process.exit(1);
});
