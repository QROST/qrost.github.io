/**
 * QROST homepage — EN default · toggle 中文 · dark mode
 * Persists lang → `qrost-home-lang`, theme → `qrost-home-theme`.
 */
(function () {
  const LANG_KEY = 'qrost-home-lang';
  const THEME_KEY = 'qrost-home-theme';

  const STR = {
    pageTitle: {
      en: 'QROST — research notes & interactive atlases on AEC, China & tooling',
      zh: 'QROST — AEC、中国与工具链相关的研究笔记与交互图谱',
    },
    metaDescription: {
      en: 'Personal research shelf: small-city housing livability, China industrial-software survey, global pharma atlas, WFOE setup & AEC hiring costs, plus product prototypes.',
      zh: '个人研究书架：小城市住房宜居度、中国工业软件综述、全球医药图谱、WFOE 设立与 AEC 招聘成本，以及产品原型演示。',
    },
    ogDescription: {
      en: 'Housing, industrial software, pharma atlas, WFOE & AEC cost research — plus interactive demos.',
      zh: '住房、工业软件、医药图谱、WFOE 与 AEC 成本研究，以及交互演示。',
    },
    navResearch: { en: 'Research', zh: '研究' },
    navDemos: { en: 'Demos', zh: '演示' },
    heroEyebrow: { en: 'Personal site', zh: '个人站点' },
    heroH1: { en: 'I build and write.', zh: '我做产品，也写笔记。' },
    heroLead: {
      en: 'Notes and build logs around <strong class="font-medium text-slate-800 dark:text-slate-200">AEC tooling</strong>, the <strong class="font-medium text-slate-800 dark:text-slate-200">China side of doing engineering business</strong>, and occasional interactive atlases and prototypes. A small public shelf — pick what\'s useful, ignore the rest.',
      zh: '围绕 <strong class="font-medium text-slate-800 dark:text-slate-200">AEC 工具链</strong>、<strong class="font-medium text-slate-800 dark:text-slate-200">在中国做工程业务的实务</strong>，以及交互式图谱与产品原型，整理的笔记与构建记录。公开小书架——有用的拿走，其余忽略。',
    },
    sectionResearch: { en: 'Research & notes', zh: '研究与笔记' },
    sectionDemos: { en: 'Product demos', zh: '产品演示' },
    badgeResearch: { en: 'Research · interactive', zh: '研究 · 交互' },
    badgeGenerative: { en: 'Research · generative art', zh: '研究 · 生成艺术' },
    badgePrototype: { en: 'Prototype · interactive', zh: '原型 · 交互' },
    openPage: { en: 'Open page', zh: '打开页面' },
    cardHousingTitle: {
      en: 'Where to live well — and cheap · China small-city housing',
      zh: '哪里既宜居又便宜 · 全国小城市住房数据',
    },
    cardHousingDesc: {
      en: '248 listing samples across 26 provinces (348 total; tier-1 outliers hidden by default) — price × livability on an interactive map with ERA5 climate overlays, hazard layers, rankings and a sortable table. Dark mode · EN/中文.',
      zh: '26 省 248 套挂牌样本（全库 348 套，默认隐藏一线城市高价样本）——价格 × 宜居：ERA5 气候底图、灾害层、排行榜与可排序表格。深色模式 · 中英切换。',
    },
    cardIndustrialTitle: {
      en: 'China industrial software survey',
      zh: '中国工业软件现状综述',
    },
    cardIndustrialDesc: {
      en: '325 traceable products and 43 geometry kernels across EDA, CAD, CAE/CAM, PLM, DCS/MES, ERP, BIM/GIS, slicers and IIoT — sunburst taxonomy, capability matrix, benchmark compare. Bilingual EN/中文 · last verified 2026-06.',
      zh: '325 款可追溯产品与 43 个几何内核，覆盖 EDA、CAD、CAE/CAM、PLM、DCS/MES、ERP、BIM/GIS、切片与工业互联网——旭日图品类、能力矩阵、对标比较。中英界面 · 最近核验 2026-06。',
    },
    cardPharmTitle: {
      en: 'Global pharmaceutical industry atlas',
      zh: '全球医药行业图谱',
    },
    cardPharmDesc: {
      en: '1,913 companies, 2,588 drugs and 3,036 sites across 51 countries — world map (by site / HQ country / therapeutic area), a China pharma-policy board, a deal & M&A network, corporate-group graphs, country radar and China ↔ incumbent benchmarks. Sourced records with confidence scores. Dark mode · EN/中文.',
      zh: '51 国 1,913 家企业、2,588 款药物与 3,036 处站点——世界地图（按站点/总部国家/治疗领域着色）、中国医药政策板块、交易与并购关系网、集团关系图、国家雷达图与中国 ↔ 国际对标。带来源与置信度标注。深色模式 · 中英切换。',
    },
    cardAbyssTitle: {
      en: 'Data Abyss · 数渊',
      zh: '数渊 · Data Abyss',
    },
    cardAbyssDesc: {
      en: 'A full-bleed cosmos that breathes — countless points drift, cluster and self-organize into a living lattice, and its music is read out from the field itself. Chaos · breath · drift · weave. Best in the dark; tilt or speak to it on HTTPS. Click 数渊 in-page for 中文.',
      zh: '一片会呼吸的全屏星海——无数光点漂流、聚拢，自组织为流动的晶格，乐声自星场本身涌出。沌 · 息 · 漂 · 织。暗处最佳；HTTPS 下可倾斜或出声与之相应。页内点「数渊」切换语言。',
    },
    cardWfoeTitle: {
      en: 'How to open a company in China — WFOE setup & AEC hiring costs',
      zh: '在中国开公司 — WFOE 设立与 AEC 招聘成本',
    },
    cardWfoeDesc: {
      en: 'Four entity paths (mainland WFOE, domestic LLC, Sino-foreign JV, HK/Macau SAR) plus an interactive cost dashboard across 24 China hubs with optional global city benchmarks. Data as of 2024 Q4 · last reviewed 2026-06. Bilingual EN/中文.',
      zh: '四条设立路径（大陆 WFOE、内资 LLC、中外合资、港澳 SAR）及 24 个人才枢纽的城市级成本仪表盘（可选国际城市对标）。数据时点 2024 Q4 · 最近复核 2026-06。中英双语。',
    },
    cardMakoTitle: {
      en: 'Makoauto — custom plate frame',
      zh: 'Makoauto — 定制车牌框',
    },
    cardMakoDesc: {
      en: 'Multi-page prototype for a silicone U.S. license-plate frame — 32 pin slots, draggable metal letters/emoji/flags, optional AI car preview, cart, account and admin. Light/dark theme toggle.',
      zh: '硅胶美式车牌框多页原型——32 字钉位、可拖拽金属字母/表情/旗帜、可选 AI 车辆预览、购物车、账户与管理后台。支持明暗主题切换。',
    },
    cardSheltercatsTitle: {
      en: 'Shelter Cats — a world platform for adoption',
      zh: '全球收容所猫 — 在线领养大一统平台',
    },
    cardSheltercatsDesc: {
      en: 'Real adoptable shelter cats on one world map (live from open-data shelter feeds) — filter by color, pattern, coat and distance. Every cat gets a deterministic pixel avatar and an attribute-driven personality preview, so you can imagine life with it before adopting. Dark mode · EN/中文.',
      zh: '把真实可领养的收容所猫汇到一张世界地图（数据来自开放数据收容所源）——按颜色/花纹/毛长/远近筛选。每只猫据真实属性确定性生成像素形象与性格预览，让你在领养前先想象相处。深色模式 · 中英双语。',
    },
    footerUpdated: {
      en: 'Last updated 2026-06. Nothing here is financial, legal or tax advice.',
      zh: '最后更新 2026-06。本站内容不构成财务、法律或税务建议。',
    },
    footerCopyright: { en: '© 2026 QROST. All rights reserved.', zh: '© 2026 QROST. 保留所有权利。' },
    langToggleAria: { en: 'Switch to 中文', zh: 'Switch to English' },
    themeToggleAriaDark: { en: 'Switch to dark mode', zh: '切换深色模式' },
    themeToggleAriaLight: { en: 'Switch to light mode', zh: '切换浅色模式' },
    themeToggleTitleDark: { en: 'Dark mode', zh: '深色模式' },
    themeToggleTitleLight: { en: 'Light mode', zh: '浅色模式' },
  };

  let lang = 'en';

  function t(key) {
    const bag = STR[key];
    return bag ? bag[lang] : key;
  }

  function isDark() {
    return document.documentElement.classList.contains('dark');
  }

  function applyThemeUi() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const dark = isDark();
    btn.setAttribute('aria-label', t(dark ? 'themeToggleAriaLight' : 'themeToggleAriaDark'));
    btn.setAttribute('title', t(dark ? 'themeToggleTitleLight' : 'themeToggleTitleDark'));
  }

  function apply() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = t('pageTitle');
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', t('metaDescription'));
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', t('ogDescription'));
    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute('content', t('ogDescription'));

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
    applyThemeUi();
  }

  function setLang(next) {
    lang = next === 'zh' ? 'zh' : 'en';
    try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}
    apply();
  }

  function toggleLang() { setLang(lang === 'en' ? 'zh' : 'en'); }

  function setTheme(dark) {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (_) {}
    applyThemeUi();
  }

  function toggleTheme() { setTheme(!isDark()); }

  function wireThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', toggleTheme);
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem(THEME_KEY)) setTheme(e.matches);
      });
    } catch (_) {}
  }

  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'en' || stored === 'zh') lang = stored;
  } catch (_) {}

  document.addEventListener('DOMContentLoaded', () => {
    apply();
    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) langBtn.addEventListener('click', toggleLang);
    wireThemeToggle();
  });
})();
