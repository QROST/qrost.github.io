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
 *   priceYuan = local priceWan×10000 converted to CNY · unitPrice = priceYuan/area
 *   yieldPct  = rent×12/priceYuan×100 · payback = priceYuan/(rent×12)
 *
 * Derived livability metrics (from baked climate / elevation / pois):
 *   janTemp/julTemp  Jan & Jul mean ℃        annualPrecip  Σ monthly mm
 *   comfortMonths    months with tmin≥8 & tmax≤26  coldMonths  tmean<0
 *   hotMonths        tmax≥33                  extremeMonths cold+hot (tmean<-5 or tmax≥33)
 *   tempRange        warmest-month mean − coldest-month mean (℃, 年温差)
 *   climateType      label from (annualMean, tempRange): 四季如春 / 常年温暖 /
 *                    冬暖夏凉 / 夏热冬暖 / 长夏无冬 / 四季分明 / 常年凉冷 / 温和过渡
 *   hospitalKm/trainKm/hsrKm/airportKm/coastKm   nearest baked POI distance
 */
(function () {
  'use strict';

  const EXTREME_HEAT_TMAX_C = 33; // livability extreme-heat: smoothed daily high °C
  const EXTREME_COLD_TMEAN_C = -5; // livability extreme-cold: smoothed daily mean °C
  const COMFORT_TMIN_C = 8;        // comfort-day band: daily low ≥
  const COMFORT_TMAX_C = 26;       // comfort-day band: daily high ≤

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

  // ---- i18n (zh default; en → USD / sqft / pinyin communities) ------------
  const I18N = () => window.HOUSING_I18N || {};
  const t = (k, v) => (I18N().t ? I18N().t(k, v) : k);
  const isEn = () => I18N().isEn && I18N().isEn();
  const disp = () => I18N();
  const trCl = (v) => (disp().displayClimate && isEn()) ? disp().displayClimate(v) : v;
  const trHeat = (v) => (disp().displayHeating && isEn()) ? disp().displayHeating(v) : v;
  const trHz = (v) => (disp().displayHazardType ? disp().displayHazardType(v) : v);
  const trFs = (v) => (disp().displayFreqShort && isEn()) ? disp().displayFreqShort(v) : v;
  const trFl = (v) => (disp().displayFreqLabel && isEn()) ? disp().displayFreqLabel(v) : v;
  const trFc = (v) => (disp().displayFreqCommonness ? disp().displayFreqCommonness(v) : '');
  const trProv = (v) => (disp().displayProvince ? disp().displayProvince(v) : v);
  const trCity = (v) => (disp().displayCity && isEn()) ? disp().displayCity(v) : v;
  const trDist = (v) => (disp().displayDistrict && isEn()) ? disp().displayDistrict(v) : v;
  const trSeis = (v) => (disp().displaySeismic && isEn()) ? disp().displaySeismic(v) : v;
  const trTy = (v) => (disp().displayTyphoon && isEn()) ? disp().displayTyphoon(v) : v;
  const trGeo = (v) => (disp().displayGeoLabel && isEn()) ? disp().displayGeoLabel(v) : v;
  const trHead = (v) => (disp().displayHeadline && isEn()) ? disp().displayHeadline(v) : v;
  const trHNote = (v) => (disp().displayHazardNote && isEn()) ? disp().displayHazardNote(v) : v;
  const hasCjk = (s) => /[\u4e00-\u9fff]/.test(s || '');
  const trHeadEn = (v) => { if (!isEn()) return v; const x = trHead(v); return x && !hasCjk(x) ? x : ''; };
  const trHNoteEn = (v) => { if (!isEn()) return v; const x = trHNote(v); return x && !hasCjk(x) ? x : ''; };
  const trHeatNote = (v) => (disp().displayHeatingNote && isEn()) ? disp().displayHeatingNote(v) : v;
  const trRisk = (v) => (disp().displayRiskSummary && isEn()) ? disp().displayRiskSummary(v) : v;
  const trField = (v) => (disp().displayFieldLabel && isEn()) ? disp().displayFieldLabel(v) : v;
  const fmtDoy = (d) => (disp().formatDoy ? disp().formatDoy(d) : doyToDate(d));

  // Province short form (as in the data) → full GeoJSON name (DataV / Aliyun).
  const PROV_FULL = {
    '北京': '北京市', '天津': '天津市',
    '黑龙江': '黑龙江省', '吉林': '吉林省', '辽宁': '辽宁省', '河北': '河北省',
    '河南': '河南省', '山东': '山东省', '安徽': '安徽省', '上海': '上海市',
    '江苏': '江苏省', '浙江': '浙江省', '湖北': '湖北省',
    '广东': '广东省', '广西': '广西壮族自治区', '福建': '福建省',
    '重庆': '重庆市', '贵州': '贵州省', '四川': '四川省', '云南': '云南省',
    '甘肃': '甘肃省', '海南': '海南省', '内蒙古': '内蒙古自治区',
    '山西': '山西省', '陕西': '陕西省', '宁夏': '宁夏回族自治区',
    '新疆': '新疆维吾尔自治区', '湖南': '湖南省', '江西': '江西省',
    '台湾': '台湾省',
    'California': 'California',
    '香港': '香港特别行政区',
  };

  // ---- metric derivation -------------------------------------------------
  const RAW = window.HOUSING_LISTINGS || [];
  const ENR = window.HOUSING_ENRICHED || {};
  const HAZ = window.HOUSING_HAZARDS || {};

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const poiKm = (e, cat) => (e && e.pois && e.pois[cat] && e.pois[cat].distKm != null)
    ? e.pois[cat].distKm : null;
  // Table + modal share one hospital POI: OSM `hospital` (nearby map pin) wins;
  // fall back to curated `hospital_tier3` only when no OSM hospital is baked.
  const hospitalPoi = (e) => {
    if (!e || !e.pois) return null;
    const h = e.pois.hospital;
    if (h && h.distKm != null) return h;
    const t = e.pois.hospital_tier3;
    return (t && t.distKm != null) ? t : null;
  };
  const hospitalKmOf = (e) => { const p = hospitalPoi(e); return p ? p.distKm : null; };
  // Nearest 高铁站 only (`pois.hsr`); fall back to nearest train when it is tagged highspeed.
  const hsrKmOf = (e) => {
    const h = poiKm(e, 'hsr');
    if (h != null) return h;
    const t = e && e.pois && e.pois.train;
    return (t && t.trainKind === 'highspeed' && t.distKm != null) ? t.distKm : null;
  };

  // Pull a [tmean,tmax,tmin,precip] month tuple (climate keys are stringified).
  const moOf = (cl, m) => cl ? (cl[m] || cl[String(m)] || null) : null;

  // Format a set of month numbers (1-12) into readable cyclic ranges:
  //   [4,5,6,9,10] → "4–6月、9–10月"   [11,12,1,2] → "11月–次年2月"   all → "全年".
  function monthRanges(months) {
    if (!months || !months.length) return t('monthNone');
    if (months.length >= 12) return t('monthAll');
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
    if (!isEn()) {
      return runs.map(([a, b]) =>
        a === b ? `${a}月` : (a <= b ? `${a}–${b}月` : `${a}月–次年${b}月`)).join(isEn() ? ', ' : '、');
    }
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return runs.map(([a, b]) =>
      a === b ? names[a - 1]
        : (a <= b ? `${names[a - 1]}–${names[b - 1]}` : `${names[a - 1]}–${names[b - 1]} (wrap)`)
    ).join(', ');
  }

  // Day-of-year (1-365) helpers, sharing the fixed non-leap calendar with enrich.py.
  const _DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  function doyToDate(doy) {
    if (disp().formatDoy && isEn()) return disp().formatDoy(doy);
    let m = 0, x = Math.max(1, Math.min(365, Math.round(doy)));
    while (x > _DIM[m]) { x -= _DIM[m]; m += 1; }
    return `${m + 1}月${x}日`;
  }
  // [[s,e],…] day-of-year ranges → "4月18日–10月12日"（跨年 → "…–次年…"）.
  function dayRanges(ranges) {
    if (!ranges || !ranges.length) return t('monthNone');
    if (ranges.length === 1 && ranges[0][0] === 1 && ranges[0][1] === 365) return t('monthAll');
    const sep = isEn() ? ', ' : '、';
    return ranges.map(([s, e]) =>
      s === e ? doyToDate(s)
        : (s <= e ? `${doyToDate(s)}–${doyToDate(e)}` : (isEn() ? `${doyToDate(s)}–${doyToDate(e)} (wrap)` : `${doyToDate(s)}–次年${doyToDate(e)}`))
    ).join(sep);
  }
  // array[365] of truthy flags → cyclic day ranges → "M月D日…" string.
  function flagsToDayRange(flags) {
    const n = 365;
    if (!flags.some(Boolean)) return t('monthNone');
    if (flags.every(Boolean)) return t('monthAll');
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

  function comfortRangeOf(d) {
    if (d.daily && d.daily.comfortDays) return dayRanges(d.daily.comfortDays);
    return monthRanges(d.comfortSet || []);
  }
  function extremeRangeOf(d) {
    if (d.daily && d.daily.extremeDays && d.daily.extremeDays.length) return dayRanges(d.daily.extremeDays);
    return monthRanges(d.extremeSet || []);
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
      const isExtreme = (a[0] != null && a[0] < -5) || (a[1] != null && a[1] >= EXTREME_HEAT_TMAX_C);
      if (!isExtreme && a[2] != null && a[1] != null && a[2] >= 8 && a[1] <= 26) comfortSet.push(m); // 舒适: 日最低≥8 且日最高≤26，非极端
      if (isExtreme) extremeSet.push(m);
    }
    const jan = moOf(cl, 1), jul = moOf(cl, 7);
    const annualPrecip = rows.reduce((s, a) => s + (a[3] || 0), 0);
    const tmeans = rows.map((a) => a[0]).filter((v) => v != null);
    const annualMean = tmeans.length ? tmeans.reduce((s, v) => s + v, 0) / tmeans.length : null;
    const comfortMonths = comfortSet.length;
    const coldMonths = rows.filter((a) => a[0] != null && a[0] < 0).length;        // freezing average month
    const hotMonths = rows.filter((a) => a[1] != null && a[1] >= EXTREME_HEAT_TMAX_C).length;
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
      humidDayCount: daily ? daily.humidDayCount : null,
      snowDayCount: daily ? daily.snowDayCount : null,
      windyDayCount: daily ? daily.windyDayCount : null,
      sunshineHours: daily ? daily.sunshineHours : null,
      apparentComfortDayCount: daily ? daily.apparentComfortDayCount : null,
      meanHumidityPct: daily ? daily.meanHumidityPct : null,
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
  const TIER1_MAX_PRICE_WAN = 20;   // 万元 (CNY-normalized)
  const TIER1_MAX_UNIT_YUAN = 5000; // 元/㎡ (CNY-normalized)
  const cnyYuanOf = (wan, prov) => {
    const fn = I18N().localWanToCnyYuan;
    return fn ? fn(wan, prov) : wan * 10000;
  };
  const cnyRentOf = (rent, prov) => {
    if (rent == null) return null;
    const fn = I18N().localRentToCny;
    return fn ? fn(rent, prov) : rent;
  };
  function isDefaultHidden(d) {
    const priceYuan = cnyYuanOf(d.priceWan, d.prov);
    return priceYuan / 10000 > TIER1_MAX_PRICE_WAN
      || priceYuan / d.area > TIER1_MAX_UNIT_YUAN;
  }
  let tier1On = false;
  function viewData() {
    return tier1On ? DATA : DATA.filter((d) => !isDefaultHidden(d));
  }
  // China basemap bbox — overseas listings keep coords for climate/POI but skip map dots.
  const CHINA_MAP_BBOX = { lngMin: 73, lngMax: 136, latMin: 18, latMax: 54 };
  function inChinaMap(d) {
    const e = d.enr;
    return e && e.lat != null && e.lng != null
      && e.lng >= CHINA_MAP_BBOX.lngMin && e.lng <= CHINA_MAP_BBOX.lngMax
      && e.lat >= CHINA_MAP_BBOX.latMin && e.lat <= CHINA_MAP_BBOX.latMax;
  }
  function viewGeocoded() {
    return viewData().filter((d) => inChinaMap(d));
  }

  // Declared BEFORE the DATA map below — both run during DATA construction.
  const NOW_MONTH = new Date().getMonth() + 1;

  // Comfort days falling inside the CURRENT month (1-12) — drives the seasonal
  // 「本月最舒适」ranking; computed once at load from the baked 365-day ranges.
  function monthComfortDaysOf(cd) {
    const m = NOW_MONTH;
    let ms = 1; for (let i = 0; i < m - 1; i++) ms += _DIM[i];
    const me = ms + _DIM[m - 1] - 1;
    if (cd.daily && cd.daily.comfortDays) {
      // normalize wrap-around ranges onto the Jan–Dec axis, then overlap
      return cd.daily.comfortDays
        .flatMap(([s, e]) => (s <= e ? [[s, e]] : [[s, 365], [1, e]]))
        .reduce((sum, [s, e]) => sum + Math.max(0, Math.min(e, me) - Math.max(s, ms) + 1), 0);
    }
    if (cd.comfortSet) return cd.comfortSet.includes(m) ? _DIM[m - 1] : 0;
    return null;
  }
  // 灾害负担 = Σ 2^(freq−1) over the listing's local hazard types (freq 1-5,
  // 1 = once a century … 5 = almost annual). Transparent formula — published
  // verbatim in the ranking note. Lower = fewer / rarer recurring hazards.
  function hazardBurdenOf(hz) {
    if (!hz || !hz.hazards || !hz.hazards.length) return null;
    return hz.hazards.reduce((s, h) => s + Math.pow(2, (h.freq || 1) - 1), 0);
  }

  const DATA = RAW.map((d) => {
    const rent = d.rent > 0 ? d.rent : null;          // 0 = 未调研/未知（非"免租"）→ 回报率/月租按未知处理
    const e = ENR[d.id] || ENR[String(d.id)] || null;
    const cd = deriveClimate(e);
    const hz = (e && e.hazard) || HAZ[d.prov] || null;
    return {
      ...d, enr: e, hazard: hz,  // per-listing (prefecture×physics) → province fallback
      monthComfortDays: monthComfortDaysOf(cd), hazardBurden: hazardBurdenOf(hz),
      heating: (HAZ[d.prov] && HAZ[d.prov].heating) || null,
      heatingNote: (HAZ[d.prov] && HAZ[d.prov].heatingNote) || '',
      rent,
      elevation: e && e.elevation != null ? e.elevation : null,
      builtYear: e && e.builtYear != null ? e.builtYear : null,
      builtYearSrc: (e && e.builtYearSrc) || null,
      builtYearApprox: !!(e && e.builtYearApprox),
      hospitalKm: hospitalKmOf(e),
      trainKm: poiKm(e, 'train'),
      hsrKm: hsrKmOf(e),
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
      // LULU avoidance (越远越好): nearest-distance to 7 unwanted land uses.
      wastewaterKm: poiKm(e, 'wastewater'), landfillKm: poiKm(e, 'landfill'),
      incineratorKm: poiKm(e, 'incinerator'), nuclearKm: poiKm(e, 'nuclear'),
      substationKm: poiKm(e, 'substation'), chemicalKm: poiKm(e, 'chemical'),
      sensitiveKm: poiKm(e, 'sensitive'),
      seismic: e && e.risk ? e.risk.seismic : null,
      typhoon: e && e.risk ? e.risk.typhoon : null,
      histTempMax: e && e.histTempMax != null ? e.histTempMax : null,
      histTempMin: e && e.histTempMin != null ? e.histTempMin : null,
      histTempMaxDate: (e && e.histTempMaxDate) || null,
      histTempMinDate: (e && e.histTempMinDate) || null,
      histTempSrc: (e && e.histTempSrc) || null,
      histTempStation: (e && e.histTempStation) || null,
      histTempNote: (e && e.histTempNote) || null,
      histTempLevel: (e && e.histTempLevel) || null,
      ...cd,
      priceYuan: null, priceCnyWan: null, unitPrice: null, rentCny: null, rentYear: null, yieldPct: null, payback: null,
    };
  });

  function rebuildPriceFields() {
    DATA.forEach((d) => {
      const priceYuan = cnyYuanOf(d.priceWan, d.prov);
      const rentCny = d.rent != null ? cnyRentOf(d.rent, d.prov) : null;
      const rentYear = rentCny != null ? rentCny * 12 : null;
      d.priceYuan = priceYuan;
      d.priceCnyWan = priceYuan / 10000;
      d.unitPrice = priceYuan / d.area;
      d.rentCny = rentCny;
      d.rentYear = rentYear;
      d.yieldPct = rentYear != null ? (rentYear / priceYuan) * 100 : null;
      d.payback = rentYear != null ? priceYuan / rentYear : null;
    });
  }
  rebuildPriceFields();

  // ---- formatting --------------------------------------------------------
  const trim = (s) => String(s).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  const fmtWan = (v, prov) => (I18N().formatPriceWan ? I18N().formatPriceWan(v, prov) : trim(v.toFixed(2)) + '万');
  const fmtWanD = (d) => fmtWan(d.priceWan, d.prov);
  const fmtArea = (v) => (I18N().formatArea ? I18N().formatArea(v) : trim(v.toFixed(1)) + '㎡');
  const fmtUnit = (v) => (I18N().formatUnitPrice ? I18N().formatUnitPrice(v) : (v == null ? '—' : Math.round(v).toLocaleString('zh-CN') + '元/㎡'));
  const fmtInt = (v) => (I18N().formatInt ? I18N().formatInt(v) : (v == null ? '—' : Math.round(v).toLocaleString('en-US')));
  const fmtRent = (v, prov) => (I18N().formatRent ? I18N().formatRent(v, prov) : fmtInt(v));
  const priceX = (cnyWan) => (I18N().priceAxisValueCnyWan ? I18N().priceAxisValueCnyWan(cnyWan) : cnyWan);
  const fmtPct = (v) => v == null ? '—' : v.toFixed(1) + '%';
  const fmtYrs = (v) => v == null ? '—' : v.toFixed(1);
  const fmtTemp = (v) => (I18N().formatTemp ? I18N().formatTemp(v) : (v == null ? '—' : Math.round(v) + '°C'));
  const fmtSwing = (v) => (I18N().formatTempSwing ? I18N().formatTempSwing(v) : (v == null ? '—' : trim(v.toFixed(1)) + '°C'));
  const fmtKm = (v) => (I18N().formatDist ? I18N().formatDist(v) : (v == null ? '—' : (v < 1 ? Math.round(v * 1000) + 'm' : (v < 10 ? v.toFixed(1) : Math.round(v)) + ' km')));
  const fmtElev = (v) => (I18N().formatElevation ? I18N().formatElevation(v) : (v == null ? '—' : fmtInt(v) + 'm'));
  const fmtPrecip = (v) => (I18N().formatPrecip ? I18N().formatPrecip(v) : (v == null ? '—' : fmtInt(v) + 'mm'));
  const chartTemp = (v) => (I18N().tempChartValue ? I18N().tempChartValue(v) : v);
  const chartTempArr = (arr) => (arr || []).map((v) => (v == null ? v : chartTemp(v)));
  const chartPrecip = (v) => (I18N().precipChartValue ? I18N().precipChartValue(v) : v);
  const chartPrecipArr = (arr) => (arr || []).map((v) => (v == null ? v : chartPrecip(v)));
  const tempAxis = () => (I18N().tempAxisLabel ? I18N().tempAxisLabel() : '°C');
  const precipAxis = () => (I18N().precipAxisLabel ? I18N().precipAxisLabel() : 'mm');
  const cityLabel = (d) => {
    const parts = [];
    if (d.prov) parts.push(trProv(d.prov));
    const city = trCity(d.city).replace(/ City$/, '').replace(/市$/, '');
    if (city) parts.push(city);
    const loc = I18N().communityName ? I18N().communityName(d.loc, d.name_en) : d.loc;
    if (loc) parts.push(loc);
    return parts.join(isEn() ? ', ' : ' · ');
  };
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
  const AGE_FUTURE = '#cbd5e1'; // slate-300 — 未交付期房
  function builtAgeOf(d) {
    if (d.builtYear == null) return null;
    return NOW_YEAR - d.builtYear;
  }
  function fmtBuiltAgeLabel(age) {
    if (age == null) return '—';
    if (age < 0) {
      const n = -age;
      return isEn() ? `−${n} yr` : `未交付 · ${n}年后`;
    }
    return `${age}${isEn() ? ' yr' : '年'}`;
  }
  const NOW_YEAR = new Date().getFullYear();

  // ---- report-card grades -------------------------------------------------
  // z-score per dimension against the DEFAULT-VISIBLE population only — hidden
  // benchmark rows never shift the curve (they still RECEIVE grades against
  // it). log() on price/distance dims tames the long tails before z-scoring.
  const GRADE_DIMS = {
    price:   { labelKey: 'gdPrice',   get: (d) => (d.unitPrice > 0 ? -Math.log(d.unitPrice) : null) },
    climate: { labelKey: 'gdClimate', get: (d) => d.comfortDayCount },
    hazard:  { labelKey: 'gdHazard',  get: (d) => (d.hazardBurden == null ? null : -d.hazardBurden) },
    access:  { labelKey: 'gdAccess',  get: (d) => (d.transitKm == null ? null : -Math.log(1 + d.transitKm)) },
    medical: { labelKey: 'gdMedical', get: (d) => (d.hospitalKm == null ? null : -Math.log(1 + d.hospitalKm)) },
    age:     { labelKey: 'gdAge',     get: (d) => d.builtYear },
  };
  const VISIBLE_POP = DATA.filter((d) => !isDefaultHidden(d));
  const GRADE_STATS = (() => {
    const stats = {};
    Object.keys(GRADE_DIMS).forEach((k) => {
      const xs = VISIBLE_POP.map(GRADE_DIMS[k].get).filter((v) => v != null && isFinite(v));
      const mean = xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
      const sd = Math.sqrt(xs.reduce((s, v) => s + (v - mean) * (v - mean), 0) / (xs.length || 1)) || 1;
      stats[k] = { mean, sd };
    });
    return stats;
  })();
  // z → letter; thresholds published in the methodology note (i18n gradeNote).
  const GRADE_STEPS = [[1.3, 'A+'], [0.8, 'A'], [0.4, 'A−'], [0.1, 'B+'], [-0.25, 'B'], [-0.6, 'B−'], [-1.1, 'C+'], [-Infinity, 'C']];
  function gradeOf(d, k) {
    const v = GRADE_DIMS[k].get(d);
    if (v == null || !isFinite(v)) return null;
    const z = (v - GRADE_STATS[k].mean) / GRADE_STATS[k].sd;
    return GRADE_STEPS.find(([th]) => z >= th)[1];
  }
  const gradeStyle = (g) => (g[0] === 'A' ? ['#dcfce7', '#166534'] : g[0] === 'B' ? ['#fef9c3', '#854d0e'] : ['#fee2e2', '#b91c1c']);
  function gradeChips(d) {
    return Object.keys(GRADE_DIMS).map((k) => {
      const g = gradeOf(d, k);
      if (!g) return '';
      const [bg, fg] = gradeStyle(g);
      return `<span class="inline-block rounded px-1.5 py-0.5 text-[0.65rem] font-medium whitespace-nowrap" style="background:${bg};color:${fg}" title="${t('gradeTitle')}">${t(GRADE_DIMS[k].labelKey)} ${g}</span>`;
    }).filter(Boolean).join(' ');
  }

  // ---- 值得看 badge: simultaneously in the good quartile on price + climate,
  // no almost-annual hazard, rail within reach. Checklist is fully explainable.
  const quantileOf = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) * p)] : null; };
  const WORTH_THRESH = {
    unitQ1: quantileOf(VISIBLE_POP.map((d) => d.unitPrice), 0.25),
    comfortQ3: quantileOf(VISIBLE_POP.map((d) => d.comfortDayCount).filter((v) => v != null), 0.75),
  };
  function worthChecklist(d) {
    if (d.comfortDayCount == null || WORTH_THRESH.unitQ1 == null) return null;
    return [
      [d.unitPrice <= WORTH_THRESH.unitQ1, t('wcPrice', { v: fmtInt(WORTH_THRESH.unitQ1) })],
      [d.comfortDayCount >= WORTH_THRESH.comfortQ3, t('wcComfort', { v: WORTH_THRESH.comfortQ3 })],
      [!(d.hazard && d.hazard.hazards && d.hazard.hazards.some((h) => h.freq >= 5)), t('wcHazard')],
      [d.transitKm != null && d.transitKm <= 20, t('wcRail')],
    ];
  }
  function worthBadge(d) {
    const checks = worthChecklist(d);
    if (!checks || !checks.every((c) => c[0])) return '';
    const tip = checks.map((c) => '✓ ' + c[1]).join('\n');
    return `<span class="inline-block rounded px-1.5 py-0.5 text-[0.65rem] font-semibold whitespace-nowrap" style="background:#dc2626;color:#fff" title="${tip.replace(/"/g, '&quot;')}">${t('worthBadge')}</span>`;
  }

  // ---- one-line climate summary (modal hard-facts + share card) -----------
  function climateSummary(d) {
    const bits = [];
    if (d.climateType) bits.push(trCl(d.climateType));
    if (d.comfortDayCount != null) bits.push(t('csComfort', { n: d.comfortDayCount }));
    const cr = comfortRangeOf(d);
    if (cr && cr !== t('monthNone') && cr !== t('monthAll')) bits.push(t('csBest', { r: cr }));
    if (d.extremeDayCount != null) bits.push(d.extremeDayCount ? t('csExtreme', { n: d.extremeDayCount }) : t('csNoExtreme'));
    return bits.join(' · ');
  }

  // ---- money metrics over existing data ------------------------------------
  // 70-year land-use estimate anchored on built year (出让时间通常更早 — labeled 估算).
  function leaseLeftOf(d) {
    if (d.builtYear == null) return null;
    return Math.max(0, d.builtYear + 70 - NOW_YEAR);
  }
  // unit-price standing within the ±7-year built cohort of visible listings.
  function cohortCheaperPct(d) {
    if (d.builtYear == null) return null;
    const cohort = VISIBLE_POP.filter((x) => x.builtYear != null && Math.abs(x.builtYear - d.builtYear) <= 7);
    if (cohort.length < 8) return null;
    const cheaper = cohort.filter((x) => x.unitPrice > d.unitPrice).length;
    return Math.round((cheaper / cohort.length) * 100);
  }

  // ---- 找城测验: weighted match scoring over baked dims --------------------
  // Hard gates (budget / heating / altitude) filter; soft dims score 0-1 and
  // combine as Σwᵢsᵢ/Σwᵢ×100. Weights are FIXED and published in #qz-formula.
  // Population is always the default-visible set — hidden benchmark rows never
  // surface here regardless of the footer tier toggle.
  const qz = { budget: 0, winter: 1, summer: 1, hazard: 1, heat: false, coast: false, alt: false, rail: false, hsr: false, airport: false, hospital: false, avoidLulu: false };
  const QZ_DIM_META = {
    price: { labelKey: 'qdPrice', color: '#059669' },
    climate: { labelKey: 'qdClimate', color: '#6366f1' },
    winter: { labelKey: 'qdWinter', color: '#f59e0b' },
    summer: { labelKey: 'qdSummer', color: '#0ea5e9' },
    hazard: { labelKey: 'qdHazard', color: '#94a3b8' },
    coast: { labelKey: 'qdCoast', color: '#14b8a6' },
    rail: { labelKey: 'qdRail', color: '#a855f7' },
    hsr: { labelKey: 'qdHsr', color: '#7c3aed' },
    airport: { labelKey: 'qdAirport', color: '#10b981' },
    hospital: { labelKey: 'qdHospital', color: '#dc2626' },
    avoidLulu: { labelKey: 'qdAvoidLulu', color: '#b91c1c' },
  };
  const QZ_PRICE_RANGE = (() => {
    const xs = VISIBLE_POP.map((d) => d.unitPrice);
    return { min: Math.min(...xs), max: Math.max(...xs) };
  })();
  const QZ_MAX_BURDEN = Math.max(1, ...VISIBLE_POP.map((d) => d.hazardBurden || 0));
  // LULU avoidance sub-score (越远越好): mean per-category farness, each a
  // 1−e^(−km/scale) curve so being NEAR any unwanted facility drags the score
  // down and being comfortably far from ALL of them approaches 1. Scales (km
  // e-fold) reflect each class's nuisance radius.
  const LULU_FAR_SCALE = { wastewater: 4, landfill: 5, incinerator: 6, nuclear: 30, substation: 2, chemical: 6, sensitive: 8 };
  function luluFarness(d) {
    const f = { wastewater: d.wastewaterKm, landfill: d.landfillKm, incinerator: d.incineratorKm, nuclear: d.nuclearKm, substation: d.substationKm, chemical: d.chemicalKm, sensitive: d.sensitiveKm };
    const xs = Object.keys(f).filter((k) => f[k] != null).map((k) => 1 - Math.exp(-f[k] / LULU_FAR_SCALE[k]));
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0.5;
  }
  function quizScore(d) {
    if (qz.budget && d.priceYuan / 10000 > qz.budget) return null;
    if (qz.alt && !(d.elevation != null && d.elevation <= 1500)) return null;
    if (qz.heat && !(d.heating === '集中供暖' || d.heating === '部分供暖')) return null;
    const parts = [];   // [dimKey, weight, subscore 0-1]
    parts.push(['price', 2, clamp((QZ_PRICE_RANGE.max - d.unitPrice) / (QZ_PRICE_RANGE.max - QZ_PRICE_RANGE.min || 1), 0, 1)]);
    parts.push(['climate', 2, d.comfortDayCount != null ? d.comfortDayCount / 365 : 0]);
    if (qz.winter) parts.push(['winter', 1.5 * qz.winter, d.janTemp != null ? clamp((d.janTemp + 10) / 28, 0, 1) : 0]);
    if (qz.summer) parts.push(['summer', 1.5 * qz.summer, d.julTemp != null ? clamp((30 - d.julTemp) / 10, 0, 1) : 0]);
    if (qz.hazard) parts.push(['hazard', 1 * qz.hazard, d.hazardBurden != null ? 1 - d.hazardBurden / QZ_MAX_BURDEN : 0.5]);
    if (qz.coast) parts.push(['coast', 2, d.coastKm != null ? Math.exp(-d.coastKm / 40) : 0]);
    if (qz.rail) parts.push(['rail', 1.5, d.transitKm != null ? Math.exp(-d.transitKm / 15) : 0]);
    if (qz.hsr) parts.push(['hsr', 1.5, d.hsrKm != null ? Math.exp(-d.hsrKm / 15) : 0]);
    if (qz.airport) parts.push(['airport', 1.5, d.airportKm != null ? Math.exp(-d.airportKm / 15) : 0]);
    if (qz.hospital) parts.push(['hospital', 1.5, d.hospitalKm != null ? Math.exp(-d.hospitalKm / 15) : 0]);
    if (qz.avoidLulu) parts.push(['avoidLulu', 1.5, luluFarness(d)]);
    const wSum = parts.reduce((s, p) => s + p[1], 0);
    const vSum = parts.reduce((s, p) => s + p[1] * p[2], 0);
    return { score: (vSum / (wSum || 1)) * 100, parts, vSum };
  }
  function quizHash() {
    try {
      if (!(window.history && window.history.replaceState)) return;
      const enc = [qz.budget, qz.winter, qz.summer, qz.hazard, +qz.heat, +qz.coast, +qz.alt, +qz.rail, +qz.hsr, +qz.airport, +qz.hospital, +qz.avoidLulu].join(',');
      window.history.replaceState(null, '', '#q=' + enc);
    } catch (e) { /* sandbox */ }
  }
  function quizFromHash() {
    try {
      const m = (window.location && window.location.hash || '').match(/^#q=([\d.,]+)$/);
      if (!m) return;
      const v = m[1].split(',').map(Number);
      if (v.length !== 8 && v.length !== 9 && v.length !== 11 && v.length !== 12) return;
      if (v.some((x) => !isFinite(x))) return;
      qz.budget = v[0]; qz.winter = clamp(v[1], 0, 2); qz.summer = clamp(v[2], 0, 2); qz.hazard = clamp(v[3], 0, 2);
      qz.heat = !!v[4]; qz.coast = !!v[5]; qz.alt = !!v[6]; qz.rail = !!v[7];
      qz.hsr = v.length >= 9 ? !!v[8] : false;
      qz.airport = v.length >= 11 ? !!v[9] : false;
      qz.hospital = v.length >= 11 ? !!v[10] : false;
      qz.avoidLulu = v.length >= 12 ? !!v[11] : false;
    } catch (e) { /* sandbox */ }
  }
  function styleQzChips() {
    const dk = isDark();
    document.querySelectorAll('[data-qz]').forEach((b) => {
      const k = b.dataset.qz;
      b.textContent = t({ heat: 'qzHeat', coast: 'qzCoast', alt: 'qzAlt', rail: 'qzRail', hsr: 'qzHsr', airport: 'qzAirport', hospital: 'qzHospital', avoidLulu: 'qzAvoidLulu' }[k]);
      const on = !!qz[k];
      b.className = 'px-3 py-1.5 rounded-md text-xs font-medium transition-colors ' +
        (on
          ? 'bg-indigo-600 text-white'
          : (dk ? 'bg-slate-800 text-slate-400 border border-slate-600 hover:text-slate-100' : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-900'));
    });
  }
  function fillQuizSelects() {
    const fill = (id, opts, cur) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = opts.map(([v, label]) => `<option value="${v}">${label}</option>`).join('');
      sel.value = String(cur);
    };
    const bLabel = (v) => (isEn() ? `≤¥${v * 10}k` : `≤${v}万`);
    fill('qz-budget', [[0, t('qzBudgetAny')]].concat([5, 10, 15, 20].map((v) => [v, bLabel(v)])), qz.budget);
    const deg = (k0, k1, k2) => [[0, t(k0)], [1, t(k1)], [2, t(k2)]];
    fill('qz-winter', deg('qzDegNo', 'qzDegSome', 'qzDegVery'), qz.winter);
    fill('qz-summer', deg('qzDegNo', 'qzDegSome', 'qzDegVery'), qz.summer);
    fill('qz-hazard', deg('qzHzNo', 'qzHzMid', 'qzHzHigh'), qz.hazard);
  }
  function renderQuizRent(top1) {
    const out = document.getElementById('qz-rent-out');
    const inp = document.getElementById('qz-rent');
    if (!out || !inp) return;
    const rent = parseFloat(inp.value);
    if (!rent || rent <= 0) { out.textContent = t('qzRentHint'); return; }
    const med = median(VISIBLE_POP.map((d) => d.unitPrice));
    const yr = rent * 12;
    const sqmMed = yr / med;
    if (top1) {
      out.textContent = t('qzRentOut', { y: fmtInt(yr), a: sqmMed.toFixed(1), c: cityLabel(top1), b: (yr / top1.unitPrice).toFixed(1) });
    } else {
      out.textContent = t('qzRentOutNoTop', { y: fmtInt(yr), a: sqmMed.toFixed(1) });
    }
  }
  function renderQuiz() {
    const host = document.getElementById('qz-result');
    if (!host) return;
    fillQuizSelects(); styleQzChips();
    const scored = VISIBLE_POP.map((d) => ({ d, r: quizScore(d) })).filter((x) => x.r);
    scored.sort((a, b) => b.r.score - a.r.score);
    const top = scored.slice(0, 10);
    const tc = tcx();
    if (!top.length) {
      host.innerHTML = `<div class="text-sm ${tc.muted} py-2">${t('qzEmpty')}</div>`;
    } else {
      // name column capped at 42% so the 1fr contribution bar survives 375px
      const GT = 'grid-template-columns: 1.4rem minmax(5rem, 42%) 1fr 2.6rem';
      const rows = top.map(({ d, r }, i) => {
        const segs = r.parts.filter((p) => p[2] > 0).map(([k, w, s]) =>
          `<div class="h-full" style="width:${(w * s / (r.vSum || 1)) * 100}%;background:${QZ_DIM_META[k].color}" title="${t(QZ_DIM_META[k].labelKey)}"></div>`).join('');
        return `<div class="grid items-center gap-2 py-1 rounded cursor-pointer ${isDark() ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}" data-open="${d.id}" role="button" tabindex="0" style="${GT}">`
          + `<div class="text-xs tabular-nums ${tc.muted}">${i + 1}</div>`
          + `<div class="text-xs truncate ${tc.body}" title="${cityLabel(d)}">${cityLabel(d)}</div>`
          + `<div class="flex h-3 rounded-sm overflow-hidden" style="background:${isDark() ? '#334155' : '#f1f5f9'}">${segs}</div>`
          + `<div class="text-right text-xs tabular-nums font-medium ${tc.strong}">${Math.round(r.score)}</div>`
          + '</div>';
      }).join('');
      const legend = Object.keys(QZ_DIM_META)
        .filter((k) => top.some(({ r }) => r.parts.some((p) => p[0] === k)))
        .map((k) => `<span class="inline-flex items-center gap-1 whitespace-nowrap"><span class="inline-block w-2 h-2 rounded-sm" style="background:${QZ_DIM_META[k].color}"></span>${t(QZ_DIM_META[k].labelKey)}</span>`)
        .join(' ');
      host.innerHTML = rows + `<div class="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[0.65rem] ${tc.muted}">${legend} <span>· ${t('qzMatchCount', { n: scored.length })}</span></div>`;
    }
    renderQuizRent(top.length ? top[0].d : null);
    const formula = document.getElementById('qz-formula');
    if (formula) formula.innerHTML = t('qzFormula');
  }
  function wireQuiz() {
    quizFromHash();
    [['qz-budget', 'budget'], ['qz-winter', 'winter'], ['qz-summer', 'summer'], ['qz-hazard', 'hazard']].forEach(([id, key]) => {
      const sel = document.getElementById(id);
      if (sel) sel.addEventListener('change', () => { qz[key] = +sel.value || 0; quizHash(); renderQuiz(); saveUiPrefs(); });
    });
    document.querySelectorAll('[data-qz]').forEach((b) => b.addEventListener('click', () => {
      qz[b.dataset.qz] = !qz[b.dataset.qz];
      quizHash(); styleQzChips(); renderQuiz(); saveUiPrefs();
    }));
    const rent = document.getElementById('qz-rent');
    if (rent) {
      try { const saved = localStorage.getItem('housing-rent'); if (saved) rent.value = saved; } catch (e) {}
      rent.addEventListener('input', () => {
        try { localStorage.setItem('housing-rent', rent.value); } catch (e) {}
        renderQuiz();
      });
    }
    const host = document.getElementById('qz-result');
    if (host) host.addEventListener('click', (e) => {
      const row = e.target.closest('[data-open]');
      if (row) openListing(+row.dataset.open);
    });
  }

  // ---- KPI cards ---------------------------------------------------------
  function renderKPIs() {
    const vd = viewData();
    const provinces = new Set(vd.map((d) => d.prov));
    const cheapest = vd.reduce((a, b) => (b.priceYuan < a.priceYuan ? b : a));
    const climD = vd.filter((d) => d.tempRange != null);
    const steadiest = climD.reduce((a, b) => (b.tempRange < a.tempRange ? b : a), climD[0]);
    const comfortScore = (d) => (d.comfortDayCount != null ? d.comfortDayCount
      : (d.comfortMonths != null ? Math.round(d.comfortMonths * 30.4) : null));
    const comfortD = vd.filter((d) => comfortScore(d) != null);
    const mostComfort = comfortD.reduce((a, b) => (comfortScore(b) > comfortScore(a) ? b : a), comfortD[0]);
    const medUnit = median(vd.map((d) => d.unitPrice));
    const cards = [
      { label: t('kpiListings'), value: vd.length, unit: t('kpiUnit'), sub: t('kpiListingsSub') },
      { label: t('kpiProvinces'), value: provinces.size, unit: t('kpiProvUnit'), sub: t('kpiProvincesSub') },
      { label: t('kpiCheapest'), value: fmtWanD(cheapest), sub: cityLabel(cheapest) },
      { label: t('kpiMedianUnit'), value: isEn() ? fmtUnit(medUnit) : fmtInt(medUnit), unit: isEn() ? '' : '元/㎡', sub: t('kpiMedianUnitSub') },
      { label: t('kpiSteady'), value: steadiest ? fmtSwing(steadiest.tempRange) : '—', unit: '', sub: steadiest ? `${cityLabel(steadiest)} · ${trCl(steadiest.climateType) || ''}` : '—' },
      { label: t('kpiComfortMax'), value: mostComfort ? comfortScore(mostComfort) + t('daySuffix') : '—', sub: mostComfort ? `${cityLabel(mostComfort)} · ${t('kpiComfortMaxSub')}` : '—' },
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

  // ---- overview scatter: 总价(便宜) × 舒适天数, coloured by 年温差(季节波动) ----
  function renderScatter() {
    const ctx = document.getElementById('scatter-chart');
    if (!ctx || !window.Chart) return;
    if (scatterChart) { scatterChart.destroy(); scatterChart = null; }
    const cdays = (d) => d.comfortDayCount != null ? d.comfortDayCount
      : (d.comfortMonths != null ? Math.round(d.comfortMonths * 30.4) : null);
    const pts = viewData().filter((d) => cdays(d) != null && d.tempRange != null)
      .map((d) => ({ x: priceX(d.priceYuan / 10000), y: cdays(d), d }));
    const rMax = Math.max(1, ...pts.map((p) => p.d.tempRange));
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
        onHover: (ev, els) => { if (ev.native?.target) ev.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
        onClick: (_ev, els) => {
          if (!els.length || !scatterChart) return;
          const pt = scatterChart.data.datasets[els[0].datasetIndex].data[els[0].index];
          if (pt?.d?.enr) openListing(pt.d.id);
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (it) => cityLabel(it[0].raw.d),
              label: (it) => {
                const d = it.raw.d;
                return [
                  `${isEn() ? 'Total' : '总价'} ${fmtWanD(d)} · ${fmtArea(d.area)} · ${isEn() ? 'Unit' : '单价'} ${fmtUnit(d.unitPrice)}`,
                  `${trCl(d.climateType) || '—'} · ${t('swingLabel')} ${fmtSwing(d.tempRange)} · ${t('comfortLabel')} ${comfortRangeOf(d)} · ${t('extremeLabel')} ${extremeRangeOf(d)}`,
                  `${isEn() ? 'Jan' : '1月'} ${fmtTemp(d.janTemp)} · ${isEn() ? 'Jul' : '7月'} ${fmtTemp(d.julTemp)} · ${isEn() ? 'Elev' : '海拔'} ${fmtElev(d.elevation)}`,
                ];
              },
              afterBody: () => (isEn() ? 'Click to open details' : '点击打开详情'),
            },
          },
        },
        scales: {
          x: { min: 0, suggestedMax: pMax, title: { display: true, text: t('scatterX') }, grid: { color: themeGrid() },
            ticks: { callback: (v) => isEn() ? '$' + Math.round(v).toLocaleString('en-US') : v + '万' } },
          y: { title: { display: true, text: t('scatterY') }, grid: { color: themeGrid() }, min: 0, max: 365 },
        },
      },
    });
  }

  // ---- ranking bars (switchable metric) ----------------------------------
  const RANK_METRICS = {
    cheap: { labelKey: 'rankCheap', key: 'priceCnyWan', dir: 1, axisKey: 'rankAxisCheap', fmt: (v) => (I18N().formatCnyYuan ? I18N().formatCnyYuan(v * 10000) : fmtWan(v)), color: (v, n) => badColor(v / n) },
    unit: { labelKey: 'rankUnit', key: 'unitPrice', dir: 1, axisKey: 'rankAxisUnit', fmt: (v) => fmtUnit(v), color: (v, n) => badColor(v / n) },
    comfort: { labelKey: 'rankComfort', key: 'comfortDayCount', dir: -1, axisKey: 'rankAxisComfort', fmt: (v) => v + t('daySuffix'), color: (v, n) => comfortColor(v / (n || 1)) },
    extreme: { labelKey: 'rankExtreme', key: 'extremeDayCount', dir: -1, axisKey: 'rankAxisExtreme', fmt: (v) => v + t('daySuffix'), color: (v, n) => comfortColor(1 - v / (n || 1)) },
    yield: { labelKey: 'rankYield', key: 'yieldPct', dir: -1, axisKey: 'rankAxisYield', fmt: fmtPct, color: (v, n) => lerpColor(v / n) },
    seasonNow: { labelKey: 'rankSeason', key: 'monthComfortDays', dir: -1, axisKey: 'rankAxisSeason', fmt: (v) => v + t('daySuffix'), color: (v, n) => comfortColor(v / (n || 1)) },
    burden: { labelKey: 'rankBurden', key: 'hazardBurden', dir: 1, axisKey: 'rankAxisBurden', fmt: (v) => String(v), color: (v, n) => comfortColor(1 - v / (n || 1)) },
  };
  const rankMetric = (k) => {
    const m = RANK_METRICS[k] || RANK_METRICS.comfort;
    return { ...m, label: t(m.labelKey), axis: t(m.axisKey) };
  };
  let rankKey = 'comfort';

  function updateRankClimateNote() {
    const el = document.getElementById('rank-climate-note');
    if (!el) return;
    if (rankKey === 'comfort') {
      el.innerHTML = t('rankNoteComfort');
      el.classList.remove('hidden');
    } else if (rankKey === 'extreme') {
      el.innerHTML = t('rankNoteExtreme');
      el.classList.remove('hidden');
    } else if (rankKey === 'seasonNow') {
      el.innerHTML = t('rankNoteSeason', { m: NOW_MONTH });
      el.classList.remove('hidden');
    } else if (rankKey === 'burden') {
      el.innerHTML = t('rankNoteBurden');
      el.classList.remove('hidden');
    } else {
      el.innerHTML = '';
      el.classList.add('hidden');
    }
  }

  // Top-50 ranking as a scrollable HTML list. Climate metrics (comfort / mild)
  // render a 365-day mini strip; price/yield metrics render a CSS magnitude bar.
  function renderRankings() {
    const ctx = document.getElementById('rank-chart');
    if (!ctx) return;
    const m = rankMetric(rankKey);
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
    const pool = viewData().filter((d) => isStrip ? (d.daily && d[m.key] != null) : d[m.key] != null);
    const top = [...pool].sort((a, b) => (a[m.key] - b[m.key]) * m.dir).slice(0, 50);
    const maxV = Math.max(...top.map((d) => d[m.key] || 0), 1);
    const GT = 'grid-template-columns: 1.6rem minmax(4.5rem, 9rem) 1fr 3.6rem';
    const colHdr = isStrip ? (isC ? t('rankStripComfort') : t('rankStripExtreme')) : m.axis.replace(/（.*/, '').replace(/ \(.*\)/, '');
    const hBg = isDark() ? '#1e293b' : '#ffffff';
    const headMuted = isDark() ? '#94a3b8' : '#94a3b8';
    const head = `<div class="grid items-center gap-2 text-[0.6rem] sticky top-0 z-10 pb-1" style="${GT};background:${hBg};color:${headMuted}"><div>#</div><div>${t('rankColCommunity')}</div><div>${colHdr}</div><div class="text-right">${isStrip ? (isC ? t('rankColComfort') : t('rankColExtreme')) : ''}</div></div>`;
    const body = top.map((d, i) => {
      let vis, val;
      if (isStrip) {
        vis = miniDayStrip(isC ? d.daily.comfortDays : d.daily.extremeDays, isC ? '#059669' : '#dc2626',
          (isC ? t('comfortLabel') + ' ' : t('extremeLabel') + ' ') + ((isC ? comfortRangeOf(d) : extremeRangeOf(d)) || t('monthNone')), '100%');
        val = isC ? d.comfortDayCount + t('daySuffix') : (d.extremeDayCount === 0 ? t('monthNone') : d.extremeDayCount + t('daySuffix'));
      } else {
        vis = `<div class="h-3.5 rounded-sm" style="width:${Math.max(2, (d[m.key] / maxV) * 100)}%;background:${m.color(d[m.key], maxV)}"></div>`;
        val = m.fmt(d[m.key]);
      }
      const rowText = isDark() ? '#94a3b8' : '#374151';
      const valText = isDark() ? '#64748b' : '#6b7280';
      const open = d.enr ? ` data-open="${d.id}" role="button" tabindex="0"` : '';
      const hover = d.enr ? (isDark() ? ' hover:bg-slate-700/50' : ' hover:bg-slate-50') : '';
      const cur = d.enr ? ' cursor-pointer' : '';
      return `<div class="grid items-center gap-2 py-0.5 rounded${cur}${hover}"${open} style="${GT}"><div class="text-xs tabular-nums" style="color:${valText}">${i + 1}</div>`
        + `<div class="text-xs truncate" style="color:${rowText}" title="${cityLabel(d)}">${cityLabel(d)}</div>`
        + `<div>${vis}</div>`
        + `<div class="text-right text-xs tabular-nums" style="color:${valText}">${val}</div></div>`;
    }).join('');
    host.innerHTML = head + body;
    document.querySelectorAll('[data-rank]').forEach((b) => {
      const rm = rankMetric(b.dataset.rank);
      if (!rm) return;
      b.textContent = rm.label;
      styleTab(b, b.dataset.rank === rankKey, 'rank-tab');
    });
    updateRankClimateNote();
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
      const cmUnion = [...new Set(rows.flatMap((r) => r.comfortSet || []))].sort((a, b) => a - b);
      const comfortByDay = new Array(365).fill(0);
      let anyComfortDaily = false;
      rows.forEach((r) => {
        const dd = r.daily; if (!dd || !dd.comfortDays) return; anyComfortDaily = true;
        dd.comfortDays.forEach(([s, e]) => {
          if (s <= e) { for (let i = s; i <= e; i++) comfortByDay[i - 1] += 1; }
          else { for (let i = s; i <= 365; i++) comfortByDay[i - 1] += 1; for (let i = 1; i <= e; i++) comfortByDay[i - 1] += 1; }
        });
      });
      const comfortRange = anyComfortDaily ? flagsToDayRange(comfortByDay.map((c) => c > 0)) : monthRanges(cmUnion);
      return {
        prov, count: rows.length,
        avgRange: avg('tempRange'),
        avgComfort: avg('comfortDayCount'),
        avgElev: avg('elevation'),
        avgPrecip: avg('annualPrecip'),
        avgHospital: avg('hospitalKm'),
        avgHazard: avg('hazardBurden'),
        avgExtreme: avg('extremeMonths'), avgExtremeDays: avg('extremeDayCount'),
        extremeRange, extremeByMonth, extremeByDay,
        comfortRange, comfortByDay,
      };
    });
  }

  const PROV_METRICS = {
    avgRange: { labelKey: 'provAvgRange', axisKey: 'provAxisAvgRange', fmt: fmtSwing, dir: -1, color: 'rgba(67,56,202,0.5)' },
    avgExtreme: { labelKey: 'provAvgExtreme', axisKey: 'provAxisAvgExtreme', fmt: (v) => Math.round(v) + t('daySuffix'), dir: -1, color: 'rgba(185,28,28,0.5)' },
    avgComfort: { labelKey: 'provAvgComfort', axisKey: 'provAxisAvgComfort', fmt: (v) => Math.round(v) + t('daySuffix'), dir: 1, color: 'rgba(5,150,105,0.55)' },
    avgElev: { labelKey: 'provAvgElev', axisKey: 'provAxisAvgElev', fmt: fmtElev, dir: 1, color: 'rgba(120,113,108,0.55)' },
    avgPrecip: { labelKey: 'provAvgPrecip', axisKey: 'provAxisAvgPrecip', fmt: fmtPrecip, dir: 1, color: 'rgba(59,130,246,0.5)' },
    avgHazard: { labelKey: 'provAvgHazard', axisKey: 'provAxisAvgHazard', fmt: (v) => (v == null ? '—' : v.toFixed(1)), dir: -1, color: 'rgba(217,119,6,0.55)' },
  };
  const provMetricCfg = (k) => {
    const m = PROV_METRICS[k] || PROV_METRICS.avgRange;
    return { ...m, label: t(m.labelKey), axis: t(m.axisKey) };
  };
  let provMetric = 'avgRange';

  function provChartWrap() {
    const wrap = document.getElementById('province-chart-wrap');
    if (wrap) return wrap;
    const canvas = document.getElementById('province-chart');
    return canvas && canvas.parentElement;
  }
  const PROV_ROW_H = { zh: 26, en: 28 };
  const PROV_CHART_PAD = 68;
  const PROV_CHART_MIN_H = 280;
  function provChartHeight(n) {
    const rowH = isEn() ? PROV_ROW_H.en : PROV_ROW_H.zh;
    const maxH = Math.min(900, Math.max(520, (window.innerHeight || 800) * 0.82));
    return Math.max(PROV_CHART_MIN_H, Math.min(n * rowH + PROV_CHART_PAD, maxH));
  }
  function provLabelCol() { return isEn() ? '8.5rem' : '3.25rem'; }
  function provStripSummaryCol() { return isEn() ? '4.25rem' : '3rem'; }
  function provStripGridCols() { return `${provLabelCol()} 1fr ${provStripSummaryCol()}`; }
  function applyProvChartHeight(n) {
    const wrap = provChartWrap();
    if (!wrap) return;
    wrap.style.height = provChartHeight(n) + 'px';
    wrap.style.overflowY = '';
  }

  // avgExtreme / avgComfort: 365-day strip per province (vertical ticks = month boundaries).
  // Color spans = days when some listing is extreme (red) or comfortable (green); depth = share.
  function renderProvinceStrip() {
    const canvas = document.getElementById('province-chart');
    if (!canvas) return;
    const isComfort = provMetric === 'avgComfort';
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
    const agg = aggregateByProvince()
      .sort((a, b) => (isComfort
        ? (b.avgComfort ?? 0) - (a.avgComfort ?? 0)
        : (b.avgExtremeDays ?? b.avgExtreme ?? 0) - (a.avgExtremeDays ?? a.avgExtreme ?? 0))
        || a.prov.localeCompare(b.prov, 'zh'));
    applyProvChartHeight(agg.length);
    const GT = `grid-template-columns: ${provStripGridCols()}`;
    const mCfg = provMetricCfg(provMetric);
    const summaryKey = isComfort ? 'provStripColComfort' : 'provStripColExtreme';
    const summaryDays = (a) => {
      const v = isComfort ? a.avgComfort : (a.avgExtremeDays ?? a.avgExtreme);
      return v != null ? mCfg.fmt(v) : '—';
    };
    // month boundaries (%) + centres on a 365-day axis
    const bnd = []; let acc = 0; for (let i = 0; i < 12; i++) { acc += _DIM[i]; bnd.push(acc / 365 * 100); }
    const ctr = []; let p0 = 0; for (let i = 0; i < 12; i++) { ctr.push((p0 + bnd[i]) / 2); p0 = bnd[i]; }
    const gridLine = isDark() ? 'rgba(148,163,184,0.22)' : 'rgba(100,116,139,0.16)';
    const gridImg = 'background-image:' + bnd.slice(0, 11).map((p) =>
      `linear-gradient(90deg, transparent calc(${p}% - 0.5px), ${gridLine} ${p}%, transparent calc(${p}% + 0.5px))`).join(',');
    const sBg = isDark() ? '#1e293b' : '#ffffff';
    const head = `<div class="grid items-center gap-px text-[0.6rem] sticky top-0 z-10 pb-1" style="${GT};background:${sBg};color:${themeMuted()}"><div></div>`
      + `<div class="relative h-3">${ctr.map((c, i) => `<span style="position:absolute;left:${c}%;transform:translateX(-50%)">${i + 1}</span>`).join('')}</div>`
      + `<div class="text-right pr-0.5 whitespace-nowrap">${t(summaryKey)}</div></div>`;
    const spanColor = isComfort ? comfortColor : severityColor;
    const listingsKey = isComfort ? 'provComfortListings' : 'provExtremeListings';
    const titleKey = isComfort ? 'provComfortTitle' : 'provExtremeTitle';
    const rangeKey = isComfort ? 'comfortRange' : 'extremeRange';
    const dayKey = isComfort ? 'comfortByDay' : 'extremeByDay';
    const blocksFor = (a) => {
      const f = a[dayKey] || []; const out = []; let s = -1;
      for (let i = 0; i < 365; i++) {
        const on = f[i] > 0;
        if (on && s < 0) s = i;
        if ((!on || i === 364) && s >= 0) {
          const e = on ? i : i - 1, maxc = Math.max(...f.slice(s, e + 1));
          out.push(`<div class="absolute top-0 bottom-0 rounded-sm" style="left:${s / 365 * 100}%;width:${(e - s + 1) / 365 * 100}%;background:${spanColor(0.4 + 0.6 * (maxc / a.count))}" title="${trProv(a.prov)} ${doyToDate(s + 1)}–${doyToDate(e + 1)}: ${maxc}/${a.count}${t(listingsKey)}"></div>`);
          s = -1;
        }
      }
      return out.join('');
    };
    const provColor = isDark() ? '#94a3b8' : '#475569';
    const stripBg = isDark() ? 'rgba(30,41,59,0.7)' : 'rgba(241,245,249,0.7)';
    const body = agg.map((a) => {
      const days = summaryDays(a);
      return `<div class="grid items-center gap-px py-px" style="${GT}"><div class="text-xs pr-1 whitespace-nowrap" style="color:${provColor}" title="${trProv(a.prov)} · ${t(titleKey)} ${a[rangeKey]} · ${t(summaryKey)} ${days}">${trProv(a.prov)}</div>`
        + `<div class="relative h-5 rounded-sm" style="${gridImg};background-color:${stripBg}">${blocksFor(a)}</div>`
        + `<div class="text-xs text-right tabular-nums whitespace-nowrap pr-0.5" style="color:${provColor}" title="${t(summaryKey)} ${days}">${days}</div></div>`;
    }).join('');
    strip.innerHTML = head + body
      + `<div class="text-[0.62rem] mt-2 leading-relaxed" style="color:${themeMuted()}">${t(isComfort ? 'provStripNoteComfort' : 'provStripNote')}</div>`;
  }

  function renderProvinceChart() {
    const ctx = document.getElementById('province-chart');
    if (!ctx || !window.Chart) return;
    const m = provMetricCfg(provMetric);
    if (!m) return;
    if (provMetric === 'avgExtreme' || provMetric === 'avgComfort') {
      renderProvinceStrip();
      document.querySelectorAll('[data-prov]').forEach((b) => {
        const pm = provMetricCfg(b.dataset.prov); if (!pm) return;
        b.textContent = pm.label; styleTab(b, b.dataset.prov === provMetric, 'prov-tab');
      });
      return;
    }
    ctx.style.display = '';
    const stripEl = document.getElementById('province-strip');
    if (stripEl) stripEl.style.display = 'none';
    const metricKey = provMetric;
    const agg = aggregateByProvince().filter((a) => a[metricKey] != null)
      .sort((a, b) => (b[metricKey] - a[metricKey]) * (m.dir > 0 ? 1 : -1));
    applyProvChartHeight(agg.length);
    const barH = Math.max(12, Math.min(22, Math.floor((provChartHeight(agg.length) - PROV_CHART_PAD) / Math.max(agg.length, 1) * 0.62)));
    const cfg = {
      type: 'bar',
      data: {
        labels: agg.map((a) => provMetric === 'avgExtreme' ? `${trProv(a.prov)} ${a.extremeRange}` : trProv(a.prov)),
        datasets: [{
          data: agg.map((a) => a[metricKey]),
          backgroundColor: m.color, borderColor: C.emerald, borderWidth: 1,
          borderRadius: 4, maxBarThickness: barH,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        layout: { padding: { left: 4, right: 12, top: 8, bottom: 8 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (it) => {
                const a = agg[it.dataIndex];
                const avgEx = a.avgExtremeDays ?? a.avgExtreme;
                const head = provMetric === 'avgExtreme'
                  ? `${t('provExtremeUnion')}: ${a.extremeRange} · ${avgEx != null ? avgEx.toFixed(1) : '—'}${t('provExtremePerListing')}`
                  : `${m.label} ${m.fmt(a[metricKey])}`;
                return [head,
                  `${t('provSample')} ${a.count}${isEn() ? '' : '套'} · ${t('provAvgComfort')} ${a.avgComfort != null ? Math.round(a.avgComfort) + t('daySuffix') : '—'}`,
                  `${t('provAvgSwing')} ${fmtSwing(a.avgRange)} · ${t('provAvgExtreme')} ${avgEx != null ? Math.round(avgEx) + t('daySuffix') : '—'} · ${t('provAvgHazard')} ${a.avgHazard != null ? a.avgHazard.toFixed(1) : '—'}`];
              },
            },
          },
        },
        scales: {
          x: { title: { display: true, text: m.axis }, grid: { color: themeGrid() },
            ticks: { callback: (v) => { const n = Number(v); return Number.isFinite(n) ? m.fmt(n) : v; } } },
          y: {
            grid: { display: false },
            ticks: { autoSkip: false, font: { size: 11 }, color: themeText(), padding: 6 },
          },
        },
      },
    };
    if (provChart) { provChart.destroy(); provChart = null; }
    provChart = new Chart(ctx, cfg);
    document.querySelectorAll('[data-prov]').forEach((b) => {
      const pm = provMetricCfg(b.dataset.prov);
      if (!pm) return;
      b.textContent = pm.label;
      styleTab(b, b.dataset.prov === provMetric, 'prov-tab');
    });
  }

  // ---- big zoomable overlay map (geo + recolourable listing points) ------
  // Hazard recurrence-interval buckets (FREQUENCY, not severity): 5=几乎年年 …
  // 1=百年级罕见. Neutral slate scale for map/table UI — commonness labels in i18n,
  // freqLabel/freqShort unchanged in data/tooltips/methodology.
  const FREQ_COLOR = { 1: '#e2e8f0', 2: '#cbd5e1', 3: '#94a3b8', 4: '#64748b', 5: '#475569' };
  // Sequential ramps, one per semantic family. VALUE = green only (no red);
  // SEVERITY = red; physical fields = their own conventional spectra.
  const RAMPS = {
    cheapGood: ['#065f46', '#059669', '#34d399', '#a7f3d0', '#cbd5e1'],   // 价值: 便宜/少 = 深绿 → 贵/多 = 中性灰
    temp: ['#2563eb', '#38bdf8', '#fde68a', '#fb923c', '#dc2626'],        // 温度: 冷蓝 → 热红
    precip: ['#eef2f7', '#bae6fd', '#38bdf8', '#0284c7', '#1e3a8a'],       // 降水: 干 → 湿
    terrain: ['#dcfce7', '#86efac', '#ca8a04', '#b45309', '#78350f'],     // 海拔: 低 → 高
    range: ['#ddd6fe', '#a78bfa', '#7c3aed', '#5b21b6', '#4c1d95'],       // 季节波动: 小 → 大（紫）
    freq: [FREQ_COLOR[1], FREQ_COLOR[2], FREQ_COLOR[3], FREQ_COLOR[4], FREQ_COLOR[5]],  // 灾害常见度: 极少淡灰 → 很常见深灰（固定 [1,5] 域）
    age: ['#059669', '#34d399', '#84cc16', '#fde047', '#f59e0b', '#b45309'], // 房龄: 新绿 → 老琥珀
  };
  // 地球物理突发灾害——随精确位置变化（地震带 / 海岸 / 地形），不像慢性气候灾
  // (暴雨/洪涝/干旱) 那样近乎处处年年。地图按这几类着色，才用得满 FREQ_COLOR 全色域、
  // 显出地理差异；表格 / 弹窗仍列全部灾害。
  const GEO_HAZ = new Set(['地震', '台风', '台风外围', '海岸增水', '地质灾害', '滑坡', '泥石流', '崩塌']);
  const MAP_DIMS = {
    tempRange: { labelKey: 'dimTempRange', get: (d) => d.tempRange, fmt: fmtSwing, ramp: 'range', textKeys: ['mapSwingLarge', 'mapSwingSteady'] },
    unitPrice: { labelKey: 'dimUnitPrice', get: (d) => d.unitPrice, fmt: (v) => fmtUnit(v), ramp: 'cheapGood', textKeys: ['mapExpensive', 'mapCheaper'] },
    priceWan: { labelKey: 'dimPriceWan', get: (d) => d.priceYuan / 10000, fmt: (v) => (I18N().formatCnyYuan ? I18N().formatCnyYuan(v * 10000) : fmtWan(v)), ramp: 'cheapGood', textKeys: ['mapExpensive', 'mapCheaper'] },
    janTemp: { labelKey: 'dimJanTemp', get: (d) => d.janTemp, fmt: fmtTemp, ramp: 'temp', textKeys: ['mapHot', 'mapCold'] },
    julTemp: { labelKey: 'dimJulTemp', get: (d) => d.julTemp, fmt: fmtTemp, ramp: 'temp', textKeys: ['mapHot', 'mapCold'] },
    annualPrecip: { labelKey: 'dimAnnualPrecip', get: (d) => d.annualPrecip, fmt: (v) => fmtPrecip(v), ramp: 'precip', textKeys: ['mapWet', 'mapDry'] },
    elevation: { labelKey: 'dimElevation', get: (d) => d.elevation, fmt: (v) => fmtElev(v), ramp: 'terrain', textKeys: ['mapHigh', 'mapLow'] },
    hazardFreq: {
      labelKey: 'dimHazardFreq',
      get: (d) => {
        if (!d.hazard || !d.hazard.hazards) return null;
        const gs = d.hazard.hazards.filter((h) => GEO_HAZ.has(h.type));
        return gs.length ? Math.max(...gs.map((h) => h.freq)) : 1;
      },
      fmt: (v) => trFc(Math.round(v)), ramp: 'freq', textKeys: ['mapFreqOften', 'mapFreqRare'], fixedDomain: [1, 5],
    },
    builtAge: {
      labelKey: 'dimBuiltAge',
      get: (d) => builtAgeOf(d),
      fmt: (v) => fmtBuiltAgeLabel(v),
      ramp: 'age',
      textKeys: ['mapAgeOld', 'mapAgeNew'],
    },
  };
  const mapDim = (k) => {
    const d = MAP_DIMS[k] || MAP_DIMS.tempRange;
    return { ...d, label: t(d.labelKey), text: (d.textKeys || []).map((tk) => t(tk)) };
  };
  let dimKey = 'unitPrice';
  let echartsMap = null, mapReady = false, baseGeoOpt = null;
  const GEO_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';

  // continuous basemap field — national 1° (field.js) + province-zoom 0.25° (field_hi_<key>.js
  // per active layer, lazy-loaded). Listing dots stay on top; finer cells fill gaps between communities.
  const FIELD_COARSE = window.HOUSING_FIELD || null;
  let FIELD_FINE = null;
  const fieldFineLayers = {};   // baseKey → true once field_hi_<key>.js merged
  const fieldFinePromises = {}; // baseKey → in-flight Promise
  const FIELD_LOD_ZOOM = 2.6;       // switch to 0.25° cells at/above this zoom
  const FIELD_PREFETCH_ZOOM = 2.2;  // start downloading fine layer before LOD switch
  const FIELD_BBOX_PAD = 1.2;       // degrees padding when viewport-filtering fine cells
  const FIELD_ROAM_SETTLE_MS = 220; // defer fine viewport refresh until pan/zoom settles
  let fieldLodRoamTimer = null;

  function fieldFineLayerUrl(key) {
    const tag = document.querySelector('script[src*="field.js"]');
    if (!tag) return `assets/data/field_hi_${key}.js`;
    return tag.getAttribute('src').replace(/field\.js(\?.*)?$/, `field_hi_${key}.js$1`);
  }

  function expandFieldLayer(f) {
    if (!f || f.q !== 1 || !f.pts) return f;
    const points = f.pts.split('|').filter(Boolean).map((row) => {
      const p = row.split(' ').map(Number);
      return [p[0], p[1], p[2]];
    });
    const { q, pts, ...rest } = f;
    return { ...rest, points };
  }

  function mergeFieldFine() {
    FIELD_FINE = window.HOUSING_FIELD_HI || FIELD_FINE;
    return FIELD_FINE;
  }

  function ensureFieldFine(layerKey) {
    const key = layerKey || baseKey;
    if (key === 'none') return Promise.resolve(null);
    if (fieldFineLayers[key]) return Promise.resolve(mergeFieldFine());
    if (window.HOUSING_FIELD_HI && window.HOUSING_FIELD_HI.fields && window.HOUSING_FIELD_HI.fields[key]) {
      fieldFineLayers[key] = true;
      return Promise.resolve(mergeFieldFine());
    }
    if (!fieldFinePromises[key]) {
      fieldFinePromises[key] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = fieldFineLayerUrl(key);
        s.async = true;
        s.onload = () => {
          fieldFineLayers[key] = true;
          resolve(mergeFieldFine());
        };
        s.onerror = () => reject(new Error(`field_hi_${key}.js load failed`));
        document.head.appendChild(s);
      });
    }
    return fieldFinePromises[key];
  }

  function prefetchFieldFineIfNeeded() {
    if (baseKey === 'none') return;
    const zoom = geoState().zoom;
    if (zoom >= FIELD_PREFETCH_ZOOM) ensureFieldFine(baseKey).catch(() => {});
  }

  function mapViewportBbox() {
    if (!echartsMap) return null;
    const dom = echartsMap.getDom();
    const w = dom.clientWidth || 1, h = dom.clientHeight || 1;
    try {
      const tl = echartsMap.convertFromPixel('geo', [0, 0]);
      const br = echartsMap.convertFromPixel('geo', [w, h]);
      if (!tl || !br) return null;
      const lng0 = Math.min(tl[0], br[0]) - FIELD_BBOX_PAD;
      const lng1 = Math.max(tl[0], br[0]) + FIELD_BBOX_PAD;
      const lat0 = Math.min(tl[1], br[1]) - FIELD_BBOX_PAD;
      const lat1 = Math.max(tl[1], br[1]) + FIELD_BBOX_PAD;
      return [lng0, lat0, lng1, lat1];
    } catch (e) { return null; }
  }

  function activeFieldPack() {
    const zoom = geoState().zoom;
    const useFine = zoom >= FIELD_LOD_ZOOM && baseKey !== 'none';
    const fineReady = baseKey !== 'none' && !!fieldFineLayers[baseKey];
    const field = useFine && fineReady ? FIELD_FINE : FIELD_COARSE;
    const step = (field && field.step) || 1;
    return { field, step, useFine, fineReady };
  }

  function filterCellsByViewport(cells) {
    const bbox = mapViewportBbox();
    if (!bbox) return cells;
    const [lng0, lat0, lng1, lat1] = bbox;
    return cells.filter((c) => c[0] >= lng0 && c[0] <= lng1 && c[1] >= lat0 && c[1] <= lat1);
  }

  function scheduleFieldLodRefresh() {
    prefetchFieldFineIfNeeded();
    if (fieldLodRoamTimer) clearTimeout(fieldLodRoamTimer);
    fieldLodRoamTimer = setTimeout(() => {
      fieldLodRoamTimer = null;
      const { useFine, fineReady } = activeFieldPack();
      if (useFine && !fineReady) {
        ensureFieldFine(baseKey).then(() => safeRun('renderMap', renderMap)).catch(() => {});
        return;
      }
      if (useFine || fineReady) safeRun('renderMap', renderMap);
    }, FIELD_ROAM_SETTLE_MS);
  }
  // Keys must stay temp/terrain/precip — assets/data/field.js references them.
  const BASE_RAMPS = { temp: RAMPS.temp, terrain: RAMPS.terrain, precip: RAMPS.precip };
  // available basemaps: 'none' + whatever the baked field provides
  const BASE_LABEL_KEYS = { none: 'baseNone', janTemp: 'baseJanTemp', julTemp: 'baseJulTemp', elevation: 'baseElevation', annualPrecip: 'baseAnnualPrecip' };
  const baseLabel = (k) => t(BASE_LABEL_KEYS[k] || k);
  let baseKey = 'janTemp';

  const hexRgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const rampColorAt = (ramp, t) => {
    const cs = RAMPS[ramp] || BASE_RAMPS[ramp] || BASE_RAMPS.temp;
    t = clamp(t, 0, 1) * (cs.length - 1);
    const i = Math.floor(t), f = t - i;
    if (i >= cs.length - 1) return cs[cs.length - 1];
    return mix(hexRgb(cs[i]), hexRgb(cs[i + 1]), f);
  };

  // cheaper homes render larger so affordable options pop (scale to visible set)
  function dotSizeOf(d) {
    const vals = viewGeocoded().map((x) => x.priceYuan / 10000);
    const pMin = Math.min(...vals), pMax = Math.max(...vals);
    return 8 + (1 - clamp((d.priceYuan / 10000 - pMin) / (pMax - pMin || 1), 0, 1)) * 12;
  }

  function mapFail(msg) {
    const wrap = document.getElementById('map-wrap');
    const fb = document.getElementById('map-fallback');
    if (wrap) wrap.style.display = 'none';
    if (fb) { fb.classList.remove('hidden'); fb.style.display = 'flex'; fb.textContent = msg; }
  }

  function mapSeriesData() {
    const dim = mapDim(dimKey);
    if (!dim) return [];
    return viewGeocoded().filter((d) => dim.get(d) != null).map((d) => {
      const v = dim.get(d);
      const pt = { value: [d.enr.lng, d.enr.lat, v], size: dotSizeOf(d), d };
      if (dimKey === 'builtAge' && v < 0) pt.itemStyle = { color: AGE_FUTURE };
      return pt;
    });
  }

  // basemap grid samples + isoline segments for the active field — RAW geometry
  // and values only; fill / line colours are assigned in renderMap so the field
  // can share the point dimension's domain when the two use the same ramp.
  function baseLayers() {
    const { field: FIELD, step, useFine, fineReady } = activeFieldPack();
    const raw = (baseKey !== 'none' && activeFieldPack().field && activeFieldPack().field.fields)
      ? activeFieldPack().field.fields[baseKey] : null;
    const f = expandFieldLayer(raw);
    if (!f) return { cells: [], lines: [], step: 1, vm: { min: 0, max: 1, ramp: 'temp' } };
    const lines = [];
    // isolines only on coarse national grid — fine grid is cell-only for clarity
    if (!useFine || !fineReady) {
      Object.keys(f.isolines || {}).forEach((lvl) => {
        const level = parseFloat(lvl);
        f.isolines[lvl].forEach((seg) => lines.push({ coords: seg, level }));
      });
    }
    let cells = f.points;
    if (useFine && fineReady && step <= 0.5) {
      cells = filterCellsByViewport(cells);
      // fill gaps outside viewport fine cells with coarse 1° cells
      const coarseF = FIELD_COARSE && FIELD_COARSE.fields && FIELD_COARSE.fields[baseKey];
      if (coarseF && coarseF.points) {
        const coarseInView = filterCellsByViewport(coarseF.points);
        const fineKeys = new Set(cells.map((c) => `${c[0].toFixed(2)},${c[1].toFixed(2)}`));
        coarseInView.forEach((c) => {
          const near = [...fineKeys].some((k) => {
            const [fl, fa] = k.split(',').map(Number);
            return Math.abs(fl - c[0]) < step * 0.6 && Math.abs(fa - c[1]) < step * 0.6;
          });
          if (!near) cells.push(c);
        });
      }
    }
    return { cells, lines, step: step || 1, vm: { min: f.min, max: f.max, ramp: f.ramp } };
  }

  function renderMap() {
    if (!mapReady || !echartsMap) return;
    const dim = mapDim(dimKey);
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
          const haz = top0 ? `${trHz(top0.type)} · ${trFc(top0.freq)}${top0.freqLabel ? ` (${trFl(top0.freqLabel)})` : ''}` : '';
          const ageLine = (dimKey === 'builtAge' && d.builtYear != null)
            ? `<br/>${t('builtYearTitle')} ${d.builtYearApprox ? t('builtApprox') : ''}${d.builtYear}`
            : '';
          return `<b>${cityLabel(d)}</b> · ${trGeo(d.enr.geoLabel) || ''}<br/>`
            + `<b style="color:#059669">${dim.label} ${dim.fmt(dim.get(d))}</b>${ageLine}<br/>`
            + `${isEn() ? 'Total' : '总价'} ${fmtWanD(d)} · ${fmtArea(d.area)} · ${isEn() ? 'Unit' : '单价'} ${fmtUnit(d.unitPrice)}<br/>`
            + `${trCl(d.climateType) || '—'} · ${t('swingLabel')} ${d.tempRange == null ? '—' : fmtSwing(d.tempRange)} · ${isEn() ? 'Jan' : '1月'} ${fmtTemp(d.janTemp)}/${isEn() ? 'Jul' : '7月'} ${fmtTemp(d.julTemp)} · ${isEn() ? 'Elev' : '海拔'} ${fmtElev(d.elevation)} · ${t('winterHeating')} ${trHeat(d.heating) || '—'}<br/>`
            + `${t('poiHospital')} ${fmtKm(d.hospitalKm)} · ${d.transitKind === 'metro' ? t('poiMetro') : t('poiTrain')} ${fmtKm(d.transitKm)} · ${t('col_seismic')} ${trSeis(d.seismic) || '—'} · ${t('col_typhoon')} ${trTy(d.typhoon) || '—'}`
            + (haz ? `<br/><span style="color:${themeMuted()}">${isEn() ? 'Top hazard: ' : '最频灾害：'}${haz}</span>` : '')
            + `<br/><span style="color:#10b981">${t('mapClickHint')}</span>`;
        },
      },
      visualMap,
    }, { replaceMerge: ['series', 'visualMap'] });
    renderBaseLegend();
  }

  function renderBaseLegend() {
    const box = document.getElementById('base-legend');
    if (!box) return;
    const f = expandFieldLayer((baseKey !== 'none' && activeFieldPack().field && activeFieldPack().field.fields)
      ? activeFieldPack().field.fields[baseKey] : null);
    const dimRamp = (MAP_DIMS[dimKey] || MAP_DIMS.tempRange).ramp;
    // Hide this 2nd legend when the field shares the point dimension's colour ramp
    // — the left visualMap is then the single unified scale for both layers
    // (sameRamp in renderMap). Two bars for one colour scale with mismatched
    // numbers is exactly the confusion we're removing.
    if (!f || (dimRamp && f.ramp === dimRamp)) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'flex';
    const grad = (BASE_RAMPS[f.ramp] || BASE_RAMPS.temp).join(',');
    box.innerHTML = `<span class="text-xs whitespace-nowrap" style="color:${themeBody()}">${trField(f.label)}${t('baseMapSuffix')}</span>`
      + `<span class="text-[11px] tabular-nums" style="color:${themeMuted()}">${I18N().formatFieldLegend ? I18N().formatFieldLegend(f.min, f.unit) : fmtInt(f.min) + f.unit}</span>`
      + `<span class="inline-block h-2.5 w-28 rounded" style="background:linear-gradient(90deg,${grad})"></span>`
      + `<span class="text-[11px] tabular-nums" style="color:${themeMuted()}">${I18N().formatFieldLegend ? I18N().formatFieldLegend(f.max, f.unit) : fmtInt(f.max) + f.unit}</span>`;
  }

  function baseTabs() {
    document.querySelectorAll('[data-base]').forEach((b) => {
      const k = b.dataset.base;
      const avail = k === 'none' || (FIELD_COARSE && FIELD_COARSE.fields && FIELD_COARSE.fields[k]);
      b.textContent = baseLabel(k);
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
      const dm = mapDim(b.dataset.dim);
      if (!MAP_DIMS[b.dataset.dim]) { b.style.display = 'none'; return; }
      b.style.display = '';
      b.textContent = dm.label;
      styleTab(b, b.dataset.dim === dimKey, 'dim-tab');
    });
    const note = document.getElementById('map-dim-note');
    if (note) {
      if (dimKey === 'hazardFreq') {
        note.textContent = t('mapHazardNote');
        note.classList.remove('hidden');
      } else {
        note.textContent = '';
        note.classList.add('hidden');
      }
    }
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
    scheduleFieldLodRefresh();
  }
  function zoomReset() {
    if (!echartsMap || !baseGeoOpt) return;
    echartsMap.setOption({ geo: [{ zoom: 1, center: baseGeoOpt.center }] });
    scheduleFieldLodRefresh();
  }

  async function initMap() {
    if (!window.echarts) { mapFail(t('mapFailEcharts')); return; }
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
      echartsMap.on('georoam', scheduleFieldLodRefresh);
      window.addEventListener('resize', () => echartsMap && echartsMap.resize());
    } catch (e) {
      console.error('[china-housing] initMap', e);
      mapFail(t('mapFailGeo'));
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
      exMaxT: Math.max(1, ...vd.map((d) => nz(d.extremeDayCount, nz(d.extremeMonths, 0)))),
      rangeMaxT: Math.max(1, ...vd.map((d) => nz(d.tempRange, 0))),
    };
  }
  // Min/max domains for table ramp cells (relative to the visible population).
  function viewTableScales() {
    const vd = viewData();
    const span = (key, fallback) => {
      const xs = vd.map((d) => d[key]).filter((v) => v != null && isFinite(v));
      if (!xs.length) return { min: 0, max: fallback };
      return { min: Math.min(...xs), max: Math.max(...xs) };
    };
    return {
      annualPrecip: span('annualPrecip', 2000),
      elevation: span('elevation', 5000),
      hospitalKm: span('hospitalKm', 80),
      transitKm: span('transitKm', 80),
      airportKm: span('airportKm', 150),
      coastKm: span('coastKm', 400),
      hsrKm: span('hsrKm', 80),
      // LULU avoidance: fallback max = "comfortably far" per category (km).
      wastewaterKm: span('wastewaterKm', 15), landfillKm: span('landfillKm', 15),
      incineratorKm: span('incineratorKm', 20), nuclearKm: span('nuclearKm', 120),
      substationKm: span('substationKm', 8), chemicalKm: span('chemicalKm', 20),
      sensitiveKm: span('sensitiveKm', 30),
    };
  }
  function tableFrac(val, { min, max }) {
    if (val == null || !isFinite(val)) return null;
    return clamp((val - min) / (max - min || 1), 0, 1);
  }
  function relativeLuminance(rgb) {
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  }
  function pillFgForBg(bg) {
    const s = String(bg);
    const rm = s.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    let rgb = rm ? [+rm[1], +rm[2], +rm[3]] : null;
    if (!rgb) {
      const hm = s.match(/^#([0-9a-f]{6})$/i);
      if (hm) rgb = [1, 3, 5].map((k) => parseInt(hm[1].slice(k - 1, k + 1), 16));
    }
    if (!rgb) return isDark() ? '#f8fafc' : '#0f172a';
    return relativeLuminance(rgb) > 0.45 ? '#0f172a' : '#f8fafc';
  }
  // Table-only physical ramps: reuse map RAMPS (temp / precip / terrain).
  const TABLE_RAMPS = {
    temp: RAMPS.temp,
    precip: RAMPS.precip,
    terrain: RAMPS.terrain,
  };
  function tableRampBg(rampKey, frac) {
    const cs = TABLE_RAMPS[rampKey];
    if (!cs) return rampColorAt(rampKey, frac);
    if (!isDark()) return rampColorAt(rampKey, frac);
    const dk = rampKey === 'precip'
      ? ['#1e3a5f', '#1e40af', '#2563eb', '#38bdf8', '#7dd3fc']
      : ['#14532d', '#166534', '#a16207', '#92400e', '#78350f'];
    const t = clamp(frac, 0, 1) * (dk.length - 1);
    const i = Math.floor(t), f = t - i;
    if (i >= dk.length - 1) return dk[dk.length - 1];
    return mix(hexRgb(dk[i]), hexRgb(dk[i + 1]), f);
  }
  // Distance columns: near = lighter gray, far = darker (WCAG text via pillFgForBg).
  function distKmBg(frac) {
    const lo = isDark() ? [71, 85, 105] : [248, 250, 252];
    const hi = isDark() ? [148, 163, 184] : [148, 163, 184];
    return mix(lo, hi, frac);
  }

  function pill(html, bg, fg, title) {
    const tip = title ? ` title="${String(title).replace(/"/g, '&quot;')}"` : '';
    return `<span class="inline-block rounded px-1.5 py-0.5 text-xs font-medium tabular-nums"${tip} style="background:${bg};color:${fg || '#0f172a'}">${html}</span>`;
  }
  // Table temp pill colours: fixed °C comfort/extreme bands (same anchors as comfort/extreme
  // day rules — extreme cold mean < -5°C, comfort 8–26°C, extreme heat high ≥ 33°C).
  // Five segments, NOT min–max linear over visible rows; English display is °F but colour from °C.
  const TEMP_COL_EXTREME_COLD = hexRgb('#2563eb');
  const TEMP_COL_COMFORT = hexRgb('#059669');
  const TEMP_COL_WARM = hexRgb('#fb923c');
  const TEMP_COL_EXTREME_HEAT = hexRgb('#dc2626');
  const TEMP_COL_CYAN = hexRgb('#06b6d4');
  function tempComfortColor(c) {
    if (c == null || !isFinite(c)) return null;
    if (c <= EXTREME_COLD_TMEAN_C) return mix(TEMP_COL_EXTREME_COLD, TEMP_COL_EXTREME_COLD, 0);
    if (c >= EXTREME_HEAT_TMAX_C) return mix(TEMP_COL_EXTREME_HEAT, TEMP_COL_EXTREME_HEAT, 0);
    if (c >= COMFORT_TMAX_C) {
      const t = (c - COMFORT_TMAX_C) / (EXTREME_HEAT_TMAX_C - COMFORT_TMAX_C);
      return t < 0.5 ? mix(TEMP_COL_COMFORT, TEMP_COL_WARM, t * 2) : mix(TEMP_COL_WARM, TEMP_COL_EXTREME_HEAT, (t - 0.5) * 2);
    }
    if (c >= COMFORT_TMIN_C) return mix(TEMP_COL_COMFORT, TEMP_COL_COMFORT, 0);
    const t = (c - EXTREME_COLD_TMEAN_C) / (COMFORT_TMIN_C - EXTREME_COLD_TMEAN_C);
    return t < 0.5 ? mix(TEMP_COL_EXTREME_COLD, TEMP_COL_CYAN, t * 2) : mix(TEMP_COL_CYAN, TEMP_COL_COMFORT, (t - 0.5) * 2);
  }
  // Historical *record* extremes (all-time max / min) need their OWN scale, NOT the
  // daily comfort/extreme bands: ~97% of records sit ≥33℃ and ~68% ≤-5℃, so reusing
  // tempComfortColor() saturated every 历史最高温 to full red and most 历史最低温 to
  // full blue — the colour carried no information. These multi-stop ramps span the
  // actual record range (≈ +7…−44℃ lows, 31…45℃ highs) and reuse the field-map
  // palette, so a coastal 33℃ record reads distinctly milder than a desert 45℃ one.
  const HIST_HIGH_STOPS = [           // °C → rgb, descending
    [46, [127, 29, 29]],   // ≥46  severe (Turpan-class)
    [41, [220, 38, 38]],   // 41   red
    [37, [249, 115, 22]],  // 37   orange
    [33, [251, 191, 36]],  // 33   amber
    [29, [52, 211, 153]],  // ≤29  genuinely mild record (coastal / highland)
  ];
  const HIST_LOW_STOPS = [            // °C → rgb, descending
    [7,  [52, 211, 153]],  // ≥7   subtropical — no real cold record (green)
    [0,  [103, 232, 249]], // 0    cyan
    [-8, [56, 189, 248]],  // −8   sky
    [-18,[37, 99, 235]],   // −18  blue
    [-30,[55, 48, 163]],   // −30  indigo
    [-44,[49, 46, 129]],   // ≤−44 deep indigo (Mohe-class)
  ];
  function rampStops(val, stops) {
    if (val >= stops[0][0]) return `rgb(${stops[0][1].join(',')})`;
    const last = stops[stops.length - 1];
    if (val <= last[0]) return `rgb(${last[1].join(',')})`;
    for (let i = 0; i < stops.length - 1; i++) {
      const [hi, cHi] = stops[i], [lo, cLo] = stops[i + 1];
      if (val <= hi && val >= lo) return mix(cHi, cLo, (hi - val) / (hi - lo));
    }
    return `rgb(${last[1].join(',')})`;
  }
  function histExtremeColor(val, kind) {
    if (val == null || !isFinite(val)) return null;
    return rampStops(val, kind === 'low' ? HIST_LOW_STOPS : HIST_HIGH_STOPS);
  }
  // Colour from underlying °C; display via fmtTemp (°F in English).
  function tempCell(val, title) {
    if (val == null) return `<span class="${tcx().faint}">—</span>`;
    const bg = tempComfortColor(val);
    return pill(fmtTemp(val), bg, pillFgForBg(bg), title);
  }
  function precipCell(d) {
    if (d.annualPrecip == null) return `<span class="${tcx().faint}">—</span>`;
    const frac = tableFrac(d.annualPrecip, viewTableScales().annualPrecip);
    const bg = tableRampBg('precip', frac);
    return pill(fmtPrecip(d.annualPrecip), bg, pillFgForBg(bg));
  }
  function elevationCell(d) {
    if (d.elevation == null) return `<span class="${tcx().faint}">—</span>`;
    const frac = tableFrac(d.elevation, viewTableScales().elevation);
    const bg = tableRampBg('terrain', frac);
    return pill(fmtElev(d.elevation), bg, pillFgForBg(bg));
  }
  function distKmCell(val, scaleKey, label) {
    if (val == null) return `<span class="${tcx().faint}">—</span>`;
    const frac = tableFrac(val, viewTableScales()[scaleKey]);
    const bg = distKmBg(frac);
    return pill(label != null ? label : fmtKm(val), bg, pillFgForBg(bg));
  }
  // LULU avoidance distance — DIVERGING (NEAR = bad = RED → slate → FAR = good =
  // EMER). Mirror image of amenity distance (where near is greener); never reuse
  // the neutral gray distKmBg, which carries no good/bad meaning.
  function luluKmCell(val, scaleKey) {
    if (val == null) return `<span class="${tcx().faint}">—</span>`;
    const frac = tableFrac(val, viewTableScales()[scaleKey]);
    const bg = frac < 0.5 ? mix(RED, SLATE, frac * 2) : mix(SLATE, EMER, (frac - 0.5) * 2);
    return pill(fmtKm(val), bg, pillFgForBg(bg));
  }
  function bandCell(level, kind) {
    if (!level) return `<span class="${tcx().faint}">—</span>`;
    const ord = (kind === 'seismic' ? SEISMIC_ORD : TYPH_ORD)[level] || 1;
    const frac = (ord - 1) / 3;
    const lbl = kind === 'seismic' ? trSeis(level) : trTy(level); return pill(lbl, mix([226, 232, 240], [225, 90, 60], frac), frac > 0.5 ? '#fff' : '#0f172a');
  }
  function hazardCell(d) {
    if (!d.hazard) return `<span class="${tcx().faint}">—</span>`;
    const hs = d.hazard.hazards;
    const tags = hs.slice(0, 2).map((h) =>
      `<span class="${tcx().body}">${trHz(h.type)}<span class="text-[0.65rem] ${tcx().muted}"> · ${trFc(h.freq)}</span></span>`)
      .join(`<span class="${tcx().faint}"> </span>`);
    const more = hs.length > 2 ? `<span class="${tcx().muted} text-[0.65rem]"> +${hs.length - 2}</span>` : '';
    const full = isEn()
      ? hs.map((h) => {
        const note = trHNoteEn(h.note);
        return `${trHz(h.type)}: ${trFl(h.freqLabel)}${note ? ' — ' + note : ''}`;
      }).join('\n')
      : hs.map((h) => `${trHz(h.type)}：${h.freqLabel}（${h.note}）`).join('\n');
    const tip = isEn()
      ? [trHeadEn(d.hazard.headline), full].filter(Boolean).join('\n')
      : `${d.hazard.headline}\n${full}`;
    return `<span title="${tip.replace(/"/g, '&quot;')}">${tags}${more}</span>`;
  }
  function heatingCell(d) {
    if (!d.heating) return `<span class="${tcx().faint}">—</span>`;
    const [bg, fg] = HEATING_STYLE[d.heating] || ['#f1f5f9', '#475569'];
    return `<span class="inline-block rounded px-1.5 py-0.5 text-xs font-medium" style="background:${bg};color:${fg}" title="${trHeatNote(d.heatingNote)}">${trHeat(d.heating)}</span>`;
  }
  function rangeCell(v) {
    if (v == null) return `<span class="${tcx().faint}">—</span>`;
    const frac = clamp(v / viewScales().rangeMaxT, 0, 1);
    return pill(fmtSwing(v), rangeColor(frac), frac > 0.45 ? '#fff' : '#0f172a');
  }
  // 房龄 chip: green(new) → amber(old) by age; tooltip carries 建成年份 + source;
  // unknown years degrade to a muted「未知」so partial research coverage is honest.
  function builtCell(d) {
    const y = d.builtYear;
    if (y == null) return `<span class="${tcx().faint}" title="${t('builtUnknownTitle')}">—<span class="ml-0.5 text-[0.6rem]">${t('builtUnknown')}</span></span>`;
    const age = builtAgeOf(d);
    const ap = d.builtYearApprox;
    const future = age < 0;
    const ageT = future ? 0 : clamp(age / 45, 0, 1);
    const label = future ? fmtBuiltAgeLabel(age) : `${ap ? t('builtApprox') : ''}${age}${isEn() ? ' yr' : '年'}`;
    const title = `${ap && !future ? t('builtApprox') : ''}${t('builtYearTitle')} ${y} · ${t('builtAgeTitle')} ${fmtBuiltAgeLabel(age)}${ap && !future ? t('builtDecadeNote') : (future ? t('builtFutureNote') : '')}`
      + (d.builtYearSrc && !isEn() ? `\n${t('builtSource')}: ${d.builtYearSrc}` : '');
    const bg = future ? AGE_FUTURE : mix(AGE_NEW, AGE_OLD, ageT);
    const fg = future ? '#475569' : '#fff';
    return `<span class="inline-block rounded px-1.5 py-0.5 text-xs font-medium" style="background:${bg};color:${fg}" title="${title.replace(/"/g, '&quot;')}">${label}</span>`;
  }
  const HIST_LEVEL_EN = { '市': 'city station', '区县': 'county', '区镇/街道': 'district/town' };
  function trHistLevel(lv) { return isEn() ? (HIST_LEVEL_EN[lv] || lv) : lv; }
  function histTempNoteDisplay(d) {
    if (!d || !d.histTempNote) return '';
    if (!isEn()) return d.histTempNote;
    const src = d.histTempSrc || '';
    if (src.startsWith('wikipedia')) return t('histTempNoteWiki');
    if (src.startsWith('open-meteo')) return t('histTempNoteEra5');
    if (src.startsWith('climate-monthly')) return t('histTempNoteClimate');
    return '';
  }
  function histTempCell(val, date, station, note, kind, level) {
    if (val == null) return `<span class="${tcx().faint}">—</span>`;
    const st = station && (!isEn() || !/[\u4e00-\u9fff]/.test(station)) ? station : '';
    const tip = [kind === 'high' ? t('histTempMaxTitle') : t('histTempMinTitle'), fmtTemp(val),
      date ? `(${date})` : '', level ? trHistLevel(level) : '', st, note || ''].filter(Boolean).join(' · ');
    const bg = histExtremeColor(val, kind === 'high' ? 'high' : 'low');
    return pill(fmtTemp(val), bg, pillFgForBg(bg), tip);
  }
  function climateCell(d) {
    if (!d.climateType) return `<span class="${tcx().faint}">—</span>`;
    const [bg, fg] = CLIMATE_STYLE[d.climateType] || ['#f1f5f9', '#64748b'];
    const title = `${t('annualMean')} ${d.annualMean == null ? '—' : fmtTemp(d.annualMean)} · ${t('swingLabel')} ${fmtSwing(d.tempRange)} · ${t('coldestMonth')} ${fmtTemp(d.tMin)} / ${t('hottestMonth')} ${fmtTemp(d.tMax)}`;
    return `<span class="inline-block rounded px-1.5 py-0.5 text-xs font-medium" style="background:${bg};color:${fg}" title="${title}">${trCl(d.climateType)}</span>`;
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
    if (d.daily && d.daily.comfortDays) return miniDayStrip(d.daily.comfortDays, '#059669', t('comfortLabel') + ' ' + (comfortRangeOf(d) || t('monthNone')));
    if (d.comfortMonths == null) return `<span class="${tcx().faint}">—</span>`;
    const frac = d.comfortMonths / 12;
    return pill(comfortRangeOf(d) || (d.comfortMonths + (isEn() ? '' : '月')), comfortColor(frac), frac > 0.55 ? '#fff' : '#0f172a');
  }
  function extremeCell(d) {
    if (d.daily && d.daily.extremeDays) return miniDayStrip(d.daily.extremeDays, '#dc2626', d.daily.extremeDays.length ? (t('extremeLabel') + ' ' + extremeRangeOf(d)) : t('noExtreme'));
    if (d.extremeMonths == null) return `<span class="${tcx().faint}">—</span>`;
    const { exMaxT } = viewScales();
    const ex = d.extremeDayCount != null ? d.extremeDayCount : d.extremeMonths;
    const frac = ex / exMaxT;
    return pill(extremeRangeOf(d) || (ex + (d.extremeDayCount != null ? t('daySuffix') : (isEn() ? '' : '月'))), badColor(frac), frac > 0.5 ? '#fff' : '#0f172a');
  }
  function yieldCell(d) {
    if (d.yieldPct == null) return `<span class="${tcx().faint}">—</span>`;
    const { yMinT, yMaxT } = viewScales();
    const frac = (d.yieldPct - yMinT) / (yMaxT - yMinT || 1);
    return pill(fmtPct(d.yieldPct), lerpColor(frac), frac > 0.5 ? '#fff' : '#0f172a');
  }

  // group: core/price always shown; live/infra/risk/invest are toggleable.
  const COLS = [
    { key: 'id', label: '#', group: 'core', num: true, get: (d) => d.id, cell: (d) => d.id, dir: 1 },
    { key: 'prov', label: '省份', group: 'core', str: true, get: (d) => d.prov, cell: (d) => trProv(d.prov), dir: 1 },
    { key: 'city', label: '城市', group: 'core', str: true, get: (d) => d.city, cell: (d) => trCity(d.city), dir: 1 },
    { key: 'dist', label: '区/镇', group: 'core', str: true, get: (d) => d.dist, cell: (d) => trDist(d.dist), dir: 1 },
    { key: 'loc', label: '小区/位置', group: 'core', str: true, get: (d) => d.loc,
      cell: (d) => `<span class="font-medium ${tcx().strong}">${I18N().communityName ? I18N().communityName(d.loc, d.name_en) : d.loc}</span>`
        + (worthBadge(d) ? ' ' + worthBadge(d) : ''), dir: 1 },
    { key: 'builtAge', label: '房龄', group: 'core', get: (d) => nz(builtAgeOf(d), -999), cell: (d) => builtCell(d) },
    { key: 'priceWan', label: '总价', group: 'price', num: true, get: (d) => d.priceYuan / 10000, cell: (d) => fmtWanD(d) },
    { key: 'area', label: '面积㎡', group: 'price', num: true, get: (d) => d.area, cell: (d) => fmtArea(d.area) },
    { key: 'unitPrice', label: '单价 元/㎡', group: 'price', num: true, get: (d) => d.unitPrice, cell: (d) => fmtUnit(d.unitPrice) },
    { key: 'rent', label: '月租 元', group: 'price', num: true, get: (d) => d.rentCny, cell: (d) => fmtRent(d.rent, d.prov) },
    { key: 'climateType', label: '气候类型', group: 'live', str: true, get: (d) => d.climateType || '', cell: (d) => climateCell(d) },
    { key: 'tempRange', label: '年温差', group: 'live', num: true, get: (d) => nz(d.tempRange, -1), cell: (d) => rangeCell(d.tempRange) },
    { key: 'janTemp', label: '1月均温', group: 'live', num: true, get: (d) => nz(d.janTemp, -999), cell: (d) => tempCell(d.janTemp) },
    { key: 'julTemp', label: '7月均温', group: 'live', num: true, get: (d) => nz(d.julTemp, -999), cell: (d) => tempCell(d.julTemp) },
    { key: 'histTempMax', label: '历史最高温', group: 'live', num: true,
      get: (d) => nz(d.histTempMax, -999),
      cell: (d) => histTempCell(d.histTempMax, d.histTempMaxDate, d.histTempStation, histTempNoteDisplay(d), 'high', d.histTempLevel) },
    { key: 'histTempMin', label: '历史最低温', group: 'live', num: true,
      get: (d) => nz(d.histTempMin, 999),
      cell: (d) => histTempCell(d.histTempMin, d.histTempMinDate, d.histTempStation, histTempNoteDisplay(d), 'low', d.histTempLevel) },
    { key: 'comfortMonths', label: '舒适日期', group: 'live', get: (d) => nz(d.comfortDayCount, nz(d.comfortMonths, -1)), cell: (d) => comfortCell(d) },
    { key: 'extremeMonths', label: '极端日期', group: 'live', get: (d) => nz(d.extremeDayCount, nz(d.extremeMonths, 99)), cell: (d) => extremeCell(d) },
    { key: 'annualPrecip', label: '年降水mm', group: 'live', num: true, get: (d) => nz(d.annualPrecip, -1), cell: (d) => precipCell(d) },
    { key: 'elevation', label: '海拔m', group: 'live', num: true, get: (d) => nz(d.elevation, -1), cell: (d) => elevationCell(d) },
    { key: 'heating', label: '供暖', group: 'live', get: (d) => (d.heating != null ? HEATING_ORD[d.heating] : -1), cell: (d) => heatingCell(d) },
    { key: 'hospitalKm', label: '医院km', group: 'infra', num: true, get: (d) => nz(d.hospitalKm, 1e9), cell: (d) => distKmCell(d.hospitalKm, 'hospitalKm') },
    { key: 'transitKm', label: '地铁/火车km', group: 'infra', num: true,
      get: (d) => nz(d.transitKm, 1e9),
      cell: (d) => distKmCell(d.transitKm, 'transitKm',
        d.transitKm == null ? null : (d.transitKind === 'metro' ? `${t('poiMetro')} ${fmtKm(d.transitKm)}` : `${t('poiTrain')} ${fmtKm(d.transitKm)}`)) },
    { key: 'airportKm', label: '机场km', group: 'infra', num: true, get: (d) => nz(d.airportKm, 1e9), cell: (d) => distKmCell(d.airportKm, 'airportKm') },
    { key: 'coastKm', label: '海岸km', group: 'infra', num: true, get: (d) => nz(d.coastKm, 1e9), cell: (d) => distKmCell(d.coastKm, 'coastKm') },
    { key: 'wastewaterKm', label: '污水厂km', group: 'avoid', num: true, get: (d) => nz(d.wastewaterKm, 1e9), cell: (d) => luluKmCell(d.wastewaterKm, 'wastewaterKm') },
    { key: 'landfillKm', label: '垃圾填埋km', group: 'avoid', num: true, get: (d) => nz(d.landfillKm, 1e9), cell: (d) => luluKmCell(d.landfillKm, 'landfillKm') },
    { key: 'incineratorKm', label: '垃圾焚烧km', group: 'avoid', num: true, get: (d) => nz(d.incineratorKm, 1e9), cell: (d) => luluKmCell(d.incineratorKm, 'incineratorKm') },
    { key: 'nuclearKm', label: '核电站km', group: 'avoid', num: true, get: (d) => nz(d.nuclearKm, 1e9), cell: (d) => luluKmCell(d.nuclearKm, 'nuclearKm') },
    { key: 'substationKm', label: '大变电站km', group: 'avoid', num: true, get: (d) => nz(d.substationKm, 1e9), cell: (d) => luluKmCell(d.substationKm, 'substationKm') },
    { key: 'chemicalKm', label: '化工危化km', group: 'avoid', num: true, get: (d) => nz(d.chemicalKm, 1e9), cell: (d) => luluKmCell(d.chemicalKm, 'chemicalKm') },
    { key: 'sensitiveKm', label: '敏感地点km', group: 'avoid', num: true, get: (d) => nz(d.sensitiveKm, 1e9), cell: (d) => luluKmCell(d.sensitiveKm, 'sensitiveKm') },
    { key: 'seismic', label: '地震带', group: 'risk', get: (d) => SEISMIC_ORD[d.seismic] || 0, cell: (d) => bandCell(d.seismic, 'seismic') },
    { key: 'typhoon', label: '台风', group: 'risk', get: (d) => TYPH_ORD[d.typhoon] || 0, cell: (d) => bandCell(d.typhoon, 'typhoon') },
    { key: 'hazard', label: '当地灾种·常见度', group: 'risk', get: (d) => d.hazard ? d.hazard.hazards[0].freq * 10 + d.hazard.hazards.length : 0, cell: (d) => hazardCell(d) },
    { key: 'yieldPct', label: '毛回报', group: 'invest', num: true, get: (d) => d.yieldPct, cell: (d) => yieldCell(d) },
    { key: 'payback', label: '回本年', group: 'invest', num: true, get: (d) => d.payback, cell: (d) => fmtYrs(d.payback) },
  ];
  // Threshold-transparent quick filters (AND-combined). Each label carries its
  // literal threshold so the filter is reproducible from the published data —
  // no opaque "recommended" flag. Null dimension values fail closed (row hidden
  // when that chip is on) except lowHazard, where no hazard data = no known
  // annual hazard.
  const FILTERS = {
    budget30: { labelKey: 'fcBudget30', pass: (d) => d.priceYuan <= 300000 },
    unit5000: { labelKey: 'fcUnit5000', pass: (d) => d.unitPrice != null && d.unitPrice <= 5000 },
    age20: { labelKey: 'fcAge20', pass: (d) => d.builtYear != null && (new Date().getFullYear() - d.builtYear) <= 20 },
    warmWinter: { labelKey: 'fcWarmWinter', pass: (d) => d.janTemp != null && d.janTemp >= 5 },
    coolSummer: { labelKey: 'fcCoolSummer', pass: (d) => d.julTemp != null && d.julTemp <= 26 },
    heated: { labelKey: 'fcHeated', pass: (d) => d.heating === '集中供暖' || d.heating === '部分供暖' },
    coast50: { labelKey: 'fcCoast50', pass: (d) => d.coastKm != null && d.coastKm <= 50 },
    lowAlt: { labelKey: 'fcLowAlt', pass: (d) => d.elevation != null && d.elevation <= 1500 },
    lowHazard: { labelKey: 'fcLowHazard', pass: (d) => !(d.hazard && d.hazard.hazards && d.hazard.hazards.some((h) => h.freq >= 5)) },
    rail20: { labelKey: 'fcRail20', pass: (d) => d.transitKm != null && d.transitKm <= 20 },
    hsr20: { labelKey: 'fcHsr20', pass: (d) => d.hsrKm != null && d.hsrKm <= 20 },
    // LULU avoidance — 越远越好 (farther-is-better; pass = "at least this far").
    fcFarSensitive: { labelKey: 'fcFarSensitive', pass: (d) => d.sensitiveKm != null && d.sensitiveKm >= 5 },
    fcFarNuclear: { labelKey: 'fcFarNuclear', pass: (d) => d.nuclearKm != null && d.nuclearKm >= 30 },
    fcFarNuisance: { labelKey: 'fcFarNuisance', pass: (d) => { const xs = [d.wastewaterKm, d.landfillKm, d.incineratorKm, d.chemicalKm].filter((v) => v != null); return xs.length > 0 && Math.min(...xs) >= 3; } },
  };
  const tstate = { sortKey: 'comfortMonths', sortDir: -1, prov: '', q: '', groups: new Set(['live', 'infra', 'risk', 'avoid']), chips: new Set() };

  const colLabel = (c) => t('col_' + c.key) || c.label;
  const visibleCols = () => COLS.filter((c) => c.group === 'core' || c.group === 'price' || tstate.groups.has(c.group));
  // Display order: # last; prov/city stay leftmost for horizontal-scroll pinning.
  const displayCols = () => {
    const vis = visibleCols();
    const idCol = vis.find((c) => c.key === 'id');
    if (!idCol) return vis;
    return vis.filter((c) => c.key !== 'id').concat(idCol);
  };
  const STICKY_LEFT_COLS = new Set(['prov', 'city']);
  function syncStickyColOffset() {
    const prov = document.querySelector('#table-scroll th[data-col="prov"]');
    if (!prov || !prov.offsetWidth) return;
    document.documentElement.style.setProperty('--table-sticky-city-left', `${prov.offsetWidth}px`);
  }

  function tableView() {
    const chips = [...tstate.chips].map((k) => FILTERS[k]).filter(Boolean);
    const rows = viewData().filter((d) => (!tstate.prov || d.prov === tstate.prov) &&
      (!tstate.q || (d.city + d.dist + d.loc + d.prov).toLowerCase().includes(tstate.q)) &&
      chips.every((f) => f.pass(d)));
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

  // Mobile (<sm) card list: same tableView() rows (filter + sort) as the table,
  // key facts only — the full dimension set stays one tap away in the modal.
  // The wide 28-col table needs ~8 viewport-widths of horizontal scroll on a
  // phone (price/小区 invisible without it), so cards replace it below 640px.
  const isMobileTable = () => !!(window.matchMedia && window.matchMedia('(max-width: 639px)').matches);
  function cardRow(d) {
    const x = tcx();
    const name = I18N().communityName ? I18N().communityName(d.loc, d.name_en) : d.loc;
    const sub = [trProv(d.prov), trCity(d.city), trDist(d.dist)].filter(Boolean).join(' · ');
    const strip = (d.daily && d.daily.comfortDays)
      ? miniDayStrip(d.daily.comfortDays, '#059669', t('comfortLabel') + ' ' + (comfortRangeOf(d) || t('monthNone')), '100%')
      : '';
    const comfortTxt = d.comfortDayCount != null ? `${t('comfortLabel')} ${d.comfortDayCount}${t('daySuffix')}` : '';
    const extremeTxt = d.extremeDayCount != null ? `${comfortTxt ? ' · ' : ''}${t('extremeLabel')} ${d.extremeDayCount}${t('daySuffix')}` : '';
    const open = d.enr ? ` data-open="${d.id}" role="button" tabindex="0"` : '';
    return `<div class="px-4 py-3${d.enr ? ' cursor-pointer active:bg-slate-50 dark:active:bg-slate-700/40' : ''}"${open}>
      <div class="flex items-baseline justify-between gap-2">
        <span class="font-medium ${x.strong} truncate">${name}</span>
        <span class="font-semibold tabular-nums ${x.strong} whitespace-nowrap">${fmtWanD(d)}</span>
      </div>
      <div class="mt-0.5 flex items-baseline justify-between gap-2 text-xs ${x.muted}">
        <span class="truncate">${sub}</span>
        <span class="tabular-nums whitespace-nowrap">${fmtUnit(d.unitPrice)} · ${fmtArea(d.area)}</span>
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-1.5">${climateCell(d)}${builtCell(d)}${heatingCell(d)}${worthBadge(d)}`
      + (d.enr ? `<button data-cmpadd="${d.id}" class="ml-auto text-[0.65rem] font-medium px-1.5 py-0.5 rounded border transition-colors ${cmp.has(d.id)
        ? 'bg-emerald-600 border-emerald-600 text-white'
        : (x.muted + ' ' + (isDark() ? 'border-slate-600' : 'border-slate-200'))}">${cmp.has(d.id) ? t('cmpCardOn') : t('cmpCardAdd')}</button>` : '')
      + `</div>
      ${(d.janTemp != null || d.julTemp != null || d.histTempMax != null || d.histTempMin != null)
        ? `<div class="mt-1.5 flex flex-wrap gap-1">${tempCell(d.janTemp)}${tempCell(d.julTemp)}${histTempCell(d.histTempMax, d.histTempMaxDate, d.histTempStation, histTempNoteDisplay(d), 'high', d.histTempLevel)}${histTempCell(d.histTempMin, d.histTempMinDate, d.histTempStation, histTempNoteDisplay(d), 'low', d.histTempLevel)}</div>`
        : ''}
      ${strip ? `<div class="mt-2">${strip}</div>` : ''}
      ${(comfortTxt || extremeTxt) ? `<div class="mt-1 text-[0.65rem] ${x.muted}">${comfortTxt}${extremeTxt}</div>` : ''}
    </div>`;
  }

  // Mobile sort <select>: mirrors th-click sorting (option value = "colKey:dir").
  const SORT_OPTIONS = [
    ['comfortMonths', -1], ['extremeMonths', 1], ['priceWan', 1],
    ['unitPrice', 1], ['builtAge', -1], ['rent', 1],
  ];
  function syncSortSelect() {
    const sel = document.getElementById('table-sort');
    if (!sel) return;
    const cur = `${tstate.sortKey}:${tstate.sortDir}`;
    const opt = ([k, dir]) => {
      const c = COLS.find((c2) => c2.key === k) || COLS[0];
      return `<option value="${k}:${dir}">${dir === 1 ? '↑' : '↓'} ${colLabel(c)}</option>`;
    };
    const known = SORT_OPTIONS.some(([k, dir]) => `${k}:${dir}` === cur);
    sel.innerHTML = (known ? [] : [[tstate.sortKey, tstate.sortDir]]).concat(SORT_OPTIONS).map(opt).join('');
    sel.value = cur;
  }

  function renderTable() {
    const cols = displayCols();
    const rows = tableView();
    const dk = isDark();
    const thActCls = dk ? 'text-slate-100' : 'text-slate-900';
    const thIdlCls = dk ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700';
    const headBg = dk ? 'bg-slate-800' : 'bg-slate-50';
    const head = cols.map((c) => {
      const active = tstate.sortKey === c.key;
      const arrow = active ? (tstate.sortDir === 1 ? '▲' : '▼') : '';
      const hint = c.key === 'hazard'
        ? `<span class="block text-[0.6rem] font-normal normal-case tracking-normal ${dk ? 'text-slate-500' : 'text-slate-400'}">${t('col_hazardHint')}</span>`
        : '';
      const sticky = STICKY_LEFT_COLS.has(c.key) ? ' table-sticky-col' : '';
      return `<th data-col="${c.key}" class="relative px-3 py-2.5 font-medium cursor-pointer select-none whitespace-nowrap ${headBg}${sticky} ${c.num ? 'text-right' : 'text-left'} ${active ? thActCls : thIdlCls}">${colLabel(c)}<span class="ml-0.5 text-[0.6rem]">${arrow}</span>${hint}</th>`;
    }).join('');
    const tdTextCls = dk ? 'text-slate-300' : 'text-slate-700';
    const body = rows.map((d) => {
      const tds = cols.map((c) => {
        const cls = c.num ? `text-right tabular-nums ${tdTextCls}` : tdTextCls;
        const sticky = STICKY_LEFT_COLS.has(c.key) ? ' table-sticky-col' : '';
        return `<td data-col="${c.key}" class="px-3 py-2 ${cls} whitespace-nowrap${sticky}">${c.cell(d)}</td>`;
      }).join('');
      const open = d.enr ? ` data-open="${d.id}"` : '';
      const rowCls = dk
        ? `border-t border-slate-700/60${d.enr ? ' cursor-pointer hover:bg-slate-700/40' : ''}`
        : `border-t border-slate-100${d.enr ? ' cursor-pointer hover:bg-slate-50/70' : ''}`;
      return `<tr class="${rowCls}"${open}>${tds}</tr>`;
    }).join('');
    document.getElementById('table-head').innerHTML = `<tr class="text-xs uppercase tracking-wider">${head}</tr>`;
    document.getElementById('table-body').innerHTML = body;
    document.getElementById('table-count').textContent = t('tableCount', { n: rows.length, total: viewData().length });
    const cardsHost = document.getElementById('table-cards');
    if (cardsHost) cardsHost.innerHTML = isMobileTable() ? rows.map(cardRow).join('') : '';
    syncSortSelect();
    styleFilterChips();  // theme & language both funnel through renderTable
    syncStickyColOffset();
  }

  function updateProvFilter() {
    const sel = document.getElementById('prov-filter');
    if (!sel) return;
    const want = tstate.prov || sel.value;
    const vd = viewData();
    const provs = [...new Set(vd.map((d) => d.prov))].sort((a, b) => a.localeCompare(b, 'zh'));
    sel.innerHTML = `<option value="">${t('provFilterAll')} (${vd.length})</option>` +
      provs.map((p) => `<option value="${p}">${trProv(p)} (${vd.filter((d) => d.prov === p).length})</option>`).join('');
    if (want && provs.includes(want)) { sel.value = want; tstate.prov = want; }
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

  // Inject the LULU `avoid` column-group toggle (HTML toolbar is owned by another
  // worker; we add the button here so the existing [data-group] wiring / styling /
  // persistence picks it up like the other groups).
  function ensureAvoidChip() {
    const invest = document.querySelector('button[data-group="invest"]');
    if (!invest || document.querySelector('button[data-group="avoid"]')) return;
    const btn = document.createElement('button');
    btn.setAttribute('data-group', 'avoid');
    btn.className = 'group-chip';
    invest.parentNode.insertBefore(btn, invest.nextSibling);
  }
  // Inject the 3 LULU avoidance filter chips into the same filter-chip bar as the
  // others (HTML owned by another worker). Existing [data-filter] wiring styles +
  // persists them automatically once present.
  function ensureLuluFilterChips() {
    const anchor = document.querySelector('button[data-filter="hsr20"]');
    if (!anchor) return;
    const keys = ['fcFarSensitive', 'fcFarNuclear', 'fcFarNuisance'];
    keys.forEach((k) => {
      if (document.querySelector(`button[data-filter="${k}"]`)) return;
      if (!FILTERS[k]) return;
      const btn = document.createElement('button');
      btn.setAttribute('data-filter', k);
      btn.className = 'filter-chip';
      anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    });
  }

  function styleGroupChips() {
    const dk = isDark();
    ensureAvoidChip();
    document.querySelectorAll('[data-group]').forEach((b) => {
      if (b.dataset.group === 'avoid') b.textContent = t('gAvoid');
      const on = tstate.groups.has(b.dataset.group);
      b.className = 'px-3 py-1.5 rounded-md text-xs font-medium transition-colors ' +
        (on
          ? (dk ? 'bg-emerald-700 text-white' : 'bg-emerald-600 text-white')
          : (dk ? 'bg-slate-800 text-slate-400 border border-slate-600 hover:text-slate-100' : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-900'));
    });
  }

  // Filter chips use indigo (vs emerald column-group chips) so "which columns
  // show" and "which rows show" read as two different controls at a glance.
  function styleFilterChips() {
    const dk = isDark();
    document.querySelectorAll('[data-filter]').forEach((b) => {
      const f = FILTERS[b.dataset.filter];
      if (!f) return;
      b.textContent = t(f.labelKey);
      const on = tstate.chips.has(b.dataset.filter);
      b.className = 'px-3 py-1.5 rounded-md text-xs font-medium transition-colors ' +
        (on
          ? (dk ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white')
          : (dk ? 'bg-slate-800 text-slate-400 border border-slate-600 hover:text-slate-100' : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-900'));
    });
  }

  function wireTable() {
    ensureAvoidChip(); // inject before the [data-group] click wiring below
    ensureLuluFilterChips(); // inject before the [data-filter] click wiring below
    updateProvFilter();
    document.getElementById('prov-filter').addEventListener('change', (e) => {
      tstate.prov = e.target.value; renderTable(); saveUiPrefs();
    });

    const q = document.getElementById('table-search');
    if (tstate.q) q.value = tstate.q;
    q.addEventListener('input', () => { tstate.q = q.value.trim().toLowerCase(); renderTable(); saveUiPrefs(); });

    document.getElementById('table-head').addEventListener('click', (e) => {
      const th = e.target.closest('[data-col]');
      if (!th) return;
      const key = th.dataset.col;
      const col = COLS.find((c) => c.key === key);
      if (tstate.sortKey === key) tstate.sortDir *= -1;
      else { tstate.sortKey = key; tstate.sortDir = (col && (col.str || key === 'id')) ? 1 : -1; }
      renderTable(); saveUiPrefs();
    });

    document.querySelectorAll('[data-group]').forEach((b) => b.addEventListener('click', () => {
      const g = b.dataset.group;
      if (tstate.groups.has(g)) tstate.groups.delete(g); else tstate.groups.add(g);
      styleGroupChips(); renderTable(); saveUiPrefs();
    }));
    styleGroupChips();

    document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.filter;
      if (tstate.chips.has(k)) tstate.chips.delete(k); else tstate.chips.add(k);
      styleFilterChips(); renderTable(); saveUiPrefs();
    }));
    styleFilterChips();

    document.getElementById('csv-export').addEventListener('click', exportCSV);
    document.getElementById('table-body').addEventListener('click', (e) => {
      const row = e.target.closest('tr[data-open]');
      if (row) openListing(+row.dataset.open);
    });

    const sortSel = document.getElementById('table-sort');
    if (sortSel) sortSel.addEventListener('change', () => {
      const [k, dir] = String(sortSel.value).split(':');
      if (!COLS.some((c) => c.key === k)) return;
      tstate.sortKey = k; tstate.sortDir = +dir || -1;
      renderTable(); saveUiPrefs();
    });
    const cardsHost = document.getElementById('table-cards');
    if (cardsHost) cardsHost.addEventListener('click', (e) => {
      const add = e.target.closest('[data-cmpadd]');
      if (add) { cmpToggle(+add.dataset.cmpadd); return; }
      const card = e.target.closest('[data-open]');
      if (card) openListing(+card.dataset.open);
    });
    // re-render when crossing the table↔cards breakpoint
    if (window.matchMedia) {
      const mq = window.matchMedia('(max-width: 639px)');
      const onMq = () => renderTable();
      if (mq.addEventListener) mq.addEventListener('change', onMq);
      else if (mq.addListener) mq.addListener(onMq);
    }
  }

  function wireListingOpens() {
    const rankParent = document.getElementById('rank-chart')?.parentElement;
    if (rankParent && !rankParent._listingOpen) {
      rankParent._listingOpen = true;
      rankParent.addEventListener('click', (e) => {
        const row = e.target.closest('[data-open]');
        if (row) openListing(+row.dataset.open);
      });
    }
  }

  function exportCSV() {
    const cols = [
      ['序号', (d) => d.id], ['省份', (d) => d.prov], ['城市', (d) => d.city],
      ['区/镇', (d) => d.dist], ['小区', (d) => d.loc], ['总价(万元)', (d) => d.priceYuan / 10000],
      ['面积(㎡)', (d) => d.area], ['单价(元/㎡)', (d) => Math.round(d.unitPrice)],
      ['月租(元)', (d) => d.rent],
      ['气候类型', (d) => d.climateType || ''], ['年温差(℃)', (d) => d.tempRange],
      ['1月均温(℃)', (d) => d.janTemp], ['7月均温(℃)', (d) => d.julTemp],
      ['历史最高温(℃)', (d) => d.histTempMax], ['历史最高温日期', (d) => d.histTempMaxDate || ''],
      ['历史最低温(℃)', (d) => d.histTempMin], ['历史最低温日期', (d) => d.histTempMinDate || ''],
      ['历史气温来源', (d) => d.histTempSrc || ''], ['历史气温站址说明', (d) => d.histTempStation || d.histTempNote || ''],
      ['舒适天数', (d) => d.comfortDayCount != null ? d.comfortDayCount : d.comfortMonths],
      ['舒适日期', (d) => d.comfortRange],
      ['极端天数', (d) => d.extremeDayCount != null ? d.extremeDayCount : d.extremeMonths],
      ['极端日期', (d) => d.extremeRange],
      ['年降水(mm)', (d) => d.annualPrecip], ['海拔(m)', (d) => d.elevation],
      ['供暖', (d) => d.heating || ''],
      ['医院(km)', (d) => d.hospitalKm],
      ['轨交(km)', (d) => d.transitKm == null ? '' : (d.transitKind === 'metro' ? `地铁${d.transitKm}` : `火车${d.transitKm}`)],
      ['机场(km)', (d) => d.airportKm], ['海岸(km)', (d) => d.coastKm],
      ['污水厂(km)', (d) => d.wastewaterKm], ['垃圾填埋(km)', (d) => d.landfillKm],
      ['垃圾焚烧(km)', (d) => d.incineratorKm], ['核电站(km)', (d) => d.nuclearKm],
      ['大变电站(km)', (d) => d.substationKm], ['化工危化(km)', (d) => d.chemicalKm],
      ['敏感地点(km)', (d) => d.sensitiveKm],
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
  const POI_META_KEYS = {
    community: { labelKey: 'poiCommunity', fill: '#ffffff', stroke: '#334155' },
    metro: { labelKey: 'poiMetro', color: '#2563eb' }, train: { labelKey: 'poiTrain', color: '#7c3aed' },
    airport: { labelKey: 'poiAirport', color: '#059669' }, hospital: { labelKey: 'poiHospital', color: '#dc2626' },
    mall: { labelKey: 'poiMall', color: '#d97706' }, coast: { labelKey: 'poiCoast', color: '#0ea5e9' },
    // LULU avoidance (越远越好) — distinct hazard palette, none reuse the amenity hues above.
    wastewater: { labelKey: 'poiWastewater', color: '#475569' }, landfill: { labelKey: 'poiLandfill', color: '#92400e' },
    incinerator: { labelKey: 'poiIncinerator', color: '#ea580c' }, nuclear: { labelKey: 'poiNuclear', color: '#facc15' },
    substation: { labelKey: 'poiSubstation', color: '#db2777' }, chemical: { labelKey: 'poiChemical', color: '#0f766e' },
    sensitive: { labelKey: 'poiSensitive', color: '#1e293b' },
  };
  const trainKindTag = (p) => {
    if (!p || !p.trainKind) return '';
    const lbl = p.trainKind === 'highspeed' ? t('poiTrainHSR') : t('poiTrainRegular');
    return ` <span class="text-[10px] rounded px-1 ${p.trainKind === 'highspeed' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}">${lbl}</span>`;
  };
  const poiLabel = (cat) => t(POI_META_KEYS[cat].labelKey);
  const poiMeta = (cat) => ({ label: poiLabel(cat), ...POI_META_KEYS[cat] });
  const nearPoiSwatch = (m) => m.fill
    ? `<span class="inline-block w-2.5 h-2.5 rounded-full shrink-0" style="background:${m.fill};box-shadow:inset 0 0 0 2px ${m.stroke}"></span>`
    : `<span class="inline-block w-2 h-2 rounded-full shrink-0" style="background:${m.color}"></span>`;
  const nearPoiMarkerOpts = (m) => m.fill
    ? { radius: 8, color: m.stroke, weight: 2, fillColor: m.fill, fillOpacity: 1 }
    : { radius: 6, color: '#fff', weight: 1.5, fillColor: m.color, fillOpacity: 0.95 };
  const ZOOM_BY_LEVEL = { loc: 16, dist: 14, city: 12, prefecture: 11 };
  let lmCurrent = null, lmActiveTab = 'sat', lmSatMap = null, lmNearMap = null, lmClimateChart = null, lmTabInit = {};

  // ===== Buying policy (national + city) ==================================
  const CP = window.CITY_POLICY || { byPref: {}, locIndex: {} };
  const NP = window.NATIONAL_POLICY || {};
  // Nationwide numeric constants for the cost/mortgage estimate — these MIRROR
  // window.NATIONAL_POLICY (2024 契税分档 + 5Y-LPR) as plain numbers the calculator
  // can use; the policy panel shows the cited text versions. Update with NP.
  const POLICY_CONST = {
    lpr5y: 3.5, mortgageYears: 30, downFirst: 15,   // 5Y-LPR 2026-06; 全国首付下限 2024-09 统一 15%
    deed: { le140: 1.0, gt140First: 1.5 },   // 家庭唯一住房: ≤140㎡ 1% · >140㎡ 1.5% (公告2024-16号)
  };
  const escP = (s) => String(s == null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // researcher key_facts/details sometimes append meta like "confidence=high" or a
  // 【bracket】 audit prefix — strip the confidence meta for display (source shown as a link).
  const polText = (s) => escP(String(s == null ? '' : s)
    .replace(/[（(]\s*confidence\s*=\s*[^）)]*[）)]/gi, '')
    .replace(/[,，;；]?\s*confidence\s*=\s*\S+/gi, '')
    .trim());

  function policyFor(d) {
    const idx = CP.locIndex || {};
    const key = idx[`${d.prov}|${d.city}`] || idx[`${d.prov}|${(d.city || '').split('-')[0]}`];
    return (key && CP.byPref) ? CP.byPref[key] : null;
  }

  const CONF_DOT = { high: '#059669', med: '#d97706', low: '#dc2626', unknown: '#94a3b8' };
  function confChip(f) {
    if (!f || !f.confidence) return '';
    const c = f.confidence, key = 'conf' + c.charAt(0).toUpperCase() + c.slice(1);
    const tip = `${t('polAsOf')} ${f.as_of || '?'}`;
    return `<span class="inline-flex items-center gap-1 text-[0.6rem] ${tcx().muted} align-middle" title="${tip}">`
      + `<span style="width:7px;height:7px;border-radius:50%;background:${CONF_DOT[c] || CONF_DOT.unknown};display:inline-block"></span>${t(key)}</span>`;
  }
  function srcLink(f) {
    if (!f || !f.source_url) return '';
    return ` <a href="${escP(f.source_url)}" target="_blank" rel="noopener" class="text-[0.6rem] text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap">${t('polSource')}↗</a>`;
  }
  // one policy row: label · value · confidence dot · source link
  function polRow(label, valueHtml, f) {
    const tc = tcx();
    if (!valueHtml) return '';
    return `<div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1 border-b border-slate-100 dark:border-slate-700/50">`
      + `<span class="${tc.muted} text-xs w-24 shrink-0">${label}</span>`
      + `<span class="${tc.body} flex-1 min-w-[8rem]">${valueHtml}</span>`
      + `${confChip(f)}${srcLink(f)}</div>`;
  }

  // ---- decision funnel: 能买 → 划算 → 落户 → 宜居 → 交付 -------------------
  const GATE_STYLE = {
    ok: ['#dcfce7', '#166534', '#bbf7d0', '✓'],
    warn: ['#fef9c3', '#854d0e', '#fde68a', '!'],
    na: ['#f1f5f9', '#64748b', '#e2e8f0', '?'],
  };
  function gatePill(label, status, sub) {
    const [bg, fg, , icon] = GATE_STYLE[status] || GATE_STYLE.na;
    const dk = isDark();
    const bgc = dk ? (status === 'ok' ? 'rgba(5,150,105,0.18)' : status === 'warn' ? 'rgba(217,119,6,0.18)' : 'rgba(100,116,139,0.15)') : bg;
    const fgc = dk ? (status === 'ok' ? '#6ee7b7' : status === 'warn' ? '#fcd34d' : '#94a3b8') : fg;
    return `<div class="flex-1 min-w-[3.5rem] rounded-lg px-2 py-1.5 text-center" style="background:${bgc}">`
      + `<div class="text-[0.95rem] leading-none mb-0.5" style="color:${fgc}">${icon}</div>`
      + `<div class="text-[0.62rem] font-medium" style="color:${fgc}">${label}</div>`
      + `<div class="text-[0.58rem] mt-0.5" style="color:${fgc};opacity:.85">${sub || ''}</div></div>`;
  }
  function funnelHtml(d, pol) {
    const pl = pol.purchase_limit || {}, hk = pol.hukou || {};
    // 能买
    let g1 = 'na', s1 = t('pfBuyNa');
    if (pl.status === '不限购') { g1 = 'ok'; s1 = t('pfBuyOk'); }
    else if (pl.status === '限购' || pl.status === '区域限购') { g1 = 'warn'; s1 = t('pfBuyWarn'); }
    // 划算 — show one-time deed tax magnitude (always computable for mainland)
    const deedRate = d.area > 140 ? POLICY_CONST.deed.gt140First : POLICY_CONST.deed.le140;
    const deed = (d.priceYuan || 0) * deedRate / 100;
    const g2 = 'ok', s2 = '+' + fmtCny(deed);
    // 落户
    let g3 = 'na', s3 = t('pfHukouNa');
    if (hk.threshold === '零门槛' || hk.threshold === '买房落户') { g3 = 'ok'; s3 = t('pfHukouOk'); }
    else if (hk.threshold === '积分落户' || hk.threshold === '社保年限' || hk.threshold === '稳定就业') { g3 = 'warn'; s3 = t('pfHukouWarn'); }
    // 宜居 — reuse 值得看 badge / grade signal
    const worth = worthBadge(d);
    let g4 = 'na', s4 = t('pfLiveNa');
    if (worth) { g4 = 'ok'; s4 = t('worthBadge'); }
    else {
      const grades = Object.keys(GRADE_DIMS).map((k) => gradeOf(d, k)).filter(Boolean);
      if (grades.length) { const hasC = grades.some((g) => g[0] === 'C'); g4 = hasC ? 'warn' : 'ok'; s4 = grades.filter((g) => g[0] === 'A').length + '×A'; }
    }
    // 交付 — resale = already built, no stalled-project risk
    const g5 = 'ok', s5 = t('pfDeliverOk');
    return `<div class="text-xs font-medium ${tcx().muted} mb-1.5">${t('pfTitle')}</div>`
      + `<div class="flex items-stretch gap-1.5">`
      + gatePill(t('pfBuy'), g1, s1) + gatePill(t('pfWorth'), g2, s2) + gatePill(t('pfHukou'), g3, s3)
      + gatePill(t('pfLive'), g4, s4) + gatePill(t('pfDeliver'), g5, s5) + `</div>`;
  }

  // ¥ formatter for policy/cost figures (CNY domain regardless of UI language)
  function fmtCny(yuan) {
    if (yuan == null || !isFinite(yuan)) return '—';
    if (yuan >= 10000) return '¥' + (yuan / 10000).toFixed(yuan >= 1000000 ? 0 : 1) + (isEn() ? '0k' : '万');
    return '¥' + Math.round(yuan).toLocaleString('en-US');
  }
  function tcoHtml(d, pol) {
    if (!(d.priceYuan > 0) || !(d.area > 0)) return '';
    const tc = tcx();
    const deedRate = d.area > 140 ? POLICY_CONST.deed.gt140First : POLICY_CONST.deed.le140;
    const deed = d.priceYuan * deedRate / 100;
    const upfront = d.priceYuan + deed;
    const down = (pol.loan_policy && pol.loan_policy.first_down_pct) || POLICY_CONST.downFirst;
    const loan = d.priceYuan * (1 - down / 100);
    const r = POLICY_CONST.lpr5y / 100 / 12, n = POLICY_CONST.mortgageYears * 12;
    const monthly = r > 0 ? loan * r / (1 - Math.pow(1 + r, -n)) : loan / n;
    const fee = (d.enr && d.enr.propertyFeeYuan != null) ? d.enr.propertyFeeYuan * d.area * 12 : null;
    const parts = [
      `<span>${t('tcoPrice')} <b>${fmtCny(d.priceYuan)}</b></span>`,
      `<span>${t('tcoDeed')} <b>${fmtCny(deed)}</b> <span class="${tc.muted}">(${deedRate}%·${t('tcoFirst')})</span></span>`,
      `<span class="${tc.strong}">${t('tcoTotal')} <b>${fmtCny(upfront)}</b></span>`,
    ];
    if (fee) parts.push(`<span>${t('tcoFeeYr')} <b>${fmtCny(fee)}</b></span>`);
    const mort = `<span>${t('tcoDown', { p: down })} · ${t('tcoMonthly', { y: POLICY_CONST.mortgageYears, r: POLICY_CONST.lpr5y })} <b>${t('tcoMonthlyVal', { v: fmtCny(monthly) })}</b></span>`;
    return `<div class="rounded-lg border border-slate-200 dark:border-slate-700 p-3">`
      + `<div class="text-xs font-medium ${tc.muted} mb-1.5">${t('tcoTitle')}</div>`
      + `<div class="flex flex-wrap gap-x-3 gap-y-1 text-sm ${tc.body}">${parts.join('')}</div>`
      + `<div class="mt-1.5 text-sm ${tc.body}">${mort}</div>`
      + `<p class="mt-2 text-[0.65rem] ${tc.muted} leading-relaxed">${t('tcoNote')}</p></div>`;
  }

  // ---- "why cheap" cross-reference chips ---------------------------------
  function whyChips(d, pol) {
    const tc = tcx();
    const chips = [];
    const re = pol.resource_exhausted || {}, pop = pol.population || {};
    const chip = (txt, tone) => `<span class="inline-block rounded px-1.5 py-0.5 text-[0.65rem] font-medium" style="background:${tone};color:#fff">${txt}</span>`;
    if (re.flag === true) chips.push(chip(t('whyResource'), '#7c3aed'));
    if (pop.change_pct != null && pop.change_pct <= -5) chips.push(chip(t('whyShrink', { p: Math.abs(Math.round(pop.change_pct)) }), '#0891b2'));
    if (pop.aging_65plus_pct != null && pop.aging_65plus_pct >= 20) chips.push(chip(t('whyAging', { p: Math.round(pop.aging_65plus_pct) }), '#db2777'));
    if (d.janTemp != null && d.janTemp <= -10) chips.push(chip(t('whyCold'), '#2563eb'));
    if (d.transitKm != null && d.transitKm > 60) chips.push(chip(t('whyRemote'), '#64748b'));
    if (d.hazard && d.hazard.hazards && d.hazard.hazards.some((h) => h.freq >= 5)) chips.push(chip(t('whyHazard'), '#ea580c'));
    if (d.builtYear != null && (NOW_YEAR - d.builtYear) >= 30) chips.push(chip(t('whyOld'), '#9a3412'));
    if (!chips.length) return `<div class="text-xs ${tc.muted}">${t('whyNone')}</div>`;
    return `<div class="text-xs font-medium ${tc.muted} mb-1.5">${t('whyTitle')}</div><div class="flex flex-wrap gap-1.5">${chips.join('')}</div>`;
  }

  function lmRenderPolicy(d) {
    const tc = tcx();
    const funnelEl = document.getElementById('lm-policy-funnel');
    const factsEl = document.getElementById('lm-policy-facts');
    const tcoEl = document.getElementById('lm-policy-tco');
    const whyEl = document.getElementById('lm-policy-why');
    const noteEl = document.getElementById('lm-policy-note');
    const pol = policyFor(d);
    if (!pol) {   // non-mainland (HK/TW/CA) or unmapped — no city policy regime
      funnelEl.innerHTML = '';
      factsEl.innerHTML = `<div class="${tc.muted} text-sm">${t('polNone')}</div>`;
      tcoEl.innerHTML = ''; whyEl.innerHTML = '';
      noteEl.textContent = t('polDisclaimerNone') || '';
      return;
    }
    funnelEl.innerHTML = funnelHtml(d, pol);
    // policy facts
    const rows = [];
    const pl = pol.purchase_limit;
    if (pl) rows.push(polRow(t('polPurchase'), `<b>${escP(pl.status || '—')}</b>${pl.detail ? ' · ' + polText(pl.detail) : ''}`, pl));
    const ln = pol.loan_policy;
    if (ln && (ln.first_down_pct != null || ln.recognize)) {
      const bits = [];
      if (ln.first_down_pct != null) bits.push(t('polFirstDown', { p: ln.first_down_pct }));
      if (ln.second_down_pct != null) bits.push(t('polSecondDown', { p: ln.second_down_pct }));
      if (ln.recognize) bits.push(polText(ln.recognize));
      rows.push(polRow(t('polLoan'), bits.join(' · '), ln));
    }
    const hk = pol.hukou;
    if (hk) rows.push(polRow(t('polHukou'), `<b>${escP(hk.threshold || '—')}</b>${hk.detail ? ' · ' + polText(hk.detail) : ''}`, hk));
    const sub = pol.subsidy;
    if (sub && sub.has) {
      const bits = [(sub.kinds && sub.kinds.length) ? polText(sub.kinds.join('/')) : t('polYes')];
      if (sub.amount_note) bits.push(polText(sub.amount_note));
      rows.push(polRow(t('polSubsidy'), bits.join(' · '), sub));
    }
    const pf = pol.provident_fund;
    if (pf && (pf.max_loan_wan != null || pf.cross_city != null)) {
      const bits = [];
      if (pf.max_loan_wan != null) bits.push(t('polFundMax', { n: pf.max_loan_wan }));
      if (pf.cross_city === true) bits.push(t('polFundCross'));
      rows.push(polRow(t('polFund'), bits.join(' · '), pf));
    }
    const gp = pol.guide_price;
    if (gp && gp.has != null) rows.push(polRow(t('polGuide'), `${gp.has ? t('polYes') : t('polNo')}${gp.detail ? ' · ' + polText(gp.detail) : ''}`, gp));
    const ur = pol.urban_renewal;
    if (ur && ur.active != null) rows.push(polRow(t('polRenewal'), `${ur.active ? t('polYes') : t('polNo')}${ur.detail ? ' · ' + polText(ur.detail) : ''}`, ur));
    const re = pol.resource_exhausted;
    if (re && re.flag != null) rows.push(polRow(t('polResource'), `<b>${re.flag ? t('polYes') : t('polNo')}</b>${re.ndrc_batch ? ' · ' + polText(re.ndrc_batch) : ''}`, re));
    const pop = pol.population;
    if (pop && pop.pop_2020 != null) {
      const bits = [`${(pop.pop_2020 / 10000).toFixed(1)}万`];
      if (pop.change_pct != null) bits.push((pop.change_pct >= 0 ? '+' : '') + pop.change_pct + '%');
      if (pop.aging_65plus_pct != null) bits.push(t('lmAging') + ' ' + pop.aging_65plus_pct + '%');
      rows.push(polRow(t('polPop'), bits.join(' · '), pop));
    }
    if (pol.property_tax_pilot === true) rows.push(polRow(t('polTax'), t('polYes'), null));
    const factRows = rows.filter(Boolean);
    factsEl.innerHTML = factRows.length
      ? `<details class="rounded-lg border border-slate-200 dark:border-slate-700">`
        + `<summary class="cursor-pointer px-3 py-2 text-xs font-medium ${tc.muted} marker:text-slate-400 dark:marker:text-slate-500">${t('polFactsTitle')} · ${factRows.length} ${t('polFactsItems')}</summary>`
        + `<div class="px-3 pb-1 pt-0">${factRows.join('')}</div></details>`
      : '';
    tcoEl.innerHTML = tcoHtml(d, pol);
    whyEl.innerHTML = whyChips(d, pol);
    noteEl.textContent = t('polDisclaimer');
  }

  // ---- national policy panel (section #policy) ---------------------------
  const NP_LABELS = [
    { kw: 'LPR', zh: 'LPR 房贷基准利率', en: 'LPR mortgage rate' },
    { kw: '认房', zh: '认房不认贷', en: 'Recognize-home-not-loan' },
    { kw: '首付', zh: '首付比例下限', en: 'Down-payment floor' },
    { kw: '契税', zh: '契税分档', en: 'Deed-tax brackets' },
    { kw: '增值税', zh: '增值税(转让)', en: 'VAT on resale' },
    { kw: '个人所得税', zh: '个税·满五唯一', en: 'Income tax (5y-sole)' },
    { kw: '房地产税', zh: '房地产税立法', en: 'Property-tax legislation' },
    { kw: '户籍', zh: '户籍改革·落户', en: 'Hukou reform' },
    { kw: '保交', zh: '保交楼·白名单', en: 'Project delivery / whitelist' },
  ];
  function npLabel(topic) {
    const hit = NP_LABELS.find((x) => topic.indexOf(x.kw) >= 0);
    if (hit) return isEn() ? hit.en : hit.zh;
    return escP(topic.split(/[—（(:：]/)[0].slice(0, 16));
  }
  function renderNationalPolicy() {
    const grid = document.getElementById('national-policy-grid');
    if (!grid) return;
    const tc = tcx();
    const topics = Object.keys(NP);
    if (!topics.length) { grid.innerHTML = `<div class="${tc.muted} text-sm">—</div>`; return; }
    // stable display order by NP_LABELS, unknowns last
    const order = (tp) => { const i = NP_LABELS.findIndex((x) => tp.indexOf(x.kw) >= 0); return i < 0 ? 99 : i; };
    topics.sort((a, b) => order(a) - order(b));
    grid.innerHTML = topics.map((topic) => {
      const o = NP[topic] || {};
      const facts = (o.key_facts || []).slice(0, 4).map((f) => `<li>${polText(f)}</li>`).join('');
      return `<details class="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">`
        + `<summary class="cursor-pointer px-3 py-2 text-sm font-medium ${tc.strong} marker:text-slate-400 dark:marker:text-slate-500">${npLabel(topic)} <span class="font-normal align-middle">${confChip(o)}</span></summary>`
        + `<div class="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-700/60">`
        + `<ul class="list-disc list-inside space-y-0.5 text-xs ${tc.body} leading-relaxed">${facts}</ul>`
        + `<div class="mt-1">${srcLink(o)}</div></div></details>`;
    }).join('');
    const asof = document.getElementById('np-asof');
    if (asof) asof.textContent = t('npAsOf', { d: CP.asOf || '2026-06' });
    const dis = document.getElementById('np-disclaimer');
    if (dis) dis.textContent = t('npDisclaimer');
  }

  // ---- 各省市政策横向对比 (#policy compare tab) --------------------------
  function confDot(f) {
    if (!f || !f.confidence) return '';
    const c = f.confidence;
    return `<span title="${escP(t('conf' + c.charAt(0).toUpperCase() + c.slice(1)) + ' · ' + t('polAsOf') + ' ' + (f.as_of || '?'))}" style="width:6px;height:6px;border-radius:50%;background:${CONF_DOT[c] || CONF_DOT.unknown};display:inline-block;margin-left:4px;vertical-align:middle"></span>`;
  }
  const _prefShort = (s) => String(s || '').replace(/(市|地区|盟)$/, '');
  const PP_COLS = [
    { key: 'city', lk: 'ppColCity', f: null, get: (r) => { const ps = _prefShort(r.pref); return ps === r.prov ? r.prov : r.prov + '·' + ps; }, sv: (r) => r.prov + r.pref },
    { key: 'purchase', lk: 'ppColPurchase', f: (r) => r.p.purchase_limit, get: (r) => (r.p.purchase_limit || {}).status || '—', sv: (r) => (r.p.purchase_limit || {}).status || '~' },
    { key: 'down', lk: 'ppColDown', f: (r) => r.p.loan_policy, get: (r) => { const v = (r.p.loan_policy || {}).first_down_pct; return v != null ? v + '%' : '—'; }, sv: (r) => { const v = (r.p.loan_policy || {}).first_down_pct; return v == null ? 999 : v; } },
    { key: 'hukou', lk: 'ppColHukou', f: (r) => r.p.hukou, get: (r) => (r.p.hukou || {}).threshold || '—', sv: (r) => (r.p.hukou || {}).threshold || '~' },
    { key: 'subsidy', lk: 'ppColSubsidy', f: (r) => r.p.subsidy, get: (r) => { const s = r.p.subsidy || {}; return s.has == null ? '—' : (s.has ? t('polYes') : t('polNo')); }, sv: (r) => { const s = r.p.subsidy || {}; return s.has === true ? 0 : s.has === false ? 1 : 2; } },
    { key: 'resource', lk: 'ppColResource', f: (r) => r.p.resource_exhausted, get: (r) => { const x = r.p.resource_exhausted || {}; return x.flag == null ? '—' : (x.flag ? t('polYes') : t('polNo')); }, sv: (r) => { const x = r.p.resource_exhausted || {}; return x.flag === true ? 0 : x.flag === false ? 1 : 2; } },
    { key: 'pop', lk: 'ppColPop', f: (r) => r.p.population, get: (r) => { const pp = r.p.population || {}; return pp.change_pct != null ? ((pp.change_pct >= 0 ? '+' : '') + pp.change_pct + '%') : '—'; }, sv: (r) => { const pp = r.p.population || {}; return pp.change_pct == null ? 9999 : pp.change_pct; } },
  ];
  const ppState = { sort: 'city', dir: 1, prov: '', tab: 'national' };
  function ppData() {
    const bp = CP.byPref || {};
    return Object.keys(bp).map((k) => { const i = k.indexOf('|'); return { prov: k.slice(0, i), pref: k.slice(i + 1), p: bp[k] || {} }; });
  }
  function renderPolicyCompare() {
    const tbl = document.getElementById('pp-compare-table');
    if (!tbl) return;
    const tc = tcx();
    let rows = ppData();
    if (ppState.prov) rows = rows.filter((r) => r.prov === ppState.prov);
    const col = PP_COLS.find((c) => c.key === ppState.sort) || PP_COLS[0];
    rows.sort((a, b) => { const av = col.sv(a), bv = col.sv(b); return (av < bv ? -1 : av > bv ? 1 : 0) * ppState.dir; });
    const arrow = (k) => (k === ppState.sort ? (ppState.dir > 0 ? ' ▲' : ' ▼') : '');
    const head = PP_COLS.map((c) => `<th data-pp-sort="${c.key}" class="cursor-pointer select-none text-left font-medium ${c.key === ppState.sort ? tc.strong : tc.muted} px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">${t(c.lk)}${arrow(c.key)}</th>`).join('');
    const body = rows.map((r) => '<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30">' + PP_COLS.map((c) => {
      const v = c.get(r), f = c.f ? c.f(r) : null;
      const cls = c.key === 'city' ? tc.strong + ' font-medium' : tc.body;
      return `<td class="px-2 py-1 border-b border-slate-100 dark:border-slate-700/50 ${cls} whitespace-nowrap">${escP(v)}${f ? confDot(f) : ''}</td>`;
    }).join('') + '</tr>').join('');
    tbl.innerHTML = `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;
    tbl.querySelectorAll('[data-pp-sort]').forEach((th) => { th.onclick = () => { const k = th.dataset.ppSort; if (ppState.sort === k) ppState.dir *= -1; else { ppState.sort = k; ppState.dir = 1; } renderPolicyCompare(); }; });
    const sel = document.getElementById('pp-prov-filter');
    if (sel) {
      const provs = [...new Set(ppData().map((r) => r.prov))].sort();
      sel.innerHTML = `<option value="">${t('ppAllProv')}</option>` + provs.map((p) => `<option value="${escP(p)}"${p === ppState.prov ? ' selected' : ''}>${escP(p)}</option>`).join('');
      sel.onchange = () => { ppState.prov = sel.value; renderPolicyCompare(); };
    }
    const note = document.getElementById('pp-compare-note');
    if (note) note.textContent = t('ppCompareNote');
    const title = document.getElementById('pp-compare-title');
    if (title) title.textContent = t('ppCompareTitle');
  }
  function stylePpTabs() {
    document.querySelectorAll('[data-pp-tab]').forEach((b) => {
      b.textContent = t(b.dataset.ppTab === 'national' ? 'ppTabNational' : 'ppTabCompare');
      styleTab(b, b.dataset.ppTab === ppState.tab, 'pp-tab');
    });
  }
  function refreshPolicySection() {
    stylePpTabs();
    if (ppState.tab === 'compare') renderPolicyCompare(); else renderNationalPolicy();
  }
  function ppShowTab(tab) {
    ppState.tab = tab;
    document.querySelectorAll('[data-pp-pane]').forEach((p) => p.classList.toggle('hidden', p.dataset.ppPane !== tab));
    refreshPolicySection();
  }

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

  // 一楼盘多价格 (同坐标多套在售) — window.HOUSING_OFFERS[id], cheapest 单价 first.
  function lmRenderOffers(d) {
    const box = document.getElementById('lm-offers');
    if (!box) return;
    const offers = (window.HOUSING_OFFERS || {})[String(d.id)] || [];
    if (!offers.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    const tc = tcx();
    const rows = offers.map((o) => {
      const info = [o.layout, o.orientation, o.floorNote].filter(Boolean).join(' · ');
      const src = o.sourceUrl
        ? ` <a href="${o.sourceUrl}" target="_blank" rel="noopener" class="text-emerald-600 dark:text-emerald-400 hover:underline" title="${t('offersSource')}">↗</a>`
        : '';
      return `<tr class="border-t border-slate-100 dark:border-slate-700/60">`
        + `<td class="py-1 pr-3 ${tc.strong} whitespace-nowrap font-medium">${fmtWan(o.priceWan, d.prov)}</td>`
        + `<td class="py-1 pr-3 ${tc.body} whitespace-nowrap">${fmtArea(o.area)}</td>`
        + `<td class="py-1 pr-3 ${tc.body} whitespace-nowrap">${fmtUnit(o.unitPrice)}</td>`
        + `<td class="py-1 pr-3 ${tc.muted}">${info || '—'}</td>`
        + `<td class="py-1 ${tc.muted} whitespace-nowrap text-right">${o.updated || ''}${src}</td></tr>`;
    }).join('');
    box.classList.remove('hidden');
    box.innerHTML = `<details class="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">`
      + `<summary class="cursor-pointer px-3 py-2 text-sm font-medium ${tc.strong} marker:text-slate-400 dark:marker:text-slate-500">`
      + `${t('offersTitle')} <span class="font-normal ${tc.muted}">· ${offers.length} ${t('offersUnit')}</span></summary>`
      + `<div class="px-3 pb-3 pt-1 overflow-x-auto"><table class="w-full text-xs">`
      + `<thead><tr class="${tc.muted} text-left">`
      + `<th class="font-normal pr-3 pb-1">${t('offersColTotal')}</th>`
      + `<th class="font-normal pr-3 pb-1">${t('offersColArea')}</th>`
      + `<th class="font-normal pr-3 pb-1">${t('offersColUnit')}</th>`
      + `<th class="font-normal pr-3 pb-1">${t('offersColInfo')}</th>`
      + `<th class="font-normal pb-1 text-right">${t('offersColUpdated')}</th></tr></thead>`
      + `<tbody>${rows}</tbody></table>`
      + `<p class="mt-2 text-[11px] ${tc.muted}">${t('offersNote')}</p></div></details>`;
  }

  function lmSubHtml(d, e) {
    return `${trProv(d.prov)} · ${trCity(d.city)}${d.dist ? ' · ' + trDist(d.dist) : ''} &nbsp;|&nbsp; ${isEn() ? 'Total' : '总价'} ${fmtWanD(d)} · ${fmtArea(d.area)} · ${trCl(d.climateType || '')} `
      + `<span class="ml-1 inline-block rounded px-1.5 py-0.5 text-xs ${tcx().badge}">${t('lmGeo')} ${trGeo(e.geoLabel) || '?'}</span>`;
  }

  function openListing(id) {
    const d = DATA.find((x) => x.id === id);
    if (!d || !d.enr) return;
    lmCurrent = d; lmActiveTab = 'sat'; lmTabInit = {};
    const e = d.enr;
    document.getElementById('lm-title').textContent = cityLabel(d);
    document.getElementById('lm-sub').innerHTML = lmSubHtml(d, e);
    safeRun('lmRenderOffers', () => lmRenderOffers(d));
    const tabs = { sat: t('lmSat'), near: t('lmNear'), climate: t('lmClimate'), policy: t('lmPolicy') };
    document.querySelectorAll('[data-lm-tab]').forEach((b) => { b.textContent = tabs[b.dataset.lmTab]; });
    updateCmpModalBtn();
    const shareBtn = document.getElementById('lm-share');
    if (shareBtn) shareBtn.textContent = t('lmShare');
    document.getElementById('listing-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    lmShowTab('sat');
    // shareable deep link (#l=<id>); replaceState keeps section anchors usable
    try {
      if (window.history && window.history.replaceState) window.history.replaceState(null, '', '#l=' + id);
    } catch (e) { /* file:// or sandbox without history */ }
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
    } else if (tab === 'policy') {
      lmRenderPolicy(d);
    }
  }

  function lmRenderNearList(d) {
    const e = d.enr, pois = e.pois || {};
    const locName = I18N().communityName ? I18N().communityName(d.loc, d.name_en) : d.loc;
    const items = Object.keys(POI_META_KEYS).map((cat) => {
      const m = poiMeta(cat);
      if (cat === 'community') {
        return `<div class="flex items-center gap-2"><span class="${tcx().body} truncate">${nearPoiSwatch(m)} <b>${m.label}</b> ${locName}</span></div>`;
      }
      const p = cat === 'hospital' ? hospitalPoi(e) : pois[cat];
      if (!p) return `<div class="flex items-center gap-2 ${tcx().muted}">${nearPoiSwatch(m)}${m.label}: —</div>`;
      const dk = fmtKm(p.distKm);
      const tag = p.source === 'research' ? ` <span class="text-[10px] text-amber-500 dark:text-amber-400" title="${t('poiResearch')}">${t('poiResearch')}</span>` : '';
      const tk = cat === 'train' ? trainKindTag(p) : '';
      const noPin = (p.lat == null && p.distKm == null && p.name) ? ` <span class="text-[10px] ${tcx().muted}">${t('poiUnlocated')}</span>` : '';
      return `<div class="flex items-center gap-2"><span class="${tcx().body} truncate">${nearPoiSwatch(m)} <b>${m.label}</b> ${p.name || ''}${tk} <span class="${tcx().muted}">${dk}</span>${tag}${noPin}</span></div>`;
    });
    document.getElementById('lm-near-list').innerHTML = items.join('');
  }

  function lmInitNear(d) {
    const e = d.enr;
    lmNearMap = L.map('lm-near-map', { scrollWheelZoom: true }).setView([e.lat, e.lng], 11);
    L.tileLayer(TILE_STREET, { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(lmNearMap);
    const pts = [[e.lat, e.lng]];
    const locName = I18N().communityName ? I18N().communityName(d.loc, d.name_en) : d.loc;
    const pois = e.pois || {};
    Object.keys(POI_META_KEYS).forEach((cat) => {
      const m = poiMeta(cat);
      if (cat === 'community') {
        L.circleMarker([e.lat, e.lng], nearPoiMarkerOpts(m)).addTo(lmNearMap).bindPopup(`${m.label}: ${locName}`);
        return;
      }
      const p = cat === 'hospital' ? hospitalPoi(e) : pois[cat];
      if (p && p.lat != null && p.lng != null) {
        pts.push([p.lat, p.lng]);
        L.circleMarker([p.lat, p.lng], nearPoiMarkerOpts(m)).addTo(lmNearMap).bindPopup(`${m.label}: ${p.name || ''}${p.trainKind ? ' (' + (p.trainKind === 'highspeed' ? t('poiTrainHSR') : t('poiTrainRegular')) + ')' : ''}<br/>${fmtKm(p.distKm)}`);
      }
    });
    lmRenderNearList(d);
    if (pts.length > 1) lmNearMap.fitBounds(pts, { padding: [28, 28], maxZoom: 13 });
    setTimeout(() => lmNearMap.invalidateSize(), 60);
  }

  // 9-band daily-mean temperature strip (WeatherSpark-style), drawn above the
  // climate chart in the modal. Bands are fixed °C thresholds so two listings'
  // strips are directly comparable.
  const BAND_THRESH = [-9, 0, 7, 13, 18, 24, 28, 33];
  const BAND_COLORS = ['#312e81', '#3730a3', '#2563eb', '#38bdf8', '#67e8f9', '#34d399', '#fbbf24', '#f97316', '#dc2626'];
  const bandIdx = (v) => { let i = 0; while (i < BAND_THRESH.length && v >= BAND_THRESH[i]) i++; return i; };
  function drawBandStrip(d) {
    const cv = document.getElementById('lm-band-canvas');
    if (!cv || !cv.getContext || !d.daily || !d.daily.curve || !d.daily.curve.tmean) return;
    const ctx = cv.getContext('2d');
    if (!ctx || !ctx.fillRect) return;   // smoke stub: getContext() -> {}
    const cssW = (cv.parentElement && cv.parentElement.clientWidth) || 640;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(18 * dpr);
    cv.style.width = cssW + 'px'; cv.style.height = '18px';
    const tm = d.daily.curve.tmean;
    const w = cv.width / 365;
    for (let i = 0; i < 365; i++) {
      ctx.fillStyle = BAND_COLORS[bandIdx(tm[i])];
      ctx.fillRect(Math.floor(i * w), 0, Math.ceil(w) + 1, cv.height);
    }
    ctx.fillStyle = 'rgba(15,23,42,0.35)';
    let acc = 0;
    for (let m = 0; m < 11; m++) { acc += _DIM[m]; ctx.fillRect(Math.round(acc / 365 * cv.width), 0, 1, cv.height); }
  }

  // hard-facts block at the top of the climate tab: grades, 值得看 checklist
  // badge, one-line climate summary, money facts, temperature bands.
  function lmFactsHtml(d) {
    const tc = tcx();
    const rows = [];
    const badges = [gradeChips(d), worthBadge(d)].filter(Boolean).join(' ');
    if (badges) rows.push(`<div class="flex flex-wrap items-center gap-1.5">${badges}</div>`);
    const cs = climateSummary(d);
    if (cs) rows.push(`<div class="${tc.body}">${cs}</div>`);
    const money = [`${t('lmUnit')} ${fmtUnit(d.unitPrice)}`];
    const pct = cohortCheaperPct(d);
    if (pct != null) money.push(t('lmCohort', { p: pct }));
    const lease = leaseLeftOf(d);
    if (lease != null) money.push(t('lmLease', { n: lease }) + (d.builtYearApprox ? t('lmLeaseApprox') : ''));
    rows.push(`<div class="${tc.muted} text-xs">${money.join(' · ')}</div>`);
    // environment line: PM2.5 (1km satellite bake) + extended daily-climate counts
    const eo = d.enr || {};
    const env = [];
    if (eo.pm25Annual != null) {
      const tip = (t('lmPm25Tip') + (eo.pm25Src ? ' · ' + eo.pm25Src : '')).replace(/"/g, '&quot;');
      env.push(`<span title="${tip}">${t('lmPm25', { y: eo.pm25Year || '' })} <b>${eo.pm25Annual}</b> µg/m³`
        + (eo.pm25Heating != null ? ` · ${t('lmPm25Heating')} <b>${eo.pm25Heating}</b>` : '') + '</span>');
    }
    if (d.sunshineHours != null) env.push(`${t('lmSun')} ${fmtInt(d.sunshineHours)}h`);
    if (d.humidDayCount != null) env.push(`${t('lmHumid')} ${d.humidDayCount}${t('daySuffix')}`);
    if (d.snowDayCount != null) env.push(`${t('lmSnow')} ${d.snowDayCount}${t('daySuffix')}`);
    if (d.windyDayCount != null) env.push(`${t('lmWindy')} ${d.windyDayCount}${t('daySuffix')}`);
    if (env.length) rows.push(`<div class="${tc.muted} text-xs">${env.join(' · ')}</div>`);
    // demographics line: 七普 vs 六普 population trend + aging (prefecture-level bake)
    const dg = eo.demographics;
    if (dg && dg.popChangePct != null) {
      const tip = ((dg.headline || '') + (dg.notes ? '\n' + dg.notes : '')
        + (dg.sources && dg.sources.length ? '\n' + dg.sources.join('\n') : '')).replace(/"/g, '&quot;');
      const badge = dg.popChangePct <= -5
        ? `<span class="inline-block rounded px-1.5 py-0.5 text-[0.65rem] font-medium mr-1" style="background:#fee2e2;color:#b91c1c">${t('lmShrink')}</span>`
        : '';
      const aging = dg.aging65Plus != null ? ` · ${t('lmAging')} ${(dg.aging65Plus * 100).toFixed(1)}%` : '';
      rows.push(`<div class="${tc.muted} text-xs"><span title="${tip}">${badge}`
        + `${t('lmPopTrend', { p: (dg.popChangePct > 0 ? '+' : '') + dg.popChangePct })}${aging}</span></div>`);
    }
    if (d.daily && d.daily.curve && d.daily.curve.tmean) {
      const names = t('bandNames');
      const legend = BAND_COLORS.map((c, i) =>
        `<span class="inline-flex items-center gap-1 whitespace-nowrap"><span class="inline-block w-2 h-2 rounded-sm" style="background:${c}"></span>${names[i]}</span>`).join(' ');
      rows.push(`<div><div class="text-[0.65rem] ${tc.muted} mb-1">${t('lmBandTitle')}</div><canvas id="lm-band-canvas"></canvas>`
        + `<div class="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[0.6rem] ${tc.muted}">${legend}</div></div>`);
    }
    return rows.join('');
  }

  function lmRenderClimate(d) {
    const e = d.enr, risk = e.risk, cl = e.climate;
    const tc = tcx();
    const facts = document.getElementById('lm-facts');
    if (facts) {
      facts.innerHTML = lmFactsHtml(d);
      setTimeout(() => safeRun('drawBandStrip', () => drawBandStrip(d)), 0);
    }
    const histLine = (d.histTempMax != null || d.histTempMin != null)
      ? `<div class="mt-2 text-sm ${tc.body}"><span class="font-medium ${tc.strong}">${t('histTempTitle')}</span>: `
        + `${t('histTempMaxTitle')} ${d.histTempMax == null ? '—' : fmtTemp(d.histTempMax)}`
        + ` · ${t('histTempMinTitle')} ${d.histTempMin == null ? '—' : fmtTemp(d.histTempMin)}`
        + (d.histTempLevel ? `<span class="${tc.muted}"> · ${trHistLevel(d.histTempLevel)}</span>` : '')
        + (d.histTempStation && (!isEn() || !/[\u4e00-\u9fff]/.test(d.histTempStation))
          ? `<span class="${tc.muted}"> · ${d.histTempStation}</span>` : '')
        + (histTempNoteDisplay(d) ? `<span class="${tc.muted} text-xs block mt-0.5">${histTempNoteDisplay(d)}</span>` : '')
        + `</div>`
      : '';
    const riskLine = risk
      ? `<span class="font-medium ${tc.strong}">${t('climateRiskTitle')}</span>: ${trRisk(risk.summary)} · <strong class="${tc.body}">${trCl(d.climateType) || '—'}</strong> (${t('swingLabel')} ${d.tempRange == null ? '—' : fmtSwing(d.tempRange)}: ${t('coldestMonth')} ${fmtTemp(d.tMin)} / ${t('hottestMonth')} ${fmtTemp(d.tMax)}; ${t('comfortLabel')} ${comfortRangeOf(d)} / ${t('extremeLabel')} ${extremeRangeOf(d)})`
      : '';
    let heatLine = '';
    if (d.heating) {
      const [bg, fg] = HEATING_STYLE[d.heating] || ['#f1f5f9', '#475569'];
      heatLine = `<div class="mt-2 text-sm"><span class="font-medium ${tc.strong}">${t('winterHeating')}</span>: `
        + `<span class="inline-block rounded px-1.5 py-0.5 text-xs font-medium" style="background:${bg};color:${fg}">${trHeat(d.heating)}</span>`
        + `<span class="${tc.muted} ml-1">${trHeatNote(d.heatingNote)}</span></div>`;
    }
    let hazLine = '';
    if (d.hazard) {
      const tags = d.hazard.hazards.map((h) => {
        const note = trHNoteEn(h.note);
        const title = note ? ` title="${note.replace(/"/g, '&quot;')}"` : '';
        return `<span class="inline-block rounded px-1.5 py-0.5 text-xs ${tc.body}" style="background:${tc.hazardBg}"${title}>${trHz(h.type)} · ${trFc(h.freq)}</span>`;
      }).join(' ');
      const headEn = trHeadEn(d.hazard.headline);
      hazLine = `<div class="mt-3"><span class="font-medium ${tc.strong}">${trProv(d.prov)} ${t('hazardOverview')}</span>`
        + (headEn ? `<span class="${tc.muted}"> (${headEn})</span>` : '')
        + `<div class="mt-1.5 flex flex-wrap gap-1.5">${tags}</div></div>`;
    }
    document.getElementById('lm-risk').innerHTML = (riskLine || `<span class="${tc.muted}">${t('noRiskData')}</span>`) + histLine + heatLine + hazLine;
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
      const monthLbl = isEn() ? I18N().MONTH_EN : null;
      const labels = Array.from({ length: 365 }, (_, i) => {
        let m = 0, x = i + 1; while (x > _DIM[m]) { x -= _DIM[m]; m += 1; }
        return x === 1 ? (monthLbl ? monthLbl[m] : (m + 1) + '月') : '';
      });
      lmClimateChart = new Chart(ctxEl, {
        type: 'line',
        data: { labels, datasets: [
          { label: t('chartHigh'), data: chartTempArr(dy.curve.tmax), borderColor: 'rgba(220,38,38,0.3)', borderWidth: 1, pointRadius: 0, tension: 0.3 },
          { label: t('chartLow'), data: chartTempArr(dy.curve.tmin), borderColor: 'rgba(37,99,235,0.3)', borderWidth: 1, pointRadius: 0, tension: 0.3 },
          { label: t('chartMeanComfort'), data: chartTempArr(dy.curve.tmean), borderColor: '#64748b', borderWidth: 2.5, pointRadius: 0, tension: 0.3, segment: { borderColor: segColor } },
        ] },
        options: {
          responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
          plugins: { legend: { labels: { boxWidth: 12, font: { size: 10 } } },
            tooltip: {
              callbacks: {
                title: (it) => doyToDate(((it[0] && it[0].dataIndex) || 0) + 1),
                label: (it) => `${it.dataset.label}: ${isEn() ? Math.round(it.parsed.y) + '°F' : fmtTemp(it.parsed.y)}`,
              },
            },
          },
          scales: {
            y: { title: { display: true, text: tempAxis() }, grid: { color: themeGrid() } },
            x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, font: { size: 10 } } },
          },
        },
      });
      return;
    }
    if (!cl) return;
    const M = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    const pick = (i) => M.map((m) => (cl[m] ? cl[m][i] : (cl[+m] ? cl[+m][i] : null)));
    const mNames = isEn() && I18N().MONTH_EN ? I18N().MONTH_EN : M.map((m) => m + '月');
    lmClimateChart = new Chart(document.getElementById('lm-climate-chart'), {
      data: {
        labels: mNames,
        datasets: [
          { type: 'bar', label: t('chartPrecip'), data: chartPrecipArr(pick(3)), yAxisID: 'yP', backgroundColor: 'rgba(14,165,233,0.35)', borderColor: '#0ea5e9', borderWidth: 1, borderRadius: 3, order: 3 },
          { type: 'line', label: t('chartMeanTemp'), data: chartTempArr(pick(0)), yAxisID: 'yT', borderColor: '#059669', backgroundColor: '#059669', tension: 0.35, pointRadius: 2, order: 1 },
          { type: 'line', label: t('chartMeanHigh'), data: chartTempArr(pick(1)), yAxisID: 'yT', borderColor: 'rgba(220,38,38,0.5)', borderDash: [4, 3], pointRadius: 0, tension: 0.35, order: 2 },
          { type: 'line', label: t('chartMeanLow'), data: chartTempArr(pick(2)), yAxisID: 'yT', borderColor: 'rgba(37,99,235,0.5)', borderDash: [4, 3], pointRadius: 0, tension: 0.35, order: 2 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { boxWidth: 12, font: { size: 11 } } } },
        scales: {
          yT: { position: 'left', title: { display: true, text: tempAxis() }, grid: { color: themeGrid() } },
          yP: { position: 'right', title: { display: true, text: precipAxis() }, grid: { display: false }, beginAtZero: true },
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
    try {
      if (window.history && window.history.replaceState && /^#l=\d+$/.test(window.location.hash || '')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch (e) { /* file:// or sandbox without history */ }
  }

  // ---- compare drawer (2-3 listings, plain-language deltas) ----------------
  const cmp = new Set();
  const CMP_ROW_KEYS = ['priceWan', 'area', 'unitPrice', 'rent', 'climateType', 'janTemp', 'julTemp',
    'comfortMonths', 'extremeMonths', 'annualPrecip', 'elevation', 'heating',
    'hospitalKm', 'transitKm', 'airportKm', 'coastKm', 'builtAge', 'hazard'];
  function cmpItems() {
    // tier guard: hidden benchmark rows never render in the drawer either
    return [...cmp].map((id) => DATA.find((d) => d.id === id))
      .filter((d) => d && d.enr && (tier1On || !isDefaultHidden(d))).slice(0, 3);
  }
  function updateCmpFab() {
    const fab = document.getElementById('cmp-fab');
    if (!fab) return;
    fab.textContent = t('cmpFab', { n: cmp.size });
    fab.title = cmp.size < 2 ? t('cmpNeedTwo') : '';
    fab.classList.toggle('hidden', cmp.size === 0);
  }
  function updateCmpModalBtn() {
    const b = document.getElementById('lm-compare');
    if (!b) return;
    b.textContent = lmCurrent && cmp.has(lmCurrent.id) ? t('cmpRemove') : t('cmpAdd');
  }
  function cmpToggle(id) {
    if (cmp.has(id)) cmp.delete(id);
    else if (cmp.size < 3) cmp.add(id);
    updateCmpFab(); updateCmpModalBtn();
    safeRun('renderTable', renderTable);   // refresh card +对比 button states
    saveUiPrefs();
  }
  function cmpDeltas(items) {
    if (items.length < 2) return '';
    const [A, B] = items;
    const an = cityLabel(A), bn = cityLabel(B);
    const lines = [];
    lines.push(t('cmpDeltaBuy', { a: an, x: (100000 / A.unitPrice).toFixed(1), b: bn, y: (100000 / B.unitPrice).toFixed(1) }));
    if (A.janTemp != null && B.janTemp != null && Math.round(Math.abs(A.janTemp - B.janTemp)) >= 1) {
      const [w, c] = A.janTemp >= B.janTemp ? [an, bn] : [bn, an];
      lines.push(t('cmpDeltaWinter', { a: w, b: c, d: Math.abs(A.janTemp - B.janTemp).toFixed(1) }));
    }
    if (A.julTemp != null && B.julTemp != null && Math.round(Math.abs(A.julTemp - B.julTemp)) >= 1) {
      const [w, c] = A.julTemp <= B.julTemp ? [an, bn] : [bn, an];
      lines.push(t('cmpDeltaSummer', { a: w, b: c, d: Math.abs(A.julTemp - B.julTemp).toFixed(1) }));
    }
    if (A.comfortDayCount != null && B.comfortDayCount != null && A.comfortDayCount !== B.comfortDayCount) {
      const [m, l] = A.comfortDayCount >= B.comfortDayCount ? [an, bn] : [bn, an];
      lines.push(t('cmpDeltaComfort', { a: m, b: l, d: Math.abs(A.comfortDayCount - B.comfortDayCount) }));
    }
    const tc = tcx();
    return `<div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/80 space-y-1 text-sm ${tc.body}">`
      + lines.map((l) => `<div>· ${l}</div>`).join('') + '</div>';
  }
  function renderCmpDrawer() {
    const body = document.getElementById('cmp-body');
    if (!body) return;
    const items = cmpItems();
    const tc = tcx();
    document.getElementById('cmp-title').textContent = t('cmpTitle');
    document.getElementById('cmp-clear').textContent = t('cmpClear');
    if (items.length < 2) { body.innerHTML = `<div class="${tc.muted}">${t('cmpNeedTwo')}</div>`; return; }
    const GT = `grid-template-columns: 6rem repeat(${items.length}, minmax(8.5rem, 1fr))`;
    const head = `<div class="grid gap-2 items-end pb-2 border-b border-slate-100 dark:border-slate-700/80" style="${GT}"><div></div>`
      + items.map((d) => `<div class="font-medium ${tc.strong} text-xs leading-snug cursor-pointer" data-open="${d.id}" role="button">${cityLabel(d)}</div>`).join('') + '</div>';
    const rows = CMP_ROW_KEYS.map((k) => {
      const c = COLS.find((x) => x.key === k);
      if (!c) return '';
      // bold the best value on numeric rows (direction: lower is better for
      // price/extreme/distances, higher for comfort/built year)
      const betterDir = { priceWan: 1, unitPrice: 1, extremeMonths: 1, hospitalKm: 1, transitKm: 1, airportKm: 1, coastKm: 1, comfortMonths: -1, builtAge: -1, area: -1 }[k] || 0;
      let bestIdx = -1;
      if (betterDir && items.length > 1) {
        const vals = items.map((d) => c.get(d));
        if (vals.every((v) => v != null && isFinite(v))) {
          let best = 0;
          vals.forEach((v, i) => { if ((v - vals[best]) * betterDir < 0) best = i; });
          if (vals.some((v) => v !== vals[best])) bestIdx = best;
        }
      }
      return `<div class="grid gap-2 items-center py-1.5 border-b border-slate-50 dark:border-slate-700/40" style="${GT}">`
        + `<div class="text-[0.65rem] uppercase tracking-wide ${tc.muted}">${colLabel(c)}</div>`
        + items.map((d, i) => `<div class="text-xs ${tc.body}${i === bestIdx ? ' font-semibold' : ''}">${i === bestIdx ? '✓ ' : ''}${c.cell(d)}</div>`).join('')
        + '</div>';
    }).join('');
    body.innerHTML = head + rows + cmpDeltas(items);
  }
  function openCmp() {
    if (cmpItems().length < 2) return;
    renderCmpDrawer();
    const m = document.getElementById('cmp-modal');
    if (m) m.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    try {
      if (window.history && window.history.replaceState) window.history.replaceState(null, '', '#c=' + [...cmp].join(','));
    } catch (e) { /* sandbox */ }
  }
  function closeCmp() {
    const m = document.getElementById('cmp-modal');
    if (!m || m.classList.contains('hidden')) return;
    m.classList.add('hidden');
    document.body.style.overflow = '';
    try {
      if (window.history && window.history.replaceState && /^#c=/.test(window.location.hash || '')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch (e) { /* sandbox */ }
  }

  // ---- UI preferences (localStorage housing-ui-prefs) ----------------------
  // lang / theme / quiz-rent stay on housing-lang, housing-theme, housing-rent.
  // URL hashes #q= #l= #c= override stored quiz / compare on load.
  const UI_PREFS_KEY = 'housing-ui-prefs';
  const UI_GROUP_KEYS = new Set(['live', 'infra', 'risk', 'invest', 'avoid']);
  const QZ_BUDGETS = new Set([0, 5, 10, 15, 20]);

  function saveUiPrefs() {
    try {
      localStorage.setItem(UI_PREFS_KEY, JSON.stringify({
        tier1On: !!tier1On,
        sortKey: tstate.sortKey,
        sortDir: tstate.sortDir,
        prov: tstate.prov || '',
        q: tstate.q || '',
        groups: [...tstate.groups],
        chips: [...tstate.chips],
        avoidSeen: true, // 'avoid' group migration flag (see loadUiPrefs)
        rankKey,
        provMetric,
        dimKey,
        baseKey,
        cmp: [...cmp],
        quiz: {
          budget: qz.budget, winter: qz.winter, summer: qz.summer, hazard: qz.hazard,
          heat: !!qz.heat, coast: !!qz.coast, alt: !!qz.alt, rail: !!qz.rail, hsr: !!qz.hsr,
          airport: !!qz.airport, hospital: !!qz.hospital, avoidLulu: !!qz.avoidLulu,
        },
      }));
    } catch (e) { /* private mode / quota */ }
  }

  function loadUiPrefs() {
    try {
      const raw = localStorage.getItem(UI_PREFS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (!p || typeof p !== 'object') return;
      const hash = (window.location && window.location.hash) || '';

      if (typeof p.tier1On === 'boolean') tier1On = p.tier1On;

      if (typeof p.sortKey === 'string' && COLS.some((c) => c.key === p.sortKey)) {
        tstate.sortKey = p.sortKey;
      }
      if (p.sortDir === 1 || p.sortDir === -1) tstate.sortDir = p.sortDir;
      if (typeof p.prov === 'string') tstate.prov = p.prov;
      if (typeof p.q === 'string') tstate.q = p.q.trim().toLowerCase().slice(0, 200);

      if (Array.isArray(p.groups)) {
        const gs = p.groups.filter((k) => UI_GROUP_KEYS.has(k));
        if (gs.length) tstate.groups = new Set(gs);
        // One-time migration: surface the new 'avoid' (环境规避) group for users
        // whose stored prefs predate it. After the next save the avoidSeen flag
        // is set, so an explicit toggle-off then persists normally.
        if (!p.avoidSeen) tstate.groups.add('avoid');
      }
      if (Array.isArray(p.chips)) {
        tstate.chips = new Set(p.chips.filter((k) => FILTERS[k]));
      }

      if (typeof p.rankKey === 'string' && RANK_METRICS[p.rankKey]) rankKey = p.rankKey;
      if (typeof p.provMetric === 'string' && PROV_METRICS[p.provMetric]) provMetric = p.provMetric;
      if (typeof p.dimKey === 'string' && MAP_DIMS[p.dimKey]) dimKey = p.dimKey;
      if (typeof p.baseKey === 'string' && BASE_LABEL_KEYS[p.baseKey]) baseKey = p.baseKey;

      if (!/^#c=/.test(hash) && Array.isArray(p.cmp)) {
        cmp.clear();
        p.cmp.filter((id) => Number.isFinite(+id)).slice(0, 3).forEach((id) => {
          const d = DATA.find((x) => x.id === +id);
          if (d && d.enr) cmp.add(+id);
        });
      }

      if (!/^#q=/.test(hash) && p.quiz && typeof p.quiz === 'object') {
        const u = p.quiz;
        if (QZ_BUDGETS.has(+u.budget)) qz.budget = +u.budget;
        [0, 1, 2].forEach((n) => {
          if (u.winter === n) qz.winter = n;
          if (u.summer === n) qz.summer = n;
          if (u.hazard === n) qz.hazard = n;
        });
        if (typeof u.heat === 'boolean') qz.heat = u.heat;
        if (typeof u.coast === 'boolean') qz.coast = u.coast;
        if (typeof u.alt === 'boolean') qz.alt = u.alt;
        if (typeof u.rail === 'boolean') qz.rail = u.rail;
        if (typeof u.hsr === 'boolean') qz.hsr = u.hsr;
        if (typeof u.airport === 'boolean') qz.airport = u.airport;
        if (typeof u.hospital === 'boolean') qz.hospital = u.hospital;
        if (typeof u.avoidLulu === 'boolean') qz.avoidLulu = u.avoidLulu;
      }
    } catch (e) { /* corrupt JSON */ }
  }

  // ---- share card: 750×1000 PNG rendered offscreen, downloaded on click ----
  // Fixed dark branding regardless of page theme; CJK-safe char-level wrap.
  function scWrap(ctx, text, x, y, maxW, lh, maxLines) {
    const chars = String(text || '').split('');
    let line = '', lines = 1;
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (line && ctx.measureText(line + ch).width > maxW) {
        if (maxLines && lines >= maxLines) { line = line.slice(0, -1) + '…'; break; }
        ctx.fillText(line, x, y); y += lh; line = ch; lines++;
      } else line += ch;
    }
    if (line) ctx.fillText(line, x, y);
    return y;
  }
  function scRR(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function scBands(ctx, d, x, y, w, h) {
    if (!d.daily || !d.daily.curve || !d.daily.curve.tmean) return false;
    const tm = d.daily.curve.tmean, dw = w / 365;
    for (let i = 0; i < 365; i++) {
      ctx.fillStyle = BAND_COLORS[bandIdx(tm[i])];
      ctx.fillRect(x + Math.floor(i * dw), y, Math.ceil(dw) + 1, h);
    }
    ctx.fillStyle = 'rgba(15,23,42,0.45)';
    let acc = 0;
    for (let m = 0; m < 11; m++) { acc += _DIM[m]; ctx.fillRect(x + Math.round(acc / 365 * w), y, 1, h); }
    return true;
  }
  function scRanges(ctx, ranges, color, x, y, w, h) {
    ctx.fillStyle = '#334155'; ctx.fillRect(x, y, w, h);
    (ranges || []).flatMap(([s, e]) => (s <= e ? [[s, e]] : [[s, 365], [1, e]])).forEach(([s, e]) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + (s - 1) / 365 * w, y, Math.max(2, (e - s + 1) / 365 * w), h);
    });
  }
  function shareCard(d) {
    const cv = document.createElement('canvas');
    cv.width = 750; cv.height = 1000;
    const ctx = cv.getContext && cv.getContext('2d');
    if (!ctx || !ctx.fillRect || !ctx.measureText) return;
    const W = 750, H = 1000, PAD = 48, F = (wt, s) => `${wt} ${s}px 'PingFang SC','Microsoft YaHei','Inter',sans-serif`;
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#059669'; ctx.fillRect(0, 0, W, 10);
    ctx.fillStyle = '#94a3b8'; ctx.font = F(500, 22);
    ctx.fillText(t('shareEyebrow'), PAD, 84);
    ctx.fillStyle = '#f8fafc'; ctx.font = F(600, 46);
    const name = I18N().communityName ? I18N().communityName(d.loc, d.name_en) : d.loc;
    let y = scWrap(ctx, name, PAD, 150, W - PAD * 2, 58, 2);
    ctx.fillStyle = '#94a3b8'; ctx.font = F(400, 26);
    ctx.fillText([trProv(d.prov), trCity(d.city), trDist(d.dist)].filter(Boolean).join(' · '), PAD, y + 44);
    y += 44;
    ctx.fillStyle = '#34d399'; ctx.font = F(700, 84);
    ctx.fillText(fmtWanD(d), PAD, y + 110);
    ctx.fillStyle = '#cbd5e1'; ctx.font = F(400, 28);
    ctx.fillText(`${fmtUnit(d.unitPrice)} · ${fmtArea(d.area)}`, PAD, y + 158);
    y += 158;
    ctx.fillStyle = '#e2e8f0'; ctx.font = F(400, 26);
    y = scWrap(ctx, climateSummary(d), PAD, y + 58, W - PAD * 2, 38, 3);
    // temperature bands + comfort/extreme strips
    y += 36;
    ctx.fillStyle = '#64748b'; ctx.font = F(400, 20);
    if (scBands(ctx, d, PAD, y + 10, W - PAD * 2, 34)) {
      ctx.fillText(t('lmBandTitle').split('（')[0], PAD, y);
      y += 10 + 34 + 18;
    }
    if (d.daily && d.daily.comfortDays) {
      ctx.fillStyle = '#64748b'; ctx.fillText(t('shareComfortStrip'), PAD, y + 8);
      scRanges(ctx, d.daily.comfortDays, '#059669', PAD, y + 16, W - PAD * 2, 20);
      if (d.daily.extremeDays && d.daily.extremeDays.length) scRanges(ctx, d.daily.extremeDays, '#dc2626', PAD, y + 16, W - PAD * 2, 20);
      y += 16 + 20 + 20;
    }
    // grade chips
    let gx = PAD; y += 28;
    Object.keys(GRADE_DIMS).forEach((k) => {
      const g = gradeOf(d, k);
      if (!g) return;
      const [bg, fg] = gradeStyle(g);
      const label = `${t(GRADE_DIMS[k].labelKey)} ${g}`;
      ctx.font = F(500, 24);
      const tw = ctx.measureText(label).width + 28;
      if (gx + tw > W - PAD) return;
      ctx.fillStyle = bg; scRR(ctx, gx, y - 26, tw, 40, 9); ctx.fill();
      ctx.fillStyle = fg; ctx.fillText(label, gx + 14, y + 2);
      gx += tw + 12;
    });
    // top hazards
    if (d.hazard && d.hazard.hazards && d.hazard.hazards.length) {
      ctx.fillStyle = '#94a3b8'; ctx.font = F(400, 24);
      const hz = d.hazard.hazards.slice(0, 3).map((h) => `${trHz(h.type)}(${trFs(h.freqShort) || trFl(h.freqLabel)})`).join(' · ');
      y = scWrap(ctx, t('shareHazards') + hz, PAD, y + 64, W - PAD * 2, 34, 2);
    }
    // footer
    ctx.fillStyle = '#475569'; ctx.fillRect(PAD, H - 96, W - PAD * 2, 1);
    ctx.fillStyle = '#64748b'; ctx.font = F(400, 22);
    ctx.fillText(`qrost.github.io/demos/china-housing/#l=${d.id}`, PAD, H - 52);
    const a = document.createElement('a');
    a.download = `china-housing-${d.id}.png`;
    a.href = cv.toDataURL('image/png');
    a.click();
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
    if (c) c.textContent = isEn() ? `${sc.length} listings` : `${sc.length} 套`;
    const nProv = new Set(sc.map((d) => d.prov)).size;
    if (p) p.textContent = isEn() ? `${nProv} provinces / municipalities` : `${nProv} 个省 / 直辖市`;
  }

  // ---- theme toggle (dark mode) ------------------------------------------
  function refreshModalTheme() {
    if (!lmCurrent) return;
    const d = lmCurrent, e = d.enr;
    document.getElementById('lm-sub').innerHTML = lmSubHtml(d, e);
    safeRun('lmRenderOffers', () => lmRenderOffers(d));
    lmStyleTabs(lmActiveTab);
    if (lmActiveTab === 'near' && lmTabInit.near) safeRun('lmRenderNearList', () => lmRenderNearList(d));
    if (lmActiveTab === 'climate') safeRun('lmRenderClimate', () => lmRenderClimate(d));
    if (lmActiveTab === 'policy') safeRun('lmRenderPolicy', () => lmRenderPolicy(d));
  }

  function applyLangToUI() {
    if (I18N().applyStaticI18n) I18N().applyStaticI18n();
    safeRun('syncHeroCounts', syncHeroCounts);
    safeRun('refreshPolicySection', refreshPolicySection);
    applyThemeToCharts();
  }

  function applyThemeToCharts() {
    chartBase();  // refresh Chart.js global color tokens
    safeRun('renderKPIs', renderKPIs);
    safeRun('renderScatter', renderScatter);
    safeRun('renderRankings', renderRankings);
    safeRun('renderProvinceChart', renderProvinceChart);
    safeRun('renderTable', renderTable);
    safeRun('renderQuiz', renderQuiz);
    safeRun('updateCmpFab', updateCmpFab);
    safeRun('updateCmpModalBtn', updateCmpModalBtn);
    safeRun('cmpDrawerRefresh', () => {
      const m = document.getElementById('cmp-modal');
      if (m && m.classList && !m.classList.contains('hidden')) renderCmpDrawer();
    });
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
    safeRun('refreshPolicySection', refreshPolicySection);
  }

  function wireLangToggle() {
    const btn = document.getElementById('lang-toggle');
    if (!btn || !I18N().toggleLang) return;
    I18N().onLangChange(() => { applyLangToUI(); });
    btn.addEventListener('click', () => {
      const toEn = !isEn();
      I18N().toggleLang();
      if (toEn) I18N().fetchExchangeRate().then(() => applyThemeToCharts());
    });
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
    loadUiPrefs();
    chartBase();
    if (I18N().applyStaticI18n) I18N().applyStaticI18n();
    if (I18N().fetchPageBuiltAt) I18N().fetchPageBuiltAt();
    if (I18N().fetchExchangeRate) {
      I18N().fetchExchangeRate().then(() => { rebuildPriceFields(); refreshViews(); });
    }
    safeRun('syncHeroCounts', syncHeroCounts);
    // table + interaction wiring first — must survive chart/map failures
    safeRun('wireTable', wireTable);
    safeRun('renderTable', renderTable);
    safeRun('wireQuiz', wireQuiz);
    safeRun('renderQuiz', renderQuiz);

    document.querySelectorAll('[data-rank]').forEach((b) =>
      b.addEventListener('click', () => { rankKey = b.dataset.rank; safeRun('renderRankings', renderRankings); saveUiPrefs(); }));
    document.querySelectorAll('[data-prov]').forEach((b) =>
      b.addEventListener('click', () => { provMetric = b.dataset.prov; safeRun('renderProvinceChart', renderProvinceChart); saveUiPrefs(); }));
    document.querySelectorAll('[data-dim]').forEach((b) =>
      b.addEventListener('click', () => { dimKey = b.dataset.dim; safeRun('renderMap', renderMap); dimTabs(); saveUiPrefs(); }));
    document.querySelectorAll('[data-base]').forEach((b) =>
      b.addEventListener('click', () => {
        baseKey = b.dataset.base;
        if (baseKey !== 'none') prefetchFieldFineIfNeeded();
        safeRun('renderMap', renderMap);
        baseTabs();
        saveUiPrefs();
      }));

    safeRun('renderKPIs', renderKPIs);
    safeRun('renderScatter', renderScatter);
    safeRun('renderRankings', renderRankings);
    safeRun('renderProvinceChart', renderProvinceChart);
    safeRun('initPolicySection', () => {
      document.querySelectorAll('[data-pp-tab]').forEach((b) => b.addEventListener('click', () => ppShowTab(b.dataset.ppTab)));
      ppShowTab('national');
    });

    const zi = document.getElementById('map-zoom-in'), zo = document.getElementById('map-zoom-out'), zr = document.getElementById('map-zoom-reset');
    if (zi) zi.addEventListener('click', () => zoomBy(1.45));
    if (zo) zo.addEventListener('click', () => zoomBy(1 / 1.45));
    if (zr) zr.addEventListener('click', zoomReset);

    const lmClose = document.getElementById('lm-close');
    const lmOverlay = document.getElementById('lm-overlay');
    const lmPanel = document.getElementById('lm-panel');
    if (lmClose) lmClose.addEventListener('click', closeModal);
    if (lmOverlay) lmOverlay.addEventListener('click', closeModal);
    if (lmPanel) lmPanel.addEventListener('click', (e) => e.stopPropagation());
    wireListingOpens();
    document.querySelectorAll('[data-lm-tab]').forEach((b) =>
      b.addEventListener('click', () => lmShowTab(b.dataset.lmTab)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeCmp(); } });

    wireThemeToggle();
    wireLangToggle();
    initMap();

    const tier1Toggle = document.getElementById('tier1-toggle');
    if (tier1Toggle) {
      tier1Toggle.checked = tier1On;
      tier1Toggle.addEventListener('change', () => {
        tier1On = tier1Toggle.checked;
        refreshViews();
        saveUiPrefs();
      });
    }

    // compare + share wiring
    const lmCmp = document.getElementById('lm-compare');
    if (lmCmp) lmCmp.addEventListener('click', () => { if (lmCurrent) cmpToggle(lmCurrent.id); });
    const lmShare = document.getElementById('lm-share');
    if (lmShare) lmShare.addEventListener('click', () => { if (lmCurrent) safeRun('shareCard', () => shareCard(lmCurrent)); });
    const fab = document.getElementById('cmp-fab');
    if (fab) fab.addEventListener('click', () => openCmp());
    const cmpClose = document.getElementById('cmp-close');
    const cmpOverlay = document.getElementById('cmp-overlay');
    const cmpPanel = document.getElementById('cmp-panel');
    const cmpClear = document.getElementById('cmp-clear');
    if (cmpClose) cmpClose.addEventListener('click', closeCmp);
    if (cmpOverlay) cmpOverlay.addEventListener('click', closeCmp);
    if (cmpPanel) cmpPanel.addEventListener('click', (e) => e.stopPropagation());
    if (cmpClear) cmpClear.addEventListener('click', () => { cmp.clear(); updateCmpFab(); updateCmpModalBtn(); closeCmp(); safeRun('renderTable', renderTable); saveUiPrefs(); });
    const cmpBody = document.getElementById('cmp-body');
    if (cmpBody) cmpBody.addEventListener('click', (e) => {
      const row = e.target.closest('[data-open]');
      if (row) { closeCmp(); openListing(+row.dataset.open); }
    });
    safeRun('updateCmpFab', updateCmpFab);

    // deep link: #l=<id> opens the listing modal (shareable URLs). Hidden
    // benchmark rows stay hidden — a deep link must not bypass the tier filter.
    try {
      const hm = (window.location && window.location.hash || '').match(/^#l=(\d+)$/);
      if (hm) {
        const d = DATA.find((x) => x.id === +hm[1]);
        if (d && d.enr && (tier1On || !isDefaultHidden(d))) {
          setTimeout(() => safeRun('deepLinkOpen', () => openListing(d.id)), 80);
        }
      }
      // deep link: #c=1,2,3 restores a comparison set (tier-guarded in cmpItems)
      const hc = (window.location && window.location.hash || '').match(/^#c=([\d,]+)$/);
      if (hc) {
        hc[1].split(',').map(Number).filter((n) => isFinite(n)).slice(0, 3).forEach((id) => {
          const d = DATA.find((x) => x.id === id);
          if (d && d.enr && !isDefaultHidden(d)) cmp.add(id);
        });
        updateCmpFab();
        if (cmpItems().length >= 2) setTimeout(() => safeRun('deepLinkCmp', openCmp), 120);
      }
    } catch (e) { /* sandbox without location */ }
    saveUiPrefs();
  }

  // smoke-test hooks
  window.__tier1On = () => tier1On;
  window.__setTier1On = (v) => { tier1On = !!v; refreshViews(); };
  window.__getLang = () => (I18N().getLang ? I18N().getLang() : 'zh');
  window.__setLang = (l) => { if (I18N().setLang) { I18N().setLang(l, true); applyLangToUI(); } };
  window.__cityLabel = (d) => cityLabel(d);
  window.__tempComfortColor = (c) => tempComfortColor(c);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
