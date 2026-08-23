/**
 * QROST homepage — EN default · toggle 中文 · dark mode
 * Persists lang → `qrost-home-lang`, theme → `qrost-home-theme`.
 */
(function () {
  const LANG_KEY = 'qrost-home-lang';
  const THEME_KEY = 'qrost-home-theme';

  const STR = {
    pageTitle: {
      en: 'QROST — research notes & interactive data atlases',
      zh: 'QROST — 研究笔记与交互式数据图谱',
    },
    metaDescription: {
      en: 'QROST is a public lab for interactive research, data atlases, generative art, and product prototypes. Bilingual EN/中文.',
      zh: 'QROST 是一个公开实验室，收录交互研究、数据图谱、生成艺术与产品原型。中英双语。',
    },
    ogDescription: {
      en: 'A public lab for interactive research, data atlases, generative art, and product prototypes. Bilingual EN/中文.',
      zh: '一个收录交互研究、数据图谱、生成艺术与产品原型的公开实验室。中英双语。',
    },
    navResearch: { en: 'Research', zh: '研究' },
    navDemos: { en: 'Demos', zh: '演示' },
    heroEyebrow: { en: 'QROST Public Lab', zh: 'QROST 公开实验室' },
    heroH1: { en: 'I build and write.', zh: '我在实践中记录。' },
    heroLead: {
      en: 'Notes and build logs — a few <strong class="font-medium text-slate-800 dark:text-slate-200">interactive data atlases</strong>: a global view seen through Chinese eyes, plus occasional product prototypes. A small public shelf — take what\'s useful.',
      zh: '几份 <strong class="font-medium text-slate-800 dark:text-slate-200">交互式数据图谱</strong>，一个中国人的全球视角，也有一些动手做的产品原型。随手记下来、摆在这里，有用就拿走。',
    },
    sectionResearch: { en: 'Research & notes', zh: '研究与笔记' },
    sectionGenerative: { en: 'Generative art', zh: '生成艺术' },
    sectionDemos: { en: 'Product demos', zh: '产品演示' },
    badgeResearch: { en: 'Research · interactive', zh: '研究 · 交互' },
    badgeGenerative: { en: 'Generative art', zh: '生成艺术' },
    badgePrototype: { en: 'Prototype · interactive', zh: '原型 · 交互' },
    openPage: { en: 'Open page', zh: '打开页面' },
    cardArchitectureTitle: {
      en: 'Architecture Lineages · global architectural-history evidence atlas',
      zh: '建筑谱系 · 全球建筑史证据图谱',
    },
    cardArchitectureDesc: {
      en: 'A source-first bilingual browser for 1,152 revision-pinned works, 1,162 people, 63 practices and 57 places — searchable map, field-level evidence, raw relation review and a 9 × 8 coverage ledger, with 469 verified records.',
      zh: '来源优先的双语浏览器：1,152 件固定修订作品、1,162 位人物、63 家事务所与 57 个地点；可搜索地图、字段级证据、原始关系复核及 9 × 8 覆盖账本，已核验 469 条记录。',
    },
    cardHousingTitle: {
      en: 'Where to live well — and cheap · China small-city housing',
      zh: '哪里既宜居又便宜 · 全国小城市住房数据',
    },
    cardHousingDesc: {
      en: 'A growing set of housing listing samples across China — price × livability on an interactive map with ERA5 climate overlays, hazard layers, rankings and a sortable table. Tier-1 outliers hidden by default. Dark mode · EN/中文.',
      zh: '覆盖全国、持续扩充的住房挂牌样本——价格 × 宜居：ERA5 气候底图、灾害层、排行榜与可排序表格。默认隐藏一线城市高价样本。深色模式 · 中英切换。',
    },
    cardAutoTitle: {
      en: 'China auto city atlas · headquarters are not output',
      zh: '中国汽车城市图谱 · 总部不等于产量',
    },
    cardAutoDesc: {
      en: '28 Chinese auto cities (17 core + 11 specialist) and 168 companies/brands — HQ, plants, batteries, software, media, review-video KOLs and universities as separate roles. National auto media are grouped by beat (portals, desks, NEV, CV, trade, KOLs). Every org records a headquarters city. Pinyin / initials search, China map, cluster graph, sourced 2025 local output. Dark mode · EN/中文.',
      zh: '28 座汽车城市（17 核心 + 11 专业）与 168 家企业/品牌，用角色标签分开总部、工厂、电池、软件、媒体、评测KOL和院校。全国汽车媒体按赛道分组（门户、频道、新能源、商用车、行业报、评测号）。每家企业均收录总部城市。支持拼音/首字母/简写搜索，中国地图、产业集群图、带来源的 2025 年地方产量拼合。深色模式 · 中英切换。',
    },
    cardPebbleTitle: {
      en: 'Pebble Beach 2027 · Monterey Car Week planning guide',
      zh: 'Pebble Beach 2027 · 蒙特雷汽车周规划页',
    },
    cardPebbleDesc: {
      en: 'Seven official 2027 signature-event date ranges are recorded, including Concours Sunday on Aug 15. Detailed schedules, prices, routes, maps, brand programs, stays and travel guidance remain visibly partial or pending; the complete 2026 guide is preserved as an archive.',
      zh: '已录入 7 项 2027 官方标志性活动日期，包括 8 月 15 日 Concours Sunday；详细时段、票价、路线、地图、品牌活动、住宿与通勤仍明确标为部分确认或待补，并保留完整的 2026 历史存档。',
    },
    cardIndustrialTitle: {
      en: 'China industrial software survey',
      zh: '中国工业软件现状综述',
    },
    cardIndustrialDesc: {
      en: 'Traceable products and geometry kernels across EDA, CAD, CAE/CAM, PLM, DCS/MES, ERP, BIM/GIS, slicers and IIoT — sunburst taxonomy, capability matrix, benchmark compare. Bilingual EN/中文 · last verified 2026-06.',
      zh: '可追溯的产品与几何内核，覆盖 EDA、CAD、CAE/CAM、PLM、DCS/MES、ERP、BIM/GIS、切片与工业互联网——旭日图品类、能力矩阵、对标比较。中英界面 · 最近核验 2026-06。',
    },
    cardPharmTitle: {
      en: 'Global pharmaceutical industry atlas',
      zh: '全球医药行业图谱',
    },
    cardPharmDesc: {
      en: 'Companies, drugs and sites across dozens of countries — world map (by site / HQ country / therapeutic area), a China pharma-policy board, a deal & M&A network, corporate-group graphs, country radar and China ↔ incumbent benchmarks. Sourced records with confidence scores. Dark mode · EN/中文.',
      zh: '覆盖数十国的企业、药物与站点——世界地图（按站点/总部国家/治疗领域着色）、中国医药政策板块、交易与并购关系网、集团关系图、国家雷达图与中国 ↔ 国际对标。带来源与置信度标注。深色模式 · 中英切换。',
    },
    cardAbyssTitle: {
      en: 'Data Abyss · 数渊',
      zh: '数渊 · Data Abyss',
    },
    cardAbyssDesc: {
      en: 'A full-bleed cosmos that wakes and breathes — countless points drift, cluster and self-organize into a living lattice, its generative lo-fi soundtrack read out from the field itself and turning to a new side as it plays on. Chaos · breath · drift · weave.',
      zh: '一片会苏醒、会呼吸的全屏星海——无数光点漂流、聚拢，自组织为流动的晶格，生成式 lo-fi 乐声自星场本身涌出，播着播着便翻向新的一面。沌 · 息 · 漂 · 织。',
    },
    cardNeonTitle: {
      en: 'Neon Abyss · 霓虹渊',
      zh: '霓虹渊 · Neon Abyss',
    },
    cardNeonDesc: {
      en: 'The same cosmos, after dark — the lattice now pulses to a four-on-the-floor trance set that arcs across a whole night, warmup to peak to afterglow, the field lit in neon. The dance-floor twin of the piece above. Kick · build · drop · rise.',
      zh: '同一片星海，入了夜——晶格随四四鼓机起伏，一整晚的 Trance 长弧从热场铺到高潮再到余韵，星场亮成霓虹。上面那件作品的舞池孪生。鼓 · 升 · 泻 · 起。',
    },
    cardWfoeTitle: {
      en: 'How to open a company in China — entity paths & hiring costs',
      zh: '在中国开公司 — 设立路径与用人成本',
    },
    cardWfoeDesc: {
      en: 'Four entity paths (mainland WFOE, domestic LLC, Sino-foreign JV, HK/Macau SAR) plus an interactive cost dashboard across major China hubs with optional global city benchmarks. Data as of 2024 Q4 · last reviewed 2026-06. Bilingual EN/中文.',
      zh: '四条设立路径（大陆 WFOE、内资 LLC、中外合资、港澳 SAR）及主要人才枢纽的城市级成本仪表盘（可选国际城市对标）。数据时点 2024 Q4 · 最近复核 2026-06。中英双语。',
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
      zh: '全球收容所猫 — 领养统一平台',
    },
    cardSheltercatsDesc: {
      en: 'Cached open-data shelter-cat records on one map — filter by color, pattern, coat and distance, then follow the source link to confirm current availability. Every cat gets a deterministic pixel avatar and an attribute-driven personality preview. Dark mode · EN/中文.',
      zh: '把开放数据源中的收容所猫缓存档案汇到一张地图——可按颜色、花纹、毛长与距离筛选，并通过来源链接确认当前领养状态。每只猫会按真实属性生成像素形象与性格预览。深色模式 · 中英双语。',
    },
    cardCatMouseTitle: {
      en: 'Cat & Mouse — quadruped gait playground',
      zh: '猫与鼠标 — 四足步态实验',
    },
    cardCatMouseDesc: {
      en: 'A top-down illustrated cat watches, stalks and chases your pointer-as-mouse with an articulated four-phase gait, then sits, loafs, lies down, rolls or curls up when left alone. A live-preview appearance panel lets you restyle the coat — pattern chips, real-color swatches, fur length and light markings — using the Shelter Cats vocabulary. Dark mode · EN/中文.',
      zh: '一只俯视角插画小猫会盯梢、潜行并追逐化作小老鼠的指针；安静时则会蹲坐、揣手、侧躺、打滚或蜷卧。外观面板带实时预览，可用花纹芯片、真实配色色卡、毛长与浅色斑区域自定义猫咪，分类沿用 Shelter Cats 受控词表。关节化四相步态 · 深色模式 · 中英切换。',
    },
    footerUpdated: {
      en: 'Last updated 2026-08. Nothing here is financial, legal or tax advice.',
      zh: '最后更新 2026-08。本站内容不构成财务、法律或税务建议。',
    },
    footerStudio: { en: 'CuriousArc studio', zh: 'CuriousArc 工作室' },
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
