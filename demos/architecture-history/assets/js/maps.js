/* ECharts world atlas and raw-relation graph. Both keep semantic DOM fallbacks. */
(function () {
  'use strict';

  let worldChart = null;
  let lineageChart = null;
  let worldRegistered = false;
  let worldClick = null;
  let lineageClick = null;
  let lineageEdgeClick = null;

  const REGION_COLORS = {
    east_asia: '#b4563f',
    south_asia: '#c18732',
    southeast_asia: '#5b8f7c',
    central_west_asia: '#9a6d51',
    africa: '#a08a3d',
    europe: '#315d78',
    north_america: '#5978a6',
    latin_america_caribbean: '#8b5b88',
    oceania: '#3f8290',
    unknown: '#7b868a',
  };

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function ensureWorld() {
    if (!window.echarts || !window.WORLD_GEO) return null;
    if (!worldRegistered) {
      window.echarts.registerMap('architecture-world', window.WORLD_GEO);
      worldRegistered = true;
    }
    const element = document.getElementById('world-map');
    if (!element) return null;
    if (!worldChart) {
      worldChart = window.echarts.init(element, null, { renderer: 'canvas' });
      worldChart.on('click', function (params) {
        if (params.data && params.data.entityId && worldClick) {
          worldClick(params.data.entityId);
        }
      });
    }
    return worldChart;
  }

  function renderWorld(works, context) {
    try {
      const chart = ensureWorld();
      if (!chart) return false;
      const i18n = window.ARCH_I18N;
      const entitiesById = context.entitiesById || {};
      worldClick = context.onClick || worldClick;
      const points = works
      .filter(function (work) {
        return work.coordinates &&
          typeof work.coordinates.lat === 'number' &&
          typeof work.coordinates.lng === 'number';
      })
      .map(function (work) {
        const place = entitiesById[work.place_id];
        const creditNames = (work.credits || []).map(function (credit) {
          return i18n.name(entitiesById[credit.entity_id] || { name_en: credit.entity_id });
        });
        return {
          name: i18n.name(work),
          value: [work.coordinates.lng, work.coordinates.lat],
          symbolSize: 11,
          itemStyle: {
            color: REGION_COLORS[work.region] || REGION_COLORS.unknown,
            borderColor: cssVar('--surface-strong'),
            borderWidth: 1.5,
            opacity: 0.94,
            shadowBlur: 8,
            shadowColor: 'rgba(20, 35, 41, .22)',
          },
          entityId: work.id,
          region: work.region,
          placeName: place ? i18n.name(place) : i18n.t('unknown'),
          creditNames: creditNames,
        };
      });

      chart.setOption({
      animationDuration: 450,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: cssVar('--surface-strong'),
        borderColor: cssVar('--line'),
        borderWidth: 1,
        textStyle: { color: cssVar('--ink'), fontSize: 12 },
        extraCssText: 'box-shadow:0 12px 30px rgba(0,0,0,.14);border-radius:6px;',
        formatter: function (params) {
          if (!params.data || !params.data.entityId) return '';
          const credits = params.data.creditNames.length
            ? '<br><span style="color:' + cssVar('--ink-faint') + '">' +
              escapeHtml(params.data.creditNames.join(' · ')) + '</span>'
            : '';
          return '<strong>' + escapeHtml(params.data.name) + '</strong><br>' +
            escapeHtml(params.data.placeName) + ' · ' +
            escapeHtml(i18n.enumLabel('region', params.data.region)) + credits;
        },
      },
      geo: {
        map: 'architecture-world',
        roam: true,
        scaleLimit: { min: 1, max: 8 },
        zoom: 1.08,
        itemStyle: {
          areaColor: cssVar('--map-land'),
          borderColor: cssVar('--map-border'),
          borderWidth: 0.55,
        },
        emphasis: {
          disabled: false,
          itemStyle: { areaColor: cssVar('--cobalt-soft') },
          label: { show: false },
        },
        select: { disabled: true },
        label: { show: false },
        silent: true,
      },
      series: [{
        type: 'scatter',
        coordinateSystem: 'geo',
        data: points,
        progressive: 0,
        z: 5,
        emphasis: { scale: 1.55 },
      }],
      }, true);
      return true;
    } catch (error) {
      if (worldChart) {
        try { worldChart.dispose(); } catch (_) {}
        worldChart = null;
      }
      throw error;
    }
  }

  function ensureLineage() {
    if (!window.echarts) return null;
    const element = document.getElementById('lineage-graph');
    if (!element) return null;
    if (!lineageChart) {
      lineageChart = window.echarts.init(element, null, { renderer: 'canvas' });
      lineageChart.on('click', function (params) {
        if (params.dataType === 'node' && params.data && params.data.entityId && lineageClick) {
          lineageClick(params.data.entityId);
        } else if (
          params.dataType === 'edge' &&
          params.data &&
          params.data.relationId &&
          lineageEdgeClick
        ) {
          lineageEdgeClick(params.data.relationId);
        }
      });
    }
    return lineageChart;
  }

  function renderLineage(relations, context) {
    try {
      const chart = ensureLineage();
      if (!chart) return false;
      const i18n = window.ARCH_I18N;
      const entitiesById = context.entitiesById || {};
      lineageClick = context.onClick || lineageClick;
      lineageEdgeClick = context.onRelationClick || lineageEdgeClick;
      const ids = [];
      const degree = {};
      relations.forEach(function (relation) {
      [relation.from_id, relation.to_id].forEach(function (id) {
        if (!ids.includes(id)) ids.push(id);
        degree[id] = (degree[id] || 0) + 1;
      });
      });
      const nodes = ids.map(function (id) {
      const entity = entitiesById[id] || { name_en: id };
      return {
        id: id,
        entityId: id,
        name: i18n.name(entity),
        value: degree[id],
        symbolSize: 25 + Math.min(degree[id], 5) * 5,
        itemStyle: {
          color: degree[id] > 2 ? cssVar('--terracotta') : cssVar('--cobalt'),
          borderColor: cssVar('--surface-strong'),
          borderWidth: 2,
        },
      };
      });
      const links = relations.map(function (relation) {
      return {
        source: relation.from_id,
        target: relation.to_id,
        relationId: relation.id,
        lineStyle: {
          color: cssVar('--terracotta'),
          type: 'dashed',
          width: 1.2,
          opacity: 0.68,
          curveness: 0.08,
        },
      };
      });

      chart.setOption({
      animationDuration: 450,
      backgroundColor: 'transparent',
      tooltip: {
        confine: true,
        backgroundColor: cssVar('--surface-strong'),
        borderColor: cssVar('--line'),
        textStyle: { color: cssVar('--ink'), fontSize: 12 },
        formatter: function (params) {
          if (params.dataType === 'node') {
            return '<strong>' + escapeHtml(params.data.name) + '</strong><br>' +
              escapeHtml(i18n.t('relationReviewOnly'));
          }
          return escapeHtml(i18n.t('rawRelation'));
        },
      },
      series: [{
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        data: nodes,
        links: links,
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: [0, 7],
        force: {
          repulsion: 210,
          gravity: 0.06,
          edgeLength: [90, 155],
        },
        label: {
          show: true,
          position: 'right',
          color: cssVar('--ink'),
          fontSize: 10,
          formatter: '{b}',
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 2.5, opacity: 1 },
        },
      }],
      }, true);
      return true;
    } catch (error) {
      if (lineageChart) {
        try { lineageChart.dispose(); } catch (_) {}
        lineageChart = null;
      }
      throw error;
    }
  }

  function resize() {
    if (worldChart) worldChart.resize();
    if (lineageChart) lineageChart.resize();
  }

  let resizeFrame = 0;
  function scheduleResize() {
    if (resizeFrame) return;
    resizeFrame = window.requestAnimationFrame(function () {
      resizeFrame = 0;
      resize();
    });
  }

  function dispose() {
    if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
    resizeFrame = 0;
    if (worldChart) {
      try { worldChart.dispose(); } catch (_) {}
      worldChart = null;
    }
    if (lineageChart) {
      try { lineageChart.dispose(); } catch (_) {}
      lineageChart = null;
    }
  }

  function handlePageHide(event) {
    if (!event.persisted) dispose();
  }

  window.addEventListener('resize', scheduleResize);
  window.addEventListener('pagehide', handlePageHide);

  window.ARCH_MAPS = {
    REGION_COLORS: REGION_COLORS,
    renderWorld: renderWorld,
    renderLineage: renderLineage,
    resize: resize,
    dispose: dispose,
  };
})();
