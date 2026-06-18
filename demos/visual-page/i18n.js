/** Data Abyss · 数渊 — default EN; click 数渊 to toggle 中文 */

let lang = 'en';

const UI = {
  pageTitle: {
    en: 'Data Abyss · 数渊 — Livability × Industrial Self-Reliance',
    zh: '数渊 · Data Abyss — 宜居 × 工业自立',
  },
  sub: {
    en: "A city's climate and a nation's industrial reach, cast as stars adrift in chaos.<br/>Each glow is drawn from real data — meant to be felt, not parsed: pulse, drift, breathe.<br/>Watch the abyss learn its own shape: the chaos folds, breath by breath, into a living neural lattice.",
    zh: '一城气候，一国自立，沉为混沌中漂流的星。<br/>光来自真实数据——不必读懂，只需明灭、漂移、呼吸。<br/>数渊在呼吸间自组织：混沌层层折叠，凝为活的神经晶格。',
  },
  tip: {
    en: 'Drag / 1-finger to orbit · scroll / pinch to focus · tap a star for its record',
    zh: '拖动 / 单指环视 · 滚轮 / 双指调焦 · 点星读档',
  },
  loading: { en: 'Igniting the abyss…', zh: '正在点亮数渊…' },
  enable: { en: 'Motion & sound', zh: '感应与声响' },
  sensorsOn: { en: 'Sensors on · voice quickens the field', zh: '感应已开 · 出声加速混沌' },
  sensorsFallback: { en: 'Granted on HTTPS devices', zh: '真机 HTTPS 下生效' },
  panelLayers: { en: 'Layers', zh: '数据层' },
  panelEffects: { en: 'Effects', zh: '效果' },
  panelCities: { en: 'Cities', zh: '城市' },
  panelProducts: { en: 'Products', zh: '产品' },
  panelKernels: { en: 'Kernels', zh: '内核' },
  panelBreakthroughs: { en: 'Breakthroughs', zh: '突破' },
  panelPolicies: { en: 'Policies', zh: '政策' },
  panelVendors: { en: 'Vendors', zh: '厂商' },
  panelBeams: { en: 'Beams', zh: '连线' },
  panelTrails: { en: 'Trails', zh: '拖尾' },
  panelLattice: { en: 'Lattice', zh: '晶格' },
};

const KIND = {
  CITY: { en: 'CITY', zh: '城市' },
  PRODUCT: { en: 'PRODUCT', zh: '产品' },
  KERNEL: { en: 'KERNEL', zh: '内核' },
  BREAKTHROUGH: { en: 'BREAKTHROUGH', zh: '突破' },
  POLICY: { en: 'POLICY', zh: '政策' },
  VENDOR: { en: 'VENDOR', zh: '厂商' },
};

const ORIGIN = {
  domestic: { en: 'Domestic', zh: '国产' },
  open_source: { en: 'Open source', zh: '开源' },
  foreign: { en: 'International', zh: '国外' },
};

export function getLang() { return lang; }
export function isZh() { return lang === 'zh'; }

export function toggleLang() {
  lang = lang === 'en' ? 'zh' : 'en';
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  applyUi();
  return lang;
}

function t(key) { return UI[key][lang]; }

export function pickName(zh, en) {
  return lang === 'zh' ? (zh || en || '') : (en || zh || '');
}

export function originLabel(o) {
  const k = o === 'domestic' ? 'domestic' : o === 'open_source' ? 'open_source' : 'foreign';
  return ORIGIN[k][lang];
}

export function pricePerSqm(unit) {
  if (lang === 'zh') return `¥${(unit / 10000).toFixed(1)}万/㎡`;
  return `¥${Math.round(unit).toLocaleString('en-US')}/m²`;
}

export function kindLabel(kind) {
  return (KIND[kind] || { en: kind, zh: kind })[lang];
}

