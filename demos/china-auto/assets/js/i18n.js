/* Bilingual labels + enum maps. window.CHINA_AUTO_I18N */
(function () {
  'use strict';
  var KEY = 'china-auto-lang';
  var lang = 'zh';
  try { var s = localStorage.getItem(KEY); if (s === 'en' || s === 'zh') lang = s; } catch (e) {}
  var listeners = [];

  var L = {
    zh: {
      skipToContent: '跳到主要内容',
      primaryNav: '主要导航', closeDialog: '关闭对话框', cityTabs: '城市详情分区',
      navBrand: '汽车城市图谱',
      navOverview: '概览', navMap: '地图', navCatalog: '城市目录', navClusters: '产业集群',
      navOrgs: '企业', navInstitutions: '高校院所', navMedia: '媒体', navMethodology: '方法',
      errTitle: '数据加载失败',
      errBody: '本页通过 fetch 读取 JSON，需经 HTTP(S) 提供（不能用 file:// 直接打开）。请用本地服务器访问。',
      heroEyebrow: '产量不是全部实力 · output is not the whole story',
      heroTitle: '中国汽车城市图谱',
      heroSub: '以城市为节点，把整车产量、产业集群、总部与研发、工厂与供应链、高校院所与汽车媒体放在同一张图上——看清一座城在汽车产业链里扮演什么角色。',
      heroV1: '覆盖 17 座核心城市 + 11 座专长城市、168 家企业与机构；每家企业均收录总部城市，并完成成立、所有制、上市、员工、销量、工厂六字段审计。',
      heroOutput: '28 城均有2025产量逐字段调查记录；只有链接到城市官方口径的已核实总产量进入排序，未披露或待核项明确留空。',
      heroLocation: '自 2025 年起，产量按实际生产地归属，而非企业总部所在地。',
      heroRoles: '总部、研发、工厂、供应链、媒体是不同角色——同一企业可在多城出现。',
      heroNote: '研究性演示，非投资建议。末次审阅：2026-09。',
      ovTitle: '概览', ovChart: '2025 已核实整车产量（万辆）',
      kpiCities: '城市', kpiOrgs: '企业/机构', kpiFacilities: '设施站点', kpiClusters: '产业集群', kpiOutputCities: '有外部来源产量城市',
      mapTitle: '中国城市地图', mapSub: '按产量、集群或主角色着色；可筛选角色标签、集群与层级。点击标记打开城市详情。',
      mapTouchEnable: '移动地图', mapTouchDisable: '锁定地图（可滚动页面）',
      graphTouchEnable: '移动关系图', graphTouchDisable: '锁定关系图（可滚动页面）',
      dimOutput: '产量', dimCluster: '集群', dimRole: '主角色',
      layerCities: '城市', layerFacilities: '设施',
      allRoles: '全部角色', allClusters: '全部集群', allTiers: '全部层级', reset: '重置',
      catTitle: '城市目录', catSearch: '搜索城市（拼音 / 首字母 / 简写，如 bj、shanghai）…',
      thCity: '城市', thProvince: '省份', thTier: '层级', thOutput: '2025产量(万辆)', thNev: 'NEV(万辆)',
      thRoles: '角色标签', thOrgs: '企业数',
      clustersTitle: '产业集群',
      clustersSub: '全国一张图：颜色是集群属性，形状区分城市 / 集团 / 品牌 / 已建档工厂；点线表示候选、目录关联、代工等非直接运营边，不把关系线伪装成实体工厂。',
      clusterAll: '全部集群', clusterLayerHq: '总部企业', clusterLayerBrands: '品牌', clusterLayerPlants: '工厂 / 制造',
      graphCity: '城市', graphCluster: '集群配色', graphHq: '集团', graphBrand: '品牌', graphPlant: '已建档工厂',
      clusterGraphHint: '颜色=集群 · 圆=城市 · 方=集团 · 小方=品牌 · 菱形=已建档工厂 · 点线=候选/关联/代工等非直接运营边',
      clusterGraphAria: '中国产业集群、城市、企业与制造关系图；候选、目录关联、代工等非直接运营边以点线表示。',
      clusterFocusTip: '图例可强调该颜色，不隐藏其他城市',
      clusterFocusing: '强调',
      clusterCardHint: '强调此颜色，其他城市仍可见',
      clusterCardOn: '再次点击取消强调',
      output2025: '2025产量', wanVehicles: '万辆',
      countHq: '整车/配套', countBrands: '品牌', countPlants: '工厂/制造', countMedia: '媒体', countUnis: '高校',
      orgsTitle: '企业与机构目录', orgsSub: '整车、品牌、高校、媒体在同一张可滚动表里。字段区分已核实、未披露、不适用与待核；品牌不得借用母公司代码，集团口径会明确标注；工厂数中的 * 表示低置信设施或候选制造关系。',
      orgSearch: '搜索企业（BYD / byd / 比亚迪 / 北汽 / 一汽）…', allTypes: '全部',
      thName: '名称', thType: '类型', thParent: '母公司', thHq: '总部城市',
      thFounded: '成立', thOwnership: '所有制', thListing: '上市', thEmployees: '员工',
      thSales: '销量', thPlants: '工厂/制造点', thPowertrain: '动力', thSegment: '定位', thExport: '出口',
      thChildren: '旗下',
      colGroupIdentity: '身份', colGroupScale: '规模', colGroupProduct: '产品', colGroupNetwork: '网络',
      colGroupsLabel: '显示列',
      parentBrand: '母公司', childBrands: '旗下品牌',
      globalSearch: '搜索城市或企业（拼音 / 首字母 / 简写）…',
      searchCities: '城市', searchOrgs: '企业', searchBrands: '品牌', searchUnis: '高校', searchMedia: '媒体', searchNoResult: '无匹配',
      hqUnknown: '总部城市待补',
      instTitle: '高校与科研院所', instSub: '汽车相关专业与产学研合作线索。',
      mediaTitle: '汽车媒体', mediaSub: '按采编城市与媒体类型浏览。',
      meTitle: '方法与来源', meSummary: '数据范围、统计口径与来源分级',
      meScopeWarn: '只接受可解析的外部来源；QROST 自有研究简报不作为证据。产量口径因城市而异，候选记录不进入已核实排行。',
      meStatusGuide: '六字段逐项采用六种审计状态：已核实、部分核实、未找到独立披露、不适用、未单独上市、待核。状态表达当前证据结论，不用推测补空。',
      meAxesGuide: '行级的实体身份置信度与字段级审计状态是两条独立轴：候选身份不等于六个字段全部待核，高置信实体也可以有未披露字段。',
      meSalesGuard: '销量行可分别采用集团、上市主体、品牌、批发或交付口径，并可嵌套或重叠；因此不得跨行相加，也不用于推导城市产量。',
      meFacilityGuard: '一条设施记录对应一个物理园区；运营法人与目录中的集团/品牌必须分开。相同边界、关联子公司/分支、尚未解析依次标为直接运营、目录关联、运营边界待核实。',
      thSource: '来源', thSupportScope: '支持范围', thGrade: '等级', thPublisher: '发布方', thType: '类型', thDate: '日期',
      footUpdated: 'Last updated 2026-09.',
      footDisclaimer: 'Nothing here is financial, legal or tax advice.',
      noData: '暂无数据', loading: '加载中…', sources: '来源', confidence: '置信度', candidate: '候选',
      statusVerified: '已核实', statusUnverified: '待核', statusNotDisclosed: '未找到独立披露', statusNotApplicable: '不适用',
      statusNotSeparatelyListed: '未单独上市', statusPartial: '部分核实', parentScope: '集团口径', childrenScope: '旗下口径', parentListed: '母公司上市', openSource: '打开来源',
      scopeShort: '口径', scopeSeeAudit: '详见审计边界与说明', auditScopeCount: '审计口径数', approxPrefix: '约', secondarySource: '二手来源，部分核实', nonAdditiveSales: '非可加总销量：不得与其他行相加', candidatePlantNote: '* 为低置信设施或尚未落实到具体厂名的候选制造关系',
      runtimeWarnTitle: '部分可视化组件未加载',
      echartsFallback: '图表 CDN 未加载；目录、筛选、详情和来源仍可使用。',
      chartUnavailable: '图表暂不可用；请使用下方目录和来源表。',
      tabOverview: '概览', tabOrgs: '企业与角色', tabFacilities: '设施',
      tabInstMedia: '院所与媒体', tabRelations: '关系', tabStats: '统计与来源',
      summary: '摘要', history: '沿革', districts: '辖区', roleTags: '角色标签',
      facilities: '设施', institutions: '高校院所', media: '媒体', relations: '关系',
      stats: '产量统计', statisticalScope: '统计口径', nev: '新能源', commercial: '商用车', passenger: '乘用车',
      viewCity: '查看城市', viewOrg: '查看机构', hqCity: '总部城市', founded: '成立', website: '网站', status: '状态',
      operator: '运营方', operatorBoundaryPending: '运营边界待核实', workingTranslation: '（工作译名）', catalogRelation: '目录关联', associatedOrganizations: '关联组织', manufacturesFor: '合同生产关联', address: '地址', siteScope: '园区边界说明', facilityType: '类型', opened: '启用', products: '产品',
      nationalPlatform: '全国性平台', editorialCity: '采编城市', registeredCity: '注册城市',
      strengths: '优势方向', partners: '产业合作', school: '院校', college: '学院',
      outputNote: '产量说明', citiesInCluster: '覆盖城市',
      tier_core: '核心', tier_specialist: '专长',
      langToggle: '切换语言', themeToggle: '切换主题'
    },
    en: {
      skipToContent: 'Skip to main content',
      primaryNav: 'Primary navigation', closeDialog: 'Close dialog', cityTabs: 'City detail sections',
      navBrand: 'Auto City Atlas',
      navOverview: 'Overview', navMap: 'Map', navCatalog: 'Cities', navClusters: 'Clusters',
      navOrgs: 'Organizations', navInstitutions: 'Universities', navMedia: 'Media', navMethodology: 'Method',
      errTitle: 'Data failed to load',
      errBody: 'This page fetches JSON and must be served over HTTP(S) (not opened via file://). Use a local server.',
      heroEyebrow: '产量不是全部实力 · output is not the whole story',
      heroTitle: 'China Auto City Atlas',
      heroSub: 'Cities as nodes — vehicle output, industrial clusters, HQ & R&D, plants & supply chain, universities and auto media on one map. See what role each city plays in the automotive chain.',
      heroV1: 'Covers 17 core + 11 specialist cities and 168 organizations. Every organization records an HQ city and a six-field audit of founding, ownership, listing, staff, sales and plants.',
      heroOutput: 'All 28 cities have field-level 2025 output research. Only verified totals linked to an official city scope enter the ranking; undisclosed or pending fields stay explicitly empty.',
      heroLocation: 'From 2025, output is attributed to actual production location, not company HQ.',
      heroRoles: 'HQ, R&D, plants, supply and media are separate roles — one firm can span many cities.',
      heroNote: 'Research demo, not investment advice. Last reviewed 2026-09.',
      ovTitle: 'Overview', ovChart: 'Verified 2025 vehicle output (10k units)',
      kpiCities: 'Cities', kpiOrgs: 'Organizations', kpiFacilities: 'Facilities', kpiClusters: 'Clusters', kpiOutputCities: 'Cities with externally sourced output',
      mapTitle: 'China city map', mapSub: 'Color by output, cluster or primary role. Filter by role tag, cluster and tier. Click a marker for city detail.',
      mapTouchEnable: 'Move map', mapTouchDisable: 'Lock map (scroll page)',
      graphTouchEnable: 'Move graph', graphTouchDisable: 'Lock graph (scroll page)',
      dimOutput: 'Output', dimCluster: 'Cluster', dimRole: 'Primary role',
      layerCities: 'Cities', layerFacilities: 'Facilities',
      allRoles: 'All roles', allClusters: 'All clusters', allTiers: 'All tiers', reset: 'Reset',
      catTitle: 'City catalog', catSearch: 'Search cities (pinyin / initials / alias, e.g. bj, shanghai)…',
      thCity: 'City', thProvince: 'Province', thTier: 'Tier', thOutput: '2025 output (10k)', thNev: 'NEV (10k)',
      thRoles: 'Role tags', thOrgs: 'Orgs',
      clustersTitle: 'Industrial clusters',
      clustersSub: 'One national graph: color marks clusters; shapes distinguish cities, groups, brands and cataloged plants. Dotted links mark non-direct-operator edges such as candidates, catalog associations and contract manufacturing; they are not facility records.',
      clusterAll: 'All clusters', clusterLayerHq: 'HQ firms', clusterLayerBrands: 'Brands', clusterLayerPlants: 'Plants / manufacturing',
      graphCity: 'City', graphCluster: 'Cluster color', graphHq: 'Group', graphBrand: 'Brand', graphPlant: 'Cataloged plant',
      clusterGraphHint: 'Color = cluster · circle = city · square = group · small square = brand · diamond = cataloged plant · dotted = candidate / association / contract-manufacturing edge',
      clusterGraphAria: 'Graph of Chinese auto clusters, cities, organizations and manufacturing links; dotted lines mark non-direct-operator edges such as candidates, catalog associations and contract manufacturing.',
      clusterFocusTip: 'Legend emphasizes that color without hiding the rest of China',
      clusterFocusing: 'Emphasizing',
      clusterCardHint: 'Emphasize this color; other cities stay visible',
      clusterCardOn: 'Click again to clear emphasis',
      output2025: '2025 output', wanVehicles: '10k units',
      countHq: 'OEM / supply', countBrands: 'brands', countPlants: 'plants / manufacturing', countMedia: 'media', countUnis: 'universities',
      orgsTitle: 'Organization catalog', orgsSub: 'Automakers, brands, universities and media in one scrollable table. Fields distinguish verified, undisclosed, not applicable and pending review. Brands never borrow parent tickers; group-scope values are labeled; * in plant counts marks low-confidence facilities or candidate manufacturing links.',
      orgSearch: 'Search orgs (BYD / byd / 比亚迪 / FAW / 一汽)…', allTypes: 'All',
      thName: 'Name', thType: 'Type', thParent: 'Parent', thHq: 'HQ city',
      thFounded: 'Founded', thOwnership: 'Ownership', thListing: 'Listing', thEmployees: 'Employees',
      thSales: 'Sales', thPlants: 'Plants / sites', thPowertrain: 'Powertrain', thSegment: 'Segment', thExport: 'Export',
      thChildren: 'Brands',
      colGroupIdentity: 'Identity', colGroupScale: 'Scale', colGroupProduct: 'Product', colGroupNetwork: 'Network',
      colGroupsLabel: 'Columns',
      parentBrand: 'Parent', childBrands: 'Brands',
      globalSearch: 'Search cities or companies (pinyin / initials / alias)…',
      searchCities: 'Cities', searchOrgs: 'Companies', searchBrands: 'Brands', searchUnis: 'Universities', searchMedia: 'Media', searchNoResult: 'No matches',
      hqUnknown: 'HQ city pending',
      instTitle: 'Universities & research institutes', instSub: 'Automotive programs and industry partnership leads.',
      mediaTitle: 'Auto media', mediaSub: 'Browse by editorial city and media type.',
      meTitle: 'Method & sources', meSummary: 'Coverage, statistical scope and source grading',
      meScopeWarn: 'Only resolvable external sources count as evidence; QROST-authored research briefs do not. Output scope varies by city, and candidate records are excluded from the verified ranking.',
      meStatusGuide: 'Each of the six organization fields uses one of six audit states: verified, partly verified, no standalone disclosure found, N/A, not separately listed, or pending review. The state records the present evidence conclusion; gaps are not guessed away.',
      meAxesGuide: 'Row-level entity-identity confidence and field-level audit status are independent axes: a candidate identity does not make all six fields pending, while a high-confidence entity may still have undisclosed fields.',
      meSalesGuard: 'Sales rows may use group, issuer, brand, wholesale or delivery scopes, and those scopes may overlap or nest. Never add sales across rows or use them to derive city output.',
      meFacilityGuard: 'One facility record represents one physical campus; the operating legal entity is kept separate from a catalog group or brand. Matching boundary, related subsidiary/branch and unresolved evidence are shown respectively as direct operation, catalog relation and operator boundary pending.',
      thSource: 'Source', thSupportScope: 'Support scope', thGrade: 'Grade', thPublisher: 'Publisher', thType: 'Type', thDate: 'Date',
      footUpdated: 'Last updated 2026-09.',
      footDisclaimer: 'Nothing here is financial, legal or tax advice.',
      noData: 'No data yet', loading: 'Loading…', sources: 'Sources', confidence: 'Confidence', candidate: 'Candidate',
      statusVerified: 'Verified', statusUnverified: 'Pending review', statusNotDisclosed: 'No standalone disclosure found', statusNotApplicable: 'N/A',
      statusNotSeparatelyListed: 'Not separately listed', statusPartial: 'Partly verified', parentScope: 'Group scope', childrenScope: 'Subsidiary scope', parentListed: 'Parent listed', openSource: 'Open source',
      scopeShort: 'Scope', scopeSeeAudit: 'See audit boundary and notes', auditScopeCount: 'Audit-scope count', approxPrefix: '≈', secondarySource: 'Secondary source; partly verified', nonAdditiveSales: 'Non-additive sales: never sum with another row', candidatePlantNote: '* marks a low-confidence facility or a candidate manufacturing link without a cataloged plant name',
      runtimeWarnTitle: 'Some visualization components did not load',
      echartsFallback: 'The chart CDN did not load; catalogs, filters, details and sources remain available.',
      chartUnavailable: 'Chart unavailable; use the catalogs and source table below.',
      tabOverview: 'Overview', tabOrgs: 'Orgs & roles', tabFacilities: 'Facilities',
      tabInstMedia: 'Institutions & media', tabRelations: 'Relations', tabStats: 'Stats & sources',
      summary: 'Summary', history: 'History', districts: 'Districts', roleTags: 'Role tags',
      facilities: 'Facilities', institutions: 'Institutions', media: 'Media', relations: 'Relations',
      stats: 'Output statistics', statisticalScope: 'Statistical scope', nev: 'NEV', commercial: 'Commercial', passenger: 'Passenger',
      viewCity: 'View city', viewOrg: 'View organization', hqCity: 'HQ city', founded: 'Founded', website: 'Website', status: 'Status',
      operator: 'Operator', operatorBoundaryPending: 'Operator boundary pending', workingTranslation: '(working translation)', catalogRelation: 'Catalog relation', associatedOrganizations: 'Associated organizations', manufacturesFor: 'Manufactures for', address: 'Address', siteScope: 'Campus boundary note', facilityType: 'Type', opened: 'Opened', products: 'Products',
      nationalPlatform: 'National platform', editorialCity: 'Editorial city', registeredCity: 'Registered city',
      strengths: 'Strengths', partners: 'Industry partners', school: 'School', college: 'College',
      outputNote: 'Output note', citiesInCluster: 'Cities',
      tier_core: 'Core', tier_specialist: 'Specialist',
      langToggle: 'Toggle language', themeToggle: 'Toggle theme'
    }
  };

  var ENUM = {
    role_tag: {
      oem_manufacturing: { zh: '整车制造', en: 'OEM manufacturing' },
      headquarters: { zh: '总部', en: 'Headquarters' },
      rd_design: { zh: '研发设计', en: 'R&D / design' },
      autonomous_driving: { zh: '自动驾驶', en: 'Autonomous driving' },
      auto_software: { zh: '汽车软件', en: 'Auto software' },
      chips: { zh: '芯片', en: 'Chips' },
      battery: { zh: '动力电池', en: 'Battery' },
      auto_electronics: { zh: '汽车电子', en: 'Auto electronics' },
      parts: { zh: '零部件', en: 'Parts' },
      testing: { zh: '检测认证', en: 'Testing / certification' },
      higher_education: { zh: '高等教育', en: 'Higher education' },
      auto_media: { zh: '汽车媒体', en: 'Auto media' },
      expo_culture: { zh: '会展文化', en: 'Expo / culture' },
      export_logistics: { zh: '出口物流', en: 'Export / logistics' },
      auto_history: { zh: '汽车历史', en: 'Auto history' }
    },
    organization_type: {
      automaker: { zh: '整车企业', en: 'Automaker' },
      brand: { zh: '品牌', en: 'Brand' },
      supplier: { zh: '供应商', en: 'Supplier' },
      battery_company: { zh: '电池企业', en: 'Battery company' },
      software_company: { zh: '软件公司', en: 'Software company' },
      chip_company: { zh: '芯片公司', en: 'Chip company' },
      research_institute: { zh: '科研院所', en: 'Research institute' },
      university: { zh: '高校', en: 'University' },
      media_company: { zh: '媒体公司', en: 'Media company' },
      industry_association: { zh: '行业协会', en: 'Industry association' },
      testing_body: { zh: '检测机构', en: 'Testing body' }
    },
    ownership: {
      soe: { zh: '国企', en: 'SOE' },
      private: { zh: '民营', en: 'Private' },
      foreign: { zh: '外资', en: 'Foreign' },
      jv: { zh: '合资', en: 'JV' },
      public: { zh: '公办', en: 'Public' },
      nonprofit: { zh: '非营利组织', en: 'Nonprofit' },
      mixed: { zh: '混合', en: 'Mixed' },
      unknown: { zh: '未知', en: 'Unknown' }
    },
    exchange: {
      SIX: { zh: '瑞士证券交易所', en: 'SIX Swiss Exchange' }
    },
    powertrain: {
      ice: { zh: '燃油', en: 'ICE' },
      hev: { zh: 'HEV', en: 'HEV' },
      phev: { zh: '插混', en: 'PHEV' },
      bev: { zh: '纯电', en: 'BEV' },
      reev: { zh: '增程', en: 'REEV' },
      fcev: { zh: '氢燃料', en: 'FCEV' }
    },
    segment: {
      mass: { zh: '大众', en: 'Mass' },
      premium: { zh: '中高端', en: 'Premium' },
      luxury: { zh: '豪华', en: 'Luxury' },
      commercial: { zh: '商用', en: 'Commercial' },
      bus: { zh: '客车', en: 'Bus' },
      truck: { zh: '卡车', en: 'Truck' },
      parts: { zh: '零部件', en: 'Parts' },
      battery: { zh: '电池', en: 'Battery' },
      software: { zh: '软件', en: 'Software' },
      education: { zh: '高校', en: 'Education' },
      media: { zh: '媒体', en: 'Media' },
      testing: { zh: '检测', en: 'Testing' }
    },
    export_role: {
      none: { zh: '低', en: 'Low' },
      some: { zh: '中', en: 'Some' },
      major: { zh: '高', en: 'Major' },
      unknown: { zh: '未知', en: 'Unknown' }
    },
    education_tag: {
      '985': { zh: '985', en: '985' },
      '211': { zh: '211', en: '211' },
      double_first_class: { zh: '双一流', en: 'Double First-Class' }
    },
    facility_type: {
      headquarters_campus: { zh: '总部园区', en: 'HQ campus' },
      vehicle_plant: { zh: '整车工厂', en: 'Vehicle plant' },
      engine_plant: { zh: '发动机厂', en: 'Engine plant' },
      battery_plant: { zh: '电池工厂', en: 'Battery plant' },
      parts_plant: { zh: '零部件厂', en: 'Parts plant' },
      rd_center: { zh: '研发中心', en: 'R&D center' },
      design_center: { zh: '设计中心', en: 'Design center' },
      testing_center: { zh: '试验中心', en: 'Testing center' },
      port_terminal: { zh: '港口码头', en: 'Port terminal' }
    },
    facility_status: {
      active: { zh: '运营中', en: 'Active' },
      planned: { zh: '规划中', en: 'Planned' },
      under_construction: { zh: '建设中', en: 'Under construction' },
      paused: { zh: '暂停', en: 'Paused' },
      closed: { zh: '关闭', en: 'Closed' },
      converted: { zh: '已转型', en: 'Converted' },
      unknown: { zh: '未知', en: 'Unknown' }
    },
    role_type: {
      headquarters: { zh: '总部', en: 'Headquarters' },
      registered_office: { zh: '注册地', en: 'Registered office' },
      regional_headquarters: { zh: '区域总部', en: 'Regional HQ' },
      rd_center: { zh: '研发中心', en: 'R&D center' },
      design_center: { zh: '设计中心', en: 'Design center' },
      factory: { zh: '工厂', en: 'Factory' },
      supplier_plant: { zh: '供应工厂', en: 'Supplier plant' },
      testing_center: { zh: '试验中心', en: 'Testing center' },
      media_editorial_office: { zh: '采编中心', en: 'Editorial office' },
      university_campus: { zh: '高校校区', en: 'University campus' },
      event_host: { zh: '赛事/活动', en: 'Event host' },
      historical_origin: { zh: '历史起源', en: 'Historical origin' }
    },
    relation_type: {
      owns: { zh: '拥有', en: 'Owns' },
      operates: { zh: '运营', en: 'Operates' },
      supplies: { zh: '供应', en: 'Supplies' },
      joint_venture_with: { zh: '合资', en: 'Joint venture' },
      researches_with: { zh: '联合研发', en: 'Co-research' },
      exports_through: { zh: '出口通道', en: 'Exports through' },
      located_in: { zh: '位于', en: 'Located in' },
      belongs_to_cluster: { zh: '归属集群', en: 'Belongs to cluster' },
      cluster_adjacent: { zh: '集群相邻', en: 'Cluster adjacent' },
      historically_linked_to: { zh: '历史关联', en: 'Historical link' },
      replaced_by: { zh: '被替代', en: 'Replaced by' },
      competes_with: { zh: '竞品', en: 'Competes with' }
    },
    media_type: {
      portal: { zh: '门户', en: 'Portal' },
      trade_media: { zh: '行业媒体', en: 'Trade media' },
      nev_media: { zh: '新能源媒体', en: 'NEV media' },
      business_media: { zh: '商业媒体', en: 'Business media' },
      review_video: { zh: '评测视频', en: 'Review / video' },
      auto_culture: { zh: '汽车文化', en: 'Auto culture' },
      tuning: { zh: '改装', en: 'Tuning' },
      motorsport: { zh: '赛车', en: 'Motorsport' },
      local_community: { zh: '本地社区', en: 'Local community' }
    },
    city_tier: {
      core: { zh: '核心', en: 'Core' },
      specialist: { zh: '专长', en: 'Specialist' }
    },
    admin_level: {
      municipality: { zh: '直辖市', en: 'Municipality' },
      prefecture: { zh: '地级市', en: 'Prefecture' },
      county: { zh: '县级', en: 'County' },
      cooperation_zone: { zh: '合作区', en: 'Cooperation zone' }
    },
    source_grade: {
      A: { zh: 'A · 权威', en: 'A · Authoritative' },
      B: { zh: 'B · 可靠', en: 'B · Reliable' },
      C: { zh: 'C · 参考', en: 'C · Reference' },
      D: { zh: 'D · 待核', en: 'D · Unverified' }
    }
  };

  function t(k) { return (L[lang] && L[lang][k]) || L.zh[k] || k; }
  function isEn() { return lang === 'en'; }
  function pick(zh, en) { return isEn() ? (en || zh || '') : (zh || en || ''); }
  function name(o) {
    if (!o) return '';
    if (o.display_name_zh || o.display_name_en) return pick(o.display_name_zh, o.display_name_en);
    if (o.legal_name_zh || o.legal_name_en) return pick(o.legal_name_zh, o.legal_name_en);
    if (o.media_name_zh || o.media_name_en) return pick(o.media_name_zh, o.media_name_en);
    if (o.school_zh || o.school_en) return pick(o.school_zh, o.school_en);
    return pick(o.name_zh, o.name_en);
  }
  function enumLabel(group, val) {
    var g = ENUM[group]; if (!g || !g[val]) return val || '';
    return isEn() ? (g[val].en || g[val].zh) : (g[val].zh || g[val].en);
  }

  function applyLangToUI(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(function (el) {
      if (el.querySelector('svg')) return;
      var k = el.getAttribute('data-i18n'); var v = t(k); if (v) el.textContent = v;
    });
    (root || document).querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-html'); var v = t(k); if (v) el.innerHTML = v;
    });
    (root || document).querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-placeholder'); var v = t(k); if (v) el.setAttribute('placeholder', v);
    });
    (root || document).querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-aria-label'); var v = t(k); if (v) el.setAttribute('aria-label', v);
    });
    (root || document).querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-title'); var v = t(k); if (v) el.setAttribute('title', v);
    });
    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'zh');
    var tog = document.getElementById('lang-toggle');
    if (tog) {
      tog.textContent = isEn() ? '中' : 'EN';
      tog.setAttribute('title', isEn() ? '中文' : 'English');
      tog.setAttribute('aria-label', isEn() ? 'Switch to 中文' : 'Switch to English');
    }
  }
  function setLang(l) {
    if (l !== 'en' && l !== 'zh') return;
    lang = l; try { localStorage.setItem(KEY, l); } catch (e) {}
    applyLangToUI(); listeners.forEach(function (cb) { try { cb(); } catch (e) {} });
  }
  function toggleLang() { setLang(isEn() ? 'zh' : 'en'); }
  function onChange(cb) { listeners.push(cb); }

  window.CHINA_AUTO_I18N = {
    t: t, isEn: isEn, pick: pick, name: name, enumLabel: enumLabel,
    applyLangToUI: applyLangToUI, setLang: setLang, toggleLang: toggleLang, onChange: onChange,
    get lang() { return lang; }
  };
})();
