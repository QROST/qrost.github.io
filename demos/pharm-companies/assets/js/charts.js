/* ECharts renderers (theme-aware via CSS vars). window.PHARM_CHARTS */
(function () {
  'use strict';
  var I18N = window.PHARM_I18N;
  var instances = {};

  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function palette() { return [1,2,3,4,5,6,7,8].map(function (i) { return cssVar('--chart-' + i); }); }
  function textColor() { return cssVar('--text-muted'); }
  function faintColor() { return cssVar('--text-faint'); }
  function gridColor() { return cssVar('--border'); }

  function inst(id) {
    var el = document.getElementById(id);
    if (!el || !window.echarts) return null;
    if (instances[id]) { try { instances[id].dispose(); } catch (e) {} }
    instances[id] = window.echarts.init(el, null, { renderer: 'canvas' });
    return instances[id];
  }
  function baseText() { return { color: textColor(), fontFamily: 'Inter, system-ui, sans-serif' }; }
  function tooltip(extra) {
    return Object.assign({
      backgroundColor: cssVar('--bg-surface'), borderColor: cssVar('--border'),
      textStyle: { color: cssVar('--text') }, confine: true
    }, extra || {});
  }

  function empty(id) {
    var c = inst(id); if (!c) return;
    c.setOption({ title: { text: I18N.t('noData'), left: 'center', top: 'middle', textStyle: { color: faintColor(), fontSize: 13, fontWeight: 'normal' } } });
  }

  /* ---- overview: companies & products by region (stacked horizontal bar) ---- */
  function renderOverview(companies, products) {
    var c = inst('overview-chart'); if (!c) return;
    var regions = {};
    companies.forEach(function (x) { (regions[x.region] = regions[x.region] || { co: 0, pr: 0 }).co++; });
    products.forEach(function (p) { (regions[p.region] = regions[p.region] || { co: 0, pr: 0 }).pr++; });
    var keys = Object.keys(regions);
    if (!keys.length) return empty('overview-chart');
    keys.sort(function (a, b) { return regions[b].co + regions[b].pr - regions[a].co - regions[a].pr; });
    var pal = palette();
    c.setOption({
      textStyle: baseText(), tooltip: tooltip({ trigger: 'axis', axisPointer: { type: 'shadow' } }),
      legend: { data: [I18N.t('kpiCompanies'), I18N.t('kpiProducts')], textStyle: { color: textColor() }, top: 0 },
      grid: { left: 90, right: 24, top: 36, bottom: 24 },
      xAxis: { type: 'value', axisLine: { lineStyle: { color: gridColor() } }, splitLine: { lineStyle: { color: gridColor() } }, axisLabel: { color: faintColor() } },
      yAxis: { type: 'category', data: keys.map(function (k) { return I18N.enumLabel('region', k); }), axisLine: { lineStyle: { color: gridColor() } }, axisLabel: { color: textColor() } },
      series: [
        { name: I18N.t('kpiCompanies'), type: 'bar', stack: 't', data: keys.map(function (k) { return regions[k].co; }), itemStyle: { color: pal[1] } },
        { name: I18N.t('kpiProducts'), type: 'bar', stack: 't', data: keys.map(function (k) { return regions[k].pr; }), itemStyle: { color: pal[0] } }
      ]
    });
  }

  /* ---- modality sunburst: class -> modality -> count ---- */
  function renderModalitySunburst(products, modalities, onPick) {
    var c = inst('modality-sunburst'); if (!c) return;
    if (!products.length) return empty('modality-sunburst');
    var byMod = {};
    products.forEach(function (p) { byMod[p.modality_id] = (byMod[p.modality_id] || 0) + 1; });
    var classes = {};
    modalities.forEach(function (m) {
      var n = byMod[m.id] || 0; if (!n) return;
      (classes[m.class] = classes[m.class] || []).push({ name: I18N.name(m), value: n, modId: m.id });
    });
    var pal = palette(); var ci = 0;
    var data = Object.keys(classes).map(function (cl) {
      var color = pal[ci++ % pal.length];
      return { name: I18N.enumLabel('modality_class', cl), itemStyle: { color: color }, children: classes[cl] };
    });
    c.setOption({
      textStyle: baseText(), tooltip: tooltip({ formatter: function (p) { return p.name + ': ' + p.value; } }),
      series: [{
        type: 'sunburst', radius: ['12%', '92%'], data: data, sort: 'desc',
        emphasis: { focus: 'ancestor' },
        label: { color: cssVar('--text'), minAngle: 8 },
        levels: [{}, { r0: '12%', r: '52%', label: { rotate: 'tangential' } }, { r0: '52%', r: '90%', label: { align: 'right' } }],
        itemStyle: { borderColor: cssVar('--bg-surface'), borderWidth: 2 }
      }]
    });
    c.off('click');
    c.on('click', function (p) { if (p.data && p.data.modId && onPick) onPick(p.data.modId); });
  }

  /* ---- pipeline by phase (stacked bar over phases) ---- */
  function renderTrendPhase(products) {
    var c = inst('trend-phase'); if (!c) return;
    if (!products.length) return empty('trend-phase');
    var phases = ['preclinical', 'ph1', 'ph2', 'ph3', 'filed', 'approved'];
    var counts = phases.map(function (ph) { return products.filter(function (p) { return p.approval_status === ph; }).length; });
    var pal = palette();
    c.setOption({
      textStyle: baseText(), tooltip: tooltip({ trigger: 'axis', axisPointer: { type: 'shadow' } }),
      grid: { left: 40, right: 16, top: 16, bottom: 40 },
      xAxis: { type: 'category', data: phases.map(function (p) { return I18N.phaseLabel(p); }), axisLabel: { color: textColor(), rotate: 0 }, axisLine: { lineStyle: { color: gridColor() } } },
      yAxis: { type: 'value', axisLabel: { color: faintColor() }, splitLine: { lineStyle: { color: gridColor() } } },
      series: [{ type: 'bar', data: counts.map(function (v, i) { return { value: v, itemStyle: { color: pal[i % pal.length] } }; }), barWidth: '55%' }]
    });
  }

  /* ---- TA distribution (bar) ---- */
  function renderTrendTA(products, getTA) {
    var c = inst('trend-ta'); if (!c) return;
    if (!products.length) return empty('trend-ta');
    var by = {};
    products.forEach(function (p) { by[p.therapeutic_area_id] = (by[p.therapeutic_area_id] || 0) + 1; });
    var keys = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; });
    c.setOption({
      textStyle: baseText(), tooltip: tooltip({ trigger: 'axis', axisPointer: { type: 'shadow' } }),
      grid: { left: 110, right: 20, top: 10, bottom: 24 },
      xAxis: { type: 'value', axisLabel: { color: faintColor() }, splitLine: { lineStyle: { color: gridColor() } } },
      yAxis: { type: 'category', inverse: true, data: keys.map(function (k) { var t = getTA(k); return t ? I18N.name(t) : k; }), axisLabel: { color: textColor() }, axisLine: { lineStyle: { color: gridColor() } } },
      series: [{ type: 'bar', data: keys.map(function (k) { return by[k]; }), itemStyle: { color: cssVar('--chart-1') }, barWidth: '60%' }]
    });
  }

  /* ---- modality class mix (pie) ---- */
  function renderTrendModality(products, getModality) {
    var c = inst('trend-modality'); if (!c) return;
    if (!products.length) return empty('trend-modality');
    var by = {};
    products.forEach(function (p) {
      var m = getModality(p.modality_id); var cl = m ? m.class : '?';
      by[cl] = (by[cl] || 0) + 1;
    });
    var pal = palette();
    var data = Object.keys(by).map(function (k, i) { return { name: I18N.enumLabel('modality_class', k), value: by[k], itemStyle: { color: pal[i % pal.length] } }; });
    c.setOption({
      textStyle: baseText(), tooltip: tooltip({ trigger: 'item', formatter: '{b}: {c} ({d}%)' }),
      legend: { type: 'scroll', orient: 'vertical', right: 0, top: 'middle', textStyle: { color: textColor() } },
      series: [{ type: 'pie', radius: ['40%', '70%'], center: ['38%', '50%'], data: data, label: { color: textColor() }, itemStyle: { borderColor: cssVar('--bg-surface'), borderWidth: 2 } }]
    });
  }

  /* ---- China vs world: companies by region (bar) ---- */
  function renderTrendRegion(companies) {
    var c = inst('trend-region'); if (!c) return;
    if (!companies.length) return empty('trend-region');
    var by = {};
    companies.forEach(function (x) { by[x.region] = (by[x.region] || 0) + 1; });
    var keys = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; });
    c.setOption({
      textStyle: baseText(), tooltip: tooltip({ trigger: 'axis', axisPointer: { type: 'shadow' } }),
      grid: { left: 40, right: 16, top: 10, bottom: 60 },
      xAxis: { type: 'category', data: keys.map(function (k) { return I18N.enumLabel('region', k); }), axisLabel: { color: textColor(), rotate: 30 }, axisLine: { lineStyle: { color: gridColor() } } },
      yAxis: { type: 'value', axisLabel: { color: faintColor() }, splitLine: { lineStyle: { color: gridColor() } } },
      series: [{ type: 'bar', data: keys.map(function (k) { return { value: by[k], itemStyle: { color: k === 'greater_china' ? cssVar('--chart-8') : cssVar('--chart-2') } }; }), barWidth: '55%' }]
    });
  }

  /* ---- country radar ---- */
  function renderCountryRadar(countries, selected) {
    var c = inst('country-radar'); if (!c) return;
    var sel = countries.filter(function (x) { return selected.indexOf(x.country) !== -1; });
    if (!sel.length) return empty('country-radar');
    function mv(o) { return o && o.market_size ? o.market_size.value : 0; }
    function rv(o) { return o && o.rnd_spend_total ? o.rnd_spend_total.value : 0; }
    var maxMarket = Math.max.apply(null, countries.map(mv)) || 1;
    var maxRnd = Math.max.apply(null, countries.map(rv)) || 1;
    var maxCo = Math.max.apply(null, countries.map(function (o) { return o.company_count || 0; })) || 1;
    var maxTA = Math.max.apply(null, countries.map(function (o) { return (o.top_therapeutic_areas || []).length; })) || 1;
    var pal = palette();
    c.setOption({
      textStyle: baseText(), tooltip: tooltip({}),
      legend: { data: sel.map(function (x) { return I18N.name(x); }), textStyle: { color: textColor() }, top: 0, type: 'scroll' },
      radar: {
        indicator: [
          { name: I18N.t('colMarket'), max: maxMarket }, { name: I18N.t('rndSpend'), max: maxRnd },
          { name: I18N.t('colCompanies'), max: maxCo }, { name: I18N.t('thFocus'), max: maxTA }
        ],
        axisName: { color: textColor() }, splitLine: { lineStyle: { color: gridColor() } },
        splitArea: { areaStyle: { color: ['transparent'] } }, axisLine: { lineStyle: { color: gridColor() } }, center: ['50%', '56%'], radius: '64%'
      },
      series: [{
        type: 'radar', data: sel.map(function (x, i) {
          return { name: I18N.name(x), value: [mv(x), rv(x), x.company_count || 0, (x.top_therapeutic_areas || []).length],
            lineStyle: { color: pal[i % pal.length] }, itemStyle: { color: pal[i % pal.length] }, areaStyle: { opacity: 0.08 } };
        })
      }]
    });
  }

  function resizeAll() { Object.keys(instances).forEach(function (k) { try { instances[k].resize(); } catch (e) {} }); }
  window.addEventListener('resize', resizeAll);

  window.PHARM_CHARTS = {
    renderOverview: renderOverview, renderModalitySunburst: renderModalitySunburst,
    renderTrendPhase: renderTrendPhase, renderTrendTA: renderTrendTA,
    renderTrendModality: renderTrendModality, renderTrendRegion: renderTrendRegion,
    renderCountryRadar: renderCountryRadar, resizeAll: resizeAll, cssVar: cssVar
  };
})();