export function formatSub(m) {
  const r = m.raw;
  if (!r) return m.sub || '';
  switch (m.kind) {
    case 'CITY': {
      const haz = r.hazard ? ` · ${r.hazard}` : '';
      if (lang === 'zh') {
        return `${r.prov} · ${r.city} · ${pricePerSqm(r.unit)} · 宜居 ${r.comfort} 天 · 海拔 ${Math.round(r.elev)} m${haz}`;
      }
      return `${r.city}, ${r.prov} · ${pricePerSqm(r.unit)} · ${r.comfort} livable days · ${Math.round(r.elev)} m${haz}`;
    }
    case 'KERNEL': {
      const used = r.used;
      if (lang === 'zh') return `${originLabel(r.origin)} · ${r.owner || ''} · ${used} 款产品使用`;
      return `${originLabel(r.origin)} · ${r.owner || ''} · used by ${used} product${used === 1 ? '' : 's'}`;
    }
    case 'PRODUCT':
      if (lang === 'zh') {
        return `${r.category || ''} · ${originLabel(r.origin)} · 成熟度 ${r.maturity || '—'} · 本地化 ${r.localization || '—'}`;
      }
      return `${r.category || ''} · ${originLabel(r.origin)} · maturity ${r.maturity || '—'} · localization ${r.localization || '—'}`;
    case 'BREAKTHROUGH': {
      const inc = r.inc;
      if (lang === 'zh') {
        return `${r.y4} · ${r.capability || '能力'}${inc ? ` · 替代 ${inc} 款在位产品` : ''}`;
      }
      return `${r.y4} · ${r.capability || 'capability'}${inc ? ` · displaced ${inc} incumbent${inc === 1 ? '' : 's'}` : ''}`;
    }
    case 'POLICY': {
      const unit = lang === 'zh' ? (r.targetUnitZh || r.targetUnitEn || '') : (r.targetUnitEn || r.targetUnitZh || '');
      const val = r.targetValue ? ` · ${r.targetValue} ${unit}`.trimEnd() : '';
      return `${r.y4} · ${r.policyType || ''}${val}`;
    }
    case 'VENDOR': {
      const hq = [r.hqCity, r.hqCountry].filter(Boolean).join(lang === 'zh' ? ' ' : ', ');
      return `${originLabel(r.origin)}${hq ? ` · ${hq}` : ''}`;
    }
    default:
      return '';
  }
}

export function metaName(m) {
  const n = pickName(m.nameZh, m.nameEn);
  if (n) return n;
  if (m.kind === 'BREAKTHROUGH') return lang === 'zh' ? '突破' : 'Breakthrough';
  return '';
}

export function renderCardHtml(m) {
  const k = kindLabel(m.kind);
  const name = metaName(m);
  const sub = formatSub(m);
  return `<div class="k">${k}</div><h3>${name}</h3><p>${sub}</p>`;
}

export function sensorBtnLabel(analyser) {
  return analyser ? t('sensorsOn') : t('sensorsFallback');
}

/** Panel label nodes — filled by buildPanel */
const panelNodes = { heads: [], rows: [] };

export function registerPanelNode(type, key, el) {
  panelNodes[type].push({ key, el });
}

export function applyUi(opts = {}) {
  const { analyser, cardMeta, cardEl } = opts;
  document.title = t('pageTitle');
  const sub = document.getElementById('sub');
  if (sub) sub.innerHTML = t('sub');
  const tipText = document.getElementById('tip-text');
  if (tipText) tipText.textContent = t('tip');
  const ld = document.getElementById('loading');
  if (ld && !ld.classList.contains('gone')) ld.textContent = t('loading');
  const btn = document.getElementById('enable');
  if (btn && !opts.skipEnable) {
    btn.textContent = analyser != null ? sensorBtnLabel(analyser) : t('enable');
  }
  for (const { key, el } of panelNodes.heads) {
    if (el && UI[key]) el.textContent = t(key);
  }
  for (const { key, el } of panelNodes.rows) {
    if (el && UI[key]) el.textContent = t(key);
  }
  if (cardMeta && cardEl && !cardEl.classList.contains('hidden')) {
    cardEl.innerHTML = renderCardHtml(cardMeta);
  }
}
