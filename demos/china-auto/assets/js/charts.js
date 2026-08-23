/* ECharts — overview bar + cluster graph. window.CHINA_AUTO_CHARTS */
(function () {
  'use strict';
  var I18N = window.CHINA_AUTO_I18N;
  var instances = {};

  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function palette() { return [1, 2, 3, 4, 5, 6, 7, 8].map(function (i) { return cssVar('--chart-' + i); }); }
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

  var HQ_TYPES = {
    automaker: 1, brand: 1, battery_company: 1, supplier: 1,
    software_company: 1, chip_company: 1
  };
  var GRAPH_REL = {
    cluster_adjacent: 1, belongs_to_cluster: 1, owns: 1,
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
  function orgColor(type, pal) {
    var idx = { automaker: 0, brand: 1, battery_company: 2, supplier: 3, software_company: 4, chip_company: 5 };
    return pal[(idx[type] != null ? idx[type] : 6) % pal.length];
  }
  function relStyle(type) {
    if (type === 'cluster_adjacent') return { color: cssVar('--chart-3'), width: 1.4, type: 'dashed', opacity: 0.75 };
    if (type === 'belongs_to_cluster') return { color: faintColor(), width: 1.1, type: 'solid', opacity: 0.55 };
    if (type === 'owns') return { color: cssVar('--chart-1'), width: 1.6, type: 'solid', opacity: 0.8 };
    if (type === 'historically_linked_to') return { color: cssVar('--chart-5'), width: 1.2, type: 'dashed', opacity: 0.7 };
    if (type === 'researches_with') return { color: cssVar('--chart-6'), width: 1.3, type: 'solid', opacity: 0.75 };
    if (type === 'headquarters') return { color: faintColor(), width: 1, type: 'solid', opacity: 0.45 };
    if (type === 'factory') return { color: cssVar('--chart-4'), width: 1, type: 'dotted', opacity: 0.55 };
    return { color: cssVar('--chart-3'), width: 1, type: 'solid', opacity: 0.5 };
  }

  function renderClusterGraph(opts) {
    opts = opts || {};
    var c = inst('cluster-graph'); if (!c) return;
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
    var pal = palette();
    var clusterColor = {};
    clusters.forEach(function (cl, i) { clusterColor[cl.id] = pal[i % pal.length]; });

    var vis = cities;
    if (selectedId) {
      var sel = getCluster ? getCluster(selectedId) : null;
      var allow = {};
      ((sel && sel.city_ids) || []).forEach(function (id) { allow[id] = 1; });
      vis = cities.filter(function (city) {
        return allow[city.id] || (city.cluster_ids || []).indexOf(selectedId) !== -1;
      });
      if (!vis.length) vis = cities;
    }
    if (!vis.length) return empty('cluster-graph');

    var cityIds = {};
    vis.forEach(function (x) { cityIds[x.id] = 1; });
    var nodeIds = {};
    var nodes = [];
    var links = [];
    var seenLink = {};
    var deep = !!selectedId;

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
      if (id.indexOf('cl:') === 0) {
        var cl = getCluster ? getCluster(id.slice(3)) : null;
        return cl ? I18N.name(cl) : id.slice(3);
      }
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

    vis.forEach(function (city) {
      var ids = city.cluster_ids || [];
      var primary = ids[0];
      var names = ids.map(function (cid) {
        var cl = getCluster ? getCluster(cid) : null;
        return cl ? I18N.name(cl) : cid;
      }).filter(Boolean);
      var st = getStat ? getStat(city.id) : null;
      var hqN = (orgsForCity(city.id) || []).filter(function (o) {
        return o.headquarters_city_id === city.id && HQ_TYPES[o.organization_type];
      }).length;
      var plantN = (facilitiesForCity(city.id) || []).length;
      var mediaN = (mediaForCity(city.id) || []).length;
      var uniN = (institutionsForCity(city.id) || []).length;
      var tip = [
        '<b>' + I18N.name(city) + '</b>',
        names.length ? names.join(' · ') : '',
        I18N.t('output2025') + ': ' + fmtWan(st && st.total_vehicle_output) + (st && st.total_vehicle_output != null ? ' ' + I18N.t('wanVehicles') : ''),
        I18N.t('countHq') + ' ' + hqN + ' · ' + I18N.t('countPlants') + ' ' + plantN +
          ' · ' + I18N.t('countMedia') + ' ' + mediaN + ' · ' + I18N.t('countUnis') + ' ' + uniN
      ].filter(Boolean).join('<br/>');
      var style = { color: clusterColor[primary] || pal[0] };
      if (ids[1] && clusterColor[ids[1]]) {
        style.borderColor = clusterColor[ids[1]];
        style.borderWidth = 3;
      }
      addNode({
        id: city.id, name: I18N.name(city), symbol: 'circle',
        symbolSize: citySymbolSize(city, getStat),
        itemStyle: style,
        label: { show: true, fontSize: 10, color: cssVar('--text'), formatter: function (p) { return truncLabel(p.name); } },
        _kind: 'city', _rawId: city.id, _tip: tip
      });
    });

    var hubs = selectedId
      ? clusters.filter(function (cl) { return cl.id === selectedId; })
      : clusters;
    hubs.forEach(function (cl) {
      var nCities = (cl.city_ids || []).filter(function (id) { return cityIds[id]; }).length;
      addNode({
        id: 'cl:' + cl.id, name: I18N.name(cl), symbol: 'roundRect',
        symbolSize: [Math.max(28, Math.min(52, 18 + nCities * 3)), 22],
        itemStyle: { color: clusterColor[cl.id] || pal[0], borderRadius: 6 },
        label: { show: true, fontSize: 10, color: cssVar('--text'), formatter: function (p) { return truncLabel(p.name); } },
        _kind: 'cluster', _rawId: cl.id,
        _tip: '<b>' + I18N.name(cl) + '</b><br/>' + I18N.t('citiesInCluster') + ': ' + nCities +
          (I18N.pick(cl.output_note_zh, cl.output_note_en) ? '<br/>' + I18N.pick(cl.output_note_zh, cl.output_note_en) : '')
      });
      (cl.city_ids || []).forEach(function (cid) {
        addLink({
          source: cid, target: 'cl:' + cl.id, _rel: 'belongs_to_cluster',
          lineStyle: relStyle('belongs_to_cluster'),
          _tip: I18N.enumLabel('relation_type', 'belongs_to_cluster') + '<br/>' + endpointName(cid) + ' → ' + I18N.name(cl)
        });
      });
    });
    relations.forEach(function (r) {
      if (r.relation_type !== 'belongs_to_cluster') return;
      var hub = 'cl:' + r.to_id;
      if (!nodeIds[hub] || !nodeIds[r.from_id]) return;
      addLink({
        source: r.from_id, target: hub, _rel: 'belongs_to_cluster',
        lineStyle: relStyle('belongs_to_cluster'),
        _tip: I18N.enumLabel('relation_type', 'belongs_to_cluster') + '<br/>' + endpointName(r.from_id) + ' → ' + endpointName(hub)
      });
    });

    if (deep && layers.hq) {
      vis.forEach(function (city) {
        var list = (orgsForCity(city.id) || []).filter(function (o) {
          return o.headquarters_city_id === city.id && HQ_TYPES[o.organization_type];
        });
        list.sort(function (a, b) { return (a.organization_type || '').localeCompare(b.organization_type || ''); });
        list.slice(0, 10).forEach(function (o) {
          var en = o.enrich || {};
          var extra = [];
          if (en.ownership) extra.push(I18N.enumLabel('ownership', en.ownership));
          if (o.parent_id && getOrg) {
            var p = getOrg(o.parent_id);
            if (p) extra.push(I18N.t('parentBrand') + ': ' + I18N.name(p));
          }
          addNode({
            id: 'org:' + o.id, name: I18N.name(o), symbol: 'rect',
            symbolSize: 14,
            itemStyle: { color: orgColor(o.organization_type, pal) },
            label: { show: true, fontSize: 9, color: cssVar('--text'), formatter: function (p) { return truncLabel(p.name); } },
            _kind: 'org', _rawId: o.id,
            _tip: '<b>' + I18N.name(o) + '</b><br/>' + I18N.enumLabel('organization_type', o.organization_type) +
              (extra.length ? '<br/>' + extra.join(' · ') : '')
          });
          addLink({
            source: city.id, target: 'org:' + o.id, _rel: 'headquarters',
            lineStyle: relStyle('headquarters'),
            _tip: I18N.enumLabel('role_type', 'headquarters') + '<br/>' + I18N.name(o) + ' · ' + I18N.name(city)
          });
        });
      });
    }
    if (deep && layers.plants) {
      vis.forEach(function (city) {
        (facilitiesForCity(city.id) || []).slice(0, 8).forEach(function (f) {
          addNode({
            id: 'fac:' + f.id, name: I18N.name(f), symbol: 'diamond',
            symbolSize: 12,
            itemStyle: { color: cssVar('--chart-4') },
            label: { show: true, fontSize: 9, color: cssVar('--text'), formatter: function (p) { return truncLabel(p.name); } },
            _kind: 'facility', _rawId: f.id,
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
      if (r.relation_type === 'belongs_to_cluster') return;
      var a = r.from_id, b = r.to_id;
      var sa = nodeIds[a] ? a : (nodeIds['org:' + a] ? 'org:' + a : (nodeIds['cl:' + a] ? 'cl:' + a : ''));
      var sb = nodeIds[b] ? b : (nodeIds['org:' + b] ? 'org:' + b : (nodeIds['cl:' + b] ? 'cl:' + b : ''));
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
        ? I18N.name(selCl) + ' · ' + vis.length + ' ' + I18N.t('kpiCities')
        : I18N.t('clusterAll') + ' · ' + vis.length + ' ' + I18N.t('kpiCities');
    }
    var leg = document.getElementById('cluster-legend');
    if (leg) {
      var kindItems = [
        ['circle', cssVar('--chart-1'), I18N.t('graphCity')],
        ['rect', cssVar('--chart-2'), I18N.t('graphCluster')],
        ['rect', pal[0], I18N.t('graphHq')],
        ['diamond', cssVar('--chart-4'), I18N.t('graphPlant')]
      ];
      var kinds = kindItems.map(function (it) {
        return '<span><span class="dot" style="background:' + it[1] + ';border-radius:' + (it[0] === 'circle' ? '50%' : '2px') + '"></span>' + it[2] + '</span>';
      }).join('');
      var clItems = (selectedId ? hubs : clusters).map(function (cl) {
        return '<span><span class="dot" style="background:' + (clusterColor[cl.id] || pal[0]) + '"></span>' + I18N.name(cl) + '</span>';
      }).join('');
      leg.innerHTML = kinds + (clItems ? '<span class="legend-sep" aria-hidden="true"></span>' + clItems : '');
    }

    c.setOption({
      textStyle: baseText(), tooltip: tooltip({
        formatter: function (p) {
          if (p.dataType === 'edge') return p.data && p.data._tip ? p.data._tip : '';
          return (p.data && p.data._tip) || (p.data && p.data.name) || '';
        }
      }),
      series: [{
        type: 'graph', layout: 'force', data: nodes, links: links, roam: true, draggable: true,
        force: {
          repulsion: deep ? 140 : 210,
          edgeLength: deep ? [46, 120] : [70, 170],
          gravity: deep ? 0.06 : 0.05
        },
        lineStyle: { opacity: 0.7, curveness: 0.1 },
        emphasis: { focus: 'adjacency' }
      }]
    });
    c.off('click');
    c.on('click', function (p) {
      if (!p.data || p.dataType === 'edge') return;
      var kind = p.data._kind, id = p.data._rawId;
      var app = window.CHINA_AUTO_APP;
      if (!app) return;
      if (kind === 'city') app.openCityModal(id);
      else if (kind === 'org' && app.openOrgModal) app.openOrgModal(id);
      else if (kind === 'facility') {
        var f = getFacility ? getFacility(id) : null;
        if (f && f.city_id) app.openCityModal(f.city_id);
      } else if (kind === 'cluster' && app.selectCluster) app.selectCluster(id, { toggle: true });
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
