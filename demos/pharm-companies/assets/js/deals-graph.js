/* Deal relationship network — ECharts force-directed graph of license / M&A / JV / collaboration
   / equity deals between atlas companies. Node color = HQ region; edge color = deal type.
   window.DEALS_GRAPH.render(containerEl, opts)
   opts: { deals, getCompany, isEn, filterType, onNodeClick, i18n } -> { nodes, edges } */
(function () {
  'use strict';
  // HQ-region node colors (China red, US blue, EU/JP… distinct) so the 出海 story reads at a glance.
  var REGION_COLOR = {
    greater_china: '#e8352e', north_america: '#3b5bdb', europe: '#1c7ed6', japan: '#f783ac',
    other_apac: '#0b7285', oceania: '#0ca678', latam: '#94d82d', mea: '#a61e4d'
  };
  // edge style per deal type
  var DEAL_STYLE = {
    license_out:   { color: '#14b8a6', type: 'solid',  width: 1.8 },
    license_in:    { color: '#3b82f6', type: 'solid',  width: 1.6 },
    m_and_a:       { color: '#ef4444', type: 'solid',  width: 2.6 },
    collaboration: { color: '#94a3b8', type: 'dashed', width: 1.4 },
    jv:            { color: '#22c55e', type: 'dashed', width: 1.6 },
    equity_stake:  { color: '#a855f7', type: 'dotted', width: 1.6 }
  };
  var bound = null;
  function cssVar(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n); return (v && v.trim()) || f; }
  function usd(m) { return m == null ? '' : (m >= 1000 ? '$' + (m / 1000).toFixed(1) + 'B' : '$' + m + 'M'); }

  function render(el, opts) {
    if (!window.echarts || !el) return null;
    opts = opts || {};
    var isEn = !!opts.isEn, deals = opts.deals || [], filter = opts.filterType || '';
    var getCompany = opts.getCompany || function () { return null; };
    var label = function (c) { return isEn ? (c.name_en || c.id) : (c.name_zh || c.name_en || c.id); };
    var regionName = function (r) { return opts.i18n ? opts.i18n.enumLabel('region', r) : r; };

    // edges = deals (filtered) with >= 2 parties resolvable to atlas companies
    var fdeals = deals.filter(function (d) { return !filter || d.deal_type === filter; });
    var deg = {}, edges = [];
    fdeals.forEach(function (d) {
      var pis = (d.parties || []).filter(function (p) { return p.company_id && getCompany(p.company_id); })
        .map(function (p) { return p.company_id; });
      pis = pis.filter(function (x, i) { return pis.indexOf(x) === i; });
      for (var a = 0; a < pis.length; a++) {
        for (var b = a + 1; b < pis.length; b++) {
          edges.push({ source: pis[a], target: pis[b], _deal: d });
          deg[pis[a]] = (deg[pis[a]] || 0) + 1; deg[pis[b]] = (deg[pis[b]] || 0) + 1;
        }
      }
    });
    var nodeIds = Object.keys(deg);
    var regions = [];
    nodeIds.forEach(function (id) { var c = getCompany(id); var r = (c && c.region) || 'other_apac'; if (regions.indexOf(r) === -1) regions.push(r); });
    var catIndex = {}; regions.forEach(function (r, i) { catIndex[r] = i; });

    var nodes = nodeIds.map(function (id) {
      var c = getCompany(id) || { id: id, name_zh: id };
      var r = (c && c.region) || 'other_apac';
      return { id: id, name: label(c), category: catIndex[r], symbolSize: Math.min(12 + (deg[id] || 1) * 3, 42), _cid: id };
    });
    var links = edges.map(function (e) {
      var st = DEAL_STYLE[e._deal.deal_type] || DEAL_STYLE.collaboration;
      return { source: e.source, target: e.target, _deal: e._deal,
        lineStyle: { color: st.color, width: st.width, type: st.type, opacity: 0.72, curveness: 0.12 } };
    });

    var textc = cssVar('--text', '#e5e7eb'), faint = cssVar('--text-faint', '#94a3b8');
    var option = {
      tooltip: {
        confine: true,
        formatter: function (p) {
          if (p.dataType === 'edge') {
            var d = p.data._deal; var v = d.total_usd_m != null ? (' · ' + usd(d.total_usd_m)) : '';
            return '<b>' + (isEn ? (d.headline_en || '') : (d.headline_zh || '')) + '</b><br><span style="opacity:.7">' + (d.date || '') + v + '</span>';
          }
          return '<b>' + p.name + '</b><br><span style="opacity:.7">' + (deg[p.data._cid] || 0) + (isEn ? ' deals' : ' 笔交易') + '</span>';
        }
      },
      legend: [{ data: regions.map(regionName), textStyle: { color: faint }, type: 'scroll', top: 0, icon: 'circle' }],
      series: [{
        type: 'graph', layout: 'force', roam: true, draggable: true, zoom: 1.05,
        categories: regions.map(function (r) { return { name: regionName(r), itemStyle: { color: REGION_COLOR[r] || '#64748b' } }; }),
        force: { repulsion: filter ? 280 : 170, edgeLength: [50, 170], gravity: 0.06, friction: 0.22 },
        label: { show: true, position: 'right', color: textc, fontSize: 10, formatter: '{b}' },
        lineStyle: { opacity: 0.72, curveness: 0.12 },
        emphasis: { focus: 'adjacency', label: { fontSize: 12 }, lineStyle: { width: 3 } },
        data: nodes, links: links, top: 36
      }]
    };

    var inst = window.echarts.getInstanceByDom(el) || window.echarts.init(el);
    inst.setOption(option, true);
    inst.off('click');
    inst.on('click', function (p) { if (p.dataType === 'node' && opts.onNodeClick) opts.onNodeClick(p.data._cid); });
    bound = inst;
    return { nodes: nodes.length, edges: links.length };
  }

  window.addEventListener('resize', function () { if (bound) bound.resize(); });
  window.DEALS_GRAPH = { render: render };
})();
