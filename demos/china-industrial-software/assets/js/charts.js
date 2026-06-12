/**
 * Chart.js + ECharts wrappers for industrial software survey.
 */
(function () {
  'use strict';

  const I18N = () => window.INDUSTRIAL_I18N || {};
  const isEn = () => I18N().isEn && I18N().isEn();
  const charts = {};
  let echartsReady = false;

  const C = {
    emerald: '#059669',
    indigo: '#6366f1',
    violet: '#8b5cf6',
    amber: '#f59e0b',
    cyan: '#06b6d4',
    slate: '#64748b',
    grid: 'rgba(100,116,139,0.12)',
  };

  function loadEcharts() {
    if (window.echarts) { echartsReady = true; return Promise.resolve(); }
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js';
      s.crossOrigin = 'anonymous';
      s.onload = () => { echartsReady = true; resolve(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function destroy(id) {
    if (charts[id]) {
      if (charts[id].dispose) charts[id].dispose();
      else if (charts[id].destroy) charts[id].destroy();
      delete charts[id];
    }
  }

  /** L2 labels excluded from sunburst — kernel/meta/deprecated slices, not software categories. */
  const SUNBURST_EXCLUDE_L2 = new Set(['数字孪生', 'CAD内核', '三维建模']);

  /** Canonical L1 ring order; legacy 基础平台 rolls into 生产制造 for display. */
  const SUNBURST_L1_ORDER = ['研发设计', '生产制造', '经营管理', '运维服务'];

  function sunburstChartL1(raw) {
    if (raw === '基础平台') return '生产制造';
    return raw;
  }

  function buildSunburstTree() {
    const prods = window.INDUSTRIAL_CATALOG.allProducts || [];
    const l1L2 = {};
    prods.forEach((p) => {
      const l1 = sunburstChartL1(p.category_l1);
      const l2 = p.category_l2;
      if (!l1 || !l2 || SUNBURST_EXCLUDE_L2.has(l2)) return;
      if (!l1L2[l1]) l1L2[l1] = {};
      l1L2[l1][l2] = (l1L2[l1][l2] || 0) + 1;
    });
    const present = new Set(Object.keys(l1L2));
    const l1Order = SUNBURST_L1_ORDER.filter((l1) => present.has(l1))
      .concat([...present].filter((l1) => !SUNBURST_L1_ORDER.includes(l1)).sort());
    return l1Order
      .map((l1) => {
        const children = Object.entries(l1L2[l1] || {})
          .map(([l2, value]) => ({ name: l2, value }))
          .sort((a, b) => b.value - a.value);
        const value = children.reduce((sum, c) => sum + c.value, 0);
        if (!value) return null;
        return { name: l1, value, children };
      })
      .filter(Boolean);
  }

  function setSunburstHighlight(name) {
    const inst = charts.sunburst;
    if (!inst) return;
    inst.dispatchAction({ type: 'downplay', seriesIndex: 0 });
    if (name) {
      inst.dispatchAction({ type: 'highlight', seriesIndex: 0, name });
    }
  }

  function isSunburstAtRoot() {
    const inst = charts.sunburst;
    if (!inst) return true;
    try {
      const series = inst.getModel().getSeriesByIndex(0);
      const viewRoot = series?.getViewRoot?.();
      const root = series?.getData()?.tree?.root;
      return !viewRoot || !root || viewRoot === root;
    } catch (_) {
      return true;
    }
  }

  /** ECharts sunburst drill-down does not reset via containPixel; use tree root id. */
  function resetSunburstView() {
    const inst = charts.sunburst;
    if (!inst) return false;
    inst.dispatchAction({ type: 'downplay', seriesIndex: 0 });
    try {
      const series = inst.getModel().getSeriesByIndex(0);
      const root = series?.getData()?.tree?.root;
      const rootId = root?.getId?.();
      if (rootId != null) {
        inst.dispatchAction({ type: 'sunburstRootToNode', seriesIndex: 0, targetNodeId: rootId });
      } else if (typeof series?.resetViewRoot === 'function') {
        series.resetViewRoot();
        inst.render();
      }
      if (!isSunburstAtRoot() && typeof series?.resetViewRoot === 'function') {
        series.resetViewRoot();
        inst.render();
      }
      return isSunburstAtRoot();
    } catch (_) {
      return false;
    }
  }

  function clearSunburstVisual() {
    const inst = charts.sunburst;
    if (!inst) return;
    inst.dispatchAction({ type: 'downplay', seriesIndex: 0 });
    if (!resetSunburstView()) {
      const opt = inst.getOption();
      const seriesOpt = opt?.series?.[0];
      if (seriesOpt?.data) {
        inst.setOption({ series: [{ type: 'sunburst', data: seriesOpt.data }] }, { notMerge: false, replaceMerge: ['series'] });
      }
    }
  }

  function renderSunburst(el, manifest, opts) {
    if (!echartsReady || !el || !manifest) return;
    destroy('sunburst');
    const inst = window.echarts.init(el);
    charts.sunburst = inst;

    const onSectorClick = typeof opts === 'function' ? opts : opts?.onSectorClick;
    const onReset = typeof opts === 'function' ? null : opts?.onReset;
    const activeFilter = typeof opts === 'function' ? '' : (opts?.activeFilter || '');

    const l1Children = buildSunburstTree();
    const countLabel = isEn() ? 'products' : '款产品';

    inst.setOption({
      tooltip: {
        trigger: 'item',
        formatter(params) {
          const path = (params.treePathInfo || [])
            .map((n) => n.name)
            .filter((n) => n && n !== 'root')
            .join(' › ');
          return `${path}<br/><strong>${params.value}</strong> ${countLabel}`;
        },
      },
      series: [{
        type: 'sunburst',
        radius: ['15%', '90%'],
        data: l1Children,
        sort: 'desc',
        emphasis: { focus: 'ancestor' },
        label: {
          fontSize: 11,
          minAngle: 6,
          rotate: 'radial',
          overflow: 'truncate',
          width: 72,
        },
        labelLayout: { hideOverlap: true },
        levels: [
          {},
          {
            r0: '15%',
            r: '48%',
            label: { fontSize: 12, minAngle: 4 },
          },
          {
            r0: '48%',
            r: '90%',
            label: { fontSize: 10, minAngle: 10, width: 64 },
          },
        ],
        itemStyle: { borderRadius: 4, borderWidth: 1, borderColor: '#fff' },
      }],
    });

    let clickedSeries = false;

    inst.on('click', (params) => {
      if (params.componentType !== 'series' || !params.name) return;
      clickedSeries = true;
      if (!onSectorClick) return;
      if (activeFilter && params.name === activeFilter && onReset) {
        onReset();
        return;
      }
      onSectorClick(params.name, params);
      // Clear stale flag when zr click does not pair (e.g. programmatic trigger).
      setTimeout(() => { clickedSeries = false; }, 50);
    });

    if (onReset) {
      // containPixel is unreliable for sunburst — defer blank detection until after series click.
      inst.getZr().on('click', () => {
        setTimeout(() => {
          if (!clickedSeries) onReset();
          clickedSeries = false;
        }, 10);
      });

      inst.getZr().on('dblclick', (e) => {
        const w = inst.getWidth();
        const h = inst.getHeight();
        const cx = w / 2;
        const cy = h / 2;
        const dx = e.offsetX - cx;
        const dy = e.offsetY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxR = Math.min(w, h) / 2;
        if (dist <= maxR * 0.15) onReset();
      });
    }

    if (activeFilter) setSunburstHighlight(activeFilter);
  }

  function productRadarScore(p) {
    const mat = { experimental: 2, mid: 5, high: 7, mission_critical: 9 };
    const loc = { none: 1, pilot: 3, partial: 6, core: 9 };
    const price = { free: 9, low: 7, mid: 5, high: 3, quote: 4 };
    const conf = (p.confidence || 0.5) * 10;
    const eco = Math.min(10, (p.international_benchmarks || []).length * 2 + (p.sources || []).length);
    return {
      function: mat[p.maturity] || 5,
      ecosystem: Math.min(10, eco),
      maturity: mat[p.maturity] || 5,
      localization: loc[p.localization_depth] || 3,
      price: price[p.pricing] || 5,
      confidence: conf,
    };
  }

  function renderCompareRadar(el, products) {
    if (!echartsReady || !el || !products.length) return;
    destroy('compareRadar');
    const inst = window.echarts.init(el);
    charts.compareRadar = inst;
    const dims = [
      { key: 'function', zh: '功能', en: 'Function' },
      { key: 'ecosystem', zh: '生态', en: 'Ecosystem' },
      { key: 'maturity', zh: '成熟度', en: 'Maturity' },
      { key: 'localization', zh: '国产化', en: 'Localization' },
      { key: 'price', zh: '性价比', en: 'Value' },
    ];
    const indicator = dims.map((d) => ({
      name: isEn() ? d.en : d.zh,
      max: 10,
    }));
    const series = products.map((p) => {
      const s = productRadarScore(p);
      return {
        name: isEn() ? p.name_en : p.name_zh,
        value: dims.map((d) => s[d.key]),
      };
    });
    const colors = [C.emerald, C.indigo, C.cyan, C.amber];
    inst.setOption({
      color: colors,
      tooltip: {
        trigger: 'item'
      },
      radar: {
        indicator,
        radius: '65%',
        splitNumber: 5,
        axisName: {
          color: '#475569',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          fontWeight: 500,
          fontSize: 12
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(148, 163, 184, 0.15)',
            width: 1
          }
        },
        splitArea: {
          areaStyle: {
            color: ['rgba(248, 250, 252, 0.3)', 'rgba(241, 245, 249, 0.3)']
          }
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(148, 163, 184, 0.15)'
          }
        }
      },
      series: [{
        type: 'radar',
        data: series.map((s, idx) => ({
          ...s,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            width: 2,
            color: colors[idx % colors.length]
          },
          areaStyle: {
            color: colors[idx % colors.length],
            opacity: 0.08
          },
          itemStyle: {
            color: colors[idx % colors.length]
          }
        }))
      }],
      legend: {
        bottom: 0,
        type: 'scroll',
        textStyle: {
          color: '#334155',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          fontSize: 11
        },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 16
      },
    });
  }

  function resizeAll() {
    Object.values(charts).forEach((c) => {
      if (c.resize) c.resize();
    });
  }

  function resizeCompareRadar() {
    const c = charts.compareRadar;
    if (c && c.resize) c.resize();
  }

  window.INDUSTRIAL_CHARTS = {
    loadEcharts,
    renderSunburst,
    setSunburstHighlight,
    resetSunburstView,
    clearSunburstVisual,
    isSunburstAtRoot,
    renderCompareRadar,
    productRadarScore,
    resizeAll,
    resizeCompareRadar,
    destroy,
    SUNBURST_EXCLUDE_L2,
    sunburstChartL1,
    buildSunburstTree,
  };

  window.addEventListener('resize', () => {
    setTimeout(resizeAll, 100);
  });
})();
