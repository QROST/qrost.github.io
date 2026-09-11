/* ECharts world atlas and raw-relation graph. Both keep semantic DOM fallbacks. */
(function () {
  'use strict';

  let worldChart = null;
  let lineageChart = null;
  let worldGate = null;
  let lineageGate = null;
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
        roam: worldGate ? worldGate.isInteractive() : (!window.QrostTouchGate || !window.QrostTouchGate.coarsePointer()),
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
      // The touch gate emits onChange synchronously; initialize the full chart first.
      if (!worldGate && window.QrostTouchGate) {
        worldGate = window.QrostTouchGate.attach(document.getElementById('world-map'), {
          labels: function () {
            const i18n = window.ARCH_I18N;
            return {
              enable: i18n.t('mapTouchEnable'),
              disable: i18n.t('mapTouchDisable'),
            };
          },
          onChange: function (interactive) {
            if (worldChart) worldChart.setOption({ geo: { roam: interactive } });
          },
        });
      }
      if (worldGate) { worldGate.refresh(); worldGate.syncSurface(); }
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

  function uniquePersonRelations(relations, entitiesById) {
    const byId = new Map();
    relations.forEach(function (relation) {
      const from = entitiesById[relation.from_id];
      const to = entitiesById[relation.to_id];
      if (!relation.id || !from || from.entity_type !== 'person' || !to || to.entity_type !== 'person') return;
      if (!byId.has(relation.id)) byId.set(relation.id, relation);
    });
    return Array.from(byId.values());
  }

  function relationCounts(relations) {
    const counts = new Map();
    relations.forEach(function (relation) {
      // One relation ID counts once per person, including a self-reference.
      new Set([relation.from_id, relation.to_id]).forEach(function (id) {
        counts.set(id, (counts.get(id) || 0) + 1);
      });
    });
    return counts;
  }

  function lineageSize(count, maximum) {
    // Keep small nodes selectable, then use a square-root scale without a count cap.
    return Math.sqrt(24 * 24 + (56 * 56 - 24 * 24) * count / Math.max(1, maximum));
  }

  function renderLineageLegend(maximum) {
    const legend = document.getElementById('lineage-size-legend');
    if (!legend) return;
    const i18n = window.ARCH_I18N;
    const samples = maximum > 0
      ? Array.from(new Set([1, Math.max(1, Math.round(maximum / 4)), Math.max(1, Math.round(maximum / 2)), maximum]))
      : [];
    legend.innerHTML = '<span class="lineage-size-title">' + escapeHtml(i18n.t('lineageSizeTitle')) + '</span>' +
      samples.map(function (count) {
        const diameter = lineageSize(count, maximum);
        return '<span class="lineage-size-item" data-relation-count="' + count + '">' +
          '<span class="lineage-size-dot" aria-hidden="true" style="width:' + diameter + 'px;height:' + diameter + 'px"></span>' +
          escapeHtml(i18n.t('lineageRecordCount', { count: count })) + '</span>';
      }).join('') +
      '<span class="lineage-size-note">' + escapeHtml(i18n.t('lineageSizeNote')) + '</span>';
  }

  function renderLineage(relations, context) {
    try {
      const chart = ensureLineage();
      if (!chart) return false;
      const i18n = window.ARCH_I18N;
      const entitiesById = context.entitiesById || {};
      lineageClick = context.onClick || lineageClick;
      lineageEdgeClick = context.onRelationClick || lineageEdgeClick;
      // The app supplies the complete person-to-person study/influence candidate
      // collection independently of search and relation-type filters.
      const allRelations = uniquePersonRelations(context.allRelations || relations, entitiesById);
      const allIds = new Set(allRelations.map(function (relation) { return relation.id; }));
      const visibleRelations = uniquePersonRelations(relations, entitiesById).filter(function (relation) {
        return allIds.has(relation.id);
      });
      const allCounts = relationCounts(allRelations);
      const visibleCounts = relationCounts(visibleRelations);
      const maximum = Math.max(0, ...allCounts.values());
      const nodes = Array.from(visibleCounts.keys()).map(function (id) {
      const entity = entitiesById[id] || { name_en: id };
      const totalCount = allCounts.get(id) || 0;
      return {
        id: id,
        entityId: id,
        name: i18n.name(entity),
        value: totalCount,
        totalRelationCount: totalCount,
        visibleRelationCount: visibleCounts.get(id),
        symbolSize: lineageSize(totalCount, maximum),
        itemStyle: {
          color: cssVar('--cobalt'),
          borderColor: cssVar('--surface-strong'),
          borderWidth: 2,
        },
      };
      });
      const links = visibleRelations.map(function (relation) {
        return {
          source: relation.from_id,
          target: relation.to_id,
          relationId: relation.id,
          relationType: relation.relation_type,
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
        extraCssText: 'max-width:min(320px, calc(100vw - 48px));white-space:normal;overflow-wrap:anywhere;',
        formatter: function (params) {
          if (params.dataType === 'node') {
            return '<strong>' + escapeHtml(params.data.name) + '</strong><br>' +
              escapeHtml(i18n.t('lineageTotalCount', { count: params.data.totalRelationCount })) + '<br>' +
              escapeHtml(i18n.t('lineageVisibleCount', { count: params.data.visibleRelationCount })) + '<br>' +
              escapeHtml(i18n.t('lineageCountMeaning')) + '<br>' +
              escapeHtml(i18n.t('relationReviewOnly'));
          }
          return escapeHtml(i18n.enumLabel('relation_type', params.data.relationType)) + '<br>' +
            escapeHtml(i18n.t('relationType')) + ': ' + escapeHtml(params.data.relationType) + '<br>' +
            escapeHtml(i18n.t('relationReviewOnly')) + '<br>' + escapeHtml(i18n.t('lineageOpenEvidence'));
        },
      },
      series: [{
        type: 'graph',
        layout: 'force',
        roam: lineageGate ? lineageGate.isInteractive() : (!window.QrostTouchGate || !window.QrostTouchGate.coarsePointer()),
        draggable: lineageGate ? lineageGate.isInteractive() : (!window.QrostTouchGate || !window.QrostTouchGate.coarsePointer()),
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
      renderLineageLegend(maximum);
      // The touch gate emits onChange synchronously; initialize the full chart first.
      if (!lineageGate && window.QrostTouchGate) {
        lineageGate = window.QrostTouchGate.attach(document.getElementById('lineage-graph'), {
          labels: function () {
            const i18n = window.ARCH_I18N;
            return {
              enable: i18n.t('graphTouchEnable'),
              disable: i18n.t('graphTouchDisable'),
            };
          },
          onChange: function (interactive) {
            if (lineageChart) {
              lineageChart.setOption({ series: [{ roam: interactive, draggable: interactive }] });
            }
          },
        });
      }
      if (lineageGate) { lineageGate.refresh(); lineageGate.syncSurface(); }
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
