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

  function renderClusterGraph(cities, relations, clusters, getCluster) {
    var c = inst('cluster-graph'); if (!c) return;
    var cityIds = {};
    cities.forEach(function (x) { cityIds[x.id] = 1; });
    var edges = relations.filter(function (r) {
      return r.relation_type === 'cluster_adjacent' && cityIds[r.from_id] && cityIds[r.to_id];
    });
    var seen = {};
    edges = edges.filter(function (r) {
      var a = r.from_id < r.to_id ? r.from_id + '|' + r.to_id : r.to_id + '|' + r.from_id;
      if (seen[a]) return false;
      seen[a] = 1;
      return true;
    });
    if (!cities.length) return empty('cluster-graph');
    var pal = palette();
    var clusterColor = {};
    clusters.forEach(function (cl, i) { clusterColor[cl.id] = pal[i % pal.length]; });

    var nodes = cities.map(function (city) {
      var cid = (city.cluster_ids || [])[0];
      var cl = cid && getCluster ? getCluster(cid) : null;
      return {
        id: city.id, name: I18N.name(city), symbolSize: city.tier === 'core' ? 28 : 20,
        itemStyle: { color: clusterColor[cid] || pal[0] },
        label: { show: true, fontSize: 10, color: cssVar('--text') },
        _cluster: cl ? I18N.name(cl) : ''
      };
    });
    var links = edges.map(function (r) {
      return {
        source: r.from_id, target: r.to_id,
        lineStyle: {
          color: r.relation_type === 'belongs_to_cluster' ? cssVar('--chart-1') : cssVar('--chart-3'),
          width: r.relation_type === 'belongs_to_cluster' ? 2 : 1,
          type: r.relation_type === 'cluster_adjacent' ? 'dashed' : 'solid'
        }
      };
    });
    c.setOption({
      textStyle: baseText(), tooltip: tooltip({
        formatter: function (p) {
          if (p.dataType === 'edge') return '';
          return '<b>' + (p.data.name || '') + '</b>' + (p.data._cluster ? '<br/>' + p.data._cluster : '');
        }
      }),
      series: [{
        type: 'graph', layout: 'force', data: nodes, links: links, roam: true, draggable: true,
        force: { repulsion: 120, edgeLength: [60, 140], gravity: 0.08 },
        lineStyle: { opacity: 0.65, curveness: 0.12 },
        emphasis: { focus: 'adjacency' }
      }]
    });
    c.off('click');
    c.on('click', function (p) {
      if (p.data && p.data.id && window.CHINA_AUTO_APP) window.CHINA_AUTO_APP.openCityModal(p.data.id);
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
