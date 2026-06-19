/**
 * QROST homepage — EN default · toggle 中文
 * Persists to localStorage key `qrost-home-lang`.
 */
(function () {
  const STORAGE_KEY = 'qrost-home-lang';

  const STR = {
    pageTitle: {
      en: 'QROST — research notes & build logs on AEC, China & tooling',
      zh: 'QROST — AEC、中国与工具链相关的研究与构建笔记',
    },
    metaDescription: {
      en: 'QROST is a personal shelf of research notes and build logs — China WFOE setup & AEC hiring costs, plus interactive product demos.',
      zh: 'QROST 个人公开书架：中国 WFOE 设立、AEC 招聘成本等研究笔记，以及交互式产品演示。',
    },
    navResearch: { en: 'Research', zh: '研究' },
    navDemos: { en: 'Demos', zh: '演示' },
    heroEyebrow: { en: 'Personal site', zh: '个人站点' },
    heroH1: { en: 'I build and write.', zh: '我做产品，也写笔记。' },
    heroLead: {
      en: 'Notes and build logs around <strong class="font-medium text-slate-800">AEC tooling</strong>, the <strong class="font-medium text-slate-800">China side of doing engineering business</strong>, and the occasional product prototype. A small public shelf — pick what\'s useful, ignore the rest.',
      zh: '围绕 <strong class="font-medium text-slate-800">AEC 工具链</strong>、<strong class="font-medium text-slate-800">在中国做工程业务的实务</strong>，以及偶尔的产品原型，整理的笔记与构建记录。公开小书架——有用的拿走，其余忽略。',
    },
    sectionResearch: { en: 'Research & notes', zh: '研究与笔记' },
    sectionDemos: { en: 'Product demos', zh: '产品演示' },
    badgeResearch: { en: 'Research · interactive', zh: '研究 · 交互' },
    badgeGenerative: { en: 'Research · generative art', zh: '研究 · 生成艺术' },
    badgePrototype: { en: 'Prototype · interactive', zh: '原型 · 交互' },
    openPage: { en: 'Open page', zh: '打开页面' },
    cardHousingTitle: {
      en: 'China small-city housing & rent data',
      zh: '全国小城市住房与租金数据可视化',
    },
    cardHousingDesc: {
      en: '347 cities — price, rent, yield, climate, hazards, and livability on a choropleth map with rankings and a sortable table. A data slice of China\'s small-city housing landscape.',
      zh: '347 座城市——总价、租金、收益率、气候、灾害与宜居度；中国 choropleth 地图、排行榜与可排序表格。小城市住房现象的数据切片。',
    },
    cardIndustrialTitle: {
      en: 'China industrial software survey',
      zh: '中国工业软件现状综述',
    },
    cardIndustrialDesc: {
      en: '325 products across EDA, CAD, CAE/CAM, PLM, DCS/MES, ERP, BIM/GIS and IIoT — localization breadth vs depth, sunburst taxonomy, benchmark compare. Bilingual UI.',
      zh: '325 款 EDA、CAD、CAE/CAM、PLM、DCS/MES、ERP、BIM/GIS 与 IIoT 产品——国产化广度与深度、旭日图品类、对标比较。中英界面。',
    },
    cardPharmTitle: {
      en: 'Global pharmaceutical industry atlas',
      zh: '全球医药行业图谱',
    },
    cardPharmDesc: {
      en: 'Chinese pharma in global context — companies, subsidiaries and sites on a world map, flagship drugs and pipelines, modality and therapeutic-area breakdowns, country comparison, and China-vs-incumbent breakthroughs. Bilingual UI.',
      zh: '在全球语境中看中国医药——世界地图上的企业、子公司与研发/生产站点，旗舰药物与在研管线，药物模态与治疗领域分布，国家间对比，以及中国对国际原研的突破。中英界面。',
    },
    cardAbyssTitle: {
      en: 'Data Abyss · 数渊 — Livability × Industrial Self-Reliance',
      zh: '数渊 · Data Abyss — 宜居 × 工业自立',
    },
    cardAbyssDesc: {
      en: '347 cities and 325 industrial-software records rendered as drifting stars in a Three.js WebGL field. Full-bleed on mobile; gyro and microphone optional. Click 数渊 in-page for 中文.',
      zh: '347 城与 325 条工业软件记录，化为 Three.js WebGL 场中漂流的星体。手机全屏；陀螺仪与麦克风可选。页内点「数渊」切换语言。',
    },
    cardWfoeTitle: {
      en: 'How to open a company in China — WFOE setup & AEC hiring costs',
      zh: '在中国开公司 — WFOE 设立与 AEC 招聘成本',
    },
    cardWfoeDesc: {
      en: 'Step-by-step setup workflows (mainland WFOE, domestic LLC, HK/Macau SAR) and an interactive city-level cost model for CAD roles across 24 talent hubs. Bilingual EN/中文.',
      zh: '分步设立流程（大陆 WFOE、内资 LLC、港澳 SAR）及 24 个人才枢纽的 CAD 岗位城市级成本模型。中英双语。',
    },
    cardMakoTitle: {
      en: 'Makoauto — custom plate frame',
      zh: 'Makoauto — 定制车牌框',
    },
    cardMakoDesc: {
      en: 'Multi-page prototype for designing a silicone license-plate frame: draggable metal pins, AI preview, cart, account, and admin views.',
      zh: '硅胶车牌框定制多页原型：可拖拽金属字钉、AI 预览、购物车、账户与管理后台。',
    },
    footerUpdated: {
      en: 'Last updated 2026-04. Nothing here is financial, legal or tax advice.',
      zh: '最后更新 2026-04。本站内容不构成财务、法律或税务建议。',
    },
    footerCopyright: { en: '© 2026 QROST. All rights reserved.', zh: '© 2026 QROST. 保留所有权利。' },
    langToggleAria: { en: 'Switch to 中文', zh: 'Switch to English' },
  };

  let lang = 'en';

  function t(key) {
    const bag = STR[key];
    return bag ? bag[lang] : key;
  }

  function apply() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = t('pageTitle');
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', t('metaDescription'));

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (STR[key]) el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (STR[key]) el.innerHTML = t(key);
    });

    const btn = document.getElementById('lang-toggle');
    if (btn) {
      btn.textContent = lang === 'en' ? '中' : 'EN';
      btn.setAttribute('aria-label', t('langToggleAria'));
      btn.setAttribute('title', lang === 'en' ? '中文' : 'English');
    }
  }

  function setLang(next) {
    lang = next === 'zh' ? 'zh' : 'en';
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
    apply();
  }

  function toggleLang() { setLang(lang === 'en' ? 'zh' : 'en'); }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'zh') lang = stored;
  } catch (_) {}

  document.addEventListener('DOMContentLoaded', () => {
    apply();
    const btn = document.getElementById('lang-toggle');
    if (btn) btn.addEventListener('click', toggleLang);
  });
})();
