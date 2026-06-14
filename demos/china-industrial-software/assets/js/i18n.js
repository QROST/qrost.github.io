/**
 * China Industrial Software Survey — zh/en (default zh).
 * Persists to localStorage key `industrial-software-lang`.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'industrial-software-lang';
  let lang = 'zh';
  let onChangeCb = null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'zh') lang = stored;
  } catch (e) { /* private mode */ }

  const LABELS = {
    zh: {
      langToggle: 'EN',
      langToggleAria: '切换中文 / English',
      skipLink: '跳到内容',
      navOverview: '概览',
      navTaxonomy: '品类',
      navKernels: '几何内核',
      navCatalog: '产品列表',
      navMatrix: '能力矩阵',
      navCompare: '对标',
      navTimeline: '政策突破',
      navMethodology: '方法论',
      heroH1: '中国工业软件现状综述',
      heroLead: '覆盖 <strong class="font-medium text-slate-800">EDA、CAD、CAE/CAM、PLM、DCS/MES、ERP、BIM/GIS、切片软件</strong> 与工业互联网平台等九大品类，约 <strong id="hero-product-count" class="font-medium text-slate-800">124</strong> 款产品的可追溯调研数据。区分<strong class="font-medium text-slate-800">国产化广度</strong>（是否部署）与<strong class="font-medium text-slate-800">深度替代</strong>（是否核心生产）。',
      heroDataAsOf: '数据截至 <strong class="font-medium text-slate-700">2025</strong>。',
      heroLastReviewed: ' 末次核验 <strong class="font-medium text-slate-700">2026-06</strong>。',
      heroMethodLink: ' 见 <a href="#methodology" class="text-link">方法论</a>。',
      secOverview: '市场概览',
      secOverviewDesc: '中国工业软件市场规模约 ¥3197–3541 亿（2024–2025 口径差异）；下方为调研覆盖与规模关键指标。',
      secTaxonomy: '品类结构',
      secTaxonomyDesc: '点击品类图扇区可筛选下方产品目录；点击空白、双击中心或「重置」恢复全部。',
      sunburstReset: '重置',
      sunburstHint: '点击扇区筛选；点击空白或重置恢复全部',
      taxonomyLegendRd: '青 · 研发设计',
      taxonomyLegendMfg: '橙 · 生产制造',
      taxonomyLegendBiz: '品红 · 经营管理',
      taxonomyLegendOps: '灰 · 运维服务',
      semanticLegendPass: '绿 · 通过',
      semanticLegendForbidden: '红 · 困难',
      semanticLegendOpen: '蓝 · 开源',
      secKernels: '几何内核',
      secKernelsDesc: 'Parasolid、ACIS、C3D、Granite、Open CASCADE 与国产自主内核等可追踪实体；点击行查看能力、采用产品与替代状态。可从目录按 <code class="text-xs bg-slate-100 px-1 rounded">kernel_id</code> 筛选。',
      secCatalog: '产品列表',
      secCatalogDesc: '可排序、筛选、搜索；点击行查看详情。打开某产品后，复制浏览器地址栏中的链接即可分享给他人，对方打开后会直接进入该产品详情。',
      secMatrix: '能力矩阵',
      secMatrixDesc: '产品 × 能力关系网：横轴是从全部产品数据中提炼的 38 项关键能力（按 7 大领域分组），纵轴是全部调研产品；✔ 支持、◌ 半支持/发展中、— 不支持/无关，「覆盖」列汇总每个产品的支持能力数。点击任一产品名进入详细页，查看其能力详情、能力短板与国内外竞品对标。支持来源筛选与搜索。',
      matrixLegendFull: '支持',
      matrixLegendPartial: '半支持/正在发展',
      matrixLegendNone: '不支持/无关',
      secCompare: '对标对比',
      secCompareDesc: '选择 2–4 款产品：雷达图 + 字段并排表。可从目录「加入对比」或下方搜索添加。',
      secTimeline: '国产突破与政策',
      secTimelineDesc: '仅收录可验证的技术突破（几何内核、工艺/晶圆厂认证、首套国产化系统、关键算法/求解器等），不含融资、产品版本发布、白皮书、IPO 或战略宣发。按时间轴自上而下浏览；展开节点查看「此前做不到 / 本次突破 / 仍存差距」、依据类型与来源链接。',
      secPolicies: '可量化政策节点',
      secPoliciesDesc: '仅保留含目标值与截止期的政策指标；模糊口号见下方脚注。',
      policyFootnotes: '宏观政策背景（无单一 KPI）',
      policyFilterType: '类型筛选',
      policyNodesUnit: '个节点',
      policyMetric: '指标',
      policyTarget: '目标',
      policyActual: '已知进展',
      policyDeadline: '截止',
      policySource: '来源',
      policyDirection: '政策方向',
      policyInitiatives: '重点举措',
      policyFocus: '聚焦领域',
      policyImplications: '对工业软件的意义',
      policyRelated: '关联政策',
      policySources: '信息来源',
      policyConf: '可信度',
      policyConf_high: '高',
      policyConf_medium: '中',
      policyConf_low: '低',
      policyGanttStart: '发布',
      policyGanttDeadline: '截止',
      policyGanttOngoing: '进行中',
      policyGanttHint: '横轴为时间尺度（发布 → 截止）；小屏可左右滑动查看完整跨度。点击标题或进度条查看指标与来源。',
      policyDetailTitle: '政策指标详情',
      timelineFlowHint: '时间自上而下推进（由早到晚）',
      milestoneFilter: '品类筛选',
      milestoneExpand: '展开详情',
      milestoneShowing: '显示',
      milestoneCards: '条里程碑',
      milestoneBefore: '此前国产做不到',
      milestoneAchieve: '本次突破',
      milestoneStill: '仍存差距',
      milestoneProducts: '关联产品',
      milestoneIncumbent: '被突破的国际在位者',
      milestoneConfidence: '置信度',
      milestoneLinked: '关联里程碑',
      secMethodology: '方法论与免责声明',
      kpiMarket: '市场规模',
      kpiMarketSub: '亿元 · 2024–2025',
      kpiProducts: '调研产品',
      kpiProductsSub: '已核验深度条目',
      kpiDomestic: '国产条目',
      kpiDomesticSub: '含合资/开源',
      kpiCategories: '品类分片',
      kpiCategoriesSub: '九大品类',
      filterAll: '全部',
      filterAllOrigin: '全部来源',
      filterAllCategory: '全部品类',
      filterAllKernel: '全部内核',
      filterAllPolicyType: '全部类型',
      clearFilters: '清除筛选',
      noFilterMatch: '没有匹配项',
      catalogRowsUnit: '款产品',
      kernelsUnit: '个内核',
      matrixRowsUnit: '款产品',
      sortBy: '排序',
      colCoverage: '覆盖能力数',
      filterOrigin: '来源',
      filterCategory: '品类',
      filterMaturity: '成熟度',
      l1Rd: '研发设计',
      l1Mfg: '生产制造',
      l1Biz: '经营管理',
      l1Ops: '运维服务',
      searchPlaceholder: '搜索产品 / 厂商…',
      colName: '产品',
      colVendor: '厂商',
      colCategory: '品类',
      colOrigin: '来源',
      colMaturity: '成熟度',
      colLocDepth: '替代深度',
      colConfidence: '置信度',
      colKernel: '几何内核',
      colKernelName: '内核',
      colKernelOwner: '所有者',
      colKernelOrigin: '来源',
      colKernelDomestic: '国产产品',
      colKernelSubstitution: '替代状态',
      kernelOriginDomestic: '国产',
      kernelOriginInternational: '国际',
      kernelOriginOSS: '开源',
      kernelCapabilities: '能力',
      kernelSubstitution: '国产替代',
      kernelCatalogProducts: '目录产品',
      kernelIntlProducts: '国际采用',
      kernelChineseAdoption: '国内采用',
      kernelDomesticAlts: '国产备选',
      filterByKernel: '筛选目录',
      addCompare: '加入对比',
      removeCompare: '移除',
      closeModal: '关闭',
      originDomestic: '国产',
      originInternational: '国际',
      originJV: '合资',
      originOSS: '开源',
      maturityExperimental: '试验',
      maturityMid: '成熟',
      maturityHigh: '主流',
      maturityCritical: '关键',
      locNone: '无',
      locPilot: '试点',
      locPartial: '部分',
      locCore: '核心',
      pricingFree: '免费',
      pricingLow: '低',
      pricingMid: '中',
      pricingHigh: '高',
      pricingQuote: '询价',
      verifyPending: '待核实',
      footerBuilt: '数据构建于',
      footerDisclaimer: '© 2026 QROST. 本页为研究笔记，不构成投资或采购建议；国产化率口径因研报而异，详见方法论。',
      methodologySummary: '说明 · Methodology',
      methodDisclaimerTitle: '免责声明',
      methodDisclaimerBody: '<p>本页汇编<strong class="font-medium text-slate-700">可追溯的公开信息</strong>，用于横向了解中国工业软件的可得性、成熟度与替代空间。</p><p><strong class="font-medium text-slate-700">不构成</strong>投资、采购、招投标或技术选型建议；具体项目须结合合规要求、POC 与厂商正式报价独立判断。</p>',
      methodDataTitle: '数据来源与范围',
      methodDataBody: '<p>条目来自<strong class="font-medium text-slate-700">公开报道、厂商官网/白皮书、行业研报与用户案例</strong>等可核查来源；每条产品至少附一条来源链接。</p><p>宏观市场规模等数字因研报统计边界不同可能略有出入；页内标注<strong class="font-medium text-slate-700">数据截至 2025、末次核验 2026-06</strong>。覆盖 EDA、CAD、CAE/CAM、PLM、DCS/MES、ERP、BIM/GIS、三维切片软件与工业互联网平台等九大品类。</p>',
      methodTaxonomyTitle: '品类与目录如何组织',
      methodTaxonomyBody: '<p>目录按<strong class="font-medium text-slate-700">由粗到细</strong>四层理解：</p><ul><li><strong class="text-slate-700">业务域</strong>：研发设计、生产制造、经营管理、运维服务四大方向。</li><li><strong class="text-slate-700">软件品类</strong>：如 CAD、CAE、MES、PLM、BIM/GIS、工业互联网等（扇形图与筛选器中的主分类）。</li><li><strong class="text-slate-700">产品类型</strong>：更细的应用形态，如机械 CAD、参数化 BIM、协同审查、点云处理、工业物联网平台等。</li><li><strong class="text-slate-700">能力标签</strong>：跨品类能力，如碰撞检测、联邦协同、数字孪生等。</li></ul><p>「开源」表示<strong class="font-medium text-slate-700">许可与来源属性</strong>，不是单独品类。数字孪生作为能力标注，不单列为图表扇区；早期「三维建模」切片已并入 CAD 等品类展示。</p>',
      methodKernelTitle: '几何内核与工业软件',
      methodKernelBody: '<p>许多 CAD、BIM、CAM 产品背后嵌入<strong class="font-medium text-slate-700">几何内核</strong>（建模与几何运算引擎）——界面国产，不代表底层引擎可替代。</p><p>本页<strong class="font-medium text-slate-700">同时收录</strong>面向用户的软件产品与作为底层引擎的几何内核；「几何内核」专章列出所有者、授权方式、采用该内核的国内外产品，以及国产备选方案。</p><p>评估替代难度时，除应用层功能外，还应关注<strong class="font-medium text-slate-700">引擎依赖</strong>：换界面容易，换内核往往牵动数据格式、二次开发与生态兼容。</p>',
      methodLocalizationTitle: '国产化：广度与深度',
      methodLocalizationBody: '<p><strong class="font-medium text-slate-700">广度</strong>：行业内是否已有国产方案在部署使用（「有没有」）。</p><p><strong class="font-medium text-slate-700">深度</strong>：是否进入核心设计/生产环节、难以被替换（「能不能顶上去」）。</p><p>两者分开呈现，避免单一「国产化率」数字掩盖结构性短板——例如广覆盖但关键工序仍依赖国外引擎或国际产品。</p>',
      methodLimitsTitle: '务必注意的局限',
      methodLimitsBody: '<ul><li>调研样本<strong class="text-slate-700">非穷尽清单</strong>，侧重可公开核验的代表性产品；小众或封闭行业方案可能未收录。</li><li>成熟度与替代深度为<strong class="text-slate-700">作者综合判断</strong>，随新证据可能调整；合资、开源、云化产品的「国产」界定因场景而异。</li><li>国际对标与里程碑叙事用于<strong class="text-slate-700">研究对比</strong>，不代表市场份额或官方认定。</li><li>欢迎通过项目 issue 指出错漏；重大更正将更新数据与末次核验日期。</li></ul>',
      methodAiTitle: 'AI 辅助披露',
      methodAiBody: '<p>页面框架、文案初稿与数据整理过程中使用了 <strong class="font-medium text-slate-700">Cursor 等 AI 辅助工具</strong>；关键数字与产品归属经来源链接交叉核对，并由作者审阅后发布。</p>',
      strengths: '优势',
      limitations: '局限',
      industries: '行业',
      sources: '来源',
      benchmarks: '国际对标',
      breakthroughs: '突破',
      tabOverview: '概览',
      tabCapabilities: '能力详情',
      tabGaps: '能力短板',
      tabCompetitors: '竞品对标',
      tabMilestones: '突破里程碑',
      gapShortfall: '能力短板（竞品具备、本品欠缺）',
      gapShortfallHint: '同品类（及国际对标）竞品已全面支持、而本产品尚未或仅部分支持的能力。',
      gapLead: '差异化长处（同品类稀缺能力）',
      gapLeadHint: '本产品全面支持、而同品类多数竞品并不具备的能力。',
      compDirect: '直接对标 (国际)',
      compDomestic: '同品类国内竞品',
      compIntl: '同品类其他国际竞品',
      compNone: '暂无相关产品记录',
      capStatusFull: '支持',
      capStatusPartial: '半支持/正在发展',
      capStatusNone: '暂无支持',
      kernelLabel: '底层的几何内核',
      compareSelect: '从目录选择或搜索添加产品…',
      compareClear: '清空对比',
      compareOpenCta: '对标对比',
      compareModalTitle: '对标对比',
      compareModalDesc: '选择 2–4 款产品：雷达图 + 字段并排表。可从目录「加入对比」或下方搜索添加。',
      compareFab: '对标对比 ({n})',
      compareNeedTwo: '再选 1 款即可对比（最多 4 款）',
      compareRadar: '能力雷达',
      compareTable: '字段对比',
      dimFunction: '功能',
      dimEcosystem: '生态',
      dimMaturity: '成熟度',
      dimLocalization: '国产化',
      dimPrice: '性价比',
    },
    en: {
      langToggle: '中文',
      langToggleAria: 'Switch Chinese / English',
      skipLink: 'Skip to content',
      navOverview: 'Overview',
      navTaxonomy: 'Taxonomy',
      navKernels: 'Kernels',
      navCatalog: 'Catalog',
      navMatrix: 'Matrix',
      navCompare: 'Compare',
      navTimeline: 'Breakthroughs',
      navMethodology: 'Methodology',
      heroH1: 'China Industrial Software Landscape',
      heroLead: 'Traceable survey across <strong class="font-medium text-slate-800">EDA, CAD, CAE/CAM, PLM, DCS/MES, ERP, BIM/GIS, slicers</strong> and IIoT platforms — <strong id="hero-product-count" class="font-medium text-slate-800">124</strong> verified products. Separates <strong class="font-medium text-slate-800">breadth</strong> (deployed) vs <strong class="font-medium text-slate-800">depth</strong> (mission-critical substitution).',
      heroDataAsOf: 'Data as of <strong class="font-medium text-slate-700">2025</strong>.',
      heroLastReviewed: ' Last verified <strong class="font-medium text-slate-700">2026-06</strong>.',
      heroMethodLink: ' See <a href="#methodology" class="text-link">methodology</a>.',
      secOverview: 'Market overview',
      secOverviewDesc: 'China industrial software market ~¥3,197–3,541B (2024–2025 boundary varies). Key survey coverage and scale metrics below.',
      secTaxonomy: 'Category structure',
      secTaxonomyDesc: 'Click a sector in the category chart to filter the catalog below; click empty area, double-click center, or Reset to show all.',
      sunburstReset: 'Reset',
      sunburstHint: 'Click a sector to filter; click empty area or Reset to show all',
      taxonomyLegendRd: 'Cyan · R&D / design',
      taxonomyLegendMfg: 'Orange · Manufacturing',
      taxonomyLegendBiz: 'Magenta · Business ops',
      taxonomyLegendOps: 'Gray · Ops & services',
      semanticLegendPass: 'Green · Pass / verified',
      semanticLegendForbidden: 'Red · Gap / difficulty',
      semanticLegendOpen: 'Blue · Open source',
      secKernels: 'Geometry kernels',
      secKernelsDesc: 'Trackable entities — Parasolid, ACIS, C3D, Granite, Open CASCADE, domestic kernels. Click a row for capabilities, adopters, substitution status. Filter catalog by <code class="text-xs bg-slate-100 px-1 rounded">kernel_id</code>.',
      secCatalog: 'Product catalog',
      secCatalogDesc: 'Sortable, filterable, searchable; click a row for details. After opening a product, copy the address bar link to share — recipients open the same product detail directly.',
      secMatrix: 'Capability Matrix',
      secMatrixDesc: 'Product × capability relationship graph: the horizontal axis holds 38 key capabilities distilled from all product data (grouped into 7 domains); the vertical axis lists every surveyed product. ✔ supported, ◌ partial/developing, — unsupported/N-A; the "Cov." column tallies each product\'s supported capabilities. Click any product name to open its detail page — capabilities, gap analysis, and domestic/international competitors. Origin filter and search supported.',
      matrixLegendFull: 'Supported',
      matrixLegendPartial: 'Partial/Developing',
      matrixLegendNone: 'Unsupported/Irrelevant',
      secCompare: 'Benchmark compare',
      secCompareDesc: 'Pick 2–4 products: radar chart + side-by-side fields.',
      secTimeline: 'Domestic breakthroughs & policy',
      secTimelineDesc: 'Verifiable technical breakthroughs only (geometry kernels, process/foundry certification, first domestic systems, key algorithms/solvers) — no funding rounds, version launches, white papers, IPO, or strategy announcements. Scroll the timeline top-to-bottom; expand each node for before/achievement/still-missing, evidence type, and source links.',
      secPolicies: 'Measurable policy targets',
      secPoliciesDesc: 'Policies with numeric targets and deadlines only; vague slogans demoted to footnotes.',
      policyFootnotes: 'Macro policy context (no single KPI)',
      policyFilterType: 'Type',
      policyNodesUnit: 'nodes',
      policyMetric: 'Metric',
      policyTarget: 'Target',
      policyActual: 'Known progress',
      policyDeadline: 'Deadline',
      policySource: 'Source',
      policyDirection: 'Policy direction',
      policyInitiatives: 'Key initiatives',
      policyFocus: 'Focus areas',
      policyImplications: 'What it means for industrial software',
      policyRelated: 'Related policies',
      policySources: 'Sources',
      policyConf: 'Confidence',
      policyConf_high: 'high',
      policyConf_medium: 'medium',
      policyConf_low: 'low',
      policyGanttStart: 'Published',
      policyGanttDeadline: 'Deadline',
      policyGanttOngoing: 'Ongoing',
      policyGanttHint: 'Horizontal time axis (published → deadline); scroll on small screens. Click a title or bar for KPIs and sources.',
      policyDetailTitle: 'Policy KPI details',
      timelineFlowHint: 'Time flows top to bottom (oldest → newest)',
      milestoneFilter: 'Category',
      milestoneExpand: 'Show details',
      milestoneShowing: 'Showing',
      milestoneCards: 'milestones',
      milestoneBefore: 'Previously unavailable domestically',
      milestoneAchieve: 'This breakthrough',
      milestoneStill: 'Remaining gaps',
      milestoneProducts: 'Products',
      milestoneIncumbent: 'Incumbent broken',
      milestoneConfidence: 'Confidence',
      milestoneLinked: 'Linked milestones',
      secMethodology: 'Methodology & disclaimer',
      kpiMarket: 'Market size',
      kpiMarketSub: 'CNY bn · 2024–25',
      kpiProducts: 'Products',
      kpiProductsSub: 'verified depth entries',
      kpiDomestic: 'Domestic entries',
      kpiDomesticSub: 'incl. JV / OSS',
      kpiCategories: 'Category shards',
      kpiCategoriesSub: 'nine categories',
      filterAll: 'All',
      filterAllOrigin: 'All origins',
      filterAllCategory: 'All categories',
      filterAllKernel: 'All kernels',
      filterAllPolicyType: 'All types',
      clearFilters: 'Clear filters',
      noFilterMatch: 'No matches',
      catalogRowsUnit: 'products',
      kernelsUnit: 'kernels',
      matrixRowsUnit: 'products',
      sortBy: 'Sort',
      colCoverage: 'Capabilities covered',
      filterOrigin: 'Origin',
      filterCategory: 'Category',
      filterMaturity: 'Maturity',
      l1Rd: 'R&D / design',
      l1Mfg: 'Manufacturing',
      l1Biz: 'Business ops',
      l1Ops: 'Ops & services',
      searchPlaceholder: 'Search product / vendor…',
      colName: 'Product',
      colVendor: 'Vendor',
      colCategory: 'Category',
      colOrigin: 'Origin',
      colMaturity: 'Maturity',
      colLocDepth: 'Loc. depth',
      colConfidence: 'Confidence',
      colKernel: 'Geometry kernel',
      colKernelName: 'Kernel',
      colKernelOwner: 'Owner',
      colKernelOrigin: 'Origin',
      colKernelDomestic: 'Domestic products',
      colKernelSubstitution: 'Substitution',
      kernelOriginDomestic: 'Domestic',
      kernelOriginInternational: 'International',
      kernelOriginOSS: 'Open source',
      kernelCapabilities: 'Capabilities',
      kernelSubstitution: 'Substitution (China)',
      kernelCatalogProducts: 'Catalog products',
      kernelIntlProducts: 'International adopters',
      kernelChineseAdoption: 'China adoption',
      kernelDomesticAlts: 'Domestic alternatives',
      filterByKernel: 'Filter catalog',
      addCompare: 'Add to compare',
      removeCompare: 'Remove',
      closeModal: 'Close',
      originDomestic: 'Domestic',
      originInternational: 'International',
      originJV: 'Joint venture',
      originOSS: 'Open source',
      maturityExperimental: 'Experimental',
      maturityMid: 'Mid',
      maturityHigh: 'High',
      maturityCritical: 'Mission-critical',
      locNone: 'None',
      locPilot: 'Pilot',
      locPartial: 'Partial',
      locCore: 'Core',
      pricingFree: 'Free',
      pricingLow: 'Low',
      pricingMid: 'Mid',
      pricingHigh: 'High',
      pricingQuote: 'Quote',
      verifyPending: 'Unverified',
      footerBuilt: 'Data built at',
      footerDisclaimer: '© 2026 QROST. Research notes only — not investment or procurement advice.',
      methodologySummary: 'Methodology',
      methodDisclaimerTitle: 'Disclaimer',
      methodDisclaimerBody: '<p>This page compiles <strong class="font-medium text-slate-700">traceable public information</strong> to compare availability, maturity, and substitution headroom for industrial software in China.</p><p>It is <strong class="font-medium text-slate-700">not</strong> investment, procurement, tender, or technology-selection advice. Real projects need compliance review, POCs, and vendor quotes on their own merits.</p>',
      methodDataTitle: 'Data sources & scope',
      methodDataBody: '<p>Entries draw on <strong class="font-medium text-slate-700">press, vendor sites/white papers, industry reports, and user cases</strong> with at least one checkable source link per product.</p><p>Headline market-size figures may differ by report boundary. The page states <strong class="font-medium text-slate-700">data as of 2025, last reviewed 2026-06</strong>. Coverage spans nine categories: EDA, CAD, CAE/CAM, PLM, DCS/MES, ERP, BIM/GIS, 3D slicers, and IIoT platforms.</p>',
      methodTaxonomyTitle: 'How the catalog is organized',
      methodTaxonomyBody: '<p>Think in <strong class="font-medium text-slate-700">four layers</strong>, coarse to fine:</p><ul><li><strong class="text-slate-700">Business domain</strong>: R&amp;D/design, manufacturing, business operations, ops &amp; services.</li><li><strong class="text-slate-700">Software category</strong>: e.g. CAD, CAE, MES, PLM, BIM/GIS, IIoT (main category chart and filter buckets).</li><li><strong class="text-slate-700">Product type</strong>: finer roles — mechanical CAD, parametric BIM, coordination/review, point-cloud tools, IIoT platforms, etc.</li><li><strong class="text-slate-700">Capability tags</strong>: cross-cutting skills — clash detection, federated BIM, digital twin, and similar.</li></ul><p>“Open source” marks <strong class="font-medium text-slate-700">license/provenance</strong>, not a standalone category. Digital twin is tagged as a capability, not its own chart slice; an early “3D modeling” slice is folded into CAD and related categories.</p>',
      methodKernelTitle: 'Geometry kernels & industrial software',
      methodKernelBody: '<p>Many CAD, BIM, and CAM products embed a <strong class="font-medium text-slate-700">geometry kernel</strong> — the modeling engine underneath the UI. A domestic-branded interface does not imply the engine is replaceable.</p><p>This survey lists <strong class="font-medium text-slate-700">both</strong> end-user products and underlying kernels. The kernels section shows owners, licensing, products that adopt each engine (domestic and international), and domestic alternatives.</p><p>Substitution is often an <strong class="font-medium text-slate-700">engine problem</strong>, not just an app swap: kernels tie into file formats, customization APIs, and ecosystem compatibility.</p>',
      methodLocalizationTitle: 'Localization: breadth vs depth',
      methodLocalizationBody: '<p><strong class="font-medium text-slate-700">Breadth</strong>: whether a domestic option is deployed in the field (“is there one?”).</p><p><strong class="font-medium text-slate-700">Depth</strong>: whether it sits in mission-critical design or production steps (“can it carry the load?”).</p><p>We show both tracks separately so a single “localization rate” cannot hide structural gaps — e.g. wide coverage while critical steps still depend on foreign engines or products.</p>',
      methodLimitsTitle: 'Important limitations',
      methodLimitsBody: '<ul><li>The sample is <strong class="text-slate-700">not exhaustive</strong> — representative, publicly verifiable products; niche or closed-industry tools may be missing.</li><li>Maturity and substitution depth are <strong class="text-slate-700">author judgments</strong> and may shift with new evidence; “domestic” is ambiguous for JV, OSS, and cloud offerings.</li><li>International benchmarks and milestone narratives are for <strong class="text-slate-700">research comparison</strong>, not market share or official certification.</li><li>Corrections welcome via project issues; material fixes update data and the last-reviewed date.</li></ul>',
      methodAiTitle: 'AI assistance disclosure',
      methodAiBody: '<p>Page scaffolding, draft copy, and data cleanup used <strong class="font-medium text-slate-700">Cursor and similar AI assistive tools</strong>. Key figures and product placement were cross-checked against source links and reviewed by the author before publish.</p>',
      strengths: 'Strengths',
      limitations: 'Limitations',
      industries: 'Industries',
      sources: 'Sources',
      benchmarks: 'Intl. benchmarks',
      breakthroughs: 'Breakthroughs',
      tabOverview: 'Overview',
      tabCapabilities: 'Capabilities',
      tabGaps: 'Gap Analysis',
      tabCompetitors: 'Competitors',
      tabMilestones: 'Milestones',
      gapShortfall: 'Capability gaps (peers have, this lacks)',
      gapShortfallHint: 'Capabilities that same-category peers (and international benchmarks) fully support, but this product does not yet — or only partially — support.',
      gapLead: 'Differentiated strengths (rare in category)',
      gapLeadHint: 'Capabilities this product fully supports that most same-category peers lack.',
      compDirect: 'Direct Benchmarks',
      compDomestic: 'Domestic Peers',
      compIntl: 'International Peers',
      compNone: 'No peer records available',
      capStatusFull: 'Supported',
      capStatusPartial: 'Partial / Developing',
      capStatusNone: 'Not supported',
      kernelLabel: 'Underlying Kernel',
      compareSelect: 'Pick from catalog or search…',
      compareClear: 'Clear compare',
      compareOpenCta: 'Benchmark compare',
      compareModalTitle: 'Benchmark compare',
      compareModalDesc: 'Pick 2–4 products: radar chart + side-by-side fields. Add from catalog or search below.',
      compareFab: 'Compare ({n})',
      compareNeedTwo: 'Pick one more to compare (max 4)',
      compareRadar: 'Capability radar',
      compareTable: 'Field compare',
      dimFunction: 'Function',
      dimEcosystem: 'Ecosystem',
      dimMaturity: 'Maturity',
      dimLocalization: 'Localization',
      dimPrice: 'Value',
    },
  };

  const ORIGIN_LABELS = {
    zh: { domestic: '国产', international: '国际', joint_venture: '合资', open_source: '开源' },
    en: { domestic: 'Domestic', international: 'International', joint_venture: 'JV', open_source: 'OSS' },
  };

  const MATURITY_LABELS = {
    zh: { experimental: '试验', mid: '成熟', high: '主流', mission_critical: '关键' },
    en: { experimental: 'Experimental', mid: 'Mid', high: 'High', mission_critical: 'Critical' },
  };

  const LOC_LABELS = {
    zh: { none: '无', pilot: '试点', partial: '部分', core: '核心' },
    en: { none: 'None', pilot: 'Pilot', partial: 'Partial', core: 'Core' },
  };

  const KERNEL_LICENSE_LABELS = {
    zh: {
      commercial: '商业授权',
      oem: 'OEM 嵌入式',
      open_source: '开源',
      proprietary_inhouse: '自研专有',
    },
    en: {
      commercial: 'Commercial',
      oem: 'OEM embedded',
      open_source: 'Open source',
      proprietary_inhouse: 'Proprietary in-house',
    },
  };

  const PRODUCT_TYPE_LABELS = {
    zh: {
      mcad: '三维 MCAD', '2d_cad': '二维 CAD', dcc_mesh: 'DCC 网格', cae_solver: 'CAE 求解',
      cam: 'CAM', eda: 'EDA', plm: 'PLM', bim: 'BIM 建模', bim_coordination: 'BIM 协同审查',
      reality_capture: '实景捕获/点云', gis: 'GIS', iiot_platform: '工业互联网平台',
      scada: 'SCADA', mes: 'MES', dcs: 'DCS', eam: 'EAM', erp: 'ERP', slicer: '切片',
      cim: '半导体 CIM', mbse: 'MBSE', cad_interop: 'CAD 互操作',
      cad_automation: 'CAD 自动化', other: '其他',
    },
    en: {
      mcad: '3D MCAD', '2d_cad': '2D CAD', dcc_mesh: 'DCC mesh', cae_solver: 'CAE solver',
      cam: 'CAM', eda: 'EDA', plm: 'PLM', bim: 'BIM authoring', bim_coordination: 'BIM coordination',
      reality_capture: 'Reality capture', gis: 'GIS', iiot_platform: 'IIoT platform',
      scada: 'SCADA', mes: 'MES', dcs: 'DCS', eam: 'EAM', erp: 'ERP', slicer: 'Slicer',
      cim: 'Semiconductor CIM', mbse: 'MBSE', cad_interop: 'CAD interop',
      cad_automation: 'CAD automation', other: 'Other',
    },
  };

  const TAG_LABELS = {
    zh: {
      digital_twin: '数字孪生', xinchuang: '信创', am_slicing: '增材切片', cad_interop: 'CAD 互操作',
      open_source_stack: '开源栈', semiconductor: '半导体', aerospace: '航空航天', automotive: '汽车',
      cloud_native: '云原生', low_code: '低代码', clash_detection: '碰撞检测',
      federated_bim: '联邦模型集成', point_cloud: '点云', model_checking: '模型检查',
      '4d_simulation': '4D 施工模拟', open_bim: 'Open BIM',
      visual_programming: '视觉编程', cad_scripting: 'CAD 脚本/API',
    },
    en: {
      digital_twin: 'Digital twin', xinchuang: 'Xinchuang', am_slicing: 'AM slicing',
      cad_interop: 'CAD interop', open_source_stack: 'Open-source stack', semiconductor: 'Semiconductor',
      aerospace: 'Aerospace', automotive: 'Automotive', cloud_native: 'Cloud-native',
      low_code: 'Low-code', clash_detection: 'Clash detection', federated_bim: 'Federated BIM',
      point_cloud: 'Point cloud', model_checking: 'Model checking',
      '4d_simulation': '4D simulation', open_bim: 'Open BIM',
      visual_programming: 'Visual programming', cad_scripting: 'CAD scripting/API',
    },
  };

  function t(key) {
    return (LABELS[lang] && LABELS[lang][key]) || key;
  }

  function isEn() { return lang === 'en'; }

  function productName(p) {
    return isEn() ? p.name_en : p.name_zh;
  }

  function vendorName(v) {
    if (!v) return '';
    return isEn() ? v.name_en : v.name_zh;
  }

  function originLabel(o) {
    return (ORIGIN_LABELS[lang] && ORIGIN_LABELS[lang][o]) || o;
  }

  function maturityLabel(m) {
    return (MATURITY_LABELS[lang] && MATURITY_LABELS[lang][m]) || m;
  }

  function locLabel(l) {
    return (LOC_LABELS[lang] && LOC_LABELS[lang][l]) || l;
  }

  function kernelLicenseLabel(m) {
    return (KERNEL_LICENSE_LABELS[lang] && KERNEL_LICENSE_LABELS[lang][m]) || m;
  }

  function productTypeLabel(pt) {
    return (PRODUCT_TYPE_LABELS[lang] && PRODUCT_TYPE_LABELS[lang][pt]) || pt;
  }

  function tagLabel(tag) {
    return (TAG_LABELS[lang] && TAG_LABELS[lang][tag]) || tag;
  }

  /** Human-readable label for kernel enum fields (origin, license_model). */
  function labelForKernelField(key, value) {
    if (value == null || value === '') return '—';
    if (key === 'origin') return originLabel(value);
    if (key === 'license_model') return kernelLicenseLabel(value);
    return value;
  }

  function listField(p, zhKey, enKey) {
    const arr = isEn() ? p[enKey] : p[zhKey];
    return Array.isArray(arr) ? arr : [];
  }

  function applyLangToUI() {
    document.documentElement.lang = isEn() ? 'en' : 'zh';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (val && val.indexOf('<') >= 0) el.innerHTML = val;
      else if (val) el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    const toggle = document.getElementById('lang-toggle');
    if (toggle) {
      toggle.textContent = t('langToggle');
      toggle.setAttribute('aria-label', t('langToggleAria'));
    }
    if (onChangeCb) onChangeCb();
  }

  function setLang(next) {
    if (next !== 'zh' && next !== 'en') return;
    lang = next;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* */ }
    applyLangToUI();
  }

  function toggleLang() {
    setLang(lang === 'zh' ? 'en' : 'zh');
  }

  function onChange(cb) {
    onChangeCb = cb;
  }

  window.INDUSTRIAL_I18N = {
    t, isEn, lang: () => lang, setLang, toggleLang, applyLangToUI, onChange,
    productName, vendorName, originLabel, maturityLabel, locLabel,
    kernelLicenseLabel, productTypeLabel, tagLabel, labelForKernelField, listField,
  };

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('lang-toggle');
    if (btn) btn.addEventListener('click', toggleLang);
    applyLangToUI();
  });
})();
