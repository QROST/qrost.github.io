/**
 * China housing demo — zh/en language layer.
 * Persists to localStorage key `housing-lang` (default zh).
 * English mode: USD (live FX or ÷7 fallback), sq ft, community names → pinyin.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'housing-lang';
  const FX_CACHE_KEY = 'housing-fx';
  const SQM_TO_SQFT = 10.7639;
  const KM_TO_MI = 0.621371;
  const KM_TO_FT = 3280.8399;
  const M_TO_FT = 3.28084;
  const MM_TO_IN = 1 / 25.4;
  const FALLBACK_CNY_PER_USD = 7;
  const FX_API = 'https://api.frankfurter.app/latest?from=USD&to=CNY';
  const GITHUB_COMMITS_API = 'https://api.github.com/repos/QROST/qrost.github.io/commits?path=demos/china-housing&per_page=1';
  const BUILT_AT_CACHE_KEY = 'housing-built-at';

  let lang = 'zh';
  let cnyPerUsd = FALLBACK_CNY_PER_USD;
  let rateSource = 'fallback';
  let lastCommitIso = null;
  let onChangeCb = null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'zh') lang = stored;
  } catch (e) { /* private mode */ }

  const PINYIN = () => window.HOUSING_LOC_PINYIN || {};

  const trim = (s) => String(s).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');

  const LABELS = {
    zh: {
      langToggleAria: '切换中文 / English',
      skipLink: '跳到内容',
      navHome: '返回 QROST 首页',
      navOverview: '便宜×宜居',
      navRankings: '排行',
      navGeo: '宜居地图',
      navTable: '数据表',
      heroEyebrow: 'Data · 宜居 × 便宜',
      heroTitle: '哪里既<span class="text-emerald-700 dark:text-emerald-400">宜居</span>，又<span class="text-emerald-700 dark:text-emerald-400">便宜</span>？',
      heroBody: '<strong class="font-medium text-slate-800 dark:text-slate-200" id="hero-count">234 套</strong>来自全国小城市、县城与度假区的二手房<strong class="font-medium text-slate-800 dark:text-slate-200">挂牌样本</strong>，覆盖 <strong class="font-medium text-slate-800 dark:text-slate-200" id="hero-provs">20 个省 / 直辖市</strong>。便宜只是起点——这里把每套房的<strong class="font-medium text-slate-800 dark:text-slate-200">气候舒适度</strong>、<strong class="font-medium text-slate-800 dark:text-slate-200">冬夏气温</strong>、<strong class="font-medium text-slate-800 dark:text-slate-200">年降水</strong>、<strong class="font-medium text-slate-800 dark:text-slate-200">海拔</strong>、到<strong class="font-medium text-slate-800 dark:text-slate-200">医院 / 火车站 / 机场 / 海岸</strong>的距离，以及<strong class="font-medium text-slate-800 dark:text-slate-200">在地自然灾害</strong>风险，和价格放进<strong class="font-medium text-slate-800 dark:text-slate-200">同一张表</strong>横向对比，帮你挑出住着舒服、风险可接受、又花得起的地方。',
      heroDisclaimer: '数据更新于 <strong class="font-medium text-slate-700 dark:text-slate-300">2021-03 ~ 2026-06</strong>。每行是<strong class="font-medium text-slate-700 dark:text-slate-300">单一挂牌报价</strong>（往往是当地能找到的最便宜的房子），属轶事样本，<strong class="font-medium text-slate-700 dark:text-slate-300">非市场指数</strong>；宜居与灾害为<strong class="font-medium text-slate-700 dark:text-slate-300">粗略近似口径</strong>（灾害已细化到小区，仍含估算），不构成投资或安家建议。口径见<a href="#methodology" class="text-emerald-700 dark:text-emerald-400 underline underline-offset-2 hover:text-emerald-600 dark:hover:text-emerald-300">说明</a>。',
      secOverview: '便宜 × 宜居 · Cheap ↔ Livable',
      secOverviewDesc: '每个点是一套房：横轴<strong class="text-slate-800 dark:text-slate-200">总价（越左越便宜）</strong>、纵轴<strong class="text-slate-800 dark:text-slate-200">舒适天数（日最低≥8℃且日最高≤26℃；悬停看具体日期范围，越上越多）</strong>，<strong class="text-indigo-700 dark:text-indigo-400">颜色越蓝 = 年温差越大（四季越分明）</strong>、越青 = 全年越平稳。<strong class="text-slate-800 dark:text-slate-200">左上角</strong>那批既便宜、舒适日又多的房子，正是这份清单想帮你找到的。',
      secRankings: '排行 · Top 50',
      secRankingsDesc: '切换不同口径看极值——总价 / 单价最低、舒适日最多、极端日最多，也保留了租金回报口径。',
      secGeo: '宜居地图 · Livability overlay',
      secGeoDesc: '每个圆点是一套房，<strong class="text-slate-800 dark:text-slate-200">越大 = 越便宜</strong>，颜色按<strong class="text-emerald-700 dark:text-emerald-400">点·叠加维度</strong>变化。再叠一层<strong class="text-emerald-700 dark:text-emerald-400">连续底图</strong>——全国<strong class="text-slate-800 dark:text-slate-200">等温线 / 降水 / 海拔</strong>栅格场。<strong class="text-slate-800 dark:text-slate-200">滚轮 / 双指捏合 / 右上角 +−</strong> 缩放、拖动平移；点击圆点看卫星图 / 周边 / 气候与灾害。',
      dimOverlay: '点·叠加维度',
      baseOverlay: '连续底图',
      provCompare: '各省对比',
      secTable: '数据表 · 总信息源',
      secTableDesc: '这张表是<strong class="text-slate-800 dark:text-slate-200">一切图表与地图的来源</strong>——价格、宜居（舒适日 / 极端日、气温 / 降水 / 海拔）、基础设施距离、在地灾害风险全部并列。点击表头排序，用下方按钮切换<strong class="text-emerald-700 dark:text-emerald-400">列分组</strong>，按省份筛选或搜索。',
      showCols: '显示列',
      searchPlaceholder: '搜索省 / 城市 / 区 / 小区…',
      exportCsv: '导出 CSV',
      methodologySummary: '说明 · Methodology',
      i18nMethodTitle: '语言与单位换算（English 模式）',
      i18nMethodBody: '<p><strong class="text-slate-700 dark:text-slate-300">货币</strong>：英文界面将人民币挂牌价换算为美元显示。在线时从 <a href="https://www.frankfurter.app/" class="text-emerald-700 dark:text-emerald-400 underline" target="_blank" rel="noopener">Frankfurter</a> 拉取 USD→CNY 实时汇率；离线或接口不可用时使用 <strong>1 USD ≈ 7 CNY</strong> 的近似值（即 CNY 金额 ÷ 7）。</p><p><strong class="text-slate-700 dark:text-slate-300">面积</strong>：英文界面将 ㎡ 换算为平方英尺（sq ft），系数 <strong>1 ㎡ = 10.7639 sq ft</strong>；单价同步换算为 <strong>USD/sq ft</strong>（总价 USD ÷ 面积 sq ft，等价于 元/㎡ 经汇率与面积系数换算）。</p><p><strong class="text-slate-700 dark:text-slate-300">气温</strong>：英文界面将摄氏温度换算为华氏度显示，<strong>°F = °C × 9/5 + 32</strong>（年温差等差值按 <strong>Δ°F = Δ°C × 9/5</strong>）。</p><p><strong class="text-slate-700 dark:text-slate-300">距离</strong>：英文界面将公里换算为英里，<strong>1 km ≈ 0.621371 mi</strong>；不足约 160 m 时显示英尺。</p><p><strong class="text-slate-700 dark:text-slate-300">海拔</strong>：英文界面将米换算为英尺，<strong>1 m = 3.28084 ft</strong>（整数英尺显示）。</p><p><strong class="text-slate-700 dark:text-slate-300">降水</strong>：英文界面将毫米换算为英寸，<strong>1 in = 25.4 mm</strong>（年降水与月降水柱状图保留 1 位小数 in）。</p><p><strong class="text-slate-700 dark:text-slate-300">地名与小区</strong>：英文界面将省 / 市 / 区显示为常用英文名或全拼；小区名无官方英文时使用<strong>全拼</strong>（无声调，词间空格）。中文界面保持原始中文与 ㎡ / ¥ / °C / km / m / mm。</p><p id="fx-rate-note" class="text-xs text-slate-500 dark:text-slate-500"></p>',
      mapZoomIn: '放大', mapZoomOut: '缩小', mapZoomReset: '复位',
      tier1Label: '显示全部',
      footerBuiltPrefix: '网页更新于',
      footerThanks: '数据来源 · 致谢：感谢 <strong class="font-medium text-slate-500 dark:text-slate-400">小红书 @FIRE规划师</strong>、<strong class="font-medium text-slate-500 dark:text-slate-400">小红书 @包子全是水</strong> 提供的原始信息与样本线索；后续扩充与全部宜居 enrich 由 QROST 独立调研整理，建成年代等附可核查来源（点击表格行查看）。',
      footerDisclaimer: '© 2026 QROST. 本页不构成任何投资、法律或税务建议。',
      kpiListings: '房源样本', kpiListingsSub: '社区级二手房挂牌', kpiUnit: '套',
      kpiProvinces: '覆盖省份', kpiProvincesSub: '东北 → 华南', kpiProvUnit: '省/市',
      kpiCheapest: '最低总价', kpiMedianUnit: '单价中位数', kpiMedianUnitSub: '挂牌单价中位',
      kpiSteady: '气候最平稳', kpiSteadyUnit: '℃年温差',
      kpiComfortMax: '舒适日最多', kpiComfortMaxSub: '日最低≥8℃·日最高≤26℃',
      rankCheap: '总价最低', rankUnit: '单价最低', rankComfort: '舒适日最多',
      rankExtreme: '极端日最多', rankYield: '回报率最高',
      rankSeason: '本月最舒适', rankBurden: '灾害负担最低',
      provAvgUnit: '均单价', provAvgPrice: '均总价', provAvgRange: '均年温差', provAvgExtreme: '极端日',
      dimTempRange: '年温差·季节波动', dimUnitPrice: '单价', dimPriceWan: '总价',
      dimJanTemp: '1月均温·等温', dimJulTemp: '7月均温·等温', dimAnnualPrecip: '年降水',
      dimElevation: '海拔', dimHazardFreq: '地理灾种背景', dimBuiltAge: '房龄',
      baseNone: '无底图', baseJanTemp: '1月等温', baseJulTemp: '7月等温',
      baseElevation: '海拔', baseAnnualPrecip: '年降水',
      groupLive: '宜居', groupInfra: '基础设施', groupRisk: '灾害风险', groupInvest: '投资口径',
      filterChipsLabel: '条件筛选',
      secQuiz: '找城测验 · Match quiz',
      secQuizDesc: '回答几个偏好，按<strong class="text-slate-800 dark:text-slate-200">公开权重</strong>给所有可见房源实时打分。彩条显示每个维度对得分的贡献——<strong class="text-slate-800 dark:text-slate-200">为什么匹配，一眼可查</strong>；权重与公式见卡片底部。',
      qzBudget: '预算上限（总价）', qzWinter: '冬天怕冷？', qzSummer: '夏天怕热？', qzHazard: '灾害容忍度',
      qzBudgetAny: '不限',
      qzDegNo: '不怕', qzDegSome: '有点', qzDegVery: '很怕',
      qzHzNo: '不在意', qzHzMid: '一般', qzHzHigh: '很在意·求安稳',
      qzHeat: '要集中供暖', qzCoast: '想住海边', qzAlt: '海拔敏感 ≤1500m', qzRail: '要轨交',
      qdPrice: '价格', qdClimate: '全年舒适', qdWinter: '冬暖', qdSummer: '夏凉', qdHazard: '灾害少', qdCoast: '近海', qdRail: '近轨交',
      qzEmpty: '没有满足硬条件的房源——放宽预算 / 供暖 / 海拔再试。',
      qzMatchCount: '共 {n} 套满足硬条件',
      qzRentPlaceholder: '你现在的月租（元）',
      qzRentHint: '输入月租，换算「你的一年房租 ≈ 这里多少㎡」。',
      qzRentOut: '一年房租 {y} 元 ≈ 可见房源中位单价 {a}㎡ · ≈ 第1名「{c}」 {b}㎡',
      qzFormula: '硬条件（不满足直接排除）：预算上限 · 要集中供暖 · 海拔≤1500m。得分 = Σ(权重×子分) ÷ Σ权重 × 100。权重：价格 2 · 全年舒适 2 · 冬暖/夏凉 1.5×程度 · 灾害 1×在意度 · 海边 2 · 轨交 1.5。子分 0–1：价格按可见单价区间线性、舒适 = 舒适日/365、冬暖 = (1月均温+10)/28、夏凉 = (30−7月均温)/10、灾害 = 1−负担/最大、海边 = e^(−km/40)、轨交 = e^(−km/15)。隐藏对标行不参与打分。评分卡字母同用可见分布 z 分位（悬停徽章看阈值）。',
      fcBudget10: '总价≤10万', fcWarmWinter: '冬暖·1月≥5℃', fcCoolSummer: '夏凉·7月≤26℃',
      fcHeated: '有供暖', fcCoast50: '海边≤50km', fcLowAlt: '海拔≤1500m',
      fcLowHazard: '无年年灾', fcRail20: '轨交≤20km',
      provFilterAll: '全部省份',
      tableCount: '显示 {n} / {total} 套',
      lmSat: '🛰 卫星图', lmNear: '📍 周边', lmClimate: '🌡 气候 / 灾害',
      lmClose: '关闭', lmView: '查看', lmGeo: '定位',
      gdPrice: '房价', gdClimate: '气候', gdHazard: '灾害', gdAccess: '交通', gdMedical: '医疗', gdAge: '楼龄',
      gradeTitle: '对可见房源分布的 z 分位评分（A+≥1.3σ、A≥0.8σ、A−≥0.4σ、B+≥0.1σ、B≥−0.25σ、B−≥−0.6σ、C+≥−1.1σ、其余 C）；隐藏对标行不参与定曲线',
      worthBadge: '值得看',
      wcPrice: '单价进入可见房源最便宜 25%（≤{v}元/㎡）', wcComfort: '舒适日进入前 25%（≥{v}天）',
      wcHazard: '无「几乎年年」高频灾种', wcRail: '地铁/火车 ≤20km',
      csComfort: '全年舒适 {n} 天', csBest: '最舒适 {r}', csExtreme: '极端 {n} 天', csNoExtreme: '无极端日',
      lmUnit: '单价', lmCohort: '比同代(±7年)可见房源 {p}% 便宜', lmLease: '70年土地剩余约 {n} 年', lmLeaseApprox: '（按约略建成年估）',
      lmPm25: '年均PM2.5({y})', lmPm25Heating: '采暖季(11–3月)',
      lmPm25Tip: 'ChinaHighPM2.5 卫星反演 1km 栅格在房源坐标取样；模型再分析数据，非站点实测',
      lmSun: '年日照', lmHumid: '高湿季', lmSnow: '雪季', lmWindy: '大风日',
      lmShrink: '收缩城市', lmPopTrend: '地级市常住人口（七普 vs 六普）{p}%', lmAging: '65岁以上',
      lmBandTitle: '全年体感温区（日均温 9 档：<-9 / 0 / 7 / 13 / 18 / 24 / 28 / 33℃）',
      bandNames: ['严寒', '冰冻', '很冷', '冷', '凉', '舒适', '暖', '热', '酷热'],
      lmShare: '保存分享图',
      cmpAdd: '＋加入对比', cmpRemove: '✓ 已在对比·点击移出', cmpFab: '对比 ({n})',
      cmpTitle: '横向对比', cmpClear: '清空', cmpNeedTwo: '再选一套才能对比（最多 3 套）',
      cmpCardAdd: '＋对比', cmpCardOn: '✓ 对比',
      cmpDeltaBuy: '同样 10 万元：{a} ≈ {x}㎡ · {b} ≈ {y}㎡',
      cmpDeltaWinter: '{a} 比 {b} 1月暖 {d}℃',
      cmpDeltaSummer: '{a} 比 {b} 7月凉 {d}℃',
      cmpDeltaComfort: '{a} 比 {b} 每年多 {d} 天舒适日',
      shareEyebrow: '中国宜居便宜指南 · QROST',
      shareComfortStrip: '全年舒适时段（绿）/ 极端时段（红）',
      shareHazards: '主要灾种：',
      scatterX: '二手房总价（万元）— 越左越便宜',
      scatterY: '舒适天数（日最低≥8℃且日最高≤26℃；悬停看具体日期范围）— 越上越多',
      rankAxisCheap: '总价（万元）', rankAxisUnit: '单价（元/㎡）',
      rankAxisComfort: '舒适天数（日最低≥8℃且日最高≤26℃）', rankAxisExtreme: '极端天数（日均&lt;-5℃ 或 日最高≥33℃）',
      rankAxisYield: '毛租金回报率（%）',
      rankAxisSeason: '本月舒适天数', rankAxisBurden: '灾害负担分（低=省心）',
      rankColCommunity: '小区', rankColComfort: '舒适', rankColExtreme: '极端',
      rankStripComfort: '舒适日段（绿）', rankStripExtreme: '极端日段（红）',
      rankNoteComfort: '<strong class="text-slate-700 dark:text-slate-300">舒适日</strong>：ERA5 十年日气候（15 天平滑）下，<strong class="text-slate-700 dark:text-slate-300">日最低温 ≥8℃ 且日最高温 ≤26℃</strong>（全天温区落在舒适带内）且非极端的天数；下方绿条为全年舒适时段。与「极端日最多」<strong class="text-slate-700 dark:text-slate-300">互斥</strong>。',
      rankNoteExtreme: '<strong class="text-slate-700 dark:text-slate-300">极端日</strong>：同一日气候口径下，<strong class="text-slate-700 dark:text-slate-300">日均 &lt;-5℃（严寒）</strong>或<strong class="text-slate-700 dark:text-slate-300">日最高 ≥33℃（酷热）</strong>；若日均舒适但午后偏热，只计极端。下方红条为全年极端时段。<strong class="text-slate-700 dark:text-slate-300">宜居口径</strong>，非气象预警。',
      rankNoteSeason: '<strong class="text-slate-700 dark:text-slate-300">本月最舒适</strong>：当前月份（{m}月）内的舒适天数，口径同「舒适日最多」（日最低≥8℃ 且日最高≤26℃，非极端）。随访问月份自动变化——夏天看避暑、冬天看冬暖。',
      rankNoteBurden: '<strong class="text-slate-700 dark:text-slate-300">灾害负担</strong> ＝ 对该小区每个在地灾种求和 Σ 2^(频率等级−1)；等级 1=百年级罕见(1分)、2=数十年一遇(2分)、3=约十年一遇(4分)、4=数年一遇(8分)、5=几乎年年(16分)。<strong class="text-slate-700 dark:text-slate-300">分数越低越省心</strong>；各灾种明细与来源见房源弹窗「气候 / 灾害」页。',
      methodComfortExtremeTitle: '舒适日 / 极端日判定',
      methodComfortExtremeBody: '<li><strong class="text-slate-700 dark:text-slate-300">数据</strong>：Open-Meteo ERA5 <strong>2014–2023</strong> 逐日气温 → 年内同日期做 <strong>10 年平均</strong> → <strong>15 天圆周平滑</strong>（固定 365 天历法）。</li><li><strong class="text-slate-700 dark:text-slate-300">舒适日</strong>：平滑后 <strong>日最低温 ≥8℃ 且日最高温 ≤26℃</strong>（全天温区落在舒适带内），且<strong>当天不算极端</strong>。</li><li><strong class="text-slate-700 dark:text-slate-300">极端日</strong>：平滑后 <strong>日均温 &lt; -5℃</strong>（严寒；0～-4℃ 干冷不计）或 <strong>日最高温 ≥ 33℃</strong>（酷热；比气象 35℃ 预警线更贴近日常体感不适）。</li><li><strong class="text-slate-700 dark:text-slate-300">互斥</strong>：舒适与极端<strong>不重叠</strong>——已标为极端的日子不再计舒适（表格绿/红条、排行天数均如此）。</li><li><strong class="text-slate-700 dark:text-slate-300">性质</strong>：<strong>宜居对比口径</strong>，非中国气象局灾害预警；日期边界因平滑约有 <strong>±1 周</strong> 不确定度。</li>',
      provStripNote: '横轴=全年（按日，竖线为月界）；红段=该省有小区当天严寒(日均&lt;-5℃)或酷热(日最高≥33℃)，越深=占比越高，空白=无极端。宜居口径，非官方灾害预警。',
      provAxisAvgUnit: '样本均单价（元/㎡）', provAxisAvgPrice: '样本均总价（万元）',
      provAxisAvgRange: '样本均年温差（℃，越小越平稳）',
      provAxisAvgExtreme: '红段=省内极端日并集；排序按样本均极端天数',
      mapFailEcharts: '地图组件未能加载（ECharts CDN 不可达），表格与其余图表不受影响。',
      mapFailGeo: '地图边界数据加载失败（网络受限），省份对比可见下方柱状图，表格不受影响。',
      mapClickHint: '点击查看卫星图 / 周边 / 气候 / 灾害',
      mapCheaper: '便宜', mapExpensive: '贵', mapHot: '热', mapCold: '冷',
      mapSwingLarge: '四季分明', mapSwingSteady: '平稳',
      mapWet: '湿', mapDry: '干', mapHigh: '高', mapLow: '低',
      mapFreqOften: '更常见', mapFreqRare: '更少见',
      mapHazardNote: '复发频率，非严重度；多为区域背景信息',
      mapAgeNew: '新', mapAgeOld: '老',
      monthNone: '无', monthAll: '全年', monthSuffix: '月',
      daySuffix: '天', yuanPerSqm: '元/㎡', wan: '万',
      fxNoteLive: '当前汇率：1 USD = {rate} CNY（Frankfurter 实时）',
      fxNoteCached: '当前汇率：1 USD = {rate} CNY（缓存，24h 内）',
      fxNoteFallback: '当前汇率：1 USD ≈ 7 CNY（离线近似）',
      fxNoteZh: '中文界面显示原始人民币与平方米。',
      col_id: '#', col_prov: '省份', col_city: '城市', col_dist: '区/镇', col_loc: '小区/位置',
      col_builtAge: '房龄', col_priceWan: '总价', col_area: '面积㎡', col_unitPrice: '单价 元/㎡',
      col_rent: '月租 元', col_climateType: '气候类型', col_tempRange: '年温差',
      col_janTemp: '1月均温', col_julTemp: '7月均温',
      col_histTempMax: '历史最高温', col_histTempMin: '历史最低温',
      col_comfortMonths: '舒适日期',
      col_extremeMonths: '极端日期', col_annualPrecip: '年降水mm', col_elevation: '海拔m',
      col_heating: '供暖', col_hospitalKm: '医院km', col_transitKm: '地铁/火车km',
      col_airportKm: '机场km', col_coastKm: '海岸km', col_seismic: '地震带', col_typhoon: '台风',
      col_hazard: '当地灾种·常见度', col_hazardHint: '复发频率，非严重度；多为区域背景信息',
      col_yieldPct: '毛回报', col_payback: '回本年', col__act: '详情',
methodDataTitle: '数据来源与整合',
      methodDataBody: '<p>挂牌与旅居信息种子来自小红书博主「FIRE规划师」与「包子全是水」<strong class="font-medium text-slate-700 dark:text-slate-300">无偿分享</strong>的房产 / 旅居笔记——前者主要对应其 <strong class="text-slate-700 dark:text-slate-300">2026-04</strong> 系列帖子，后者主要对应其 <strong class="text-slate-700 dark:text-slate-300">2025-06</strong> 系列帖子。经整合后，QROST 联网补充了若干样本，并独立计算气候 / 海拔 / 基础设施距离 / 灾害频率等宜居维度（Open-Meteo、OpenStreetMap 及公开史料）。</p>',
      methodMetricsTitle: '宜居指标如何得来',
      methodMetricsBody: '<li><strong class="text-slate-700 dark:text-slate-300">气温 / 降水</strong>：Open-Meteo ERA5 <strong>2014–2023</strong> 月度均值；年降水为 12 个月均值之和。</li><li><strong class="text-slate-700 dark:text-slate-300">历史最高 / 最低温</strong>：优先维基百科气候数据模板中的<strong class="text-slate-700 dark:text-slate-300">国家气象站历史极值</strong>（中国气象局）；无模板时回退 ERA5 <strong>1940–2023</strong> 格点日最高/日最低极值（≈25 km，非站址记录）。</li><li><strong class="text-slate-700 dark:text-slate-300">舒适 / 极端按「天」判定</strong>：取 ERA5 <strong>2014–2023</strong> 的<strong class="text-slate-700 dark:text-slate-300">日气候</strong>（年内逐日做 10 年平均，再 15 天平滑去噪），<strong class="text-slate-700 dark:text-slate-300">舒适</strong> = 日最低 ≥8℃ 且日最高 ≤26℃，<strong class="text-slate-700 dark:text-slate-300">极端</strong> = 日均温 &lt; -5℃（严寒；0～-4℃ 干冷不计）或日最高 ≥ 33℃（更贴近体感不适而非气象 35℃ 预警线）。<strong class="text-slate-700 dark:text-slate-300">舒适与极端互斥</strong>（同日满足两者时计为极端）。<strong class="text-slate-700 dark:text-slate-300">宜居口径</strong>，非官方灾害预警。</li><li><strong class="text-slate-700 dark:text-slate-300">扩展日气候</strong>（同一次 ERA5 逐日拉取，10 年平滑后年度汇总，已烘焙入库）：<strong>高湿季</strong>（≈季长）日均 RH≥70%；<strong>雪季</strong>（≈季长）日降雪&gt;0.05 cm；<strong>大风日</strong> 日最大风速≥10 m/s；<strong>年日照</strong> 为逐日日照时数之和（小时）；<strong>体感舒适日</strong> 日平均体感温 10–28℃。</li><li><strong class="text-slate-700 dark:text-slate-300">PM2.5</strong>：ChinaHighPM2.5（Zenodo 6398971）卫星反演 <strong>1km</strong> 栅格在房源坐标取样，年均 + 采暖季（11–3月）两个口径（参考年 2020）；<strong class="text-slate-700 dark:text-slate-300">模型再分析数据，非站点实测</strong>。</li><li><strong class="text-slate-700 dark:text-slate-300">年温差</strong>（℃）= 最热月均温 − 最冷月均温。<strong class="text-slate-700 dark:text-slate-300">气候类型</strong>由年均温与年温差按公开阈值判定。</li><li><strong class="text-slate-700 dark:text-slate-300">供暖</strong>：按秦岭–淮河集中供暖线的省级口径。</li><li><strong class="text-slate-700 dark:text-slate-300">单价</strong> = 总价 ÷ 面积；<strong class="text-slate-700 dark:text-slate-300">毛回报</strong> = 月租×12 ÷ 总价。</li><li><strong class="text-slate-700 dark:text-slate-300">US samples (California)</strong>: sale listings use Compass/Realtor comps; <strong class="text-slate-700 dark:text-slate-300">rental-only</strong> apartments (e.g. Mariposa) use <strong class="text-slate-700 dark:text-slate-300">annual rent ÷ 4.5% cap rate</strong> as implied value for yield comparison. Airport/coast distances use SoCal offline vertices, not China datasets.</li>',
      methodLimitsTitle: '务必注意的局限',
      methodLimitsBody: '<li>每行是<strong class="text-slate-700 dark:text-slate-300">单一挂牌报价</strong>，<strong class="text-slate-700 dark:text-slate-300">不代表区域均价</strong>。</li><li><strong class="text-slate-700 dark:text-slate-300">气候 / 海拔</strong>为定位坐标近似；灾害频率为粗略近似、非工程模型。</li><li>仅供研究与好奇心，<strong class="text-slate-700 dark:text-slate-300">非投资、安家、法律或税务建议</strong>。</li>',
      lmSatNote: '卫星影像 © Esri World Imagery。定位精度见上方标注。',
      lmNearNote: '周边设施来自 OpenStreetMap（小城/县城覆盖可能不全）；机场/海岸线为离线计算。',
      lmClimateNote: '气候为 2014–2023 月度均值（Open-Meteo ERA5）；灾害类型据地市灾情史、频率按坐标物理细化到小区，仍为粗略近似、非工程依据。',
      lmCloseAria: '关闭',
      themeToggleAria: '切换深色/浅色模式',
      baseMapSuffix: '底图',
      comfortLabel: '舒适', extremeLabel: '极端', noExtreme: '无极端',
      builtUnknown: '未知', builtApprox: '约', builtYearTitle: '建成', builtAgeTitle: '房龄',
      builtUnknownTitle: '完工年份未知（公开渠道未查到，未编造）',
      builtDecadeNote: '（年代级估算，非精确）', builtSource: '来源',
      noGeoData: '暂无定位数据', noRiskData: '暂无风险数据',
      climateRiskTitle: '气候与风险（粗略）', winterHeating: '冬季供暖',
      hazardOverview: '省级历史灾害概况', swingLabel: '年温差',
      coldestMonth: '最冷月', hottestMonth: '最热月', annualMean: '年均温',
      histTempTitle: '历史气温极值', histTempMaxTitle: '历史最高', histTempMinTitle: '历史最低',
      histTempNoteWiki: '维基百科气候数据模板（极端值多源自中国气象局国家站）',
      histTempNoteEra5: 'ERA5 再分析格点 1940–2023 日极值（≈25 km 网格，非气象站记录）',
      histTempNoteClimate: 'ERA5 2014–2023 月均极值（区内并集，非全历史站址记录）',
      provExtremeTitle: '极端', provExtremeListings: '套极端',
      provExtremeUnion: '极端日段（省内并集）', provExtremePerListing: '天/小区',
      pageTitle: '哪里既宜居又便宜 · 全国小城市住房宜居度可视化 | QROST',
      provSample: '样本', provAvgTotal: '均总价', provAvgUnit: '均单价',
      provAvgSwing: '均年温差', provAvgExtreme: '均极端',
      poiMetro: '地铁', poiTrain: '火车/高铁', poiTrainHSR: '高铁', poiTrainRegular: '普铁',
      poiAirport: '机场', poiHospital: '医院',
      poiMall: '商场', poiCoast: '海边', poiResearch: '调研', poiUnlocated: '名称(未定位)',
      poiCommunity: '小区', chartHigh: '日高温', chartLow: '日低温',
      chartMeanComfort: '日均温（绿=舒适·红=极端）', chartPrecip: '降水(mm)',
      chartMeanTemp: '均温(℃)', chartMeanHigh: '均高温', chartMeanLow: '均低温',
      monthNames: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
    },
    en: {
      langToggleAria: 'Switch Chinese / English',
      skipLink: 'Skip to content',
      navHome: 'Back to QROST home',
      navOverview: 'Overview',
      navRankings: 'Top 50',
      navGeo: 'Map',
      navTable: 'Table',
      heroEyebrow: 'Data · Livable × Affordable',
      heroTitle: 'Where is it <span class="text-emerald-700 dark:text-emerald-400">livable</span> and <span class="text-emerald-700 dark:text-emerald-400">affordable</span>?',
      heroBody: '<strong class="font-medium text-slate-800 dark:text-slate-200" id="hero-count">234 listings</strong> of second-hand homes in small cities, county towns and resort areas across China — <strong class="font-medium text-slate-800 dark:text-slate-200" id="hero-provs">20 provinces / municipalities</strong>. Price is only the start: each listing is compared side-by-side on <strong class="font-medium text-slate-800 dark:text-slate-200">climate comfort</strong>, <strong class="font-medium text-slate-800 dark:text-slate-200">winter/summer temperatures</strong>, <strong class="font-medium text-slate-800 dark:text-slate-200">annual rainfall</strong>, <strong class="font-medium text-slate-800 dark:text-slate-200">elevation</strong>, distance to <strong class="font-medium text-slate-800 dark:text-slate-200">hospitals / rail / airports / coast</strong>, and <strong class="font-medium text-slate-800 dark:text-slate-200">local hazard exposure</strong>.',
      heroDisclaimer: 'Data span <strong class="font-medium text-slate-700 dark:text-slate-300">2021-03 ~ 2026-06</strong>. Each row is a <strong class="font-medium text-slate-700 dark:text-slate-300">single asking-price observation</strong> (often the cheapest unit found locally) — <strong class="font-medium text-slate-700 dark:text-slate-300">not a market index</strong>. Livability and hazards are <strong class="font-medium text-slate-700 dark:text-slate-300">rough approximations</strong>. See <a href="#methodology" class="text-emerald-700 dark:text-emerald-400 underline underline-offset-2 hover:text-emerald-600 dark:hover:text-emerald-300">methodology</a>.',
      secOverview: 'Affordable × Livable',
      secOverviewDesc: 'Each dot is one listing: horizontal axis = <strong class="text-slate-800 dark:text-slate-200">total price (left = cheaper)</strong>; vertical = <strong class="text-slate-800 dark:text-slate-200">comfortable days (daily low ≥8°C and high ≤26°C)</strong>. <strong class="text-indigo-700 dark:text-indigo-400">Bluer = larger seasonal swing</strong>; greener = steadier year-round. The <strong class="text-slate-800 dark:text-slate-200">upper-left</strong> cluster is the sweet spot.',
      secRankings: 'Rankings · Top 50',
      secRankingsDesc: 'Switch metrics — lowest total / unit price, most comfortable days, most extreme days, or gross rental yield.',
      secGeo: 'Livability map',
      secGeoDesc: 'Each dot is a listing; <strong class="text-slate-800 dark:text-slate-200">larger = cheaper</strong>. Colour follows the selected <strong class="text-emerald-700 dark:text-emerald-400">overlay dimension</strong>. Optional <strong class="text-emerald-700 dark:text-emerald-400">continuous basemap</strong> (isotherms / rainfall / elevation). Scroll or pinch to zoom; click a dot for satellite / POIs / climate.',
      dimOverlay: 'Dot overlay',
      baseOverlay: 'Basemap',
      provCompare: 'By province',
      secTable: 'Master data table',
      secTableDesc: 'Source of truth for every chart and the map — price, livability (comfort / extreme days, temperature, rainfall, elevation), infrastructure distances and hazards in one sortable, filterable table.',
      showCols: 'Columns',
      searchPlaceholder: 'Search province / city / district / community…',
      exportCsv: 'Export CSV',
      methodologySummary: 'Methodology',
      i18nMethodTitle: 'Language & unit conversion (English mode)',
      i18nMethodBody: '<p><strong class="text-slate-700 dark:text-slate-300">Currency</strong>: English UI converts CNY listing prices to USD. When online, the live USD→CNY rate is fetched from <a href="https://www.frankfurter.app/" class="text-emerald-700 dark:text-emerald-400 underline" target="_blank" rel="noopener">Frankfurter</a>; if offline or the API is unavailable, we fall back to <strong>1 USD ≈ 7 CNY</strong> (CNY amount ÷ 7).</p><p><strong class="text-slate-700 dark:text-slate-300">Area</strong>: square metres are shown as <strong>square feet (sq ft)</strong> using <strong>1 m² = 10.7639 sq ft</strong>. Unit prices become <strong>USD/sq ft</strong> (total USD ÷ sq ft area, equivalent to converting ¥/m² via FX and area factor).</p><p><strong class="text-slate-700 dark:text-slate-300">Temperature</strong>: Celsius values are shown as <strong>°F</strong> using <strong>°F = °C × 9/5 + 32</strong> (swing / range deltas use <strong>Δ°F = Δ°C × 9/5</strong>).</p><p><strong class="text-slate-700 dark:text-slate-300">Distance</strong>: kilometres are shown as <strong>miles</strong> using <strong>1 km ≈ 0.621371 mi</strong>; very short hops (&lt; ~160 m) use feet.</p><p><strong class="text-slate-700 dark:text-slate-300">Elevation</strong>: metres are shown as <strong>feet (ft)</strong> using <strong>1 m = 3.28084 ft</strong> (rounded to whole feet in labels).</p><p><strong class="text-slate-700 dark:text-slate-300">Precipitation</strong>: millimetres are shown as <strong>inches (in)</strong> using <strong>1 in = 25.4 mm</strong> (annual totals and monthly chart bars use one decimal place).</p><p><strong class="text-slate-700 dark:text-slate-300">Community names</strong>: where no official English name exists, the Chinese community name is shown in <strong>full pinyin</strong> (no tone marks, space-separated); province / city / district labels are shown in standard English or romanized pinyin.</p><p id="fx-rate-note" class="text-xs text-slate-500 dark:text-slate-500"></p>',
      mapZoomIn: 'Zoom in', mapZoomOut: 'Zoom out', mapZoomReset: 'Reset',
      tier1Label: 'Show all listings',
      footerBuiltPrefix: 'Page updated',
      footerThanks: 'Data · thanks to <strong class="font-medium text-slate-500 dark:text-slate-400">Xiaohongshu @FIRE规划师</strong> and <strong class="font-medium text-slate-500 dark:text-slate-400">@包子全是水</strong> for seed listings; QROST enriched climate, POIs, hazards and built-year research independently.',
      footerDisclaimer: '© 2026 QROST. Not investment, legal or tax advice.',
      kpiListings: 'Listings', kpiListingsSub: 'Community-level asks', kpiUnit: '',
      kpiProvinces: 'Provinces', kpiProvincesSub: 'NE → South', kpiProvUnit: '',
      kpiCheapest: 'Lowest total', kpiMedianUnit: 'Median unit price', kpiMedianUnitSub: 'Ask price median',
      kpiSteady: 'Steadiest climate', kpiSteadyUnit: '°F annual swing',
      kpiComfortMax: 'Most comfort days', kpiComfortMaxSub: 'Low ≥8°C · high ≤26°C',
      rankCheap: 'Lowest total', rankUnit: 'Lowest unit', rankComfort: 'Most comfort days',
      rankExtreme: 'Most extreme days', rankYield: 'Highest yield',
      rankSeason: 'Best this month', rankBurden: 'Lowest hazard burden',
      provAvgUnit: 'Avg unit', provAvgPrice: 'Avg total', provAvgRange: 'Avg swing', provAvgExtreme: 'Extreme days',
      dimTempRange: 'Seasonal swing', dimUnitPrice: 'Unit price', dimPriceWan: 'Total price',
      dimJanTemp: 'Jan mean', dimJulTemp: 'Jul mean', dimAnnualPrecip: 'Annual rain',
      dimElevation: 'Elevation', dimHazardFreq: 'Hazard backdrop', dimBuiltAge: 'Building age',
      baseNone: 'No basemap', baseJanTemp: 'Jan isotherm', baseJulTemp: 'Jul isotherm',
      baseElevation: 'Elevation', baseAnnualPrecip: 'Rainfall',
      groupLive: 'Livability', groupInfra: 'Infrastructure', groupRisk: 'Hazards', groupInvest: 'Investment',
      filterChipsLabel: 'Filters',
      secQuiz: 'Match quiz',
      secQuizDesc: 'Answer a few preferences and every visible listing is scored live with <strong class="text-slate-800 dark:text-slate-200">published weights</strong>. The colored bar shows each dimension\'s contribution — <strong class="text-slate-800 dark:text-slate-200">why it matched is inspectable</strong>. Weights &amp; formulas at the bottom of the card.',
      qzBudget: 'Budget cap (total)', qzWinter: 'Hate cold winters?', qzSummer: 'Hate hot summers?', qzHazard: 'Hazard aversion',
      qzBudgetAny: 'Any',
      qzDegNo: 'Not really', qzDegSome: 'Somewhat', qzDegVery: 'Very much',
      qzHzNo: 'Not a factor', qzHzMid: 'Moderate', qzHzHigh: 'Risk-averse',
      qzHeat: 'Central heating', qzCoast: 'Near the coast', qzAlt: 'Altitude ≤1500m', qzRail: 'Near rail',
      qdPrice: 'Price', qdClimate: 'Year comfort', qdWinter: 'Warm winter', qdSummer: 'Cool summer', qdHazard: 'Low hazard', qdCoast: 'Coast', qdRail: 'Rail',
      qzEmpty: 'Nothing passes the hard gates — relax budget / heating / altitude.',
      qzMatchCount: '{n} listings pass the hard gates',
      qzRentPlaceholder: 'Your monthly rent (CNY)',
      qzRentHint: 'Enter your current monthly rent to convert it into ㎡ here.',
      qzRentOut: 'A year of rent ({y} CNY) ≈ {a}㎡ at the visible median unit price · ≈ {b}㎡ in #1 “{c}”',
      qzFormula: 'Hard gates (excluded if failed): budget cap · central heating · elevation ≤1500m. Score = Σ(weight×subscore) ÷ Σweights × 100. Weights: price 2 · year-round comfort 2 · warm-winter/cool-summer 1.5×degree · hazard 1×aversion · coast 2 · rail 1.5. Subscores 0–1: price linear over the visible unit-price range, comfort = comfort days/365, winter = (Jan mean+10)/28, summer = (30−Jul mean)/10, hazard = 1−burden/max, coast = e^(−km/40), rail = e^(−km/15). Hidden benchmark rows are excluded. Letter grades use the same visible-distribution z-curve (hover a grade chip for thresholds).',
      fcBudget10: '≤ ¥100k total', fcWarmWinter: 'Warm winter · Jan ≥5°C', fcCoolSummer: 'Cool summer · Jul ≤26°C',
      fcHeated: 'Heated', fcCoast50: 'Coast ≤50km', fcLowAlt: 'Elev ≤1500m',
      fcLowHazard: 'No annual hazard', fcRail20: 'Rail ≤20km',
      provFilterAll: 'All provinces',
      tableCount: 'Showing {n} / {total}',
      lmSat: '🛰 Satellite', lmNear: '📍 Nearby', lmClimate: '🌡 Climate / hazards',
      lmClose: 'Close', lmView: 'View', lmGeo: 'Geocode',
      gdPrice: 'Price', gdClimate: 'Climate', gdHazard: 'Hazard', gdAccess: 'Transit', gdMedical: 'Medical', gdAge: 'Age',
      gradeTitle: 'z-score grades vs the visible-listing distribution (A+≥1.3σ, A≥0.8σ, A−≥0.4σ, B+≥0.1σ, B≥−0.25σ, B−≥−0.6σ, C+≥−1.1σ, else C); hidden benchmark rows never shape the curve',
      worthBadge: 'Top pick',
      wcPrice: 'Unit price in the cheapest visible quartile (≤{v} CNY/㎡)', wcComfort: 'Comfort days in the top quartile (≥{v}d)',
      wcHazard: 'No almost-annual hazard', wcRail: 'Rail ≤20km',
      csComfort: '{n} comfort days/yr', csBest: 'best {r}', csExtreme: '{n} extreme days', csNoExtreme: 'no extreme days',
      lmUnit: 'Unit', lmCohort: 'cheaper than {p}% of same-era visible listings', lmLease: '~{n} yrs left of 70-yr land use', lmLeaseApprox: ' (est. from approx. build year)',
      lmPm25: 'PM2.5 annual ({y})', lmPm25Heating: 'heating season (Nov–Mar)',
      lmPm25Tip: 'Sampled at the listing coordinates from the ChinaHighPM2.5 1km satellite-derived grid; model reanalysis, not station readings',
      lmSun: 'Sunshine', lmHumid: 'Humid season', lmSnow: 'Snow season', lmWindy: 'Windy days',
      lmShrink: 'Shrinking city', lmPopTrend: 'Prefecture population (2020 vs 2010 census) {p}%', lmAging: '65+',
      lmBandTitle: 'Daily-mean temperature bands (9 levels: <-9 / 0 / 7 / 13 / 18 / 24 / 28 / 33°C)',
      bandNames: ['Frigid', 'Freezing', 'Very cold', 'Cold', 'Cool', 'Comfort', 'Warm', 'Hot', 'Sweltering'],
      lmShare: 'Save share card',
      cmpAdd: '＋ Compare', cmpRemove: '✓ In compare · remove', cmpFab: 'Compare ({n})',
      cmpTitle: 'Side-by-side', cmpClear: 'Clear', cmpNeedTwo: 'Pick one more to compare (max 3)',
      cmpCardAdd: '＋ Compare', cmpCardOn: '✓ Comparing',
      cmpDeltaBuy: 'Same ¥100k buys: {a} ≈ {x}㎡ · {b} ≈ {y}㎡',
      cmpDeltaWinter: '{a} is {d}°C warmer than {b} in January',
      cmpDeltaSummer: '{a} is {d}°C cooler than {b} in July',
      cmpDeltaComfort: '{a} gets {d} more comfort days a year than {b}',
      shareEyebrow: 'Cheap & livable China guide · QROST',
      shareComfortStrip: 'Comfort spans (green) / extreme spans (red)',
      shareHazards: 'Main hazards: ',
      scatterX: 'Total price (USD) — left = cheaper',
      scatterY: 'Comfortable days (low ≥8°C & high ≤26°C) — up = more',
      rankAxisCheap: 'Total price (USD)', rankAxisUnit: 'Unit price (USD/sq ft)',
      rankAxisComfort: 'Comfort days (low ≥8°C & high ≤26°C)', rankAxisExtreme: 'Extreme days (mean &lt;-5°C or high ≥33°C)',
      rankAxisYield: 'Gross rental yield (%)',
      rankAxisSeason: 'Comfort days this month', rankAxisBurden: 'Hazard burden (lower = better)',
      rankColCommunity: 'Community', rankColComfort: 'Comfort', rankColExtreme: 'Extreme',
      rankStripComfort: 'Comfort days (green)', rankStripExtreme: 'Extreme days (red)',
      rankNoteComfort: '<strong class="text-slate-700 dark:text-slate-300">Comfort days</strong>: ERA5 10-year daily climatology (15-day smoothed) with <strong class="text-slate-700 dark:text-slate-300">daily low ≥8°C and high ≤26°C</strong> (full-day band in range) and not extreme; green bar = comfort spans. <strong class="text-slate-700 dark:text-slate-300">Mutually exclusive</strong> with extreme days.',
      rankNoteExtreme: '<strong class="text-slate-700 dark:text-slate-300">Extreme days</strong>: same climatology — <strong class="text-slate-700 dark:text-slate-300">mean &lt; -5°C (severe cold)</strong> or <strong class="text-slate-700 dark:text-slate-300">daily high ≥33°C (heat)</strong>; a comfortable mean with a hot afternoon counts as extreme only. Red bar = extreme spans. <strong class="text-slate-700 dark:text-slate-300">Livability thresholds</strong>, not CMA warnings.',
      rankNoteSeason: '<strong class="text-slate-700 dark:text-slate-300">Best this month</strong>: comfort days falling inside the current month ({m}) — same definition as "Most comfort days" (daily low ≥8°C, high ≤26°C, not extreme). Re-ranks automatically as the months change: summer surfaces cool highlands, winter surfaces mild coasts.',
      rankNoteBurden: '<strong class="text-slate-700 dark:text-slate-300">Hazard burden</strong> = Σ 2^(freq−1) over the listing\'s local hazard types; freq 1 = once-a-century (1pt), 2 = once in decades (2), 3 = about once a decade (4), 4 = every few years (8), 5 = almost annual (16). <strong class="text-slate-700 dark:text-slate-300">Lower is better</strong>; per-hazard details and sources are in the listing modal.',
      methodComfortExtremeTitle: 'Comfort / extreme day rules',
      methodComfortExtremeBody: '<li><strong class="text-slate-700 dark:text-slate-300">Data</strong>: Open-Meteo ERA5 <strong>2014–2023</strong> daily temps → <strong>10-year day-of-year mean</strong> → <strong>15-day circular smooth</strong> (fixed 365-day calendar).</li><li><strong class="text-slate-700 dark:text-slate-300">Comfort day</strong>: smoothed <strong>daily low ≥8°C and high ≤26°C</strong> (full-day band in range) and <strong>not extreme that day</strong>.</li><li><strong class="text-slate-700 dark:text-slate-300">Extreme day</strong>: smoothed <strong>mean &lt; -5°C</strong> (severe cold; 0 to -4°C dry-cold excluded) or <strong>daily high ≥ 33°C</strong> (heat discomfort, below CMA 35°C warning line).</li><li><strong class="text-slate-700 dark:text-slate-300">No overlap</strong>: comfort and extreme never double-count (table strips and rankings).</li><li><strong class="text-slate-700 dark:text-slate-300">Nature</strong>: <strong>livability comparison</strong>, not official disaster alerts; date edges uncertain by about <strong>±1 week</strong> due to smoothing.</li>',
      provStripNote: 'X-axis = full year (daily; vertical ticks = months). Red = province has listings in extreme cold (mean &lt;-5°C) or heat (daily high ≥33°C); darker = higher share. Livability thresholds, not official disaster warnings.',
      provAxisAvgUnit: 'Mean unit price (USD/sq ft)', provAxisAvgPrice: 'Mean total (USD)',
      provAxisAvgRange: 'Mean annual temp swing (°F, lower = steadier)',
      provAxisAvgExtreme: 'Red = province extreme-day union; sorted by mean extreme days',
      mapFailEcharts: 'Map failed to load (ECharts CDN unreachable). Table and charts still work.',
      mapFailGeo: 'Map boundaries failed to load (network). Province chart and table unaffected.',
      mapClickHint: 'Click for satellite / nearby / climate / hazards',
      mapCheaper: 'cheap', mapExpensive: 'dear', mapHot: 'warm', mapCold: 'cold',
      mapSwingLarge: 'large swing', mapSwingSteady: 'steady',
      mapWet: 'wet', mapDry: 'dry', mapHigh: 'high', mapLow: 'low',
      mapFreqOften: 'more common', mapFreqRare: 'less common',
      mapHazardNote: 'Recurrence frequency, not severity; mostly regional backdrop',
      mapAgeNew: 'new', mapAgeOld: 'old',
      monthNone: 'none', monthAll: 'year-round', monthSuffix: ' mo',
      daySuffix: ' d', yuanPerSqm: '/sqft', wan: '',
      fxNoteLive: 'FX: 1 USD = {rate} CNY (Frankfurter live)',
      fxNoteCached: 'FX: 1 USD = {rate} CNY (cached, &lt;24h)',
      fxNoteFallback: 'FX: 1 USD ≈ 7 CNY (offline fallback)',
      fxNoteZh: 'Chinese UI shows original CNY and m².',
      col_id: '#', col_prov: 'Province', col_city: 'City', col_dist: 'District',
      col_loc: 'Community', col_builtAge: 'Age', col_priceWan: 'Total', col_area: 'Area',
      col_unitPrice: 'Unit $/sqft', col_rent: 'Rent/mo', col_climateType: 'Climate',
      col_tempRange: 'Temp swing', col_janTemp: 'Jan °F', col_julTemp: 'Jul °F',
      col_histTempMax: 'Record high', col_histTempMin: 'Record low',
      col_comfortMonths: 'Comfort days', col_extremeMonths: 'Extreme days',
      col_annualPrecip: 'Rain (in)', col_elevation: 'Elev (ft)', col_heating: 'Heating',
      col_hospitalKm: 'Hospital', col_transitKm: 'Transit', col_airportKm: 'Airport',
      col_coastKm: 'Coast', col_seismic: 'Seismic', col_typhoon: 'Typhoon',
      col_hazard: 'Local hazards · commonness', col_hazardHint: 'Recurrence frequency, not severity; mostly regional backdrop',
      col_yieldPct: 'Yield', col_payback: 'Payback yr', col__act: 'Detail',
methodDataTitle: 'Data sources & integration',
      methodDataBody: '<p>Seed listings and slow-living notes came from Xiaohongshu creators <strong class="font-medium text-slate-700 dark:text-slate-300">@FIRE规划师</strong> and <strong class="font-medium text-slate-500 dark:text-slate-400">@包子全是水</strong> (April 2026 and June 2025 series respectively). QROST added more samples and independently computed climate, elevation, POI distances and hazard exposure (Open-Meteo, OpenStreetMap and public records).</p>',
      methodMetricsTitle: 'How livability metrics are derived',
      methodMetricsBody: '<li><strong class="text-slate-700 dark:text-slate-300">Temperature / rainfall</strong>: Open-Meteo ERA5 <strong>2014–2023</strong> monthly means; annual rain = sum of 12 monthly means.</li><li><strong class="text-slate-700 dark:text-slate-300">Record high / low</strong>: prefer zh.wikipedia climate templates with <strong class="text-slate-700 dark:text-slate-300">CMA national-station extremes</strong>; otherwise ERA5 <strong>1940–2023</strong> grid-cell daily max/min (≈25 km, not a station record).</li><li><strong class="text-slate-700 dark:text-slate-300">Comfort / extreme by day</strong>: ERA5 daily climatology (10-year day-of-year mean, 15-day smoothed). Comfort = daily low ≥8°C and high ≤26°C; extreme = mean &lt; -5°C (severe cold; 0 to -4°C dry-cold excluded) or daily high ≥ 33°C (perceived discomfort, not CMA 35°C warning). <strong class="text-slate-700 dark:text-slate-300">Mutually exclusive</strong> (extreme wins if both apply). <strong class="text-slate-700 dark:text-slate-300">Livability thresholds</strong>, not official disaster warnings.</li><li><strong class="text-slate-700 dark:text-slate-300">Extended daily climate</strong> (same ERA5 daily pull, 10-yr smoothed annual counts, baked in DB): <strong>humid season</strong> (≈season length) mean RH≥70%; <strong>snow season</strong> (≈season length) snowfall&gt;0.05 cm; <strong>windy days</strong> daily max wind≥10 m/s; <strong>annual sunshine</strong> = sum of daily sunshine hours; <strong>apparent-comfort days</strong> mean apparent temp 10–28°C.</li><li><strong class="text-slate-700 dark:text-slate-300">PM2.5</strong>: sampled at listing coordinates from the ChinaHighPM2.5 (Zenodo 6398971) satellite-derived <strong>1km</strong> grid — annual + heating-season (Nov–Mar) means, reference year 2020; <strong class="text-slate-700 dark:text-slate-300">model reanalysis, not station readings</strong>.</li><li><strong class="text-slate-700 dark:text-slate-300">Seasonal swing</strong> (°C) = warmest-month mean − coldest-month mean. <strong class="text-slate-700 dark:text-slate-300">Climate archetypes</strong> follow published Ta and swing thresholds.</li><li><strong class="text-slate-700 dark:text-slate-300">Heating</strong>: provincial Qinling–Huaihe district-heating line convention.</li><li><strong class="text-slate-700 dark:text-slate-300">Unit price</strong> = total ÷ area; <strong class="text-slate-700 dark:text-slate-300">gross yield</strong> = rent×12 ÷ total.</li><li><strong class="text-slate-700 dark:text-slate-300">US samples (California)</strong>: sale listings use Compass/Realtor comps; <strong class="text-slate-700 dark:text-slate-300">rental-only</strong> apartments (e.g. Mariposa) use <strong class="text-slate-700 dark:text-slate-300">annual rent ÷ 4.5% cap rate</strong> as implied value for yield comparison. Airport/coast distances use SoCal offline vertices, not China datasets.</li>',
      methodLimitsTitle: 'Important limitations',
      methodLimitsBody: '<li>Each row is a <strong class="text-slate-700 dark:text-slate-300">single asking-price observation</strong>, <strong class="text-slate-700 dark:text-slate-300">not a market average</strong>.</li><li><strong class="text-slate-700 dark:text-slate-300">Climate / elevation</strong> are coordinate approximations; hazard recurrence is coarse context, not engineering-grade.</li><li>For curiosity and research only — <strong class="text-slate-700 dark:text-slate-300">not investment, relocation, legal or tax advice</strong>.</li>',
      lmSatNote: 'Satellite imagery © Esri World Imagery. Geocode precision shown above.',
      lmNearNote: 'Nearby POIs from OpenStreetMap (coverage may be thin in small towns); airports/coastlines are offline-computed.',
      lmClimateNote: 'Climate = 2014–2023 monthly means (Open-Meteo ERA5); hazards refined per listing coordinates from prefecture history — still approximate, not engineering input.',
      lmCloseAria: 'Close',
      themeToggleAria: 'Toggle dark / light mode',
      baseMapSuffix: ' basemap',
      comfortLabel: 'Comfort', extremeLabel: 'Extreme', noExtreme: 'No extreme days',
      builtUnknown: 'unknown', builtApprox: '~', builtYearTitle: 'Built', builtAgeTitle: 'Age',
      builtUnknownTitle: 'Completion year unknown (not found in public sources)',
      builtDecadeNote: ' (decade-level estimate)', builtSource: 'Source',
      noGeoData: 'No geocode data', noRiskData: 'No risk data',
      climateRiskTitle: 'Climate & risk (approx.)', winterHeating: 'Winter heating',
      hazardOverview: 'provincial hazard history', swingLabel: 'seasonal swing',
      coldestMonth: 'coldest mo.', hottestMonth: 'hottest mo.', annualMean: 'annual mean',
      histTempTitle: 'Historical temperature extremes', histTempMaxTitle: 'Record high', histTempMinTitle: 'Record low',
      histTempNoteWiki: 'Wikipedia climate template (CMA national-station extremes where cited)',
      histTempNoteEra5: 'ERA5 grid daily extrema 1940–2023 (~16 mi cell, not a station record)',
      histTempNoteClimate: 'ERA5 2014–2023 monthly extrema (district union, not all-time station records)',
      provExtremeTitle: 'Extreme', provExtremeListings: ' listings extreme',
      provExtremeUnion: 'Extreme-day spans (province union)', provExtremePerListing: ' d/listing',
      pageTitle: 'Where is it livable and affordable · China small-city housing | QROST',
      provSample: 'n', provAvgTotal: 'avg total', provAvgUnit: 'avg unit',
      provAvgSwing: 'avg swing', provAvgExtreme: 'avg extreme',
      poiMetro: 'Metro', poiTrain: 'Rail / HSR', poiTrainHSR: 'HSR', poiTrainRegular: 'Regular rail',
      poiAirport: 'Airport', poiHospital: 'Hospital',
      poiCommunity: 'Community', chartHigh: 'Daily high', chartLow: 'Daily low',
      chartMeanComfort: 'Daily mean (green=comfort, red=extreme)', chartPrecip: 'Rain (in)',
      chartMeanTemp: 'Mean temp (°F)', chartMeanHigh: 'Mean high', chartMeanLow: 'Mean low',
      monthNames: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    },
  };


  const GEO = () => window.HOUSING_GEO_EN || { province: {}, city: {}, district: {} };
  const ENUM = {
  "HAZARD_TYPE_ZH": {
    "地质灾害": "滑坡/泥石流",
    "暴雨": "暴雨洪涝",
    "洪涝": "暴雨洪涝",
    "洪涝内涝": "暴雨洪涝",
    "风暴潮": "台风（含海岸增水）",
    "海岸增水": "海岸增水"
  },
  "HAZARD_TYPE_EN": {
    "凝冻": "Freezing rain/ice",
    "台风": "Typhoon",
    "台风外围": "Typhoon outer bands",
    "地质灾害": "Landslide / debris flow",
    "地震": "Earthquake",
    "地面沉降": "Land subsidence",
    "干旱": "Drought",
    "暴雨洪涝": "Heavy rain & flood",
    "暴雨": "Heavy rain & flood",
    "暴雪": "Blizzard",
    "暴雪雪灾": "Blizzard/snow disaster",
    "森林火灾": "Forest fire",
    "沙尘暴": "Sandstorm",
    "洪涝": "Heavy rain & flood",
    "洪涝内涝": "Heavy rain & flood",
    "风暴潮": "Typhoon (incl. coastal surge)",
    "海岸增水": "Coastal surge",
    "高温": "Extreme heat",
    "高温干旱": "Heat & drought",
    "龙卷风": "Tornado",
    "冰雹风雹": "Hail / wind hail",
    "海冰": "Sea ice",
    "滑坡": "Landslide",
    "泥石流": "Debris flow",
    "崩塌": "Rockfall"
  },
  "FREQ_SHORT_EN": {
    "年年": "annual",
    "数年": "few-yr",
    "十年": "~10yr",
    "数十年": "~decades",
    "百年": "~century"
  },
  "FREQ_LABEL_EN": {
    "几乎年年": "Nearly annual",
    "数年一遇": "Every few years",
    "约十年一遇": "~Once per decade",
    "数十年一遇": "Every few decades",
    "百年级罕见": "Century-scale rare"
  },
  "FREQ_COMMONNESS": {
    "1": "极少",
    "2": "少见",
    "3": "偶尔",
    "4": "较常见",
    "5": "很常见"
  },
  "FREQ_COMMONNESS_EN": {
    "1": "very rare",
    "2": "uncommon",
    "3": "occasional",
    "4": "fairly common",
    "5": "very common"
  },
  "CLIMATE_EN": {
    "四季如春": "Spring-like year-round",
    "常年温暖": "Warm year-round",
    "四季分明": "Four distinct seasons",
    "长夏无冬": "Long summer, no winter",
    "夏热冬暖": "Hot summer, mild winter",
    "冬暖夏凉": "Mild winter, cool summer",
    "常年凉冷": "Cool year-round",
    "温和过渡": "Mild transitional"
  },
  "HEATING_EN": {
    "集中供暖": "Central heating",
    "部分供暖": "Partial heating",
    "无·冬暖": "No heating (mild winter)",
    "无·湿冷": "No heating (damp cold)"
  },
  "SEISMIC_EN": {
    "高": "High",
    "较高": "Moderately high",
    "中": "Moderate",
    "低": "Low"
  },
  "TYPHOON_EN": {
    "高": "High",
    "中": "Moderate",
    "弱": "Weak",
    "极低": "Very low"
  },
  "GEO_LABEL_EN": {
    "城市级": "City-level",
    "小区级": "Community-level",
    "街道/镇级": "Street/town-level",
    "调研细化": "Research-refined",
    "邻近双月湾板块": "Near Shuangyue Bay area"
  },
  "HEATING_NOTE_EN": {
    "供暖线以南却冬季湿冷，且无集中供暖（取暖靠自备）": "South of the heating line: damp cold winters without district heating (self-heated).",
    "供暖线以南，冬季温暖、基本无需供暖": "South of the heating line: mild winters, heating rarely needed.",
    "秦岭-淮河线以北，市政集中供暖": "North of the Qinling–Huaihe line: municipal district heating.",
    "跨供暖线，淮河以北部分城市有集中供暖": "Straddles the heating line: some cities north of the Huai have district heating."
  },
  "HEADLINE_EN": {
    "沿海台风+城市内涝；缓发地面沉降": "Coastal typhoons + urban flooding; slow land subsidence",
    "多震带+干湿季地质灾害与季节性干旱": "Multi-fault seismicity + seasonal geohazards and drought",
    "华北平原旱涝+冬季暴雪；地震风险低于唐山带": "N. China Plain drought/flood + winter blizzards; lower quake risk than Tangshan belt",
    "夏汛、暴雪与西部干旱；地震少": "Summer floods, blizzards, western drought; few quakes",
    "高烈度地震(约十年一遇)+山地次生灾害": "High-intensity quakes (~decadal) + mountain secondary hazards",
    "华北平原旱涝+滨海风暴潮/海冰；唐山强震带波及": "N. China Plain drought/flood + coastal storm surge/sea ice; Tangshan belt influence",
    "江淮梅雨洪涝为最大风险": "Yangtze–Huai Meiyu flooding is the top risk",
    "旱涝+北上台风影响沿海": "Drought/flood + north-tracking typhoons affect the coast",
    "台风+流域性洪涝的双高暴露": "Dual high exposure: typhoons + basin flooding",
    "洪涝+台风+喀斯特地质灾害": "Floods + typhoons + karst geohazards",
    "台风、洪涝，偶发强龙卷": "Typhoons, floods, occasional strong tornadoes",
    "华北强震带(数十年一遇)+旱涝交替": "N. China strong-quake belt (decadal) + drought/flood alternation",
    "暴雨洪涝突出，旱涝并存": "Heavy-rain flooding prominent; drought and flood coexist",
    "台风暴雨+梅雨洪涝；沿海风暴潮": "Typhoon rains + Meiyu floods; coastal storm surge",
    "全国台风登陆最前沿": "Front line of typhoon landfalls nationwide",
    "长江流域洪涝突出，伏旱与高温并存": "Yangtze basin floods prominent; summer drought and heat coexist",
    "强震+半干旱区旱灾与黄土滑坡": "Strong quakes + semi-arid drought and loess landslides",
    "台风高暴露+山区地质灾害": "High typhoon exposure + mountain geohazards",
    "喀斯特地质灾害突出，冬季凝冻为特色风险": "Karst geohazards prominent; winter freezing rain a signature risk",
    "夏汛+北上台风外围，海城式中强震(数十年一遇)": "Summer floods + north-tracking typhoon bands; Haicheng-class moderate quakes (decadal)",
    "高温伏旱+山地滑坡+江河洪涝": "Summer heat drought + mountain slides + river floods",
    "夏汛+冬季暴雪为主；无台风、地震少": "Summer floods + winter blizzards dominate; few typhoons/quakes"
  },
  "HAZARD_NOTE_EN": {
    "2016盐城EF4，强龙卷罕见": "2016 Yancheng EF4 — strong tornadoes are rare",
    "三峡库区滑坡/崩塌": "Three Gorges reservoir landslides/rockfalls",
    "东部": "Eastern region",
    "伏旱": "Mid-summer drought",
    "冬季": "Winter season",
    "冬季强降雪": "Heavy winter snowfall",
    "冬季强降雪致灾，数年一遇": "Damaging heavy winter snow, every few years",
    "冬季致灾性降雪": "Damaging winter snowfall",
    "冬季雨雪冰冻致灾(2008特大为数十年一遇)": "Winter rain/snow/ice damage (2008 extreme was decadal)",
    "冬春季节性": "Seasonal spring/winter pattern",
    "利奇马2019等北上台风": "North-tracking typhoons e.g. Lekima 2019",
    "前汛期强降水": "Pre-monsoon heavy rain",
    "北部湾沿海": "Beibu Gulf coast",
    "半干旱气候，常年缺水": "Semi-arid climate, chronic water shortage",
    "华北强震带外围，1976唐山距城较远": "Periphery of N. China quake belt; 1976 Tangshan far from city",
    "华北强震带，1976唐山距津约100km波及": "N. China quake belt; 1976 Tangshan ~100 km from Tianjin",
    "台风暴雨": "Typhoon rainfall",
    "唐山1976/邢台1966，华北强震带": "Tangshan 1976 / Xingtai 1966 — N. China quake belt",
    "喀斯特山区滑坡/塌陷": "Karst mountain landslides/subsidence",
    "喀斯特滑坡/泥石流/塌陷": "Karst landslides/debris flows/subsidence",
    "夏季伏旱(2022极端)": "Mid-summer drought (2022 extreme)",
    "夏季强对流": "Summer severe convection",
    "夏季暴雨": "Summer heavy rain",
    "夏季极端高温": "Summer extreme heat",
    "夏季湿热": "Hot humid summer",
    "夏旱": "Summer drought",
    "夏秋登陆/影响": "Late-summer/autumn landfall or influence",
    "多条活动断裂带，鲁甸2014等": "Multiple active faults; Ludian 2014 etc.",
    "大兴安岭林区(1987特大火)": "Greater Khingan forests (1987 mega-fire)",
    "太行山前极端暴雨": "Extreme rain at Taihang piedmont",
    "局部中小震": "Local moderate/small quakes",
    "局部弱震": "Local weak quakes",
    "山区滑坡/崩塌": "Mountain landslides/rockfalls",
    "春旱": "Spring drought",
    "春旱常见": "Spring drought common",
    "暴雨城市内涝": "Downpour urban waterlogging",
    "松花江/嫩江流域夏季汛情(1998等)": "Songhua/Nen summer floods (1998 etc.)",
    "桂西季节性": "Western Guangxi seasonal pattern",
    "梅雨/强对流": "Meiyu / severe convection",
    "梅雨季/台风暴雨": "Meiyu season / typhoon rains",
    "梅雨季强降水": "Meiyu season heavy rain",
    "正面登陆频繁": "Frequent direct landfalls",
    "江淮梅雨/2020巢湖": "Yangtze–Huai Meiyu / 2020 Chaohu",
    "汶川2008/芦山/泸定，龙门山带": "Wenchuan 2008 / Lushan / Luding — Longmenshan belt",
    "河口沿海": "Estuary coast",
    "河西走廊春季": "Hexi Corridor spring season",
    "沿海": "Coastal",
    "沿海受北上台风影响": "Coast affected by north-tracking typhoons",
    "沿海登陆/影响频繁": "Frequent coastal landfall/influence",
    "泥石流/滑坡(震后高发)": "Debris flows/landslides (post-quake spike)",
    "流域性洪涝；2021郑州为千年一遇极端": "Basin flooding; 2021 Zhengzhou was millennial extreme",
    "海城1975 M7.3": "Haicheng 1975 M7.3",
    "海河流域(2023大水)": "Hai River basin (2023 major flood)",
    "海河流域+城区暴雨内涝": "Hai River basin + urban downpour flooding",
    "海河流域+城区暴雨内涝(2012/2016)": "Hai River basin + urban flooding (2012/2016)",
    "淮河下游/太湖": "Lower Huai / Taihu",
    "渤海湾沿海(滨海新区)，内陆武清经物理降尺度自动剔除": "Bohai Bay coast (Binhai); inland Wuqing excluded by downscaling",
    "珠江/西江流域": "Pearl / Xijiang basin",
    "登陆最频繁": "Most frequent landfalls",
    "登陆最频繁省份之一": "Among provinces with most landfalls",
    "盆地伏旱": "Basin mid-summer drought",
    "盆地暴雨": "Basin downpours",
    "第二松花江流域": "Second Songhua basin",
    "缓发·长期监测累积": "Slow-onset; long-term monitoring accumulation",
    "西江/郁江流域": "Xijiang / Yujiang basin",
    "西部": "Western region",
    "西部春旱": "Western spring drought",
    "辽河流域": "Liao River basin",
    "辽西": "Western Liaoning",
    "郯庐带，郯城1668历史大震": "Tanlu belt; 1668 Tancheng historic mega-quake",
    "钱塘江/苕溪流域": "Qiantang / Tiaoxi basin",
    "长江/嘉陵江": "Yangtze / Jialing",
    "长江/汉江流域(1998/2020)": "Yangtze / Han basin (1998/2020)",
    "闽江流域": "Min River basin",
    "陇南/积石山2023等": "Longnan / Jishishan 2023 etc.",
    "雨季": "Rainy season",
    "雨季泥石流/滑坡": "Rainy-season debris flows/landslides",
    "黄土滑坡/泥石流": "Loess landslides/debris flows",
    "黄淮/沂沭河": "Huang-Huai / Yishu River",
    "黄淮春夏旱": "Huang-Huai spring/summer drought"
  },
  "FIELD_LABEL_EN": {
    "1月均温": "Jan mean temp",
    "7月均温": "Jul mean temp",
    "海拔": "Elevation",
    "年降水": "Annual rainfall"
  }
};

  function pick(map, zh) {
    if (!zh) return zh;
    if (!isEn()) return zh;
    return (map && map[zh]) || null;
  }

  function displayProvince(zh) { return pick(GEO().province, zh) || zh; }
  function displayCity(zh) {
    if (!zh) return zh;
    if (!isEn()) return zh;
    return GEO().city[zh] || zh.replace(/市$/, '');
  }
  function displayDistrict(zh) {
    if (!zh) return zh;
    if (!isEn()) return zh;
    const en = GEO().district[zh];
    if (en && !hasChinese(en)) return en;
    return zh;
  }
  function displayClimate(zh) { return pick(ENUM.CLIMATE_EN, zh) || zh; }
  function displayHeating(zh) { return pick(ENUM.HEATING_EN, zh) || zh; }
  function displayHazardType(zh) {
    if (!zh) return zh;
    if (!isEn()) return (ENUM.HAZARD_TYPE_ZH && ENUM.HAZARD_TYPE_ZH[zh]) || zh;
    return pick(ENUM.HAZARD_TYPE_EN, zh) || zh;
  }
  function displayFreqShort(zh) { return pick(ENUM.FREQ_SHORT_EN, zh) || zh; }
  function displayFreqLabel(zh) { return pick(ENUM.FREQ_LABEL_EN, zh) || zh; }
  function displayFreqCommonness(freq) {
    const k = String(Math.round(Number(freq)));
    if (!ENUM.FREQ_COMMONNESS[k]) return '';
    return isEn() ? (ENUM.FREQ_COMMONNESS_EN[k] || ENUM.FREQ_COMMONNESS[k]) : ENUM.FREQ_COMMONNESS[k];
  }
  function displaySeismic(zh) { return pick(ENUM.SEISMIC_EN, zh) || zh; }
  function displayTyphoon(zh) { return pick(ENUM.TYPHOON_EN, zh) || zh; }
  function displayGeoLabel(zh) { return pick(ENUM.GEO_LABEL_EN, zh) || zh; }
  function displayHeadline(zh) {
    if (!zh || !isEn()) return zh;
    return pick(ENUM.HEADLINE_EN, zh) || 'Regional hazard exposure (see tags below)';
  }
  function displayHazardNote(zh) {
    if (!zh || !isEn()) return zh;
    return pick(ENUM.HAZARD_NOTE_EN, zh) || '';
  }
  function displayHeatingNote(zh) { return pick(ENUM.HEATING_NOTE_EN, zh) || ''; }
  function displayFieldLabel(zh) { return pick(ENUM.FIELD_LABEL_EN, zh) || zh; }

  const MONTH_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function formatDoy(doy) {
    let m = 0, x = Math.max(1, Math.min(365, Math.round(doy)));
    while (x > [31,28,31,30,31,30,31,31,30,31,30,31][m]) { x -= [31,28,31,30,31,30,31,31,30,31,30,31][m]; m += 1; }
    if (!isEn()) return (m + 1) + '月' + x + '日';
    return MONTH_EN[m] + ' ' + x;
  }

  function displayRiskSummary(summary) {
    if (!summary || !isEn()) return summary;
    return summary
      .replace(/深处内陆/g, 'Deep inland')
      .replace(/距海岸约 (\d+)km/g, (_, km) => {
        const n = Number(km);
        if (!Number.isFinite(n)) return `~${km} km from coast`;
        const mi = n * KM_TO_MI;
        return mi < 0.1 ? `~${Math.round(n * KM_TO_FT)} ft from coast` : `~${trim(mi.toFixed(1))} mi from coast`;
      })
      .replace(/台风暴露 极低/g, 'Typhoon exposure: very low')
      .replace(/台风暴露 弱/g, 'Typhoon exposure: weak')
      .replace(/台风暴露 中/g, 'Typhoon exposure: moderate')
      .replace(/台风暴露 高/g, 'Typhoon exposure: high')
      .replace(/地震动\(省级近似\) 低/g, 'Seismic hazard (prov. approx.): low')
      .replace(/地震动\(省级近似\) 中/g, 'Seismic hazard (prov. approx.): moderate')
      .replace(/地震动\(省级近似\) 较高/g, 'Seismic hazard (prov. approx.): moderately high')
      .replace(/地震动\(省级近似\) 高/g, 'Seismic hazard (prov. approx.): high')
      .replace(/1月均温 /g, 'Jan mean ')
      .replace(/7月均温 /g, 'Jul mean ')
      .replace(/(\d+(?:\.\d+)?)℃/g, (_, n) => formatTemp(Number(n)))
      .replace(/[\u4e00-\u9fff]+/g, '').replace(/\s*·\s*·/g, ' · ').replace(/^\s*·\s*|\s*·\s*$/g, '').trim();
  }

  function hasChinese(s) { return /[\u4e00-\u9fff]/.test(s || ''); }

  function t(key, vars) {
    const bag = LABELS[lang];
    let s = (bag && Object.prototype.hasOwnProperty.call(bag, key) ? bag[key] : null);
    if (s == null) s = LABELS.zh[key] || key;
    if (vars) Object.keys(vars).forEach((k) => { s = s.replace(`{${k}}`, vars[k]); });
    return s;
  }

  function isEn() { return lang === 'en'; }
  function getLang() { return lang; }
  function getRate() { return cnyPerUsd; }
  function getRateSource() { return rateSource; }

  function communityName(loc, nameEn) {
    if (nameEn) return nameEn;
    if (!isEn()) return loc;
    return PINYIN()[loc] || loc;
  }

  function formatMoneyCny(cny) {
    if (cny == null || !Number.isFinite(cny)) return '—';
    if (!isEn()) return '¥' + Math.round(cny).toLocaleString('zh-CN');
    return '$' + Math.round(cny / cnyPerUsd).toLocaleString('en-US');
  }

  function formatPriceWan(wan) {
    if (wan == null || !Number.isFinite(wan)) return '—';
    if (!isEn()) return trim(wan.toFixed(2)) + '万';
    return formatMoneyCny(wan * 10000);
  }

  function priceAxisValue(wan) {
    if (wan == null) return null;
    return isEn() ? (wan * 10000) / cnyPerUsd : wan;
  }

  function formatArea(sqm) {
    if (sqm == null || !Number.isFinite(sqm)) return '—';
    if (!isEn()) return trim(sqm.toFixed(1)) + '㎡';
    return Math.round(sqm * SQM_TO_SQFT).toLocaleString('en-US') + ' sqft';
  }

  function formatUnitPrice(cnyPerSqm) {
    if (cnyPerSqm == null || !Number.isFinite(cnyPerSqm)) return '—';
    if (!isEn()) return Math.round(cnyPerSqm).toLocaleString('zh-CN') + '元/㎡';
    const usdPerSqft = (cnyPerSqm / cnyPerUsd) / SQM_TO_SQFT;
    return '$' + Math.round(usdPerSqft).toLocaleString('en-US') + '/sqft';
  }

  function formatRent(cny) {
    return formatMoneyCny(cny);
  }

  function celsiusToF(c) { return c * 9 / 5 + 32; }
  function celsiusDeltaToF(c) { return c * 9 / 5; }

  function formatTemp(celsius) {
    if (celsius == null || !Number.isFinite(celsius)) return '—';
    if (!isEn()) return Math.round(celsius) + '°C';
    return Math.round(celsiusToF(celsius)) + '°F';
  }

  function formatTempSwing(celsius) {
    if (celsius == null || !Number.isFinite(celsius)) return '—';
    if (!isEn()) return trim(celsius.toFixed(1)) + '°C';
    return trim(celsiusDeltaToF(celsius).toFixed(1)) + '°F';
  }

  function formatDist(km) {
    if (km == null || !Number.isFinite(km)) return '—';
    if (!isEn()) {
      return km < 1 ? Math.round(km * 1000) + 'm' : (km < 10 ? trim(km.toFixed(1)) : Math.round(km)) + ' km';
    }
    const mi = km * KM_TO_MI;
    if (mi < 0.1) return Math.round(km * KM_TO_FT) + ' ft';
    return (mi < 10 ? trim(mi.toFixed(1)) : Math.round(mi)) + ' mi';
  }

  function formatElevation(meters) {
    if (meters == null || !Number.isFinite(meters)) return '—';
    if (!isEn()) return Math.round(meters).toLocaleString('zh-CN') + 'm';
    const ft = meters * M_TO_FT;
    return Math.round(ft).toLocaleString('en-US') + ' ft';
  }

  function formatPrecip(mm) {
    if (mm == null || !Number.isFinite(mm)) return '—';
    if (!isEn()) return Math.round(mm).toLocaleString('zh-CN') + 'mm';
    return trim((mm * MM_TO_IN).toFixed(1)) + ' in';
  }

  function precipChartValue(mm) {
    if (mm == null || !Number.isFinite(mm)) return null;
    return isEn() ? mm * MM_TO_IN : mm;
  }

  function precipAxisLabel() { return isEn() ? 'in' : 'mm'; }

  function tempChartValue(celsius) {
    if (celsius == null || !Number.isFinite(celsius)) return null;
    return isEn() ? celsiusToF(celsius) : celsius;
  }

  function tempAxisLabel() { return isEn() ? '°F' : '°C'; }

  function formatFieldLegend(value, unit) {
    if (value == null || !Number.isFinite(value)) return '—';
    if (unit === '℃' || unit === '°C') return formatTemp(value);
    if (unit === 'm') return formatElevation(value);
    if (unit === 'mm') return formatPrecip(value);
    return Math.round(value).toLocaleString(isEn() ? 'en-US' : 'zh-CN') + unit;
  }

  function formatInt(v) {
    if (v == null) return '—';
    return Math.round(v).toLocaleString(isEn() ? 'en-US' : 'zh-CN');
  }

  function updateFxNote() {
    const el = document.getElementById('fx-rate-note');
    if (!el) return;
    if (!isEn()) {
      el.textContent = t('fxNoteZh');
      return;
    }
    const rate = cnyPerUsd.toFixed(2);
    const key = rateSource === 'live' ? 'fxNoteLive' : rateSource === 'cached' ? 'fxNoteCached' : 'fxNoteFallback';
    el.innerHTML = t(key, { rate });
  }

  function formatCommitDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    if (lang === 'en') {
      return d.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    }
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function builtAtLabel(iso) {
    const when = formatCommitDate(iso || lastCommitIso);
    if (!when) return t('footerBuiltPrefix');
    return `${t('footerBuiltPrefix')} ${when}`;
  }

  function updateBuiltAtEl() {
    const el = document.getElementById('page-built-at');
    if (!el) return;
    el.textContent = builtAtLabel();
  }

  function setLastCommitIso(iso) {
    if (!iso) return;
    lastCommitIso = iso;
    updateBuiltAtEl();
  }

  async function fetchPageBuiltAt() {
    if (typeof fetch !== 'function') return;
    try {
      const cached = JSON.parse(sessionStorage.getItem(BUILT_AT_CACHE_KEY) || 'null');
      if (cached && cached.iso && Date.now() - cached.at < 3600000) {
        lastCommitIso = cached.iso;
        updateBuiltAtEl();
      }
    } catch (e) { /* */ }
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
      const res = await fetch(GITHUB_COMMITS_API, {
        headers: { Accept: 'application/vnd.github+json' },
        ...(ctrl ? { signal: ctrl.signal } : {}),
      });
      if (timer) clearTimeout(timer);
      if (!res.ok) throw new Error('http ' + res.status);
      const commits = await res.json();
      const iso = commits && commits[0] && commits[0].commit && commits[0].commit.committer
        ? commits[0].commit.committer.date : null;
      if (!iso) return;
      lastCommitIso = iso;
      try {
        sessionStorage.setItem(BUILT_AT_CACHE_KEY, JSON.stringify({ iso, at: Date.now() }));
      } catch (e) { /* */ }
      updateBuiltAtEl();
    } catch (e) { /* keep cached or static HTML fallback */ }
  }

  function applyStaticI18n() {
    const map = [
      ['skip-link', 'skipLink', 'text'],
      ['nav-home', 'navHome', 'aria'],
      ['nav-overview', 'navOverview', 'text'],
      ['nav-rankings', 'navRankings', 'text'],
      ['nav-geo', 'navGeo', 'text'],
      ['nav-table', 'navTable', 'text'],
      ['hero-eyebrow', 'heroEyebrow', 'text'],
      ['hero-title', 'heroTitle', 'html'],
      ['hero-body', 'heroBody', 'html'],
      ['hero-disclaimer', 'heroDisclaimer', 'html'],
      ['sec-overview-h', 'secOverview', 'text'],
      ['sec-overview-p', 'secOverviewDesc', 'html'],
      ['sec-rankings-h', 'secRankings', 'text'],
      ['sec-rankings-p', 'secRankingsDesc', 'text'],
      ['sec-geo-h', 'secGeo', 'text'],
      ['sec-geo-p', 'secGeoDesc', 'html'],
      ['dim-overlay-label', 'dimOverlay', 'text'],
      ['base-overlay-label', 'baseOverlay', 'text'],
      ['prov-compare-label', 'provCompare', 'text'],
      ['sec-table-h', 'secTable', 'text'],
      ['sec-table-p', 'secTableDesc', 'html'],
      ['show-cols-label', 'showCols', 'text'],
      ['filter-chips-label', 'filterChipsLabel', 'text'],
      ['sec-quiz-h', 'secQuiz', 'text'],
      ['sec-quiz-p', 'secQuizDesc', 'html'],
      ['qz-budget-label', 'qzBudget', 'text'],
      ['qz-winter-label', 'qzWinter', 'text'],
      ['qz-summer-label', 'qzSummer', 'text'],
      ['qz-hazard-label', 'qzHazard', 'text'],
      ['methodology-summary', 'methodologySummary', 'text'],
      ['i18n-method-title', 'i18nMethodTitle', 'text'],
      ['i18n-method-body', 'i18nMethodBody', 'html'],
      ['footer-thanks', 'footerThanks', 'html'],
      ['footer-disclaimer', 'footerDisclaimer', 'text'],
      ['tier1-label', 'tier1Label', 'text'],
      ['method-data-title', 'methodDataTitle', 'text'],
      ['method-data-body', 'methodDataBody', 'html'],
      ['method-metrics-title', 'methodMetricsTitle', 'text'],
      ['method-metrics-body', 'methodMetricsBody', 'html'],
      ['method-comfort-extreme-title', 'methodComfortExtremeTitle', 'text'],
      ['method-comfort-extreme-body', 'methodComfortExtremeBody', 'html'],
      ['method-limits-title', 'methodLimitsTitle', 'text'],
      ['method-limits-body', 'methodLimitsBody', 'html'],
      ['lm-sat-note', 'lmSatNote', 'text'],
      ['lm-near-note', 'lmNearNote', 'text'],
      ['lm-climate-note', 'lmClimateNote', 'text'],
    ];
    map.forEach(([id, key, kind]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (kind === 'html') el.innerHTML = t(key);
      else if (kind === 'aria') el.setAttribute('aria-label', t(key));
      else el.textContent = t(key);
    });
    const search = document.getElementById('table-search');
    if (search) search.placeholder = t('searchPlaceholder');
    const qzRent = document.getElementById('qz-rent');
    if (qzRent) qzRent.placeholder = t('qzRentPlaceholder');
    const csvBtn = document.getElementById('csv-export');
    if (csvBtn) csvBtn.textContent = t('exportCsv');
    document.querySelectorAll('[data-group]').forEach((b) => {
      const g = b.dataset.group;
      const keys = { live: 'groupLive', infra: 'groupInfra', risk: 'groupRisk', invest: 'groupInvest' };
      if (keys[g]) b.textContent = t(keys[g]);
    });
    ['map-zoom-in', 'map-zoom-out', 'map-zoom-reset'].forEach((id, i) => {
      const el = document.getElementById(id);
      const keys = ['mapZoomIn', 'mapZoomOut', 'mapZoomReset'];
      if (el) { el.setAttribute('aria-label', t(keys[i])); if (id === 'map-zoom-reset') el.title = t('mapZoomReset'); }
    });
    const lmClose = document.getElementById('lm-close');
    if (lmClose) lmClose.setAttribute('aria-label', t('lmCloseAria'));
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.setAttribute('aria-label', t('themeToggleAria'));
    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
      langBtn.textContent = lang === 'zh' ? 'EN' : '中';
      langBtn.setAttribute('aria-label', t('langToggleAria'));
      langBtn.setAttribute('title', lang === 'zh' ? 'English' : '中文');
    }
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    document.title = t('pageTitle');
    updateBuiltAtEl();
    updateFxNote();
  }

  async function fetchExchangeRate() {
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 5000) : null;
      const res = await fetch(FX_API, ctrl ? { signal: ctrl.signal } : {});
      if (timer) clearTimeout(timer);
      if (!res.ok) throw new Error('http ' + res.status);
      const data = await res.json();
      if (data.rates && data.rates.CNY > 0) {
        cnyPerUsd = data.rates.CNY;
        rateSource = 'live';
        try { sessionStorage.setItem(FX_CACHE_KEY, JSON.stringify({ rate: cnyPerUsd, at: Date.now() })); } catch (e) { /* */ }
        updateFxNote();
        return;
      }
    } catch (e) { /* fall through */ }
    try {
      const cached = JSON.parse(sessionStorage.getItem(FX_CACHE_KEY) || 'null');
      if (cached && cached.rate > 0 && Date.now() - cached.at < 86400000) {
        cnyPerUsd = cached.rate;
        rateSource = 'cached';
        updateFxNote();
        return;
      }
    } catch (e) { /* */ }
    cnyPerUsd = FALLBACK_CNY_PER_USD;
    rateSource = 'fallback';
    updateFxNote();
  }

  function setLang(l, skipCb) {
    if (l !== 'zh' && l !== 'en') return;
    lang = l;
    try { localStorage.setItem(STORAGE_KEY, l); } catch (e) { /* */ }
    applyStaticI18n();
    if (!skipCb && onChangeCb) onChangeCb();
  }

  function toggleLang() { setLang(lang === 'zh' ? 'en' : 'zh'); }

  function onLangChange(fn) { onChangeCb = fn; }

  window.HOUSING_I18N = {
    t, isEn, getLang, setLang, toggleLang, onLangChange,
    applyStaticI18n, fetchExchangeRate, fetchPageBuiltAt,
    formatCommitDate, builtAtLabel, setLastCommitIso, getLastCommitIso: () => lastCommitIso,
    formatMoneyCny, formatPriceWan, formatArea, formatUnitPrice, formatRent,
    formatTemp, formatTempSwing, formatDist, formatElevation, formatPrecip,
    precipChartValue, precipAxisLabel, tempChartValue, tempAxisLabel, formatFieldLegend,
    formatInt, communityName, priceAxisValue,
    displayProvince, displayCity, displayDistrict, displayClimate, displayHeating,
    displayHazardType, displayFreqShort, displayFreqLabel, displayFreqCommonness, displaySeismic, displayTyphoon,
    displayGeoLabel, displayHeadline, displayHazardNote, displayHeatingNote, displayFieldLabel,
    displayRiskSummary, formatDoy, hasChinese, MONTH_EN,
    getRate, getRateSource,
    SQM_TO_SQFT, KM_TO_MI, M_TO_FT, MM_TO_IN, FALLBACK_CNY_PER_USD, FX_API,
  };

  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
})();
