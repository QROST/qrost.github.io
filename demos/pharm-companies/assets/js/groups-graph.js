/* Corporate-group ownership graph — ECharts force-directed network.
   window.GROUPS_GRAPH.render(containerEl, opts)
   opts: { companies, groups, isEn, filterGroupId, getCompany, getGroup, onNodeClick } */
(function () {
  'use strict';
  var PALETTE = ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#a855f7', '#0ea5e9',
    '#22c55e', '#ec4899', '#f97316', '#84cc16', '#06b6d4', '#eab308',
    '#8b5cf6', '#10b981', '#fb7185', '#3b82f6', '#d946ef', '#0891b2', '#f43f5e', '#65a30d'];
  var bound = null;
  function cssVar(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n); return (v && v.trim()) || f; }

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

  function render(el, opts) {
    if (!window.echarts || !el) return null;
    opts = opts || {};
    var gate = ensureGate(el, opts.i18n);
    if (gate) gate.refresh();
    var isEn = !!opts.isEn, groups = opts.groups || [], companies = opts.companies || [];
    var filter = opts.filterGroupId || '';
    var label = function (c) { return isEn ? (c.name_en || c.id) : (c.name_zh || c.name_en || c.id); };
    var gname = function (g) { return isEn ? (g.name_en || g.id) : (g.name_zh || g.name_en || g.id); };
    var groupRoleLabel = function (r) { return opts.i18n ? opts.i18n.enumLabel('group_role', r) : r; };

    var members = companies.filter(function (c) { return c.group_id && (!filter || c.group_id === filter); });
    var idset = {}; members.forEach(function (c) { idset[c.id] = 1; });
    var present = {}; members.forEach(function (c) { present[c.group_id] = 1; });
    var cats = groups.filter(function (g) { return present[g.id]; });
    var catIndex = {}; cats.forEach(function (g, i) { catIndex[g.id] = i; });

    function size(c) {
      return c.group_role === 'group-holdco' ? 34 : (c.group_role === 'flagship-listco' ? 24 : 17);
    }
    var nodes = members.map(function (c) {
      return { id: c.id, name: label(c), category: catIndex[c.group_id], symbolSize: size(c), _cid: c.id };
    });
    var links = [];
    members.forEach(function (c) {
      if (c.parent_id && idset[c.parent_id] && c.parent_id !== c.id) links.push({ source: c.parent_id, target: c.id });
    });

    var textc = cssVar('--text', '#e5e7eb'), faint = cssVar('--text-faint', '#94a3b8');
    var option = {
      tooltip: {
        confine: true,
        formatter: function (p) {
          if (p.dataType !== 'node') return '';
          var c = (opts.getCompany && opts.getCompany(p.data._cid)) || {};
          var g = (opts.getGroup && opts.getGroup(c.group_id)) || {};
          var pc = c.parent_id && opts.getCompany ? opts.getCompany(c.parent_id) : null;
          return '<b>' + p.name + '</b><br>' + (isEn ? (g.name_en || '') : (g.name_zh || '')) +
            (c.group_role ? '<br><span style="opacity:.7">' + groupRoleLabel(c.group_role) + '</span>' : '') +
            (pc ? '<br>↑ ' + (isEn ? (pc.name_en || pc.id) : (pc.name_zh || pc.id)) : '');
        }
      },
      legend: [{ data: cats.map(gname), textStyle: { color: faint }, type: 'scroll', top: 0, icon: 'circle' }],
      series: [{
        type: 'graph', layout: 'force', roam: graphInteractive(el), draggable: graphInteractive(el), zoom: 1.1,
        categories: cats.map(function (g, i) { return { name: gname(g), itemStyle: { color: PALETTE[i % PALETTE.length] } }; }),
        force: { repulsion: filter ? 220 : 110, edgeLength: [40, 130], gravity: 0.07, friction: 0.2 },
        label: { show: true, position: 'right', color: textc, fontSize: 10, formatter: '{b}' },
        edgeSymbol: ['none', 'arrow'], edgeSymbolSize: 7,
        lineStyle: { color: 'source', curveness: 0.15, opacity: 0.55, width: 1.4 },
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
    return inst;
  }

  window.addEventListener('resize', function () { if (bound) bound.resize(); });
  window.GROUPS_GRAPH = { render: render };
})();
