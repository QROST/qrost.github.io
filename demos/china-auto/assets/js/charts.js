/* ECharts — overview bar + cluster graph. window.CHINA_AUTO_CHARTS */
(function () {
  'use strict';
  var I18N = window.CHINA_AUTO_I18N;
  var instances = {};
  var clusterGraphCache = { key: '' };

  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function palette() {
    return [
      cssVar('--chart-1'), cssVar('--chart-2'), cssVar('--chart-3'), cssVar('--chart-4'),
      cssVar('--chart-5'), cssVar('--chart-6'), cssVar('--chart-7'), cssVar('--chart-8'),
      '#0ea5e9', '#84cc16', '#f97316', '#14b8a6', '#a855f7'
    ];
  }
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
  function graphChart(rebuild) {
    var el = document.getElementById('cluster-graph');
    if (!el || !window.echarts) return null;
    if (rebuild && instances['cluster-graph']) {
      try { instances['cluster-graph'].dispose(); } catch (e) {}
      instances['cluster-graph'] = null;
    }
    if (!instances['cluster-graph']) {
      instances['cluster-graph'] = window.echarts.init(el, null, { renderer: 'canvas' });
    }
    return instances['cluster-graph'];
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

  function renderOverview(cities, getStat) {
    var c = inst('overview-chart'); if (!c) return;
    var rows = cities.map(function (city) {
      var st = getStat(city.id);
      return { name: I18N.name(city), val: st && st.total_vehicle_output != null ? st.total_vehicle_output / 10000 : 0 };
    }).filter(function (r) { return r.val > 0; });
    rows.sort(function (a, b) { return b.val - a.val; });
    if (!rows.length) return empty('overview-chart');
    var top = rows.slice(0, 15);
    c.setOption({
      textStyle: baseText(), tooltip: tooltip({ trigger: 'axis', axisPointer: { type: 'shadow' } }),
      grid: { left: 100, right: 24, top: 16, bottom: 24 },
      xAxis: { type: 'value', axisLine: { lineStyle: { color: gridColor() } }, splitLine: { lineStyle: { color: gridColor() } }, axisLabel: { color: faintColor() } },
      yAxis: { type: 'category', inverse: true, data: top.map(function (r) { return r.name; }), axisLine: { lineStyle: { color: gridColor() } }, axisLabel: { color: textColor() } },
      series: [{ type: 'bar', data: top.map(function (r) { return +r.val.toFixed(2); }), itemStyle: { color: cssVar('--chart-1') }, barWidth: '60%' }]
    });
  }

  var SUPPLY_TYPES = { battery_company: 1, supplier: 1, software_company: 1, chip_company: 1 };
  var GRAPH_REL = {
    cluster_adjacent: 1, owns: 1,
    historically_linked_to: 1, researches_with: 1, located_in: 1
  };

  function fmtWan(val) {
    if (val == null) return '—';
    return (val / 10000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  }
  function truncLabel(n) {
    n = n || '';
    return n.length > 8 ? n.slice(0, 8) + '…' : n;
  }
  function citySymbolSize(city, getStat) {
    var st = getStat ? getStat(city.id) : null;
    var v = st && st.total_vehicle_output != null ? st.total_vehicle_output / 10000 : 0;
    var floor = city.tier === 'core' ? 22 : 16;
    return Math.max(floor, Math.min(46, 14 + Math.sqrt(Math.max(v, 0)) * 2.1));
  }
  function relStyle(type) {
    var s;
    if (type === 'cluster_adjacent') s = { color: cssVar('--chart-3'), width: 1.4, type: 'dashed', opacity: 0.75 };
    else if (type === 'owns') s = { color: cssVar('--chart-1'), width: 1.6, type: 'solid', opacity: 0.8 };
    else if (type === 'historically_linked_to') s = { color: cssVar('--chart-5'), width: 1.2, type: 'dashed', opacity: 0.7 };
    else if (type === 'researches_with') s = { color: cssVar('--chart-6'), width: 1.3, type: 'solid', opacity: 0.75 };
    else if (type === 'headquarters') s = { color: faintColor(), width: 1, type: 'solid', opacity: 0.4 };
    else if (type === 'factory') s = { color: cssVar('--chart-4'), width: 1, type: 'dotted', opacity: 0.5 };
    else s = { color: cssVar('--chart-3'), width: 1, type: 'solid', opacity: 0.5 };
    s._baseOpacity = s.opacity;
    return s;
  }

  function renderClusterGraph(opts) {
    opts = opts || {};
    var cities = opts.cities || [];
    var relations = opts.relations || [];
    var clusters = opts.clusters || [];
    var selectedId = opts.selectedClusterId || '';
    var layers = opts.layers || {};
    var getCluster = opts.getCluster;
    var getStat = opts.getStat;
    var getOrg = opts.getOrg;
    var getFacility = opts.getFacility;
    var orgsForCity = opts.orgsForCity || function () { return []; };
    var facilitiesForCity = opts.facilitiesForCity || function () { return []; };
    var mediaForCity = opts.mediaForCity || function () { return []; };
    var institutionsForCity = opts.institutionsForCity || function () { return []; };
    var childrenOf = opts.childrenOf || function () { return []; };
    var getCity = opts.getCity;
    var pal = palette();
    var clusterColor = {};
    clusters.forEach(function (cl, i) { clusterColor[cl.id] = pal[i % pal.length]; });

    var vis = cities;
    if (!vis.length) return empty('cluster-graph');

    var cityIds = {};
    vis.forEach(function (x) { cityIds[x.id] = 1; });
    var nodeIds = {};
    var nodes = [];
    var links = [];
    var seenLink = {};

    function addNode(n) {
      if (!n.id || nodeIds[n.id]) return;
      nodeIds[n.id] = 1;
      nodes.push(n);
    }
    function addLink(l) {
      if (!nodeIds[l.source] || !nodeIds[l.target] || l.source === l.target) return;
      var k = l.source + '>' + l.target + '>' + (l._rel || '');
      if (seenLink[k]) return;
      seenLink[k] = 1;
      links.push(l);
    }
    function endpointName(id) {
      if (id.indexOf('org:') === 0) {
        var o = getOrg ? getOrg(id.slice(4)) : null;
        return o ? I18N.name(o) : id.slice(4);
      }
      if (id.indexOf('fac:') === 0) {
        var f = getFacility ? getFacility(id.slice(4)) : null;
        return f ? I18N.name(f) : id.slice(4);
      }
      var city = vis.filter(function (x) { return x.id === id; })[0];
      return city ? I18N.name(city) : id;
    }
    function clusterIdsForCity(city) {
      if (!city) return [];
      var ids = (city.cluster_ids || []).slice();
      clusters.forEach(function (cl) {
        if ((cl.city_ids || []).indexOf(city.id) !== -1 && ids.indexOf(cl.id) === -1) ids.push(cl.id);
      });
      return ids;
    }
    function clusterStyle(ids) {
      var style = { color: clusterColor[ids[0]] || pal[0] };
      if (ids[1] && clusterColor[ids[1]]) {
        style.borderColor = clusterColor[ids[1]];
        style.borderWidth = 3;
      }
      return style;
    }
    function clusterNames(ids) {
      return ids.map(function (cid) {
        var cl = getCluster ? getCluster(cid) : null;
        return cl ? I18N.name(cl) : cid;
      }).filter(Boolean);
    }
    function orgVisual(o) {
      var t = o.organization_type;
      if (t === 'brand') return { symbol: 'roundRect', size: 11, font: 8 };
      if (t === 'automaker' && o.parent_id) return { symbol: 'rect', size: 14, font: 9 };
      if (t === 'automaker') return { symbol: 'rect', size: 17, font: 9 };
      return { symbol: 'triangle', size: 12, font: 8 };
    }
    function orgTip(o) {
      var extra = [];
      var en = o.enrich || {};
      extra.push(I18N.enumLabel('organization_type', o.organization_type));
      if (en.ownership) extra.push(I18N.enumLabel('ownership', en.ownership));
      if (en.segment) extra.push(I18N.enumLabel('segment', en.segment));
      if (o.parent_id && getOrg) {
        var p = getOrg(o.parent_id);
        if (p) extra.push(I18N.t('parentBrand') + ': ' + I18N.name(p));
      }
      var kids = (childrenOf(o.id) || []).filter(function (c) { return c.organization_type === 'brand'; });
      if (kids.length) {
        extra.push(I18N.t('childBrands') + ': ' + kids.slice(0, 6).map(function (c) { return I18N.name(c); }).join(I18N.isEn() ? ', ' : '、') +
          (kids.length > 6 ? '…' : ''));
      }
      if (o.headquarters_city_id && getCity) {
        var hc = getCity(o.headquarters_city_id);
        if (hc) extra.push(I18N.t('hqCity') + ': ' + I18N.name(hc));
        var cn = clusterNames(clusterIdsForCity(hc));
        if (cn.length) extra.push(cn.join(' · '));
      }
      return '<b>' + I18N.name(o) + '</b><br/>' + extra.join('<br/>');
    }
    function addOrg(o, attachCityId) {
      if (!o) return;
      var visn = orgVisual(o);
      var hq = getCity ? getCity(o.headquarters_city_id) : null;
      var ids = clusterIdsForCity(hq);
      addNode({
        id: 'org:' + o.id, name: I18N.name(o), symbol: visn.symbol, symbolSize: visn.size,
        itemStyle: clusterStyle(ids),
        label: { show: true, fontSize: visn.font, color: cssVar('--text'), formatter: function (p) { return truncLabel(p.name); } },
        _kind: 'org', _rawId: o.id, _clusterIds: ids, _tip: orgTip(o)
      });
      if (attachCityId && nodeIds[attachCityId]) {
        addLink({
          source: attachCityId, target: 'org:' + o.id, _rel: 'headquarters',
          lineStyle: relStyle('headquarters'),
          _tip: I18N.enumLabel('role_type', 'headquarters') + '<br/>' + I18N.name(o) + ' · ' + endpointName(attachCityId)
        });
      }
    }
    function hqCityId(o) {
      return o && cityIds[o.headquarters_city_id] ? o.headquarters_city_id : '';
    }

    vis.forEach(function (city) {
      var ids = clusterIdsForCity(city);
      var names = clusterNames(ids);
      var st = getStat ? getStat(city.id) : null;
      var inCity = (orgsForCity(city.id) || []).filter(function (o) { return o.headquarters_city_id === city.id; });
      var oemN = inCity.filter(function (o) { return o.organization_type === 'automaker'; }).length;
      var brandN = inCity.filter(function (o) { return o.organization_type === 'brand'; }).length;
      var plantN = (facilitiesForCity(city.id) || []).length;
      var mediaN = (mediaForCity(city.id) || []).length;
      var uniN = (institutionsForCity(city.id) || []).length;
      var tip = [
        '<b>' + I18N.name(city) + '</b>',
        names.length ? names.join(' · ') : '',
        I18N.t('output2025') + ': ' + fmtWan(st && st.total_vehicle_output) + (st && st.total_vehicle_output != null ? ' ' + I18N.t('wanVehicles') : ''),
        I18N.t('countHq') + ' ' + oemN + ' · ' + I18N.t('countBrands') + ' ' + brandN +
          ' · ' + I18N.t('countPlants') + ' ' + plantN +
          ' · ' + I18N.t('countMedia') + ' ' + mediaN + ' · ' + I18N.t('countUnis') + ' ' + uniN
      ].filter(Boolean).join('<br/>');
      addNode({
        id: city.id, name: I18N.name(city), symbol: 'circle',
        symbolSize: citySymbolSize(city, getStat),
        itemStyle: clusterStyle(ids),
        label: { show: true, fontSize: 10, color: cssVar('--text'), formatter: function (p) { return truncLabel(p.name); } },
        _kind: 'city', _rawId: city.id, _clusterIds: ids, _tip: tip
      });
    });

    if (layers.hq) {
      vis.forEach(function (city) {
        var list = (orgsForCity(city.id) || []).filter(function (o) {
          return o.headquarters_city_id === city.id;
        });
        var oems = list.filter(function (o) { return o.organization_type === 'automaker' && !o.parent_id; });
        var jvs = list.filter(function (o) { return o.organization_type === 'automaker' && o.parent_id; }).slice(0, 4);
        var supply = list.filter(function (o) { return SUPPLY_TYPES[o.organization_type]; }).slice(0, 3);
        oems.concat(jvs, supply).forEach(function (o) { addOrg(o, city.id); });
      });
    }
    if (layers.brands) {
      vis.forEach(function (city) {
        (orgsForCity(city.id) || []).filter(function (o) {
          return o.headquarters_city_id === city.id && o.organization_type === 'brand';
        }).slice(0, 8).forEach(function (o) { addOrg(o, city.id); });
      });
      var guard = 0, grew = true;
      while (grew && guard++ < 3) {
        grew = false;
        Object.keys(nodeIds).forEach(function (nid) {
          if (nid.indexOf('org:') !== 0 || !getOrg) return;
          var o = getOrg(nid.slice(4));
          if (!o) return;
          if (o.organization_type === 'automaker') {
            (childrenOf(o.id) || []).filter(function (c) { return c.organization_type === 'brand'; })
              .slice(0, 6).forEach(function (child) {
                if (!cityIds[child.headquarters_city_id] && !nodeIds['org:' + child.id]) return;
                if (nodeIds['org:' + child.id]) return;
                addOrg(child, hqCityId(child));
                grew = true;
              });
          }
          if (o.parent_id) {
            var p = getOrg(o.parent_id);
            if (!p || (p.organization_type !== 'automaker' && p.organization_type !== 'brand')) return;
            if (nodeIds['org:' + p.id]) return;
            addOrg(p, hqCityId(p));
            grew = true;
          }
        });
      }
    }
    if (layers.plants) {
      vis.forEach(function (city) {
        (facilitiesForCity(city.id) || []).slice(0, 8).forEach(function (f) {
          addNode({
            id: 'fac:' + f.id, name: I18N.name(f), symbol: 'diamond',
            symbolSize: 12,
            itemStyle: clusterStyle(clusterIdsForCity(city)),
            label: { show: true, fontSize: 9, color: cssVar('--text'), formatter: function (p) { return truncLabel(p.name); } },
            _kind: 'facility', _rawId: f.id, _clusterIds: clusterIdsForCity(city),
            _tip: '<b>' + I18N.name(f) + '</b><br/>' + I18N.enumLabel('facility_type', f.facility_type) +
              (f.operator_id && getOrg && getOrg(f.operator_id) ? '<br/>' + I18N.t('operator') + ': ' + I18N.name(getOrg(f.operator_id)) : '')
          });
          addLink({
            source: city.id, target: 'fac:' + f.id, _rel: 'factory',
            lineStyle: relStyle('factory'),
            _tip: I18N.enumLabel('role_type', 'factory') + '<br/>' + I18N.name(f) + ' · ' + I18N.name(city)
          });
          if (f.operator_id && nodeIds['org:' + f.operator_id]) {
            addLink({
              source: 'org:' + f.operator_id, target: 'fac:' + f.id, _rel: 'operates',
              lineStyle: relStyle('located_in'),
              _tip: I18N.enumLabel('relation_type', 'operates') + '<br/>' + endpointName('org:' + f.operator_id) + ' → ' + I18N.name(f)
            });
          }
        });
      });
    }

    var seenUndirected = {};
    relations.forEach(function (r) {
      if (!GRAPH_REL[r.relation_type]) return;
      var a = r.from_id, b = r.to_id;
      var sa = nodeIds[a] ? a : (nodeIds['org:' + a] ? 'org:' + a : '');
      var sb = nodeIds[b] ? b : (nodeIds['org:' + b] ? 'org:' + b : '');
      if (!sa || !sb) return;
      if (r.relation_type === 'cluster_adjacent' || r.relation_type === 'historically_linked_to' || r.relation_type === 'owns') {
        var k = sa < sb ? sa + '|' + sb + '|' + r.relation_type : sb + '|' + sa + '|' + r.relation_type;
        if (seenUndirected[k]) return;
        seenUndirected[k] = 1;
      }
      var desc = I18N.pick(r.description_zh, r.description_en);
      addLink({
        source: sa, target: sb, _rel: r.relation_type,
        lineStyle: relStyle(r.relation_type),
        _tip: I18N.enumLabel('relation_type', r.relation_type) + '<br/>' + endpointName(sa) + ' — ' + endpointName(sb) +
          (desc ? '<br/>' + desc : '')
      });
    });

    var head = document.getElementById('cluster-graph-head');
    if (head) {
      var selCl = selectedId && getCluster ? getCluster(selectedId) : null;
      head.textContent = selCl
        ? I18N.t('clusterFocusing') + ' · ' + I18N.name(selCl)
        : I18N.t('clusterGraphHint');
    }
    var leg = document.getElementById('cluster-legend');
    if (leg) {
      var kindItems = [
        ['circle', faintColor(), I18N.t('graphCity')],
        ['rect', faintColor(), I18N.t('graphHq')],
        ['rect', faintColor(), I18N.t('graphBrand')],
        ['diamond', faintColor(), I18N.t('graphPlant')]
      ];
      var kinds = kindItems.map(function (it) {
        return '<span><span class="dot" style="background:' + it[1] + ';border-radius:' + (it[0] === 'circle' ? '50%' : '2px') + '"></span>' + it[2] + '</span>';
      }).join('');
      var clItems = clusters.map(function (cl) {
        return '<button type="button" class="legend-cluster' + (cl.id === selectedId ? ' is-on' : '') +
          '" data-cluster="' + cl.id + '" aria-pressed="' + (cl.id === selectedId ? 'true' : 'false') + '">' +
          '<span class="dot" style="background:' + (clusterColor[cl.id] || pal[0]) + '"></span>' + I18N.name(cl) + '</button>';
      }).join('');
      leg.innerHTML = kinds + (clItems ? '<span class="legend-sep" aria-hidden="true"></span>' + clItems : '');
    }

    nodes.forEach(function (n) {
      var ids = n._clusterIds || [];
      var hit = !selectedId || ids.indexOf(selectedId) !== -1;
      n.itemStyle = n.itemStyle || {};
      n.label = n.label || {};
      n.label.show = true;
      n.itemStyle.opacity = 1;
      if (selectedId && hit) {
        n.itemStyle.borderWidth = Math.max(n.itemStyle.borderWidth || 0, 2);
        n.itemStyle.shadowBlur = 10;
        n.itemStyle.shadowColor = n.itemStyle.color;
      }
    });
    links.forEach(function (l) {
      l.lineStyle = l.lineStyle || {};
      l.lineStyle.opacity = l.lineStyle._baseOpacity != null ? l.lineStyle._baseOpacity : 0.65;
    });

    var key = (layers.hq ? '1' : '0') + (layers.brands ? '1' : '0') + (layers.plants ? '1' : '0') +
      (I18N.isEn() ? 'e' : 'z') + (document.documentElement.classList.contains('dark') ? 'd' : 'l');
    var rebuild = clusterGraphCache.key !== key || !instances['cluster-graph'];
    var c = graphChart(rebuild);
    if (!c) return;
    if (!rebuild) {
      var prev = ((c.getOption().series || [])[0] || {}).data || [];
      var pos = {};
      prev.forEach(function (n) {
        if (n && n.id != null && n.x != null) pos[n.id] = { x: n.x, y: n.y };
      });
      nodes.forEach(function (n) {
        if (pos[n.id]) { n.x = pos[n.id].x; n.y = pos[n.id].y; }
      });
    }
    clusterGraphCache.key = key;
    c.setOption({
      textStyle: baseText(), tooltip: tooltip({
        formatter: function (p) {
          if (p.dataType === 'edge') return p.data && p.data._tip ? p.data._tip : '';
          return (p.data && p.data._tip) || (p.data && p.data.name) || '';
        }
      }),
      series: [{
        type: 'graph', layout: rebuild ? 'force' : 'none',
        data: nodes, links: links, roam: true, draggable: true,
        force: { repulsion: layers.brands ? 180 : 150, edgeLength: [36, 100], gravity: 0.045 },
        lineStyle: { opacity: 0.7, curveness: 0.1 },
        emphasis: { focus: 'adjacency' }
      }]
    }, rebuild);
    c.off('click');
    c.on('click', function (p) {
      var app = window.CHINA_AUTO_APP;
      if (!app) return;
      if (p.dataType === 'edge') return;
      if (!p.data) {
        if (selectedId && app.selectCluster) app.selectCluster('', { toggle: false });
        return;
      }
      var kind = p.data._kind, id = p.data._rawId;
      if (kind === 'city') app.openCityModal(id);
      else if (kind === 'org' && app.openOrgModal) app.openOrgModal(id);
      else if (kind === 'facility') {
        var fac = getFacility ? getFacility(id) : null;
        if (fac && fac.city_id) app.openCityModal(fac.city_id);
      }
    });
  }

  function resizeAll() { Object.keys(instances).forEach(function (k) { try { instances[k].resize(); } catch (e) {} }); }
  function setTheme() {
    /* re-init on theme change handled by app re-calling render* */
  }
  window.addEventListener('resize', resizeAll);

  window.CHINA_AUTO_CHARTS = {
    renderOverview: renderOverview,
    renderClusterGraph: renderClusterGraph,
    resizeAll: resizeAll,
    setTheme: setTheme
  };
})();
