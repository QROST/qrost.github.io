(function () {
  'use strict';

  const DATA = window.PEBBLE_DATA;
  if (!DATA) {
    document.addEventListener('DOMContentLoaded', () => {
      const root = document.getElementById('schedule-results');
      if (root) root.innerHTML = '<p class="empty-state" role="alert">数据暂时无法载入，请刷新页面。 / Planning data could not load; please refresh.</p>';
    });
    return;
  }

  const LANG_KEY = 'qrost-pebble-2026-lang';
  const THEME_KEY = 'qrost-pebble-2026-theme';
  // Keep every date-dependent archive decision deterministic. The historical
  // page never reads the visitor's clock or query-string simulation values.
  const ARCHIVE_REFERENCE_DATE = '2026-08-18';
  const state = {
    lang: 'zh',
    day: 'all',
    type: 'all',
    area: 'all',
    quickPastOpen: false,
    schedulePastOpen: false,
    navMenuOpen: false,
    from: 'monterey',
    to: 'pebble'
  };
  const mapState = { map: null, layer: null, markers: [] };
  const parkingTrafficState = {
    map: null,
    baseLayer: null,
    imageBounds: null,
    markerLayer: null,
    markers: new Map(),
    traffic: new Map(),
    day: DATA.parkingTrafficMap ? DATA.parkingTrafficMap.defaultDay : 'thu-sat',
    layer: DATA.parkingTrafficMap ? DATA.parkingTrafficMap.defaultLayer : 'guide',
    touchActive: false,
    coarsePointer: false,
    baseError: false
  };
  const parkingViewState = { active: 'geographic' };
  const parkingGeographicState = {
    map: null,
    tileLayer: null,
    anchorLayer: null,
    anchors: new Map(),
    touchActive: false,
    coarsePointer: false,
    tileError: false
  };
  const routeCache = new Map();
  const planMaps = new Map();
  let planMapObserver = null;
  let planMapGeneration = 0;
  let hasHandledInitialHash = false;
  const temporalUserOpen = new Map();

  function localized(value) {
    if (value && typeof value === 'object' && (value.zh || value.en)) return value[state.lang] || value.zh || value.en;
    return value == null ? '' : String(value);
  }

  function text(key) {
    return localized(DATA.labels[key]) || key;
  }

  function ui(key) {
    return localized(DATA.ui[key]) || key;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function dayRelation(dateIso) {
    if (dateIso < ARCHIVE_REFERENCE_DATE) return 'past';
    return 'upcoming';
  }

  function parseHm(hm) {
    const match = String(hm || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function parseTimeWindows(timeStr) {
    const raw = String(timeStr || '').trim();
    if (!raw) return [];
    const segments = raw.split(/\s*\/\s*/);
    const windows = [];
    for (let segment of segments) {
      segment = segment.trim();
      if (!segment) continue;
      const segmentPlus = segment.endsWith('+');
      if (segmentPlus) segment = segment.slice(0, -1).trim();
      const rangeMatch = segment.match(/^(\d{1,2}:\d{2})\s*[–-]\s*(.*)$/);
      if (rangeMatch) {
        const start = parseHm(rangeMatch[1]);
        const endPart = rangeMatch[2].trim();
        let end;
        if (!endPart) {
          end = start != null ? start + 6 * 60 : null;
        } else {
          const endPlus = endPart.endsWith('+');
          const endHm = endPlus ? endPart.slice(0, -1).trim() : endPart;
          end = parseHm(endHm);
          if (end != null && (segmentPlus || endPlus)) end += 60;
        }
        if (start != null && end != null) windows.push({ start, end });
      } else {
        const single = segment.replace(/\+$/, '').trim();
        const start = parseHm(single);
        if (start != null) {
          const end = start + 90 + (segmentPlus ? 60 : 0);
          windows.push({ start, end });
        }
      }
    }
    return windows;
  }

  function quickPlanDateIso(item) {
    return item && typeof item.dateIso === 'string' ? item.dateIso : '';
  }

  function areaName(areaId) {
    const area = (DATA.liveAreas || []).find((entry) => entry.id === areaId);
    return area ? localized(area.name) : areaId;
  }

  function matchesArchiveFilters(event) {
    if (state.type !== 'all' && !event.categories.includes(state.type)) return false;
    if (state.area !== 'all' && event.area !== state.area) return false;
    if (state.day !== 'all' && event.date !== state.day) return false;
    return true;
  }

  function statusWithCount(key, count) {
    const template = text(key);
    return template.replace('{count}', String(count));
  }

  function formatPlanningDateRange(dateIds) {
    const ordered = Array.from(new Set((dateIds || []).filter(Boolean))).sort();
    if (!ordered.length) return '';
    const parse = (dateIso) => {
      const match = String(dateIso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
    };
    const first = parse(ordered[0]);
    const last = parse(ordered.at(-1));
    if (!first || !last) return `${ordered[0]}–${ordered.at(-1)}`;
    if (state.lang === 'zh') {
      if (first.year === last.year && first.month === last.month) {
        return first.day === last.day ? `${first.month}.${first.day}` : `${first.month}.${first.day}–${last.day}`;
      }
      return `${first.month}.${first.day}–${last.month}.${last.day}`;
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (first.year === last.year && first.month === last.month) {
      return first.day === last.day
        ? `${months[first.month - 1]} ${first.day}`
        : `${months[first.month - 1]} ${first.day}–${last.day}`;
    }
    return `${months[first.month - 1]} ${first.day}–${months[last.month - 1]} ${last.day}`;
  }

  function planningGroupSummary(dateIds, eventCount, archived) {
    const uniqueDates = Array.from(new Set((dateIds || []).filter(Boolean))).sort();
    return text(archived ? 'archiveSummary' : 'pastGroupSummary')
      .replace('{range}', formatPlanningDateRange(uniqueDates))
      .replace('{days}', String(uniqueDates.length))
      .replace('{count}', String(eventCount));
  }

  function splitChronologicalEntries(entries, dateOf) {
    const ordered = [...entries].sort((left, right) => dateOf(left).localeCompare(dateOf(right)));
    return {
      archived: ordered.filter((entry) => dayRelation(dateOf(entry)) === 'past'),
      later: ordered.filter((entry) => dayRelation(dateOf(entry)) !== 'past')
    };
  }

  function chronologicalFoldMarkup(archiveMarkup, laterMarkup) {
    return `${archiveMarkup}${laterMarkup}`;
  }

  function eventStartMinutes(event) {
    const starts = parseTimeWindows(event && event.time).map((window) => window.start).filter(Number.isFinite);
    if (starts.length) return Math.min(...starts);
    const firstClock = String(event && event.time || '').match(/\b(\d{1,2}:\d{2})\b/);
    const fallback = firstClock ? parseHm(firstClock[1]) : null;
    return Number.isFinite(fallback) ? fallback : Number.POSITIVE_INFINITY;
  }

  function sortEventsChronologically(events) {
    return events
      .map((event, sourceIndex) => ({ event, sourceIndex, start: eventStartMinutes(event) }))
      .sort((left, right) => {
        if (left.start !== right.start) return left.start < right.start ? -1 : 1;
        return left.sourceIndex - right.sourceIndex;
      })
      .map((entry) => entry.event);
  }

  function focusRenderedFilter(attribute, value) {
    const replacement = Array.from(document.querySelectorAll(`[${attribute}]`))
      .find((element) => element.getAttribute(attribute) === value);
    if (replacement) replacement.focus();
  }

  function hashTargetElement() {
    if (!window.location.hash || window.location.hash === '#') return null;
    try { return document.getElementById(decodeURIComponent(window.location.hash.slice(1))); } catch (_) { return null; }
  }

  function setTemporalOpen(details, open) {
    if (details.open === open) return;
    details.dataset.temporalSync = 'true';
    details.open = open;
    window.setTimeout(() => { delete details.dataset.temporalSync; }, 100);
  }

  function invalidateVisibleMaps() {
    if (mapState.map) window.setTimeout(() => mapState.map.invalidateSize(), 40);
    if (parkingTrafficState.map) window.setTimeout(() => parkingTrafficState.map.invalidateSize(), 40);
    if (parkingGeographicState.map) window.setTimeout(() => parkingGeographicState.map.invalidateSize(), 40);
    invalidatePlanMaps();
  }

  function applyTemporalSections() {
    const target = hashTargetElement();
    document.querySelectorAll('[data-temporal-section]').forEach((section) => {
      const details = section.querySelector(':scope > [data-temporal-details]');
      const summary = section.querySelector('[data-temporal-summary]');
      const through = section.getAttribute('data-through-date') || '';
      const labelKey = section.getAttribute('data-temporal-label-key');
      const archived = Boolean(through && ARCHIVE_REFERENCE_DATE > through);
      section.classList.toggle('is-past', archived);
      if (summary && labelKey) summary.textContent = text(labelKey);
      if (!details) return;
      const targetInside = Boolean(target && (target === section || section.contains(target)));
      if (targetInside) setTemporalOpen(details, true);
      else if (temporalUserOpen.has(section.id)) setTemporalOpen(details, temporalUserOpen.get(section.id));
      else setTemporalOpen(details, !archived);
    });
  }

  function setHeroAction(link, action) {
    if (!link || !action) return;
    const label = link.matches('[data-i18n]') ? link : link.querySelector('[data-i18n]');
    link.setAttribute('href', action.href);
    link.setAttribute('data-hero-intent', action.intent);
    if (label) {
      label.setAttribute('data-i18n', action.labelKey);
      label.textContent = text(action.labelKey);
    }
  }

  function updateHeroCtas() {
    const action = (DATA.heroActions || []).find((item) => item.id === 'archive') || null;
    const primary = document.getElementById('hero-primary-cta');
    const secondary = document.getElementById('hero-secondary-cta');
    if (action && action.primary.href !== action.secondary.href) {
      setHeroAction(primary, action.primary);
      setHeroAction(secondary, action.secondary);
    }
    const tourNav = document.getElementById('tour-nav-link');
    if (tourNav) {
      const navKey = 'navTourArchive';
      tourNav.setAttribute('data-i18n', navKey);
      tourNav.textContent = text(navKey);
      tourNav.classList.add('archive-nav-link');
    }
  }

  function activateHeroIntent(intent) {
    if (intent === 'schedule-archive') {
      state.day = 'all';
      state.area = 'all';
      state.type = 'all';
      state.schedulePastOpen = intent === 'schedule-archive';
      renderScheduleFilters();
      renderSchedule();
      return;
    }
    if (intent === 'quick-archive') {
      state.quickPastOpen = true;
      renderQuickPlan();
      schedulePlanMaps();
    }
  }

  function updateSectionNavUi() {
    const toggle = document.getElementById('section-nav-toggle');
    const links = document.getElementById('primary-nav-links');
    if (!toggle || !links) return;
    const key = state.navMenuOpen ? 'navMenuClose' : 'navMenuOpen';
    toggle.setAttribute('aria-expanded', state.navMenuOpen ? 'true' : 'false');
    toggle.setAttribute('aria-label', text(key));
    toggle.setAttribute('title', text(key));
    links.classList.toggle('is-open', state.navMenuOpen);
  }

  function focusFragmentTarget(hash) {
    if (!hash || hash === '#') return;
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch (_) { return; }
    const target = document.getElementById(id);
    if (!target) return;
    const hadTabIndex = target.hasAttribute('tabindex');
    if (!hadTabIndex) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    if (!hadTabIndex) {
      target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    }
  }

  function revealHashTarget(shouldScroll) {
    const target = hashTargetElement();
    if (!target) return;
    if (target instanceof HTMLDetailsElement) target.open = true;
    let parent = target.parentElement;
    while (parent) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
      parent = parent.parentElement;
    }
    if (target.matches('[data-temporal-section]')) {
      const details = target.querySelector(':scope > [data-temporal-details]');
      if (details) details.open = true;
    }
    invalidateVisibleMaps();
    if (shouldScroll) {
      const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.setTimeout(() => target.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' }), 60);
    }
  }

  function isDark() {
    return document.documentElement.classList.contains('dark');
  }

  function setMeta(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.setAttribute('content', value);
  }

  function applyStaticTranslations() {
    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
    document.title = text('pageTitle');
    setMeta('meta[name="description"]', text('metaDescription'));
    setMeta('meta[property="og:title"]', text('ogTitle'));
    setMeta('meta[property="og:description"]', text('ogDescription'));
    setMeta('meta[property="og:image:alt"]', state.lang === 'zh'
      ? '2026 Monterey Car Week 圆石滩车展公众指南历史存档'
      : 'Historical archive of the 2026 Pebble Beach and Monterey Car Week public guide');
    setMeta('meta[name="twitter:title"]', text('ogTitle'));
    setMeta('meta[name="twitter:description"]', text('ogDescription'));

    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.getAttribute('data-i18n');
      if (DATA.labels[key]) element.textContent = text(key);
    });
    document.querySelectorAll('[data-i18n-alt]').forEach((element) => {
      const key = element.getAttribute('data-i18n-alt');
      if (DATA.labels[key]) element.setAttribute('alt', text(key));
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
      const key = element.getAttribute('data-i18n-aria-label');
      if (DATA.labels[key]) element.setAttribute('aria-label', text(key));
    });

    const nav = document.querySelector('.site-nav');
    if (nav) nav.setAttribute('aria-label', state.lang === 'zh' ? '主要导航' : 'Primary navigation');
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) navLinks.setAttribute('aria-label', state.lang === 'zh' ? '页面章节' : 'Page sections');
    const routeCard = document.querySelector('.route-card');
    if (routeCard) routeCard.setAttribute('aria-label', text('mapAria'));
    const hubMap = document.getElementById('hub-map');
    if (hubMap) hubMap.setAttribute('aria-label', text('mapAria'));
    const mapTitle = document.getElementById('map-title');
    const mapDesc = document.getElementById('map-desc');
    if (mapTitle) mapTitle.textContent = state.lang === 'zh' ? '蒙特雷半岛活动区域' : 'Monterey Peninsula event hubs';
    if (mapDesc) mapDesc.textContent = state.lang === 'zh'
      ? '以 OpenStreetMap 底图与真实坐标标注 Pebble Beach、Carmel、Carmel Valley、Pacific Grove、Monterey、Seaside 与 Laguna Seca。'
      : 'OpenStreetMap basemap with real coordinates for Pebble Beach, Carmel, Carmel Valley, Pacific Grove, Monterey, Seaside and Laguna Seca.';

    const wordmark = document.querySelector('.wordmark');
    if (wordmark) wordmark.setAttribute('aria-label', state.lang === 'zh' ? '返回 QROST 首页' : 'Back to QROST home');
    const backToTop = document.getElementById('back-to-top');
    if (backToTop) {
      backToTop.setAttribute('aria-label', text('navBackTop'));
      backToTop.setAttribute('title', text('navBackTop'));
    }
    updateSectionNavUi();
    const filterPanel = document.querySelector('.filter-panel');
    if (filterPanel) filterPanel.setAttribute('aria-label', state.lang === 'zh' ? '日程筛选' : 'Schedule filters');
    const kpis = document.querySelector('.kpi-strip');
    if (kpis) kpis.setAttribute('aria-label', state.lang === 'zh' ? '关键规划信息' : 'Key planning facts');
    const fromSelect = document.getElementById('commute-from');
    const toSelect = document.getElementById('commute-to');
    if (fromSelect) fromSelect.setAttribute('aria-label', state.lang === 'zh' ? '住宿区域' : 'Lodging area');
    if (toSelect) toSelect.setAttribute('aria-label', state.lang === 'zh' ? '活动会场' : 'Event hub');
  }

  function updateToggleUi() {
    const langButton = document.getElementById('lang-toggle');
    if (langButton) {
      langButton.textContent = state.lang === 'zh' ? 'EN' : '中';
      langButton.setAttribute('aria-label', ui('langAria'));
      langButton.setAttribute('title', state.lang === 'zh' ? 'English' : '中文');
    }

    const themeButton = document.getElementById('theme-toggle');
    if (themeButton) {
      const dark = isDark();
      themeButton.setAttribute('aria-label', ui(dark ? 'lightAria' : 'darkAria'));
      themeButton.setAttribute('title', ui(dark ? 'lightTitle' : 'darkTitle'));
    }
  }

  function renderTourMorning() {
    const tour = DATA.tourMorning;
    if (!tour) return;

    const routeRoot = document.getElementById('tour-route');
    if (routeRoot) {
      routeRoot.innerHTML = (tour.route || []).map((road) => (
        `<span class="tour-route-step" role="listitem">${escapeHtml(road)}</span>`
      )).join('');
    }

    const waveRoot = document.getElementById('tour-wave-list');
    if (waveRoot) {
      waveRoot.innerHTML = (tour.waves || []).map((wave, index) => {
        const label = state.lang === 'zh' ? `第 ${index + 1} 批` : `Wave ${index + 1}`;
        const datetime = `${tour.date}T${wave}:00-07:00`;
        return `<span class="tour-wave" role="listitem"><span>${escapeHtml(label)}</span><time datetime="${escapeHtml(datetime)}">${escapeHtml(wave)}</time></span>`;
      }).join('');
    }

    const toneKeys = {
      guide: 'tourToneGuide',
      official: 'tourToneOfficial',
      walk: 'tourToneWalk'
    };
    const planRoot = document.getElementById('tour-plan-list');
    if (planRoot) {
      planRoot.innerHTML = (tour.viewingPlan || []).map((step) => {
        const tone = toneKeys[step.tone] ? step.tone : 'guide';
        const datetime = `${tour.date}T${step.start}:00-07:00`;
        return `<li class="tour-plan-item tone-${escapeHtml(tone)}">
          <div class="tour-plan-meta">
            <time datetime="${escapeHtml(datetime)}">${escapeHtml(step.time)}</time>
            <span class="tour-plan-tone">${escapeHtml(text(toneKeys[tone]))}</span>
          </div>
          <h4>${escapeHtml(localized(step.title))}</h4>
          <p>${escapeHtml(localized(step.note))}</p>
        </li>`;
      }).join('');
    }

    const parkingLinkHtml = (link) => {
      const type = ['source', 'map'].includes(link.type) ? link.type : 'source';
      return `<a class="tour-parking-link is-${escapeHtml(type)}" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(localized(link.label))}<span aria-hidden="true">↗</span></a>`;
    };
    const alternativeRoot = document.getElementById('tour-parking-alternative-list');
    if (alternativeRoot) {
      alternativeRoot.innerHTML = (tour.parkingAlternatives || []).map((option) => {
        const tone = ['campus', 'city'].includes(option.tone) ? option.tone : 'city';
        return `<article class="tour-parking-option tone-${escapeHtml(tone)}" role="listitem">
          <span class="tour-parking-option-badge">${escapeHtml(localized(option.badge))}</span>
          <h4>${escapeHtml(localized(option.title))}</h4>
          <dl class="tour-parking-option-facts">
            <div><dt>${escapeHtml(text('tourParkingPlaceLabel'))}</dt><dd><address>${escapeHtml(localized(option.place))}</address></dd></div>
            <div><dt>${escapeHtml(text('tourParkingCostLabel'))}</dt><dd>${escapeHtml(localized(option.cost))}</dd></div>
            <div><dt>${escapeHtml(text('tourParkingWalkLabel'))}</dt><dd>${escapeHtml(localized(option.walk))}</dd></div>
            <div><dt>${escapeHtml(text('tourParkingWatchLabel'))}</dt><dd>${escapeHtml(localized(option.watch))}</dd></div>
          </dl>
          <div class="tour-parking-option-note"><strong>${escapeHtml(text('tourParkingBestLabel'))}</strong><p>${escapeHtml(localized(option.best))}</p></div>
          <div class="tour-parking-option-note is-boundary"><strong>${escapeHtml(text('tourParkingRuleLabel'))}</strong><p>${escapeHtml(localized(option.rule))}</p></div>
          <div class="tour-parking-links">${(option.links || []).map(parkingLinkHtml).join('')}</div>
        </article>`;
      }).join('');
    }

    const noGoRoot = document.getElementById('tour-parking-no-go-list');
    if (noGoRoot) {
      noGoRoot.innerHTML = (tour.parkingExclusions || []).map((item) => (
        `<li class="tour-parking-no-go-item">
          <div><h4>${escapeHtml(localized(item.title))}</h4><p>${escapeHtml(localized(item.body))}</p></div>
          <div class="tour-parking-links">${(item.links || []).map(parkingLinkHtml).join('')}</div>
        </li>`
      )).join('');
    }

    const sourceRoot = document.getElementById('tour-source-list');
    if (sourceRoot) {
      sourceRoot.innerHTML = (tour.sources || []).map((source) => (
        `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(localized(source.label))}<span aria-hidden="true">↗</span></a>`
      )).join('');
    }
  }

  function parkingTrafficConfig() {
    return DATA.parkingTrafficMap || null;
  }

  function parkingGeographicConfig() {
    return DATA.parkingGeographicGuide || null;
  }

  function parkingGeographicSource(sourceId) {
    const config = parkingGeographicConfig();
    return config ? (config.sources || []).find((source) => source.id === sourceId) : null;
  }

  function parkingGeographicKindLabel(anchor) {
    const labels = {
      'road-area': 'parkingGeoKindRoad',
      'venue-area': 'parkingGeoKindVenue',
      landmark: 'parkingGeoKindLandmark',
      'gate-reference': 'parkingGeoKindGate'
    };
    return text(labels[anchor.kind] || 'parkingGeoKindLandmark');
  }

  function parkingGeographicAccuracy(anchor) {
    return text('parkingGeoAccuracy').replace('{meters}', String(anchor.accuracyM));
  }

  function parkingGeographicListItem(anchor, index) {
    const code = ['P', 'F', 'H', 'G', 'E'][index] || String(index + 1);
    const tone = anchor.kind === 'road-area'
      ? 'guide'
      : (anchor.kind === 'venue-area' ? 'ada' : (anchor.kind === 'gate-reference' ? 'transit' : 'general'));
    return `<li class="parking-map-list-item parking-geographic-list-item kind-${escapeHtml(tone)}">
      <button type="button" data-parking-geographic-focus="${escapeHtml(anchor.id)}" aria-label="${escapeHtml(`${text('parkingMapLocate')}: ${localized(anchor.name)}`)}">
        <span class="parking-map-list-code">${escapeHtml(code)}</span>
        <span class="parking-map-list-copy">
          <span class="parking-map-list-meta"><strong>${escapeHtml(localized(anchor.name))}</strong><em>${escapeHtml(parkingGeographicKindLabel(anchor))}</em></span>
          <span>${escapeHtml(localized(anchor.use))}</span>
          <small>${escapeHtml(parkingGeographicAccuracy(anchor))} · ${escapeHtml(text('parkingGeoNoNavigation'))}</small>
        </span>
      </button>
    </li>`;
  }

  function updateParkingGeographicStatus(selectedName) {
    const status = document.getElementById('parking-geographic-status');
    const config = parkingGeographicConfig();
    if (!status || !config) return;
    const countText = statusWithCount('parkingGeoStatus', (config.anchors || []).length);
    const selected = selectedName ? ` · ${text('parkingGeoSelected').replace('{name}', selectedName)}` : '';
    const failure = parkingGeographicState.tileError ? ` · ${text('parkingGeoTileError')}` : '';
    status.textContent = `${countText}${selected}${failure}`;
  }

  function renderParkingGeographicList() {
    const config = parkingGeographicConfig();
    const root = document.getElementById('parking-geographic-list');
    if (!config || !root) return;
    root.innerHTML = (config.anchors || []).map(parkingGeographicListItem).join('');
    updateParkingGeographicStatus();
  }

  function renderParkingViewTabs() {
    const validMode = parkingViewState.active === 'official' ? 'official' : 'geographic';
    parkingViewState.active = validMode;
    document.querySelectorAll('[data-parking-view]').forEach((tab) => {
      const selected = tab.getAttribute('data-parking-view') === validMode;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.setAttribute('tabindex', selected ? '0' : '-1');
    });
    for (const mode of ['geographic', 'official']) {
      const panel = document.getElementById(`parking-panel-${mode}`);
      if (panel) panel.hidden = mode !== validMode;
    }
  }

  function parkingPointVisible(point) {
    const day = parkingTrafficState.day;
    const layer = parkingTrafficState.layer;
    if (!(point.dayScopes || []).includes(day)) return false;
    if (layer === 'all') return true;
    if (layer === 'guide') return (point.guideScopes || []).includes(day);
    if (layer === 'ada') return (point.adaScopes || []).includes(day);
    if (layer === 'general') return (point.layers || []).includes('general');
    if (layer === 'assigned') return (point.layers || []).includes('assigned');
    return false;
  }

  function parkingTrafficVisible(control) {
    const day = parkingTrafficState.day;
    const layer = parkingTrafficState.layer;
    if (!(control.dayScopes || []).includes(day)) return false;
    if (layer === 'all' || layer === 'traffic') return true;
    return layer === 'guide' && (control.guideScopes || []).includes(day);
  }

  function visibleParkingPoints() {
    const config = parkingTrafficConfig();
    return config ? (config.points || []).filter(parkingPointVisible) : [];
  }

  function visibleParkingTraffic() {
    const config = parkingTrafficConfig();
    return config ? (config.trafficControls || []).filter(parkingTrafficVisible) : [];
  }

  function parkingPointKind(point) {
    if ((point.adaScopes || []).includes(parkingTrafficState.day)) return 'ada';
    if (point.kind === 'guide') return 'guide';
    if (point.kind === 'general' || (point.layers || []).includes('general')) return 'general';
    if (point.kind === 'transit') return 'transit';
    return 'assigned';
  }

  function parkingPointKindLabel(point) {
    const keyByKind = {
      guide: 'parkingMapKindGuide',
      general: 'parkingMapKindGeneral',
      ada: 'parkingMapKindAda',
      assigned: 'parkingMapKindAssigned',
      transit: 'parkingMapKindTransit'
    };
    return text(keyByKind[parkingPointKind(point)] || 'parkingMapKindAssigned');
  }

  function parkingEvidenceLabel(point) {
    return text(point.evidence === 'official' ? 'parkingMapOfficialEvidence' : 'parkingMapPhotoEvidence');
  }

  function renderParkingTrafficControls() {
    const config = parkingTrafficConfig();
    if (!config) return;

    const dayRoot = document.getElementById('parking-map-day-filter');
    if (dayRoot) {
      dayRoot.setAttribute('aria-label', text('parkingMapDayLegend'));
      dayRoot.innerHTML = (config.dayScopes || []).map((scope) => (
        `<button type="button" class="parking-map-filter-button" data-parking-day="${escapeHtml(scope.id)}" aria-pressed="${scope.id === parkingTrafficState.day ? 'true' : 'false'}">
          <span>${escapeHtml(text(scope.labelKey))}</span><small>${escapeHtml(scope.hours)}</small>
        </button>`
      )).join('');
    }

    const layerRoot = document.getElementById('parking-map-layer-filter');
    if (layerRoot) {
      layerRoot.setAttribute('aria-label', text('parkingMapLayerLegend'));
      layerRoot.innerHTML = (config.layerFilters || []).map((filter) => (
        `<button type="button" class="parking-map-filter-button is-layer" data-parking-layer="${escapeHtml(filter.id)}" aria-pressed="${filter.id === parkingTrafficState.layer ? 'true' : 'false'}">${escapeHtml(text(filter.labelKey))}</button>`
      )).join('');
    }

    const legendRoot = document.getElementById('parking-map-line-legend');
    if (legendRoot) {
      legendRoot.setAttribute('aria-label', text('parkingMapLayerTraffic'));
      const kinds = [
        ['loop', 'parkingMapTrafficLoop'],
        ['oneway', 'parkingMapTrafficOneWay'],
        ['closed', 'parkingMapTrafficClosed'],
        ['permit', 'parkingMapTrafficPermit'],
        ['test', 'parkingMapTrafficTest']
      ];
      legendRoot.innerHTML = kinds.map(([kind, key]) => (
        `<span><i class="parking-line-swatch kind-${escapeHtml(kind)}" aria-hidden="true"></i>${escapeHtml(text(key))}</span>`
      )).join('');
    }
    updateParkingTouchToggle();
  }

  function parkingListItem(point) {
    const kind = parkingPointKind(point);
    const label = `${point.code} · ${localized(point.name)}`;
    return `<li class="parking-map-list-item kind-${escapeHtml(kind)}">
      <button type="button" data-parking-focus="${escapeHtml(point.id)}" aria-label="${escapeHtml(`${text('parkingMapLocate')}: ${label}`)}">
        <span class="parking-map-list-code">${escapeHtml(point.code)}</span>
        <span class="parking-map-list-copy">
          <span class="parking-map-list-meta"><strong>${escapeHtml(localized(point.name))}</strong><em>${escapeHtml(parkingPointKindLabel(point))}</em></span>
          <span>${escapeHtml(localized(point.audience))}</span>
          <small>${escapeHtml(localized(point.access))}</small>
        </span>
      </button>
    </li>`;
  }

  function parkingTrafficListItem(control) {
    return `<li class="parking-map-list-item is-traffic kind-${escapeHtml(control.kind)}">
      <button type="button" data-parking-traffic-focus="${escapeHtml(control.id)}" aria-label="${escapeHtml(`${text('parkingMapLocate')}: ${text(control.labelKey)}`)}">
        <span class="parking-map-list-code" aria-hidden="true">↝</span>
        <span class="parking-map-list-copy">
          <span class="parking-map-list-meta"><strong>${escapeHtml(text(control.labelKey))}</strong><em>${escapeHtml(text('parkingMapLayerTraffic'))}</em></span>
          <small>${escapeHtml(localized(control.note))}</small>
        </span>
      </button>
    </li>`;
  }

  function updateParkingMapStatus(count) {
    const status = document.getElementById('parking-map-status');
    if (!status) return;
    const countText = count ? statusWithCount('parkingMapStatus', count) : text('parkingMapEmpty');
    status.textContent = parkingTrafficState.baseError
      ? `${countText} · ${text('parkingMapTileError')}`
      : countText;
  }

  function renderParkingTrafficList() {
    const points = visibleParkingPoints();
    const traffic = visibleParkingTraffic();
    const root = document.getElementById('parking-map-list');
    if (root) {
      root.innerHTML = [
        ...points.map(parkingListItem),
        ...traffic.map(parkingTrafficListItem)
      ].join('');
      if (!points.length && !traffic.length) {
        root.innerHTML = `<li class="parking-map-empty">${escapeHtml(text('parkingMapEmpty'))}</li>`;
      }
    }
    updateParkingMapStatus(points.length + traffic.length);
  }

  function renderParkingTraffic() {
    if (!parkingTrafficConfig()) return;
    renderParkingViewTabs();
    renderParkingTrafficControls();
    renderParkingTrafficList();
    renderParkingGeographicList();
    if (parkingViewState.active === 'official') {
      ensureParkingTrafficMap();
      syncParkingTrafficMap();
    } else {
      ensureParkingGeographicMap();
      syncParkingGeographicMap();
    }
  }

  function renderBrandHouses() {
    const guide = DATA.brandHouseGuide;
    const root = document.getElementById('brand-house-grid');
    if (!guide || !root) return;

    const openDetailIds = new Set(Array.from(root.querySelectorAll('details[data-brand-detail-id][open]')).map((item) => item.dataset.brandDetailId));
    const openEvidenceIds = new Set(Array.from(root.querySelectorAll('details[data-brand-evidence-id][open]')).map((item) => item.dataset.brandEvidenceId));
    const openLaneIds = new Set(Array.from(root.querySelectorAll('details[data-brand-lane-fold][open]')).map((item) => item.dataset.brandLaneFold));
    const openPastGroupIds = new Set(Array.from(root.querySelectorAll('details[data-brand-past-group][open]')).map((item) => item.dataset.brandPastGroup));
    const guideNotesOpen = Boolean(root.querySelector('details[data-brand-guide-notes][open]'));
    const archiveDate = ARCHIVE_REFERENCE_DATE;
    const cardsById = new Map((guide.cards || []).map((card) => [card.id, card]));
    const sourceLinks = (card) => `<div class="brand-house-source-block">
      <strong>${escapeHtml(text('brandHouseSourcesLabel'))}</strong>
      <div class="brand-house-source-links">${(card.sources || []).map((source) => (
        `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(localized(source.label))}<span aria-hidden="true">↗</span></a>`
      )).join('')}</div>
    </div>`;
    const fieldReport = (card) => card.fieldReport ? `<aside class="brand-house-field-report">
      <strong>${escapeHtml(text('brandHouseFieldReportLabel'))} · ${escapeHtml(card.fieldReport.date)}</strong>
      <p>${escapeHtml(localized(card.fieldReport.body))}</p>
    </aside>` : '';
    const evidenceDetails = (card) => {
      const open = openEvidenceIds.has(card.id) ? ' open' : '';
      return `<details class="brand-house-evidence" data-brand-evidence-id="${escapeHtml(card.id)}"${open}>
        <summary>${escapeHtml(text('brandHouseEvidenceLabel'))}<span aria-hidden="true">${(card.sources || []).length + (card.fieldReport ? 1 : 0)}</span></summary>
        <div class="brand-house-evidence-content">${fieldReport(card)}${sourceLinks(card)}</div>
      </details>`;
    };
    const disclosureAction = () => `<span class="brand-house-row-action" aria-hidden="true"><span class="brand-house-action-closed">${escapeHtml(text('brandHouseExpandLabel'))}</span><span class="brand-house-action-open">${escapeHtml(text('brandHouseCollapseLabel'))}</span></span>`;
    const cardBadge = (card) => localized(card.badgeByDate?.[archiveDate] || card.badge);
    const cardSummary = (card) => localized(card.summaryByDate?.[archiveDate] || card.summary);
    const disclosureSummary = (card) => `<span class="brand-house-row-main"><span class="brand-house-badge">${escapeHtml(cardBadge(card))}</span><strong>${escapeHtml(localized(card.title))}</strong></span>
      <span class="brand-house-row-date">${escapeHtml(cardSummary(card))}</span>
      ${disclosureAction()}`;
    const publicCard = (card) => {
      const tone = ['public', 'conditional', 'invite'].includes(card.tone) ? card.tone : 'conditional';
      const open = openDetailIds.has(card.id) ? ' open' : '';
      return `<details id="brand-${escapeHtml(card.id)}" class="brand-house-card tone-${escapeHtml(tone)}" data-brand-detail-id="${escapeHtml(card.id)}" data-brand-entry="${escapeHtml(card.id)}"${open}>
        <summary>${disclosureSummary(card)}</summary>
        <div class="brand-house-card-content">
          <p class="brand-house-row-location">${escapeHtml(localized(card.location))}</p>
          <dl class="brand-house-facts">
            <div><dt>${escapeHtml(text('brandHouseScheduleLabel'))}</dt><dd>${escapeHtml(localized(card.schedule))}</dd></div>
            <div><dt>${escapeHtml(text('brandHouseAccessLabel'))}</dt><dd>${escapeHtml(localized(card.access))}</dd></div>
            <div><dt>${escapeHtml(text('brandHouseDriveLabel'))}</dt><dd>${escapeHtml(localized(card.drive))}</dd></div>
            <div><dt>${escapeHtml(text('brandHouseParkingLabel'))}</dt><dd>${escapeHtml(localized(card.parking))}</dd></div>
          </dl>
          ${evidenceDetails(card)}
        </div>
      </details>`;
    };
    const houseRow = (card) => {
      const tone = ['public', 'conditional', 'invite'].includes(card.tone) ? card.tone : 'conditional';
      const open = openDetailIds.has(card.id) ? ' open' : '';
      return `<details id="brand-${escapeHtml(card.id)}" class="brand-house-row tone-${escapeHtml(tone)}" data-brand-detail-id="${escapeHtml(card.id)}" data-brand-entry="${escapeHtml(card.id)}"${open}>
        <summary>${disclosureSummary(card)}</summary>
        <div class="brand-house-row-content">
          <p class="brand-house-row-location">${escapeHtml(localized(card.location))}</p>
          <dl class="brand-house-facts">
            <div><dt>${escapeHtml(text('brandHouseActionLabel'))}</dt><dd>${escapeHtml(localized(card.publicAction))}</dd></div>
            <div><dt>${escapeHtml(text('brandHouseScheduleLabel'))}</dt><dd>${escapeHtml(localized(card.schedule))}</dd></div>
            <div><dt>${escapeHtml(text('brandHouseAccessLabel'))}</dt><dd>${escapeHtml(localized(card.access))}</dd></div>
            <div><dt>${escapeHtml(text('brandHouseParkingLabel'))}</dt><dd>${escapeHtml(localized(card.parking))}</dd></div>
            <div><dt>${escapeHtml(text('brandHouseDriveLabel'))}</dt><dd>${escapeHtml(localized(card.drive))}</dd></div>
          </dl>
          ${evidenceDetails(card)}
        </div>
      </details>`;
    };

    root.innerHTML = (guide.lanes || []).map((lane) => {
      const cards = (lane.cardIds || []).map((id) => cardsById.get(id)).filter(Boolean);
      const isPublic = lane.id === 'public-drive';
      const undatedCards = cards.filter((card) => !card.endDate);
      const archivedCards = cards.filter((card) => card.endDate && archiveDate > card.endDate);
      const listClass = isPublic ? 'brand-house-card-grid' : 'brand-house-row-list';
      const renderCard = isPublic ? publicCard : houseRow;
      const undatedMarkup = undatedCards.length
        ? `<div class="${listClass}">${undatedCards.map(renderCard).join('')}</div>`
        : '';
      const pastOpen = openPastGroupIds.has(lane.id) ? ' open' : '';
      const archiveMarkup = archivedCards.length ? `<details class="brand-house-past-group" data-brand-past-group="${escapeHtml(lane.id)}"${pastOpen}>
        <summary>${escapeHtml(statusWithCount('brandHousePastSummary', archivedCards.length))}</summary>
        <div class="${listClass}">${archivedCards.map(renderCard).join('')}</div>
      </details>` : '';
      const laneContent = `${undatedMarkup}${archiveMarkup}`;
      const foldedLaneContent = isPublic ? laneContent : `<details class="brand-house-lane-fold" data-brand-lane-fold="${escapeHtml(lane.id)}"${openLaneIds.has(lane.id) ? ' open' : ''}>
        <summary><span>${escapeHtml(statusWithCount('brandHousePrivateFoldSummary', cards.length))}</span>${disclosureAction()}</summary>
        <div class="brand-house-lane-fold-content">${laneContent}</div>
      </details>`;
      const laneTitleKey = lane.titleKeyByDate?.[archiveDate] || lane.titleKey;
      const laneIntroKey = lane.introKeyByDate?.[archiveDate] || lane.introKey;
      return `<section class="brand-house-lane brand-house-lane-${escapeHtml(lane.id)}" aria-labelledby="brand-house-lane-${escapeHtml(lane.id)}">
        <header class="brand-house-lane-heading">
          <h3 id="brand-house-lane-${escapeHtml(lane.id)}">${escapeHtml(text(laneTitleKey))}</h3>
          <p>${escapeHtml(text(laneIntroKey))}</p>
        </header>
        ${foldedLaneContent}
      </section>`;
    }).join('') + `<details class="brand-house-guide-notes" data-brand-guide-notes${guideNotesOpen ? ' open' : ''}>
      <summary><strong>${escapeHtml(text('brandHouseGuideNotesTitle'))}</strong><span>${escapeHtml(text('brandHouseGuideNotesHint'))}</span></summary>
      <div class="brand-house-guide-notes-content">
        <aside class="brand-house-safety"><span aria-hidden="true">!</span><div><strong>${escapeHtml(text('brandHouseSafetyTitle'))}</strong><p>${escapeHtml(text('brandHouseSafetyBody'))}</p></div></aside>
        <p class="brand-house-directory-note">${escapeHtml(text('brandHouseDirectoryNote'))} <a href="${escapeHtml(guide.directorySource)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text('brandHouseDirectoryLink'))}<span aria-hidden="true">↗</span></a> <a href="${escapeHtml(guide.permitProcessSource)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text('brandHousePermitProcessLink'))}<span aria-hidden="true">↗</span></a></p>
      </div>
    </details>`;
  }

  function renderPlanStops(item) {
    const route = item.route;
    if (!route) return '';
    const rootStops = Array.isArray(route.stops) ? route.stops : [];
    const branches = Array.isArray(route.branches) ? route.branches : [];
    if (!rootStops.length && !branches.length) return '';

    function stopChip(stop, kind = 'shared') {
      const optional = stop.optional
        ? `<span class="plan-stop-optional">${escapeHtml(text('planStopOptional'))}</span>`
        : '';
      return `<span class="plan-stop-chip kind-${escapeHtml(kind)}${stop.optional ? ' is-optional' : ''}" data-route-marker="${escapeHtml(stop.marker)}">
        <strong>${escapeHtml(stop.marker)}</strong>
        <span>${escapeHtml(localized(stop.label))}</span>
        ${optional}
      </span>`;
    }

    const sections = [];
    if (rootStops.length) {
      const label = branches.length ? `<span class="plan-route-group-label">${escapeHtml(text('planRouteShared'))}</span>` : '';
      sections.push(`<div class="plan-route-group is-shared">${label}<div class="plan-stops">${rootStops.map((stop) => stopChip(stop)).join('')}</div></div>`);
    }

    const choiceBranches = branches.filter((branch) => branch.kind !== 'addOn');
    const addOnBranches = branches.filter((branch) => branch.kind === 'addOn');
    for (const [group, labelKey, kind] of [
      [choiceBranches, 'planRouteChoices', 'choice'],
      [addOnBranches, 'planRouteAddOns', 'add-on']
    ]) {
      if (!group.length) continue;
      const rows = group.map((branch) => {
        const stops = Array.isArray(branch.stops) ? branch.stops : [];
        const stopHtml = stops.length
          ? stops.map((stop) => stopChip(stop, kind)).join('')
          : `<span class="plan-branch-no-pin">${escapeHtml(text('planNoMapPin'))}</span>`;
        return `<div class="plan-branch kind-${escapeHtml(kind)}">
          <span class="plan-branch-label">${escapeHtml(branch.id)} · ${escapeHtml(localized(branch.label))}</span>
          <div class="plan-stops">${stopHtml}</div>
        </div>`;
      }).join('');
      sections.push(`<div class="plan-route-group kind-${escapeHtml(kind)}"><span class="plan-route-group-label">${escapeHtml(text(labelKey))}</span>${rows}</div>`);
    }

    return `
      <div class="plan-stops-label">${escapeHtml(text('planStops'))}</div>
      <div class="plan-route-graph">${sections.join('')}</div>
      <p class="plan-route-hint">${escapeHtml(text('planRouteHint'))}</p>`;
  }

  function planToneLabel(tone) {
    const map = {
      core: 'planToneCore',
      optional: 'planToneOptional',
      alt: 'planToneAlt',
      transit: 'planToneTransit'
    };
    return text(map[tone] || 'planToneCore');
  }

  function renderPlanTimeline(item, open) {
    const slots = Array.isArray(item.schedule) ? sortEventsChronologically(item.schedule) : [];
    if (!slots.length) return '';
    const rows = slots.map((slot) => {
      const tone = slot.tone || 'core';
      const note = slot.note ? `<p class="plan-timeline-note">${escapeHtml(localized(slot.note))}</p>` : '';
      const markers = Array.isArray(slot.routeMarkers) ? slot.routeMarkers : [];
      const markerLabel = `${text('planStops')}: ${markers.join(', ')}`;
      const markerHtml = markers.length
        ? `<div class="plan-timeline-markers" role="group" aria-label="${escapeHtml(markerLabel)}">${markers.map((marker) => `<span>${escapeHtml(marker)}</span>`).join('')}</div>`
        : '';
      return `
        <li class="plan-timeline-item tone-${escapeHtml(tone)}">
          <div class="plan-timeline-time">
            <strong>${escapeHtml(slot.time)}</strong>
            <span class="plan-tone">${escapeHtml(planToneLabel(tone))}</span>
          </div>
          <div class="plan-timeline-copy">
            ${markerHtml}
            <p class="plan-timeline-title">${escapeHtml(localized(slot.title))}</p>
            ${note}
          </div>
        </li>`;
    }).join('');
    return `
      <details class="plan-timeline" data-plan-timeline-id="${escapeHtml(item.id)}"${open ? ' open' : ''}>
        <summary>${escapeHtml(text('planTimeline'))}</summary>
        <ol class="plan-timeline-list">${rows}</ol>
        <p class="plan-timeline-hint">${escapeHtml(text('planTimelineHint'))}</p>
      </details>`;
  }

  function destroyPlanMaps() {
    planMapGeneration += 1;
    if (planMapObserver) {
      planMapObserver.disconnect();
      planMapObserver = null;
    }
    planMaps.forEach(({ map }) => map.remove());
    planMaps.clear();
  }

  function renderQuickPlan() {
    const root = document.getElementById('quick-plan-track');
    if (!root) return;
    const openTimelineIds = new Set(Array.from(root.querySelectorAll('details[data-plan-timeline-id][open]'))
      .map((details) => details.getAttribute('data-plan-timeline-id')));
    destroyPlanMaps();
    function buildPlanCard(item) {
      const dateIso = quickPlanDateIso(item);
      const relation = dayRelation(dateIso);
      const classes = ['plan-day'];
      if (item.flagship) classes.push('flagship');
      if (relation === 'past') classes.push('is-past');
      return `
      <article class="${classes.join(' ')}" data-date="${escapeHtml(dateIso)}">
        <div class="plan-day-copy">
          <div class="plan-date">
            <strong>${escapeHtml(localized(item.date))}</strong>
            <span>${escapeHtml(localized(item.day))}</span>
            ${relation === 'past' ? `<span class="plan-day-badge is-past">${escapeHtml(text('archivePastBadge'))}</span>` : ''}
          </div>
          <h3>${escapeHtml(localized(item.title))}</h3>
          <p>${escapeHtml(localized(item.body))}</p>
          <span class="plan-cost">${escapeHtml(localized(item.cost))}</span>
          ${renderPlanStops(item)}
          ${renderPlanTimeline(item, openTimelineIds.has(item.id))}
        </div>
        ${item.id && item.route ? `<div class="plan-day-map" data-plan-map="${escapeHtml(item.id)}" role="region" aria-label="${escapeHtml(text('planMapLabel'))}: ${escapeHtml(localized(item.title))}"></div>` : ''}
      </article>`;
    }

    const entries = DATA.quickPlan.map((item) => {
      const entry = { item, html: buildPlanCard(item), dateIso: quickPlanDateIso(item) };
      return entry;
    });
    const { archived, later } = splitChronologicalEntries(entries, (entry) => entry.dateIso);
    const archivedDates = archived.map((entry) => entry.dateIso);
    const archiveMarkup = archived.length
      ? `<details class="plan-day-past" data-past-group="quick" data-date-start="${escapeHtml(archivedDates[0])}" data-date-end="${escapeHtml(archivedDates.at(-1))}"${state.quickPastOpen ? ' open' : ''}><summary>${escapeHtml(planningGroupSummary(archivedDates, archived.length, true))}</summary>${archived.map((entry) => entry.html).join('')}</details>`
      : '';
    root.innerHTML = chronologicalFoldMarkup(archiveMarkup, later.map((entry) => entry.html).join(''));
  }

  function renderScheduleFilters() {
    const dayRoot = document.getElementById('day-filter');
    const areaRoot = document.getElementById('live-area-filter');
    const typeRoot = document.getElementById('type-filter');
    const statusEl = document.getElementById('live-status');
    if (!dayRoot || !areaRoot || !typeRoot) return;

    const dayButtons = [{ id: 'all', label: DATA.ui.allDays }].concat(
      DATA.days.map((day) => ({ id: day.id, label: day.short }))
    );
    dayRoot.setAttribute('aria-label', state.lang === 'zh' ? '按日期筛选' : 'Filter by day');
    dayRoot.innerHTML = dayButtons.map((item) => `
      <button type="button" class="filter-button" data-day="${escapeHtml(item.id)}" aria-pressed="${state.day === item.id}">
        ${escapeHtml(localized(item.label))}
      </button>`).join('');

    areaRoot.setAttribute('aria-label', text('liveAreaLabel'));
    const areaButtons = [{ id: 'all', label: text('liveAllAreas') }].concat(
      (DATA.liveAreas || []).map((area) => ({ id: area.id, label: localized(area.name) }))
    );
    areaRoot.innerHTML = areaButtons.map((item) => `
      <button type="button" class="filter-button" data-live-area="${escapeHtml(item.id)}" aria-pressed="${state.area === item.id}">
        ${escapeHtml(item.label)}
      </button>`).join('');

    const typeButtons = [
      { id: 'all', label: DATA.ui.allTypes },
      { id: 'essential', label: DATA.ui.topPicks },
      { id: 'free', label: DATA.ui.free },
      { id: 'paid', label: DATA.ui.paid }
    ];
    typeRoot.setAttribute('aria-label', state.lang === 'zh' ? '按推荐和价格筛选' : 'Filter by value and price');
    typeRoot.innerHTML = typeButtons.map((item) => `
      <button type="button" class="filter-button" data-type="${escapeHtml(item.id)}" aria-pressed="${state.type === item.id}">
        ${escapeHtml(localized(item.label))}
      </button>`).join('');

    const moreSummary = document.querySelector('.filter-more > summary');
    if (moreSummary) {
      const activeFilters = [];
      if (state.day !== 'all') activeFilters.push(localized(dayButtons.find((item) => item.id === state.day)?.label));
      if (state.area !== 'all') activeFilters.push(areaButtons.find((item) => item.id === state.area)?.label || state.area);
      if (state.type !== 'all') activeFilters.push(localized(typeButtons.find((item) => item.id === state.type)?.label));
      const visibleFilters = activeFilters.filter(Boolean);
      moreSummary.textContent = visibleFilters.length
        ? `${text('archiveFilters')} · ${visibleFilters.join(' · ')}`
        : text('archiveFilters');
      moreSummary.classList.toggle('has-active-filters', visibleFilters.length > 0);
      moreSummary.dataset.activeFilters = String(visibleFilters.length);
    }

    const filtered = DATA.events.filter(matchesArchiveFilters);
    if (statusEl) {
      statusEl.textContent = statusWithCount('archiveFilterStatus', filtered.length);
    }
  }

  function tagLabel(tag) {
    const map = {
      free: 'freeTag',
      paid: 'paidTag',
      mixedTag: 'mixedTag',
      soldOutTag: 'soldOutTag',
      unknownTag: 'unknownTag',
      admissionUnstatedTag: 'admissionUnstatedTag',
      subjectTag: 'subjectTag'
    };
    return ui(map[tag] || tag);
  }

  function tagClass(tag) {
    if (tag === 'free') return 'free';
    if (tag === 'paid' || tag === 'mixedTag') return 'paid';
    if (tag === 'unknownTag' || tag === 'soldOutTag' || tag === 'subjectTag') return 'alert';
    return '';
  }

  function renderEvent(event, open) {
    const eventSources = event.sources || [{ url: event.source, label: DATA.ui.officialSource }];
    const priceClass = event.categories.includes('free') ? 'free' : (event.categories.includes('paid') ? 'paid' : 'alert');
    const areaTag = event.area
      ? `<span class="event-area">${escapeHtml(areaName(event.area))}</span>`
      : '';
    const thumb = event.thumbId && DATA.thumbLibrary && DATA.thumbLibrary[event.thumbId]
      ? DATA.thumbLibrary[event.thumbId]
      : null;
    const thumbHtml = thumb
      ? `<img class="event-thumb" src="${escapeHtml(thumb.src)}" alt="${escapeHtml(localized(thumb.alt))}" width="${escapeHtml(String(thumb.width))}" height="${escapeHtml(String(thumb.height))}" loading="lazy" decoding="async">`
      : '';
    const thumbCreditHtml = thumb
      ? `<p class="event-thumb-credit">${escapeHtml(text('thumbCredit'))}: <a href="${escapeHtml(thumb.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(localized(thumb.credit))}</a></p>`
      : '';
    const verifiedHtml = event.verifiedOn
      ? `<span class="tag checked">${escapeHtml(ui('verified'))} ${escapeHtml(event.verifiedOn)}</span>`
      : '';
    return `
      <article class="event-card" id="event-${escapeHtml(event.id)}">
        <div class="event-main${thumb ? ' has-thumb' : ''}">
          ${thumbHtml}
          <div class="event-time">${escapeHtml(event.time)}<small>${escapeHtml(localized(event.timeNote))}</small></div>
          <div class="event-copy">
            <h3>${escapeHtml(localized(event.title))}</h3>
            <p class="event-location">${escapeHtml(localized(event.location))}${areaTag}</p>
            <p class="event-summary">${escapeHtml(localized(event.summary))}</p>
            <div class="event-meta">
              <span class="tag ${priceClass}">${escapeHtml(localized(event.price))}</span>
              ${verifiedHtml}
              ${event.tags.filter((tag) => tag !== 'free' && tag !== 'paid').map((tag) => `<span class="tag ${tagClass(tag)}">${escapeHtml(tagLabel(tag))}</span>`).join('')}
            </div>
          </div>
          <div class="event-score"><strong>${escapeHtml(event.score)}/5</strong><span>${escapeHtml(ui('worth'))}</span></div>
        </div>
        <details class="event-more" data-event-detail-id="${escapeHtml(event.id)}"${open ? ' open' : ''}>
          <summary>${escapeHtml(ui('details'))}</summary>
          <div class="event-detail">
            <p><strong>${escapeHtml(ui('why'))}</strong>${escapeHtml(localized(event.why))}</p>
            <p><strong>${escapeHtml(ui('access'))}</strong>${escapeHtml(localized(event.access))}</p>
            ${thumbCreditHtml}
            <div class="event-sources">
              ${eventSources.map((source) => `<a class="event-source" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(localized(source.label))}</a>`).join('')}
            </div>
          </div>
        </details>
      </article>`;
  }

  function renderSchedule() {
    const root = document.getElementById('schedule-results');
    if (!root) return;
    const openEventIds = new Set(Array.from(root.querySelectorAll('details[data-event-detail-id][open]'))
      .map((details) => details.getAttribute('data-event-detail-id')));

    const filtered = DATA.events.filter(matchesArchiveFilters);

    if (!filtered.length) {
      root.innerHTML = `<p class="empty-state">${escapeHtml(ui('noResults'))}</p>`;
      return;
    }

    function buildDayGroup(day, events) {
      const relation = dayRelation(day.id);
      const classes = ['day-group'];
      if (relation === 'past') classes.push('is-past');
      const heading = `
          <header class="day-heading" id="day-${escapeHtml(day.id)}">
            <time datetime="${escapeHtml(day.id)}">${escapeHtml(localized(day.short))}</time>
            <span>${escapeHtml(localized(day.label))}</span>
            <em>${events.length} ${escapeHtml(ui(events.length === 1 ? 'dayLabelSingular' : 'dayLabel'))}</em>
          </header>
          <div class="event-list">${events.map((event) => renderEvent(event, openEventIds.has(event.id))).join('')}</div>`;
      return `
        <section class="${classes.join(' ')}" data-date="${escapeHtml(day.id)}" aria-labelledby="day-${escapeHtml(day.id)}">
          ${heading}
        </section>`;
    }

    const groups = DATA.days.map((day) => {
      const events = sortEventsChronologically(filtered.filter((event) => event.date === day.id));
      if (!events.length) return null;
      return { day, events, html: buildDayGroup(day, events), relation: dayRelation(day.id) };
    }).filter(Boolean);

    const aggregateArchive = state.day === 'all';
    if (!aggregateArchive) {
      root.innerHTML = groups.map((group) => group.html).join('');
      return;
    }
    const { archived, later } = splitChronologicalEntries(groups, (group) => group.day.id);
    const archivedDates = archived.map((group) => group.day.id);
    const count = archived.reduce((total, group) => total + group.events.length, 0);
    const archiveMarkup = archived.length
      ? `<details class="day-group-past" data-past-group="schedule" data-date-start="${escapeHtml(archivedDates[0])}" data-date-end="${escapeHtml(archivedDates.at(-1))}"${state.schedulePastOpen ? ' open' : ''}><summary class="day-heading day-heading-past">${escapeHtml(planningGroupSummary(archivedDates, count, true))}</summary>${archived.map((group) => group.html).join('')}</details>`
      : '';
    root.innerHTML = chronologicalFoldMarkup(archiveMarkup, later.map((group) => group.html).join(''));
  }

  function renderStays() {
    const root = document.getElementById('stay-grid');
    if (!root) return;
    root.innerHTML = DATA.stays.map((stay) => {
      const badge = stay.freeStay
        ? `<span class="stay-badge free">${escapeHtml(ui('zeroLodging'))}</span>`
        : (stay.recommended ? `<span class="stay-badge">${escapeHtml(ui('bestBalance'))}</span>` : '');
      const priceNote = stay.priceNote ? localized(stay.priceNote) : ui('perNight');
      const metrics = Array.isArray(stay.metrics) && stay.metrics.length
        ? `<dl class="stay-metrics">${stay.metrics.map((metric) => `
            <div>
              <dt>${escapeHtml(ui(metric.key) || localized(metric.label))}</dt>
              <dd>${escapeHtml(localized(metric.value))}</dd>
            </div>`).join('')}</dl>`
        : '';
      return `
      <article class="stay-card${stay.recommended ? ' recommended' : ''}${stay.freeStay ? ' free-stay' : ''}">
        <div class="stay-top">
          <h3>${escapeHtml(localized(stay.name))}</h3>
          ${badge}
        </div>
        <div class="stay-price">${escapeHtml(stay.price)}<small>${escapeHtml(priceNote)}</small></div>
        ${metrics}
        <p>${escapeHtml(localized(stay.body))}</p>
        <div class="stay-tradeoff"><span>${escapeHtml(ui('tradeoff'))}</span><strong>${escapeHtml(localized(stay.tradeoff))}</strong></div>
      </article>`;
    }).join('');
  }

  function renderCommuteOptions() {
    const from = document.getElementById('commute-from');
    const to = document.getElementById('commute-to');
    if (!from || !to) return;

    from.innerHTML = DATA.places.map((place) => `<option value="${escapeHtml(place.id)}">${escapeHtml(localized(place.name))}</option>`).join('');
    to.innerHTML = DATA.hubs.map((hub) => `<option value="${escapeHtml(hub.id)}">${escapeHtml(localized(hub.name))}</option>`).join('');
    from.value = state.from;
    to.value = state.to;
    renderCommuteResult();
  }

  function parseMinuteRange(range) {
    const match = String(range || '').match(/^(\d+)–(\d+)$/);
    if (!match) return null;
    return [Number(match[1]), Number(match[2])];
  }

  function formatHourBand(minLow, minHigh) {
    const toHours = (minutes) => {
      const hours = minutes / 60;
      return (Math.round(hours * 10) / 10).toFixed(1).replace(/\.0$/, '');
    };
    return state.lang === 'zh'
      ? `${toHours(minLow)}–${toHours(minHigh)} 小时`
      : `${toHours(minLow)}–${toHours(minHigh)} hr`;
  }

  function renderCommuteResult() {
    const root = document.getElementById('commute-result');
    const pair = DATA.commute[state.from] && DATA.commute[state.from][state.to];
    if (!root || !pair) return;

    const miles = DATA.commuteMiles
      && DATA.commuteMiles[state.from]
      && DATA.commuteMiles[state.from][state.to];
    const ordinaryBand = parseMinuteRange(pair[0]);
    const eventBand = parseMinuteRange(pair[1]);
    const extra = [];
    if (typeof miles === 'number') {
      extra.push(`
        <div class="time-box miles">
          <span>${escapeHtml(ui('oneWayMiles'))}</span>
          <strong>${escapeHtml(String(miles))} ${state.lang === 'zh' ? '英里' : 'mi'}</strong>
        </div>
        <div class="time-box miles">
          <span>${escapeHtml(ui('roundTripMiles'))}</span>
          <strong>${escapeHtml(String(miles * 2))} ${state.lang === 'zh' ? '英里' : 'mi'}</strong>
        </div>`);
      if (ordinaryBand && eventBand) {
        extra.push(`
        <div class="time-box miles">
          <span>${escapeHtml(ui('roundTripTime'))}</span>
          <strong>${escapeHtml(formatHourBand(ordinaryBand[0] * 2, eventBand[1] * 2))}</strong>
        </div>`);
      }
    }

    root.innerHTML = `
      <div class="time-comparison${miles ? ' with-miles' : ''}">
        <div class="time-box"><span>${escapeHtml(ui('ordinary'))}</span><strong>${escapeHtml(pair[0])} ${escapeHtml(ui('minutes'))}</strong></div>
        <div class="time-box event-week"><span>${escapeHtml(ui('eventWeek'))}</span><strong>${escapeHtml(pair[1])} ${escapeHtml(ui('minutes'))}</strong></div>
        ${extra.join('')}
      </div>
      <p class="commute-advice">${escapeHtml(ui('commuteAdvice'))}</p>`;
  }

  function renderTransportTips() {
    const root = document.getElementById('transport-tips');
    if (!root) return;
    root.innerHTML = DATA.transportTips.map((tip) => `
      <article class="transport-tip">
        <span aria-hidden="true">${escapeHtml(tip.icon)}</span>
        <strong>${escapeHtml(localized(tip.title))}</strong>
        <p>${escapeHtml(localized(tip.body))}</p>
      </article>`).join('');
  }

  function renderSources() {
    const root = document.getElementById('source-list');
    if (!root) return;
    root.innerHTML = DATA.sources.map((source) => `
      <li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(localized(source.label))} ↗</a></li>`).join('');
  }

  function renderNearby() {
    const root = document.getElementById('nearby-grid');
    if (!root) return;
    const items = DATA.nearby || [];
    if (!items.length) {
      root.innerHTML = '';
      return;
    }
    root.innerHTML = items.map((item) => {
      const paid = /\$|¥|€/.test(localized(item.price)) && !/免费|Free/i.test(localized(item.price));
      const priceClass = paid ? 'paid' : 'free';
      return `
      <article class="nearby-card" id="nearby-${escapeHtml(item.id)}">
        <div class="nearby-top">
          <time>${escapeHtml(localized(item.when))}</time>
          <div class="event-score"><strong>${escapeHtml(item.score)}/5</strong><span>${escapeHtml(ui('worth'))}</span></div>
        </div>
        <h3>${escapeHtml(localized(item.title))}</h3>
        <p class="event-location">${escapeHtml(localized(item.location))}</p>
        <p class="nearby-summary">${escapeHtml(localized(item.summary))}</p>
        <p class="nearby-why"><strong>${escapeHtml(ui('why'))}</strong>${escapeHtml(localized(item.why))}</p>
        <div class="nearby-meta">
          <span class="tag ${priceClass}">${escapeHtml(localized(item.price))}</span>
          <span class="nearby-drive"><span>${escapeHtml(ui('driveLabel'))}</span>${escapeHtml(localized(item.drive))}</span>
        </div>
        <a class="event-source" href="${escapeHtml(item.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ui('nearbySource'))}</a>
      </article>`;
    }).join('');
  }

  function hubPopupHtml(hub) {
    const lat = Number(hub.lat).toFixed(5);
    const lng = Number(hub.lng).toFixed(5);
    const osm = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(hub.lat)}&mlon=${encodeURIComponent(hub.lng)}#map=15/${encodeURIComponent(hub.lat)}/${encodeURIComponent(hub.lng)}`;
    return `
      <div class="hub-popup">
        <strong>${escapeHtml(localized(hub.name))}</strong>
        <p class="hub-note">${escapeHtml(localized(hub.note))}</p>
        <p class="hub-place">${escapeHtml(localized(hub.place))}</p>
        <p class="hub-coords">${escapeHtml(text('mapCoords'))}: ${escapeHtml(lat)}, ${escapeHtml(lng)}</p>
        <a href="${escapeHtml(osm)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text('mapOpenOsm'))}</a>
      </div>`;
  }

  function makeStopIcon(marker, tone, offset = { x: 0, y: 0 }) {
    return window.L.divIcon({
      className: 'stop-pin-wrap',
      html: `<span class="stop-pin ${escapeHtml(tone || 'default')}" aria-hidden="true">${escapeHtml(String(marker))}</span>`,
      iconSize: [44, 44],
      iconAnchor: [22 - offset.x, 22 - offset.y],
      popupAnchor: [offset.x, offset.y - 24],
      tooltipAnchor: [offset.x, offset.y]
    });
  }

  function separatePlanMarkers(map, entries, legLayer) {
    legLayer.clearLayers();
    if (!entries.length) return;
    const points = entries.map((entry) => map.latLngToLayerPoint(entry.marker.getLatLng()));
    const parents = entries.map((_, index) => index);
    const find = (index) => {
      let root = index;
      while (parents[root] !== root) root = parents[root];
      while (parents[index] !== index) {
        const next = parents[index];
        parents[index] = root;
        index = next;
      }
      return root;
    };
    const join = (left, right) => {
      const leftRoot = find(left);
      const rightRoot = find(right);
      if (leftRoot === rightRoot) return false;
      parents[rightRoot] = leftRoot;
      return true;
    };

    for (let left = 0; left < points.length; left += 1) {
      for (let right = left + 1; right < points.length; right += 1) {
        if (points[left].distanceTo(points[right]) < 50) join(left, right);
      }
    }

    let offsets = entries.map(() => ({ x: 0, y: 0 }));
    let targets = points;
    for (let pass = 0; pass < entries.length; pass += 1) {
      const groups = new Map();
      entries.forEach((entry, index) => {
        const root = find(index);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(index);
      });

      offsets = entries.map(() => ({ x: 0, y: 0 }));
      groups.forEach((indexes) => {
        if (indexes.length < 2) return;
        const center = indexes.reduce((sum, index) => ({
          x: sum.x + points[index].x / indexes.length,
          y: sum.y + points[index].y / indexes.length
        }), { x: 0, y: 0 });
        const radius = Math.max(27, 50 / (2 * Math.sin(Math.PI / indexes.length)) + 4);
        indexes.forEach((index, position) => {
          const angle = -Math.PI / 2 + (2 * Math.PI * position) / indexes.length;
          offsets[index] = {
            x: Math.round((center.x + radius * Math.cos(angle) - points[index].x) * 10) / 10,
            y: Math.round((center.y + radius * Math.sin(angle) - points[index].y) * 10) / 10
          };
        });
      });
      targets = points.map((point, index) => window.L.point(point.x + offsets[index].x, point.y + offsets[index].y));

      let merged = false;
      for (let left = 0; left < targets.length; left += 1) {
        for (let right = left + 1; right < targets.length; right += 1) {
          if (find(left) !== find(right) && targets[left].distanceTo(targets[right]) < 50) {
            merged = join(left, right) || merged;
          }
        }
      }
      if (!merged) break;
    }

    entries.forEach((entry, index) => {
      const offset = offsets[index];
      const offsetKey = `${offset.x},${offset.y}`;
      if (entry.offsetKey !== offsetKey) {
        entry.offsetKey = offsetKey;
        entry.marker.setIcon(makeStopIcon(entry.stop.marker, entry.tone, offset));
      }
      if (Math.hypot(offset.x, offset.y) < 0.5) return;
      const origin = entry.marker.getLatLng();
      const target = map.layerPointToLatLng(targets[index]);
      window.L.polyline([origin, target], {
        pane: 'planMarkerLegs',
        className: 'plan-marker-leg',
        color: '#52605b',
        weight: 1.5,
        opacity: 0.72,
        dashArray: '2 4',
        interactive: false
      }).addTo(legLayer);
      window.L.circleMarker(origin, {
        pane: 'planMarkerLegs',
        className: 'plan-marker-origin',
        radius: 2.5,
        color: '#52605b',
        weight: 1.5,
        fillColor: '#ffffff',
        fillOpacity: 0.9,
        interactive: false
      }).addTo(legLayer);
    });
  }

  function makeParkingTrafficIcon(point) {
    const kind = parkingPointKind(point);
    return window.L.divIcon({
      className: 'parking-map-marker-wrap',
      html: `<span class="parking-map-marker kind-${escapeHtml(kind)}" aria-hidden="true"></span>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -15]
    });
  }

  function parkingPointPopupHtml(point) {
    return `<div class="parking-map-popup">
      <div class="parking-map-popup-title"><span>${escapeHtml(point.code)}</span><div><strong>${escapeHtml(localized(point.name))}</strong><em>${escapeHtml(parkingPointKindLabel(point))}</em></div></div>
      <dl>
        <div><dt>${escapeHtml(text('parkingMapAudienceLabel'))}</dt><dd>${escapeHtml(localized(point.audience))}</dd></div>
        <div><dt>${escapeHtml(text('parkingMapAccessLabel'))}</dt><dd>${escapeHtml(localized(point.access))}</dd></div>
        <div><dt>${escapeHtml(text('parkingMapEvidenceLabel'))}</dt><dd>${escapeHtml(parkingEvidenceLabel(point))}</dd></div>
        <div><dt>${escapeHtml(text('parkingMapPrecisionLabel'))}</dt><dd>${escapeHtml(text('parkingMapPrecisionValue'))}</dd></div>
      </dl>
    </div>`;
  }

  function parkingTrafficPopupHtml(control) {
    return `<div class="parking-map-popup is-traffic">
      <strong>${escapeHtml(text(control.labelKey))}</strong>
      <p>${escapeHtml(localized(control.note))}</p>
      <small>${escapeHtml(text('parkingMapTrafficSchematic'))}</small>
    </div>`;
  }

  function updateParkingTouchToggle() {
    const button = document.getElementById('parking-map-touch-toggle');
    if (!button) return;
    button.hidden = !parkingTrafficState.coarsePointer;
    button.setAttribute('aria-pressed', parkingTrafficState.touchActive ? 'true' : 'false');
    button.textContent = text(parkingTrafficState.touchActive ? 'parkingMapTouchDisable' : 'parkingMapTouchEnable');
  }

  function parkingDiagramLatLng(mapX, mapY) {
    const config = parkingTrafficConfig();
    const height = config && config.diagramSize ? config.diagramSize.height : 0;
    return window.L.latLng(height - mapY, mapX);
  }

  function parkingDiagramBounds(focusBounds) {
    if (!Array.isArray(focusBounds) || focusBounds.length !== 4) return null;
    const [minX, minY, maxX, maxY] = focusBounds;
    return window.L.latLngBounds(
      parkingDiagramLatLng(minX, maxY),
      parkingDiagramLatLng(maxX, minY)
    );
  }

  function parkingMapFallbackHtml() {
    const config = parkingTrafficConfig();
    const pdf = config ? config.sourcePdf : '#';
    return `<div class="parking-map-fallback">
      <strong>${escapeHtml(text('parkingMapFallbackTitle'))}</strong>
      <p>${escapeHtml(text('parkingMapFallbackBody'))}</p>
      <a href="${escapeHtml(pdf)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text('parkingMapOfficialPdf'))}</a>
    </div>`;
  }

  function announceParkingMapSelection(name) {
    const status = document.getElementById('parking-map-status');
    if (!status) return;
    const count = visibleParkingPoints().length + visibleParkingTraffic().length;
    const countText = count ? statusWithCount('parkingMapStatus', count) : text('parkingMapEmpty');
    const focused = text('parkingMapSelected').replace('{name}', name);
    status.textContent = `${countText} · ${focused}`;
  }

  function revealParkingMapOnSmallScreen() {
    if (typeof window.matchMedia !== 'function' || !window.matchMedia('(max-width: 760px)').matches) return;
    const root = document.getElementById('parking-traffic-map');
    if (root) root.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function handleParkingDiagramError(root) {
    if (parkingTrafficState.baseError) return;
    parkingTrafficState.baseError = true;
    if (parkingTrafficState.map) parkingTrafficState.map.remove();
    parkingTrafficState.map = null;
    parkingTrafficState.baseLayer = null;
    parkingTrafficState.imageBounds = null;
    parkingTrafficState.markerLayer = null;
    parkingTrafficState.markers.clear();
    parkingTrafficState.traffic.clear();
    root.classList.add('is-diagram-error');
    root.innerHTML = parkingMapFallbackHtml();
    updateParkingMapStatus(visibleParkingPoints().length + visibleParkingTraffic().length);
  }

  function ensureParkingTrafficMap() {
    const root = document.getElementById('parking-traffic-map');
    const config = parkingTrafficConfig();
    if (!root || parkingTrafficState.map || parkingTrafficState.baseError) return;
    if (!window.L || !config || config.coordinateSpace !== 'official-diagram') {
      root.innerHTML = parkingMapFallbackHtml();
      return;
    }

    parkingTrafficState.coarsePointer = (typeof window.matchMedia === 'function' && window.matchMedia('(any-pointer: coarse)').matches)
      || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
    root.innerHTML = '';
    const map = window.L.map(root, {
      crs: window.L.CRS.Simple,
      minZoom: -2,
      maxZoom: 3,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: false,
      dragging: !parkingTrafficState.coarsePointer,
      touchZoom: !parkingTrafficState.coarsePointer,
      maxBoundsViscosity: 0.88
    });
    parkingTrafficState.map = map;
    const width = config.diagramSize.width;
    const height = config.diagramSize.height;
    const imageBounds = window.L.latLngBounds([0, 0], [height, width]);
    parkingTrafficState.imageBounds = imageBounds;
    const baseLayer = window.L.imageOverlay(config.diagramAsset, imageBounds, {
      alt: text('parkingMapImageAlt'),
      className: 'parking-diagram-image',
      interactive: false
    });
    baseLayer.on('error', () => handleParkingDiagramError(root));
    baseLayer.addTo(map);
    parkingTrafficState.baseLayer = baseLayer;
    parkingTrafficState.markerLayer = window.L.layerGroup().addTo(map);
    map.fitBounds(imageBounds, { padding: [8, 8], animate: false });
    map.setMaxBounds(imageBounds.pad(0.08));
    root.addEventListener('wheel', (event) => {
      if (event.metaKey || event.ctrlKey) map.scrollWheelZoom.enable();
      else map.scrollWheelZoom.disable();
    }, { passive: true });
    updateParkingTouchToggle();
    window.setTimeout(() => map.invalidateSize(), 40);
  }

  function syncParkingTrafficMap() {
    const map = parkingTrafficState.map;
    if (!map || !window.L || !parkingTrafficState.markerLayer) return;
    const baseImage = parkingTrafficState.baseLayer && parkingTrafficState.baseLayer.getElement();
    if (baseImage) baseImage.alt = text('parkingMapImageAlt');

    parkingTrafficState.markerLayer.clearLayers();
    parkingTrafficState.markers.clear();
    parkingTrafficState.traffic.clear();

    visibleParkingTraffic().forEach((control) => {
      const bounds = parkingDiagramBounds(control.focusBounds);
      if (!bounds) return;
      const popup = window.L.popup({ maxWidth: 280, className: 'hub-leaflet-popup' })
        .setLatLng(bounds.getCenter())
        .setContent(parkingTrafficPopupHtml(control));
      parkingTrafficState.traffic.set(control.id, { bounds, popup, control });
    });

    visibleParkingPoints().forEach((point) => {
      const title = `${point.code} · ${localized(point.name)} · ${parkingPointKindLabel(point)}`;
      const marker = window.L.marker(parkingDiagramLatLng(point.mapX, point.mapY), {
        icon: makeParkingTrafficIcon(point),
        title,
        alt: title,
        keyboard: true,
        riseOnHover: true
      }).addTo(parkingTrafficState.markerLayer);
      marker.bindPopup(parkingPointPopupHtml(point), { maxWidth: 320, className: 'hub-leaflet-popup parking-leaflet-popup' });
      marker.bindTooltip(title, { direction: 'top', offset: [0, -14], opacity: 0.96, className: 'hub-tooltip' });
      parkingTrafficState.markers.set(point.id, marker);
    });

    window.setTimeout(() => map.invalidateSize(), 40);
  }

  function focusParkingPoint(id) {
    const marker = parkingTrafficState.markers.get(id);
    if (!marker || !parkingTrafficState.map) return;
    const currentZoom = parkingTrafficState.map.getZoom();
    parkingTrafficState.map.setView(marker.getLatLng(), Math.max(currentZoom, 1), { animate: false });
    marker.openPopup();
    const point = visibleParkingPoints().find((item) => item.id === id);
    announceParkingMapSelection(point ? `${point.code} · ${localized(point.name)}` : id);
    revealParkingMapOnSmallScreen();
  }

  function focusParkingTraffic(id) {
    const item = parkingTrafficState.traffic.get(id);
    if (!item || !parkingTrafficState.map) return;
    parkingTrafficState.map.fitBounds(item.bounds, { padding: [42, 42], maxZoom: 1.5, animate: false });
    item.popup.openOn(parkingTrafficState.map);
    announceParkingMapSelection(text(item.control.labelKey));
    revealParkingMapOnSmallScreen();
  }

  function toggleParkingMapTouch() {
    if (!parkingTrafficState.map || !parkingTrafficState.coarsePointer) return;
    parkingTrafficState.touchActive = !parkingTrafficState.touchActive;
    if (parkingTrafficState.touchActive) {
      parkingTrafficState.map.dragging.enable();
      parkingTrafficState.map.touchZoom.enable();
    } else {
      parkingTrafficState.map.dragging.disable();
      parkingTrafficState.map.touchZoom.disable();
    }
    updateParkingTouchToggle();
  }

  function getMapPlace(placeId) {
    return DATA.mapPlaces && DATA.mapPlaces[placeId];
  }

  function parkingGeographicOsmUrl(anchor) {
    const zoom = anchor.accuracyM >= 700 ? 12 : (anchor.accuracyM >= 150 ? 13 : 15);
    return `https://www.openstreetmap.org/#map=${zoom}/${encodeURIComponent(anchor.lat)}/${encodeURIComponent(anchor.lng)}`;
  }

  function parkingGeographicPopupHtml(anchor) {
    const coordinateSource = parkingGeographicSource(anchor.coordinateSourceRef);
    const semanticSources = (anchor.semanticSourceRefs || []).map(parkingGeographicSource).filter(Boolean);
    return `<div class="parking-map-popup parking-geographic-popup">
      <div class="parking-map-popup-title"><span aria-hidden="true">◎</span><div><strong>${escapeHtml(localized(anchor.name))}</strong><em>${escapeHtml(parkingGeographicKindLabel(anchor))}</em></div></div>
      <p>${escapeHtml(localized(anchor.use))}</p>
      <p>${escapeHtml(localized(anchor.boundary))}</p>
      <dl>
        <div><dt>${escapeHtml(text('parkingMapPrecisionLabel'))}</dt><dd>${escapeHtml(parkingGeographicAccuracy(anchor))}</dd></div>
        <div><dt>${escapeHtml(text('parkingGeoSemanticLabel'))}</dt><dd>${semanticSources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(localized(source.label))}</a>`).join(' · ')}</dd></div>
        <div><dt>${escapeHtml(text('parkingGeoSourceLabel'))}</dt><dd>${coordinateSource ? `<a href="${escapeHtml(coordinateSource.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(localized(coordinateSource.label))}</a>` : '—'}</dd></div>
      </dl>
      <a class="parking-geographic-osm-link" href="${escapeHtml(parkingGeographicOsmUrl(anchor))}" target="_blank" rel="noopener noreferrer">${escapeHtml(text('parkingGeoOpenOsm'))}</a>
      <strong class="parking-geographic-no-navigation">${escapeHtml(text('parkingGeoNoNavigation'))}</strong>
    </div>`;
  }

  function parkingGeographicShapeOptions(anchor) {
    const palette = {
      'road-area': { color: '#285d78', fillColor: '#91c6dc' },
      'venue-area': { color: '#174f43', fillColor: '#8cc8b9' },
      landmark: { color: '#825b18', fillColor: '#e0ba66' },
      'gate-reference': { color: '#ad3c1d', fillColor: '#f08a62' }
    };
    const colors = palette[anchor.kind] || palette.landmark;
    return {
      color: colors.color,
      fillColor: colors.fillColor,
      weight: 2,
      opacity: 0.9,
      fillOpacity: anchor.kind === 'road-area' ? 0.12 : 0.2,
      className: `parking-geographic-shape kind-${anchor.kind}`
    };
  }

  function parkingGeographicBounds() {
    const config = parkingGeographicConfig();
    return config && Array.isArray(config.defaultBounds)
      ? window.L.latLngBounds(config.defaultBounds)
      : null;
  }

  function fitParkingGeographicBounds() {
    if (!parkingGeographicState.map) return;
    const bounds = parkingGeographicBounds();
    if (bounds) parkingGeographicState.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14, animate: false });
  }

  function showParkingGeographicTileError() {
    if (parkingGeographicState.tileError) return;
    parkingGeographicState.tileError = true;
    const root = document.getElementById('parking-geographic-map');
    if (root && !root.querySelector('.parking-geographic-tile-error')) {
      const notice = document.createElement('p');
      notice.className = 'parking-geographic-tile-error';
      notice.setAttribute('role', 'status');
      notice.textContent = text('parkingGeoTileError');
      root.appendChild(notice);
    }
    updateParkingGeographicStatus();
  }

  function clearParkingGeographicTileError() {
    if (!parkingGeographicState.tileError) return;
    parkingGeographicState.tileError = false;
    const root = document.getElementById('parking-geographic-map');
    const notice = root && root.querySelector('.parking-geographic-tile-error');
    if (notice) notice.remove();
    updateParkingGeographicStatus();
  }

  function updateParkingGeographicTouchToggle() {
    const button = document.getElementById('parking-geographic-touch-toggle');
    if (!button) return;
    button.hidden = !parkingGeographicState.coarsePointer;
    button.setAttribute('aria-pressed', parkingGeographicState.touchActive ? 'true' : 'false');
    button.textContent = text(parkingGeographicState.touchActive ? 'parkingGeoTouchDisable' : 'parkingGeoTouchEnable');
  }

  function ensureParkingGeographicMap() {
    const root = document.getElementById('parking-geographic-map');
    const config = parkingGeographicConfig();
    if (!root || parkingGeographicState.map || parkingViewState.active !== 'geographic') return;
    if (!window.L || !config || config.coordinateSpace !== 'EPSG:4326') {
      showParkingGeographicTileError();
      return;
    }

    parkingGeographicState.coarsePointer = (typeof window.matchMedia === 'function' && window.matchMedia('(any-pointer: coarse)').matches)
      || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
    root.innerHTML = '';
    const map = window.L.map(root, {
      minZoom: 11,
      maxZoom: config.maxZoom,
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
      dragging: !parkingGeographicState.coarsePointer,
      touchZoom: !parkingGeographicState.coarsePointer,
      maxBounds: config.maxBounds,
      maxBoundsViscosity: 0.72
    });
    parkingGeographicState.map = map;
    const tileLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: config.maxZoom,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
    });
    tileLayer.on('tileerror', showParkingGeographicTileError);
    tileLayer.on('tileload', clearParkingGeographicTileError);
    tileLayer.addTo(map);
    parkingGeographicState.tileLayer = tileLayer;
    parkingGeographicState.anchorLayer = window.L.layerGroup().addTo(map);
    root.addEventListener('wheel', (event) => {
      if (event.metaKey || event.ctrlKey) map.scrollWheelZoom.enable();
      else map.scrollWheelZoom.disable();
    }, { passive: true });
    fitParkingGeographicBounds();
    updateParkingGeographicTouchToggle();
    window.setTimeout(() => map.invalidateSize(), 40);
  }

  function syncParkingGeographicMap() {
    const config = parkingGeographicConfig();
    const map = parkingGeographicState.map;
    const layer = parkingGeographicState.anchorLayer;
    if (!config || !map || !layer || !window.L) return;
    layer.clearLayers();
    parkingGeographicState.anchors.clear();
    if (parkingGeographicState.tileError) {
      const notice = document.querySelector('#parking-geographic-map .parking-geographic-tile-error');
      if (notice) notice.textContent = text('parkingGeoTileError');
    }

    (config.anchors || []).forEach((anchor) => {
      const position = [anchor.lat, anchor.lng];
      const options = parkingGeographicShapeOptions(anchor);
      const shape = anchor.kind === 'road-area' || anchor.kind === 'venue-area'
        ? window.L.circle(position, { ...options, radius: anchor.accuracyM })
        : window.L.circleMarker(position, { ...options, radius: anchor.kind === 'gate-reference' ? 8 : 9 });
      shape.addTo(layer);
      shape.bindPopup(parkingGeographicPopupHtml(anchor), { maxWidth: 360, className: 'hub-leaflet-popup parking-leaflet-popup' });
      shape.bindTooltip(`${localized(anchor.name)} · ${parkingGeographicAccuracy(anchor)}`, { direction: 'top', opacity: 0.96, className: 'hub-tooltip' });
      parkingGeographicState.anchors.set(anchor.id, { anchor, shape });
    });
    updateParkingGeographicStatus();
    updateParkingGeographicTouchToggle();
    window.setTimeout(() => map.invalidateSize(), 40);
  }

  function focusParkingGeographicAnchor(id) {
    const item = parkingGeographicState.anchors.get(id);
    const map = parkingGeographicState.map;
    if (!item || !map) return;
    if (typeof item.shape.getBounds === 'function') {
      map.fitBounds(item.shape.getBounds(), { padding: [42, 42], maxZoom: 15, animate: false });
    } else {
      map.setView(item.shape.getLatLng(), Math.min(15, Math.max(map.getZoom(), 14)), { animate: false });
    }
    item.shape.openPopup();
    updateParkingGeographicStatus(localized(item.anchor.name));
    if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 760px)').matches) {
      const root = document.getElementById('parking-geographic-map');
      if (root) root.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  function toggleParkingGeographicTouch() {
    if (!parkingGeographicState.map || !parkingGeographicState.coarsePointer) return;
    parkingGeographicState.touchActive = !parkingGeographicState.touchActive;
    if (parkingGeographicState.touchActive) {
      parkingGeographicState.map.dragging.enable();
      parkingGeographicState.map.touchZoom.enable();
    } else {
      parkingGeographicState.map.dragging.disable();
      parkingGeographicState.map.touchZoom.disable();
    }
    updateParkingGeographicTouchToggle();
  }

  function setParkingView(nextMode, focusTab) {
    const mode = nextMode === 'official' ? 'official' : 'geographic';
    if (parkingViewState.active !== mode) parkingViewState.active = mode;
    renderParkingViewTabs();
    if (mode === 'official') {
      ensureParkingTrafficMap();
      syncParkingTrafficMap();
      window.setTimeout(() => parkingTrafficState.map && parkingTrafficState.map.invalidateSize(), 40);
    } else {
      ensureParkingGeographicMap();
      syncParkingGeographicMap();
      window.setTimeout(() => parkingGeographicState.map && parkingGeographicState.map.invalidateSize(), 40);
    }
    if (focusTab) {
      const tab = document.querySelector(`[data-parking-view="${mode}"]`);
      if (tab) tab.focus();
    }
  }

  function stopPopupHtml(stop, place) {
    const lat = Number(place.lat).toFixed(5);
    const lng = Number(place.lng).toFixed(5);
    const precision = stop.precision === 'venue' ? text('planPrecisionVenue') : text('planPrecisionArea');
    const osm = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(place.lat)}&mlon=${encodeURIComponent(place.lng)}#map=16/${encodeURIComponent(place.lat)}/${encodeURIComponent(place.lng)}`;
    return `
      <div class="hub-popup">
        <strong>${escapeHtml(stop.marker)} · ${escapeHtml(localized(stop.label))}</strong>
        <p class="hub-place">${escapeHtml(localized(place.name))}</p>
        <p class="hub-note">${escapeHtml(precision)}</p>
        <p class="hub-coords">${escapeHtml(text('mapCoords'))}: ${escapeHtml(lat)}, ${escapeHtml(lng)}</p>
        <a href="${escapeHtml(osm)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text('mapOpenOsm'))}</a>
      </div>`;
  }

  function routeMapStops(route) {
    const stops = (route.stops || []).map((stop) => ({ stop, kind: 'shared' }));
    for (const branch of route.branches || []) {
      const kind = branch.kind === 'addOn' ? 'add-on' : 'choice';
      for (const stop of branch.stops || []) stops.push({ stop, kind });
    }
    return stops;
  }

  function routeSegments(route) {
    const segments = [];
    const required = (stops) => (stops || []).filter((stop) => !stop.optional && getMapPlace(stop.place));
    const append = (stops, kind) => {
      for (let index = 0; index < stops.length - 1; index += 1) {
        segments.push({ from: stops[index], to: stops[index + 1], kind });
      }
    };

    const shared = required(route.stops);
    append(shared, 'shared');

    for (const branch of route.branches || []) {
      if (branch.kind === 'addOn') continue;
      append(required(branch.stops), 'choice');
    }
    return segments;
  }

  async function fetchOsrmRoute(fromPlace, toPlace) {
    const cacheKey = `${fromPlace.lat},${fromPlace.lng}->${toPlace.lat},${toPlace.lng}`;
    if (routeCache.has(cacheKey)) return routeCache.get(cacheKey);
    const request = (async () => {
      const url = `https://router.project-osrm.org/route/v1/driving/${fromPlace.lng},${fromPlace.lat};${toPlace.lng},${toPlace.lat}?overview=full&geometries=geojson`;
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeout = controller ? window.setTimeout(() => controller.abort(), 5000) : null;
      try {
        const response = await fetch(url, controller ? { signal: controller.signal } : undefined);
        if (!response.ok) throw new Error('route failed');
        const payload = await response.json();
        if (payload.code !== 'Ok' || !payload.routes || !payload.routes[0]) throw new Error('no route');
        return payload.routes[0].geometry.coordinates.map((pair) => [pair[1], pair[0]]);
      } catch (_) {
        return null;
      } finally {
        if (timeout != null) window.clearTimeout(timeout);
      }
    })();
    routeCache.set(cacheKey, request);
    const coords = await request;
    if (coords) {
      routeCache.set(cacheKey, coords);
    } else if (routeCache.get(cacheKey) === request) {
      routeCache.delete(cacheKey);
    }
    return coords;
  }

  async function initPlanMap(el, planItem) {
    if (!window.L || !planItem.route) return;
    const generation = planMapGeneration;
    const route = planItem.route;
    const coarsePointer = (typeof window.matchMedia === 'function' && window.matchMedia('(any-pointer: coarse)').matches)
      || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
    const map = window.L.map(el, {
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
      dragging: !coarsePointer,
      touchZoom: true
    });
    const markerLegPane = map.createPane('planMarkerLegs');
    markerLegPane.style.zIndex = '450';
    markerLegPane.style.pointerEvents = 'none';
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
    }).addTo(map);
    el.addEventListener('wheel', (event) => {
      if (event.metaKey || event.ctrlKey) map.scrollWheelZoom.enable();
      else map.scrollWheelZoom.disable();
    }, { passive: true });

    const layers = {
      markers: [],
      markerEntries: [],
      markerLegs: window.L.layerGroup().addTo(map),
      polylines: [],
      statusEl: null
    };
    const bounds = [];
    routeMapStops(route).forEach(({ stop, kind }) => {
      const place = getMapPlace(stop.place);
      if (!place) return;
      const tone = stop.optional ? 'optional' : kind;
      const title = `${stop.marker}. ${localized(stop.label)}`;
      const marker = window.L.marker([place.lat, place.lng], {
        icon: makeStopIcon(stop.marker, tone),
        title,
        keyboard: true,
        riseOnHover: true
      }).addTo(map);
      marker.bindPopup(stopPopupHtml(stop, place), { maxWidth: 240, className: 'hub-leaflet-popup' });
      marker.bindTooltip(title, {
        direction: 'top',
        offset: [0, -16],
        opacity: 0.95,
        className: 'hub-tooltip'
      });
      layers.markers.push(marker);
      layers.markerEntries.push({ marker, stop, tone, offsetKey: '0,0' });
      bounds.push([place.lat, place.lng]);
    });

    const updateMarkerSeparation = () => separatePlanMarkers(map, layers.markerEntries, layers.markerLegs);
    map.on('zoomend resize', updateMarkerSeparation);

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [58, 58], maxZoom: 13 });
      updateMarkerSeparation();
    }
    const registration = { map, layers, planItem, el, generation };
    planMaps.set(planItem.id, registration);
    window.setTimeout(() => {
      if (planMaps.get(planItem.id) === registration && el.isConnected) {
        map.invalidateSize();
        updateMarkerSeparation();
      }
    }, 40);

    const segments = routeSegments(route);
    if (segments.length) {
      const status = document.createElement('p');
      status.className = 'plan-map-status';
      status.textContent = text('planRouteLoading');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      el.appendChild(status);
      layers.statusEl = status;

      const results = await Promise.all(segments.map(async (segment) => {
        const from = getMapPlace(segment.from.place);
        const to = getMapPlace(segment.to.place);
        const coords = from && to ? await fetchOsrmRoute(from, to) : null;
        return { segment, coords };
      }));

      if (generation !== planMapGeneration || !el.isConnected || planMaps.get(planItem.id) !== registration) return;

      let routeFailed = false;
      for (const { segment, coords } of results) {
        if (coords) {
          const options = {
            className: 'plan-route-line',
            color: segment.kind === 'choice' ? '#ad3c1d' : '#245c4a',
            weight: segment.kind === 'choice' ? 3.5 : 4,
            opacity: 0.88,
            lineCap: 'round',
            lineJoin: 'round',
            interactive: false
          };
          if (segment.kind === 'choice') options.dashArray = '8 7';
          const line = window.L.polyline(coords, options).addTo(map);
          layers.polylines.push(line);
        } else {
          routeFailed = true;
        }
      }
      if (status.parentNode) status.remove();
      layers.statusEl = null;
      if (routeFailed) {
        const notice = document.createElement('p');
        notice.className = 'plan-map-status unavailable';
        notice.textContent = text('planRouteUnavailable');
        notice.setAttribute('role', 'status');
        notice.setAttribute('aria-live', 'polite');
        el.appendChild(notice);
        layers.statusEl = notice;
      }
    }
  }

  function schedulePlanMaps() {
    if (!window.L) return;
    if (planMapObserver) planMapObserver.disconnect();
    planMapObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.2) return;
        const el = entry.target;
        const mapId = el.getAttribute('data-plan-map');
        if (!mapId || planMaps.has(mapId)) return;
        const planItem = DATA.quickPlan.find((item) => item.id === mapId);
        if (planItem) {
          initPlanMap(el, planItem);
          planMapObserver.unobserve(el);
        }
      });
    }, { threshold: [0, 0.2, 0.5] });

    document.querySelectorAll('[data-plan-map]').forEach((el) => {
      if (!planMaps.has(el.getAttribute('data-plan-map'))) {
        planMapObserver.observe(el);
      }
    });
  }

  function invalidatePlanMaps() {
    planMaps.forEach(({ map }) => {
      window.setTimeout(() => map.invalidateSize(), 40);
    });
  }

  function makeHubIcon(tone) {
    return window.L.divIcon({
      className: 'hub-pin-wrap',
      html: `<span class="hub-pin ${escapeHtml(tone || 'default')}" aria-hidden="true"></span>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -12]
    });
  }

  function syncHubMapMarkers() {
    if (!mapState.map || !window.L) return;
    mapState.markers.forEach((marker) => marker.remove());
    mapState.markers = [];
    const hubs = DATA.mapHubs || [];
    const bounds = [];
    hubs.forEach((hub) => {
      const marker = window.L.marker([hub.lat, hub.lng], {
        icon: makeHubIcon(hub.tone),
        title: localized(hub.name),
        keyboard: true,
        riseOnHover: true
      }).addTo(mapState.map);
      marker.bindPopup(hubPopupHtml(hub), { maxWidth: 260, className: 'hub-leaflet-popup' });
      marker.bindTooltip(localized(hub.name), {
        direction: 'top',
        offset: [0, -10],
        opacity: 0.95,
        className: 'hub-tooltip'
      });
      mapState.markers.push(marker);
      bounds.push([hub.lat, hub.lng]);
    });
    if (bounds.length) {
      mapState.map.fitBounds(bounds, { padding: [36, 36], maxZoom: 12 });
    }
  }

  function ensureHubMap() {
    const root = document.getElementById('hub-map');
    if (!root) return;
    if (!window.L) {
      root.innerHTML = `<div class="hub-map-fallback">${escapeHtml(text('mapFallback'))}</div>`;
      return;
    }
    if (!mapState.map) {
      mapState.map = window.L.map(root, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true
      });
      mapState.layer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
      }).addTo(mapState.map);
      root.addEventListener('wheel', (event) => {
        if (event.metaKey || event.ctrlKey) mapState.map.scrollWheelZoom.enable();
        else mapState.map.scrollWheelZoom.disable();
      }, { passive: true });
      window.setTimeout(() => {
        mapState.map.invalidateSize();
        syncHubMapMarkers();
      }, 40);
    } else {
      syncHubMapMarkers();
      window.setTimeout(() => mapState.map && mapState.map.invalidateSize(), 40);
    }
  }

  function renderDynamicContent() {
    renderQuickPlan();
    renderScheduleFilters();
    renderSchedule();
    renderTourMorning();
    renderParkingTraffic();
    renderBrandHouses();
    renderNearby();
    renderStays();
    renderCommuteOptions();
    renderTransportTips();
    renderSources();
    ensureHubMap();
    applyTemporalSections();
    updateHeroCtas();
    schedulePlanMaps();
  }

  function applyLanguage() {
    applyStaticTranslations();
    updateToggleUi();
    renderDynamicContent();
    if (!hasHandledInitialHash) {
      revealHashTarget(true);
      hasHandledInitialHash = true;
    }
  }

  function setLanguage(next) {
    state.lang = next === 'en' ? 'en' : 'zh';
    try { localStorage.setItem(LANG_KEY, state.lang); } catch (_) {}
    applyLanguage();
  }

  function setTheme(dark, persist) {
    document.documentElement.classList.toggle('dark', Boolean(dark));
    if (persist) {
      try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (_) {}
    }
    updateToggleUi();
    if (mapState.map) window.setTimeout(() => mapState.map.invalidateSize(), 40);
    if (parkingTrafficState.map) window.setTimeout(() => parkingTrafficState.map.invalidateSize(), 40);
    if (parkingGeographicState.map) window.setTimeout(() => parkingGeographicState.map.invalidateSize(), 40);
    invalidatePlanMaps();
  }

  function wireInteractions() {
    const langButton = document.getElementById('lang-toggle');
    const themeButton = document.getElementById('theme-toggle');
    const sectionNavToggle = document.getElementById('section-nav-toggle');
    const sectionNavLinks = document.getElementById('primary-nav-links');
    const heroActions = document.querySelector('.hero-actions');
    const backToTop = document.getElementById('back-to-top');
    const from = document.getElementById('commute-from');
    const to = document.getElementById('commute-to');
    const filterPanel = document.querySelector('.filter-panel');
    const parkingPanel = document.getElementById('parking-traffic');

    if (langButton) langButton.addEventListener('click', () => setLanguage(state.lang === 'zh' ? 'en' : 'zh'));
    if (themeButton) themeButton.addEventListener('click', () => setTheme(!isDark(), true));
    if (sectionNavToggle) sectionNavToggle.addEventListener('click', () => {
      state.navMenuOpen = !state.navMenuOpen;
      updateSectionNavUi();
      if (state.navMenuOpen && sectionNavLinks) {
        window.requestAnimationFrame(() => sectionNavLinks.querySelector('a')?.focus());
      }
    });
    if (sectionNavLinks) sectionNavLinks.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (!link || !window.matchMedia('(max-width: 760px)').matches) return;
      state.navMenuOpen = false;
      updateSectionNavUi();
      window.setTimeout(() => focusFragmentTarget(link.hash), 0);
    });
    if (backToTop) backToTop.addEventListener('click', () => {
      state.navMenuOpen = false;
      updateSectionNavUi();
    });
    if (heroActions) heroActions.addEventListener('click', (event) => {
      const link = event.target.closest('a[data-hero-intent]');
      if (!link) return;
      activateHeroIntent(link.getAttribute('data-hero-intent'));
      window.setTimeout(() => {
        applyTemporalSections();
        revealHashTarget(false);
        focusFragmentTarget(link.hash);
      }, 0);
    });
    if (from) from.addEventListener('change', () => { state.from = from.value; renderCommuteResult(); });
    if (to) to.addEventListener('change', () => { state.to = to.value; renderCommuteResult(); });

    document.addEventListener('toggle', (event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement)) return;
      if (details.hasAttribute('data-past-group')) {
        const group = details.getAttribute('data-past-group');
        if (group === 'quick') state.quickPastOpen = details.open;
        if (group === 'schedule') {
          state.schedulePastOpen = details.open;
        }
      }
      if (!details.hasAttribute('data-temporal-details') || details.dataset.temporalSync === 'true') return;
      const section = details.closest('[data-temporal-section]');
      if (section && section.id) temporalUserOpen.set(section.id, details.open);
      if (details.open) invalidateVisibleMaps();
    }, true);
    window.addEventListener('hashchange', () => {
      applyTemporalSections();
      revealHashTarget(true);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !state.navMenuOpen) return;
      state.navMenuOpen = false;
      updateSectionNavUi();
      if (sectionNavToggle) sectionNavToggle.focus();
    });

    if (parkingPanel) {
      parkingPanel.addEventListener('click', (event) => {
        const viewTab = event.target.closest('[data-parking-view]');
        if (viewTab) {
          setParkingView(viewTab.getAttribute('data-parking-view'), true);
          return;
        }
        const geographicButton = event.target.closest('[data-parking-geographic-focus]');
        if (geographicButton) {
          focusParkingGeographicAnchor(geographicButton.getAttribute('data-parking-geographic-focus'));
          return;
        }
        if (event.target.id === 'parking-geographic-touch-toggle' || event.target.closest('#parking-geographic-touch-toggle')) {
          toggleParkingGeographicTouch();
          return;
        }
        if (event.target.id === 'parking-geographic-reset' || event.target.closest('#parking-geographic-reset')) {
          fitParkingGeographicBounds();
          return;
        }
        const dayButton = event.target.closest('[data-parking-day]');
        if (dayButton) {
          const nextDay = dayButton.getAttribute('data-parking-day');
          if (nextDay && nextDay !== parkingTrafficState.day) {
            parkingTrafficState.day = nextDay;
            renderParkingTraffic();
            const replacement = parkingPanel.querySelector(`[data-parking-day="${nextDay}"]`);
            if (replacement) replacement.focus();
          }
          return;
        }
        const layerButton = event.target.closest('[data-parking-layer]');
        if (layerButton) {
          const nextLayer = layerButton.getAttribute('data-parking-layer');
          if (nextLayer && nextLayer !== parkingTrafficState.layer) {
            parkingTrafficState.layer = nextLayer;
            renderParkingTraffic();
            const replacement = parkingPanel.querySelector(`[data-parking-layer="${nextLayer}"]`);
            if (replacement) replacement.focus();
          }
          return;
        }
        const pointButton = event.target.closest('[data-parking-focus]');
        if (pointButton) {
          focusParkingPoint(pointButton.getAttribute('data-parking-focus'));
          return;
        }
        const trafficButton = event.target.closest('[data-parking-traffic-focus]');
        if (trafficButton) {
          focusParkingTraffic(trafficButton.getAttribute('data-parking-traffic-focus'));
          return;
        }
        if (event.target.id === 'parking-map-touch-toggle' || event.target.closest('#parking-map-touch-toggle')) {
          toggleParkingMapTouch();
        }
      });
      parkingPanel.addEventListener('keydown', (event) => {
        const currentTab = event.target.closest('[role="tab"][data-parking-view]');
        if (!currentTab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const tabs = Array.from(parkingPanel.querySelectorAll('[role="tab"][data-parking-view]'));
        const currentIndex = tabs.indexOf(currentTab);
        if (currentIndex < 0) return;
        event.preventDefault();
        let nextIndex = currentIndex;
        if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = tabs.length - 1;
        else if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
        else nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        setParkingView(tabs[nextIndex].getAttribute('data-parking-view'), true);
      });
    }

    if (filterPanel) {
      filterPanel.addEventListener('click', (event) => {
        const dayButton = event.target.closest('[data-day]');
        if (dayButton) {
          const nextDay = dayButton.getAttribute('data-day');
          if (nextDay && nextDay !== state.day) {
            state.day = nextDay;
            renderScheduleFilters();
            renderSchedule();
            focusRenderedFilter('data-day', nextDay);
          }
          return;
        }
        const typeButton = event.target.closest('[data-type]');
        if (typeButton) {
          const nextType = typeButton.getAttribute('data-type');
          if (nextType && nextType !== state.type) {
            state.type = nextType;
            renderScheduleFilters();
            renderSchedule();
            focusRenderedFilter('data-type', nextType);
          }
          return;
        }
        const areaButton = event.target.closest('[data-live-area]');
        if (areaButton) {
          const nextArea = areaButton.getAttribute('data-live-area');
          if (nextArea && nextArea !== state.area) {
            state.area = nextArea;
            renderScheduleFilters();
            renderSchedule();
            focusRenderedFilter('data-live-area', nextArea);
          }
          return;
        }
      });
    }

    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
        if (!localStorage.getItem(THEME_KEY)) setTheme(event.matches, false);
      });
    } catch (_) {}
  }

  try {
    const storedLanguage = localStorage.getItem(LANG_KEY);
    if (storedLanguage === 'en' || storedLanguage === 'zh') state.lang = storedLanguage;
  } catch (_) {}

  document.addEventListener('DOMContentLoaded', () => {
    applyLanguage();
    wireInteractions();
    document.documentElement.classList.add('nav-ready');
    updateSectionNavUi();
  });
})();
