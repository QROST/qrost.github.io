/* Bilingual (zh default / en) labels + enum maps + language toggle. window.PHARM_I18N */
(function () {
  'use strict';
  var KEY = 'pharm-companies-lang';
  var lang = 'zh';
  try { var s = localStorage.getItem(KEY); if (s === 'en' || s === 'zh') lang = s; } catch (e) {}
  var listeners = [];

  var L = {
    zh: {
      navBrand: '全球医药图谱', navOverview: '概览', navMap: '地图', navCatalog: '企业',
      navModalities: '药物模态', navTrends: '研发趋势', navCountries: '国家对比',
      navBenchmarks: '对标', navMilestones: '里程碑', navCompare: '对比',
      errTitle: '数据加载失败', errBody: '本页通过 fetch 读取 JSON，需经 HTTP(S) 提供（不能用 file:// 直接打开）。请用本地服务器访问。',
      heroTitle: '全球医药行业图谱',
      heroSub: '用数据看全球医药版图：中国与美、欧、日、澳等国的医药企业，它们的地理布局、子公司与研发/生产站点、旗舰药物与在研管线、药物模态与治疗领域侧重，以及国家间的对比与中国对国际原研的突破。',
      heroNote: '研究性演示，数据带来源与置信度标注；非投资建议，数字以标注年份的公开披露为准。',
      ovTitle: '概览', ovChart: '按地区的企业与药物分布',
      kpiCompanies: '企业', kpiCountries: '国家/地区', kpiProducts: '收录药物', kpiBlockbusters: '重磅药(>$1B)', kpiSites: '全球站点',
      mapTitle: '全球站点地图', mapSub: '每个标记是一处企业站点（总部 / 研发 / 生产 / 商业）。按维度着色、按地区或模态筛选，点击查看企业。',
      reset: '重置',
      catTitle: '企业目录',
      modTitle: '药物模态分布', modSub: '从药物类型（小分子 / 单抗 / ADC / 双抗 / 细胞与基因治疗 / 疫苗 / 中药…）看收录药物的结构。点击扇区联动筛选。',
      trTitle: '研发与治疗领域趋势', trPhase: '在研管线按阶段', trTa: '治疗领域分布', trModality: '模态构成', trRegion: '中国 vs 世界（按地区）',
      coTitle: '国家对比', coSub: '各国医药市场规模、研发投入、监管机构与优势领域。勾选国家在雷达图中对比。', coRadar: '国家能力雷达',
      bmTitle: '中国 ↔ 国际对标', bmSub: '中国创新药/企业与其国际对标的并列对照。',
      msTitle: '突破里程碑', msSub: '值得记录的突破，尤其是中国创新药对国际原研的赶超与替代。',
      meTitle: '方法与来源', meSummary: '数据范围、置信度与来源说明',
      meBody: '<p>本页为研究性演示。首批覆盖约 50 家全球与中国医药企业（深度），后续按引用来源分批扩展。</p><p>每条记录带 <em>来源(sources)</em> 与 <em>置信度(confidence, 0–1)</em>：财务/销售数字优先取年报/10-K/20-F/有价证券报告书/交易所披露与监管数据库（FDA/EMA/NMPA/PMDA/TGA），并标注年份。无法核实的数字宁缺毋滥。</p><p>地理仅覆盖总部 + 主要研发/生产枢纽（非每一处工厂）。研发由 cursor / glm / sonnet 多代理并行检索，经合并、外键校验与事实抽检后入库。</p>',
      footUpdated: '数据更新：2026-06', footDisclaimer: '研究性演示 · 非投资建议',
      cmpTitle: '企业对比', noData: '暂无数据', loading: '加载中…',
      thCompany: '企业', thCountry: '国家', thType: '类型', thRevenue: '营收', thRnd: '研发投入', thProducts: '药物数', thFocus: '侧重领域', thExchange: '交易所',
      tierAll: '全部', tierDeep: '深度档案', tierRoster: '名录', badgeListed: '名录',
      rosterNote: '名录层条目——已收录其上市信息，暂无深度档案（站点 / 产品 / 管线）。', catCapped: '（已显示前 {n} 条，共 {m} 条；请用搜索或筛选缩小范围）',
      kpiListed: '名录收录',
      tabSummary: '概要', tabSites: '站点', tabPipeline: '药物与管线', tabFocus: '领域侧重', tabBench: '对标', tabMilestones: '里程碑',
      colRegion: '地区', colMarket: '市场规模', colCompanies: '企业数', colRegulator: '监管', colStrength: '优势领域',
      allRegions: '全部地区', allTypes: '全部类型', allModalities: '全部模态', allTAs: '全部领域',
      dimSiteType: '按站点类型', dimCountry: '按总部国家', dimType: '按企业类型',
      revenue: '营收', marketCap: '市值', rndSpend: '研发投入', employees: '员工', founded: '成立', hq: '总部', ticker: '代码',
      flagship: '旗舰药物', pipeline: '在研管线', sources: '来源', parent: '母公司', subsidiary: '子公司',
      vsIncumbent: '替代/赶超对象', before: '此前差距', achievement: '突破', stillMissing: '仍待补足',
      confidence: '置信度', blockbuster: '重磅药', addCompare: '+对比', inCompare: '已加入',
      ph_preclinical: '临床前', ph_ph1: 'I期', ph_ph2: 'II期', ph_ph3: 'III期', ph_filed: '申报', ph_approved: '已上市', ph_withdrawn: '已撤市'
    },
    en: {
      navBrand: 'Global Pharma Atlas', navOverview: 'Overview', navMap: 'Map', navCatalog: 'Companies',
      navModalities: 'Modalities', navTrends: 'R&D Trends', navCountries: 'Countries',
      navBenchmarks: 'Benchmarks', navMilestones: 'Milestones', navCompare: 'Compare',
      errTitle: 'Data failed to load', errBody: 'This page fetches JSON and must be served over HTTP(S) (not opened via file://). Use a local server.',
      heroTitle: 'Global Pharmaceutical Industry Atlas',
      heroSub: 'A data view of the global pharma landscape — Chinese pharma alongside the US, Europe, Japan, Australia and more: geographic footprint, subsidiaries and R&D/manufacturing sites, flagship drugs and pipelines, modality and therapeutic-area focus, country-vs-country comparison, and China-vs-incumbent breakthroughs.',
      heroNote: 'Research demo with per-record sources and confidence flags. Not investment advice; figures reflect the cited filing year.',
      ovTitle: 'Overview', ovChart: 'Companies & drugs by region',
      kpiCompanies: 'Companies', kpiCountries: 'Countries', kpiProducts: 'Drugs', kpiBlockbusters: 'Blockbusters (>$1B)', kpiSites: 'Global sites',
      mapTitle: 'World map of sites', mapSub: 'Each marker is a company site (HQ / R&D / manufacturing / commercial). Color by dimension, filter by region or modality, click to open the company.',
      reset: 'Reset',
      catTitle: 'Company catalog',
      modTitle: 'Drug modality breakdown', modSub: 'The structure of catalogued drugs by type (small molecule / mAb / ADC / bispecific / cell & gene therapy / vaccine / TCM…). Click a sector to filter.',
      trTitle: 'R&D & therapeutic-area trends', trPhase: 'Pipeline by phase', trTa: 'Therapeutic-area distribution', trModality: 'Modality mix', trRegion: 'China vs world (by region)',
      coTitle: 'Country comparison', coSub: 'Each country: market size, R&D spend, regulator and strengths. Select countries to compare on the radar.', coRadar: 'Country capability radar',
      bmTitle: 'China ↔ international benchmarks', bmSub: 'Chinese innovative drugs/companies side-by-side with their international analogs.',
      msTitle: 'Breakthrough milestones', msSub: 'Notable breakthroughs — especially Chinese innovators catching up to or displacing Western originators.',
      meTitle: 'Method & sources', meSummary: 'Coverage, confidence and sourcing notes',
      meBody: '<p>A research demo. Wave 1 covers ~50 global and Chinese pharma companies in depth; later waves expand with cited sources.</p><p>Every record carries <em>sources</em> and a <em>confidence</em> score (0–1): financial/sales figures prefer annual reports / 10-K / 20-F / 有価証券報告書 / exchange filings and regulator databases (FDA/EMA/NMPA/PMDA/TGA), with the year noted. Unverifiable numbers are omitted.</p><p>Geography covers HQ + major R&D/manufacturing hubs (not every plant). Research was gathered by cursor / glm / sonnet agents in parallel, then merged, foreign-key validated and fact spot-checked.</p>',
      footUpdated: 'Data updated: 2026-06', footDisclaimer: 'Research demo · not investment advice',
      cmpTitle: 'Company comparison', noData: 'No data yet', loading: 'Loading…',
      thCompany: 'Company', thCountry: 'Country', thType: 'Type', thRevenue: 'Revenue', thRnd: 'R&D', thProducts: 'Drugs', thFocus: 'Focus', thExchange: 'Exchange',
      tierAll: 'All', tierDeep: 'Profiled', tierRoster: 'Listed', badgeListed: 'Listed',
      rosterNote: 'Roster entry — listing indexed; no deep profile yet (sites / products / pipeline).', catCapped: '(showing first {n} of {m}; use search or filters to narrow)',
      kpiListed: 'Listed (indexed)',
      tabSummary: 'Summary', tabSites: 'Sites', tabPipeline: 'Drugs & pipeline', tabFocus: 'Focus', tabBench: 'Benchmarks', tabMilestones: 'Milestones',
      colRegion: 'Region', colMarket: 'Market size', colCompanies: 'Companies', colRegulator: 'Regulator', colStrength: 'Strengths',
      allRegions: 'All regions', allTypes: 'All types', allModalities: 'All modalities', allTAs: 'All areas',
      dimSiteType: 'By site type', dimCountry: 'By HQ country', dimType: 'By company type',
      revenue: 'Revenue', marketCap: 'Market cap', rndSpend: 'R&D spend', employees: 'Employees', founded: 'Founded', hq: 'HQ', ticker: 'Ticker',
      flagship: 'Flagship drugs', pipeline: 'Pipeline', sources: 'Sources', parent: 'Parent', subsidiary: 'Subsidiary',
      vsIncumbent: 'Displaces / catches', before: 'Prior gap', achievement: 'Achievement', stillMissing: 'Still missing',
      confidence: 'Confidence', blockbuster: 'Blockbuster', addCompare: '+ compare', inCompare: 'added',
      ph_preclinical: 'Preclinical', ph_ph1: 'Ph 1', ph_ph2: 'Ph 2', ph_ph3: 'Ph 3', ph_filed: 'Filed', ph_approved: 'Approved', ph_withdrawn: 'Withdrawn'
    }
  };

  var ENUM = {
    company_type: {
      originator_bigpharma: { zh: '原研大药企', en: 'Big pharma' },
      biotech: { zh: '生物科技', en: 'Biotech' },
      generics: { zh: '仿制药', en: 'Generics' },
      cdmo_cro: { zh: 'CDMO/CRO', en: 'CDMO/CRO' },
      vaccine: { zh: '疫苗', en: 'Vaccine' },
      biosimilar: { zh: '生物类似药', en: 'Biosimilar' },
      tcm: { zh: '中药', en: 'TCM' },
      diversified: { zh: '综合', en: 'Diversified' },
      lifesci_tools: { zh: '生命科学工具/诊断', en: 'Life-sci tools / Dx' },
      medtech: { zh: '医疗器械', en: 'MedTech' }
    },
    site_type: {
      HQ: { zh: '总部', en: 'HQ' }, RD: { zh: '研发', en: 'R&D' },
      manufacturing: { zh: '生产', en: 'Manufacturing' }, commercial: { zh: '商业', en: 'Commercial' },
      JV: { zh: '合资', en: 'JV' }
    },
    region: {
      north_america: { zh: '北美', en: 'North America' }, europe: { zh: '欧洲', en: 'Europe' },
      japan: { zh: '日本', en: 'Japan' }, greater_china: { zh: '大中华', en: 'Greater China' },
      oceania: { zh: '大洋洲', en: 'Oceania' }, other_apac: { zh: '其他亚太', en: 'Other APAC' },
      latam: { zh: '拉美', en: 'LatAm' }, mea: { zh: '中东非洲', en: 'MEA' }
    },
    modality_class: {
      small_molecule: { zh: '小分子', en: 'Small molecule' }, mab: { zh: '单抗', en: 'mAb' },
      bispecific: { zh: '双抗', en: 'Bispecific' }, adc: { zh: 'ADC', en: 'ADC' },
      fusion_protein: { zh: '融合蛋白', en: 'Fusion protein' }, peptide: { zh: '多肽', en: 'Peptide' },
      biologic: { zh: '重组蛋白', en: 'Recombinant protein' }, vaccine: { zh: '疫苗', en: 'Vaccine' },
      cell_therapy: { zh: '细胞治疗', en: 'Cell therapy' }, gene_therapy: { zh: '基因治疗', en: 'Gene therapy' },
      rna_oligo: { zh: '核酸药', en: 'RNA/oligo' }, radioligand: { zh: '放射配体', en: 'Radioligand' },
      biosimilar: { zh: '生物类似药', en: 'Biosimilar' }, tcm: { zh: '中药', en: 'TCM' }
    }
  };

  function t(k) { return (L[lang] && L[lang][k]) || (L.zh[k]) || k; }
  function isEn() { return lang === 'en'; }
  function pick(zh, en) { return isEn() ? (en || zh || '') : (zh || en || ''); }
  function name(o) { return o ? pick(o.name_zh, o.name_en) : ''; }
  function enumLabel(group, val) {
    var g = ENUM[group]; if (!g || !g[val]) return val || '';
    return isEn() ? (g[val].en || g[val].zh) : (g[val].zh || g[val].en);
  }
  function phaseLabel(s) { return t('ph_' + s) || s; }

  function applyLangToUI(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n'); var v = t(k); if (v) el.textContent = v;
    });
    (root || document).querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-html'); var v = t(k); if (v) el.innerHTML = v;
    });
    (root || document).querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-placeholder'); var v = t(k); if (v) el.setAttribute('placeholder', v);
    });
    document.documentElement.setAttribute('lang', lang);
    var tog = document.getElementById('lang-toggle');
    if (tog) tog.textContent = isEn() ? '中' : 'EN';
  }
  function setLang(l) {
    if (l !== 'en' && l !== 'zh') return;
    lang = l; try { localStorage.setItem(KEY, l); } catch (e) {}
    applyLangToUI(); listeners.forEach(function (cb) { try { cb(); } catch (e) {} });
  }
  function toggleLang() { setLang(isEn() ? 'zh' : 'en'); }
  function onChange(cb) { listeners.push(cb); }

  window.PHARM_I18N = {
    t: t, isEn: isEn, pick: pick, name: name, enumLabel: enumLabel, phaseLabel: phaseLabel,
    applyLangToUI: applyLangToUI, setLang: setLang, toggleLang: toggleLang, onChange: onChange,
    get lang() { return lang; }
  };
})();
