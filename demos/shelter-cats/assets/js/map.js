/* World map of shelters (ECharts geo + scatter, vendored WORLD_GEO, no API key).
   Shelters sized by cat count; live regions shaded. window.SHELTERCATS_MAP */
(function () {
  'use strict';
  var I18N = window.SHELTERCATS_I18N;
  var chart = null, gate = null, registered = false, onClickCb = null;

  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  function ensure() {
    if (!window.echarts || !window.WORLD_GEO) return null;
    if (!registered) { window.echarts.registerMap('world', window.WORLD_GEO); registered = true; }
    var el = document.getElementById('world-map');
    if (!el) return null;
    if (!chart) {
      chart = window.echarts.init(el, null, { renderer: 'canvas' });
      chart.on('click', function (p) {
        if (p.data && p.data._sid && onClickCb) onClickCb(p.data._sid);
      });
      if (window.QrostTouchGate) {
        gate = window.QrostTouchGate.attach(el, {
          labels: function () {
            return {
              enable: I18N.t('mapTouchEnable'),
              disable: I18N.t('mapTouchDisable'),
            };
          },
          onChange: function (interactive) {
            if (chart) chart.setOption({ geo: { roam: interactive } });
          },
        });
      }
    }
    return chart;
  }

  function mapRoam() {
    if (gate) return gate.isInteractive();
    return !window.QrostTouchGate || !window.QrostTouchGate.coarsePointer();
  }

  // size scale by cat count
  function symSize(n) { return Math.max(8, Math.min(36, 8 + Math.sqrt(n) * 4)); }

  function render(opts) {
    var c = ensure();
    if (!c) return;
    if (gate) gate.refresh();
    var shelters = opts.shelters || [];
    var countFor = opts.countFor || function () { return 0; };
    var liveRegions = opts.liveRegions || [];
    onClickCb = opts.onClick || onClickCb;
    var accent = cssVar('--accent');

    var points = shelters.filter(function (s) {
      return typeof s.lat === 'number' && typeof s.lng === 'number';
    }).map(function (s) {
      var n = countFor(s.id);
      return {
        name: s.name, value: [s.lng, s.lat],
        symbolSize: symSize(n),
        itemStyle: { color: accent, borderColor: 'rgba(255,255,255,.6)', borderWidth: 1, opacity: 0.92 },
        _sid: s.id, _shelter: s, _n: n
      };
    });

    // "you are here" marker (near-me)
    var meSeries = [];
    if (opts.me && typeof opts.me.lat === 'number') {
      meSeries.push({
        type: 'effectScatter', coordinateSystem: 'geo', zlevel: 6, rippleEffect: { scale: 3 },
        symbolSize: 10, data: [{ name: 'me', value: [opts.me.lng, opts.me.lat],
          itemStyle: { color: cssVar('--chart-2') } }]
      });
    }

    c.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item', confine: true,
        backgroundColor: cssVar('--bg-surface'), borderColor: cssVar('--border'),
        textStyle: { color: cssVar('--text') },
        formatter: function (p) {
          if (!p.data || !p.data._shelter) return '';
          var s = p.data._shelter;
          return '<b>' + s.name + '</b><br/>' + (s.city || '') + ', ' + (s.state || s.country || '') +
            '<br/><span style="color:' + cssVar('--accent') + '">●</span> ' + p.data._n + ' ' +
            (I18N.isEn() ? 'cats' : '只猫');
        }
      },
      geo: {
        map: 'world', roam: mapRoam(), scaleLimit: { min: 1, max: 8 },
        center: opts.me ? [opts.me.lng, opts.me.lat] : [-30, 25],
        zoom: opts.me ? 3 : 1.1,
        itemStyle: { areaColor: cssVar('--map-land'), borderColor: cssVar('--map-border'), borderWidth: 0.5 },
        regions: liveRegions.length ? [] : [],
        emphasis: { itemStyle: { areaColor: cssVar('--accent-soft') }, label: { show: false } },
        label: { show: false }, silent: true
      },
      series: [{
        type: 'scatter', coordinateSystem: 'geo', data: points,
        emphasis: { scale: 1.3 }, z: 5
      }].concat(meSeries)
    }, true);
    if (gate) gate.syncSurface();
  }

  function resize() { if (chart) try { chart.resize(); } catch (e) {} }
  window.addEventListener('resize', resize);

  window.SHELTERCATS_MAP = { render: render, resize: resize, focus: function (lng, lat, zoom) {
    if (chart) chart.setOption({ geo: { center: [lng, lat], zoom: zoom || 4 } });
  } };
})();
