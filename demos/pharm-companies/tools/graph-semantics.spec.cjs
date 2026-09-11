const { test, expect } = require('@playwright/test');
const { offline } = require('../../../tools/browser/offline.cjs');
const { companies } = require('../assets/data/companies.json');
const { groups } = require('../assets/data/groups.json');
const { deals } = require('../assets/data/deals.json');
const companyIds = new Set(companies.map(company => company.id));

async function groupSnapshot(page) {
  return page.locator('#groups-graph').evaluate(node => {
    const option = window.echarts?.getInstanceByDom(node)?.getOption();
    const series = option?.series?.[0];
    return {
      legend: option?.legend?.[0]?.data || [],
      nodes: (series?.data || []).map(point => ({
        id: point._cid, size: point.symbolSize,
        color: series.categories[point.category].itemStyle.color,
      })),
    };
  });
}

async function dealSnapshot(page) {
  return page.locator('#deals-graph').evaluate(node => {
    const option = window.echarts?.getInstanceByDom(node)?.getOption();
    const series = option?.series?.[0];
    return {
      nodes: (series?.data || []).map(point => ({ id: point._cid, count: point.value, size: point.symbolSize })),
      links: (series?.links || []).map(link => ({
        id: link._deal.id, type: link._deal.deal_type, style: link.lineStyle,
        amount: link._deal.total_usd_m ?? null,
        tooltip: option.tooltip[0].formatter({ dataType: 'edge', data: link }),
      })),
    };
  });
}

async function legendFits(page, selector) {
  const box = await page.locator(selector).evaluate(node => ({
    width: node.clientWidth, scroll: node.scrollWidth,
    left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right, viewport: innerWidth,
  }));
  expect(box.scroll).toBeLessThanOrEqual(box.width + 1);
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(box.viewport + 1);
}

function expectedDeals(type) {
  const matched = deals.filter(deal => !type || deal.deal_type === type);
  const shown = matched.filter(deal => new Set(deal.parties.filter(party => companyIds.has(party.company_id)).map(party => party.company_id)).size >= 2);
  const ids = new Set(shown.flatMap(deal => deal.parties.filter(party => companyIds.has(party.company_id)).map(party => party.company_id)));
  return { matched, shown, ids };
}

async function openGraphs(page) {
  await offline(page);
  await page.addInitScript(() => localStorage.setItem('pharm-companies-lang', 'en'));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/demos/pharm-companies/');
  return errors;
}

test('pharma groups: every filtered group retains its colors, complete legend and role sizes', async ({ page }, testInfo) => {
  const errors = await openGraphs(page);
  await expect.poll(async () => (await groupSnapshot(page)).nodes.length).toBeGreaterThan(20);
  const baseline = await groupSnapshot(page);
  const byId = Object.fromEntries(baseline.nodes.map(point => [point.id, point]));
  const presentGroups = groups.filter(group => companies.some(company => company.group_id === group.id));
  expect(baseline.legend.length).toBe(presentGroups.length);
  expect(new Set(baseline.nodes.map(point => point.color)).size).toBe(presentGroups.length);
  const roleLegend = page.locator('#groups-role-legend');
  await expect(roleLegend).toContainText('organizational role');
  await expect(roleLegend).toContainText('does not encode revenue, market value or employee count');
  const roles = await roleLegend.locator('[data-group-role]').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [
    node.dataset.groupRole, node.querySelector('.graph-role-dot').getBoundingClientRect().width,
  ])));
  for (const point of baseline.nodes) {
    const role = companies.find(company => company.id === point.id).group_role;
    expect(point.size).toBe(roles[role] || roles.other);
  }
  for (const group of presentGroups) {
    await page.locator('#groups-filter').selectOption(group.id);
    const selected = await groupSnapshot(page);
    expect(selected.legend).toEqual(baseline.legend);
    expect(selected.nodes.length).toBe(companies.filter(company => company.group_id === group.id).length);
    for (const point of selected.nodes) expect(point).toEqual(byId[point.id]);
  }
  await page.locator('#groups-filter').selectOption('');
  await legendFits(page, '#groups-role-legend');
  await page.locator('#lang-toggle').click();
  await expect(roleLegend).toContainText('组织角色');
  await expect(roleLegend).toContainText('不表示营收、市值或员工数');
  await page.locator('#theme-toggle').click();
  expect((await groupSnapshot(page)).nodes).toEqual(baseline.nodes);
  await legendFits(page, '#groups-role-legend');
  await expect(page.locator('#groups-render-error')).toBeHidden();
  expect(errors).toEqual([]);
  await roleLegend.evaluate(node => node.scrollIntoView({ block: 'center' }));
  await roleLegend.screenshot({ path: testInfo.outputPath('group-role-legend.png') });
});

