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
  // National/flag-leaning color per country (ISO2) so the map reads intuitively — US blue, CN red,
  // IN green, DE gold, JP pink, NL orange… High-marker-count countries are kept mutually distinct;
  // unlisted countries fall back to the golden-angle HSL above.
  var FLAG_COLOR = {
    US: '#3b5bdb', CN: '#e8352e', JP: '#f783ac', IN: '#2f9e44', DE: '#f2c811', GB: '#2b3a8c',
    FR: '#1c7ed6', CH: '#fa5252', KR: '#1098ad', IT: '#82c91e', CA: '#e64980', AU: '#0b7285',
    DK: '#d6336c', SE: '#1864ab', NL: '#fd7e14', BE: '#f08c00', IE: '#40c057', ES: '#e67700',
    BR: '#94d82d', IL: '#4dabf7', RU: '#4263eb', AT: '#ff8787', FI: '#74c0fc', NO: '#c92a2a',
    PL: '#f06595', TR: '#e8590c', SA: '#087f5b', EG: '#a61e4d', ZA: '#d9480f', MX: '#2b8a3e',
    AR: '#66d9e8', TW: '#5c7cfa', HK: '#ff6b6b', SG: '#ffa8a8', ID: '#e599f7', TH: '#845ef7',
    MY: '#f59f00', PK: '#087f5b', BD: '#0ca678', PH: '#9775fa', VN: '#fa5252', JO: '#9e2a2b',
    AE: '#2f9e44', NZ: '#15616d', PT: '#51cf66', GR: '#1971c2', HU: '#37b24d', CZ: '#4c6ef5',
    RO: '#fab005', SI: '#3bc9db', BG: '#69db7c', SK: '#5c7cfa', UA: '#fcc419'
  };

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
    var countryColorMap = {}; countries.sort().forEach(function (co, i) { countryColorMap[co] = FLAG_COLOR[co] || catColor(i, pal); });
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
        // progressive:0 disables progressive (incremental) rendering, which auto-enables above
        // progressiveThreshold (default 3000) — its already-drawn chunks DON'T re-project on geo
        // roam/zoom, so points lag the base map once site count crosses ~3000 (all filters = all).
        type: 'scatter', coordinateSystem: 'geo', data: points, progressive: 0,
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
