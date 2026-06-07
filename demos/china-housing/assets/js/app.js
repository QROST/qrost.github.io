/**
 * China small-city housing dashboard — livability-first.
 *
 * The page's purpose is to surface places that are BOTH cheap AND livable, not
 * to rank investment return. So the table is the master data source (price +
 * climate + infrastructure distance + regional hazard side by side), the map is
 * a big, zoomable overlay that recolours every listing by a chosen dimension
 * (price / temperature isotherm / annual rain / elevation / extreme-weather /
 * livability index), and the charts are just other views of the same table.
 *
 * Reads three baked globals (no runtime fetch except map tiles in the modal):
 *   window.HOUSING_LISTINGS  raw listings              (assets/data/listings.js)
 *   window.HOUSING_ENRICHED  geo/climate/poi/risk/elev (assets/data/enriched.js)
 *   window.HOUSING_HAZARDS   province hazard profile   (assets/data/hazards.js)
 *
 * Derived price metrics (kept for reference, de-emphasised):
 *   priceYuan = priceWan×10000 · unitPrice = priceYuan/area
 *   yieldPct  = rent×12/priceYuan×100 · payback = priceYuan/(rent×12)
 *
 * Derived livability metrics (from baked climate / elevation / pois):
 *   janTemp/julTemp  Jan & Jul mean ℃        annualPrecip  Σ monthly mm
 *   comfortMonths    months with 15≤tmean≤26  coldMonths  tmean<0
 *   hotMonths        tmax≥33                  extremeMonths cold+hot
 *   tempRange        warmest-month mean − coldest-month mean (℃, 年温差)
 *   climateType      label from (annualMean, tempRange): 四季如春 / 常年温暖 /
 *                    冬暖夏凉 / 夏热冬暖 / 长夏无冬 / 四季分明 / 常年凉冷 / 温和过渡
 *   hospitalKm/trainKm/airportKm/coastKm   nearest baked POI distance
 */