test('pharma deals: summaries separate catalog, filtered and drawn events; line and amount legends agree', async ({ page }, testInfo) => {
  const errors = await openGraphs(page);
  await expect.poll(async () => (await dealSnapshot(page)).nodes.length).toBeGreaterThan(0);
  const legend = page.locator('#deals-legend');
  for (const type of ['', ...new Set(deals.map(deal => deal.deal_type))]) {
    await page.locator('#deals-filter').selectOption(type);
    const expected = expectedDeals(type);
    await expect(page.locator('#deals-count')).toHaveText(`Catalog: ${deals.length} deals · Filtered: ${expected.matched.length} · In graph: ${expected.shown.length} deals / ${expected.ids.size} companies`);
    const actual = await dealSnapshot(page);
    expect(new Set(actual.links.map(link => link.id))).toEqual(new Set(expected.shown.map(deal => deal.id)));
    expect(new Set(actual.nodes.map(point => point.id))).toEqual(expected.ids);
    for (const point of actual.nodes) {
      expect(point.count).toBe(expected.shown.filter(deal => deal.parties.some(party => party.company_id === point.id)).length);
    }
    for (const link of actual.links) {
      const sample = legend.locator(`[data-deal-type="${link.type}"] .deal-line-sample`);
      expect(await sample.evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(20);
      await expect(sample).toHaveCSS('border-top-style', link.style.type);
      expect(await sample.evaluate(node => parseFloat(node.style.borderTopWidth))).toBe(link.style.width);
      const colors = await sample.evaluate((node, color) => {
        const reference = document.createElement('span'); reference.style.color = color;
        node.appendChild(reference);
        const result = [getComputedStyle(node).borderTopColor, getComputedStyle(reference).color];
        reference.remove(); return result;
      }, link.style.color);
      expect(colors[0]).toBe(colors[1]);
      if (link.amount != null) expect(link.tooltip).toContain('Total (incl. milestones)');
    }
  }
  await expect(page.locator('#deals-note')).toContainText('Records outside the graph remain');
  await expect(legend).toContainText('Neither encodes the amount');
  await legendFits(page, '#deals-legend');
  await page.locator('#deals-filter').selectOption('m_and_a');
  const before = await dealSnapshot(page);
  const expected = expectedDeals('m_and_a');
  await page.locator('#lang-toggle').click();
  await expect(page.locator('#deals-count')).toHaveText(`全库收录 ${deals.length} 笔 · 当前筛选 ${expected.matched.length} 笔 · 当前入图 ${expected.shown.length} 笔 / ${expected.ids.size} 家企业`);
  await expect(legend).toContainText('均不表示金额');
  await page.locator('#theme-toggle').click();
  const after = await dealSnapshot(page);
  expect(after.nodes).toEqual(before.nodes);
  expect(after.links.map(link => [link.id, link.style])).toEqual(before.links.map(link => [link.id, link.style]));
  for (const link of after.links) if (link.amount != null) expect(link.tooltip).toContain('潜在总额');
  await legendFits(page, '#deals-legend');
  await expect(page.locator('#deals-render-error')).toBeHidden();
  expect(errors).toEqual([]);
  await legend.evaluate(node => node.scrollIntoView({ block: 'center' }));
  await legend.screenshot({ path: testInfo.outputPath('deal-line-legend.png') });
});

test('pharma deals: synthetic multi-party events and empty drawing states retain truthful counts', async ({ page }) => {
  const errors = await openGraphs(page);
  await expect.poll(async () => (await dealSnapshot(page)).nodes.length).toBeGreaterThan(0);
  const ids = companies.slice(0, 3).map(company => company.id);
  // Fixtures live only in this isolated browser page; research files remain untouched.
  await page.evaluate(ids => {
    const records = [
      { id: 'test-triple', deal_type: 'collaboration', parties: [ids[0], ids[1], ids[2], ids[0]].map(company_id => ({ company_id })) },
      { id: 'test-double', deal_type: 'license_out', parties: [ids[0], ids[1]].map(company_id => ({ company_id })) },
      { id: 'test-unresolved', deal_type: 'equity_stake', parties: [{ company_id: ids[0] }, { company_id: null }] },
    ];
    window.PHARM_DATA.deals.splice(0, window.PHARM_DATA.deals.length, ...records);
  }, ids);
  await page.locator('#theme-toggle').click();
  await expect(page.locator('#deals-count')).toHaveText('Catalog: 3 deals · Filtered: 3 · In graph: 2 deals / 3 companies');
  let graph = await dealSnapshot(page);
  expect(graph.links.length).toBe(4);
  expect(Object.fromEntries(graph.nodes.map(point => [point.id, point.count]))).toEqual({ [ids[0]]: 2, [ids[1]]: 2, [ids[2]]: 1 });
  await page.locator('#deals-filter').selectOption('collaboration');
  graph = await dealSnapshot(page);
  expect(graph.links.length).toBe(3);
  expect(graph.nodes.every(point => point.count === 1)).toBe(true);
  await page.locator('#deals-filter').selectOption('equity_stake');
  await expect(page.locator('#deals-count')).toHaveText('Catalog: 3 deals · Filtered: 1 · In graph: 0 deals / 0 companies');
  await expect(page.locator('#deals-note')).toContainText('Deal records match this filter');
  expect((await dealSnapshot(page)).nodes).toEqual([]);
  await page.locator('#lang-toggle').click();
  await expect(page.locator('#deals-note')).toContainText('当前筛选有交易记录');
  await page.evaluate(() => window.PHARM_DATA.deals.splice(0));
  await page.locator('#theme-toggle').click();
  await expect(page.locator('#deals-count')).toHaveText('全库收录 0 笔 · 当前筛选 0 笔 · 当前入图 0 笔 / 0 家企业');
  await expect(page.locator('#deals-note')).toHaveText('当前类型没有匹配的交易记录。');
  await expect(page.locator('#deals-render-error')).toBeHidden();
  expect(errors).toEqual([]);
});
