/**
 * Product compare: 2–4 slots, radar + field table.
 */
(function () {
  'use strict';

  const MAX = 4;
  const slots = [];

  const I18N = () => window.INDUSTRIAL_I18N || {};
  const t = (k) => (I18N().t ? I18N().t(k) : k);
  const isEn = () => I18N().isEn && I18N().isEn();

  function getSlots() {
    return slots.slice();
  }

  function addProduct(id) {
    if (slots.includes(id)) return false;
    if (slots.length >= MAX) return false;
    const p = window.INDUSTRIAL_CATALOG.getProductById(id);
    if (!p) return false;
    slots.push(id);
    return true;
  }

  function removeProduct(id) {
    const i = slots.indexOf(id);
    if (i >= 0) slots.splice(i, 1);
  }

  function clear() {
    slots.length = 0;
  }

  function renderSlots(container) {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < MAX; i++) {
      const div = document.createElement('div');
      div.className = 'compare-slot' + (slots[i] ? ' filled' : '');
      if (slots[i]) {
        const p = window.INDUSTRIAL_CATALOG.getProductById(slots[i]);
        const nameSpan = document.createElement('span');
        nameSpan.className = 'truncate pr-1';
        nameSpan.textContent = p ? I18N().productName(p) : slots[i];
        div.appendChild(nameSpan);

        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'ml-2 text-slate-400 hover-danger font-bold px-1 rounded hover:bg-slate-100 transition-colors no-print';
        rm.textContent = '×';
        rm.addEventListener('click', (e) => {
          e.stopPropagation();
          removeProduct(slots[i]);
          window.INDUSTRIAL_APP && window.INDUSTRIAL_APP.refreshCompare();
        });
        div.appendChild(rm);
      } else {
        div.textContent = `${i + 1}`;
        div.className += ' justify-center text-slate-300 font-medium';
      }
      container.appendChild(div);
    }
  }

  function renderTable(container, products) {
    if (!container) return;
    if (!products.length) {
      container.innerHTML = `<p class="text-sm text-slate-500">${t('compareSelect')}</p>`;
      return;
    }
    const rows = [
      { label: t('colCategory'), fn: (p) => `${p.category_l1} / ${p.category_l2}` },
      { label: t('colOrigin'), fn: (p) => I18N().originLabel(p.origin) },
      { label: t('colMaturity'), fn: (p) => I18N().maturityLabel(p.maturity) },
      { label: t('colLocDepth'), fn: (p) => I18N().locLabel(p.localization_depth) },
      { label: t('kernelLabel'), fn: (p) => {
        const CAT = window.INDUSTRIAL_CATALOG;
        return CAT && CAT.productKernelLabel ? CAT.productKernelLabel(p) : (p.kernel || '');
      } },
      { label: t('strengths'), fn: (p) => I18N().listField(p, 'strengths_zh', 'strengths_en').join('；') },
      { label: t('limitations'), fn: (p) => I18N().listField(p, 'limitations_zh', 'limitations_en').join('；') },
      { label: t('industries'), fn: (p) => (p.industries || []).join(', ') },
    ];
    let html = '<table class="w-full text-sm border-collapse"><thead><tr><th class="text-left p-2 border-b border-slate-200"></th>';
    products.forEach((p) => {
      html += `<th class="text-left p-2 border-b border-slate-200 font-medium">${I18N().productName(p)}</th>`;
    });
    html += '</tr></thead><tbody>';
    rows.forEach((row) => {
      html += `<tr><td class="p-2 border-b border-slate-100 text-slate-500">${row.label}</td>`;
      products.forEach((p) => {
        html += `<td class="p-2 border-b border-slate-100">${row.fn(p)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  function getSelectedProducts() {
    return slots.map((id) => window.INDUSTRIAL_CATALOG.getProductById(id)).filter(Boolean);
  }

  window.INDUSTRIAL_COMPARE = {
    MAX,
    getSlots,
    addProduct,
    removeProduct,
    clear,
    renderSlots,
    renderTable,
    getSelectedProducts,
  };
})();