(function () {
  'use strict';

  // ---- palette -----------------------------------------------------------
  const C = {
    emerald: '#059669', emeraldSoft: 'rgba(5,150,105,0.55)',
    slate900: '#0f172a', slate500: '#64748b', slate400: '#94a3b8',
    slate300: '#cbd5e1', slate200: '#e2e8f0', grid: 'rgba(100,116,139,0.12)',
  };

  // ---- theme helpers (dark mode) -----------------------------------------
  const isDark = () => document.documentElement.classList.contains('dark');
  const themeText  = () => isDark() ? '#94a3b8' : C.slate500;
  const themeGrid  = () => isDark() ? 'rgba(148,163,184,0.12)' : C.grid;
  const themeBg    = () => isDark() ? '#1e293b' : '#ffffff';
  const themeStrip = () => isDark() ? '#1e293b' : '#ffffff'; // sticky headers in strips
  const themeMuted = () => isDark() ? '#94a3b8' : '#64748b';
  const themeBody  = () => isDark() ? '#cbd5e1' : '#334155';
  const themeStrong = () => isDark() ? '#f1f5f9' : '#0f172a';
  const themeFaint = () => isDark() ? '#64748b' : '#cbd5e1';
  const tcx = () => ({
    muted: isDark() ? 'text-slate-400' : 'text-slate-500',
    body: isDark() ? 'text-slate-300' : 'text-slate-700',
    strong: isDark() ? 'text-slate-100' : 'text-slate-900',
    faint: isDark() ? 'text-slate-600' : 'text-slate-300',
    badge: isDark() ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-500',
    hazardBg: isDark() ? 'rgba(248,250,252,0.06)' : 'rgba(15,23,42,0.04)',
  });

  // Province short form (as in the data) → full GeoJSON name (DataV / Aliyun).
  const PROV_FULL = {
    '北京': '北京市', '天津': '天津市',
    '黑龙江': '黑龙江省', '吉林': '吉林省', '辽宁': '辽宁省', '河北': '河北省',
    '河南': '河南省', '山东': '山东省', '安徽': '安徽省', '上海': '上海市',
    '江苏': '江苏省', '浙江': '浙江省', '湖北': '湖北省',
    '广东': '广东省', '广西': '广西壮族自治区', '福建': '福建省',
    '重庆': '重庆市', '贵州': '贵州省', '四川': '四川省', '云南': '云南省',
    '甘肃': '甘肃省', '海南': '海南省',
  };

  // ---- metric derivation -------------------------------------------------
  const RAW = window.HOUSING_LISTINGS || [];
  const ENR = window.HOUSING_ENRICHED || {};
  const HAZ = window.HOUSING_HAZARDS || {};

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const poiKm = (e, cat) => (e && e.pois && e.pois[cat] && e.pois[cat].distKm != null)
    ? e.pois[cat].distKm : null;

  // Pull a [tmean,tmax,tmin,precip] month tuple (climate keys are stringified).
  const moOf = (cl, m) => cl ? (cl[m] || cl[String(m)] || null) : null;

  // Format a set of month numbers (1-12) into readable cyclic ranges:
  //   [4,5,6,9,10] → "4–6月、9–10月"   [11,12,1,2] → "11月–次年2月"   all → "全年".
  function monthRanges(months) {
    if (!months || !months.length) return '无';
    if (months.length >= 12) return '全年';
    const set = new Set(months);
    const prev = (m) => (m === 1 ? 12 : m - 1);
    let start = months.find((m) => !set.has(prev(m)));   // a run boundary
    if (start == null) start = months[0];
    const runs = [];
    let runStart = null, last = null;
    for (let k = 0; k < 12; k++) {
      const m = ((start - 1 + k) % 12) + 1;
      if (set.has(m)) { if (runStart == null) runStart = m; last = m; }
      else if (runStart != null) { runs.push([runStart, last]); runStart = null; }
    }
    if (runStart != null) runs.push([runStart, last]);
    return runs.map(([a, b]) =>
      a === b ? `${a}月` : (a <= b ? `${a}–${b}月` : `${a}月–次年${b}月`)).join('、');
  }

  // Day-of-year (1-365) helpers, sharing the fixed non-leap calendar with enrich.py.
  const _DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  function doyToDate(doy) {
    let m = 0, x = Math.max(1, Math.min(365, Math.round(doy)));
    while (x > _DIM[m]) { x -= _DIM[m]; m += 1; }
    return `${m + 1}月${x}日`;
  }
  // [[s,e],…] day-of-year ranges → "4月18日–10月12日"（跨年 → "…–次年…"）.
  function dayRanges(ranges) {
    if (!ranges || !ranges.length) return '无';
    if (ranges.length === 1 && ranges[0][0] === 1 && ranges[0][1] === 365) return '全年';
    return ranges.map(([s, e]) =>
      s === e ? doyToDate(s)
        : (s <= e ? `${doyToDate(s)}–${doyToDate(e)}` : `${doyToDate(s)}–次年${doyToDate(e)}`)
    ).join('、');
  }
  // array[365] of truthy flags → cyclic day ranges → "M月D日…" string.
  function flagsToDayRange(flags) {
    const n = 365;
    if (!flags.some(Boolean)) return '无';
    if (flags.every(Boolean)) return '全年';
    let start = 0;
    for (let i = 0; i < n; i++) { if (flags[i] && !flags[(i - 1 + n) % n]) { start = i; break; } }
    const runs = []; let r0 = null, last = null;
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      if (flags[i]) { if (r0 == null) r0 = i; last = i; }
      else if (r0 != null) { runs.push([r0 + 1, last + 1]); r0 = null; }
    }
    if (r0 != null) runs.push([r0 + 1, last + 1]);
    return dayRanges(runs);
  }

  function deriveClimate(e) {
    const cl = e && e.climate;
    if (!cl) return {};
    const daily = (e && e.daily) || null;   // day-level (curve + comfort/extreme day ranges)
    const rows = [], comfortSet = [], extremeSet = [];
    for (let m = 1; m <= 12; m++) {
      const a = moOf(cl, m);
      if (!a) continue;
      rows.push(a);
      if (a[0] != null && a[0] >= 15 && a[0] <= 26) comfortSet.push(m);                  // 舒适: 月均温 15–26℃
      if ((a[0] != null && a[0] < 0) || (a[1] != null && a[1] >= 33)) extremeSet.push(m); // 极端: 严寒 或 酷热
    }
    const jan = moOf(cl, 1), jul = moOf(cl, 7);
    const annualPrecip = rows.reduce((s, a) => s + (a[3] || 0), 0);
    const tmeans = rows.map((a) => a[0]).filter((v) => v != null);
    const annualMean = tmeans.length ? tmeans.reduce((s, v) => s + v, 0) / tmeans.length : null;
    const comfortMonths = comfortSet.length;
    const coldMonths = rows.filter((a) => a[0] != null && a[0] < 0).length;        // freezing average month
    const hotMonths = rows.filter((a) => a[1] != null && a[1] >= 33).length;        // dominantly hot month
    const extremeMonths = extremeSet.length;
    // 年温差 = warmest-month mean − coldest-month mean (transparent, unit ℃).
    const monthMeans = rows.map((a) => a[0]).filter((v) => v != null);
    const tMin = monthMeans.length ? Math.min(...monthMeans) : null;
    const tMax = monthMeans.length ? Math.max(...monthMeans) : null;
    const tempRange = (tMin != null && tMax != null) ? Math.round((tMax - tMin) * 10) / 10 : null;
    return {
      janTemp: jan ? jan[0] : null, julTemp: jul ? jul[0] : null,
      annualPrecip: Math.round(annualPrecip), annualMean,
      comfortMonths, coldMonths, hotMonths, extremeMonths, comfortSet, extremeSet,
      daily,
      comfortDayCount: daily ? daily.comfortDayCount : null,
      extremeDayCount: daily ? daily.extremeDayCount : null,
      // day-precise ranges when daily climatology is baked, else month-bucketed
      comfortRange: daily ? dayRanges(daily.comfortDays) : monthRanges(comfortSet),
      extremeRange: daily ? dayRanges(daily.extremeDays) : monthRanges(extremeSet),
      tMin, tMax, tempRange, climateType: classifyClimate(tMin, tMax, annualMean),
    };
  }

  // Climate archetype from two transparent, unit-ed numbers: 年均温 (Ta, ℃) and
  // 年温差 R = warmest−coldest month mean (℃). Thresholds are published in the
  // methodology so the label is fully reproducible — no opaque composite score.
  function classifyClimate(tMin, tMax, Ta) {
    if (tMin == null || tMax == null || Ta == null) return null;
    const R = tMax - tMin;
    if (R >= 20) return '四季分明';                       // 大温差：冷冬热夏
    if (tMin >= 18) return '长夏无冬';                     // 冬天也暖（一直热）
    if (tMax <= 18) return '常年凉冷';                     // 夏天也凉（一直冷）
    if (tMax >= 27 && tMin >= 8) return '夏热冬暖';        // 华南：热夏暖冬
    if (R <= 12 && Ta >= 14 && Ta <= 22) return '四季如春'; // 温差小且温和（昆明型）
    if (R <= 14 && tMin >= 12) return '常年温暖';          // 冬不冷、夏不酷的稳定暖区（西双版纳型）
    if (tMax <= 26) return '冬暖夏凉';                     // 夏凉冬不寒
    return '温和过渡';
  }
  // Climate types are coloured along the TEMPERATURE spectrum (cold blue → hot
  // red), not by "good/bad" — so green stays reserved for value. Ordered warm→cold.
  const CLIMATE_STYLE = {
    '长夏无冬': ['#fee2e2', '#b91c1c'],   // hottest → red
    '夏热冬暖': ['#ffedd5', '#9a3412'],   // hot     → orange
    '常年温暖': ['#fef3c7', '#b45309'],   // warm    → amber
    '四季如春': ['#fef9c3', '#a16207'],   // mild    → warm yellow (was green)
    '温和过渡': ['#f1f5f9', '#64748b'],   // neutral → slate
    '冬暖夏凉': ['#cffafe', '#0e7490'],   // cool    → cyan
    '四季分明': ['#dbeafe', '#1d4ed8'],   // cold-ish→ blue
    '常年凉冷': ['#e0e7ff', '#3730a3'],   // coldest → indigo (was slate)
  };

  // Default view excludes listings above price thresholds (see SOP §5; tier1-check).
  const TIER1_MAX_PRICE_WAN = 20;   // 万元
  const TIER1_MAX_UNIT_YUAN = 5000; // 元/㎡
  function isDefaultHidden(d) {
    return d.priceWan > TIER1_MAX_PRICE_WAN
      || (d.priceWan * 10000 / d.area) > TIER1_MAX_UNIT_YUAN;
  }
  let tier1On = false;
  function viewData() {
    return tier1On ? DATA : DATA.filter((d) => !isDefaultHidden(d));
  }
  function viewGeocoded() {
    return viewData().filter((d) => d.enr && d.enr.lat != null);
  }

  const DATA = RAW.map((d) => {
    const priceYuan = d.priceWan * 10000;
    const rent = d.rent > 0 ? d.rent : null;          // 0 = 未调研/未知（非"免租"）→ 回报率/月租按未知处理
    const rentYear = rent != null ? rent * 12 : null;
    const e = ENR[d.id] || ENR[String(d.id)] || null;
    const cd = deriveClimate(e);
    return {
      ...d, enr: e, hazard: (e && e.hazard) || HAZ[d.prov] || null,  // per-listing (prefecture×physics) → province fallback
      heating: (HAZ[d.prov] && HAZ[d.prov].heating) || null,
      heatingNote: (HAZ[d.prov] && HAZ[d.prov].heatingNote) || '',
      priceYuan, unitPrice: priceYuan / d.area, rent, rentYear,
      yieldPct: rentYear != null ? (rentYear / priceYuan) * 100 : null,
      payback: rentYear != null ? priceYuan / rentYear : null,
      elevation: e && e.elevation != null ? e.elevation : null,
      builtYear: e && e.builtYear != null ? e.builtYear : null,
      builtYearSrc: (e && e.builtYearSrc) || null,
      builtYearApprox: !!(e && e.builtYearApprox),
      hospitalKm: poiKm(e, 'hospital'), trainKm: poiKm(e, 'train'),
      airportKm: poiKm(e, 'airport'), metroKm: poiKm(e, 'metro'),
      // Prefer metro only when plausibly nearby (matches enrich _CAT_MAX_KM.metro ≈ 12km).
      transitKm: (() => {
        const m = poiKm(e, 'metro'), t = poiKm(e, 'train');
        return m != null && m <= 12 ? m : t;
      })(),
      transitKind: (() => {
        const m = poiKm(e, 'metro');
        return m != null && m <= 12 ? 'metro' : 'train';
      })(),
      coastKm: e && e.risk ? e.risk.coastKm : poiKm(e, 'coast'),
      seismic: e && e.risk ? e.risk.seismic : null,
      typhoon: e && e.risk ? e.risk.typhoon : null,
      ...cd,
    };
  });

  // ---- formatting --------------------------------------------------------
  const trim = (s) => s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  const fmtWan = (v) => trim(v.toFixed(2)) + '万';
  const fmtInt = (v) => v == null ? '—' : Math.round(v).toLocaleString('en-US');
  const fmtPct = (v) => v == null ? '—' : v.toFixed(1) + '%';
  const fmtYrs = (v) => v == null ? '—' : v.toFixed(1);
  const fmtTemp = (v) => v == null ? '—' : Math.round(v) + '℃';
  const fmtKm = (v) => v == null ? '—' : (v < 1 ? Math.round(v * 1000) + 'm' : (v < 10 ? v.toFixed(1) : Math.round(v)) + 'km');
  const cityLabel = (d) => `${d.city.replace(/市$/, '')}·${d.loc}`;
  // null-safe sort key
  const nz = (v, def) => (v == null ? def : v);

  function median(arr) {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // colour mixing: a,b are [r,g,b]; t in 0..1
  function mix(a, b, t) {
    t = clamp(t, 0, 1);
    const c = a.map((x, i) => Math.round(x + (b[i] - x) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  // Semantic colour roles (see also RAMPS): VALUE = green (desirable), SEVERITY
  // = red (worse), SWING = violet (seasonal). Green never means "hot/expensive",
  // red never means "good" — each hue carries exactly one meaning.
  const SLATE = [203, 213, 225], EMER = [5, 150, 105], RED = [185, 28, 28];
  const VIO_LO = [221, 214, 254], VIO_HI = [76, 29, 149];
  const valueColor = (t) => mix(SLATE, EMER, t);     // neutral → green = more desirable (never red)
  const severityColor = (t) => mix(SLATE, RED, t);   // neutral → red = worse / more severe
  const lerpColor = valueColor;                      // 回报 / 价值
  const comfortColor = valueColor;                   // 舒适 = value green (was red→green)
  const badColor = severityColor;                    // 极端天气 = severity red (was green→red)
  const rangeColor = (t) => mix(VIO_LO, VIO_HI, t);  // 年温差 / 季节波动 = violet (small → large)
  // 房龄 = AGE: 新(0yr)=fresh green → 老(≥45yr)=amber patina. Its own hue (amber),
  // distinct from value-green / severity-red / swing-violet; green end nods to
  // value since newer ≈ better condition.
  const AGE_NEW = [5, 150, 105], AGE_OLD = [180, 83, 9];
  const NOW_YEAR = new Date().getFullYear();

  // ---- KPI cards ---------------------------------------------------------
  function renderKPIs() {
    const vd = viewData();
    const provinces = new Set(vd.map((d) => d.prov));
    const cheapest = vd.reduce((a, b) => (b.priceWan < a.priceWan ? b : a));
    const climD = vd.filter((d) => d.tempRange != null);
    const steadiest = climD.reduce((a, b) => (b.tempRange < a.tempRange ? b : a), climD[0]);
    const mildest = climD.reduce((a, b) => (b.extremeMonths < a.extremeMonths ? b : a), climD[0]);
    const cards = [
      { label: '房源样本', value: vd.length, unit: '套', sub: '社区级二手房挂牌' },
      { label: '覆盖省份', value: provinces.size, unit: '省/市', sub: '东北 → 华南' },
      { label: '最低总价', value: fmtWan(cheapest.priceWan), sub: cityLabel(cheapest) },
      { label: '单价中位数', value: fmtInt(median(vd.map((d) => d.unitPrice))), unit: '元/㎡', sub: '挂牌单价中位' },
      { label: '气候最平稳', value: steadiest ? steadiest.tempRange : '—', unit: '℃年温差', sub: steadiest ? `${cityLabel(steadiest)} · ${steadiest.climateType || ''}` : '—' },
      { label: '极端天气最少', value: mildest ? mildest.extremeRange : '—', sub: mildest ? `${cityLabel(mildest)} · 全年最温和` : '—' },
    ];
    document.getElementById('kpi-grid').innerHTML = cards.map((c) => `
      <div class="rounded-xl border p-5 transition-colors duration-300">
        <div class="text-[0.7rem] font-medium uppercase tracking-[0.12em]">${c.label}</div>
        <div class="mt-2 flex items-baseline gap-1">
          <span class="text-2xl md:text-3xl font-semibold tabular-nums">${c.value}</span>
          ${c.unit ? `<span class="text-sm">${c.unit}</span>` : ''}
        </div>
        <div class="mt-1 text-xs truncate" title="${c.sub}">${c.sub}</div>
      </div>`).join('');
  }

  // ---- Chart.js defaults -------------------------------------------------
  function chartBase() {
    if (!window.Chart || !Chart.defaults) return;
    Chart.defaults.font = Chart.defaults.font || {};
    Chart.defaults.font.family = "'Inter','PingFang SC','Microsoft YaHei',sans-serif";
    Chart.defaults.color = themeText();
    Chart.defaults.borderColor = themeGrid();
  }

  // isolate section failures so one broken chart never aborts init (table/map wiring)
  function safeRun(label, fn) {
    try { fn(); }
    catch (e) { console.error('[china-housing]', label, e); }
  }

  function styleTab(b, on, base) {
    const dk = isDark();
    b.className = `${base} px-3 py-1.5 rounded-md text-xs font-medium transition-colors ` +
      (on
        ? (dk ? 'bg-slate-100 text-slate-900' : 'bg-slate-900 text-white')
        : (dk ? 'bg-slate-800 text-slate-400 border border-slate-600 hover:text-slate-100'
          : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-900'));
  }

  let scatterChart, rankChart, provChart;

  // ---- overview scatter: 总价(便宜) × 舒适月数, coloured by 年温差(季节波动) ----
  function renderScatter() {
    const ctx = document.getElementById('scatter-chart');
    if (!ctx || !window.Chart) return;
    if (scatterChart) { scatterChart.destroy(); scatterChart = null; }
    const cdays = (d) => d.comfortDayCount != null ? d.comfortDayCount
      : (d.comfortMonths != null ? Math.round(d.comfortMonths * 30.4) : null);
    const pts = viewData().filter((d) => cdays(d) != null && d.tempRange != null)
      .map((d) => ({ x: d.priceWan, y: cdays(d), d }));
    const rMax = Math.max(1, ...pts.map((p) => p.d.tempRange));
    // Chart.js derives x min/max from edge points assuming x-sorted data; our pts are
    // id-ordered, so it clipped the axis (maxed at 8万 while data ran to ~19万, hiding ~half
    // the points off-chart). Anchor the price axis explicitly to [0, data-max] regardless of order.
    const pMax = Math.max(1, ...pts.map((p) => p.x));
    scatterChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          data: pts, parsing: false, pointRadius: 5, pointHoverRadius: 8,
          // bluer = 大年温差(四季分明) · tealer = 小年温差(平稳)
          backgroundColor: pts.map((p) => rangeColor(p.d.tempRange / rMax)),
          borderColor: isDark() ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.85)', borderWidth: 1,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (it) => cityLabel(it[0].raw.d),
              label: (it) => {
                const d = it.raw.d;
                return [
                  `总价 ${fmtWan(d.priceWan)} · ${d.area}㎡ · 单价 ${fmtInt(d.unitPrice)}元/㎡`,
                  `${d.climateType || '—'} · 年温差 ${d.tempRange}℃ · 舒适 ${d.comfortRange} · 极端 ${d.extremeRange}`,
                  `1月 ${fmtTemp(d.janTemp)} · 7月 ${fmtTemp(d.julTemp)} · 海拔 ${d.elevation == null ? '—' : fmtInt(d.elevation) + 'm'}`,
                ];
              },
            },
          },
        },
        scales: {
          x: { min: 0, suggestedMax: pMax, title: { display: true, text: '二手房总价（万元）— 越左越便宜' }, grid: { color: themeGrid() }, ticks: { callback: (v) => v + '万' } },
          y: { title: { display: true, text: '舒适天数（日均温 15–26℃；悬停看具体日期范围）— 越上越多' }, grid: { color: themeGrid() }, min: 0, max: 365 },
        },
      },
    });
  }

  // ---- ranking bars (switchable metric) ----------------------------------
  const RANK_METRICS = {
    cheap: { label: '总价最低', key: 'priceWan', dir: 1, axis: '总价（万元）', fmt: fmtWan, color: (v, n) => badColor(v / n) },
    unit: { label: '单价最低', key: 'unitPrice', dir: 1, axis: '单价（元/㎡）', fmt: (v) => fmtInt(v), color: (v, n) => badColor(v / n) },
    comfort: { label: '舒适月最多', key: 'comfortMonths', dir: -1, axis: '舒适月数（15–26℃）', fmt: (v) => v + '月', color: (v, n) => comfortColor(v / (n || 1)) },
    extreme: { label: '极端天气最多', key: 'extremeMonths', dir: -1, axis: '极端天气月数', fmt: (v) => v + '月', color: (v, n) => comfortColor(1 - v / (n || 1)) },
    yield: { label: '回报率最高', key: 'yieldPct', dir: -1, axis: '毛租金回报率（%）', fmt: fmtPct, color: (v, n) => lerpColor(v / n) },
  };
  let rankKey = 'comfort';

  // Top-50 ranking as a scrollable HTML list. Climate metrics (comfort / mild)
  // render a 365-day mini strip; price/yield metrics render a CSS magnitude bar.
  function renderRankings() {
    const ctx = document.getElementById('rank-chart');
    if (!ctx) return;
    const m = RANK_METRICS[rankKey] || RANK_METRICS.comfort;
    if (!m) return;
    if (rankChart) { rankChart.destroy(); rankChart = null; }
    ctx.style.display = 'none';
    let host = document.getElementById('rank-strip');
    if (!host) {
      host = document.createElement('div');
      host.id = 'rank-strip';
      host.className = 'absolute inset-0 overflow-auto';
      ctx.parentElement.appendChild(host);
    }
    host.style.display = '';
    const isStrip = (rankKey === 'comfort' || rankKey === 'extreme');
    const isC = rankKey === 'comfort';
    const skey = isStrip ? (isC ? 'comfortDayCount' : 'extremeDayCount') : m.key;
    const pool = viewData().filter((d) => isStrip ? (d.daily && d[skey] != null) : d[m.key] != null);
    const top = [...pool].sort((a, b) => (a[skey] - b[skey]) * m.dir).slice(0, 50);
    const maxV = Math.max(...top.map((d) => d[m.key] || 0), 1);
    const GT = 'grid-template-columns: 1.6rem minmax(4.5rem, 9rem) 1fr 3.6rem';
    const colHdr = isStrip ? (isC ? '舒适日段（绿）' : '极端日段（红）') : m.axis.replace(/（.*/, '');
    const hBg = isDark() ? '#1e293b' : '#ffffff';
    const headMuted = isDark() ? '#94a3b8' : '#94a3b8';
    const head = `<div class="grid items-center gap-2 text-[0.6rem] sticky top-0 z-10 pb-1" style="${GT};background:${hBg};color:${headMuted}"><div>#</div><div>小区</div><div>${colHdr}</div><div class="text-right">${isStrip ? (isC ? '舒适' : '极端') : ''}</div></div>`;
    const body = top.map((d, i) => {
      let vis, val;
      if (isStrip) {
        vis = miniDayStrip(isC ? d.daily.comfortDays : d.daily.extremeDays, isC ? '#059669' : '#dc2626',
          (isC ? '舒适 ' : '极端 ') + ((isC ? d.comfortRange : d.extremeRange) || '无'), '100%');
        val = isC ? d.comfortDayCount + '天' : (d.extremeDayCount === 0 ? '无' : d.extremeDayCount + '天');
      } else {
        vis = `<div class="h-3.5 rounded-sm" style="width:${Math.max(2, (d[m.key] / maxV) * 100)}%;background:${m.color(d[m.key], maxV)}"></div>`;
        val = m.fmt(d[m.key]);
      }
      const rowText = isDark() ? '#94a3b8' : '#374151';
      const valText = isDark() ? '#64748b' : '#6b7280';
      return `<div class="grid items-center gap-2 py-0.5" style="${GT}"><div class="text-xs tabular-nums" style="color:${valText}">${i + 1}</div>`
        + `<div class="text-xs truncate" style="color:${rowText}" title="${cityLabel(d)} · ${d.prov}">${cityLabel(d)}</div>`
        + `<div>${vis}</div>`
        + `<div class="text-right text-xs tabular-nums" style="color:${valText}">${val}</div></div>`;
    }).join('');
    host.innerHTML = head + body;
    document.querySelectorAll('[data-rank]').forEach((b) => {
      const rm = RANK_METRICS[b.dataset.rank];
      if (!rm) return;
      b.textContent = rm.label;
      styleTab(b, b.dataset.rank === rankKey, 'rank-tab');
    });
  }

  // ---- province aggregation ---------------------------------------------
  function aggregateByProvince() {
    const map = new Map();
    viewData().forEach((d) => { if (!map.has(d.prov)) map.set(d.prov, []); map.get(d.prov).push(d); });
    return [...map.entries()].map(([prov, rows]) => {
      const avg = (k) => { const xs = rows.map((r) => r[k]).filter((v) => v != null); return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null; };
      // province-level extreme range = UNION of every listing's extreme months
      // ("which months are extreme somewhere in this province").
      const exUnion = [...new Set(rows.flatMap((r) => r.extremeSet || []))].sort((a, b) => a - b);
      const extremeByMonth = Array.from({ length: 12 }, (_, i) =>
        rows.reduce((s, r) => s + ((r.extremeSet || []).includes(i + 1) ? 1 : 0), 0));
      // day-level: how many listings are extreme on each day-of-year (union envelope)
      const extremeByDay = new Array(365).fill(0);
      let anyDaily = false;
      rows.forEach((r) => {
        const dd = r.daily; if (!dd || !dd.extremeDays) return; anyDaily = true;
        dd.extremeDays.forEach(([s, e]) => {
          if (s <= e) { for (let i = s; i <= e; i++) extremeByDay[i - 1] += 1; }
          else { for (let i = s; i <= 365; i++) extremeByDay[i - 1] += 1; for (let i = 1; i <= e; i++) extremeByDay[i - 1] += 1; }
        });
      });
      const extremeRange = anyDaily ? flagsToDayRange(extremeByDay.map((c) => c > 0)) : monthRanges(exUnion);
      return {
        prov, count: rows.length,
        avgPrice: avg('priceWan'), avgUnit: avg('unitPrice'), avgYield: avg('yieldPct'),
        avgRent: avg('rent'), avgRange: avg('tempRange'), avgExtreme: avg('extremeMonths'),
        extremeRange, extremeByMonth, extremeByDay,
      };
    });
  }

  const PROV_METRICS = {
    avgUnit: { label: '均单价', axis: '样本均单价（元/㎡）', fmt: (v) => fmtInt(v), dir: -1, color: C.emeraldSoft },
    avgPrice: { label: '均总价', axis: '样本均总价（万元）', fmt: fmtWan, dir: -1, color: C.emeraldSoft },
    avgRange: { label: '均年温差', axis: '样本均年温差（℃，越小越平稳）', fmt: (v) => fmtInt(v) + '℃', dir: -1, color: 'rgba(67,56,202,0.5)' },
    avgExtreme: { label: '极端月', axis: '柱长=样本均极端月数；月份范围（省内并集）标在省名旁', fmt: (v) => v.toFixed(1) + '月', dir: -1, color: 'rgba(185,28,28,0.5)' },
    avgComfort: { label: '均年温差', axis: '样本均年温差（℃，越小越平稳）', fmt: (v) => fmtInt(v) + '℃', dir: -1, color: 'rgba(67,56,202,0.5)' },
  };
  let provMetric = 'avgRange';

  // avgExtreme view: a 12-month strip per province (x = 月份 1–12). A cell is
  // shaded when that month is extreme for some listing — depth = share of the
  // province's listings affected. Clearer than equal-length bars all from 0.
  function renderProvinceStrip() {
    const canvas = document.getElementById('province-chart');
    if (!canvas) return;
    if (provChart) { provChart.destroy(); provChart = null; }
    canvas.style.display = 'none';
    let strip = document.getElementById('province-strip');
    if (!strip) {
      strip = document.createElement('div');
      strip.id = 'province-strip';
      strip.className = 'absolute inset-0 overflow-auto';
      canvas.parentElement.appendChild(strip);
    }
    strip.style.display = '';
    const GT = 'grid-template-columns: 3.4rem 1fr';
    const agg = aggregateByProvince()
      .sort((a, b) => (b.avgExtreme || 0) - (a.avgExtreme || 0) || a.prov.localeCompare(b.prov, 'zh'));
    // month boundaries (%) + centres on a 365-day axis
    const bnd = []; let acc = 0; for (let i = 0; i < 12; i++) { acc += _DIM[i]; bnd.push(acc / 365 * 100); }
    const ctr = []; let p0 = 0; for (let i = 0; i < 12; i++) { ctr.push((p0 + bnd[i]) / 2); p0 = bnd[i]; }
    const gridLine = isDark() ? 'rgba(148,163,184,0.22)' : 'rgba(100,116,139,0.16)';
    const gridImg = 'background-image:' + bnd.slice(0, 11).map((p) =>
      `linear-gradient(90deg, transparent calc(${p}% - 0.5px), ${gridLine} ${p}%, transparent calc(${p}% + 0.5px))`).join(',');
    const sBg = isDark() ? '#1e293b' : '#ffffff';
    const head = `<div class="grid items-center gap-px text-[0.6rem] sticky top-0 z-10 pb-1" style="${GT};background:${sBg};color:${themeMuted()}"><div></div>`
      + `<div class="relative h-3">${ctr.map((c, i) => `<span style="position:absolute;left:${c}%;transform:translateX(-50%)">${i + 1}</span>`).join('')}</div></div>`;
    const blocksFor = (a) => {
      const f = a.extremeByDay || []; const out = []; let s = -1;
      for (let i = 0; i < 365; i++) {
        const on = f[i] > 0;
        if (on && s < 0) s = i;
        if ((!on || i === 364) && s >= 0) {
          const e = on ? i : i - 1, maxc = Math.max(...f.slice(s, e + 1));
          out.push(`<div class="absolute top-0 bottom-0 rounded-sm" style="left:${s / 365 * 100}%;width:${(e - s + 1) / 365 * 100}%;background:${severityColor(0.4 + 0.6 * (maxc / a.count))}" title="${a.prov} ${doyToDate(s + 1)}–${doyToDate(e + 1)}：最多 ${maxc}/${a.count} 套极端"></div>`);
          s = -1;
        }
      }
      return out.join('');
    };
    const provColor = isDark() ? '#94a3b8' : '#475569';
    const stripBg = isDark() ? 'rgba(30,41,59,0.7)' : 'rgba(241,245,249,0.7)';
    const body = agg.map((a) =>
      `<div class="grid items-center gap-px py-px" style="${GT}"><div class="text-xs truncate pr-1" style="color:${provColor}" title="${a.prov} · 极端 ${a.extremeRange}">${a.prov}</div>`
      + `<div class="relative h-5 rounded-sm" style="${gridImg};background-color:${stripBg}">${blocksFor(a)}</div></div>`).join('');
    strip.innerHTML = head + body
      + `<div class="text-[0.62rem] mt-2 leading-relaxed" style="color:${themeMuted()}">横轴=全年（按日，竖线为月界）；红段=该省有小区当天严寒(日均&lt;0℃)或酷热(日均高温≥33℃)，越深=占比越高，空白=无极端。</div>`;
  }

  function renderProvinceChart() {
    const ctx = document.getElementById('province-chart');
    if (!ctx || !window.Chart) return;
    const m = PROV_METRICS[provMetric] || PROV_METRICS.avgRange;
    if (!m) return;
    if (provMetric === 'avgExtreme') {   // month-strip instead of a 0-based bar
      renderProvinceStrip();
      document.querySelectorAll('[data-prov]').forEach((b) => {
        const pm = PROV_METRICS[b.dataset.prov]; if (!pm) return;
        b.textContent = pm.label; styleTab(b, b.dataset.prov === provMetric, 'prov-tab');
      });
      return;
    }
    ctx.style.display = '';
    const stripEl = document.getElementById('province-strip');
    if (stripEl) stripEl.style.display = 'none';
    const metricKey = provMetric === 'avgComfort' ? 'avgRange' : provMetric;
    const agg = aggregateByProvince().filter((a) => a[metricKey] != null)
      .sort((a, b) => (b[metricKey] - a[metricKey]) * (m.dir > 0 ? 1 : -1));
    const cfg = {
      type: 'bar',
      data: {
        labels: agg.map((a) => provMetric === 'avgExtreme' ? `${a.prov} ${a.extremeRange}` : a.prov),
        datasets: [{
          data: agg.map((a) => a[metricKey]),
          backgroundColor: m.color, borderColor: C.emerald, borderWidth: 1,
          borderRadius: 4, maxBarThickness: 22,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (it) => {
                const a = agg[it.dataIndex];
                const head = provMetric === 'avgExtreme'
                  ? `极端月份（省内并集）：${a.extremeRange} · 均 ${a.avgExtreme.toFixed(1)}月/小区`
                  : `${m.label} ${m.fmt(a[metricKey])}`;
                return [head,
                  `样本 ${a.count}套 · 均总价 ${fmtWan(a.avgPrice)} · 均单价 ${fmtInt(a.avgUnit)}元/㎡`,
                  `均年温差 ${fmtInt(a.avgRange)}℃ · 均极端 ${a.avgExtreme.toFixed(1)}月`];
              },
            },
          },
        },
        scales: {
          x: { title: { display: true, text: m.axis }, grid: { color: themeGrid() },
            ticks: { callback: (v) => { const n = Number(v); return Number.isFinite(n) ? m.fmt(n) : v; } } },
          y: { grid: { display: false } },
        },
      },
    };
    if (provChart) { provChart.destroy(); provChart = null; }
    provChart = new Chart(ctx, cfg);
    document.querySelectorAll('[data-prov]').forEach((b) => {
      const pm = PROV_METRICS[b.dataset.prov];
      if (!pm) return;
      b.textContent = pm.label;
      styleTab(b, b.dataset.prov === provMetric, 'prov-tab');
    });
  }

  // ---- big zoomable overlay map (geo + recolourable listing points) ------
  // Hazard recurrence-interval buckets (FREQUENCY, not severity): 5=几乎年年 …
  // 1=百年级罕见. Single source of truth for the frequency→colour scale, shared by
  // the map 灾害频率 dimension + the table hazard column + the modal hazard tab, so
  // 红=年年 · 橙=数年 · 灰=十年 · 淡灰=数十/百年 mean the same thing everywhere.
  const FREQ_COLOR = { 5: '#b91c1c', 4: '#ea580c', 3: '#64748b', 2: '#94a3b8', 1: '#94a3b8' };
  const FREQ_LABEL = { 5: '几乎年年', 4: '数年一次', 3: '约十年一遇', 2: '数十年一遇', 1: '百年级罕见' };
  // Sequential ramps, one per semantic family. VALUE = green only (no red);
  // SEVERITY = red; physical fields = their own conventional spectra.
  const RAMPS = {
    cheapGood: ['#065f46', '#059669', '#34d399', '#a7f3d0', '#cbd5e1'],   // 价值: 便宜/少 = 深绿 → 贵/多 = 中性灰
    comfyHigh: ['#cbd5e1', '#a7f3d0', '#34d399', '#059669', '#065f46'],   // 价值: 高 = 深绿（回报/舒适）
    severity: ['#cbd5e1', '#fde047', '#fb923c', '#ef4444', '#b91c1c'],    // 严重度: 低=灰 → 高=红（极端气候时长）
    temp: ['#2563eb', '#38bdf8', '#fde68a', '#fb923c', '#dc2626'],        // 温度: 冷蓝 → 热红
    precip: ['#eef2f7', '#bae6fd', '#38bdf8', '#0284c7', '#1e3a8a'],       // 降水: 干 → 湿
    terrain: ['#dcfce7', '#86efac', '#ca8a04', '#b45309', '#78350f'],     // 海拔: 低 → 高
    range: ['#ddd6fe', '#a78bfa', '#7c3aed', '#5b21b6', '#4c1d95'],       // 季节波动: 小 → 大（紫）
    freq: [FREQ_COLOR[1], FREQ_COLOR[2], FREQ_COLOR[3], FREQ_COLOR[4], FREQ_COLOR[5]],  // 灾害频率: 罕见淡灰 → 年年红（= FREQ_COLOR，固定 [1,5] 域）
  };
  // 地球物理突发灾害——随精确位置变化（地震带 / 海岸 / 地形），不像慢性气候灾
  // (暴雨/洪涝/干旱) 那样近乎处处年年。地图按这几类着色，才用得满 FREQ_COLOR 全色域、
  // 显出地理差异；表格 / 弹窗仍列全部灾害。
  const GEO_HAZ = new Set(['地震', '台风', '台风外围', '风暴潮', '地质灾害', '滑坡', '泥石流', '崩塌']);
  const MAP_DIMS = {
    tempRange: { label: '年温差·季节波动', get: (d) => d.tempRange, fmt: (v) => fmtInt(v) + '℃', ramp: 'range', text: ['温差大', '温差小'] },
    unitPrice: { label: '单价', get: (d) => d.unitPrice, fmt: (v) => fmtInt(v) + '元/㎡', ramp: 'cheapGood', text: ['贵', '便宜'] },
    priceWan: { label: '总价', get: (d) => d.priceWan, fmt: fmtWan, ramp: 'cheapGood', text: ['贵', '便宜'] },
    janTemp: { label: '1月均温·等温', get: (d) => d.janTemp, fmt: fmtTemp, ramp: 'temp', text: ['热', '冷'] },
    julTemp: { label: '7月均温·等温', get: (d) => d.julTemp, fmt: fmtTemp, ramp: 'temp', text: ['热', '冷'] },
    annualPrecip: { label: '年降水', get: (d) => d.annualPrecip, fmt: (v) => fmtInt(v) + 'mm', ramp: 'precip', text: ['湿', '干'] },
    elevation: { label: '海拔', get: (d) => d.elevation, fmt: (v) => fmtInt(v) + 'm', ramp: 'terrain', text: ['高', '低'] },
    hazardFreq: {
      label: '突发灾害·频率',
      get: (d) => {
        if (!d.hazard || !d.hazard.hazards) return null;
        const gs = d.hazard.hazards.filter((h) => GEO_HAZ.has(h.type));
        return gs.length ? Math.max(...gs.map((h) => h.freq)) : 1;   // 无突发地球物理灾 → 淡灰（非消失）
      },
      fmt: (v) => FREQ_LABEL[Math.round(v)] || '', ramp: 'freq', text: ['年年', '罕见'], fixedDomain: [1, 5],
    },
    // legacy keys (stale cached HTML may still reference the removed 宜居指数)
    comfortScore: { label: '年温差·季节波动', get: (d) => d.tempRange, fmt: (v) => fmtInt(v) + '℃', ramp: 'range', text: ['温差大', '温差小'] },
  };
  let dimKey = 'tempRange';
  let echartsMap = null, mapReady = false, baseGeoOpt = null;
  const GEO_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';

  // continuous basemap field (assets/data/field.js) — isotherm / rainfall /
  // elevation raster + isolines, drawn UNDER the listing points.
  const FIELD = window.HOUSING_FIELD || null;
  // Basemap field ramps reuse the same physical ramps (no duplicate definitions).
  // Keys must stay temp/terrain/precip — assets/data/field.js references them.
  const BASE_RAMPS = { temp: RAMPS.temp, terrain: RAMPS.terrain, precip: RAMPS.precip };
  // available basemaps: 'none' + whatever the baked field provides
  const BASE_LABELS = { none: '无底图', janTemp: '1月等温', julTemp: '7月等温', elevation: '海拔', annualPrecip: '年降水' };
  let baseKey = 'none';

  const rampColorAt = (ramp, t) => {
    const cs = BASE_RAMPS[ramp] || BASE_RAMPS.temp;
    t = clamp(t, 0, 1) * (cs.length - 1);
    const i = Math.floor(t), f = t - i;
    if (i >= cs.length - 1) return cs[cs.length - 1];
    const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
    return mix(hex(cs[i]), hex(cs[i + 1]), f);
  };

  // cheaper homes render larger so affordable options pop (scale to visible set)
  function dotSizeOf(d) {
    const vals = viewGeocoded().map((x) => x.priceWan);
    const pMin = Math.min(...vals), pMax = Math.max(...vals);
    return 8 + (1 - clamp((d.priceWan - pMin) / (pMax - pMin || 1), 0, 1)) * 12;
  }

  function mapFail(msg) {
    const wrap = document.getElementById('map-wrap');
    const fb = document.getElementById('map-fallback');
    if (wrap) wrap.style.display = 'none';
    if (fb) { fb.classList.remove('hidden'); fb.style.display = 'flex'; fb.textContent = msg; }
  }

  function mapSeriesData() {
    const dim = MAP_DIMS[dimKey] || MAP_DIMS.tempRange;
    if (!dim) return [];
    return viewGeocoded().filter((d) => dim.get(d) != null).map((d) => ({
      value: [d.enr.lng, d.enr.lat, dim.get(d)], size: dotSizeOf(d), d,
    }));
  }

  // basemap grid samples + isoline segments for the active field — RAW geometry
  // and values only; fill / line colours are assigned in renderMap so the field
  // can share the point dimension's domain when the two use the same ramp.
  function baseLayers() {
    const f = (baseKey !== 'none' && FIELD && FIELD.fields) ? FIELD.fields[baseKey] : null;
    if (!f) return { cells: [], lines: [], step: 1, vm: { min: 0, max: 1, ramp: 'temp' } };
    const lines = [];
    Object.keys(f.isolines || {}).forEach((lvl) => {
      const level = parseFloat(lvl);
      f.isolines[lvl].forEach((seg) => lines.push({ coords: seg, level }));
    });
    // cells = raw [lng, lat, value] grid samples; coloured in renderMap below
    return { cells: f.points, lines, step: FIELD.step || 1, vm: { min: f.min, max: f.max, ramp: f.ramp } };
  }

  function renderMap() {
    if (!mapReady || !echartsMap) return;
    const dim = MAP_DIMS[dimKey] || MAP_DIMS.tempRange;
    if (!dim) return;
    const data = mapSeriesData();
    const vals = data.map((p) => p.value[2]);
    if (!vals.length) return;
    let vmin = Math.min(...vals), vmax = Math.max(...vals);
    if (!Number.isFinite(vmin) || !Number.isFinite(vmax) || vmin === vmax) {
      vmin = vmin || 0;
      vmax = vmax || vmin + 1;
    }
    // discrete dims (灾害频率) pin their domain so each bucket keeps its FREQ_COLOR
    // instead of the ramp auto-stretching to the data's actual min/max
    if (dim.fixedDomain) { vmin = dim.fixedDomain[0]; vmax = dim.fixedDomain[1]; }
    const bl = baseLayers();
    const ramp = RAMPS[dim.ramp] || RAMPS.range;
    // Only attach the field cells + isolines when a base field is active;
    // replaceMerge drops them cleanly when toggled back to 无底图. (The old
    // ECharts heatmap path also needed this guard to dodge an empty-heatmap
    // 'targetVisuals' crash; the custom value-cell path below doesn't, but the
    // guard stays correct.)
    const hasBase = bl.cells.length > 0;
    // Shared-ramp unification: when the point dimension and the basemap field use
    // the SAME colour ramp (both temperature / both elevation / both rainfall),
    // that ramp reads as ONE absolute scale, so identical colours MUST mean
    // identical values across the two layers. Auto-scaling each to its own range
    // breaks it — e.g. point=7月 over [19.7,29.3] vs field=1月 over [-29.4,24.6]
    // paints a 20℃ point deep-blue while a 20℃ field patch is near-red. Widen the
    // point domain to the union of both and colour the field over that same
    // domain (fmin/fmax); the duplicate basemap legend is then suppressed.
    const fieldRamp = bl.vm.ramp;
    const sameRamp = hasBase && dim.ramp === fieldRamp;
    let fmin = bl.vm.min, fmax = bl.vm.max;
    if (sameRamp) {
      vmin = Math.min(vmin, bl.vm.min); vmax = Math.max(vmax, bl.vm.max);
      fmin = vmin; fmax = vmax;
    }
    const series = [
      {
        type: 'scatter', coordinateSystem: 'geo', zlevel: 3,
        symbolSize: (val, params) => (params.data && params.data.size) || 9,
        itemStyle: { borderColor: isDark() ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.9)', borderWidth: 1, shadowBlur: 3, shadowColor: isDark() ? 'rgba(0,0,0,0.35)' : 'rgba(15,23,42,0.3)' },
        emphasis: { scale: 1.5 },
        data,
      },
    ];
    const visualMap = [
      { // listing-point dimension (legend bottom-left)
        type: 'continuous', dimension: 2, seriesIndex: 0,
        min: vmin, max: vmax, range: [vmin, vmax],
        left: 'left', bottom: 24, calculable: true,
        text: dim.text, itemWidth: 14, itemHeight: 120,
        inRange: { color: ramp }, textStyle: { color: themeMuted() },
        formatter: (v) => dim.fmt(v),
      },
    ];
    if (hasBase) {
      const cells = bl.cells, half = bl.step / 2, fspan = (fmax - fmin) || 1;
      // colour every cell / isoline ONCE over [fmin,fmax] — the shared domain
      // when sameRamp, otherwise the field's own range
      const colorAt = (v) => rampColorAt(fieldRamp, (v - fmin) / fspan);
      const cellColors = cells.map((c) => colorAt(c[2]));
      series.push(
        {
          // Value-coloured field cells: each grid sample → a geo-projected rect
          // filled with the colour of ITS value. api.coord reprojects on every
          // zoom / pan so cells scale with the map (no fixed-pixel dot artefact),
          // and the fill encodes the true value (no density blur, no blob).
          type: 'custom', coordinateSystem: 'geo', zlevel: 1, silent: true, animation: false,
          renderItem: (params, api) => {
            const c = cells[params.dataIndex];
            const a = api.coord([c[0] - half, c[1] - half]);
            const b = api.coord([c[0] + half, c[1] + half]);
            // Snap both corners to integer pixels: a cell's far edge and its
            // neighbour's near edge derive from the SAME lng/lat (so the same
            // api.coord output), thus round to the SAME integer — cells abut
            // exactly. No overlap (which double-blends the 0.55 fill into a dark
            // grid) and no sub-pixel gap (a light grid). Seam-free tiling.
            const x0 = Math.round(Math.min(a[0], b[0])), y0 = Math.round(Math.min(a[1], b[1]));
            const x1 = Math.round(Math.max(a[0], b[0])), y1 = Math.round(Math.max(a[1], b[1]));
            return {
              type: 'rect',
              shape: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
              style: { fill: cellColors[params.dataIndex], opacity: 0.55 },
            };
          },
          data: cells,
        },
        {
          type: 'lines', coordinateSystem: 'geo', zlevel: 2, polyline: true, silent: true,
          lineStyle: { width: 1, opacity: 0.5, join: 'round' },
          data: bl.lines.map((ln) => ({ coords: ln.coords, lineStyle: { color: colorAt(ln.level) } })),
        },
      );
    }
    echartsMap.setOption({
      series,
      tooltip: {
        trigger: 'item',
        formatter: (p) => {
          const d = p.data && p.data.d; if (!d) return '';
          const top0 = d.hazard && d.hazard.hazards[0];
          const haz = top0 ? `${top0.type}·${top0.freqLabel}` : '';
          return `<b>${cityLabel(d)}</b> · ${d.enr.geoLabel || ''}<br/>`
            + `<b style="color:#059669">${dim.label} ${dim.fmt(dim.get(d))}</b><br/>`
            + `总价 ${fmtWan(d.priceWan)} · ${d.area}㎡ · 单价 ${fmtInt(d.unitPrice)}元/㎡<br/>`
            + `${d.climateType || '—'} · 年温差${d.tempRange == null ? '—' : d.tempRange + '℃'} · 1月${fmtTemp(d.janTemp)}/7月${fmtTemp(d.julTemp)} · 海拔 ${d.elevation == null ? '—' : fmtInt(d.elevation) + 'm'} · 供暖 ${d.heating || '—'}<br/>`
            + `医院 ${fmtKm(d.hospitalKm)} · ${d.transitKind === 'metro' ? '地铁' : '火车'} ${fmtKm(d.transitKm)} · 地震 ${d.seismic || '—'} · 台风 ${d.typhoon || '—'}`
            + (haz ? `<br/><span style="color:#b91c1c">最频灾害：${haz}</span>` : '')
            + `<br/><span style="color:#10b981">点击查看卫星图 / 周边 / 气候 / 灾害</span>`;
        },
      },
      visualMap,
    }, { replaceMerge: ['series', 'visualMap'] });
    renderBaseLegend();
  }

  function renderBaseLegend() {
    const box = document.getElementById('base-legend');
    if (!box) return;
    const f = (baseKey !== 'none' && FIELD && FIELD.fields) ? FIELD.fields[baseKey] : null;
    const dimRamp = (MAP_DIMS[dimKey] || {}).ramp;
    // Hide this 2nd legend when the field shares the point dimension's colour ramp
    // — the left visualMap is then the single unified scale for both layers
    // (sameRamp in renderMap). Two bars for one colour scale with mismatched
    // numbers is exactly the confusion we're removing.
    if (!f || (dimRamp && f.ramp === dimRamp)) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'flex';
    const grad = (BASE_RAMPS[f.ramp] || BASE_RAMPS.temp).join(',');
    box.innerHTML = `<span class="text-xs whitespace-nowrap" style="color:${themeBody()}">${f.label}底图</span>`
      + `<span class="text-[11px] tabular-nums" style="color:${themeMuted()}">${fmtInt(f.min)}</span>`
      + `<span class="inline-block h-2.5 w-28 rounded" style="background:linear-gradient(90deg,${grad})"></span>`
      + `<span class="text-[11px] tabular-nums" style="color:${themeMuted()}">${fmtInt(f.max)}${f.unit}</span>`;
  }

  function baseTabs() {
    document.querySelectorAll('[data-base]').forEach((b) => {
      const k = b.dataset.base;
      const avail = k === 'none' || (FIELD && FIELD.fields && FIELD.fields[k]);
      b.textContent = BASE_LABELS[k] || k;
      b.style.display = avail ? '' : 'none';
      styleTab(b, k === baseKey, 'base-tab');
    });
  }

  async function loadChinaGeo() {
    if (window.CHINA_GEO && Array.isArray(window.CHINA_GEO.features)) return window.CHINA_GEO;
    const res = await fetch(GEO_URL, { mode: 'cors' });
    if (!res.ok) throw new Error('geojson http ' + res.status);
    return res.json();
  }

  function dimTabs() {
    document.querySelectorAll('[data-dim]').forEach((b) => {
      const dm = MAP_DIMS[b.dataset.dim];
      if (!dm) { b.style.display = 'none'; return; }
      b.style.display = '';
      b.textContent = dm.label;
      styleTab(b, b.dataset.dim === dimKey, 'dim-tab');
    });
  }

  // zoom helpers — read current zoom/center from the live option (roam writes
  // back to it) so the +/- buttons compose with wheel / pinch roam.
  function geoState() {
    try { const g = echartsMap.getOption().geo[0]; return { zoom: g.zoom || 1, center: g.center }; }
    catch (e) { return { zoom: 1, center: undefined }; }
  }
  function zoomBy(f) {
    if (!echartsMap) return;
    const s = geoState();
    echartsMap.setOption({ geo: [{ zoom: clamp(s.zoom * f, 1, 14), center: s.center }] });
  }
  function zoomReset() {
    if (!echartsMap || !baseGeoOpt) return;
    echartsMap.setOption({ geo: [{ zoom: 1, center: baseGeoOpt.center }] });
  }

  async function initMap() {
    if (!window.echarts) { mapFail('地图组件未能加载（ECharts CDN 不可达），表格与其余图表不受影响。'); return; }
    try {
      const geo = await loadChinaGeo();
      echarts.registerMap('china', geo);
      echartsMap = echarts.init(document.getElementById('china-map'));
      const dk = isDark();
      echartsMap.setOption({
        geo: {
          map: 'china', roam: true, zoom: 1, scaleLimit: { min: 1, max: 14 },
          nameProperty: 'name',
          itemStyle: { areaColor: dk ? '#1e293b' : '#f8fafc', borderColor: dk ? '#334155' : '#cbd5e1', borderWidth: 0.6 },
          emphasis: { itemStyle: { areaColor: dk ? '#334155' : '#eef2f7' }, label: { show: false } },
          select: { disabled: true },
        },
        backgroundColor: dk ? '#0f172a' : 'transparent',
      });
      baseGeoOpt = { center: echartsMap.getOption().geo[0].center };
      mapReady = true;
      safeRun('renderMap', renderMap);
      dimTabs();
      baseTabs();
      echartsMap.on('click', (p) => {
        if (p && p.data && p.data.d) openListing(p.data.d.id);
      });
      window.addEventListener('resize', () => echartsMap && echartsMap.resize());
    } catch (e) {
      console.error('[china-housing] initMap', e);
      mapFail('地图边界数据加载失败（网络受限），省份对比可见下方柱状图，表格不受影响。');
    }
  }

  // ---- table (master data source) ----------------------------------------
  const SEISMIC_ORD = { '高': 4, '较高': 3, '中': 2, '低': 1 };
  const TYPH_ORD = { '高': 4, '中': 3, '弱': 2, '极低': 1 };
  // central-heating tiers (秦岭-淮河线). ord sorts 集中供暖 high → 无·湿冷 low.
  const HEATING_ORD = { '集中供暖': 3, '部分供暖': 2, '无·冬暖': 1, '无·湿冷': 0 };
  const HEATING_STYLE = {
    '集中供暖': ['#dcfce7', '#166534'],  // green — heated
    '部分供暖': ['#fef9c3', '#854d0e'],  // amber — transition
    '无·冬暖': ['#f1f5f9', '#475569'],   // slate — warm, no need
    '无·湿冷': ['#fee2e2', '#b91c1c'],   // red — cold-damp, no heating (夹心层)
  };

  function viewScales() {
    const vd = viewData();
    return {
      yMinT: Math.min(...vd.map((d) => d.yieldPct).filter((v) => v != null)),
      yMaxT: Math.max(...vd.map((d) => d.yieldPct).filter((v) => v != null)),
      exMaxT: Math.max(1, ...vd.map((d) => nz(d.extremeMonths, 0))),
      rangeMaxT: Math.max(1, ...vd.map((d) => nz(d.tempRange, 0))),
    };
  }

  function pill(html, bg, fg) {
    return `<span class="inline-block rounded px-1.5 py-0.5 text-xs font-medium" style="background:${bg};color:${fg || '#0f172a'}">${html}</span>`;
  }
  function bandCell(level, kind) {
    if (!level) return `<span class="${tcx().faint}">—</span>`;
    const ord = (kind === 'seismic' ? SEISMIC_ORD : TYPH_ORD)[level] || 1;
    const t = (ord - 1) / 3;
    return pill(level, mix([226, 232, 240], [225, 90, 60], t), t > 0.5 ? '#fff' : '#0f172a');
  }
  function hazardCell(d) {
    if (!d.hazard) return `<span class="${tcx().faint}">—</span>`;
    const hs = d.hazard.hazards;
    // lead with each hazard's recurrence interval so 年年/十年/百年 are explicit
    const tags = hs.slice(0, 2).map((h) =>
      `<span style="color:${FREQ_COLOR[h.freq]}">${h.type}<span class="text-[0.65rem] opacity-80">·${h.freqShort}</span></span>`)
      .join(`<span class="${tcx().faint}"> </span>`);
    const more = hs.length > 2 ? `<span class="${tcx().muted} text-[0.65rem]"> +${hs.length - 2}</span>` : '';
    const full = hs.map((h) => `${h.type}：${h.freqLabel}（${h.note}）`).join('\n');
    return `<span title="${d.hazard.headline}\n${full}">${tags}${more}</span>`;
  }
  function heatingCell(d) {
    if (!d.heating) return `<span class="${tcx().faint}">—</span>`;
    const [bg, fg] = HEATING_STYLE[d.heating] || ['#f1f5f9', '#475569'];
    return `<span class="inline-block rounded px-1.5 py-0.5 text-xs font-medium" style="background:${bg};color:${fg}" title="${d.heatingNote}">${d.heating}</span>`;
  }
  function rangeCell(v) {
    if (v == null) return `<span class="${tcx().faint}">—</span>`;
    const t = clamp(v / viewScales().rangeMaxT, 0, 1);
    return pill(trim(v.toFixed(1)) + '℃', rangeColor(t), t > 0.45 ? '#fff' : '#0f172a');
  }
  // 房龄 chip: green(new) → amber(old) by age; tooltip carries 建成年份 + source;
  // unknown years degrade to a muted「未知」so partial research coverage is honest.
  function builtCell(d) {
    const y = d.builtYear;
    if (y == null) return `<span class="${tcx().faint}" title="完工年份未知（公开渠道未查到，未编造）">—<span class="ml-0.5 text-[0.6rem]">未知</span></span>`;
    const age = Math.max(0, NOW_YEAR - y);
    const t = clamp(age / 45, 0, 1);
    const ap = d.builtYearApprox;  // decade-level estimate → 约 prefix only (the 约 carries it)
    const title = `${ap ? '约' : ''}建成 ${y} 年 · 房龄 ${ap ? '约 ' : ''}${age} 年${ap ? '（年代级估算，非精确）' : ''}`
      + (d.builtYearSrc ? `\n来源：${d.builtYearSrc}` : '');
    return `<span class="inline-block rounded px-1.5 py-0.5 text-xs font-medium" style="background:${mix(AGE_NEW, AGE_OLD, t)};color:#fff" title="${title.replace(/"/g, '&quot;')}">${ap ? '约' : ''}${age}年</span>`;
  }
  function climateCell(d) {
    if (!d.climateType) return `<span class="${tcx().faint}">—</span>`;
    const [bg, fg] = CLIMATE_STYLE[d.climateType] || ['#f1f5f9', '#64748b'];
    const title = `年均温 ${d.annualMean == null ? '—' : Math.round(d.annualMean) + '℃'} · 年温差 ${d.tempRange}℃ · 最冷月 ${fmtTemp(d.tMin)} / 最热月 ${fmtTemp(d.tMax)}`;
    return `<span class="inline-block rounded px-1.5 py-0.5 text-xs font-medium" style="background:${bg};color:${fg}" title="${title}">${d.climateType}</span>`;
  }
  // Month-boundary gridlines (shared by the 365-day mini strips).
  function monthGridStyle() {
    const bg = isDark() ? '#334155' : '#f1f5f9';
    const line = isDark() ? 'rgba(148,163,184,0.28)' : 'rgba(100,116,139,0.18)';
    const b = []; let a = 0; for (let i = 0; i < 12; i++) { a += _DIM[i]; b.push(a / 365 * 100); }
    return `background-color:${bg};background-image:` + b.slice(0, 11).map((p) =>
      `linear-gradient(90deg, transparent calc(${p}% - 0.5px), ${line} ${p}%, transparent calc(${p}% + 0.5px))`).join(',');
  }
  // Fixed-width 1–12-month strip with coloured blocks at the given day-of-year
  // ranges ([[s,e],…]; a run wrapping the year-end is split across the Jan–Dec axis).
  function miniDayStrip(ranges, color, title, width) {
    const blocks = (ranges || []).flatMap(([s, e]) => (s <= e ? [[s, e]] : [[s, 365], [1, e]]))
      .map(([s, e]) => `<div class="absolute top-0 bottom-0" style="left:${(s - 1) / 365 * 100}%;width:${(e - s + 1) / 365 * 100}%;background:${color};border-radius:1px"></div>`).join('');
    return `<div class="relative h-3.5 rounded-sm" style="width:${width || '112px'};${monthGridStyle()}" title="${title}">${blocks}</div>`;
  }

  // comfort / extreme cells: a mini 365-day strip — green = comfortable days,
  // red = extreme days (visual beats text; hover shows the exact dates). Falls
  // back to a coloured text pill where no daily climatology is baked.
  function comfortCell(d) {
    if (d.daily && d.daily.comfortDays) return miniDayStrip(d.daily.comfortDays, '#059669', '舒适 ' + (d.comfortRange || '无'));
    if (d.comfortMonths == null) return `<span class="${tcx().faint}">—</span>`;
    const t = d.comfortMonths / 12;
    return pill(d.comfortRange || (d.comfortMonths + '月'), comfortColor(t), t > 0.55 ? '#fff' : '#0f172a');
  }
  function extremeCell(d) {
    if (d.daily && d.daily.extremeDays) return miniDayStrip(d.daily.extremeDays, '#dc2626', d.daily.extremeDays.length ? ('极端 ' + d.extremeRange) : '无极端');
    if (d.extremeMonths == null) return `<span class="${tcx().faint}">—</span>`;
    const { exMaxT } = viewScales();
    const t = d.extremeMonths / exMaxT;
    return pill(d.extremeRange || (d.extremeMonths + '月'), badColor(t), t > 0.5 ? '#fff' : '#0f172a');
  }
  function yieldCell(d) {
    if (d.yieldPct == null) return `<span class="${tcx().faint}">—</span>`;
    const { yMinT, yMaxT } = viewScales();
    const t = (d.yieldPct - yMinT) / (yMaxT - yMinT || 1);
    return pill(fmtPct(d.yieldPct), lerpColor(t), t > 0.5 ? '#fff' : '#0f172a');
  }

  // group: core/price always shown; live/infra/risk/invest are toggleable.
  const COLS = [
    { key: 'id', label: '#', group: 'core', num: true, get: (d) => d.id, cell: (d) => d.id, dir: 1 },
    { key: 'prov', label: '省份', group: 'core', str: true, get: (d) => d.prov, cell: (d) => d.prov, dir: 1 },
    { key: 'city', label: '城市', group: 'core', str: true, get: (d) => d.city, cell: (d) => d.city, dir: 1 },
    { key: 'dist', label: '区/镇', group: 'core', str: true, get: (d) => d.dist, cell: (d) => d.dist, dir: 1 },
    { key: 'loc', label: '小区/位置', group: 'core', str: true, get: (d) => d.loc, cell: (d) => `<span class="font-medium ${tcx().strong}">${d.loc}</span>` , dir: 1 },
    { key: 'builtAge', label: '房龄', group: 'core', get: (d) => nz(d.builtYear, -1), cell: (d) => builtCell(d) },
    { key: 'priceWan', label: '总价', group: 'price', num: true, get: (d) => d.priceWan, cell: (d) => fmtWan(d.priceWan) },
    { key: 'area', label: '面积㎡', group: 'price', num: true, get: (d) => d.area, cell: (d) => trim(d.area.toFixed(1)) },
    { key: 'unitPrice', label: '单价 元/㎡', group: 'price', num: true, get: (d) => d.unitPrice, cell: (d) => fmtInt(d.unitPrice) },
    { key: 'rent', label: '月租 元', group: 'price', num: true, get: (d) => d.rent, cell: (d) => fmtInt(d.rent) },
    { key: 'climateType', label: '气候类型', group: 'live', str: true, get: (d) => d.climateType || '', cell: (d) => climateCell(d) },
    { key: 'tempRange', label: '年温差', group: 'live', num: true, get: (d) => nz(d.tempRange, -1), cell: (d) => rangeCell(d.tempRange) },
    { key: 'janTemp', label: '1月均温', group: 'live', num: true, get: (d) => nz(d.janTemp, -999), cell: (d) => fmtTemp(d.janTemp) },
    { key: 'julTemp', label: '7月均温', group: 'live', num: true, get: (d) => nz(d.julTemp, -999), cell: (d) => fmtTemp(d.julTemp) },
    { key: 'comfortMonths', label: '舒适日期', group: 'live', get: (d) => nz(d.comfortDayCount, nz(d.comfortMonths, -1)), cell: (d) => comfortCell(d) },
    { key: 'extremeMonths', label: '极端日期', group: 'live', get: (d) => nz(d.extremeDayCount, nz(d.extremeMonths, 99)), cell: (d) => extremeCell(d) },
    { key: 'annualPrecip', label: '年降水mm', group: 'live', num: true, get: (d) => nz(d.annualPrecip, -1), cell: (d) => d.annualPrecip == null ? '—' : fmtInt(d.annualPrecip) },
    { key: 'elevation', label: '海拔m', group: 'live', num: true, get: (d) => nz(d.elevation, -1), cell: (d) => d.elevation == null ? '—' : fmtInt(d.elevation) },
    { key: 'heating', label: '供暖', group: 'live', get: (d) => (d.heating != null ? HEATING_ORD[d.heating] : -1), cell: (d) => heatingCell(d) },
    { key: 'hospitalKm', label: '医院km', group: 'infra', num: true, get: (d) => nz(d.hospitalKm, 1e9), cell: (d) => fmtKm(d.hospitalKm) },
    { key: 'transitKm', label: '地铁/火车km', group: 'infra', num: true,
      get: (d) => nz(d.transitKm, 1e9),
      cell: (d) => d.transitKm == null ? '—' : (d.transitKind === 'metro' ? `地铁 ${fmtKm(d.transitKm)}` : `火车 ${fmtKm(d.transitKm)}`) },
    { key: 'airportKm', label: '机场km', group: 'infra', num: true, get: (d) => nz(d.airportKm, 1e9), cell: (d) => fmtKm(d.airportKm) },
    { key: 'coastKm', label: '海岸km', group: 'infra', num: true, get: (d) => nz(d.coastKm, 1e9), cell: (d) => fmtKm(d.coastKm) },
    { key: 'seismic', label: '地震带', group: 'risk', get: (d) => SEISMIC_ORD[d.seismic] || 0, cell: (d) => bandCell(d.seismic, 'seismic') },
    { key: 'typhoon', label: '台风', group: 'risk', get: (d) => TYPH_ORD[d.typhoon] || 0, cell: (d) => bandCell(d.typhoon, 'typhoon') },
    { key: 'hazard', label: '主要灾害·频率', group: 'risk', get: (d) => d.hazard ? d.hazard.hazards[0].freq * 10 + d.hazard.hazards.length : 0, cell: (d) => hazardCell(d) },
    { key: 'yieldPct', label: '毛回报', group: 'invest', num: true, get: (d) => d.yieldPct, cell: (d) => yieldCell(d) },
    { key: 'payback', label: '回本年', group: 'invest', num: true, get: (d) => d.payback, cell: (d) => fmtYrs(d.payback) },
    { key: '_act', label: '详情', group: 'core', act: true, cell: (d) => d.enr
      ? `<button data-open="${d.id}" class="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-medium whitespace-nowrap">查看</button>`
      : `<span class="${tcx().faint}" title="暂无定位数据">—</span>` },
  ];
  const tstate = { sortKey: 'comfortMonths', sortDir: -1, prov: '', q: '', groups: new Set(['live', 'infra', 'risk']) };

  const visibleCols = () => COLS.filter((c) => c.group === 'core' || c.group === 'price' || tstate.groups.has(c.group));

  function tableView() {
    const rows = viewData().filter((d) => (!tstate.prov || d.prov === tstate.prov) &&
      (!tstate.q || (d.city + d.dist + d.loc + d.prov).toLowerCase().includes(tstate.q)));
    const col = COLS.find((c) => c.key === tstate.sortKey) || COLS[0];
    rows.sort((a, b) => {
      const av = col.get(a), bv = col.get(b);
      // Always push null/undefined to the bottom, regardless of sort direction.
      const aNul = av == null, bNul = bv == null;
      if (aNul && bNul) return 0;
      if (aNul) return 1;
      if (bNul) return -1;
      const cmp = col.str ? String(av).localeCompare(String(bv), 'zh') : (av - bv);
      return cmp * tstate.sortDir;
    });
    return rows;
  }

  function renderTable() {
    const cols = visibleCols();
    const rows = tableView();
    const dk = isDark();
    const thActCls = dk ? 'text-slate-100' : 'text-slate-900';
    const thIdlCls = dk ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700';
    const head = cols.map((c) => {
      if (c.act) return `<th class="px-3 py-2.5 font-medium text-right whitespace-nowrap ${dk ? 'text-slate-500' : 'text-slate-400'}">${c.label}</th>`;
      const active = tstate.sortKey === c.key;
      const arrow = active ? (tstate.sortDir === 1 ? '▲' : '▼') : '';
      return `<th data-col="${c.key}" class="px-3 py-2.5 font-medium cursor-pointer select-none whitespace-nowrap ${c.num ? 'text-right' : 'text-left'} ${active ? thActCls : thIdlCls}">${c.label}<span class="ml-0.5 text-[0.6rem]">${arrow}</span></th>`;
    }).join('');
    const tdTextCls = dk ? 'text-slate-300' : 'text-slate-700';
    const body = rows.map((d) => {
      const tds = cols.map((c) => {
        if (c.act) return `<td class="px-3 py-2 text-right whitespace-nowrap">${c.cell(d)}</td>`;
        const cls = c.num ? `text-right tabular-nums ${tdTextCls}` : tdTextCls;
        return `<td class="px-3 py-2 ${cls} whitespace-nowrap">${c.cell(d)}</td>`;
      }).join('');
      const rowCls = dk
        ? 'border-t border-slate-700/60 hover:bg-slate-700/40'
        : 'border-t border-slate-100 hover:bg-slate-50/70';
      return `<tr class="${rowCls}">${tds}</tr>`;
    }).join('');
    const headBg = dk ? 'bg-slate-800' : 'bg-slate-50';
    document.getElementById('table-head').innerHTML = `<tr class="${headBg} text-xs uppercase tracking-wider">${head}</tr>`;
    document.getElementById('table-body').innerHTML = body;
    document.getElementById('table-count').textContent = `显示 ${rows.length} / ${viewData().length} 套`;
  }

  function updateProvFilter() {
    const sel = document.getElementById('prov-filter');
    if (!sel) return;
    const cur = sel.value;
    const vd = viewData();
    const provs = [...new Set(vd.map((d) => d.prov))].sort((a, b) => a.localeCompare(b, 'zh'));
    sel.innerHTML = `<option value="">全部省份（${vd.length}）</option>` +
      provs.map((p) => `<option value="${p}">${p}（${vd.filter((d) => d.prov === p).length}）</option>`).join('');
    if (cur && provs.includes(cur)) sel.value = cur;
    else { sel.value = ''; tstate.prov = ''; }
  }

  function refreshViews() {
    updateProvFilter();
    safeRun('renderKPIs', renderKPIs);
    safeRun('renderScatter', renderScatter);
    safeRun('renderRankings', renderRankings);
    safeRun('renderProvinceChart', renderProvinceChart);
    safeRun('renderTable', renderTable);
    safeRun('renderMap', renderMap);
  }

  function styleGroupChips() {
    const dk = isDark();
    document.querySelectorAll('[data-group]').forEach((b) => {
      const on = tstate.groups.has(b.dataset.group);
      b.className = 'px-3 py-1.5 rounded-md text-xs font-medium transition-colors ' +
        (on
          ? (dk ? 'bg-emerald-700 text-white' : 'bg-emerald-600 text-white')
          : (dk ? 'bg-slate-800 text-slate-400 border border-slate-600 hover:text-slate-100' : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-900'));
    });
  }

  function wireTable() {
    updateProvFilter();
    document.getElementById('prov-filter').addEventListener('change', (e) => {
      tstate.prov = e.target.value; renderTable();
    });

    const q = document.getElementById('table-search');
    q.addEventListener('input', () => { tstate.q = q.value.trim().toLowerCase(); renderTable(); });

    document.getElementById('table-head').addEventListener('click', (e) => {
      const th = e.target.closest('[data-col]');
      if (!th) return;
      const key = th.dataset.col;
      const col = COLS.find((c) => c.key === key);
      if (tstate.sortKey === key) tstate.sortDir *= -1;
      else { tstate.sortKey = key; tstate.sortDir = (col && (col.str || key === 'id')) ? 1 : -1; }
      renderTable();
    });

    document.querySelectorAll('[data-group]').forEach((b) => b.addEventListener('click', () => {
      const g = b.dataset.group;
      if (tstate.groups.has(g)) tstate.groups.delete(g); else tstate.groups.add(g);
      styleGroupChips(); renderTable();
    }));
    styleGroupChips();

    document.getElementById('csv-export').addEventListener('click', exportCSV);
    document.getElementById('table-body').addEventListener('click', (e) => {
      const b = e.target.closest('[data-open]');
      if (b) openListing(+b.dataset.open);
    });
  }

  function exportCSV() {
    const cols = [
      ['序号', (d) => d.id], ['省份', (d) => d.prov], ['城市', (d) => d.city],
      ['区/镇', (d) => d.dist], ['小区', (d) => d.loc], ['总价(万元)', (d) => d.priceWan],
      ['面积(㎡)', (d) => d.area], ['单价(元/㎡)', (d) => Math.round(d.unitPrice)],
      ['月租(元)', (d) => d.rent],
      ['气候类型', (d) => d.climateType || ''], ['年温差(℃)', (d) => d.tempRange],
      ['1月均温(℃)', (d) => d.janTemp], ['7月均温(℃)', (d) => d.julTemp],
      ['舒适天数', (d) => d.comfortDayCount != null ? d.comfortDayCount : d.comfortMonths],
      ['舒适日期', (d) => d.comfortRange],
      ['极端天数', (d) => d.extremeDayCount != null ? d.extremeDayCount : d.extremeMonths],
      ['极端日期', (d) => d.extremeRange],
      ['年降水(mm)', (d) => d.annualPrecip], ['海拔(m)', (d) => d.elevation],
      ['供暖', (d) => d.heating || ''],
      ['医院(km)', (d) => d.hospitalKm],
      ['轨交(km)', (d) => d.transitKm == null ? '' : (d.transitKind === 'metro' ? `地铁${d.transitKm}` : `火车${d.transitKm}`)],
      ['机场(km)', (d) => d.airportKm], ['海岸(km)', (d) => d.coastKm],
      ['地震带(省级)', (d) => d.seismic], ['台风暴露', (d) => d.typhoon],
      ['主要灾害(频率)', (d) => d.hazard ? d.hazard.hazards.map((h) => `${h.type}(${h.freqLabel})`).join('、') : ''],
      ['毛回报(%)', (d) => d.yieldPct == null ? '' : d.yieldPct.toFixed(1)], ['回本(年)', (d) => d.payback == null ? '' : d.payback.toFixed(1)],
      ['更新', (d) => d.updated],
    ];
    const esc = (s) => { const v = s == null ? '' : String(s); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
    const lines = [cols.map((c) => c[0]).join(',')];
    tableView().forEach((d) => lines.push(cols.map((c) => esc(c[1](d))).join(',')));
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'china-small-city-housing.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---- per-listing modal: satellite / vicinity / climate -----------------
  const TILE_SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const TILE_STREET = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const POI_META = {
    metro: { label: '地铁', color: '#2563eb' }, train: { label: '火车/高铁', color: '#7c3aed' },
    airport: { label: '机场', color: '#0f766e' }, hospital: { label: '医院', color: '#dc2626' },
    mall: { label: '商场', color: '#d97706' }, coast: { label: '海边', color: '#0ea5e9' },
  };
  const ZOOM_BY_LEVEL = { loc: 16, dist: 14, city: 12, prefecture: 11 };
  let lmCurrent = null, lmActiveTab = 'sat', lmSatMap = null, lmNearMap = null, lmClimateChart = null, lmTabInit = {};

  function lmStyleTabs(active) {
    const dk = isDark();
    document.querySelectorAll('[data-lm-tab]').forEach((b) => {
      const on = b.dataset.lmTab === active;
      b.className = 'lm-tab px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' +
        (on
          ? (dk ? 'bg-slate-100 text-slate-900' : 'bg-slate-900 text-white')
          : (dk ? 'bg-slate-700 text-slate-400 hover:text-slate-100' : 'bg-slate-100 text-slate-500 hover:text-slate-900'));
    });
    document.querySelectorAll('[data-lm-pane]').forEach((p) =>
      p.classList.toggle('hidden', p.dataset.lmPane !== active));
  }

  function openListing(id) {
    const d = DATA.find((x) => x.id === id);
    if (!d || !d.enr) return;
    lmCurrent = d; lmActiveTab = 'sat'; lmTabInit = {};
    const e = d.enr;
    document.getElementById('lm-title').textContent = cityLabel(d);
    document.getElementById('lm-sub').innerHTML =
      `${d.prov} · ${d.city}${d.dist ? ' · ' + d.dist : ''} &nbsp;|&nbsp; 总价 ${fmtWan(d.priceWan)} · ${d.area}㎡ · ${d.climateType || ''} ` +
      `<span class="ml-1 inline-block rounded px-1.5 py-0.5 text-xs ${tcx().badge}">定位 ${e.geoLabel || '?'}</span>`;
    const tabs = { sat: '🛰 卫星图', near: '📍 周边', climate: '🌡 气候 / 灾害' };
    document.querySelectorAll('[data-lm-tab]').forEach((b) => { b.textContent = tabs[b.dataset.lmTab]; });
    document.getElementById('listing-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    lmShowTab('sat');
  }

  function lmShowTab(tab) {
    lmActiveTab = tab;
    lmStyleTabs(tab);
    const d = lmCurrent; if (!d) return;
    const e = d.enr;
    if (tab === 'sat') {
      if (!lmTabInit.sat) {
        lmTabInit.sat = true;
        setTimeout(() => {
          lmSatMap = L.map('lm-sat-map', { scrollWheelZoom: true }).setView([e.lat, e.lng], ZOOM_BY_LEVEL[e.geoLevel] || 14);
          L.tileLayer(TILE_SAT, { maxZoom: 19, attribution: '© Esri World Imagery' }).addTo(lmSatMap);
          L.circleMarker([e.lat, e.lng], { radius: 9, color: '#fff', weight: 2, fillColor: '#059669', fillOpacity: 1 }).addTo(lmSatMap).bindPopup(d.loc);
          setTimeout(() => lmSatMap && lmSatMap.invalidateSize(), 180);
        }, 60);
      } else { setTimeout(() => lmSatMap && lmSatMap.invalidateSize(), 60); }
    } else if (tab === 'near') {
      if (!lmTabInit.near) { lmTabInit.near = true; setTimeout(() => lmInitNear(d), 60); }
      else { setTimeout(() => lmNearMap && lmNearMap.invalidateSize(), 60); }
    } else if (tab === 'climate') {
      lmRenderClimate(d);
    }
  }

  function lmRenderNearList(d) {
    const e = d.enr, pois = e.pois || {};
    const items = Object.keys(POI_META).map((cat) => {
      const m = POI_META[cat], p = pois[cat];
      if (!p) return `<div class="flex items-center gap-2 ${tcx().muted}"><span class="inline-block w-2 h-2 rounded-full shrink-0" style="background:${m.color}"></span>${m.label}：—</div>`;
      const dk = fmtKm(p.distKm);
      const tag = p.source === 'research' ? ' <span class="text-[10px] text-amber-500 dark:text-amber-400" title="子代理调研补充">调研</span>' : '';
      const noPin = (p.lat == null && p.distKm == null && p.name) ? ` <span class="text-[10px] ${tcx().muted}">名称(未定位)</span>` : '';
      return `<div class="flex items-center gap-2"><span class="inline-block w-2 h-2 rounded-full shrink-0" style="background:${m.color}"></span><span class="${tcx().body} truncate"><b>${m.label}</b> ${p.name || ''} <span class="${tcx().muted}">${dk}</span>${tag}${noPin}</span></div>`;
    });
    document.getElementById('lm-near-list').innerHTML = items.join('');
  }

  function lmInitNear(d) {
    const e = d.enr;
    lmNearMap = L.map('lm-near-map', { scrollWheelZoom: true }).setView([e.lat, e.lng], 11);
    L.tileLayer(TILE_STREET, { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(lmNearMap);
    const pts = [[e.lat, e.lng]];
    L.circleMarker([e.lat, e.lng], { radius: 8, color: '#fff', weight: 2, fillColor: '#059669', fillOpacity: 1 }).addTo(lmNearMap).bindPopup('小区：' + d.loc);
    const pois = e.pois || {};
    Object.keys(POI_META).forEach((cat) => {
      const m = POI_META[cat], p = pois[cat];
      if (p && p.lat != null && p.lng != null) {
        pts.push([p.lat, p.lng]);
        L.circleMarker([p.lat, p.lng], { radius: 6, color: '#fff', weight: 1.5, fillColor: m.color, fillOpacity: 0.95 }).addTo(lmNearMap).bindPopup(`${m.label}：${p.name || ''}<br/>${fmtKm(p.distKm)}`);
      }
    });
    lmRenderNearList(d);
    if (pts.length > 1) lmNearMap.fitBounds(pts, { padding: [28, 28], maxZoom: 13 });
    setTimeout(() => lmNearMap.invalidateSize(), 60);
  }

  function lmRenderClimate(d) {
    const e = d.enr, risk = e.risk, cl = e.climate;
    const tc = tcx();
    const riskLine = risk
      ? `<span class="font-medium ${tc.strong}">气候与风险（粗略）</span>：${risk.summary} · <strong class="${tc.body}">${d.climateType || '—'}</strong>（年温差 ${d.tempRange == null ? '—' : d.tempRange + '℃'}：最冷月 ${fmtTemp(d.tMin)} / 最热月 ${fmtTemp(d.tMax)}；舒适 ${d.comfortRange} / 极端 ${d.extremeRange}）`
      : '';
    let heatLine = '';
    if (d.heating) {
      const [bg, fg] = HEATING_STYLE[d.heating] || ['#f1f5f9', '#475569'];
      heatLine = `<div class="mt-2 text-sm"><span class="font-medium ${tc.strong}">冬季供暖</span>：` +
        `<span class="inline-block rounded px-1.5 py-0.5 text-xs font-medium" style="background:${bg};color:${fg}">${d.heating}</span>` +
        `<span class="${tc.muted} ml-1">${d.heatingNote}</span></div>`;
    }
    let hazLine = '';
    if (d.hazard) {
      const tags = d.hazard.hazards.map((h) =>
        `<span class="inline-block rounded px-1.5 py-0.5 text-xs" style="background:${tc.hazardBg};color:${FREQ_COLOR[h.freq]}" title="${h.note}">${h.type} · ${h.freqLabel}</span>`).join(' ');
      hazLine = `<div class="mt-3"><span class="font-medium ${tc.strong}">${d.prov}省级历史灾害概况</span>` +
        `<span class="${tc.muted}">（${d.hazard.headline}）</span><div class="mt-1.5 flex flex-wrap gap-1.5">${tags}</div></div>`;
    }
    document.getElementById('lm-risk').innerHTML = (riskLine || `<span class="${tc.muted}">暂无风险数据</span>`) + heatLine + hazLine;
    if (lmClimateChart) { lmClimateChart.destroy(); lmClimateChart = null; }
    if (!window.Chart) return;
    const ctxEl = document.getElementById('lm-climate-chart');
    const dy = d.daily;
    if (dy && dy.curve && dy.curve.tmean) {
      // 365-day temperature curve; the 日均温 line is coloured per segment —
      // green where comfortable, red where extreme, slate otherwise.
      const flag = new Array(366).fill(0);
      const fill = (rr, v) => (rr || []).forEach(([s, e]) => {
        if (s <= e) { for (let i = s; i <= e; i++) flag[i] = v; }
        else { for (let i = s; i <= 365; i++) flag[i] = v; for (let i = 1; i <= e; i++) flag[i] = v; }
      });
      fill(dy.comfortDays, 1); fill(dy.extremeDays, 2);
      const segColor = (s) => { const f = flag[(s.p1DataIndex || 0) + 1]; return f === 2 ? '#dc2626' : f === 1 ? '#059669' : '#94a3b8'; };
      const labels = Array.from({ length: 365 }, (_, i) => { let m = 0, x = i + 1; while (x > _DIM[m]) { x -= _DIM[m]; m += 1; } return x === 1 ? (m + 1) + '月' : ''; });
      lmClimateChart = new Chart(ctxEl, {
        type: 'line',
        data: { labels, datasets: [
          { label: '日高温', data: dy.curve.tmax, borderColor: 'rgba(220,38,38,0.3)', borderWidth: 1, pointRadius: 0, tension: 0.3 },
          { label: '日低温', data: dy.curve.tmin, borderColor: 'rgba(37,99,235,0.3)', borderWidth: 1, pointRadius: 0, tension: 0.3 },
          { label: '日均温（绿=舒适·红=极端）', data: dy.curve.tmean, borderColor: '#64748b', borderWidth: 2.5, pointRadius: 0, tension: 0.3, segment: { borderColor: segColor } },
        ] },
        options: {
          responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
          plugins: { legend: { labels: { boxWidth: 12, font: { size: 10 } } },
            tooltip: { callbacks: { title: (it) => doyToDate(((it[0] && it[0].dataIndex) || 0) + 1) } } },
          scales: {
            y: { title: { display: true, text: '℃' }, grid: { color: themeGrid() } },
            x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, font: { size: 10 } } },
          },
        },
      });
      return;
    }
    if (!cl) return;
    const M = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    const pick = (i) => M.map((m) => (cl[m] ? cl[m][i] : (cl[+m] ? cl[+m][i] : null)));
    lmClimateChart = new Chart(document.getElementById('lm-climate-chart'), {
      data: {
        labels: M.map((m) => m + '月'),
        datasets: [
          { type: 'bar', label: '降水(mm)', data: pick(3), yAxisID: 'yP', backgroundColor: 'rgba(14,165,233,0.35)', borderColor: '#0ea5e9', borderWidth: 1, borderRadius: 3, order: 3 },
          { type: 'line', label: '均温(℃)', data: pick(0), yAxisID: 'yT', borderColor: '#059669', backgroundColor: '#059669', tension: 0.35, pointRadius: 2, order: 1 },
          { type: 'line', label: '均高温', data: pick(1), yAxisID: 'yT', borderColor: 'rgba(220,38,38,0.5)', borderDash: [4, 3], pointRadius: 0, tension: 0.35, order: 2 },
          { type: 'line', label: '均低温', data: pick(2), yAxisID: 'yT', borderColor: 'rgba(37,99,235,0.5)', borderDash: [4, 3], pointRadius: 0, tension: 0.35, order: 2 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { boxWidth: 12, font: { size: 11 } } } },
        scales: {
          yT: { position: 'left', title: { display: true, text: '℃' }, grid: { color: themeGrid() } },
          yP: { position: 'right', title: { display: true, text: 'mm' }, grid: { display: false }, beginAtZero: true },
          x: { grid: { display: false } },
        },
      },
    });
  }

  function closeModal() {
    document.getElementById('listing-modal').classList.add('hidden');
    document.body.style.overflow = '';
    if (lmSatMap) { lmSatMap.remove(); lmSatMap = null; }
    if (lmNearMap) { lmNearMap.remove(); lmNearMap = null; }
    if (lmClimateChart) { lmClimateChart.destroy(); lmClimateChart = null; }
    lmTabInit = {}; lmCurrent = null;
  }

  // ---- boot --------------------------------------------------------------
  // Hero headline counts reflect the actual SMALL-CITY data (tier-1 refs excluded —
  // the framing is 全国小城市). Runtime-computed from the loaded data so adding cities
  // updates the page even if `manage.py build` (which also bakes these into the static
  // HTML + meta tags for SEO/no-JS) wasn't re-run. Not stuck at any literal number.
  function syncHeroCounts() {
    const sc = DATA.filter((d) => !isDefaultHidden(d));
    const c = document.getElementById('hero-count');
    const p = document.getElementById('hero-provs');
    if (c) c.textContent = sc.length + ' 套';
    if (p) p.textContent = new Set(sc.map((d) => d.prov)).size + ' 个省 / 直辖市';
  }

  // ---- theme toggle (dark mode) ------------------------------------------
  function refreshModalTheme() {
    if (!lmCurrent) return;
    const d = lmCurrent, e = d.enr;
    document.getElementById('lm-sub').innerHTML =
      `${d.prov} · ${d.city}${d.dist ? ' · ' + d.dist : ''} &nbsp;|&nbsp; 总价 ${fmtWan(d.priceWan)} · ${d.area}㎡ · ${d.climateType || ''} ` +
      `<span class="ml-1 inline-block rounded px-1.5 py-0.5 text-xs ${tcx().badge}">定位 ${e.geoLabel || '?'}</span>`;
    lmStyleTabs(lmActiveTab);
    if (lmActiveTab === 'near' && lmTabInit.near) safeRun('lmRenderNearList', () => lmRenderNearList(d));
    if (lmActiveTab === 'climate') safeRun('lmRenderClimate', () => lmRenderClimate(d));
  }

  function applyThemeToCharts() {
    chartBase();  // refresh Chart.js global color tokens
    safeRun('renderKPIs', renderKPIs);
    safeRun('renderScatter', renderScatter);
    safeRun('renderRankings', renderRankings);
    safeRun('renderProvinceChart', renderProvinceChart);
    safeRun('renderTable', renderTable);
    safeRun('styleGroupChips', styleGroupChips);
    safeRun('dimTabs', dimTabs);
    safeRun('baseTabs', baseTabs);
    safeRun('renderBaseLegend', renderBaseLegend);
    // Re-init ECharts map with new geo colours
    if (echartsMap && mapReady) {
      const dk = isDark();
      echartsMap.setOption({
        backgroundColor: dk ? '#0f172a' : 'transparent',
        geo: [{
          itemStyle: { areaColor: dk ? '#1e293b' : '#f8fafc', borderColor: dk ? '#334155' : '#cbd5e1' },
          emphasis: { itemStyle: { areaColor: dk ? '#334155' : '#eef2f7' } },
        }],
      });
      safeRun('renderMap', renderMap);
    }
    safeRun('refreshModalTheme', refreshModalTheme);
  }

  function wireThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const nowDark = document.documentElement.classList.toggle('dark');
      try { localStorage.setItem('housing-theme', nowDark ? 'dark' : 'light'); } catch (e) {}
      applyThemeToCharts();
    });
    // Also react to OS-level preference changes
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('housing-theme')) {
          document.documentElement.classList.toggle('dark', e.matches);
          applyThemeToCharts();
        }
      });
    } catch (e) {}
  }

  function init() {
    chartBase();
    safeRun('syncHeroCounts', syncHeroCounts);
    // table + interaction wiring first — must survive chart/map failures
    safeRun('wireTable', wireTable);
    safeRun('renderTable', renderTable);

    document.querySelectorAll('[data-rank]').forEach((b) =>
      b.addEventListener('click', () => { rankKey = b.dataset.rank; safeRun('renderRankings', renderRankings); }));
    document.querySelectorAll('[data-prov]').forEach((b) =>
      b.addEventListener('click', () => { provMetric = b.dataset.prov; safeRun('renderProvinceChart', renderProvinceChart); }));
    document.querySelectorAll('[data-dim]').forEach((b) =>
      b.addEventListener('click', () => { dimKey = b.dataset.dim; safeRun('renderMap', renderMap); dimTabs(); }));
    document.querySelectorAll('[data-base]').forEach((b) =>
      b.addEventListener('click', () => { baseKey = b.dataset.base; safeRun('renderMap', renderMap); baseTabs(); }));

    safeRun('renderKPIs', renderKPIs);
    safeRun('renderScatter', renderScatter);
    safeRun('renderRankings', renderRankings);
    safeRun('renderProvinceChart', renderProvinceChart);

    const zi = document.getElementById('map-zoom-in'), zo = document.getElementById('map-zoom-out'), zr = document.getElementById('map-zoom-reset');
    if (zi) zi.addEventListener('click', () => zoomBy(1.45));
    if (zo) zo.addEventListener('click', () => zoomBy(1 / 1.45));
    if (zr) zr.addEventListener('click', zoomReset);

    const lmClose = document.getElementById('lm-close');
    const lmBackdrop = document.getElementById('lm-backdrop');
    if (lmClose) lmClose.addEventListener('click', closeModal);
    if (lmBackdrop) lmBackdrop.addEventListener('click', closeModal);
    document.querySelectorAll('[data-lm-tab]').forEach((b) =>
      b.addEventListener('click', () => lmShowTab(b.dataset.lmTab)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    wireThemeToggle();
    initMap();

    const tier1Toggle = document.getElementById('tier1-toggle');
    if (tier1Toggle) {
      tier1Toggle.checked = tier1On;
      tier1Toggle.addEventListener('change', () => {
        tier1On = tier1Toggle.checked;
        refreshViews();
      });
    }
  }

  // smoke-test hook
  window.__tier1On = () => tier1On;
  window.__setTier1On = (v) => { tier1On = !!v; refreshViews(); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
