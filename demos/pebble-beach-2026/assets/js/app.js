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
  const state = { lang: 'zh', day: 'all', type: 'all', from: 'monterey', to: 'pebble' };
  const mapState = { map: null, layer: null, markers: [] };
  const routeCache = new Map();
  const planMaps = new Map();
  let planMapObserver = null;

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
      ? '2026 Monterey Car Week 圆石滩车展公众指南路线图'
      : 'Route map for the 2026 Pebble Beach and Monterey Car Week public guide');
    setMeta('meta[name="twitter:title"]', text('ogTitle'));
    setMeta('meta[name="twitter:description"]', text('ogDescription'));

    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.getAttribute('data-i18n');
      if (DATA.labels[key]) element.textContent = text(key);
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

  function renderPlanStops(item) {
    const route = item.route;
    if (!route || !Array.isArray(route.stops) || !route.stops.length) return '';
    const orLabel = text('planRouteOr');
    let seqNum = 0;
    const chips = route.stops.map((stop, index) => {
      const num = route.mode === 'choice' ? index + 1 : ++seqNum;
      const chip = `<span class="plan-stop-chip">${num}. ${escapeHtml(localized(stop.label))}</span>`;
      if (route.mode === 'choice' && index > 0) {
        return `<span class="plan-stop-or">${escapeHtml(orLabel)}</span>${chip}`;
      }
      return chip;
    });
    return `
      <div class="plan-stops-label">${escapeHtml(text('planStops'))}</div>
      <div class="plan-stops">${chips.join('')}</div>
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

  function renderPlanTimeline(item) {
    const slots = item.schedule;
    if (!Array.isArray(slots) || !slots.length) return '';
    const rows = slots.map((slot) => {
      const tone = slot.tone || 'core';
      const note = slot.note ? `<p class="plan-timeline-note">${escapeHtml(localized(slot.note))}</p>` : '';
      return `
        <li class="plan-timeline-item tone-${escapeHtml(tone)}">
          <div class="plan-timeline-time">
            <strong>${escapeHtml(slot.time)}</strong>
            <span class="plan-tone">${escapeHtml(planToneLabel(tone))}</span>
          </div>
          <div class="plan-timeline-copy">
            <p class="plan-timeline-title">${escapeHtml(localized(slot.title))}</p>
            ${note}
          </div>
        </li>`;
    }).join('');
    return `
      <details class="plan-timeline">
        <summary>${escapeHtml(text('planTimeline'))}</summary>
        <ol class="plan-timeline-list">${rows}</ol>
        <p class="plan-timeline-hint">${escapeHtml(text('planTimelineHint'))}</p>
      </details>`;
  }

  function destroyPlanMaps() {
    if (planMapObserver) {
      planMapObserver.disconnect();
      planMapObserver = null;
    }
    planMaps.forEach(({ map }) => map.remove());
    planMaps.clear();
  }

  function renderQuickPlan() {
    destroyPlanMaps();
    const root = document.getElementById('quick-plan-track');
    if (!root) return;
    root.innerHTML = DATA.quickPlan.map((item) => `
      <article class="plan-day${item.flagship ? ' flagship' : ''}">
        <div class="plan-day-copy">
          <div class="plan-date">
            <strong>${escapeHtml(localized(item.date))}</strong>
            <span>${escapeHtml(localized(item.day))}</span>
          </div>
          <h3>${escapeHtml(localized(item.title))}</h3>
          <p>${escapeHtml(localized(item.body))}</p>
          <span class="plan-cost">${escapeHtml(localized(item.cost))}</span>
          ${renderPlanStops(item)}
          ${renderPlanTimeline(item)}
        </div>
        ${item.id && item.route ? `<div class="plan-day-map" data-plan-map="${escapeHtml(item.id)}" aria-label="${escapeHtml(localized(item.title))}"></div>` : ''}
      </article>`).join('');
  }

  function renderFilters() {
    const dayRoot = document.getElementById('day-filter');
    const typeRoot = document.getElementById('type-filter');
    if (!dayRoot || !typeRoot) return;

    const dayButtons = [{ id: 'all', label: DATA.ui.allDays }].concat(
      DATA.days.map((day) => ({ id: day.id, label: day.short }))
    );
    dayRoot.setAttribute('aria-label', state.lang === 'zh' ? '按日期筛选' : 'Filter by day');
    dayRoot.innerHTML = dayButtons.map((item) => `
      <button type="button" class="filter-button" data-day="${escapeHtml(item.id)}" aria-pressed="${state.day === item.id}">
        ${escapeHtml(localized(item.label))}
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

    dayRoot.querySelectorAll('[data-day]').forEach((button) => {
      button.addEventListener('click', () => {
        state.day = button.getAttribute('data-day');
        renderFilters();
        renderSchedule();
        restoreFilterFocus('day', state.day);
      });
    });
    typeRoot.querySelectorAll('[data-type]').forEach((button) => {
      button.addEventListener('click', () => {
        state.type = button.getAttribute('data-type');
        renderFilters();
        renderSchedule();
        restoreFilterFocus('type', state.type);
      });
    });
  }

  function restoreFilterFocus(kind, value) {
    const candidates = document.querySelectorAll(`[data-${kind}]`);
    for (const candidate of candidates) {
      if (candidate.getAttribute(`data-${kind}`) === value) {
        candidate.focus();
        break;
      }
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

  function renderEvent(event) {
    const eventSources = event.sources || [{ url: event.source, label: DATA.ui.officialSource }];
    const priceClass = event.categories.includes('free') ? 'free' : (event.categories.includes('paid') ? 'paid' : 'alert');
    return `
      <article class="event-card" id="event-${escapeHtml(event.id)}">
        <div class="event-main">
          <div class="event-time">${escapeHtml(event.time)}<small>${escapeHtml(localized(event.timeNote))}</small></div>
          <div class="event-copy">
            <h3>${escapeHtml(localized(event.title))}</h3>
            <p class="event-location">${escapeHtml(localized(event.location))}</p>
            <p class="event-summary">${escapeHtml(localized(event.summary))}</p>
            <div class="event-meta">
              <span class="tag ${priceClass}">${escapeHtml(localized(event.price))}</span>
              ${event.tags.filter((tag) => tag !== 'free' && tag !== 'paid').map((tag) => `<span class="tag ${tagClass(tag)}">${escapeHtml(tagLabel(tag))}</span>`).join('')}
            </div>
          </div>
          <div class="event-score"><strong>${escapeHtml(event.score)}/5</strong><span>${escapeHtml(ui('worth'))}</span></div>
        </div>
        <details class="event-more">
          <summary>${escapeHtml(ui('details'))}</summary>
          <div class="event-detail">
            <p><strong>${escapeHtml(ui('why'))}</strong>${escapeHtml(localized(event.why))}</p>
            <p><strong>${escapeHtml(ui('access'))}</strong>${escapeHtml(localized(event.access))}</p>
            <div class="event-sources">
              ${eventSources.map((source) => `<a class="event-source" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(localized(source.label))}</a>`).join('')}
            </div>
          </div>
        </details>
      </article>`;
  }

  function renderSchedule() {
    const root = document.getElementById('schedule-results');
    const status = document.getElementById('schedule-status');
    if (!root) return;

    const filtered = DATA.events.filter((event) => {
      const matchesDay = state.day === 'all' || event.date === state.day;
      const matchesType = state.type === 'all' || event.categories.includes(state.type);
      return matchesDay && matchesType;
    });

    if (status) {
      status.textContent = state.lang === 'zh'
        ? `显示 ${filtered.length} 个活动`
        : `Showing ${filtered.length} ${filtered.length === 1 ? 'event' : 'events'}`;
    }

    if (!filtered.length) {
      root.innerHTML = `<p class="empty-state">${escapeHtml(ui('noResults'))}</p>`;
      return;
    }

    root.innerHTML = DATA.days.map((day) => {
      const events = filtered.filter((event) => event.date === day.id);
      if (!events.length) return '';
      return `
        <section class="day-group" aria-labelledby="day-${escapeHtml(day.id)}">
          <header class="day-heading" id="day-${escapeHtml(day.id)}">
            <time datetime="${escapeHtml(day.id)}">${escapeHtml(localized(day.short))}</time>
            <span>${escapeHtml(localized(day.label))}</span>
            <em>${events.length} ${escapeHtml(ui(events.length === 1 ? 'dayLabelSingular' : 'dayLabel'))}</em>
          </header>
          <div class="event-list">${events.map(renderEvent).join('')}</div>
        </section>`;
    }).join('');
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
        <p class="hub-coords">${escapeHtml(ui('mapCoords'))}: ${escapeHtml(lat)}, ${escapeHtml(lng)}</p>
        <a href="${escapeHtml(osm)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ui('mapOpenOsm'))}</a>
      </div>`;
  }

  function makeStopIcon(number, tone) {
    return window.L.divIcon({
      className: 'stop-pin-wrap',
      html: `<span class="stop-pin ${escapeHtml(tone || 'default')}" aria-hidden="true">${escapeHtml(String(number))}</span>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -14]
    });
  }

  function getMapPlace(placeId) {
    return DATA.mapPlaces && DATA.mapPlaces[placeId];
  }

  function stopPopupHtml(stop, place) {
    const lat = Number(place.lat).toFixed(5);
    const lng = Number(place.lng).toFixed(5);
    return `
      <div class="hub-popup">
        <strong>${escapeHtml(localized(stop.label))}</strong>
        <p class="hub-place">${escapeHtml(localized(place.name))}</p>
        <p class="hub-coords">${escapeHtml(text('mapCoords'))}: ${escapeHtml(lat)}, ${escapeHtml(lng)}</p>
      </div>`;
  }

  async function fetchOsrmRoute(fromPlace, toPlace) {
    const cacheKey = `${fromPlace.lat},${fromPlace.lng}->${toPlace.lat},${toPlace.lng}`;
    if (routeCache.has(cacheKey)) return routeCache.get(cacheKey);
    const url = `https://router.project-osrm.org/route/v1/driving/${fromPlace.lng},${fromPlace.lat};${toPlace.lng},${toPlace.lat}?overview=full&geometries=geojson`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('route failed');
      const payload = await response.json();
      if (payload.code !== 'Ok' || !payload.routes || !payload.routes[0]) throw new Error('no route');
      const coords = payload.routes[0].geometry.coordinates.map((pair) => [pair[1], pair[0]]);
      routeCache.set(cacheKey, coords);
      return coords;
    } catch (_) {
      routeCache.set(cacheKey, null);
      return null;
    }
  }

  async function initPlanMap(el, planItem) {
    if (!window.L || !planItem.route) return;
    const route = planItem.route;
    const map = window.L.map(el, {
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true
    });
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
    }).addTo(map);
    el.addEventListener('wheel', (event) => {
      if (event.metaKey || event.ctrlKey) map.scrollWheelZoom.enable();
      else map.scrollWheelZoom.disable();
    }, { passive: true });

    const layers = { markers: [], polylines: [], statusEl: null };
    const bounds = [];
    let seqNum = 0;

    route.stops.forEach((stop, index) => {
      const place = getMapPlace(stop.place);
      if (!place) return;
      const num = route.mode === 'choice' ? index + 1 : ++seqNum;
      const tone = route.mode === 'choice' ? 'choice' : 'default';
      const marker = window.L.marker([place.lat, place.lng], {
        icon: makeStopIcon(num, tone),
        title: localized(stop.label),
        keyboard: true,
        riseOnHover: true
      }).addTo(map);
      marker.bindPopup(stopPopupHtml(stop, place), { maxWidth: 240, className: 'hub-leaflet-popup' });
      marker.bindTooltip(`${num}. ${localized(stop.label)}`, {
        direction: 'top',
        offset: [0, -12],
        opacity: 0.95,
        className: 'hub-tooltip'
      });
      layers.markers.push(marker);
      bounds.push([place.lat, place.lng]);
    });

    if (route.mode === 'sequence' && route.stops.length >= 2) {
      const status = document.createElement('p');
      status.className = 'plan-map-status';
      status.textContent = text('planRouteLoading');
      el.appendChild(status);
      layers.statusEl = status;

      let routeFailed = false;
      for (let i = 0; i < route.stops.length - 1; i += 1) {
        const from = getMapPlace(route.stops[i].place);
        const to = getMapPlace(route.stops[i + 1].place);
        if (!from || !to) continue;
        // eslint-disable-next-line no-await-in-loop
        const coords = await fetchOsrmRoute(from, to);
        if (coords) {
          const line = window.L.polyline(coords, {
            color: '#ad3c1d',
            weight: 4,
            opacity: 0.88,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);
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
        el.appendChild(notice);
        layers.statusEl = notice;
      }
    }

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 });
    }
    planMaps.set(planItem.id, { map, layers, planItem });
    window.setTimeout(() => map.invalidateSize(), 40);
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
    renderNearby();
    renderFilters();
    renderSchedule();
    renderStays();
    renderCommuteOptions();
    renderTransportTips();
    renderSources();
    ensureHubMap();
    schedulePlanMaps();
  }

  function applyLanguage() {
    applyStaticTranslations();
    updateToggleUi();
    renderDynamicContent();
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
    invalidatePlanMaps();
  }

  function wireInteractions() {
    const langButton = document.getElementById('lang-toggle');
    const themeButton = document.getElementById('theme-toggle');
    const from = document.getElementById('commute-from');
    const to = document.getElementById('commute-to');

    if (langButton) langButton.addEventListener('click', () => setLanguage(state.lang === 'zh' ? 'en' : 'zh'));
    if (themeButton) themeButton.addEventListener('click', () => setTheme(!isDark(), true));
    if (from) from.addEventListener('change', () => { state.from = from.value; renderCommuteResult(); });
    if (to) to.addEventListener('change', () => { state.to = to.value; renderCommuteResult(); });

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
  });
})();
