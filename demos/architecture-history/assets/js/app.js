/* Architecture Lineages browser: one filter state, semantic fallbacks, evidence-first details. */
(function () {
  'use strict';

  const i18n = window.ARCH_I18N;
  const loader = window.ARCH_DATA;
  const maps = window.ARCH_MAPS;

  const state = {
    data: null,
    entities: [],
    entitiesById: {},
    claimsById: {},
    relationsById: {},
    worksByContributor: {},
    worksByPlace: {},
    filters: {
      query: '',
      entityType: 'all',
      region: 'all',
      period: 'all',
      verification: 'all',
      workTypeMapping: 'all',
      hasChinese: false,
      hasCoordinates: false,
      hasCredits: false,
    },
    sort: { key: 'name', direction: 'ascending' },
    detailEntityId: null,
    detailRelationId: null,
    lastFocused: null,
    lineageFilters: {
      query: '',
      relationTypes: new Set([
        'student_of_recorded',
        'documented_influence',
      ]),
    },
  };

  const LINEAGE_RELATION_TYPES = [
    'student_of_recorded',
    'documented_influence',
  ];

  const PRACTICE_AFFILIATION_TYPES = new Set([
    'worked_at_practice',
    'cofounded_with',
  ]);

  const SECTION_IDS = new Set(['atlas', 'catalog', 'lineage', 'coverage', 'methodology']);

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value));
      return url.protocol === 'https:' ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function jsonText(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (_) {
      return String(value);
    }
  }

  function normalize(value) {
    return String(value == null ? '' : value)
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase()
      .trim();
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function putText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
  }

  function hasCoordinates(entity) {
    return entity.entity_type === 'work' &&
      entity.coordinates &&
      typeof entity.coordinates.lat === 'number' &&
      typeof entity.coordinates.lng === 'number';
  }

  function contributorWorks(entityId) {
    return state.worksByContributor[entityId] || [];
  }

  function placeWorks(entityId) {
    return state.worksByPlace[entityId] || [];
  }

  function entitySearchText(entity) {
    const parts = [
      entity.id,
      entity.name_zh,
      entity.name_en,
      entity.name_native,
      ...(entity.aliases_zh || []),
      ...(entity.aliases_en || []),
      ...Object.values(entity.external_ids || {}),
    ];
    if (entity.entity_type === 'work') {
      const place = state.entitiesById[entity.place_id];
      if (place) parts.push(place.name_zh, place.name_en, place.country_code);
      (entity.credits || []).forEach(function (credit) {
        const contributor = state.entitiesById[credit.entity_id];
        if (contributor) parts.push(contributor.name_zh, contributor.name_en);
      });
      (entity.unresolved_credits || []).forEach(function (credit) {
        parts.push(credit.source_label_zh, credit.source_label_en, credit.source_entity_qid);
      });
    }
    return normalize(parts.join(' '));
  }

  function passesCommonFilters(entity, ignoreEntityType) {
    const filters = state.filters;
    if (!ignoreEntityType && filters.entityType !== 'all' && entity.entity_type !== filters.entityType) {
      return false;
    }
    if (filters.region !== 'all' && entity.region !== filters.region) return false;
    if (filters.period !== 'all') {
      if (entity.entity_type !== 'work' || entity.period !== filters.period) return false;
    }
    if (filters.verification !== 'all' && entity.verification_status !== filters.verification) return false;
    if (filters.workTypeMapping !== 'all') {
      if (entity.entity_type !== 'work' || entity.work_type_mapping_status !== filters.workTypeMapping) return false;
    }
    if (filters.hasChinese && !entity.name_zh) return false;
    if (filters.hasCoordinates && !hasCoordinates(entity)) return false;
    if (filters.hasCredits) {
      if (entity.entity_type !== 'work' || !(entity.credits || []).length) return false;
    }
    if (filters.query && !entitySearchText(entity).includes(normalize(filters.query))) return false;
    return true;
  }

  function filteredEntities() {
    const rows = state.entities.filter(function (entity) {
      return passesCommonFilters(entity, false);
    });
    const direction = state.sort.direction === 'descending' ? -1 : 1;
    const key = state.sort.key;
    rows.sort(function (a, b) {
      let left;
      let right;
      if (key === 'name') {
        left = i18n.name(a);
        right = i18n.name(b);
      } else {
        left = a[key] || '';
        right = b[key] || '';
      }
      const compared = String(left).localeCompare(String(right), i18n.getLanguage() === 'zh' ? 'zh-CN' : 'en');
      if (compared) return compared * direction;
      return a.id.localeCompare(b.id) * direction;
    });
    return rows;
  }

  function filteredMapWorks() {
    return state.data.works.filter(function (work) {
      return passesCommonFilters(work, true) && hasCoordinates(work);
    });
  }

  function buildIndexes(data) {
    state.entities = [].concat(data.works, data.people, data.practices, data.places);
    state.entitiesById = Object.fromEntries(state.entities.map(function (entity) {
      return [entity.id, entity];
    }));
    state.claimsById = Object.fromEntries(data.claims.map(function (claim) {
      return [claim.id, claim];
    }));
    state.relationsById = Object.fromEntries(data.relations.map(function (relation) {
      return [relation.id, relation];
    }));
    state.worksByContributor = {};
    state.worksByPlace = {};
    data.works.forEach(function (work) {
      (work.credits || []).forEach(function (credit) {
        if (!state.worksByContributor[credit.entity_id]) state.worksByContributor[credit.entity_id] = [];
        state.worksByContributor[credit.entity_id].push(work);
      });
      if (work.place_id) {
        if (!state.worksByPlace[work.place_id]) state.worksByPlace[work.place_id] = [];
        state.worksByPlace[work.place_id].push(work);
      }
    });
  }

  function renderMetrics() {
    const manifest = state.data.manifest;
    putText('#hero-verified', manifest.counts.verified_entities_and_relations);
    putText('#data-as-of', manifest.data_as_of);
    putText('#coverage-run', manifest.coverage.cells_run);
    putText('#coverage-total', manifest.coverage.cells_total);
    putText('#data-version', manifest.data_version.slice(0, 12));
    putText('#metric-works', manifest.counts.works);
    putText('#metric-people', manifest.counts.people);
    putText('#metric-practices', manifest.counts.practices);
    putText('#metric-claims', manifest.counts.claims);
    putText('#source-count', i18n.t('sourceCount', { count: manifest.counts.sources }));
    putText('#tab-count-all', state.entities.length);
    putText('#tab-count-work', state.data.works.length);
    putText('#tab-count-person', state.data.people.length);
    putText('#tab-count-practice', state.data.practices.length);
    putText('#tab-count-place', state.data.places.length);
  }

  function renderRegionOptions() {
    const select = $('#region-filter');
    if (!select) return;
    const previous = state.filters.region;
    const regions = state.data.coverageConfig.coverage_grid.regions.concat(
      state.entities.some(function (entity) { return entity.region === 'unknown'; }) ? ['unknown'] : []
    );
    select.replaceChildren();
    const all = document.createElement('option');
    all.value = 'all';
    all.textContent = i18n.t('regionAll');
    select.appendChild(all);
    regions.forEach(function (region) {
      const option = document.createElement('option');
      option.value = region;
      option.textContent = i18n.enumLabel('region', region);
      select.appendChild(option);
    });
    select.value = previous;
  }

  function renderPeriodOptions() {
    const select = $('#period-filter');
    if (!select) return;
    const previous = state.filters.period;
    const periods = state.data.coverageConfig.coverage_grid.periods.map(function (period) {
      return period.id;
    });
    if (state.data.works.some(function (work) { return work.period === 'unknown'; })) {
      periods.push('unknown');
    }
    select.replaceChildren();
    const all = document.createElement('option');
    all.value = 'all';
    all.textContent = i18n.t('periodAll');
    select.appendChild(all);
    periods.forEach(function (period) {
      const option = document.createElement('option');
      option.value = period;
      option.textContent = i18n.enumLabel('period', period);
      select.appendChild(option);
    });
    select.value = periods.includes(previous) ? previous : 'all';
  }

  function contextFor(entity) {
    if (entity.entity_type === 'work') {
      const place = state.entitiesById[entity.place_id];
      const pieces = [];
      if (place) pieces.push(i18n.name(place));
      if ((entity.credits || []).length) {
        pieces.push(i18n.t('creditsCount', { count: entity.credits.length }));
      }
      return pieces.join(' · ') || i18n.t('noData');
    }
    if (entity.entity_type === 'person' || entity.entity_type === 'practice') {
      return i18n.t('linkedWorksCount', { count: contributorWorks(entity.id).length });
    }
    if (entity.entity_type === 'place') {
      return entity.country_code
        ? i18n.t('countryCode', { code: entity.country_code }) + ' · ' +
          i18n.t('linkedWorksCount', { count: placeWorks(entity.id).length })
        : i18n.t('linkedWorksCount', { count: placeWorks(entity.id).length });
    }
    return i18n.t('noData');
  }

  function typeLabel(entity) {
    if (entity.entity_type === 'work') {
      return i18n.enumLabel('work_type', entity.work_type);
    }
    return i18n.enumLabel('entity_type', entity.entity_type);
  }

  function statusChip(entity) {
    const status = entity.verification_status || 'candidate';
    return '<span class="status-chip ' + escapeHtml(status) + '">' +
      escapeHtml(i18n.enumLabel('verification_status', status)) + '</span>';
  }

  function renderCatalog() {
    const rows = filteredEntities();
    putText('#result-summary', i18n.t('resultCount', {
      shown: rows.length,
      total: state.entities.length,
    }));
    const body = $('#catalog-table-body');
    body.innerHTML = rows.map(function (entity) {
      const primary = i18n.name(entity);
      const secondary = i18n.secondaryName(entity) || (!entity.name_zh ? i18n.t('noChineseLabel') : '');
      return '<tr data-row-entity="' + escapeHtml(entity.id) + '">' +
        '<td><button class="record-button" type="button" data-open-entity="' + escapeHtml(entity.id) + '">' +
          '<span class="record-name"><strong>' + escapeHtml(primary) + '</strong>' +
          '<span>' + escapeHtml(secondary) + '</span></span></button></td>' +
        '<td><span class="type-chip">' + escapeHtml(typeLabel(entity)) + '</span></td>' +
        '<td>' + escapeHtml(i18n.enumLabel('region', entity.region)) + '</td>' +
        '<td>' + escapeHtml(contextFor(entity)) + '</td>' +
        '<td><span class="evidence-count">' +
          escapeHtml(i18n.t('claimsCount', { count: (entity.claim_ids || []).length })) +
          '</span></td>' +
        '<td>' + statusChip(entity) + '</td>' +
      '</tr>';
    }).join('');

    const mobile = $('#catalog-card-list');
    mobile.innerHTML = rows.map(function (entity) {
      const secondary = i18n.secondaryName(entity) || (!entity.name_zh ? i18n.t('noChineseLabel') : '');
      return '<button class="catalog-mobile-card" type="button" data-open-entity="' + escapeHtml(entity.id) + '">' +
        '<span><strong>' + escapeHtml(i18n.name(entity)) + '</strong>' + statusChip(entity) + '</span>' +
        '<em>' + escapeHtml(secondary) + '</em>' +
        '<small>' + escapeHtml(typeLabel(entity)) + ' · ' +
          escapeHtml(i18n.enumLabel('region', entity.region)) + ' · ' +
          escapeHtml(contextFor(entity)) + '</small>' +
      '</button>';
    }).join('');

    $('#catalog-empty').classList.toggle('hidden', rows.length !== 0);
    updateSortHeaders();
  }

  function updateSortHeaders() {
    $$('.catalog-table th').forEach(function (header) {
      header.removeAttribute('aria-sort');
    });
    const activeButton = $('.catalog-table [data-sort="' + state.sort.key + '"]');
    if (activeButton) activeButton.closest('th').setAttribute('aria-sort', state.sort.direction);
  }

  function renderMapLegend(works) {
    const regions = unique(works.map(function (work) { return work.region; }));
    const legend = $('#map-legend');
    legend.replaceChildren();
    regions.forEach(function (region) {
      const item = document.createElement('span');
      const dot = document.createElement('i');
      dot.style.background = maps.REGION_COLORS[region] || maps.REGION_COLORS.unknown;
      item.appendChild(dot);
      item.appendChild(document.createTextNode(i18n.enumLabel('region', region)));
      legend.appendChild(item);
    });
  }

  function renderCoordinateList(works) {
    const list = $('#coordinate-list');
    list.replaceChildren();
    works.forEach(function (work) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.openEntity = work.id;
      button.textContent = i18n.name(work) + ' · ' +
        work.coordinates.lat.toFixed(3) + ', ' + work.coordinates.lng.toFixed(3);
      item.appendChild(button);
      list.appendChild(item);
    });
  }

  function renderMap() {
    const works = filteredMapWorks();
    putText('#map-visible-count', works.length);
    renderMapLegend(works);
    renderCoordinateList(works);
    let ok = false;
    try {
      ok = Boolean(maps && maps.renderWorld(works, {
        entitiesById: state.entitiesById,
        onClick: openDetail,
      }));
    } catch (error) {
      console.error('Architecture world map failed:', error);
    }
    $('#map-loading').classList.add('hidden');
    $('#map-fallback').classList.toggle('hidden', Boolean(ok));
  }

  function relationEndpointMatchesQuery(entityId, query) {
    if (!query) return true;
    const entity = state.entitiesById[entityId];
    if (!entity) return normalize(entityId).includes(query);
    return entitySearchText(entity).includes(query);
  }

  function isPersonLineageEndpoint(entityId) {
    const entity = state.entitiesById[entityId];
    return Boolean(entity && entity.entity_type === 'person');
  }

  function personLineageReviewRelations() {
    return state.data.relations.filter(function (relation) {
      if (!LINEAGE_RELATION_TYPES.includes(relation.relation_type)) return false;
      return isPersonLineageEndpoint(relation.from_id) &&
        isPersonLineageEndpoint(relation.to_id);
    });
  }

  function filteredLineageRelations() {
    const filters = state.lineageFilters;
    const query = normalize(filters.query);
    return state.data.relations.filter(function (relation) {
      if (!filters.relationTypes.has(relation.relation_type)) return false;
      if (!isPersonLineageEndpoint(relation.from_id) ||
        !isPersonLineageEndpoint(relation.to_id)) return false;
      if (!query) return true;
      return relationEndpointMatchesQuery(relation.from_id, query) ||
        relationEndpointMatchesQuery(relation.to_id, query);
    });
  }

  function renderLineage() {
    const total = personLineageReviewRelations().length;
    const relations = filteredLineageRelations();
    putText('#lineage-count', relations.length + ' / ' + total);
    const empty = $('#lineage-empty');
    if (empty) empty.classList.toggle('hidden', relations.length > 0);
    const list = $('#lineage-list');
    list.innerHTML = relations.map(function (relation) {
      const from = state.entitiesById[relation.from_id] || { name_en: relation.from_id };
      const to = state.entitiesById[relation.to_id] || { name_en: relation.to_id };
      const note = relation.context
        ? i18n.pick(relation.context.note_zh, relation.context.note_en)
        : i18n.t('relationReviewOnly');
      return '<li>' +
        '<div class="lineage-edge">' +
          '<button type="button" data-open-entity="' + escapeHtml(relation.from_id) + '">' +
            escapeHtml(i18n.name(from)) + '</button>' +
          '<button class="lineage-relation-button" type="button" data-open-relation="' +
            escapeHtml(relation.id) + '">' +
            '<span aria-hidden="true">⇢</span>' +
            '<span class="sr-only">' + escapeHtml(i18n.t('relationEvidence')) + '</span>' +
          '</button>' +
          '<button type="button" data-open-entity="' + escapeHtml(relation.to_id) + '">' +
            escapeHtml(i18n.name(to)) + '</button>' +
        '</div>' +
        '<small>' + escapeHtml(note) + '</small>' +
      '</li>';
    }).join('');
    let ok = false;
    try {
      ok = Boolean(maps && maps.renderLineage(relations, {
        entitiesById: state.entitiesById,
        onClick: openDetail,
        onRelationClick: openRelationDetail,
      }));
    } catch (error) {
      console.error('Architecture lineage graph failed:', error);
    }
    $('#lineage-fallback').classList.toggle('hidden', Boolean(ok));
  }

  function renderCoverage() {
    const manifest = state.data.manifest;
    const config = state.data.coverageConfig.coverage_grid;
    const percent = manifest.coverage.cells_total
      ? Math.round((manifest.coverage.cells_run / manifest.coverage.cells_total) * 100)
      : 0;
    putText('#coverage-percent', percent + '%');
    $('#coverage-progress-bar').style.width = percent + '%';

    const cellStatusById = {};
    (manifest.coverage.cells || []).forEach(function (cell) {
      cellStatusById[cell.cell_id] = cell;
    });

    const matrix = $('#coverage-matrix');
    matrix.replaceChildren();
    const headerRow = document.createElement('div');
    headerRow.className = 'matrix-row';
    headerRow.setAttribute('role', 'row');
    const corner = document.createElement('div');
    corner.className = 'matrix-cell header';
    corner.setAttribute('role', 'columnheader');
    corner.textContent = i18n.getLanguage() === 'zh' ? '区域 \\ 时期' : 'Region \\ period';
    headerRow.appendChild(corner);
    config.periods.forEach(function (period) {
      const header = document.createElement('div');
      header.className = 'matrix-cell header';
      header.setAttribute('role', 'columnheader');
      header.textContent = i18n.enumLabel('period', period.id);
      headerRow.appendChild(header);
    });
    matrix.appendChild(headerRow);
    config.regions.forEach(function (region) {
      const row = document.createElement('div');
      row.className = 'matrix-row';
      row.setAttribute('role', 'row');
      const header = document.createElement('div');
      header.className = 'matrix-cell header row-header';
      header.setAttribute('role', 'rowheader');
      header.textContent = i18n.enumLabel('region', region);
      row.appendChild(header);
      config.periods.forEach(function (period) {
        const cell = document.createElement('div');
        const cellId = region + '__' + period.id;
        const record = cellStatusById[cellId];
        const status = record ? record.status : 'not_run';
        cell.className = 'matrix-cell ' + status;
        cell.setAttribute('role', 'cell');
        let statusLabel = i18n.t('notRun');
        if (status === 'empty_observed') statusLabel = i18n.t('emptyObserved');
        if (status === 'sampled') statusLabel = i18n.t('sampled');
        if (status === 'truncated') statusLabel = i18n.t('complete');
        if (status === 'blocked') statusLabel = i18n.t('blocked');
        const detail = record
          ? ' (' + record.selected_count + '/' + record.candidate_count + ')'
          : '';
        cell.setAttribute('aria-label',
          i18n.enumLabel('region', region) + ', ' +
          i18n.enumLabel('period', period.id) + ': ' + statusLabel + detail);
        cell.textContent = status === 'not_run'
          ? statusLabel
          : statusLabel + detail;
        row.appendChild(cell);
      });
      matrix.appendChild(row);
    });

    const rows = Object.entries(manifest.coverage.fixture_distribution.regions);
    const maximum = Math.max.apply(null, rows.map(function (entry) { return entry[1]; }).concat([1]));
    $('#fixture-bars').innerHTML = rows.map(function (entry) {
      const width = Math.round((entry[1] / maximum) * 100);
      return '<div class="fixture-row">' +
        '<span>' + escapeHtml(i18n.enumLabel('region', entry[0])) + '</span>' +
        '<span class="bar"><i style="width:' + width + '%"></i></span>' +
        '<strong>' + escapeHtml(entry[1]) + '</strong>' +
      '</div>';
    }).join('');
  }

  function renderSources() {
    $('#source-grid').innerHTML = state.data.sources.map(function (source) {
      const title = i18n.pick(source.title_zh, source.title_en);
      const url = safeUrl(source.landing_url);
      const status = source.adapter_status || 'not_implemented';
      const operations = source.allowed_operations || {};
      const operationRows = [
        ['download', 'operationDownload'],
        ['retain_snapshot', 'operationSnapshot'],
        ['derive_facts', 'operationDerive'],
        ['redistribute_metadata', 'operationPublishMetadata'],
        ['redistribute_text', 'operationPublishText'],
        ['redistribute_media', 'operationPublishMedia'],
      ];
      const attribution = i18n.pick(source.attribution_zh, source.attribution_en);
      const biases = i18n.pick(source.known_biases_zh, source.known_biases_en);
      const scopes = (source.scope || []).slice(0, 5).map(function (scope) {
        return '<span>' + escapeHtml(i18n.enumLabel('scope', scope)) + '</span>';
      }).join('');
      const rights = operationRows.map(function (operation) {
        const allowed = operations[operation[0]] === true;
        return '<li class="' + (allowed ? 'allowed' : 'blocked') + '">' +
          '<span aria-hidden="true">' + (allowed ? '✓' : '—') + '</span>' +
          '<span>' + escapeHtml(i18n.t(operation[1])) + '</span>' +
          '<span class="sr-only">: ' +
            escapeHtml(i18n.t(allowed ? 'operationAllowed' : 'operationBlocked')) +
          '</span>' +
        '</li>';
      }).join('');
      return '<article class="source-card">' +
        '<div class="source-card-head">' +
          '<h4>' + escapeHtml(title) + '</h4>' +
          '<span class="adapter-chip ' + escapeHtml(status) + '">' +
            escapeHtml(i18n.enumLabel('adapter_status', status)) +
          '</span>' +
        '</div>' +
        '<p class="publisher">' + escapeHtml(source.publisher) + '</p>' +
        '<div class="source-scope">' + scopes + '</div>' +
        '<p class="reuse-row"><strong>' + escapeHtml(i18n.t('reuseDecision')) + '</strong>' +
          '<span>' + escapeHtml(i18n.enumLabel('reuse_class', source.reuse_class)) + '</span></p>' +
        '<div class="rights-block"><strong>' + escapeHtml(i18n.t('rightsOperations')) + '</strong>' +
          '<ul class="rights-ops">' + rights + '</ul></div>' +
        '<p class="license"><strong>' + escapeHtml(i18n.t('licenseLabel')) + '</strong>: ' +
          escapeHtml(source.metadata_license || i18n.t('unknown')) + '</p>' +
        '<details class="rights-details"><summary>' + escapeHtml(i18n.t('rightsNote')) + '</summary>' +
          '<p>' + escapeHtml(attribution) + '</p>' +
          (Array.isArray(biases) && biases.length
            ? '<p><strong>' + escapeHtml(i18n.t('knownBias')) + ':</strong> ' +
              escapeHtml(biases.join(' ')) + '</p>'
            : '') +
        '</details>' +
        (url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(i18n.t('sourceHome')) + '</a>' : '') +
      '</article>';
    }).join('');
  }

  function detailFact(label, value) {
    return '<div><dt>' + escapeHtml(label) + '</dt><dd>' +
      escapeHtml(value == null || value === '' ? i18n.t('noData') : value) +
    '</dd></div>';
  }

  function linkedRelationRows(entity) {
    return state.data.relations.filter(function (relation) {
      return relation.from_id === entity.id || relation.to_id === entity.id;
    });
  }

  function practiceAffiliationsHtml(entity) {
    if (entity.entity_type !== 'person') return '';
    const affiliations = linkedRelationRows(entity).filter(function (relation) {
      return PRACTICE_AFFILIATION_TYPES.has(relation.relation_type);
    });
    if (!affiliations.length) return '';
    return '<section class="detail-section"><h3>' +
      escapeHtml(i18n.t('detailPracticeAffiliations')) + '</h3>' +
      '<ul class="detail-list">' + affiliations.map(function (relation) {
        const outbound = relation.from_id === entity.id;
        const practiceId = outbound ? relation.to_id : relation.from_id;
        const practice = state.entitiesById[practiceId] || { name_en: practiceId };
        return '<li>' +
          '<button type="button" data-open-entity="' + escapeHtml(practiceId) + '">' +
            escapeHtml(i18n.name(practice)) + '</button> · ' +
          escapeHtml(i18n.enumLabel('relation_type', relation.relation_type)) + ' · ' +
          '<button class="relation-audit-button" type="button" data-open-relation="' +
            escapeHtml(relation.id) + '">' +
            escapeHtml(i18n.t('relationEvidence')) +
          '</button>' +
        '</li>';
      }).join('') + '</ul></section>';
  }

  function relationListHtml(entity) {
    const relations = linkedRelationRows(entity).filter(function (relation) {
      if (!LINEAGE_RELATION_TYPES.includes(relation.relation_type)) return false;
      const otherId = relation.from_id === entity.id ? relation.to_id : relation.from_id;
      return isPersonLineageEndpoint(otherId);
    });
    if (!relations.length) return '';
    return '<section class="detail-section"><h3>' + escapeHtml(i18n.t('detailRelations')) + '</h3>' +
      '<ul class="detail-list">' + relations.map(function (relation) {
        const outbound = relation.from_id === entity.id;
        const otherId = outbound ? relation.to_id : relation.from_id;
        const other = state.entitiesById[otherId] || { name_en: otherId };
        return '<li>' +
          (outbound ? '→ ' : '← ') +
          '<button type="button" data-open-entity="' + escapeHtml(otherId) + '">' +
            escapeHtml(i18n.name(other)) + '</button> · ' +
          escapeHtml(i18n.enumLabel('relation_type', relation.relation_type)) + ' · ' +
          '<button class="relation-audit-button" type="button" data-open-relation="' +
            escapeHtml(relation.id) + '">' +
            escapeHtml(i18n.t('relationEvidence')) +
          '</button>' +
        '</li>';
      }).join('') + '</ul></section>';
  }

  function referenceUrls(references) {
    const urls = [];
    (references || []).forEach(function (reference) {
      const snaks = reference && reference.snaks;
      (snaks && snaks.P854 || []).forEach(function (snak) {
        const value = snak && snak.datavalue && snak.datavalue.value;
        const url = safeUrl(value);
        if (url) urls.push(url);
      });
    });
    return unique(urls);
  }

  function evidenceHtml(evidence, index, total) {
    const pinnedUrl = safeUrl(evidence.url);
    const references = evidence.references || [];
    const qualifiers = evidence.qualifiers || [];
    const links = referenceUrls(references);
    const facts = [
      detailFact(i18n.t('evidenceSource'), evidence.source_id),
      detailFact(i18n.t('sourceRecordPlain'), evidence.native_record_id),
      detailFact(
        i18n.t('nativeField'),
        [evidence.native_predicate, evidence.native_field_path].filter(Boolean).join(' · ')
      ),
      detailFact(i18n.t('sourceLocator'), evidence.locator),
      detailFact(i18n.t('snapshotId'), evidence.snapshot_id),
      detailFact(i18n.t('recordHash'), evidence.source_record_sha256),
      detailFact(i18n.t('extractionMethod'), evidence.extraction_method),
      detailFact(
        i18n.t('supportAndRank'),
        [evidence.support, evidence.rank].filter(Boolean).join(' / ')
      ),
    ];
    const referenceLinks = links.map(function (url, linkIndex) {
      return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(i18n.t('referenceLink', { index: linkIndex + 1 })) + ' ↗</a>';
    }).join('');
    return '<article class="claim-evidence">' +
      '<h4>' + escapeHtml(i18n.t('evidenceItem', { index: index + 1, total: total })) + '</h4>' +
      '<dl class="evidence-grid">' + facts.join('') + '</dl>' +
      (pinnedUrl
        ? '<a href="' + escapeHtml(pinnedUrl) + '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(i18n.t('openPinnedSource')) + ' ↗</a>'
        : '') +
      '<details class="evidence-details"><summary>' +
        escapeHtml(i18n.t('evidenceReferences', { count: references.length })) +
      '</summary>' + referenceLinks +
        '<pre>' + escapeHtml(jsonText(references)) + '</pre></details>' +
      '<details class="evidence-details"><summary>' +
        escapeHtml(i18n.t('evidenceQualifiers', { count: qualifiers.length })) +
      '</summary><pre>' + escapeHtml(jsonText(qualifiers)) + '</pre></details>' +
    '</article>';
  }

  function claimsHtml(subject) {
    const claims = (subject.claim_ids || []).map(function (claimId) {
      return state.claimsById[claimId];
    }).filter(Boolean);
    if (!claims.length) return '';
    return '<details class="detail-section claims-disclosure"><summary>' +
      escapeHtml(i18n.t('detailClaims')) +
      '<span class="claims-disclosure-count">' +
        escapeHtml(i18n.t('claimsCount', { count: claims.length })) +
      '</span></summary>' +
      '<ul class="claim-list">' + claims.map(function (claim) {
        const evidence = claim.evidence || [];
        return '<li>' +
          '<div class="claim-head"><span>' +
            escapeHtml(i18n.enumLabel('predicate', claim.predicate)) +
          '</span><span class="status-chip ' + escapeHtml(claim.verification_status) + '">' +
            escapeHtml(i18n.enumLabel('verification_status', claim.verification_status)) +
          '</span></div>' +
          '<p class="claim-id">' + escapeHtml(claim.id) + '</p>' +
          '<div class="claim-payload"><strong>' + escapeHtml(i18n.t('claimObject')) +
            '</strong><pre>' + escapeHtml(jsonText(claim.object)) + '</pre></div>' +
          '<div class="claim-payload"><strong>' + escapeHtml(i18n.t('claimQualifiers')) +
            '</strong><pre>' + escapeHtml(jsonText(claim.qualifiers)) + '</pre></div>' +
          evidence.map(function (item, index) {
            return evidenceHtml(item, index, evidence.length);
          }).join('') +
        '</li>';
      }).join('') + '</ul></details>';
  }

  function creditsHtml(work) {
    if (!(work.credits || []).length && !(work.unresolved_credits || []).length) return '';
    let html = '<section class="detail-section"><h3>' + escapeHtml(i18n.t('detailCredits')) + '</h3>';
    if (work.credits.length) {
      html += '<ul class="detail-list">' + work.credits.map(function (credit) {
        const contributor = state.entitiesById[credit.entity_id] || { name_en: credit.entity_id };
        return '<li><button type="button" data-open-entity="' + escapeHtml(credit.entity_id) + '">' +
          escapeHtml(i18n.name(contributor)) + '</button> · ' +
          escapeHtml(i18n.enumLabel('role', credit.role)) + ' · ' +
          escapeHtml(i18n.enumLabel('verification_status', credit.credit_status)) +
        '</li>';
      }).join('') + '</ul>';
    }
    if ((work.unresolved_credits || []).length) {
      html += '<div class="unresolved-note"><strong>' +
        escapeHtml(i18n.t('unresolvedCredits')) + '</strong><br>' +
        escapeHtml(i18n.t('unresolvedCreditCopy', { count: work.unresolved_credits.length })) +
        '<ul>' + work.unresolved_credits.map(function (credit) {
          return '<li>' + escapeHtml(
            i18n.pick(credit.source_label_zh, credit.source_label_en) ||
            credit.source_entity_qid
          ) + ' · ' + escapeHtml(
            i18n.enumLabel('rejection_reason', credit.rejection_reason)
          ) + '</li>';
        }).join('') + '</ul></div>';
    }
    return html + '</section>';
  }

  function linkedWorksHtml(entity) {
    let works = [];
    if (entity.entity_type === 'person' || entity.entity_type === 'practice') {
      works = contributorWorks(entity.id);
    } else if (entity.entity_type === 'place') {
      works = placeWorks(entity.id);
    }
    if (!works.length) return '';
    return '<section class="detail-section"><h3>' + escapeHtml(i18n.t('detailWorks')) + '</h3>' +
      '<ul class="detail-list">' + works.map(function (work) {
        return '<li><button type="button" data-open-entity="' + escapeHtml(work.id) + '">' +
          escapeHtml(i18n.name(work)) + '</button> · ' +
          escapeHtml(i18n.enumLabel('verification_status', work.verification_status)) +
        '</li>';
      }).join('') + '</ul></section>';
  }

  function detailHtml(entity) {
    const type = i18n.enumLabel('entity_type', entity.entity_type);
    const secondary = i18n.secondaryName(entity);
    const external = entity.external_ids && Object.entries(entity.external_ids)[0];
    const facts = [
      detailFact(i18n.t('detailRegion'), i18n.enumLabel('region', entity.region)),
      detailFact(i18n.t('detailVerification'), i18n.enumLabel('verification_status', entity.verification_status)),
      detailFact(i18n.t('detailConfidence'), Math.round((entity.confidence || 0) * 100) + '%'),
      detailFact(i18n.t('detailExternalId'), external ? external[0] + ': ' + external[1] : i18n.t('noData')),
    ];
    if (entity.entity_type === 'work') {
      const place = state.entitiesById[entity.place_id];
      facts.push(detailFact(i18n.t('detailPlace'), place ? i18n.name(place) : i18n.t('noData')));
      facts.push(detailFact(i18n.t('detailPeriod'), i18n.enumLabel('period', entity.period)));
      facts.push(detailFact(i18n.t('detailWorkType'), i18n.enumLabel('work_type', entity.work_type)));
      facts.push(detailFact(i18n.t('detailTypeMapping'), i18n.enumLabel('work_type_mapping_status', entity.work_type_mapping_status)));
      facts.push(detailFact(
        i18n.t('detailCoordinates'),
        hasCoordinates(entity)
          ? entity.coordinates.lat.toFixed(6) + ', ' + entity.coordinates.lng.toFixed(6)
          : i18n.t('noData')
      ));
    }
    if (entity.entity_type === 'person') {
      facts.push(detailFact(i18n.t('detailNameStatus'), i18n.enumLabel('name_zh_status', entity.name_zh_status)));
    }
    if (entity.entity_type === 'place') {
      facts.push(detailFact(i18n.t('detailCountryCode'), entity.country_code || i18n.t('noData')));
    }

    return '<p class="detail-eyebrow">' +
        escapeHtml(i18n.t('detailsFor', { type: type })) +
      '</p>' +
      '<h2 id="detail-title">' + escapeHtml(i18n.name(entity)) + '</h2>' +
      (secondary ? '<p class="detail-secondary-name">' + escapeHtml(secondary) + '</p>' : '') +
      '<div class="detail-chips">' +
        '<span class="type-chip">' + escapeHtml(typeLabel(entity)) + '</span>' +
        statusChip(entity) +
        (entity.entity_type === 'work'
          ? '<span class="mapping-chip type-chip">' +
            escapeHtml(i18n.enumLabel('work_type_mapping_status', entity.work_type_mapping_status)) +
            '</span>'
          : '') +
      '</div>' +
      '<dl class="detail-summary-grid">' + facts.join('') + '</dl>' +
      (entity.entity_type === 'work' ? creditsHtml(entity) : linkedWorksHtml(entity)) +
      practiceAffiliationsHtml(entity) +
      relationListHtml(entity) +
      claimsHtml(entity);
  }

  function relationDetailHtml(relation) {
    const from = state.entitiesById[relation.from_id] || { name_en: relation.from_id };
    const to = state.entitiesById[relation.to_id] || { name_en: relation.to_id };
    const note = relation.context
      ? i18n.pick(relation.context.note_zh, relation.context.note_en)
      : i18n.t('relationReviewOnly');
    const facts = [
      detailFact(i18n.t('relationFrom'), i18n.name(from)),
      detailFact(i18n.t('relationTo'), i18n.name(to)),
      detailFact(
        i18n.t('relationType'),
        i18n.enumLabel('relation_type', relation.relation_type)
      ),
      detailFact(
        i18n.t('detailVerification'),
        i18n.enumLabel('verification_status', relation.verification_status)
      ),
      detailFact(
        i18n.t('detailConfidence'),
        Math.round((relation.confidence || 0) * 100) + '%'
      ),
      detailFact(i18n.t('detailExternalId'), relation.id),
    ];
    return '<p class="detail-eyebrow">' + escapeHtml(i18n.t('relationDetail')) + '</p>' +
      '<h2 id="detail-title">' +
        escapeHtml(i18n.name(from)) + ' ⇢ ' + escapeHtml(i18n.name(to)) +
      '</h2>' +
      '<div class="detail-chips">' +
        '<span class="type-chip">' +
          escapeHtml(i18n.enumLabel('relation_type', relation.relation_type)) +
        '</span>' +
        '<span class="status-chip ' + escapeHtml(relation.verification_status) + '">' +
          escapeHtml(i18n.enumLabel('verification_status', relation.verification_status)) +
        '</span>' +
      '</div>' +
      '<div class="relation-boundary"><strong>' +
        escapeHtml(i18n.t('relationReviewGate')) + '</strong><p>' +
        escapeHtml(i18n.t('relationRejectionReason')) + '</p><p>' +
        escapeHtml(note) + '</p></div>' +
      '<dl class="detail-summary-grid">' + facts.join('') + '</dl>' +
      '<section class="detail-section"><h3>' +
        escapeHtml(i18n.t('relationEndpoints')) + '</h3>' +
        '<ul class="detail-list"><li>' +
          '<button type="button" data-open-entity="' + escapeHtml(relation.from_id) + '">' +
            escapeHtml(i18n.name(from)) + '</button> ⇢ ' +
          '<button type="button" data-open-entity="' + escapeHtml(relation.to_id) + '">' +
            escapeHtml(i18n.name(to)) + '</button>' +
        '</li></ul></section>' +
      claimsHtml({ claim_ids: [relation.claim_id] });
  }

  function showDetailContent(html) {
    const modal = $('#detail-modal');
    const wasHidden = modal.classList.contains('hidden');
    const focusWasInside = modal.contains(document.activeElement);
    if (wasHidden) state.lastFocused = document.activeElement;
    $('#detail-content').innerHTML = html;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const panel = $('.detail-panel', modal);
    panel.scrollTop = 0;
    if (wasHidden || focusWasInside) panel.focus();
  }

  function openDetail(entityId) {
    const entity = state.entitiesById[entityId];
    if (!entity) return;
    state.detailEntityId = entityId;
    state.detailRelationId = null;
    showDetailContent(detailHtml(entity));
  }

  function openRelationDetail(relationId) {
    const relation = state.relationsById[relationId];
    if (!relation) return;
    state.detailEntityId = null;
    state.detailRelationId = relationId;
    showDetailContent(relationDetailHtml(relation));
  }

  function closeDetail() {
    const modal = $('#detail-modal');
    if (modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    state.detailEntityId = null;
    state.detailRelationId = null;
    if (state.lastFocused && document.contains(state.lastFocused)) state.lastFocused.focus();
  }

  function trapModalFocus(event) {
    if (event.key !== 'Tab') return;
    const modal = $('#detail-modal');
    if (modal.classList.contains('hidden')) return;
    const focusable = $$(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      modal
    ).filter(function (element) {
      return !element.closest('.hidden');
    });
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const panel = $('.detail-panel', modal);
    if (document.activeElement === panel) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function resetLineageFilters() {
    state.lineageFilters = {
      query: '',
      relationTypes: new Set(LINEAGE_RELATION_TYPES),
    };
    const search = $('#lineage-search');
    if (search) search.value = '';
    $$('[data-lineage-type]').forEach(function (button) {
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');
    });
    renderLineage();
  }

  function wireLineageFilters() {
    const search = $('#lineage-search');
    if (search) {
      search.addEventListener('input', function (event) {
        state.lineageFilters.query = event.target.value;
        renderLineage();
      });
    }
    const reset = $('#lineage-reset-filters');
    if (reset) reset.addEventListener('click', resetLineageFilters);
    $$('[data-lineage-type]').forEach(function (button) {
      button.addEventListener('click', function () {
        const relationType = button.dataset.lineageType;
        if (state.lineageFilters.relationTypes.has(relationType)) {
          if (state.lineageFilters.relationTypes.size === 1) return;
          state.lineageFilters.relationTypes.delete(relationType);
          button.classList.remove('active');
          button.setAttribute('aria-pressed', 'false');
        } else {
          state.lineageFilters.relationTypes.add(relationType);
          button.classList.add('active');
          button.setAttribute('aria-pressed', 'true');
        }
        renderLineage();
      });
    });
  }

  function resetFilters() {
    state.filters = {
      query: '',
      entityType: 'all',
      region: 'all',
      period: 'all',
      verification: 'all',
      workTypeMapping: 'all',
      hasChinese: false,
      hasCoordinates: false,
      hasCredits: false,
    };
    $('#catalog-search').value = '';
    $('#region-filter').value = 'all';
    $('#period-filter').value = 'all';
    $('#status-filter').value = 'all';
    $('#work-type-filter').value = 'all';
    $('#has-zh-filter').checked = false;
    $('#has-coordinates-filter').checked = false;
    $('#has-credits-filter').checked = false;
    $$('[data-entity-filter]').forEach(function (button) {
      const active = button.dataset.entityFilter === 'all';
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    renderCatalog();
    renderMap();
  }

  function wireFilters() {
    $('#catalog-search').addEventListener('input', function (event) {
      state.filters.query = event.target.value;
      renderCatalog();
      renderMap();
    });
    $('#region-filter').addEventListener('change', function (event) {
      state.filters.region = event.target.value;
      renderCatalog();
      renderMap();
    });
    $('#period-filter').addEventListener('change', function (event) {
      state.filters.period = event.target.value;
      renderCatalog();
      renderMap();
    });
    $('#status-filter').addEventListener('change', function (event) {
      state.filters.verification = event.target.value;
      renderCatalog();
      renderMap();
    });
    $('#work-type-filter').addEventListener('change', function (event) {
      state.filters.workTypeMapping = event.target.value;
      renderCatalog();
      renderMap();
    });
    [
      ['#has-zh-filter', 'hasChinese'],
      ['#has-coordinates-filter', 'hasCoordinates'],
      ['#has-credits-filter', 'hasCredits'],
    ].forEach(function (entry) {
      $(entry[0]).addEventListener('change', function (event) {
        state.filters[entry[1]] = event.target.checked;
        renderCatalog();
        renderMap();
      });
    });
    $$('[data-entity-filter]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.filters.entityType = button.dataset.entityFilter;
        $$('[data-entity-filter]').forEach(function (candidate) {
          const active = candidate === button;
          candidate.classList.toggle('active', active);
          candidate.setAttribute('aria-pressed', String(active));
        });
        renderCatalog();
      });
    });
    $('#reset-filters').addEventListener('click', resetFilters);
    $$('.catalog-table [data-sort]').forEach(function (button) {
      button.addEventListener('click', function () {
        const key = button.dataset.sort;
        if (state.sort.key === key) {
          state.sort.direction = state.sort.direction === 'ascending' ? 'descending' : 'ascending';
        } else {
          state.sort.key = key;
          state.sort.direction = 'ascending';
        }
        renderCatalog();
      });
    });
    document.addEventListener('keydown', function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        $('#catalog-search').focus();
      }
    });
  }

  function wireDelegation() {
    document.addEventListener('click', function (event) {
      const relationOpener = event.target.closest('[data-open-relation]');
      if (relationOpener) {
        event.preventDefault();
        openRelationDetail(relationOpener.dataset.openRelation);
        return;
      }
      const opener = event.target.closest('[data-open-entity]');
      if (opener) {
        event.preventDefault();
        openDetail(opener.dataset.openEntity);
        return;
      }
      const row = event.target.closest('[data-row-entity]');
      if (row) {
        openDetail(row.dataset.rowEntity);
      }
    });
    $('#detail-close').addEventListener('click', closeDetail);
    $('#detail-modal').addEventListener('click', function (event) {
      if (event.target === event.currentTarget) closeDetail();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeDetail();
      trapModalFocus(event);
    });
  }

  function renderAll() {
    renderMetrics();
    renderRegionOptions();
    renderPeriodOptions();
    renderCatalog();
    renderMap();
    renderLineage();
    renderCoverage();
    renderSources();
    if (state.detailRelationId) {
      openRelationDetail(state.detailRelationId);
    } else if (state.detailEntityId) {
      openDetail(state.detailEntityId);
    }
  }

  function sectionIdFromHash() {
    if (!window.location.hash) return '';
    try {
      const id = decodeURIComponent(window.location.hash.slice(1));
      return SECTION_IDS.has(id) ? id : '';
    } catch (_) {
      return '';
    }
  }

  function restoreInitialHashTarget() {
    const id = sectionIdFromHash();
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    const align = function () {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          target.scrollIntoView({ block: 'start' });
        });
      });
    };
    if (document.readyState === 'complete') {
      align();
    } else {
      window.addEventListener('load', align, { once: true });
    }
  }

  async function init() {
    try {
      if (!i18n || !loader || !maps) throw new Error('Required architecture-history modules are missing');
      const data = await loader.load();
      if (!data.manifest || data.manifest.data_version !== data.dataVersion) {
        throw new Error('Data manifest and loader version do not match');
      }
      state.data = data;
      buildIndexes(data);
      wireFilters();
      wireLineageFilters();
      wireDelegation();
      window.addEventListener('architecturehistory:languagechange', renderAll);
      window.addEventListener('architecturehistory:themechange', function () {
        renderMap();
        renderLineage();
      });
      renderAll();
      restoreInitialHashTarget();
    } catch (error) {
      console.error('Architecture Lineages init failed:', error);
      $('#map-loading').classList.add('hidden');
      $('#init-error').classList.remove('hidden');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
