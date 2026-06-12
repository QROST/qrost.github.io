/**
 * China Industrial Software Survey — main app.
 */
(function () {
  'use strict';

  const I18N = () => window.INDUSTRIAL_I18N || {};
  const CAT = () => window.INDUSTRIAL_CATALOG || {};
  const CHARTS = () => window.INDUSTRIAL_CHARTS || {};
  const CMP = () => window.INDUSTRIAL_COMPARE || {};

  const PRODUCT_TYPES = [
    'mcad', '2d_cad', 'dcc_mesh', 'cae_solver', 'cam', 'eda', 'plm',
    'bim', 'bim_coordination', 'reality_capture', 'gis', 'iiot_platform',
    'scada', 'mes', 'dcs', 'eam', 'erp', 'slicer', 'cim', 'mbse',
    'cad_interop', 'other',
  ];
  const TAGS = [
    'digital_twin', 'xinchuang', 'am_slicing', 'cad_interop',
    'open_source_stack', 'semiconductor', 'aerospace', 'automotive',
    'cloud_native', 'low_code', 'clash_detection', 'federated_bim',
    'point_cloud', 'model_checking', '4d_simulation', 'open_bim',
  ];

  const state = {
    filterOrigin: '',
    filterL2: '',
    filterProductType: '',
    filterTag: '',
    filterVendor: '',
    filterKernel: '',
    search: '',
    sortKey: 'name',
    sortDir: 1,
    kernelSortKey: 'name',
    kernelSortDir: 1,
  };

  let filtered = [];
  let modalProductId = null;
  let modalKernelId = null;
  let modalPolicyId = null;
  let timelineCategoryFilter = '';

  function t(k) { return I18N().t ? I18N().t(k) : k; }

  function tFmt(k, vars) {
    let s = t(k);
    if (vars) Object.keys(vars).forEach((key) => { s = s.replace(`{${key}}`, vars[key]); });
    return s;
  }

  function lockBodyScroll() { document.body.style.overflow = 'hidden'; }
  function unlockBodyScroll() {
    const productOpen = !document.getElementById('product-modal')?.classList.contains('hidden');
    const compareOpen = !document.getElementById('compare-modal')?.classList.contains('hidden');
    const kernelOpen = !document.getElementById('kernel-modal')?.classList.contains('hidden');
    const policyOpen = !document.getElementById('policy-modal')?.classList.contains('hidden');
    if (!productOpen && !compareOpen && !kernelOpen && !policyOpen) document.body.style.overflow = '';
  }

  function kernelOriginBadgeClass(o) {
    if (o === 'domestic') return 'badge-domestic';
    if (o === 'open_source') return 'badge-oss';
    return 'badge-international';
  }

  function kernelOriginLabel(o) {
    return I18N().labelForKernelField('origin', o);
  }

  function kernelLicenseLabel(m) {
    return I18N().labelForKernelField('license_model', m);
  }

  function chartL1(raw) {
    if (CHARTS().sunburstChartL1) return CHARTS().sunburstChartL1(raw);
    if (raw === '基础平台') return '生产制造';
    return raw;
  }

  function computeLiveL1Counts(products) {
    const counts = {};
    (products || []).forEach((p) => {
      const l1 = chartL1(p.category_l1);
      if (!l1) return;
      counts[l1] = (counts[l1] || 0) + 1;
    });
    return counts;
  }

  function l1BadgeClass(l1) {
    const mapped = chartL1(l1);
    if (mapped === '研发设计') return 'badge-rd';
    if (mapped === '生产制造') return 'badge-mfg';
    if (mapped === '经营管理') return 'badge-biz';
    if (mapped === '运维服务') return 'badge-plat';
    return 'badge-plat';
  }

  function originBadgeClass(o) {
    if (o === 'domestic') return 'badge-domestic';
    if (o === 'joint_venture') return 'badge-jv';
    if (o === 'open_source') return 'badge-oss';
    return 'badge-international';
  }

  function applyFilters() {
    let list = CAT().allProducts || [];
    if (state.filterOrigin) list = list.filter((p) => p.origin === state.filterOrigin);
    if (state.filterL2) list = list.filter((p) => p.category_l2 === state.filterL2 || p.category_l1 === state.filterL2);
    if (state.filterVendor) list = list.filter((p) => p.vendor_id === state.filterVendor);
    if (state.filterKernel) list = list.filter((p) => p.kernel_id === state.filterKernel);
    if (state.filterProductType) list = list.filter((p) => p.product_type === state.filterProductType);
    if (state.filterTag) list = list.filter((p) => (p.tags || []).includes(state.filterTag));
    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter((p) => {
        const v = CAT().getVendor(p.vendor_id);
        return (p.name_zh + p.name_en + p.id + (v ? v.name_zh + v.name_en : '')).toLowerCase().includes(q);
      });
    }
    const key = state.sortKey;
    list = list.slice().sort((a, b) => {
      let va, vb;
      if (key === 'name') {
        va = I18N().productName(a);
        vb = I18N().productName(b);
      } else {
        va = a[key] || '';
        vb = b[key] || '';
      }
      if (va < vb) return -1 * state.sortDir;
      if (va > vb) return 1 * state.sortDir;
      return 0;
    });
    filtered = list;
    return list;
  }

  function renderKpis(manifest, marketStats) {
    const el = (id) => document.getElementById(id);
    const prods = CAT().allProducts || [];
    const liveL1 = computeLiveL1Counts(prods);
    if (manifest) manifest.live_l1_counts = liveL1;

    if (el('kpi-market')) {
      const m = marketStats.market_size_cny_billion || {};
      el('kpi-market').textContent = m.range_high || m.value || '—';
    }
    if (el('kpi-products')) el('kpi-products').textContent = prods.length || manifest?.total_products || 0;
    const dom = prods.filter((p) => p.origin === 'domestic').length;
    const jv = prods.filter((p) => p.origin === 'joint_venture').length;
    const oss = prods.filter((p) => p.origin === 'open_source').length;
    if (el('kpi-domestic')) el('kpi-domestic').textContent = dom + jv + oss;
    const l1Keys = Object.keys(liveL1).filter((k) => liveL1[k] > 0).length;
    if (el('kpi-categories')) el('kpi-categories').textContent = l1Keys || (manifest?.categories || []).length;
    const l1Sub = el('kpi-categories')?.nextElementSibling;
    if (l1Sub && l1Keys) {
      const parts = ['研发设计', '生产制造', '经营管理', '运维服务']
        .filter((k) => liveL1[k])
        .map((k) => `${k} ${liveL1[k]}`);
      l1Sub.textContent = parts.join(' · ') || t('kpiCategoriesSub');
      l1Sub.title = parts.join(' | ');
    }
    const hc = document.getElementById('hero-product-count');
    if (hc) hc.textContent = String(prods.length || manifest?.total_products || 0);
    const built = document.getElementById('footer-built-at');
    if (built && manifest?.build_time) built.textContent = manifest.build_time;
  }

  function toggleCompare(id) {
    if (CMP().getSlots().includes(id)) {
      CMP().removeProduct(id);
    } else {
      CMP().addProduct(id);
    }
    refreshCompare();
  }

  function renderCatalogTable() {
    const tbody = document.getElementById('catalog-tbody');
    if (!tbody) return;
    const list = applyFilters();
    tbody.innerHTML = '';
    const currentCompareSlots = CMP().getSlots();
    list.forEach((p) => {
      const v = CAT().getVendor(p.vendor_id);
      const tr = document.createElement('tr');
      tr.dataset.productId = p.id;
      const inCompare = currentCompareSlots.includes(p.id);
      const compareBtnText = inCompare ? t('removeCompare') : t('addCompare');
      const compareBtnClass = inCompare ? 'compare-add-btn added' : 'compare-add-btn';

      tr.innerHTML = `
        <td class="px-3 py-2.5 border-b border-slate-100">
          <span class="font-medium text-slate-900">${I18N().productName(p)}</span>
        </td>
        <td class="px-3 py-2.5 border-b border-slate-100 text-slate-600">${I18N().vendorName(v) || p.vendor_id}</td>
        <td class="px-3 py-2.5 border-b border-slate-100">
          <span class="text-xs px-2 py-0.5 rounded ${l1BadgeClass(p.category_l1)}">${p.category_l2}</span>
        </td>
        <td class="px-3 py-2.5 border-b border-slate-100">
          <span class="badge-origin ${originBadgeClass(p.origin)}">${I18N().originLabel(p.origin)}</span>
        </td>
        <td class="px-3 py-2.5 border-b border-slate-100 text-slate-600">${I18N().maturityLabel(p.maturity)}</td>
        <td class="px-3 py-2.5 border-b border-slate-100 text-slate-600">${I18N().locLabel(p.localization_depth)}</td>
        <td class="px-3 py-2.5 border-b border-slate-100 no-print">
          <button type="button" class="text-xs ${compareBtnClass}" data-id="${p.id}">${compareBtnText}</button>
        </td>`;
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.compare-add-btn')) return;
        openModal(p.id);
      });
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.compare-add-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCompare(btn.dataset.id);
      });
    });
    const countEl = document.getElementById('catalog-count');
    if (countEl) countEl.textContent = list.length;
  }

  function evidenceBadge(level) {
    const map = {
      audited: { zh: '审计/年报', en: 'Audited', cls: 'badge-evidence-audited' },
      case_study: { zh: '案例研究', en: 'Case study', cls: 'badge-evidence-case' },
      vendor_claim: { zh: '厂商披露', en: 'Vendor claim', cls: 'badge-evidence-vendor' },
      media: { zh: '媒体报道', en: 'Media', cls: 'badge-evidence-media' },
    };
    const e = map[level] || map.media;
    return `<span class="text-xs px-2 py-0.5 rounded ${e.cls}">${I18N().isEn() ? e.en : e.zh}</span>`;
  }

  function getMilestonesForProduct(productId) {
    const data = window.__breakthroughs;
    if (!data || !productId) return [];
    return (data.milestones || []).filter((m) => (m.product_ids || []).includes(productId));
  }

  function scrollToMilestone(milestoneId) {
    const node = document.querySelector(`[data-milestone-id="${milestoneId}"]`);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node.classList.add('milestone-highlight');
      const details = node.querySelector('.timeline-node-details');
      if (details) details.open = true;
      setTimeout(() => node.classList.remove('milestone-highlight'), 2200);
    }
    document.getElementById('timeline')?.scrollIntoView({ behavior: 'smooth' });
  }

  function renderMilestoneCards(breakthroughData) {
    const el = document.getElementById('milestone-list');
    if (!el || !breakthroughData) return;
    let items = (breakthroughData.milestones || []).slice();
    if (timelineCategoryFilter) {
      items = items.filter((m) => m.category_l2 === timelineCategoryFilter);
    }
    items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const countEl = document.getElementById('milestone-count');
    if (countEl) countEl.textContent = String(items.length);

    el.innerHTML = items.map((m) => {
      const v = CAT().getVendor(m.vendor_id);
      const vendorLabel = I18N().vendorName(v) || m.vendor_id;
      const products = (m.product_ids || []).map((pid) => {
        const p = CAT().getProductById(pid);
        const name = p ? I18N().productName(p) : pid;
        return p
          ? `<button type="button" class="text-xs text-link underline milestone-product-link" data-product-id="${pid}">${name}</button>`
          : `<span class="text-xs text-slate-500">${pid}</span>`;
      }).join(' · ');
      const headline = I18N().isEn() ? m.headline_en : m.headline_zh;
      const beforeGap = I18N().isEn() ? m.before_gap_en : m.before_gap_zh;
      const achievement = I18N().isEn() ? m.achievement_en : m.achievement_zh;
      const stillMissing = I18N().isEn() ? m.still_missing_en : m.still_missing_zh;
      const metrics = (m.metrics || []).map((mt) => {
        const label = I18N().isEn() ? (mt.label_en || mt.label_zh) : mt.label_zh;
        return `<span class="metric-chip">${label}: <strong>${mt.value}</strong></span>`;
      }).join('');
      const sources = (m.sources || []).map((s, i) =>
        `<a href="${s.url}" class="text-xs text-link underline" target="_blank" rel="noopener">${s.title || `source ${i + 1}`}</a>`).join(' · ');
      return `
      <article class="timeline-node" role="listitem" data-milestone-id="${m.id}" id="milestone-${m.id}">
        <div class="timeline-marker" aria-hidden="true">
          <time class="timeline-date" datetime="${m.date}">${m.date}</time>
          <span class="timeline-dot"></span>
        </div>
        <div class="timeline-node-body">
          <header class="timeline-node-header">
            <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span class="timeline-category-badge">${m.category_l2}</span>
              <span>${vendorLabel}</span>
            </div>
            <h3 class="font-semibold text-slate-900 mt-1.5 leading-snug">${headline}</h3>
            ${products ? `<p class="text-xs text-slate-500 mt-1">${t('milestoneProducts')}: ${products}</p>` : ''}
          </header>
          <details class="timeline-node-details mt-2">
            <summary class="timeline-node-summary">${t('milestoneExpand')}</summary>
            <div class="milestone-panels mt-2 grid gap-2">
              <div class="milestone-panel milestone-panel-gap">
                <div class="milestone-panel-label">${t('milestoneBefore')}</div>
                <p class="text-sm text-slate-700">${beforeGap}</p>
              </div>
              <div class="milestone-panel milestone-panel-achieve">
                <div class="milestone-panel-label">${t('milestoneAchieve')}</div>
                <p class="text-sm text-slate-800">${achievement}</p>
                ${metrics ? `<div class="flex flex-wrap gap-2 mt-2">${metrics}</div>` : ''}
              </div>
              <div class="milestone-panel milestone-panel-still">
                <div class="milestone-panel-label">${t('milestoneStill')}</div>
                <p class="text-sm text-slate-700">${stillMissing}</p>
              </div>
            </div>
          </details>
          <footer class="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-2">
            ${evidenceBadge(m.evidence_level)}
            <span class="milestone-sources">${sources}</span>
          </footer>
        </div>
      </article>`;
    }).join('');

    el.querySelectorAll('.milestone-product-link').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(btn.dataset.productId);
      });
    });
  }

  function parsePolicyYm(ym) {
    if (!ym) return null;
    const [y, m] = ym.split('-').map(Number);
    return y * 12 + (m || 1) - 1;
  }

  function policyBarState(targetDeadline, nowMonths) {
    if (!targetDeadline) return 'ongoing';
    const end = parsePolicyYm(targetDeadline);
    if (end == null) return 'ongoing';
    if (end < nowMonths) return 'past';
    if (end - nowMonths <= 12) return 'nearing';
    return 'active';
  }

  function getPolicyById(id) {
    return (window.__policies?.policies || []).find((p) => p.id === id);
  }

  function renderPolicyModalBody(p) {
    const metric = I18N().isEn() ? p.metric_en : p.metric_zh;
    const unit = I18N().isEn() ? p.target_unit_en : p.target_unit_zh;
    const note = I18N().isEn() ? p.actual_note_en : p.actual_note_zh;
    const summary = I18N().isEn() ? p.summary_en : p.summary_zh;
    const targetStr = p.target_value != null ? `${p.target_value.toLocaleString()} ${unit || ''}` : '—';
    const actualStr = p.actual_value != null ? `${p.actual_value.toLocaleString()} ${unit || ''}` : '—';
    const deadlineLabel = p.target_deadline
      ? `${t('policyGanttDeadline')}: ${p.target_deadline}`
      : t('policyGanttOngoing');
    return `
      <div class="policy-modal-meta text-xs text-slate-500">
        <span>${t('policyGanttStart')}: <time>${p.date}</time></span>
        <span>${deadlineLabel}</span>
      </div>
      ${summary ? `<p class="text-sm text-slate-600 mt-3">${summary}</p>` : ''}
      <dl class="policy-modal-metrics text-sm grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <div><dt class="text-slate-500 text-xs">${t('policyMetric')}</dt><dd class="text-slate-800">${metric}</dd></div>
        <div><dt class="text-slate-500 text-xs">${t('policyTarget')}</dt><dd class="text-slate-800 font-medium">${targetStr}</dd></div>
        <div><dt class="text-slate-500 text-xs">${t('policyActual')} (${p.actual_as_of || '—'})</dt><dd class="text-slate-800">${actualStr}</dd></div>
      </dl>
      ${note ? `<p class="text-xs text-slate-500 mt-3">${note}</p>` : ''}
      ${p.source_url ? `<a href="${p.source_url}" class="text-xs text-link underline mt-3 inline-block" target="_blank" rel="noopener">${t('policySource')} ↗</a>` : ''}`;
  }

  function openPolicyModal(id) {
    const p = getPolicyById(id);
    if (!p) return;
    const backdrop = document.getElementById('policy-modal');
    const titleEl = document.getElementById('policy-modal-title');
    const bodyEl = document.getElementById('policy-modal-body');
    if (!backdrop || !titleEl || !bodyEl) return;
    modalPolicyId = id;
    titleEl.textContent = I18N().isEn() ? p.title_en : p.title_zh;
    bodyEl.innerHTML = renderPolicyModalBody(p);
    backdrop.classList.remove('hidden');
    backdrop.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
    document.getElementById('policy-modal-close')?.focus();
  }

  function closePolicyModal() {
    const backdrop = document.getElementById('policy-modal');
    if (!backdrop || backdrop.classList.contains('hidden')) return;
    backdrop.classList.add('hidden');
    backdrop.setAttribute('aria-hidden', 'true');
    modalPolicyId = null;
    unlockBodyScroll();
  }

  function renderPolicyNodes(policies) {
    const el = document.getElementById('policy-list');
    if (!el || !policies) return;
    const items = (policies.policies || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    if (!items.length) {
      el.innerHTML = '';
      return;
    }

    const now = new Date();
    const nowMonths = now.getFullYear() * 12 + now.getMonth();

    const monthValues = [];
    items.forEach((p) => {
      const start = parsePolicyYm(p.date);
      if (start != null) monthValues.push(start);
      const end = p.target_deadline ? parsePolicyYm(p.target_deadline) : start;
      if (end != null) monthValues.push(end);
    });
    const rangeMin = Math.min(...monthValues) - 3;
    const rangeMax = Math.max(...monthValues) + 3;
    const rangeSpan = Math.max(rangeMax - rangeMin, 1);
    const toPct = (months) => ((months - rangeMin) / rangeSpan) * 100;

    const startYear = Math.floor(rangeMin / 12);
    const endYear = Math.ceil(rangeMax / 12);
    const yearSpan = endYear - startYear;
    const tickStep = yearSpan > 30 ? 5 : yearSpan > 15 ? 3 : 2;
    const axisTicks = [];
    for (let y = startYear; y <= endYear; y += 1) {
      if (y === startYear || y === endYear || (y - startYear) % tickStep === 0) {
        axisTicks.push({ year: y, left: toPct(y * 12) });
      }
    }

    const axisHtml = axisTicks.map((tick) =>
      `<span class="policy-gantt-axis-tick" style="left:${tick.left.toFixed(2)}%">${tick.year}</span>`
    ).join('');

    const rowsHtml = items.map((p) => {
      const title = I18N().isEn() ? p.title_en : p.title_zh;
      const startMonths = parsePolicyYm(p.date);
      const endMonths = p.target_deadline ? parsePolicyYm(p.target_deadline) : null;
      const state = policyBarState(p.target_deadline, nowMonths);
      const leftPct = toPct(startMonths);
      let barHtml;
      if (endMonths != null && endMonths >= startMonths) {
        const widthPct = Math.max(toPct(endMonths) - leftPct, 0.6);
        const rangeLabel = `${p.date} → ${p.target_deadline}`;
        barHtml = `<button type="button" class="policy-gantt-bar policy-gantt-bar--${state} policy-gantt-trigger" data-policy-id="${p.id}" style="left:${leftPct.toFixed(2)}%;width:${widthPct.toFixed(2)}%" aria-label="${rangeLabel}"></button>`;
      } else {
        const rangeLabel = `${p.date} · ${t('policyGanttOngoing')}`;
        barHtml = `<button type="button" class="policy-gantt-marker policy-gantt-marker--ongoing policy-gantt-trigger" data-policy-id="${p.id}" style="left:${leftPct.toFixed(2)}%" aria-label="${rangeLabel}"><span class="policy-gantt-marker-stub" aria-hidden="true"></span></button>`;
      }
      return `
      <div class="policy-gantt-entry" role="listitem">
        <div class="policy-gantt-row">
          <button type="button" class="policy-gantt-label policy-gantt-trigger" data-policy-id="${p.id}" title="${title}">
            <span class="policy-gantt-label-text">${title}</span>
            <span class="policy-gantt-label-dates">${p.date}${p.target_deadline ? ` → ${p.target_deadline}` : ''}</span>
          </button>
          <div class="policy-gantt-track">
            <div class="policy-gantt-track-grid" aria-hidden="true"></div>
            ${barHtml}
          </div>
        </div>
      </div>`;
    }).join('');

    el.innerHTML = `
      <div class="policy-gantt-header">
        <div class="policy-gantt-label-col" aria-hidden="true"></div>
        <div class="policy-gantt-axis-col">
          <div class="policy-gantt-axis">${axisHtml}</div>
        </div>
      </div>
      <div class="policy-gantt-body">${rowsHtml}</div>`;
    el.dataset.rangeMin = `${Math.floor(rangeMin / 12)}-${String((rangeMin % 12) + 1).padStart(2, '0')}`;
    el.dataset.rangeMax = `${Math.floor(rangeMax / 12)}-${String((rangeMax % 12) + 1).padStart(2, '0')}`;

    const footEl = document.getElementById('policy-footnotes');
    if (footEl && policies.footnotes?.length) {
      footEl.innerHTML = policies.footnotes.map((f) => {
        const text = I18N().isEn() ? f.text_en : f.text_zh;
        return `<li class="text-xs text-slate-500">${f.date}: ${text} ${f.source_url ? `<a href="${f.source_url}" class="text-link underline" target="_blank" rel="noopener">↗</a>` : ''}</li>`;
      }).join('');
      footEl.closest('details')?.classList.remove('hidden');
    }
  }

  function populateTimelineCategoryFilter(breakthroughData) {
    const sel = document.getElementById('timeline-filter-category');
    if (!sel || !breakthroughData) return;
    const cats = [...new Set((breakthroughData.milestones || []).map((m) => m.category_l2))].sort();
    const prev = timelineCategoryFilter;
    sel.innerHTML = `<option value="">${t('filterAll')}</option>`;
    cats.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });
    sel.value = prev;
  }

  function renderTimeline() {
    renderMilestoneCards(window.__breakthroughs);
    renderPolicyNodes(window.__policies);
  }

  function renderModalMilestones(productId) {
    const linked = getMilestonesForProduct(productId);
    if (!linked.length) return '';
    const items = linked.map((m) => {
      const headline = I18N().isEn() ? m.headline_en : m.headline_zh;
      return `<li><button type="button" class="text-link underline text-left milestone-modal-link" data-milestone-id="${m.id}">${m.date} · ${headline}</button></li>`;
    }).join('');
    return `<h4 class="font-medium mt-3 text-slate-800">${t('milestoneLinked')}</h4>
      <ul class="list-disc pl-5 text-sm text-slate-600">${items}</ul>`;
  }

  function updateProductModalCompareBtn() {
    const btn = document.getElementById('modal-compare-add');
    if (!btn || !modalProductId) return;
    const inCompare = CMP().getSlots().includes(modalProductId);
    btn.textContent = inCompare ? t('removeCompare') : t('addCompare');
    btn.classList.toggle('text-accent', inCompare);
    btn.classList.remove('hidden');
  }

  function updateCompareFab() {
    const fab = document.getElementById('compare-fab');
    if (!fab) return;
    const n = CMP().getSlots().length;
    fab.textContent = tFmt('compareFab', { n });
    fab.title = n < 2 ? t('compareNeedTwo') : '';
    fab.classList.toggle('hidden', n === 0);
  }

  function addToCompare(id, openModalAfter) {
    if (!CMP().addProduct(id)) return false;
    refreshCompare();
    if (modalProductId === id) updateProductModalCompareBtn();
    if (openModalAfter) openCompareModal();
    return true;
  }

  function openModal(id) {
    const p = CAT().getProductById(id);
    if (!p || !(CAT().allProducts || []).length) return;
    const backdrop = document.getElementById('product-modal');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    if (!backdrop || !titleEl || !bodyEl) return;
    modalProductId = id;
    const v = CAT().getVendor(p.vendor_id);
    const strengths = I18N().listField(p, 'strengths_zh', 'strengths_en');
    const limits = I18N().listField(p, 'limitations_zh', 'limitations_en');
    const srcs = (p.sources || []).map((s) =>
      `<li><a href="${s.url}" class="text-link underline" target="_blank" rel="noopener">${s.title || s.url}</a></li>`).join('');
    const title = I18N().productName(p);
    if (!title) return;
    titleEl.textContent = title;
    bodyEl.innerHTML = `
      <p class="text-sm text-slate-500">${I18N().vendorName(v)} · ${p.category_l2} · ${I18N().originLabel(p.origin)}</p>
      <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><span class="text-slate-500">${t('colMaturity')}</span>: ${I18N().maturityLabel(p.maturity)}</div>
        <div><span class="text-slate-500">${t('colLocDepth')}</span>: ${I18N().locLabel(p.localization_depth)}</div>
        <div><span class="text-slate-500">${t('colKernel')}</span>: ${p.kernel_id
    ? `<button type="button" class="text-link underline kernel-link-btn" data-kernel-id="${p.kernel_id}">${CAT().productKernelLabel(p)}</button>`
    : (p.kernel || '—')}</div>
      </div>
      <h4 class="font-medium mt-4 text-slate-800">${t('strengths')}</h4>
      <ul class="list-disc pl-5 text-sm text-slate-600">${strengths.map((s) => `<li>${s}</li>`).join('')}</ul>
      <h4 class="font-medium mt-3 text-slate-800">${t('limitations')}</h4>
      <ul class="list-disc pl-5 text-sm text-slate-600">${limits.map((s) => `<li>${s}</li>`).join('')}</ul>
      <h4 class="font-medium mt-3 text-slate-800">${t('industries')}</h4>
      <p class="text-sm text-slate-600">${(p.industries || []).join(', ')}</p>
      <h4 class="font-medium mt-3 text-slate-800">${t('sources')}</h4>
      <ul class="list-disc pl-5 text-sm">${srcs}</ul>
      ${renderModalMilestones(id)}`;
    bodyEl.querySelectorAll('.kernel-link-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openKernelModal(btn.dataset.kernelId);
      });
    });
    updateProductModalCompareBtn();
    backdrop.classList.remove('hidden');
    backdrop.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
    history.replaceState(null, '', `#product=${id}`);
  }

  function closeModal() {
    const backdrop = document.getElementById('product-modal');
    if (backdrop) {
      backdrop.classList.add('hidden');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    modalProductId = null;
    unlockBodyScroll();
    if (location.hash.startsWith('#product=')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function openCompareModal() {
    const backdrop = document.getElementById('compare-modal');
    if (!backdrop) return;
    if (!document.getElementById('product-modal')?.classList.contains('hidden')) closeModal();
    refreshCompare();
    backdrop.classList.remove('hidden');
    backdrop.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
    setTimeout(() => {
      CHARTS().resizeCompareRadar();
      const prods = CMP().getSelectedProducts();
      if (prods.length) {
        CHARTS().renderCompareRadar(document.getElementById('compare-radar-chart'), prods);
        CHARTS().resizeCompareRadar();
      }
    }, 80);
  }

  function closeCompareModal() {
    const backdrop = document.getElementById('compare-modal');
    if (!backdrop || backdrop.classList.contains('hidden')) return;
    backdrop.classList.add('hidden');
    backdrop.setAttribute('aria-hidden', 'true');
    unlockBodyScroll();
  }

  function applyKernelFilters() {
    let list = CAT().allKernels || [];
    const key = state.kernelSortKey;
    list = list.slice().sort((a, b) => {
      let va; let vb;
      if (key === 'name') {
        va = CAT().kernelDisplayName(a);
        vb = CAT().kernelDisplayName(b);
      } else if (key === 'domestic_count') {
        va = CAT().countDomesticProductsForKernel(a.id);
        vb = CAT().countDomesticProductsForKernel(b.id);
      } else {
        va = a[key] || '';
        vb = b[key] || '';
      }
      if (va < vb) return -1 * state.kernelSortDir;
      if (va > vb) return 1 * state.kernelSortDir;
      return 0;
    });
    return list;
  }

  function renderKernelsTable() {
    const tbody = document.getElementById('kernels-tbody');
    if (!tbody) return;
    const list = applyKernelFilters();
    tbody.innerHTML = '';
    list.forEach((k) => {
      const domCount = CAT().countDomesticProductsForKernel(k.id);
      const sub = I18N().isEn() ? k.substitution_status_en : k.substitution_status_zh;
      const tr = document.createElement('tr');
      tr.dataset.kernelId = k.id;
      tr.innerHTML = `
        <td class="px-3 py-2.5 border-b border-slate-100 font-medium text-slate-900">${CAT().kernelDisplayName(k)}</td>
        <td class="px-3 py-2.5 border-b border-slate-100 text-slate-600">${k.owner}</td>
        <td class="px-3 py-2.5 border-b border-slate-100">
          <span class="badge-origin ${kernelOriginBadgeClass(k.origin)}">${kernelOriginLabel(k.origin)}</span>
        </td>
        <td class="px-3 py-2.5 border-b border-slate-100 text-slate-600 text-center">${domCount}</td>
        <td class="px-3 py-2.5 border-b border-slate-100 text-slate-600 text-sm">${sub}</td>
        <td class="px-3 py-2.5 border-b border-slate-100 no-print">
          <button type="button" class="text-xs text-link catalog-filter-kernel-btn" data-id="${k.id}">${t('filterByKernel')}</button>
        </td>`;
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.catalog-filter-kernel-btn')) return;
        openKernelModal(k.id);
      });
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.catalog-filter-kernel-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.filterKernel = btn.dataset.id;
        state.filterVendor = '';
        syncFilterUI();
        renderCatalogTable();
        document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
      });
    });
    const countEl = document.getElementById('kernels-count');
    if (countEl) countEl.textContent = list.length;
  }

  function openKernelModal(id) {
    const k = CAT().getKernel(id);
    if (!k) return;
    const backdrop = document.getElementById('kernel-modal');
    const titleEl = document.getElementById('kernel-modal-title');
    const bodyEl = document.getElementById('kernel-modal-body');
    if (!backdrop || !titleEl || !bodyEl) return;
    modalKernelId = id;
    const caps = I18N().listField(k, 'capabilities_zh', 'capabilities_en');
    const strengths = I18N().listField(k, 'strengths_zh', 'strengths_en');
    const limits = I18N().listField(k, 'limitations_zh', 'limitations_en');
    const srcs = (k.sources || []).map((s) =>
      `<li><a href="${s.url}" class="text-link underline" target="_blank" rel="noopener">${s.title || s.url}</a></li>`).join('');
    const catalogProds = CAT().getProductsByKernel(id);
    const prodLinks = catalogProds.map((p) =>
      `<button type="button" class="text-link underline product-link-btn mr-2" data-product-id="${p.id}">${I18N().productName(p)}</button>`).join('') || '—';
    const intl = (k.used_by_international || []).join(', ') || '—';
    const cn = (k.chinese_products_using || []).join(', ') || '—';
    const alts = (k.domestic_alternatives || []).map((aid) => {
      const ak = CAT().getKernel(aid);
      return ak ? CAT().kernelDisplayName(ak) : aid;
    }).join(', ') || '—';
    titleEl.textContent = CAT().kernelDisplayName(k);
    bodyEl.innerHTML = `
      <p class="text-sm text-slate-500">${k.owner} · ${kernelOriginLabel(k.origin)} · ${kernelLicenseLabel(k.license_model)}${k.first_release_year ? ` · ${k.first_release_year}` : ''}</p>
      <p class="mt-3 text-sm text-slate-700"><span class="text-slate-500">${t('kernelSubstitution')}</span>: ${I18N().isEn() ? k.substitution_status_en : k.substitution_status_zh}</p>
      <h4 class="font-medium mt-4 text-slate-800">${t('kernelCapabilities')}</h4>
      <ul class="list-disc pl-5 text-sm text-slate-600">${caps.map((s) => `<li>${s}</li>`).join('')}</ul>
      <h4 class="font-medium mt-3 text-slate-800">${t('strengths')}</h4>
      <ul class="list-disc pl-5 text-sm text-slate-600">${strengths.map((s) => `<li>${s}</li>`).join('')}</ul>
      <h4 class="font-medium mt-3 text-slate-800">${t('limitations')}</h4>
      <ul class="list-disc pl-5 text-sm text-slate-600">${limits.map((s) => `<li>${s}</li>`).join('')}</ul>
      <h4 class="font-medium mt-3 text-slate-800">${t('kernelCatalogProducts')}</h4>
      <p class="text-sm">${prodLinks}</p>
      <h4 class="font-medium mt-3 text-slate-800">${t('kernelIntlProducts')}</h4>
      <p class="text-sm text-slate-600">${intl}</p>
      <h4 class="font-medium mt-3 text-slate-800">${t('kernelChineseAdoption')}</h4>
      <p class="text-sm text-slate-600">${cn}</p>
      <h4 class="font-medium mt-3 text-slate-800">${t('kernelDomesticAlts')}</h4>
      <p class="text-sm text-slate-600">${alts}</p>
      <h4 class="font-medium mt-3 text-slate-800">${t('sources')}</h4>
      <ul class="list-disc pl-5 text-sm">${srcs}</ul>`;
    bodyEl.querySelectorAll('.product-link-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        closeKernelModal();
        openModal(btn.dataset.productId);
      });
    });
    backdrop.classList.remove('hidden');
    backdrop.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
    history.replaceState(null, '', `#kernel=${id}`);
  }

  function closeKernelModal() {
    const backdrop = document.getElementById('kernel-modal');
    if (backdrop) {
      backdrop.classList.add('hidden');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    modalKernelId = null;
    unlockBodyScroll();
    if (location.hash.startsWith('#kernel=')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function syncFilterUI() {
    const oSel = document.getElementById('filter-origin');
    const cSel = document.getElementById('filter-category');
    const ptSel = document.getElementById('filter-product-type');
    const tagSel = document.getElementById('filter-tag');
    const kSel = document.getElementById('filter-kernel');
    if (oSel) oSel.value = state.filterOrigin;
    if (cSel) cSel.value = state.filterL2;
    if (ptSel) ptSel.value = state.filterProductType;
    if (tagSel) tagSel.value = state.filterTag;
    if (kSel) kSel.value = state.filterKernel;
    const search = document.getElementById('catalog-search');
    if (search) search.value = state.search;
  }

  function ensureTaxonomyFilterSelects() {
    const row = document.querySelector('#catalog .flex.flex-wrap');
    if (!row || document.getElementById('filter-product-type')) return;

    const ptSel = document.createElement('select');
    ptSel.id = 'filter-product-type';
    ptSel.className = 'text-sm border border-slate-200 rounded px-3 py-2 bg-white';
    ptSel.setAttribute('aria-label', t('filterProductType'));

    const tagSel = document.createElement('select');
    tagSel.id = 'filter-tag';
    tagSel.className = 'text-sm border border-slate-200 rounded px-3 py-2 bg-white';
    tagSel.setAttribute('aria-label', t('filterTag'));

    const catSel = document.getElementById('filter-category');
    if (catSel) {
      catSel.insertAdjacentElement('afterend', tagSel);
      catSel.insertAdjacentElement('afterend', ptSel);
    } else {
      row.appendChild(ptSel);
      row.appendChild(tagSel);
    }

    ptSel.addEventListener('change', (e) => {
      state.filterProductType = e.target.value;
      renderCatalogTable();
    });
    tagSel.addEventListener('change', (e) => {
      state.filterTag = e.target.value;
      renderCatalogTable();
    });
  }

  function populateTaxonomyFilters() {
    ensureTaxonomyFilterSelects();
    const prods = CAT().allProducts || [];
    const ptSel = document.getElementById('filter-product-type');
    const tagSel = document.getElementById('filter-tag');
    if (!ptSel || !tagSel) return;

    const usedTypes = new Set(prods.map((p) => p.product_type).filter(Boolean));
    const usedTags = new Set(prods.flatMap((p) => p.tags || []));

    ptSel.innerHTML = `<option value="">${t('filterAll')}</option>`;
    PRODUCT_TYPES.filter((pt) => usedTypes.has(pt)).forEach((pt) => {
      const opt = document.createElement('option');
      opt.value = pt;
      opt.textContent = (I18N().productTypeLabel && I18N().productTypeLabel(pt)) || pt;
      ptSel.appendChild(opt);
    });
    ptSel.disabled = ptSel.options.length <= 1;
    ptSel.classList.toggle('hidden', ptSel.options.length <= 1);

    tagSel.innerHTML = `<option value="">${t('filterAll')}</option>`;
    TAGS.filter((tag) => usedTags.has(tag)).forEach((tag) => {
      const opt = document.createElement('option');
      opt.value = tag;
      opt.textContent = (I18N().tagLabel && I18N().tagLabel(tag)) || tag;
      tagSel.appendChild(opt);
    });
    tagSel.disabled = tagSel.options.length <= 1;
    tagSel.classList.toggle('hidden', tagSel.options.length <= 1);

    syncFilterUI();
  }

  function populateKernelFilter() {
    const sel = document.getElementById('filter-kernel');
    if (!sel) return;
    sel.innerHTML = `<option value="">${t('filterAll')}</option>`;
    (CAT().allKernels || []).slice().sort((a, b) =>
      CAT().kernelDisplayName(a).localeCompare(CAT().kernelDisplayName(b))).forEach((k) => {
      const opt = document.createElement('option');
      opt.value = k.id;
      opt.textContent = CAT().kernelDisplayName(k);
      sel.appendChild(opt);
    });
  }

  function populateCategoryFilter() {
    const sel = document.getElementById('filter-category');
    if (!sel) return;
    const l2s = new Set((CAT().allProducts || []).map((p) => p.category_l2));
    sel.innerHTML = `<option value="">${t('filterAll')}</option>`;
    [...l2s].sort().forEach((l2) => {
      const opt = document.createElement('option');
      opt.value = l2;
      opt.textContent = l2;
      sel.appendChild(opt);
    });
  }

  function sunburstChartOpts() {
    return {
      activeFilter: state.filterL2,
      onSectorClick: (name) => applySunburstCategoryFilter(name),
      onReset: () => clearSunburstCategoryFilter(),
    };
  }

  function renderSunburstChart() {
    const el = document.getElementById('taxonomy-sunburst');
    const manifest = CAT().manifest;
    if (!el || !manifest) return;
    CHARTS().renderSunburst(el, manifest, sunburstChartOpts());
  }

  function clearSunburstCategoryFilter() {
    state.filterL2 = '';
    syncFilterUI();
    renderCatalogTable();
    renderSunburstChart();
  }

  function applySunburstCategoryFilter(name) {
    state.filterL2 = name;
    state.filterVendor = '';
    syncFilterUI();
    renderCatalogTable();
    CHARTS().setSunburstHighlight(name);
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
  }

  function refreshCompare() {
    CMP().renderSlots(document.getElementById('compare-slots'));
    const prods = CMP().getSelectedProducts();
    CMP().renderTable(document.getElementById('compare-table'), prods);
    const radarEl = document.getElementById('compare-radar-chart');
    const compareOpen = !document.getElementById('compare-modal')?.classList.contains('hidden');
    if (compareOpen && radarEl) {
      CHARTS().renderCompareRadar(radarEl, prods);
    }
    updateCompareFab();
    if (modalProductId) updateProductModalCompareBtn();
    renderCatalogTable();
  }

  function updateVisuals() {
    const manifest = CAT().manifest;
    const marketStats = CAT().marketStats || window.__marketStats;
    renderKpis(manifest, marketStats || {});
    if (window.__breakthroughs) {
      populateTimelineCategoryFilter(window.__breakthroughs);
      renderTimeline();
    }
    renderSunburstChart();
    renderKernelsTable();
    refreshCompare();
    if (modalPolicyId) openPolicyModal(modalPolicyId);
  }

  function handleHash() {
    const pm = location.hash.match(/^#product=([a-z0-9-]+)$/);
    if (pm) { openModal(pm[1]); return; }
    const km = location.hash.match(/^#kernel=([a-z0-9-]+)$/);
    if (km) openKernelModal(km[1]);
  }

  function bindEvents() {
    document.getElementById('modal-close')?.addEventListener('click', closeModal);
    document.getElementById('kernel-modal-close')?.addEventListener('click', closeKernelModal);
    document.getElementById('policy-modal-close')?.addEventListener('click', closePolicyModal);
    document.getElementById('product-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'product-modal') closeModal();
    });
    document.getElementById('kernel-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'kernel-modal') closeKernelModal();
    });
    document.getElementById('policy-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'policy-modal') closePolicyModal();
    });
    document.getElementById('policy-list')?.addEventListener('click', (e) => {
      const trigger = e.target.closest('.policy-gantt-trigger');
      if (!trigger?.dataset.policyId) return;
      openPolicyModal(trigger.dataset.policyId);
    });
    document.getElementById('modal-compare-add')?.addEventListener('click', () => {
      if (!modalProductId) return;
      const slots = CMP().getSlots();
      if (slots.includes(modalProductId)) {
        CMP().removeProduct(modalProductId);
        refreshCompare();
      } else {
        addToCompare(modalProductId);
      }
    });
    document.getElementById('compare-modal-close')?.addEventListener('click', closeCompareModal);
    document.getElementById('compare-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'compare-modal') closeCompareModal();
    });
    ['nav-compare-btn', 'nav-compare-btn-mobile', 'catalog-compare-btn', 'compare-fab'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', () => openCompareModal());
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      closeCompareModal();
      closePolicyModal();
      closeKernelModal();
      closeModal();
    });
    document.getElementById('filter-origin')?.addEventListener('change', (e) => {
      state.filterOrigin = e.target.value;
      renderCatalogTable();
    });
    document.getElementById('filter-category')?.addEventListener('change', (e) => {
      state.filterL2 = e.target.value;
      renderCatalogTable();
      if (state.filterL2) {
        CHARTS().setSunburstHighlight(state.filterL2);
      } else {
        renderSunburstChart();
      }
    });
    document.getElementById('taxonomy')?.addEventListener('click', (e) => {
      if (e.target.closest('#sunburst-reset')) {
        e.preventDefault();
        clearSunburstCategoryFilter();
      }
    });
    document.getElementById('filter-kernel')?.addEventListener('change', (e) => {
      state.filterKernel = e.target.value;
      renderCatalogTable();
    });
    document.querySelectorAll('.kernels-table th[data-kernel-sort]').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.kernelSort;
        if (state.kernelSortKey === key) state.kernelSortDir *= -1;
        else { state.kernelSortKey = key; state.kernelSortDir = 1; }
        renderKernelsTable();
      });
    });
    document.getElementById('catalog-search')?.addEventListener('input', (e) => {
      state.search = e.target.value;
      renderCatalogTable();
    });
    document.querySelectorAll('.catalog-table th[data-sort]').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (state.sortKey === key) state.sortDir *= -1;
        else { state.sortKey = key; state.sortDir = 1; }
        renderCatalogTable();
      });
    });
    document.getElementById('timeline-filter-category')?.addEventListener('change', (e) => {
      timelineCategoryFilter = e.target.value;
      renderMilestoneCards(window.__breakthroughs);
    });
    document.getElementById('product-modal')?.addEventListener('click', (e) => {
      const link = e.target.closest('.milestone-modal-link');
      if (!link) return;
      e.preventDefault();
      closeModal();
      scrollToMilestone(link.dataset.milestoneId);
    });
    document.getElementById('compare-clear')?.addEventListener('click', () => {
      CMP().clear();
      refreshCompare();
    });
    document.getElementById('compare-search')?.addEventListener('change', (e) => {
      if (e.target.value) {
        CMP().addProduct(e.target.value);
        e.target.value = '';
        refreshCompare();
      }
    });
    window.addEventListener('hashchange', handleHash);
    const menuToggle = document.getElementById('nav-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    if (menuToggle && mobileMenu) {
      menuToggle.addEventListener('click', () => {
        const open = mobileMenu.classList.toggle('hidden');
        menuToggle.setAttribute('aria-expanded', String(!open));
      });
      mobileMenu.querySelectorAll('[data-mobile-nav-link]').forEach((a) => {
        a.addEventListener('click', () => mobileMenu.classList.add('hidden'));
      });
    }
  }

  function populateCompareSelect() {
    const sel = document.getElementById('compare-search');
    if (!sel) return;
    sel.innerHTML = `<option value="">${t('compareSelect')}</option>`;
    (CAT().allProducts || []).forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = I18N().productName(p);
      sel.appendChild(opt);
    });
  }

  async function init() {
    await CHARTS().loadEcharts();
    await CAT().initCore();
    window.__marketStats = await CAT().loadMarketStats();
    window.__policies = await CAT().loadPolicies();
    window.__breakthroughs = await CAT().loadBreakthroughs();
    populateCategoryFilter();
    populateTaxonomyFilters();
    populateKernelFilter();
    populateCompareSelect();
    bindEvents();
    I18N().onChange(() => {
      populateCompareSelect();
      populateKernelFilter();
      populateTaxonomyFilters();
      updateVisuals();
    });
    updateVisuals();
    handleHash();

    window.__industrialSoftwareTest = {
      getProductCount: () => (CAT().allProducts || []).length,
      getFilteredCount: () => filtered.length,
      getManifest: () => CAT().manifest,
      getCompareSlots: () => CMP().getSlots(),
      addCompare: (id) => { addToCompare(id); },
      openCompareModal,
      closeCompareModal,
      isCompareModalOpen: () => !document.getElementById('compare-modal')?.classList.contains('hidden'),
      getState: () => Object.assign({}, state),
    };
  }

  window.INDUSTRIAL_APP = {
    init, refreshCompare, updateVisuals, openModal, closeModal, openKernelModal, closeKernelModal,
    openPolicyModal, closePolicyModal, openCompareModal, closeCompareModal, addToCompare,
  };

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((err) => {
      console.error('Industrial software app init failed:', err);
      const note = document.getElementById('init-error');
      if (note) {
        note.textContent = 'Data load failed — use a local HTTP server (not file://).';
        note.classList.remove('hidden');
      }
    });
  });
})();
