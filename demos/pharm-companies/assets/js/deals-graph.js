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

  function ensureGate(el, i18n) {
    if (!window.QrostTouchGate || !el) return null;
    if (el._qrostGate) return el._qrostGate;
    return window.QrostTouchGate.attach(el, {
      labels: function () {
        var I = i18n || window.PHARM_I18N;
        return {
          enable: I.t('graphTouchEnable'),
          disable: I.t('graphTouchDisable'),
        };
      },
      onChange: function (interactive) {
        var inst = window.echarts.getInstanceByDom(el);
        if (inst) inst.setOption({ series: [{ roam: interactive, draggable: interactive }] });
      },
    });
  }

  function graphInteractive(el) {
    if (el && el._qrostGate) return el._qrostGate.isInteractive();
    return !window.QrostTouchGate || !window.QrostTouchGate.coarsePointer();
  }

  function styleForType(type) { return DEAL_STYLE[type] || DEAL_STYLE.collaboration; }

  // A deal is an event; its pairwise graph links are a separate representation.
  function buildNetwork(deals, getCompany, filterType) {
    var seenDeals = new Set();
    var unique = (deals || []).filter(function (deal) {
      if (seenDeals.has(deal.id)) return false;
      seenDeals.add(deal.id); return true;
    });
    var matched = unique.filter(function (deal) { return !filterType || deal.deal_type === filterType; });
    var memberships = new Map(), edges = [], drawableDeals = 0;
    matched.forEach(function (deal) {
      var parties = Array.from(new Set((deal.parties || []).map(function (party) { return party.company_id; })
        .filter(function (id) { return id && getCompany(id); })));
      if (parties.length < 2) return;
      drawableDeals++;
      parties.forEach(function (id) {
        if (!memberships.has(id)) memberships.set(id, new Set());
        memberships.get(id).add(deal.id);
      });
      for (var a = 0; a < parties.length; a++) {
        for (var b = a + 1; b < parties.length; b++) {
          edges.push({ source: parties[a], target: parties[b], _deal: deal });
        }
      }
    });
    var dealCounts = Object.create(null);
    memberships.forEach(function (ids, id) { dealCounts[id] = ids.size; });
    return { totalDeals: unique.length, matchedDeals: matched.length, drawableDeals: drawableDeals,
      nodeIds: Array.from(memberships.keys()), dealCounts: dealCounts, edges: edges };
  }

  function render(el, opts) {
    if (!window.echarts || !el) return null;
    opts = opts || {};
    var gate = ensureGate(el, opts.i18n);
    if (gate) gate.refresh();
    var isEn = !!opts.isEn, deals = opts.deals || [], filter = opts.filterType || '';
    var getCompany = opts.getCompany || function () { return null; };
    var label = function (c) { return isEn ? (c.name_en || c.id) : (c.name_zh || c.name_en || c.id); };
    var regionName = function (r) { return opts.i18n ? opts.i18n.enumLabel('region', r) : r; };

    var network = opts.network || buildNetwork(deals, getCompany, filter);
    var dealCounts = network.dealCounts, edges = network.edges, nodeIds = network.nodeIds;
    var regions = [];
    nodeIds.forEach(function (id) { var c = getCompany(id); var r = (c && c.region) || 'other_apac'; if (regions.indexOf(r) === -1) regions.push(r); });
    var catIndex = {}; regions.forEach(function (r, i) { catIndex[r] = i; });

    var nodes = nodeIds.map(function (id) {
      var c = getCompany(id) || { id: id, name_zh: id };
      var r = (c && c.region) || 'other_apac';
      return { id: id, name: label(c), category: catIndex[r], symbolSize: Math.min(12 + dealCounts[id] * 3, 42), value: dealCounts[id], _cid: id };
    });
    var links = edges.map(function (e) {
      var st = styleForType(e._deal.deal_type);
      return { source: e.source, target: e.target, _deal: e._deal,
        lineStyle: { color: st.color, width: st.width, type: st.type, opacity: 0.72, curveness: 0.12 } };
    });

    var textc = cssVar('--text', '#e5e7eb'), faint = cssVar('--text-faint', '#94a3b8');
    var option = {
      tooltip: {
        confine: true,
        formatter: function (p) {
          if (p.dataType === 'edge') {
            var d = p.data._deal; var amountLabel = opts.i18n ? opts.i18n.t('dealTotal') : (isEn ? 'Total (incl. milestones)' : '潜在总额');
            var v = d.total_usd_m != null ? (' · ' + amountLabel + ' ' + usd(d.total_usd_m)) : '';
            return '<b>' + (isEn ? (d.headline_en || '') : (d.headline_zh || '')) + '</b><br><span style="opacity:.7">' + (d.date || '') + v + '</span>';
          }
          return '<b>' + p.name + '</b><br><span style="opacity:.7">' + (dealCounts[p.data._cid] || 0) + (isEn ? ' distinct displayed deals' : ' 笔当前入图独立交易') + '</span>';
        }
      },
      legend: [{ data: regions.map(regionName), textStyle: { color: faint }, type: 'scroll', top: 0, icon: 'circle' }],
      series: [{
        type: 'graph', layout: 'force', roam: graphInteractive(el), draggable: graphInteractive(el), zoom: 1.05,
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
    if (gate) gate.syncSurface();
    inst.off('click');
    inst.on('click', function (p) { if (p.dataType === 'node' && opts.onNodeClick) opts.onNodeClick(p.data._cid); });
    bound = inst;
    return { nodes: nodes.length, edges: links.length, drawableDeals: network.drawableDeals };
  }

  window.addEventListener('resize', function () { if (bound) bound.resize(); });
  window.DEALS_GRAPH = { render: render, buildNetwork: buildNetwork, styleForType: styleForType };
})();
