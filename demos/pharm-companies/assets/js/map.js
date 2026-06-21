/* World map of company sites (ECharts geo + scatter, vendored WORLD_GEO, no API key). window.PHARM_MAP */
(function () {
  'use strict';
  var I18N = window.PHARM_I18N;
  var chart = null, registered = false, onClickCb = null;

  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  var SITE_SIZE = { HQ: 12, RD: 9, manufacturing: 9, commercial: 6, JV: 8 };
  // CSS site vars are lowercase (--site-hq / --site-rd / --site-jv …) but data site_type is HQ/RD/JV.
  function siteColor(type) { return cssVar('--site-' + String(type).toLowerCase()) || cssVar('--chart-1'); }
  var TYPE_COLORS = ['--chart-1','--chart-2','--chart-3','--chart-4','--chart-5','--chart-6','--chart-7','--chart-8'];
  // distinct color for the i-th category: themed palette first, then golden-angle HSL (so 40+ countries differ).
  function catColor(i, pal) { return i < pal.length ? pal[i] : 'hsl(' + Math.round((i * 137.508) % 360) + ',62%,56%)'; }

  function ensure() {
    if (!window.echarts || !window.WORLD_GEO) return null;
    if (!registered) { window.echarts.registerMap('world', window.WORLD_GEO); registered = true; }
    var el = document.getElementById('world-map');
    if (!el) return null;
    if (!chart) {
      chart = window.echarts.init(el, null, { renderer: 'canvas' });
      chart.on('click', function (p) { if (p.data && p.data._cid && onClickCb) onClickCb(p.data._cid); });
    }
    return chart;
  }

  // Returns {key,label,color} for a site under the chosen dimension.
  function categorize(site, company, dim, countryColorMap, typeColorMap) {
    if (dim === 'site_type') {
      return { key: site.site_type, label: I18N.enumLabel('site_type', site.site_type), color: siteColor(site.site_type) };
    }
    if (dim === 'company_type') {
      var ct = company ? company.company_type : '?';
      return { key: ct, label: I18N.enumLabel('company_type', ct), color: typeColorMap[ct] || cssVar('--chart-1') };
    }
    // country (HQ)
    var co = company ? company.country : '?';
    var lab = company ? I18N.pick(company.country_display_zh, company.country_display_en) : co;
    return { key: co, label: lab || co, color: countryColorMap[co] || cssVar('--chart-1') };
  }

  function render(opts) {
    var c = ensure();
    if (!c) return;
    var dim = opts.dim || 'site_type';
    var sites = opts.sites || [];
    var getCompany = opts.getCompany;
    onClickCb = opts.onClick || onClickCb;

    // stable color maps for country / company_type
    var countries = [], types = [];
    sites.forEach(function (s) {
      var co = getCompany(s.company_id);
      if (co && co.country && countries.indexOf(co.country) === -1) countries.push(co.country);
      if (co && co.company_type && types.indexOf(co.company_type) === -1) types.push(co.company_type);
    });
    var pal = TYPE_COLORS.map(cssVar);
    var countryColorMap = {}; countries.sort().forEach(function (co, i) { countryColorMap[co] = catColor(i, pal); });
    var typeColorMap = {}; types.sort().forEach(function (t, i) { typeColorMap[t] = catColor(i, pal); });

    var legend = {};
    var points = sites.filter(function (s) { return typeof s.lat === 'number' && typeof s.lng === 'number'; }).map(function (s) {
      var co = getCompany(s.company_id);
      var cat = categorize(s, co, dim, countryColorMap, typeColorMap);
      legend[cat.key] = { label: cat.label, color: cat.color };
      return {
        name: co ? I18N.name(co) : s.company_id,
        value: [s.lng, s.lat],
        symbolSize: SITE_SIZE[s.site_type] || 7,
        itemStyle: { color: cat.color, borderColor: 'rgba(0,0,0,.25)', borderWidth: 0.5, opacity: 0.9 },
        _cid: s.company_id, _site: s, _co: co
      };
    });

    c.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item', backgroundColor: cssVar('--bg-surface'), borderColor: cssVar('--border'),
        textStyle: { color: cssVar('--text') }, confine: true,
        formatter: function (p) {
          if (!p.data) return '';
          var s = p.data._site, co = p.data._co;
          return '<b>' + (co ? I18N.name(co) : '') + '</b><br/>' +
            I18N.name(s) + '<br/>' +
            '<span style="color:' + p.data.itemStyle.color + '">●</span> ' +
            I18N.enumLabel('site_type', s.site_type) + ' · ' + (s.city || '') + ', ' + (s.country || '');
        }
      },
      geo: {
        map: 'world', roam: true, scaleLimit: { min: 1, max: 8 },
        itemStyle: { areaColor: cssVar('--map-land'), borderColor: cssVar('--map-border'), borderWidth: 0.5 },
        emphasis: { itemStyle: { areaColor: cssVar('--accent-soft') }, label: { show: false } },
        label: { show: false }, silent: true
      },
      series: [{
        // NOTE: do NOT enable `large` — large-scatter batches points and ignores per-point
        // itemStyle.color, so re-coloring by dimension stops working. ~3k points render fine.
        type: 'scatter', coordinateSystem: 'geo', data: points,
        emphasis: { scale: 1.4 }, z: 5
      }]
    }, true);

    // custom legend
    var leg = document.getElementById('map-legend');
    if (leg) {
      leg.innerHTML = Object.keys(legend).map(function (k) {
        return '<span><span class="dot" style="background:' + legend[k].color + '"></span>' + legend[k].label + '</span>';
      }).join('');
    }
  }

  function resize() { if (chart) try { chart.resize(); } catch (e) {} }
  window.addEventListener('resize', resize);

  window.PHARM_MAP = { render: render, resize: resize };
})();
