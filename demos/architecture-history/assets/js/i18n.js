/* Bilingual UI and enum labels. Chinese is the default language. */
(function () {
  'use strict';

  const LANG_KEY = 'architecture-history-lang';
  const THEME_KEY = 'qrost-architecture-history-theme';

  const STRINGS = {
    pageTitle: { zh: '建筑谱系 · Architecture Lineages — QROST', en: 'Architecture Lineages · 建筑谱系 — QROST' },
    metaDescription: {
      zh: '一个来源优先、候选与核验分离的全球建筑史双语浏览器：建筑、建筑师、事务所、地点与待审知识传递线索。',
      en: 'A bilingual, source-first browser for global architectural history: works, architects, practices, places, and knowledge-transfer clues kept separate from verified facts.',
    },
    skipToContent: { zh: '跳到主要内容', en: 'Skip to main content' },
    homeLabel: { zh: 'QROST 首页', en: 'QROST home' },
    brandSub: { zh: '建筑谱系', en: 'Architecture lineages' },
    mainNavLabel: { zh: '主要导航', en: 'Main navigation' },
    sectionNavLabel: { zh: '章节导航', en: 'Section navigation' },
    navAtlas: { zh: '图谱', en: 'Atlas' },
    navCatalog: { zh: '目录', en: 'Catalog' },
    navLineage: { zh: '关系', en: 'Relations' },
    navCoverage: { zh: '覆盖', en: 'Coverage' },
    navMethod: { zh: '方法', en: 'Method' },
    heroEyebrow: { zh: 'ARCHITECTURE LINEAGES · 数据基线 01', en: 'ARCHITECTURE LINEAGES · DATA BASELINE 01' },
    heroTitle: { zh: '建筑谱系', en: 'Architecture Lineages' },
    heroSubtitle: { zh: 'Architecture Lineages', en: '建筑谱系' },
    heroLead: {
      zh: '把建筑、建筑师、工作室与知识传递关系放进同一张可追溯的历史图谱。现在展示的是用于校验数据管线的跨区域候选样本，不是全球建筑史全集。',
      en: 'A traceable historical graph connecting works, architects, practices, and knowledge-transfer records. The current release is a cross-regional candidate fixture for validating the data pipeline—not a complete global history.',
    },
    browseCatalog: { zh: '浏览候选目录', en: 'Browse candidate catalog' },
    readMethod: { zh: '先看方法与边界', en: 'Read methods and limits first' },
    truthTitle: { zh: '当前发布状态', en: 'Current release state' },
    candidate: { zh: '候选', en: 'Candidate' },
    verified: { zh: '已核验', en: 'Verified' },
    contested: { zh: '有争议', en: 'Contested' },
    declined: { zh: '已拒绝', en: 'Declined' },
    verifiedFacts: { zh: '条已核验实体或关系', en: 'verified entities or relations' },
    truthCopy: {
      zh: '现有记录全部来自固定版本的 Wikidata 水合样本，尚未经过本项目人工编辑核验。关系线索与来源证据逐项呈现，供检索、比较与复核。',
      en: 'Every current record comes from revision-pinned Wikidata hydration fixtures and has not received this project’s human editorial verification. Relation clues and source evidence are presented record by record for search, comparison, and review.',
    },
    dataAsOf: { zh: '数据时点', en: 'Data as of' },
    coverageRun: { zh: '覆盖单元', en: 'Coverage cells' },
    dataVersion: { zh: '数据版本', en: 'Data version' },
    dataScaleLabel: { zh: '数据规模', en: 'Data scale' },
    metricWorks: { zh: '标志性建筑候选', en: 'candidate built works' },
    metricWorksSub: { zh: '跨 9 个宏观区域的水合夹具', en: 'hydration fixtures across 9 macroregions' },
    metricPeople: { zh: '建筑师与相关人物', en: 'architects and related people' },
    metricPeopleSub: { zh: '中文名缺失会被明确标出', en: 'missing Chinese labels remain explicit' },
    metricPractices: { zh: '工作室 / 事务所', en: 'studios / practices' },
    metricPracticesSub: { zh: '不把个人与机构混为一谈', en: 'people and organizations stay distinct' },
    metricClaims: { zh: '字段级来源主张', en: 'field-level source claims' },
    metricClaimsSub: { zh: '绑定固定修订与记录哈希', en: 'bound to pinned revisions and record hashes' },
    scopeNoticeLabel: { zh: '范围声明', en: 'Scope notice' },
    boundaryTitle: { zh: '先读这条边界', en: 'Read this boundary first' },
    boundaryCopy: {
      zh: '532 件作品是校验来源映射的固定候选夹具，不是排名、代表性抽样或全球覆盖率。所有 72 个“区域 × 时期”发现单元仍未运行。',
      en: 'The 532 works are fixed candidate fixtures for validating source mappings—not a ranking, representative sample, or global coverage measure. All 72 region × period discovery cells remain unrun.',
    },
    inspectCoverage: { zh: '查看覆盖矩阵', en: 'Inspect coverage matrix' },
    atlasKicker: { zh: '01 · 地理浏览', en: '01 · GEOGRAPHIC BROWSER' },
    atlasTitle: { zh: '候选作品世界图谱', en: 'World atlas of candidate works' },
    atlasIntro: {
      zh: '地图只绘制数据中带坐标的作品；点击标记打开同一份证据详情。缺失坐标不会被猜测补齐。',
      en: 'The map plots only works with source coordinates. Select a marker to open the same evidence record; missing coordinates are never guessed.',
    },
    mapVisible: { zh: '当前可见坐标点', en: 'visible coordinate points' },
    mapAria: { zh: '候选建筑物世界地图', en: 'World map of candidate built works' },
    loadingMap: { zh: '正在加载地图…', en: 'Loading map…' },
    mapUnavailableTitle: { zh: '交互地图未能加载', en: 'Interactive map could not load' },
    mapUnavailableCopy: { zh: '目录与坐标清单仍可正常使用；这不影响数据本身。', en: 'The catalog and coordinate list still work; the underlying data is unaffected.' },
    regionLegendLabel: { zh: '区域图例', en: 'Region legend' },
    mapNote: { zh: '514/532 件夹具作品带来源坐标；其余 18 件保持坐标缺失，不猜测补齐。', en: '514 of 532 fixture works carry source coordinates; the remaining 18 stay explicitly missing with no guessed coordinates.' },
    coordinateListTitle: { zh: '不用地图浏览：坐标作品清单', en: 'Browse without the map: coordinate-bearing works' },
    catalogKicker: { zh: '02 · 检索与证据', en: '02 · SEARCH AND EVIDENCE' },
    catalogTitle: { zh: '建筑史候选目录', en: 'Candidate architectural-history catalog' },
    catalogIntro: {
      zh: '中英文名、别名、Wikidata ID、地点与署名均可搜索。搜索、区域、来源派生时期与证据筛选同步驱动地图和目录；实体类型标签只整理目录。',
      en: 'Search Chinese and English names, aliases, Wikidata IDs, places, and credits. Search, region, source-derived period, and evidence filters drive both map and catalog; entity-type tabs organize the catalog only.',
    },
    searchLabel: { zh: '搜索目录', en: 'Search catalog' },
    searchPlaceholder: { zh: '搜索中文名、英文名、别名或 ID…', en: 'Search Chinese/English names, aliases, or IDs…' },
    resetFilters: { zh: '重置筛选', en: 'Reset filters' },
    entityTypeLabel: { zh: '实体类型', en: 'Entity type' },
    typeAll: { zh: '全部', en: 'All' },
    typeWork: { zh: '建筑', en: 'Works' },
    typePerson: { zh: '人物', en: 'People' },
    typePractice: { zh: '事务所', en: 'Practices' },
    typePlace: { zh: '地点', en: 'Places' },
    regionFilter: { zh: '区域', en: 'Region' },
    regionFilterAria: { zh: '按区域筛选', en: 'Filter by region' },
    regionAll: { zh: '全部区域', en: 'All regions' },
    periodFilter: { zh: '时期（来源派生）', en: 'Period (source-derived)' },
    periodFilterAria: { zh: '按来源派生时期筛选', en: 'Filter by source-derived period' },
    periodAll: { zh: '全部时期', en: 'All periods' },
    statusFilter: { zh: '核验状态', en: 'Verification state' },
    statusFilterAria: { zh: '按核验状态筛选', en: 'Filter by verification state' },
    statusAll: { zh: '全部状态', en: 'All states' },
    workTypeFilter: { zh: '建筑类型映射', en: 'Work-type mapping' },
    workTypeFilterAria: { zh: '按建筑类型映射筛选', en: 'Filter by work-type mapping' },
    workTypeAll: { zh: '全部映射状态', en: 'All mapping states' },
    mappedExact: { zh: '精确映射', en: 'Exact mapping' },
    ambiguous: { zh: '含混', en: 'Ambiguous' },
    unmapped: { zh: '未映射', en: 'Unmapped' },
    hasChinese: { zh: '有中文来源名', en: 'Has source Chinese label' },
    hasCoordinates: { zh: '有来源坐标', en: 'Has source coordinates' },
    hasCredits: { zh: '有候选署名', en: 'Has candidate credits' },
    openHint: { zh: '点击一行查看来源与关联记录', en: 'Select a row for sources and connected records' },
    columnName: { zh: '名称', en: 'Name' },
    columnType: { zh: '类型', en: 'Type' },
    columnRegion: { zh: '区域', en: 'Region' },
    columnContext: { zh: '地点 / 关联', en: 'Place / links' },
    columnEvidence: { zh: '证据', en: 'Evidence' },
    columnStatus: { zh: '状态', en: 'State' },
    emptyTitle: { zh: '没有符合条件的记录', en: 'No records match' },
    emptyCopy: { zh: '请放宽筛选条件，或重置后重新搜索。', en: 'Broaden the filters or reset and search again.' },
    lineageKicker: { zh: '03 · 待审知识传递', en: '03 · KNOWLEDGE-TRANSFER REVIEW' },
    lineageTitle: { zh: '原始关系复核图', en: 'Raw relation review graph' },
    lineageIntro: {
      zh: '这些虚线边来自 Wikidata P1066/P802 的原始记录，只表示待审的“前序人物 → 后续人物”线索；不能自动解释为教师、导师或师徒。',
      en: 'These dashed edges come from raw Wikidata P1066/P802 records. They are review clues from predecessor → successor and cannot automatically be interpreted as teacher, mentor, or apprenticeship.',
    },
    lineageCountLabel: { zh: '条候选待审边', en: 'candidate review edges' },
    lineageWarningTitle: { zh: '关系线索不等于已确认师承。', en: 'Relation clues are not verified lineage.' },
    lineageWarningCopy: {
      zh: '教育、任职、合作、影响或数据库关系都不能自动等同于教师、导师或学徒关系；需要逐条人工核验。',
      en: 'Education, employment, collaboration, influence, and database relations cannot automatically establish teaching, mentorship, or apprenticeship; every edge requires human review.',
    },
    lineageGraphAria: { zh: '候选知识传递关系图', en: 'Candidate knowledge-transfer review graph' },
    graphUnavailableTitle: { zh: '关系图未能加载', en: 'Relation graph could not load' },
    graphUnavailableCopy: { zh: '右侧的语义化关系清单仍可完整浏览。', en: 'The semantic relation list remains fully available.' },
    coverageKicker: { zh: '04 · 覆盖诚实度', en: '04 · COVERAGE HONESTY' },
    coverageTitle: { zh: '9 区域 × 8 时期发现矩阵', en: '9-region × 8-period discovery matrix' },
    coverageIntro: {
      zh: '矩阵固定了未来系统收集的抽样框架。当前 72 个单元全部未运行；下方样本分布不能替代覆盖进度。',
      en: 'The matrix fixes the sampling frame for future systematic collection. All 72 cells are currently unrun; fixture distribution below is not coverage progress.',
    },
    coverageProgressAria: { zh: '覆盖进度', en: 'Coverage progress' },
    coverageComplete: { zh: '发现单元已运行', en: 'discovery cells run' },
    coverageMatrixAria: { zh: '区域与时期覆盖矩阵', en: 'Region and period coverage matrix' },
    notRun: { zh: '未运行', en: 'Not run' },
    partial: { zh: '部分运行', en: 'Partial' },
    complete: { zh: '已运行', en: 'Run' },
    fixtureTitle: { zh: '固定水合夹具的区域分布', en: 'Regional distribution of fixed hydration fixtures' },
    fixtureCopy: {
      zh: '仅用于证伪映射与来源链；不代表每个区域的重要性、完整性或可比性。',
      en: 'Used only to falsify mappings and provenance chains; it does not represent regional importance, completeness, or comparability.',
    },
    methodKicker: { zh: '05 · 方法、来源与许可', en: '05 · METHOD, SOURCES, AND RIGHTS' },
    methodTitle: { zh: '复用前人研究，但不跳过证据治理', en: 'Reuse prior research without skipping evidence governance' },
    methodIntro: {
      zh: '来源登记表区分“可以发现候选”“可以发布字段”“适合证明关系”与“适合覆盖研究”。适配器可用性也与来源权威性分开记录。',
      en: 'The source registry separates candidate discovery, publishable fields, relationship authority, and coverage utility. Adapter readiness is also tracked separately from source authority.',
    },
    methodOneTitle: { zh: '先接权威聚合', en: 'Start with established aggregators' },
    methodOneCopy: { zh: '优先接入 Wikidata、Getty Vocabularies、Archnet、GAHTC 等已登记的知识组织与聚合项目，减少重复劳动。', en: 'Prioritize registered knowledge organizations and aggregators such as Wikidata, Getty Vocabularies, Archnet, and GAHTC to reduce duplicate research.' },
    methodTwoTitle: { zh: '字段级溯源', en: 'Field-level provenance' },
    methodTwoCopy: { zh: '名称、坐标、署名与关系分别保存证据；一个来源的“有记录”不等于本项目“已核验”。', en: 'Names, coordinates, credits, and relations keep separate evidence. “Recorded by a source” is not “verified by this project.”' },
    methodThreeTitle: { zh: '师承严格分型', en: 'Strict lineage typing' },
    methodThreeCopy: { zh: '教育、任职、合作者与风格相似都不能自动推断师承；关系冲突时保持候选或争议状态。', en: 'Education, employment, collaboration, and stylistic similarity cannot infer mentorship. Conflicts stay candidate or contested.' },
    methodFourTitle: { zh: '核验状态与原始记录分离', en: 'Verification stays separate from source records' },
    methodFourCopy: { zh: '编辑核验通过独立、可追溯的状态层完成，不改写原始历史记录；冲突与不确定性继续保留。', en: 'Editorial verification is recorded in a separate, traceable state layer without rewriting source records; conflicts and uncertainty remain visible.' },
    sourceRegistryTitle: { zh: '来源登记表', en: 'Source registry' },
    sourceRegistryCopy: { zh: '显示本项目计划复用的来源、许可决策与当前适配状态。当前发布候选记录仅来自 Wikidata 固定修订夹具。', en: 'Planned reusable sources, rights decisions, and adapter state. Current published candidate records come only from revision-pinned Wikidata fixtures.' },
    licenseTitle: { zh: '许可与快照边界', en: 'Rights and snapshot boundary' },
    licenseCopy: { zh: '结构化 Wikidata 数据按 CC0 复用；页面保留固定修订链接与记录哈希。其他来源只有在登记的 allowed_operations 允许时才会进入发布数据。', en: 'Structured Wikidata data is reused under CC0, with pinned revision links and record hashes retained. Other sources enter published data only when their registered allowed_operations permit it.' },
    footerScope: { zh: '开放研究原型 · 候选数据不构成完整或权威的全球建筑史。', en: 'Open research prototype · Candidate data is not a complete or authoritative global architectural history.' },
    backHome: { zh: '返回 QROST 首页', en: 'Back to QROST home' },
    closeDetail: { zh: '关闭详情', en: 'Close details' },
    initErrorTitle: { zh: '数据浏览器未能初始化', en: 'The data browser could not initialize' },
    initErrorCopy: { zh: '请通过本地 HTTP 服务器或 GitHub Pages 打开；静态说明仍可阅读。', en: 'Open through a local HTTP server or GitHub Pages; the static methodology remains readable.' },
    sourceCount: { zh: '{count} 个登记来源', en: '{count} registered sources' },
    resultCount: { zh: '显示 {shown} / {total} 条候选目录记录', en: 'Showing {shown} of {total} candidate catalog records' },
    noChineseLabel: { zh: '中文来源名缺失', en: 'No source Chinese label' },
    claimsCount: { zh: '{count} 条主张', en: '{count} claims' },
    creditsCount: { zh: '{count} 项候选署名', en: '{count} candidate credits' },
    linkedWorksCount: { zh: '{count} 件关联作品', en: '{count} linked works' },
    countryCode: { zh: '国家代码 {code}', en: 'Country code {code}' },
    detailsFor: { zh: '{type}详情', en: '{type} details' },
    detailRegion: { zh: '宏观区域', en: 'Macroregion' },
    detailVerification: { zh: '核验状态', en: 'Verification state' },
    detailConfidence: { zh: '来源映射置信度', en: 'Source-mapping confidence' },
    detailExternalId: { zh: '外部标识', en: 'External identifier' },
    detailCountryCode: { zh: '国家代码', en: 'Country code' },
    detailPlace: { zh: '地点', en: 'Place' },
    detailPeriod: { zh: '来源派生时期', en: 'Source-derived period' },
    detailWorkType: { zh: '作品类型', en: 'Work type' },
    detailTypeMapping: { zh: '类型映射', en: 'Type mapping' },
    detailCoordinates: { zh: '来源坐标', en: 'Source coordinates' },
    detailNameStatus: { zh: '中文名状态', en: 'Chinese-name state' },
    detailCredits: { zh: '候选署名', en: 'Candidate credits' },
    detailWorks: { zh: '关联作品', en: 'Linked works' },
    detailRelations: { zh: '待审关系线索', en: 'Relation review clues' },
    detailClaims: { zh: '字段级证据主张', en: 'Field-level evidence claims' },
    unresolvedCredits: { zh: '未解析署名', en: 'Unresolved credits' },
    unresolvedCreditCopy: { zh: '来源 P84 中仍有 {count} 个贡献者未能安全映射为双语实体；不会静默丢弃或并入其他署名。', en: '{count} contributor(s) in source P84 could not be safely mapped to bilingual entities; they are neither dropped nor merged into another credit.' },
    openPinnedSource: { zh: '打开固定修订来源', en: 'Open pinned revision source' },
    sourceRecord: { zh: '来源记录 {id}', en: 'Source record {id}' },
    relationReviewOnly: { zh: '仅待审 · 不能证明师承', en: 'Review only · does not establish lineage' },
    noData: { zh: '未记录', en: 'Not recorded' },
    unknown: { zh: '未知', en: 'Unknown' },
    sourceHome: { zh: '来源主页 ↗', en: 'Source home ↗' },
    licenseLabel: { zh: '元数据许可', en: 'Metadata license' },
    adapterLabel: { zh: '适配器', en: 'Adapter' },
    reuseDecision: { zh: '项目复用决策', en: 'Project reuse decision' },
    rightsOperations: { zh: '允许的操作', en: 'Allowed operations' },
    operationDownload: { zh: '下载', en: 'Download' },
    operationSnapshot: { zh: '保留快照', en: 'Retain snapshot' },
    operationDerive: { zh: '派生字段', en: 'Derive fields' },
    operationPublishMetadata: { zh: '再发布元数据', en: 'Republish metadata' },
    operationPublishText: { zh: '再发布文本', en: 'Republish text' },
    operationPublishMedia: { zh: '再发布媒体', en: 'Republish media' },
    operationAllowed: { zh: '允许', en: 'Allowed' },
    operationBlocked: { zh: '不允许', en: 'Not allowed' },
    rightsNote: { zh: '署名与例外说明', en: 'Attribution and exceptions' },
    knownBias: { zh: '已知边界', en: 'Known boundary' },
    relationEvidence: { zh: '审计这条关系', en: 'Audit this relation' },
    relationDetail: { zh: '关系证据详情', en: 'Relation evidence detail' },
    relationFrom: { zh: '待审前序人物', en: 'Review predecessor' },
    relationTo: { zh: '待审后续人物', en: 'Review successor' },
    relationType: { zh: '原始关系类型', en: 'Raw relation type' },
    relationReviewGate: { zh: '复核门槛', en: 'Review gate' },
    relationRejectionReason: { zh: '需要人工分类，并补充更强的关系证据。', en: 'Requires human classification and stronger relationship evidence.' },
    relationEndpoints: { zh: '关系端点', en: 'Relation endpoints' },
    claimObject: { zh: '主张对象', en: 'Claim object' },
    claimQualifiers: { zh: '主张限定信息', en: 'Claim qualifiers' },
    evidenceItem: { zh: '证据 {index}/{total}', en: 'Evidence {index}/{total}' },
    evidenceSource: { zh: '来源登记项', en: 'Source registry entry' },
    sourceRecordPlain: { zh: '原生记录', en: 'Native record' },
    nativeField: { zh: '原生字段', en: 'Native field' },
    sourceLocator: { zh: '来源定位符', en: 'Source locator' },
    snapshotId: { zh: '快照标识', en: 'Snapshot ID' },
    recordHash: { zh: '规范记录哈希', en: 'Canonical record hash' },
    extractionMethod: { zh: '提取方式', en: 'Extraction method' },
    supportAndRank: { zh: '支持类型 / 等级', en: 'Support / rank' },
    evidenceReferences: { zh: '{count} 条原始参考来源', en: '{count} source references' },
    evidenceQualifiers: { zh: '{count} 项原始限定信息', en: '{count} source qualifiers' },
    referenceLink: { zh: '参考链接 {index}', en: 'Reference link {index}' },
    noQualifiers: { zh: '无主张限定信息', en: 'No claim qualifiers' },
    fixtureOnly: { zh: '仅夹具', en: 'Fixture only' },
    notImplemented: { zh: '未实现', en: 'Not implemented' },
    tested: { zh: '已测试', en: 'Tested' },
    productionReady: { zh: '可生产', en: 'Production ready' },
    rawRelation: { zh: '原始 student_of_recorded 候选', en: 'Raw student_of_recorded candidate' },
    themeToggleAriaDark: { zh: '切换深色模式', en: 'Switch to dark mode' },
    themeToggleAriaLight: { zh: '切换浅色模式', en: 'Switch to light mode' },
    themeToggleTitleDark: { zh: '深色模式', en: 'Dark mode' },
    themeToggleTitleLight: { zh: '浅色模式', en: 'Light mode' },
    langToggleAria: { zh: 'Switch to English', en: '切换到中文' },
  };

  const ENUMS = {
    entity_type: {
      work: { zh: '建筑', en: 'Work' },
      person: { zh: '人物', en: 'Person' },
      practice: { zh: '事务所', en: 'Practice' },
      place: { zh: '地点', en: 'Place' },
      relation: { zh: '关系', en: 'Relation' },
    },
    region: {
      east_asia: { zh: '东亚', en: 'East Asia' },
      south_asia: { zh: '南亚', en: 'South Asia' },
      southeast_asia: { zh: '东南亚', en: 'Southeast Asia' },
      central_west_asia: { zh: '中亚与西亚', en: 'Central & West Asia' },
      africa: { zh: '非洲', en: 'Africa' },
      europe: { zh: '欧洲', en: 'Europe' },
      north_america: { zh: '北美洲', en: 'North America' },
      latin_america_caribbean: { zh: '拉丁美洲与加勒比', en: 'Latin America & Caribbean' },
      oceania: { zh: '大洋洲', en: 'Oceania' },
      unknown: { zh: '区域待补', en: 'Region pending' },
    },
    verification_status: {
      candidate: { zh: '候选', en: 'Candidate' },
      verified: { zh: '已核验', en: 'Verified' },
      contested: { zh: '有争议', en: 'Contested' },
      declined: { zh: '已拒绝', en: 'Declined' },
    },
    work_type: {
      building: { zh: '建筑物', en: 'Building' },
      building_complex: { zh: '建筑群', en: 'Building complex' },
      infrastructure: { zh: '基础设施', en: 'Infrastructure' },
      landscape: { zh: '景观', en: 'Landscape' },
      urban_plan: { zh: '城市规划', en: 'Urban plan' },
      unknown: { zh: '类型未知', en: 'Type unknown' },
    },
    work_type_mapping_status: {
      mapped_exact: { zh: '精确映射', en: 'Exact mapping' },
      ambiguous: { zh: '含混', en: 'Ambiguous' },
      unmapped: { zh: '未映射', en: 'Unmapped' },
    },
    period: {
      before_1000: { zh: '1000 年以前', en: 'Before 1000' },
      '1000_1499': { zh: '1000–1499', en: '1000–1499' },
      '1500_1799': { zh: '1500–1799', en: '1500–1799' },
      '1800_1918': { zh: '1800–1918', en: '1800–1918' },
      '1919_1945': { zh: '1919–1945', en: '1919–1945' },
      '1946_1979': { zh: '1946–1979', en: '1946–1979' },
      '1980_1999': { zh: '1980–1999', en: '1980–1999' },
      '2000_present': { zh: '2000–至今', en: '2000–present' },
      unknown: { zh: '时期未知', en: 'Period unknown' },
    },
    name_zh_status: {
      source_label_candidate: { zh: '来源中文名候选', en: 'Candidate source Chinese label' },
      missing: { zh: '中文来源名缺失', en: 'Source Chinese label missing' },
      reviewed: { zh: '中文名已复核', en: 'Chinese label reviewed' },
    },
    role: {
      architect: { zh: '建筑师', en: 'Architect' },
    },
    rejection_reason: {
      missing_english_label: { zh: '缺少英文来源名', en: 'Missing English source label' },
    },
    scope: {
      architecture: { zh: '建筑', en: 'Architecture' },
      archives: { zh: '档案', en: 'Archives' },
      authorities: { zh: '权威实体', en: 'Authorities' },
      authors: { zh: '作者', en: 'Authors' },
      bibliography: { zh: '书目', en: 'Bibliography' },
      citations: { zh: '引文', en: 'Citations' },
      collections: { zh: '馆藏', en: 'Collections' },
      coordinates: { zh: '坐标', en: 'Coordinates' },
      coverage_control: { zh: '覆盖控制', en: 'Coverage control' },
      credits: { zh: '署名', en: 'Credits' },
      curriculum: { zh: '课程', en: 'Curriculum' },
      dates: { zh: '日期', en: 'Dates' },
      digital_objects: { zh: '数字对象', en: 'Digital objects' },
      doi: { zh: 'DOI', en: 'DOI' },
      external_ids: { zh: '外部标识', en: 'External IDs' },
      global_survey: { zh: '全球综述', en: 'Global survey' },
      historic_names: { zh: '历史名称', en: 'Historic names' },
      institutions: { zh: '机构', en: 'Institutions' },
      landscape: { zh: '景观', en: 'Landscape' },
      materials: { zh: '材料', en: 'Materials' },
      media_candidates: { zh: '媒体候选', en: 'Media candidates' },
      muslim_societies: { zh: '穆斯林社会', en: 'Muslim societies' },
      names: { zh: '名称', en: 'Names' },
      people: { zh: '人物', en: 'People' },
      periodicals: { zh: '期刊', en: 'Periodicals' },
      place_hierarchy: { zh: '地点层级', en: 'Place hierarchy' },
      places: { zh: '地点', en: 'Places' },
      planning: { zh: '规划', en: 'Planning' },
      practices: { zh: '事务所', en: 'Practices' },
      preservation: { zh: '保护', en: 'Preservation' },
      project_history: { zh: '项目历史', en: 'Project history' },
      publications: { zh: '出版物', en: 'Publications' },
      references: { zh: '参考文献', en: 'References' },
      relationships: { zh: '关系', en: 'Relationships' },
      retractions: { zh: '撤稿', en: 'Retractions' },
      roles: { zh: '角色', en: 'Roles' },
      sites: { zh: '建筑地点', en: 'Sites' },
      styles: { zh: '风格', en: 'Styles' },
      techniques: { zh: '技术', en: 'Techniques' },
      topics: { zh: '主题', en: 'Topics' },
      updates: { zh: '更新', en: 'Updates' },
      work_names: { zh: '作品名称', en: 'Work names' },
      work_types: { zh: '作品类型', en: 'Work types' },
      works: { zh: '作品', en: 'Works' },
    },
    adapter_status: {
      fixture_only: { zh: '仅夹具', en: 'Fixture only' },
      not_implemented: { zh: '未实现', en: 'Not implemented' },
      tested: { zh: '已测试', en: 'Tested' },
      production_ready: { zh: '可生产', en: 'Production ready' },
      discovery_only: { zh: '仅用于发现', en: 'Discovery only' },
      blocked_bulk: { zh: '批量接入受阻', en: 'Bulk access blocked' },
    },
    reuse_class: {
      structured_ingest_allowed: { zh: '允许结构化接入', en: 'Structured ingest allowed' },
      metadata_ingest_only: { zh: '仅元数据接入', en: 'Metadata ingest only' },
      unknown_fail_closed: { zh: '权利未知，拒绝接入', en: 'Unknown rights, fail closed' },
      discovery_and_citation_only: { zh: '仅发现与引用', en: 'Discovery and citation only' },
    },
    relation_type: {
      student_of_recorded: { zh: '来源记录的学习关系候选', en: 'Source-recorded student relation candidate' },
    },
    predicate: {
      student_of_recorded: { zh: '来源记录的学习关系', en: 'Source-recorded student relation' },
      credited_contributor: { zh: '来源署名贡献者', en: 'Source-credited contributor' },
      unresolved_credited_contributor: { zh: '未解析来源署名', en: 'Unresolved source credit' },
      field_coordinates: { zh: '来源坐标', en: 'Source coordinates' },
      field_country_code: { zh: '来源国家代码', en: 'Source country code' },
      field_name_en: { zh: '英文来源名', en: 'English source label' },
      field_name_zh: { zh: '中文来源名', en: 'Chinese source label' },
      field_work_type: { zh: '来源作品类型', en: 'Source work type' },
      source_name_en: { zh: '英文来源名', en: 'English source label' },
      source_name_zh: { zh: '中文来源名', en: 'Chinese source label' },
      source_coordinates: { zh: '来源坐标', en: 'Source coordinates' },
      source_country_code: { zh: '来源国家代码', en: 'Source country code' },
      source_work_type: { zh: '来源作品类型', en: 'Source work type' },
      source_architect_credit: { zh: '来源建筑师署名', en: 'Source architect credit' },
      source_inception: { zh: '来源成立 / 起始时间', en: 'Source inception date' },
      source_official_opening: { zh: '来源正式开放时间', en: 'Source official opening date' },
    },
  };

  let language = 'zh';

  function t(key, vars) {
    const value = STRINGS[key];
    let text = value ? value[language] : key;
    if (vars) {
      Object.keys(vars).forEach(function (name) {
        text = text.replaceAll('{' + name + '}', String(vars[name]));
      });
    }
    return text;
  }

  function enumLabel(group, value) {
    const row = ENUMS[group] && ENUMS[group][value];
    return row ? row[language] : (value == null || value === '' ? t('unknown') : String(value));
  }

  function pick(zh, en) {
    if (language === 'zh') return zh || en || t('unknown');
    return en || zh || t('unknown');
  }

  function name(entity) {
    return pick(entity && entity.name_zh, entity && entity.name_en);
  }

  function secondaryName(entity) {
    if (!entity) return '';
    const primary = name(entity);
    const alternate = language === 'zh' ? entity.name_en : entity.name_zh;
    return alternate && alternate !== primary ? alternate : '';
  }

  function isDark() {
    return document.documentElement.classList.contains('dark');
  }

  function applyThemeUi() {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    const dark = isDark();
    button.setAttribute('aria-label', t(dark ? 'themeToggleAriaLight' : 'themeToggleAriaDark'));
    button.setAttribute('title', t(dark ? 'themeToggleTitleLight' : 'themeToggleTitleDark'));
  }

  function applyStatic() {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = t('pageTitle');
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', t('metaDescription'));
    document.querySelectorAll('[data-i18n]').forEach(function (element) {
      const key = element.getAttribute('data-i18n');
      if (STRINGS[key]) element.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (element) {
      element.setAttribute('placeholder', t(element.getAttribute('data-i18n-placeholder')));
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(function (element) {
      element.setAttribute('aria-label', t(element.getAttribute('data-i18n-aria-label')));
    });
    const langButton = document.getElementById('lang-toggle');
    if (langButton) {
      langButton.textContent = language === 'zh' ? 'EN' : '中';
      langButton.setAttribute('aria-label', t('langToggleAria'));
      langButton.setAttribute('title', language === 'zh' ? 'English' : '中文');
    }
    applyThemeUi();
  }

  function setLanguage(next) {
    language = next === 'en' ? 'en' : 'zh';
    try { localStorage.setItem(LANG_KEY, language); } catch (_) {}
    applyStatic();
    window.dispatchEvent(new CustomEvent('architecturehistory:languagechange', {
      detail: { language: language },
    }));
  }

  function toggleLanguage() {
    setLanguage(language === 'zh' ? 'en' : 'zh');
  }

  function setTheme(dark) {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (_) {}
    applyThemeUi();
    window.dispatchEvent(new CustomEvent('architecturehistory:themechange', {
      detail: { dark: dark },
    }));
  }

  function wire() {
    const langButton = document.getElementById('lang-toggle');
    if (langButton) langButton.addEventListener('click', toggleLanguage);
    const themeButton = document.getElementById('theme-toggle');
    if (themeButton) themeButton.addEventListener('click', function () {
      setTheme(!isDark());
    });
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (event) {
        if (!localStorage.getItem(THEME_KEY)) setTheme(event.matches);
      });
    } catch (_) {}
  }

  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'zh' || saved === 'en') language = saved;
  } catch (_) {}

  document.addEventListener('DOMContentLoaded', function () {
    applyStatic();
    wire();
  });

  window.ARCH_I18N = {
    STRINGS: STRINGS,
    ENUMS: ENUMS,
    t: t,
    enumLabel: enumLabel,
    pick: pick,
    name: name,
    secondaryName: secondaryName,
    getLanguage: function () { return language; },
    setLanguage: setLanguage,
    applyStatic: applyStatic,
  };
})();
