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
  const TIMEZONE = 'America/Los_Angeles';
  const WINDOW_START = '2026-08-07';
  const WINDOW_END = '2026-08-17';
  const state = {
    lang: 'zh',
    day: 'all',
    type: 'all',
    area: 'all',
    liveMode: 'browse',
    showPast: false,
    from: 'monterey',
    to: 'pebble'
  };
  const mapState = { map: null, layer: null, markers: [] };
  const routeCache = new Map();
  const planMaps = new Map();
  let planMapObserver = null;
  let planMapGeneration = 0;
  let clockTimer = null;

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

  function getClock() {
    const params = new URLSearchParams(window.location.search);
    const demoDate = params.get('demoDate');
    const demoTime = params.get('demoTime');
    let instant;
    if (demoDate && /^\d{4}-\d{2}-\d{2}$/.test(demoDate)) {
      const hm = demoTime && /^\d{1,2}:\d{2}$/.test(demoTime) ? demoTime : '12:00';
      const hmParts = hm.split(':');
      const padded = `${String(hmParts[0]).padStart(2, '0')}:${hmParts[1]}`;
      instant = new Date(`${demoDate}T${padded}:00-07:00`);
    } else {
      instant = new Date();
    }
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(instant);
    const pick = (type) => {
      const part = parts.find((entry) => entry.type === type);
      return part ? part.value : '';
    };
    const dateIso = `${pick('year')}-${pick('month')}-${pick('day')}`;
    let hour = pick('hour');
    if (hour === '24') hour = '00';
    const hm = `${hour}:${pick('minute')}`;
    return { instant, dateIso, hm, minutes: parseHm(hm), demo: Boolean(demoDate) };
  }

  function inCarWeekWindow(dateIso) {
    return dateIso >= WINDOW_START && dateIso <= WINDOW_END;
  }

  function dayRelation(dateIso, todayIso) {
    if (dateIso < todayIso) return 'past';
    if (dateIso === todayIso) return 'today';
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

  function eventHappeningNow(event, clock) {
    if (event.date !== clock.dateIso) return false;
    const windows = parseTimeWindows(event.time);
    if (!windows.length) return false;
    const now = clock.minutes;
    if (now == null) return false;
    return windows.some((window) => now >= window.start && now <= window.end);
  }

  function quickPlanDateIso(item) {
    const match = String(item && item.id || '').match(/^qp-(\d{4})$/);
    if (!match) return '';
    const mmdd = match[1];
    return `2026-${mmdd.slice(0, 2)}-${mmdd.slice(2, 4)}`;
  }

  function areaName(areaId) {
    const area = (DATA.liveAreas || []).find((entry) => entry.id === areaId);
    return area ? localized(area.name) : areaId;
  }

  function matchesLiveFilters(event, clock) {
    if (state.type !== 'all' && !event.categories.includes(state.type)) return false;
    if (state.area !== 'all' && event.area !== state.area) return false;
    if (state.liveMode === 'now') return eventHappeningNow(event, clock);
    if (state.liveMode === 'today') return event.date === clock.dateIso;
    if (state.day !== 'all' && event.date !== state.day) return false;
    // Past days stay in the result set so browse mode can fold them in the UI
    // (quick plan + day-group details). showPast only controls fold vs expand.
    return true;
  }

  function formatClockDisplay(clock) {
    const dayMeta = DATA.days.find((day) => day.id === clock.dateIso);
    const dayLabel = dayMeta ? localized(dayMeta.short) : clock.dateIso;
    const demoNote = clock.demo
      ? (state.lang === 'zh' ? '（演示）' : ' (demo)')
      : '';
    return `${dayLabel} ${clock.hm} PT${demoNote}`;
  }

  function statusWithCount(key, count) {
    const template = text(key);
    return template.replace('{count}', String(count));
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

  function renderPlanTimeline(item) {
    const slots = item.schedule;
    if (!Array.isArray(slots) || !slots.length) return '';
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
      <details class="plan-timeline">
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
    destroyPlanMaps();
    const root = document.getElementById('quick-plan-track');
    if (!root) return;
    const clock = getClock();
    const inWindow = inCarWeekWindow(clock.dateIso);

    function buildPlanCard(item) {
      const dateIso = quickPlanDateIso(item);
      const relation = dayRelation(dateIso, clock.dateIso);
      const classes = ['plan-day'];
      if (item.flagship) classes.push('flagship');
      if (relation === 'past') classes.push('is-past');
      if (relation === 'today') classes.push('is-today');
      return `
      <article class="${classes.join(' ')}">
        <div class="plan-day-copy">
          <div class="plan-date">
            <strong>${escapeHtml(localized(item.date))}</strong>
            <span>${escapeHtml(localized(item.day))}</span>
            ${relation === 'today' ? `<span class="plan-day-badge">${escapeHtml(text('liveTodayBadge'))}</span>` : ''}
            ${relation === 'past' ? `<span class="plan-day-badge is-past">${escapeHtml(text('livePastBadge'))}</span>` : ''}
          </div>
          <h3>${escapeHtml(localized(item.title))}</h3>
          <p>${escapeHtml(localized(item.body))}</p>
          <span class="plan-cost">${escapeHtml(localized(item.cost))}</span>
          ${renderPlanStops(item)}
          ${renderPlanTimeline(item)}
        </div>
        ${item.id && item.route ? `<div class="plan-day-map" data-plan-map="${escapeHtml(item.id)}" role="region" aria-label="${escapeHtml(text('planMapLabel'))}: ${escapeHtml(localized(item.title))}"></div>` : ''}
      </article>`;
    }

    let html = '';
    let pastBuffer = [];
    DATA.quickPlan.forEach((item) => {
      const dateIso = quickPlanDateIso(item);
      const relation = dayRelation(dateIso, clock.dateIso);
      const card = buildPlanCard(item);
      if (relation === 'past' && !state.showPast && inWindow) {
        pastBuffer.push(card);
      } else {
        if (pastBuffer.length) {
          html += `<details class="plan-day-past"><summary>${escapeHtml(text('livePastFolded'))}</summary>${pastBuffer.join('')}</details>`;
          pastBuffer = [];
        }
        html += card;
      }
    });
    if (pastBuffer.length) {
      html += `<details class="plan-day-past"><summary>${escapeHtml(text('livePastFolded'))}</summary>${pastBuffer.join('')}</details>`;
    }
    root.innerHTML = html;
  }

  function renderScheduleFilters() {
    const clockEl = document.getElementById('live-clock-value');
    const windowNote = document.getElementById('live-window-note');
    const modeRoot = document.getElementById('live');
    const dayRoot = document.getElementById('day-filter');
    const areaRoot = document.getElementById('live-area-filter');
    const typeRoot = document.getElementById('type-filter');
    const pastToggle = document.getElementById('live-past-toggle');
    const statusEl = document.getElementById('live-status');
    if (!modeRoot || !dayRoot || !areaRoot || !typeRoot) return;

    const clock = getClock();
    const inWindow = inCarWeekWindow(clock.dateIso);
    if (clockEl) clockEl.textContent = formatClockDisplay(clock);

    if (windowNote) {
      if (!inWindow) {
        windowNote.hidden = false;
        windowNote.textContent = text('liveOutsideWindow');
      } else {
        windowNote.hidden = true;
        windowNote.textContent = '';
      }
    }

    modeRoot.setAttribute('aria-label', state.lang === 'zh' ? '时间筛选模式' : 'Time filter mode');
    modeRoot.innerHTML = [
      { id: 'browse', label: text('liveModeBrowse') },
      { id: 'now', label: text('liveModeNow') },
      { id: 'today', label: text('liveModeToday') }
    ].map((item) => `
      <button type="button" class="filter-button" data-live-mode="${escapeHtml(item.id)}" aria-pressed="${state.liveMode === item.id}">
        ${escapeHtml(item.label)}
      </button>`).join('');

    const liveOverridesDay = state.liveMode === 'now' || state.liveMode === 'today';
    const dayButtons = [{ id: 'all', label: DATA.ui.allDays }].concat(
      DATA.days.map((day) => ({ id: day.id, label: day.short }))
    );
    dayRoot.setAttribute('aria-label', state.lang === 'zh' ? '按日期筛选' : 'Filter by day');
    dayRoot.innerHTML = dayButtons.map((item) => `
      <button type="button" class="filter-button${liveOverridesDay && item.id !== 'all' ? ' filter-button-muted' : ''}" data-day="${escapeHtml(item.id)}" aria-pressed="${state.day === item.id}"${liveOverridesDay && item.id !== 'all' ? ' aria-disabled="true"' : ''}>
        ${escapeHtml(localized(item.label))}
      </button>`).join('');
    if (liveOverridesDay) {
      let note = document.getElementById('day-filter-note');
      if (!note) {
        note = document.createElement('p');
        note.id = 'day-filter-note';
        note.className = 'filter-note';
        dayRoot.insertAdjacentElement('afterend', note);
      }
      note.textContent = text('liveDayFilterNote');
    } else {
      const note = document.getElementById('day-filter-note');
      if (note) note.remove();
    }

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

    if (pastToggle) {
      pastToggle.textContent = state.showPast ? text('livePastHide') : text('livePastShow');
      pastToggle.setAttribute('aria-pressed', state.showPast ? 'true' : 'false');
    }

    const filtered = DATA.events.filter((event) => matchesLiveFilters(event, clock));
    if (statusEl) {
      let statusText;
      if (state.liveMode === 'now') {
        statusText = filtered.length
          ? statusWithCount('liveStatusNow', filtered.length)
          : text('liveNoNow');
      } else if (state.liveMode === 'today') {
        statusText = filtered.length
          ? statusWithCount('liveStatusToday', filtered.length)
          : text('liveNoToday');
      } else {
        statusText = statusWithCount('liveStatusBrowse', filtered.length);
      }
      statusEl.textContent = statusText;
    }
    const scheduleStatus = document.getElementById('schedule-status');
    if (scheduleStatus && statusEl) scheduleStatus.textContent = statusEl.textContent;
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
    const status = document.getElementById('schedule-status');
    if (!root) return;

    const clock = getClock();
    const inWindow = inCarWeekWindow(clock.dateIso);
    const filtered = DATA.events.filter((event) => matchesLiveFilters(event, clock));

    if (status) {
      status.textContent = state.lang === 'zh'
        ? `显示 ${filtered.length} 个活动`
        : `Showing ${filtered.length} ${filtered.length === 1 ? 'event' : 'events'}`;
    }

    if (!filtered.length) {
      root.innerHTML = `<p class="empty-state">${escapeHtml(ui('noResults'))}</p>`;
      return;
    }

    function buildDayGroup(day, events) {
      const relation = dayRelation(day.id, clock.dateIso);
      const classes = ['day-group'];
      if (relation === 'past') classes.push('is-past');
      if (relation === 'today') classes.push('is-today');
      const heading = `
          <header class="day-heading" id="day-${escapeHtml(day.id)}">
            <time datetime="${escapeHtml(day.id)}">${escapeHtml(localized(day.short))}</time>
            <span>${escapeHtml(localized(day.label))}</span>
            <em>${events.length} ${escapeHtml(ui(events.length === 1 ? 'dayLabelSingular' : 'dayLabel'))}</em>
          </header>
          <div class="event-list">${events.map(renderEvent).join('')}</div>`;
      if (relation === 'past' && state.liveMode === 'browse' && !state.showPast && inWindow) {
        return `
        <details class="day-group-past">
          <summary class="day-heading day-heading-past">${escapeHtml(localized(day.short))} · ${escapeHtml(text('livePastFolded'))}</summary>
          <section class="${classes.join(' ')}" aria-labelledby="day-${escapeHtml(day.id)}">${heading}</section>
        </details>`;
      }
      return `
        <section class="${classes.join(' ')}" aria-labelledby="day-${escapeHtml(day.id)}">
          ${heading}
        </section>`;
    }

    root.innerHTML = DATA.days.map((day) => {
      const events = filtered.filter((event) => event.date === day.id);
      if (!events.length) return '';
      return buildDayGroup(day, events);
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

  function getMapPlace(placeId) {
    return DATA.mapPlaces && DATA.mapPlaces[placeId];
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
    renderTourMorning();
    renderQuickPlan();
    renderNearby();
    renderScheduleFilters();
    renderSchedule();
    renderStays();
    renderCommuteOptions();
    renderTransportTips();
    renderSources();
    ensureHubMap();
    schedulePlanMaps();
  }

  function startClockTimer() {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = window.setInterval(() => {
      renderScheduleFilters();
      if (state.liveMode === 'now' || state.liveMode === 'today') renderSchedule();
    }, 30000);
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
    const filterPanel = document.querySelector('.filter-panel');

    if (langButton) langButton.addEventListener('click', () => setLanguage(state.lang === 'zh' ? 'en' : 'zh'));
    if (themeButton) themeButton.addEventListener('click', () => setTheme(!isDark(), true));
    if (from) from.addEventListener('change', () => { state.from = from.value; renderCommuteResult(); });
    if (to) to.addEventListener('change', () => { state.to = to.value; renderCommuteResult(); });

    if (filterPanel) {
      filterPanel.addEventListener('click', (event) => {
        const dayButton = event.target.closest('[data-day]');
        if (dayButton) {
          if (dayButton.getAttribute('aria-disabled') === 'true') return;
          const nextDay = dayButton.getAttribute('data-day');
          if (nextDay && nextDay !== state.day) {
            state.day = nextDay;
            state.liveMode = 'browse';
            renderScheduleFilters();
            renderSchedule();
            dayButton.focus();
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
            typeButton.focus();
          }
          return;
        }
        const modeButton = event.target.closest('[data-live-mode]');
        if (modeButton) {
          const nextMode = modeButton.getAttribute('data-live-mode');
          if (nextMode && nextMode !== state.liveMode) {
            state.liveMode = nextMode;
            if (nextMode === 'now' || nextMode === 'today') state.day = 'all';
            renderScheduleFilters();
            renderQuickPlan();
            renderSchedule();
            schedulePlanMaps();
            modeButton.focus();
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
            areaButton.focus();
          }
          return;
        }
        if (event.target.id === 'live-past-toggle' || event.target.closest('#live-past-toggle')) {
          state.showPast = !state.showPast;
          renderScheduleFilters();
          renderQuickPlan();
          renderSchedule();
          schedulePlanMaps();
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
    startClockTimer();
  });
})();
