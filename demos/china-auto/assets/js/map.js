/* China geo map — cities & facilities scatter. window.CHINA_AUTO_MAP */
(function () {
  'use strict';
  var I18N = window.CHINA_AUTO_I18N;
  var chart = null, registered = false, onClickCb = null, lastOpts = null;
  var CLUSTER_PAL = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6', '--chart-7', '--chart-8'];

  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function catColor(i, pal) { return i < pal.length ? pal[i] : 'hsl(' + Math.round((i * 137.508) % 360) + ',58%,52%)'; }

  function ensure() {
    if (!window.echarts || !window.CHINA_GEO) return null;
    if (!registered) { window.echarts.registerMap('china', window.CHINA_GEO); registered = true; }
    var el = document.getElementById('china-map');
    if (!el) return null;
    if (!chart) {
      chart = window.echarts.init(el, null, { renderer: 'canvas' });
      chart.on('click', function (p) {
        if (p.data && p.data._id && onClickCb) onClickCb(p.data._id, p.data._kind);
      });
    }
    return chart;
  }

  function outputSize(val) {
    if (val == null || val <= 0) return 10;
    var w = Math.sqrt(val / 10000);
    return Math.max(8, Math.min(36, 6 + w * 2.2));
  }

  function primaryRole(city) {
    var tags = city.role_tags || [];
    return tags.length ? tags[0] : '_none';
  }

  function roleColor(tag) {
    var map = {
      oem_manufacturing: '#0f766e', headquarters: '#6366f1', rd_design: '#0891b2',
      battery: '#22c55e', chips: '#f59e0b', parts: '#64748b', auto_media: '#ec4899'
    };
    return map[tag] || cssVar('--chart-3');
  }

  function buildPoints(opts) {
    var dim = opts.dim || 'output';
    var layer = opts.layer || 'cities';
    var pal = CLUSTER_PAL.map(cssVar);
    var clusterColors = {};
    (opts.clusters || []).forEach(function (cl, i) { clusterColors[cl.id] = catColor(i, pal); });
    var legend = {};
    var points = [];
    var outMin = Infinity, outMax = -Infinity;

    function addPoint(id, kind, lat, lng, label, color, size, extra) {
      if (typeof lat !== 'number' || typeof lng !== 'number') return;
      points.push({
        name: label, value: [lng, lat], symbolSize: size,
        itemStyle: { color: color, borderColor: 'rgba(0,0,0,.22)', borderWidth: 0.5, opacity: 0.92 },
        _id: id, _kind: kind, _extra: extra
      });
    }

    if (layer === 'facilities') {
      (opts.facilities || []).forEach(function (f) {
        var lat = f.lat, lng = f.lng;
        if (lat == null || lng == null) {
          var city = opts.getCity && opts.getCity(f.city_id);
          if (city) { lat = city.lat; lng = city.lng; }
        }
        var color = cssVar('--chart-4');
        if (dim === 'cluster') {
          var city2 = opts.getCity && opts.getCity(f.city_id);
          var cid = city2 && city2.cluster_ids && city2.cluster_ids[0];
          color = clusterColors[cid] || cssVar('--chart-4');
          if (cid) legend[cid] = { label: opts.clusterName ? opts.clusterName(cid) : cid, color: color };
        } else if (dim === 'role') {
          color = roleColor(f.facility_type || '_none');
          legend[f.facility_type] = { label: I18N.enumLabel('facility_type', f.facility_type), color: color };
        } else {
          legend.fac = { label: I18N.t('layerFacilities'), color: color };
        }
        addPoint(f.id, 'facility', lat, lng, I18N.pick(f.name_zh, f.name_en), color, 7, f);
      });
      return { points: points, legend: legend, outMin: 0, outMax: 1 };
    }

    (opts.cities || []).forEach(function (city) {
      var stat = opts.getStat && opts.getStat(city.id);
      var out = stat && stat.total_vehicle_output;
      if (out != null) { outMin = Math.min(outMin, out); outMax = Math.max(outMax, out); }
      var color = cssVar('--accent');
      if (dim === 'output') {
        color = cssVar('--chart-1');
      } else if (dim === 'cluster') {
        var cid = (city.cluster_ids || [])[0];
        color = clusterColors[cid] || cssVar('--text-faint');
        if (cid) legend[cid] = { label: opts.clusterName ? opts.clusterName(cid) : cid, color: color };
      } else {
        var pr = primaryRole(city);
        color = roleColor(pr);
        legend[pr] = { label: pr === '_none' ? '—' : I18N.enumLabel('role_tag', pr), color: color };
      }
      addPoint(city.id, 'city', city.lat, city.lng, I18N.name(city), color, outputSize(out), { city: city, stat: stat });
    });
    if (!isFinite(outMin)) { outMin = 0; outMax = 1; }
    return { points: points, legend: legend, outMin: outMin, outMax: outMax };
  }

  function render(opts) {
    lastOpts = opts;
    var c = ensure();
    if (!c) return;
    onClickCb = opts.onClick || onClickCb;
    var built = buildPoints(opts);
    var points = built.points;
    var dim = opts.dim || 'output';
    var option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item', backgroundColor: cssVar('--bg-surface'), borderColor: cssVar('--border'),
        textStyle: { color: cssVar('--text') }, confine: true,
        formatter: function (p) {
          if (!p.data) return '';
          var ex = p.data._extra;
          if (p.data._kind === 'facility' && ex) {
            return '<b>' + I18N.pick(ex.name_zh, ex.name_en) + '</b><br/>' +
              I18N.enumLabel('facility_type', ex.facility_type);
          }
          if (ex && ex.city) {
            var st = ex.stat;
            var out = st && st.total_vehicle_output != null ? (st.total_vehicle_output / 10000).toFixed(2) : '—';
            return '<b>' + I18N.name(ex.city) + '</b><br/>2025: ' + out + (I18N.isEn() ? ' 10k' : ' 万辆');
          }
          return p.name || '';
        }
      },
      geo: {
        map: 'china', roam: true, scaleLimit: { min: 1, max: 12 },
        itemStyle: { areaColor: cssVar('--map-land'), borderColor: cssVar('--map-border'), borderWidth: 0.6 },
        emphasis: { itemStyle: { areaColor: cssVar('--accent-soft') }, label: { show: false } },
        label: { show: false }, silent: true
      },
      series: [{
        type: 'scatter', coordinateSystem: 'geo', data: points, progressive: 0,
        emphasis: { scale: 1.35 }, z: 5
      }]
    };
    if (dim === 'output' && (opts.layer || 'cities') === 'cities' && points.length) {
      option.visualMap = {
        show: true, min: built.outMin, max: built.outMax, calculable: true, orient: 'horizontal',
        left: 'center', bottom: 8, itemWidth: 14, itemHeight: 80,
        text: [I18N.isEn() ? 'high' : '高', I18N.isEn() ? 'low' : '低'],
        textStyle: { color: cssVar('--text-muted'), fontSize: 10 },
        inRange: { color: [cssVar('--map-land'), cssVar('--chart-1'), cssVar('--accent-strong')] },
        seriesIndex: 0, dimension: 2,
        formatter: function (v) { return (v / 10000).toFixed(2); }
      };
      points.forEach(function (pt, i) {
        var st = pt._extra && pt._extra.stat;
        pt.value[2] = st && st.total_vehicle_output != null ? st.total_vehicle_output : built.outMin;
        points[i] = pt;
      });
      option.series[0].data = points;
    }
    c.setOption(option, true);

    var leg = document.getElementById('map-legend');
    if (leg) {
      if (dim === 'output' && (opts.layer || 'cities') === 'cities') {
        leg.innerHTML = '<span><span class="dot" style="background:' + cssVar('--chart-1') + '"></span>' +
          I18N.t('dimOutput') + ' · visualMap</span>';
      } else {
        leg.innerHTML = Object.keys(built.legend).map(function (k) {
          return '<span><span class="dot" style="background:' + built.legend[k].color + '"></span>' + built.legend[k].label + '</span>';
        }).join('');
      }
    }
  }

  function resize() { if (chart) try { chart.resize(); } catch (e) {} }
  function setTheme() { if (lastOpts) render(lastOpts); }
  window.addEventListener('resize', resize);

  window.CHINA_AUTO_MAP = { render: render, resize: resize, setTheme: setTheme };
})();
