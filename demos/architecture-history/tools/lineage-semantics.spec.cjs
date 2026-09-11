const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { offline } = require('../../../tools/browser/offline.cjs');

const data = path.resolve(__dirname, '../assets/data');
const people = JSON.parse(fs.readFileSync(path.join(data, 'people.json'))).people;
const byId = new Map(people.map(person => [person.id, person]));
const relations = JSON.parse(fs.readFileSync(path.join(data, 'relations.json'))).relations.filter(row =>
  ['student_of_recorded', 'documented_influence'].includes(row.relation_type) && byId.has(row.from_id) && byId.has(row.to_id));
const countById = new Map();
for (const row of relations) for (const id of new Set([row.from_id, row.to_id])) {
  if (!countById.has(id)) countById.set(id, new Set());
  countById.get(id).add(row.id);
}
const searchPerson = [...countById].sort((a, b) => b[1].size - a[1].size)[0][0];

async function graph(page) {
  return page.locator('#lineage-graph').evaluate(node => {
    const chart = window.echarts && window.echarts.getInstanceByDom(node);
    const option = chart && chart.getOption();
    if (!option || !option.series || !option.series[0]) return { nodes: [], links: [] };
    return { nodes: option.series[0].data, links: option.series[0].links };
  });
}
async function samples(page) {
  return page.locator('#lineage-size-legend [data-relation-count]').evaluateAll(nodes => nodes.map(node => ({
    count: +node.dataset.relationCount,
    size: node.querySelector('.lineage-size-dot').getBoundingClientRect().width,
  })));
}

for (const language of ['zh', 'en']) {
  test(`architecture lineage keeps candidate counts and size semantics in ${language}`, async ({ page }, testInfo) => {
    await offline(page);
    await page.addInitScript(lang => {
      localStorage.setItem('architecture-history-lang', lang);
      localStorage.setItem('qrost-architecture-history-theme', lang === 'en' ? 'dark' : 'light');
    }, language);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/demos/architecture-history/');
    await expect(page.locator('html')).toHaveAttribute('lang', language === 'zh' ? 'zh-CN' : 'en');
    if (language === 'en') await expect(page.locator('html')).toHaveClass(/dark/);
    else await expect(page.locator('html')).not.toHaveClass(/dark/);
    await expect.poll(async () => (await graph(page)).nodes.length).toBe(countById.size);
    const initial = await graph(page);
    const original = new Map(initial.nodes.map(node => [node.id, node]));
    expect(initial.links.length).toBe(new Set(relations.map(row => row.id)).size);
    for (const node of initial.nodes) {
      expect(node.totalRelationCount).toBe(countById.get(node.id).size);
      expect(node.visibleRelationCount).toBe(node.totalRelationCount);
    }
    expect(new Set(initial.nodes.map(node => node.itemStyle.color)).size).toBe(1);
    const ranked = initial.nodes.slice().sort((a, b) => a.totalRelationCount - b.totalRelationCount);
    expect(ranked.at(-1).totalRelationCount).toBeGreaterThan(5);
    for (let i = 1; i < ranked.length; i++) if (ranked[i].totalRelationCount > ranked[i - 1].totalRelationCount) {
      expect(ranked[i].symbolSize).toBeGreaterThan(ranked[i - 1].symbolSize);
    }
    const legend = page.locator('#lineage-size-legend');
    await expect(legend).toContainText(language === 'zh' ? '不代表历史地位或关系可信度' : 'do not measure historical standing or relationship reliability');
    const originalSamples = await samples(page);
    expect(originalSamples.at(-1).count).toBe(ranked.at(-1).totalRelationCount);
    expect(originalSamples.at(-1).size).toBeCloseTo(ranked.at(-1).symbolSize, 1);
    const fits = await legend.evaluate(node => node.scrollWidth <= node.clientWidth + 1);
    expect(fits).toBe(true);

    await page.locator('[data-lineage-type="student_of_recorded"]').click();
    await expect.poll(async () => (await graph(page)).links.length).toBe(relations.filter(row => row.relation_type === 'documented_influence').length);
    const influence = await graph(page);
    expect(influence.nodes.some(node => node.visibleRelationCount < node.totalRelationCount)).toBe(true);
    for (const node of influence.nodes) expect(node.symbolSize).toBe(original.get(node.id).symbolSize);
    for (const edge of influence.links) {
      expect(edge.relationType).toBe('documented_influence');
      expect(edge.lineStyle.type).toBe('dashed');
    }
    const tooltip = await page.locator('#lineage-graph').evaluate(node => {
      const option = window.echarts.getInstanceByDom(node).getOption();
      const person = option.series[0].data.find(row => row.visibleRelationCount < row.totalRelationCount);
      return { person: option.tooltip[0].formatter({ dataType: 'node', data: person }),
        total: window.ARCH_I18N.t('lineageTotalCount', { count: person.totalRelationCount }),
        visible: window.ARCH_I18N.t('lineageVisibleCount', { count: person.visibleRelationCount }),
        edge: option.tooltip[0].formatter({ dataType: 'edge', data: option.series[0].links[0] }) };
    });
    expect(tooltip.person).toContain(tooltip.total); expect(tooltip.person).toContain(tooltip.visible);
    expect(tooltip.edge).toContain('documented_influence');
    expect(await samples(page)).toEqual(originalSamples);

    await page.locator('#lineage-reset-filters').click();
    await page.locator('#lineage-search').fill(byId.get(searchPerson).external_ids.wikidata);
    await expect.poll(async () => (await graph(page)).links.length).toBe(countById.get(searchPerson).size);
    const searched = await graph(page);
    expect(searched.nodes.some(node => node.visibleRelationCount < node.totalRelationCount)).toBe(true);
    for (const node of searched.nodes) expect(node.symbolSize).toBe(original.get(node.id).symbolSize);
    expect(await samples(page)).toEqual(originalSamples);
    await page.locator('#theme-toggle').click();
    for (const node of (await graph(page)).nodes) expect(node.symbolSize).toBe(original.get(node.id).symbolSize);
    expect(await samples(page)).toEqual(originalSamples);
    await expect(page.locator('#lineage-fallback')).toBeHidden();
    expect(errors).toEqual([]);
    await legend.screenshot({ path: testInfo.outputPath('lineage-size-legend.png') });
  });
}
