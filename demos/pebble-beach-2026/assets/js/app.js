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
    if (routeCard) routeCard.setAttribute('aria-label', state.lang === 'zh' ? '蒙特雷半岛活动示意图' : 'Monterey Peninsula event map');
    const mapTitle = document.getElementById('map-title');
    const mapDesc = document.getElementById('map-desc');
    if (mapTitle) mapTitle.textContent = state.lang === 'zh' ? '蒙特雷半岛活动区域' : 'Monterey Peninsula event hubs';
    if (mapDesc) mapDesc.textContent = state.lang === 'zh'
      ? '连接 Pebble Beach、Carmel、Pacific Grove、Monterey、Seaside 与 Laguna Seca 的示意路线。'
      : 'A schematic route connecting Pebble Beach, Carmel, Pacific Grove, Monterey, Seaside and Laguna Seca.';

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

  function renderQuickPlan() {
    const root = document.getElementById('quick-plan-track');
    if (!root) return;
    root.innerHTML = DATA.quickPlan.map((item) => `
      <article class="plan-day${item.flagship ? ' flagship' : ''}">
        <div class="plan-date">
          <strong>${escapeHtml(localized(item.date))}</strong>
          <span>${escapeHtml(localized(item.day))}</span>
        </div>
        <h3>${escapeHtml(localized(item.title))}</h3>
        <p>${escapeHtml(localized(item.body))}</p>
        <span class="plan-cost">${escapeHtml(localized(item.cost))}</span>
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
    root.innerHTML = DATA.stays.map((stay) => `
      <article class="stay-card${stay.recommended ? ' recommended' : ''}">
        <div class="stay-top">
          <h3>${escapeHtml(localized(stay.name))}</h3>
          ${stay.recommended ? `<span class="stay-badge">${escapeHtml(ui('bestBalance'))}</span>` : ''}
        </div>
        <div class="stay-price">${escapeHtml(stay.price)}<small>${escapeHtml(ui('perNight'))}</small></div>
        <p>${escapeHtml(localized(stay.body))}</p>
        <div class="stay-tradeoff"><span>${escapeHtml(ui('tradeoff'))}</span><strong>${escapeHtml(localized(stay.tradeoff))}</strong></div>
      </article>`).join('');
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

  function renderCommuteResult() {
    const root = document.getElementById('commute-result');
    const pair = DATA.commute[state.from] && DATA.commute[state.from][state.to];
    if (!root || !pair) return;
    root.innerHTML = `
      <div class="time-comparison">
        <div class="time-box"><span>${escapeHtml(ui('ordinary'))}</span><strong>${escapeHtml(pair[0])} ${escapeHtml(ui('minutes'))}</strong></div>
        <div class="time-box event-week"><span>${escapeHtml(ui('eventWeek'))}</span><strong>${escapeHtml(pair[1])} ${escapeHtml(ui('minutes'))}</strong></div>
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

  function renderDynamicContent() {
    renderQuickPlan();
    renderFilters();
    renderSchedule();
    renderStays();
    renderCommuteOptions();
    renderTransportTips();
    renderSources();
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
