/** Data Abyss · 数渊 — default EN; click 数渊 to toggle 中文 */

let lang = 'en';

const UI = {
  pageTitle: {
    en: 'Data Abyss · 数渊',
    zh: '数渊 · Data Abyss',
  },
  sub: {
    en: 'chaos · breath · drift · weave · mind',
    zh: '沌 · 息 · 漂 · 织 · 念',
  },
  tip: {
    en: '',
    zh: '',
  },
  tipSoundLocked: { en: 'tap anywhere to enable sound', zh: '点按屏幕任意处开启声音' },
  loading: { en: 'Igniting the abyss…', zh: '正在点亮数渊…' },
  enable: { en: 'Motion & sound', zh: '感应与声响' },
  modeMusic: { en: 'Music on · tap for mic rhythm', zh: '音乐播放 · 点按切麦克风律动' },
  modeClub: { en: 'Mic rhythm · tap for music', zh: '麦克风律动 · 点按切音乐' },
  panelLayers: { en: 'Layers', zh: '数据层' },
  panelEffects: { en: 'Effects', zh: '效果' },
  panelCities: { en: 'Cities', zh: '城市' },
  panelProducts: { en: 'Products', zh: '产品' },
  panelKernels: { en: 'Kernels', zh: '内核' },
  panelBreakthroughs: { en: 'Breakthroughs', zh: '突破' },
  panelPolicies: { en: 'Policies', zh: '政策' },
  panelVendors: { en: 'Vendors', zh: '厂商' },
  panelPharma: { en: 'Pharma', zh: '医药' },
  panelCats: { en: 'Shelter cats', zh: '收容猫' },
  panelBeams: { en: 'Beams', zh: '连线' },
  panelTrails: { en: 'Trails', zh: '拖尾' },
  panelLattice: { en: 'Lattice', zh: '晶格' },
  panelSound: { en: 'Sound', zh: '声音' },
};

const KIND = {
  CITY: { en: 'CITY', zh: '城市' },
  PRODUCT: { en: 'PRODUCT', zh: '产品' },
  KERNEL: { en: 'KERNEL', zh: '内核' },
  BREAKTHROUGH: { en: 'BREAKTHROUGH', zh: '突破' },
  POLICY: { en: 'POLICY', zh: '政策' },
  VENDOR: { en: 'VENDOR', zh: '厂商' },
  PHARMA: { en: 'PHARMA', zh: '医药' },
  CAT: { en: 'CAT', zh: '猫' },
  SHELTER: { en: 'SHELTER', zh: '收容所' },
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

export function setLang(l) {                          // 直接设定语言（不自动 applyUi，由调用方统一重渲染）
  if ((l === 'en' || l === 'zh') && lang !== l) {
    lang = l;
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  }
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

// 弹卡关键词：刻意去标签、去类型（不显示 城市/产品/小区），只留几枚裸关键词 → 艺术化、不那么易读
export function formatKeywords(m) {
  if (m.kwZh || m.kwEn) return lang === 'zh' ? (m.kwZh || m.kwEn) : (m.kwEn || m.kwZh);   // 预置关键词（医药层等）
  const r = m.raw;
  if (!r) return (m.sub || '').split(' · ').slice(1).join('  ·  ');
  const zh = lang === 'zh';
  let kw = [];
  switch (m.kind) {
    case 'CITY': kw = [r.hazard, r.comfort != null ? `${r.comfort}${zh ? '' : 'd'}` : '', r.elev != null ? `${Math.round(r.elev)}m` : '']; break;
    case 'KERNEL': kw = [originLabel(r.origin), r.used != null ? `${r.used}` : '']; break;
    case 'PRODUCT': kw = [originLabel(r.origin), r.maturity || '', r.localization || '']; break;
    case 'BREAKTHROUGH': kw = [r.y4, r.capability || '']; break;
    case 'POLICY': { const unit = zh ? (r.targetUnitZh || r.targetUnitEn || '') : (r.targetUnitEn || r.targetUnitZh || ''); kw = [r.y4, r.policyType || '', r.targetValue ? `${r.targetValue}${unit}` : '']; break; }
    case 'VENDOR': kw = [originLabel(r.origin), r.hqCity || r.hqCountry || '']; break;
    default: kw = [];
  }
  return kw.filter(Boolean).join('  ·  ');
}

export function renderCardHtml(m) {
  const name = metaName(m);
  const kw = formatKeywords(m);
  return `<h3>${name}</h3><p class="kw">${kw}</p>`;   // 仅名称 + 关键词，不显类型
}

export function sensorBtnLabel(clubMode) {
  return clubMode ? t('modeClub') : t('modeMusic');
}

/** Panel label nodes — filled by buildPanel */
const panelNodes = { heads: [], rows: [] };

export function registerPanelNode(type, key, el) {
  panelNodes[type].push({ key, el });
}

export function applyUi(opts = {}) {
  const { cardMeta, cardEl } = opts;
  document.title = t('pageTitle');
  const sub = document.getElementById('sub');
  if (sub) sub.innerHTML = t('sub');
  const tipText = document.getElementById('tip-text');
  if (tipText) tipText.textContent = t('tip');
  const ld = document.getElementById('loading');
  if (ld && !ld.classList.contains('gone')) ld.textContent = t('loading');
  const btn = document.getElementById('enable');
  if (btn && !opts.skipEnable) {
    btn.textContent = sensorBtnLabel(!!opts.clubMode);
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
