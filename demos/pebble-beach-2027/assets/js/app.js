'use strict';

(function () {
  const DATA = window.PEBBLE_2027_DATA;
  if (!DATA) return;

  const LANG_KEY = 'qrost-pebble-guide-lang';
  const THEME_KEY = 'qrost-pebble-guide-theme';
  const state = {
    lang: (readStored(LANG_KEY) || readStored('qrost-pebble-2026-lang')) === 'en' ? 'en' : 'zh',
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  };

  function readStored(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function writeStored(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  function pick(value) {
    return value && typeof value === 'object' ? (value[state.lang] || value.zh || value.en || '') : String(value || '');
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function sourceById(id) {
    return DATA.sources.find((source) => source.id === id);
  }

  function setMeta(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.setAttribute('content', value);
  }

  function moduleSourceLinks(module) {
    const eventSourceIds = module.id === 'calendar'
      ? DATA.confirmedEvents.flatMap((event) => event.sourceIds || [])
      : [];
    const ids = [...new Set([...(module.sourceIds || []), ...eventSourceIds])];
    return ids.map((id) => sourceById(id)).filter(Boolean).map((source) => (
      `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pick(source.label))} ↗</a>`
    )).join('');
  }

  function statusLabel(status) {
    const key = status === 'confirmed' ? 'confirmedBadge' : status === 'partial' ? 'partialBadge' : 'pendingBadge';
    return pick(DATA.labels[key]);
  }

  function renderConfirmedEvents(module) {
    if (module.id !== 'calendar') return '';
    return `
      <div class="confirmed-event-block">
        <h3>${escapeHtml(pick(DATA.labels.moduleDates))}</h3>
        <ol class="confirmed-event-list">
          ${DATA.confirmedEvents.map((event) => `
            <li>
              <div class="confirmed-event-heading">
                <span>${escapeHtml(pick(event.title))}</span>
                <time datetime="${escapeHtml(event.startDate)}">${escapeHtml(pick(event.dateLabel))}</time>
              </div>
              ${event.details ? `<p>${escapeHtml(pick(event.details))}</p>` : ''}
              ${(() => {
                const source = sourceById(event.sourceIds[event.sourceIds.length - 1]);
                return source ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pick(source.label))} ↗</a>` : '';
              })()}
            </li>
          `).join('')}
        </ol>
      </div>
    `;
  }

  function renderFacts(module) {
    if (!module.facts.length) return '';
    return `
      <div class="module-fact-block">
        <h3>${escapeHtml(pick(DATA.labels.moduleKnown))}</h3>
        <ul class="module-facts">${module.facts.map((fact) => `<li>${escapeHtml(pick(fact.text))}</li>`).join('')}</ul>
      </div>
    `;
  }

  function renderModules() {
    const root = document.getElementById('module-grid');
    if (!root) return;
    const openIds = new Set(
      Array.from(root.querySelectorAll('details[open][data-module-id]')).map((item) => item.dataset.moduleId)
    );
    root.innerHTML = DATA.modules.map((module) => `
      <details class="module-card" data-module-id="${escapeHtml(module.id)}" id="module-${escapeHtml(module.id)}"${openIds.has(module.id) ? ' open' : ''}>
        <summary>
          <span class="module-index" aria-hidden="true">${escapeHtml(module.icon)}</span>
          <span class="module-summary-copy">
            <span class="module-summary-top">
              <strong>${escapeHtml(pick(module.title))}</strong>
              <span class="pending-badge status-${escapeHtml(module.status)}">${escapeHtml(statusLabel(module.status))}</span>
            </span>
            <span class="module-short">${escapeHtml(pick(module.summary))}</span>
            <span class="module-expand">${escapeHtml(pick(DATA.labels.moduleExpand))}</span>
          </span>
        </summary>
        <div class="module-detail">
          ${renderConfirmedEvents(module)}
          ${renderFacts(module)}
          <h3>${escapeHtml(pick(DATA.labels.moduleNeeds))}</h3>
          <ul class="module-needs">${module.needs.map((item) => `<li>${escapeHtml(pick(item))}</li>`).join('')}</ul>
          <div class="module-source-block">
            <strong>${escapeHtml(pick(DATA.labels.moduleSources))}</strong>
            <div>${moduleSourceLinks(module)}</div>
            <small>${escapeHtml(pick(DATA.labels.checkedLabel))}: ${escapeHtml(DATA.factsCheckedOn)}</small>
          </div>
        </div>
      </details>
    `).join('');
  }

  function renderFramework() {
    const reusable = document.getElementById('framework-reusable');
    const reset = document.getElementById('framework-reset');
    if (reusable) reusable.innerHTML = DATA.framework.reusable.map((item) => `<li>${escapeHtml(pick(item))}</li>`).join('');
    if (reset) reset.innerHTML = DATA.framework.reset.map((item) => `<li>${escapeHtml(pick(item))}</li>`).join('');
  }

  function renderSources() {
    const root = document.getElementById('source-watchlist');
    if (!root) return;
    root.innerHTML = DATA.sources.filter((source) => source.watchlist !== false).map((source) => `
      <li>
        <div>
          <span>${escapeHtml(pick(source.label))}</span>
          <small class="source-role role-${escapeHtml(source.role)}">${escapeHtml(pick(DATA.labels[source.role === 'evidence' ? 'sourceEvidence' : 'sourceWatchpoint']))}</small>
        </div>
        <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pick(DATA.labels.sourceOpen))}</a>
      </li>
    `).join('');
  }

  function applyLanguage() {
    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
    document.title = pick(DATA.meta.title);
    setMeta('meta[name="description"]', pick(DATA.meta.description));
    setMeta('meta[property="og:title"]', pick(DATA.meta.title));
    setMeta('meta[property="og:description"]', pick(DATA.meta.description));
    setMeta('meta[property="og:image:alt"]', pick(DATA.meta.imageAlt));
    setMeta('meta[name="twitter:title"]', pick(DATA.meta.title));
    setMeta('meta[name="twitter:description"]', pick(DATA.meta.description));

    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const value = DATA.labels[node.dataset.i18n];
      if (value) node.textContent = pick(value);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((node) => {
      const value = DATA.labels[node.dataset.i18nAria];
      if (value) node.setAttribute('aria-label', pick(value));
    });

    const langButton = document.getElementById('lang-toggle');
    if (langButton) {
      langButton.textContent = state.lang === 'zh' ? 'EN' : '中';
      langButton.setAttribute('aria-label', pick(DATA.labels.langToggle));
      langButton.title = pick(DATA.labels.langToggle);
    }
    const home = document.querySelector('.wordmark');
    if (home) home.setAttribute('aria-label', pick(DATA.labels.home));
    const backTop = document.getElementById('back-to-top');
    if (backTop) {
      backTop.setAttribute('aria-label', pick(DATA.labels.navBackTop));
      backTop.title = pick(DATA.labels.navBackTop);
    }

    renderModules();
    renderFramework();
    renderSources();
    updateThemeButton();
    updateNavButton();
  }

  function updateThemeButton() {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    const label = state.theme === 'dark' ? pick(DATA.labels.themeLight) : pick(DATA.labels.themeDark);
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  function setTheme(theme) {
    state.theme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
    writeStored(THEME_KEY, state.theme);
    updateThemeButton();
  }

  function navElements() {
    return {
      toggle: document.getElementById('section-nav-toggle'),
      links: document.getElementById('primary-nav-links')
    };
  }

  function updateNavButton() {
    const { toggle, links } = navElements();
    if (!toggle || !links) return;
    const expanded = links.classList.contains('is-open');
    const label = expanded ? pick(DATA.labels.navMenuClose) : pick(DATA.labels.navMenuOpen);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
  }

  function closeSectionNav({ returnFocus = false } = {}) {
    const { toggle, links } = navElements();
    if (!toggle || !links) return;
    links.classList.remove('is-open');
    updateNavButton();
    if (returnFocus) toggle.focus();
  }

  function revealHashTarget(hash, focus = false) {
    if (!hash || hash === '#') return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!target) return;
    if (target.tagName === 'DETAILS') target.open = true;
    let parent = target.parentElement;
    while (parent) {
      if (parent.tagName === 'DETAILS') parent.open = true;
      parent = parent.parentElement;
    }
    if (focus) {
      const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
      target.setAttribute('tabindex', '-1');
      requestAnimationFrame(() => target.focus({ preventScroll: true }));
    }
  }

  function setupNavigation() {
    const { toggle, links } = navElements();
    if (!toggle || !links) return;
    document.documentElement.classList.add('nav-ready');
    toggle.addEventListener('click', () => {
      const nextOpen = !links.classList.contains('is-open');
      links.classList.toggle('is-open', nextOpen);
      updateNavButton();
      if (nextOpen) requestAnimationFrame(() => links.querySelector('a')?.focus());
    });
    links.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', () => {
        const hash = link.getAttribute('href');
        closeSectionNav();
        revealHashTarget(hash, true);
      });
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && links.classList.contains('is-open')) closeSectionNav({ returnFocus: true });
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 760) closeSectionNav();
    });
  }

  function init() {
    document.getElementById('lang-toggle')?.addEventListener('click', () => {
      state.lang = state.lang === 'zh' ? 'en' : 'zh';
      writeStored(LANG_KEY, state.lang);
      applyLanguage();
    });
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      setTheme(state.theme === 'dark' ? 'light' : 'dark');
    });
    setupNavigation();
    applyLanguage();
    revealHashTarget(window.location.hash, Boolean(window.location.hash));
    window.addEventListener('hashchange', () => revealHashTarget(window.location.hash, true));
  }

  init();
})();
