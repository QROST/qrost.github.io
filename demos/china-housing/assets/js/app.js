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
 *   comfortScore     0–100, transparent (see methodology)
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

  // Province short form (as in the data) → full GeoJSON name (DataV / Aliyun).
  const PROV_FULL = {
    '黑龙江': '黑龙江省', '吉林': '吉林省', '辽宁': '辽宁省', '河北': '河北省',
    '河南': '河南省', '山东': '山东省', '安徽': '安徽省', '上海': '上海市',
    '江苏': '江苏省', '广东': '广东省', '广西': '广西壮族自治区', '福建': '福建省',
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

  function deriveClimate(e) {
    const cl = e && e.climate;
    if (!cl) return {};
    const rows = [];
    for (let m = 1; m <= 12; m++) { const a = moOf(cl, m); if (a) rows.push(a); }
    const jan = moOf(cl, 1), jul = moOf(cl, 7);
    const annualPrecip = rows.reduce((s, a) => s + (a[3] || 0), 0);
    const tmeans = rows.map((a) => a[0]).filter((v) => v != null);
    const annualMean = tmeans.length ? tmeans.reduce((s, v) => s + v, 0) / tmeans.length : null;
    const comfortMonths = rows.filter((a) => a[0] != null && a[0] >= 15 && a[0] <= 26).length;
    const coldMonths = rows.filter((a) => a[0] != null && a[0] < 0).length;        // freezing average month
    const hotMonths = rows.filter((a) => a[1] != null && a[1] >= 33).length;        // dominantly hot month
    const extremeMonths = coldMonths + hotMonths;
    // Transparent 0–100: 70% weight on pleasant months, 30% on absence of extremes.
    const comfortScore = Math.round(clamp(
      (comfortMonths / 12) * 70 + (1 - extremeMonths / 12) * 30, 0, 100));
    return {
      janTemp: jan ? jan[0] : null, julTemp: jul ? jul[0] : null,
      annualPrecip: Math.round(annualPrecip), annualMean,
      comfortMonths, coldMonths, hotMonths, extremeMonths, comfortScore,
    };
  }

  const DATA = RAW.map((d) => {
    const priceYuan = d.priceWan * 10000;
    const rentYear = d.rent * 12;
    const e = ENR[d.id] || ENR[String(d.id)] || null;
    const cd = deriveClimate(e);
    return {
      ...d, enr: e, hazard: HAZ[d.prov] || null,
      priceYuan, unitPrice: priceYuan / d.area, rentYear,
      yieldPct: (rentYear / priceYuan) * 100, payback: priceYuan / rentYear,
      elevation: e && e.elevation != null ? e.elevation : null,
      hospitalKm: poiKm(e, 'hospital'), trainKm: poiKm(e, 'train'),
      airportKm: poiKm(e, 'airport'), metroKm: poiKm(e, 'metro'),
      coastKm: e && e.risk ? e.risk.coastKm : poiKm(e, 'coast'),
      seismic: e && e.risk ? e.risk.seismic : null,
      typhoon: e && e.risk ? e.risk.typhoon : null,
      ...cd,
    };
  });
  const GEOCODED = DATA.filter((d) => d.enr && d.enr.lat != null);

  // ---- formatting --------------------------------------------------------
  const trim = (s) => s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  const fmtWan = (v) => trim(v.toFixed(2)) + '万';
  const fmtInt = (v) => Math.round(v).toLocaleString('en-US');
  const fmtPct = (v) => v.toFixed(1) + '%';
  const fmtYrs = (v) => v.toFixed(1);
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
  const SLATE = [203, 213, 225], EMER = [5, 150, 105], RED = [225, 60, 60], AMB = [245, 158, 11];
  const lerpColor = (t) => mix(SLATE, EMER, t);                  // legacy yield ramp
  const comfortColor = (t) => mix(RED, EMER, t);                 // 0=red(bad) → 1=green(good)
  const badColor = (t) => mix(EMER, RED, t);                     // 0=green(good) → 1=red(bad)

  // ---- KPI cards ---------------------------------------------------------
  function renderKPIs() {
    const provinces = new Set(DATA.map((d) => d.prov));
    const cheapest = DATA.reduce((a, b) => (b.priceWan < a.priceWan ? b : a));
    const climD = DATA.filter((d) => d.comfortScore != null);
    const comfiest = climD.reduce((a, b) => (b.comfortScore > a.comfortScore ? b : a), climD[0]);
    const mildest = climD.reduce((a, b) => (b.extremeMonths < a.extremeMonths ? b : a), climD[0]);
    const cards = [
      { label: '房源样本', value: DATA.length, unit: '套', sub: '社区级二手房挂牌' },
      { label: '覆盖省份', value: provinces.size, unit: '省/市', sub: '东北 → 华南' },
      { label: '最低总价', value: fmtWan(cheapest.priceWan), sub: cityLabel(cheapest) },
      { label: '单价中位数', value: fmtInt(median(DATA.map((d) => d.unitPrice))), unit: '元/㎡', sub: '挂牌单价中位' },
      { label: '气候最舒适', value: comfiest ? comfiest.comfortScore : '—', unit: '宜居分', sub: comfiest ? `${cityLabel(comfiest)} · 舒适${comfiest.comfortMonths}个月` : '—' },
      { label: '极端天气最少', value: mildest ? mildest.extremeMonths : '—', unit: '个月', sub: mildest ? `${cityLabel(mildest)} · 全年最温和` : '—' },
    ];
    document.getElementById('kpi-grid').innerHTML = cards.map((c) => `
      <div class="rounded-xl border border-slate-200 bg-white p-5">
        <div class="text-[0.7rem] font-medium uppercase tracking-[0.12em] text-slate-400">${c.label}</div>
        <div class="mt-2 flex items-baseline gap-1">
          <span class="text-2xl md:text-3xl font-semibold text-slate-900 tabular-nums">${c.value}</span>
          ${c.unit ? `<span class="text-sm text-slate-400">${c.unit}</span>` : ''}
        </div>
        <div class="mt-1 text-xs text-slate-500 truncate" title="${c.sub}">${c.sub}</div>
      </div>`).join('');
  }

  // ---- Chart.js defaults -------------------------------------------------
  function chartBase() {
    if (window.Chart) {
      Chart.defaults.font.family = "'Inter','PingFang SC','Microsoft YaHei',sans-serif";
      Chart.defaults.color = C.slate500;
    }
  }

  function styleTab(b, on, base) {
    b.className = `${base} px-3 py-1.5 rounded-md text-xs font-medium transition-colors ` +
      (on ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-900');
  }

  let scatterChart, rankChart, provChart;

  // ---- overview scatter: 总价(便宜) × 宜居指数, coloured by 极端天气 -----------
  function renderScatter() {
    const ctx = document.getElementById('scatter-chart');
    if (!ctx || !window.Chart) return;
    const pts = DATA.filter((d) => d.comfortScore != null)
      .map((d) => ({ x: d.priceWan, y: d.comfortScore, d }));
    const exMax = Math.max(1, ...pts.map((p) => p.d.extremeMonths));
    scatterChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          data: pts, parsing: false, pointRadius: 5, pointHoverRadius: 8,
          backgroundColor: pts.map((p) => badColor(p.d.extremeMonths / exMax)),
          borderColor: 'rgba(255,255,255,0.85)', borderWidth: 1,
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
                  `宜居指数 ${d.comfortScore} · 舒适${d.comfortMonths}月 · 极端${d.extremeMonths}月`,
                  `1月 ${fmtTemp(d.janTemp)} · 7月 ${fmtTemp(d.julTemp)} · 海拔 ${d.elevation == null ? '—' : fmtInt(d.elevation) + 'm'}`,
                ];
              },
            },
          },
        },
        scales: {
          x: { title: { display: true, text: '二手房总价（万元）— 越左越便宜' }, grid: { color: C.grid }, ticks: { callback: (v) => v + '万' } },
          y: { title: { display: true, text: '宜居指数（越上越舒适）' }, grid: { color: C.grid }, min: 0, max: 100 },
        },
      },
    });
  }

  // ---- ranking bars (switchable metric) ----------------------------------
  const RANK_METRICS = {
    cheap: { label: '总价最低', key: 'priceWan', dir: 1, axis: '总价（万元）', fmt: fmtWan, color: (v, n) => badColor(v / n) },
    unit: { label: '单价最低', key: 'unitPrice', dir: 1, axis: '单价（元/㎡）', fmt: (v) => fmtInt(v), color: (v, n) => badColor(v / n) },
    comfort: { label: '最宜居', key: 'comfortScore', dir: -1, axis: '宜居指数（0–100）', fmt: (v) => fmtInt(v), color: (v, n) => comfortColor(v / n) },
    mild: { label: '极端天气最少', key: 'extremeMonths', dir: 1, axis: '极端天气月数', fmt: (v) => v + '月', color: (v, n) => comfortColor(1 - v / (n || 1)) },
    yield: { label: '回报率最高', key: 'yieldPct', dir: -1, axis: '毛租金回报率（%）', fmt: fmtPct, color: (v, n) => lerpColor(v / n) },
  };
  let rankKey = 'comfort';

  function renderRankings() {
    const ctx = document.getElementById('rank-chart');
    if (!ctx || !window.Chart) return;
    const m = RANK_METRICS[rankKey];
    const pool = DATA.filter((d) => d[m.key] != null);
    const top = [...pool].sort((a, b) => (a[m.key] - b[m.key]) * m.dir).slice(0, 15);
    const labels = top.map((d, i) => `${i + 1}. ${cityLabel(d)}`);
    const values = top.map((d) => d[m.key]);
    const maxV = Math.max(...values, 1);
    const cfg = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: values.map((v) => m.color(v, maxV)),
          borderRadius: 4, barThickness: 'flex', maxBarThickness: 18,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (it) => it[0].label.replace(/^\d+\.\s*/, ''),
              label: (it) => {
                const d = top[it.dataIndex];
                return [`${m.label}：${m.fmt(d[m.key])}`,
                  `总价 ${fmtWan(d.priceWan)} · ${d.area}㎡ · 宜居 ${d.comfortScore} · 1月${fmtTemp(d.janTemp)}/7月${fmtTemp(d.julTemp)}`];
              },
            },
          },
        },
        scales: {
          x: { title: { display: true, text: m.axis }, grid: { color: C.grid }, ticks: { callback: (v) => m.fmt(v) } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    };
    if (rankChart) { rankChart.destroy(); }
    rankChart = new Chart(ctx, cfg);
    document.querySelectorAll('[data-rank]').forEach((b) => {
      b.textContent = RANK_METRICS[b.dataset.rank].label;
      styleTab(b, b.dataset.rank === rankKey, 'rank-tab');
    });
  }

  // ---- province aggregation ---------------------------------------------
  function aggregateByProvince() {
    const map = new Map();
    DATA.forEach((d) => { if (!map.has(d.prov)) map.set(d.prov, []); map.get(d.prov).push(d); });
    return [...map.entries()].map(([prov, rows]) => {
      const avg = (k) => { const xs = rows.map((r) => r[k]).filter((v) => v != null); return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null; };
      return {
        prov, count: rows.length,
        avgPrice: avg('priceWan'), avgUnit: avg('unitPrice'), avgYield: avg('yieldPct'),
        avgRent: avg('rent'), avgComfort: avg('comfortScore'), avgExtreme: avg('extremeMonths'),
      };
    });
  }

  const PROV_METRICS = {
    avgUnit: { label: '均单价', axis: '样本均单价（元/㎡）', fmt: (v) => fmtInt(v), dir: -1, color: C.emeraldSoft },
    avgPrice: { label: '均总价', axis: '样本均总价（万元）', fmt: fmtWan, dir: -1, color: C.emeraldSoft },
    avgComfort: { label: '均宜居', axis: '样本均宜居指数', fmt: (v) => fmtInt(v), dir: 1, color: 'rgba(5,150,105,0.55)' },
    avgExtreme: { label: '极端月', axis: '样本均极端天气月数', fmt: (v) => v.toFixed(1) + '月', dir: -1, color: 'rgba(225,90,60,0.5)' },
  };
  let provMetric = 'avgComfort';

  function renderProvinceChart() {
    const ctx = document.getElementById('province-chart');
    if (!ctx || !window.Chart) return;
    const m = PROV_METRICS[provMetric];
    const agg = aggregateByProvince().filter((a) => a[provMetric] != null)
      .sort((a, b) => (b[provMetric] - a[provMetric]) * (m.dir > 0 ? 1 : -1));
    const cfg = {
      type: 'bar',
      data: {
        labels: agg.map((a) => a.prov),
        datasets: [{
          data: agg.map((a) => a[provMetric]),
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
                return [`${m.label} ${m.fmt(a[provMetric])}`,
                  `样本 ${a.count}套 · 均总价 ${fmtWan(a.avgPrice)} · 均单价 ${fmtInt(a.avgUnit)}元/㎡`,
                  `均宜居 ${fmtInt(a.avgComfort)} · 均极端 ${a.avgExtreme.toFixed(1)}月`];
              },
            },
          },
        },
        scales: {
          x: { title: { display: true, text: m.axis }, grid: { color: C.grid }, ticks: { callback: (v) => m.fmt(v) } },
          y: { grid: { display: false } },
        },
      },
    };
    if (provChart) { provChart.destroy(); }
    provChart = new Chart(ctx, cfg);
    document.querySelectorAll('[data-prov]').forEach((b) => {
      b.textContent = PROV_METRICS[b.dataset.prov].label;
      styleTab(b, b.dataset.prov === provMetric, 'prov-tab');
    });
  }

  // ---- big zoomable overlay map (geo + recolourable listing points) ------
  const RAMPS = {
    cheapGood: ['#10b981', '#a7f3d0', '#fde047', '#fb923c', '#ef4444'],   // low value = green = cheap/few
    comfyHigh: ['#ef4444', '#fb923c', '#fde047', '#a7f3d0', '#10b981'],   // high value = green = comfortable
    temp: ['#1d4ed8', '#0ea5e9', '#67e8f9', '#fde047', '#fb923c', '#dc2626'],
    precip: ['#fef9c3', '#bae6fd', '#38bdf8', '#0284c7', '#1e3a8a'],
    terrain: ['#166534', '#65a30d', '#ca8a04', '#b45309', '#78350f'],
  };
  const MAP_DIMS = {
    comfortScore: { label: '宜居指数', get: (d) => d.comfortScore, fmt: (v) => fmtInt(v), ramp: 'comfyHigh', text: ['宜居', '严苛'] },
    unitPrice: { label: '单价', get: (d) => d.unitPrice, fmt: (v) => fmtInt(v) + '元/㎡', ramp: 'cheapGood', text: ['贵', '便宜'] },
    priceWan: { label: '总价', get: (d) => d.priceWan, fmt: fmtWan, ramp: 'cheapGood', text: ['贵', '便宜'] },
    janTemp: { label: '1月均温·等温', get: (d) => d.janTemp, fmt: fmtTemp, ramp: 'temp', text: ['热', '冷'] },
    julTemp: { label: '7月均温·等温', get: (d) => d.julTemp, fmt: fmtTemp, ramp: 'temp', text: ['热', '冷'] },
    annualPrecip: { label: '年降水', get: (d) => d.annualPrecip, fmt: (v) => fmtInt(v) + 'mm', ramp: 'precip', text: ['湿', '干'] },
    elevation: { label: '海拔', get: (d) => d.elevation, fmt: (v) => fmtInt(v) + 'm', ramp: 'terrain', text: ['高', '低'] },
    extremeMonths: { label: '极端天气', get: (d) => d.extremeMonths, fmt: (v) => v + '个月', ramp: 'cheapGood', text: ['多', '少'] },
  };
  let dimKey = 'comfortScore';
  let echartsMap = null, mapReady = false, baseGeoOpt = null;
  const GEO_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';

  // continuous basemap field (assets/data/field.js) — isotherm / rainfall /
  // elevation raster + isolines, drawn UNDER the listing points.
  const FIELD = window.HOUSING_FIELD || null;
  const BASE_RAMPS = {
    temp: ['#1d4ed8', '#0ea5e9', '#67e8f9', '#fde047', '#fb923c', '#dc2626'],
    terrain: ['#dcfce7', '#86efac', '#ca8a04', '#b45309', '#78350f'],
    precip: ['#fefce8', '#bae6fd', '#38bdf8', '#0284c7', '#1e3a8a'],
  };
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

  // cheaper homes render larger so affordable options pop
  const priceVals = DATA.map((d) => d.priceWan);
  const pMin = Math.min(...priceVals), pMax = Math.max(...priceVals);
  const sizeOf = (d) => 8 + (1 - clamp((d.priceWan - pMin) / (pMax - pMin || 1), 0, 1)) * 12;

  function mapFail(msg) {
    const wrap = document.getElementById('map-wrap');
    const fb = document.getElementById('map-fallback');
    if (wrap) wrap.style.display = 'none';
    if (fb) { fb.classList.remove('hidden'); fb.style.display = 'flex'; fb.textContent = msg; }
  }

  function mapSeriesData() {
    const dim = MAP_DIMS[dimKey];
    return GEOCODED.filter((d) => dim.get(d) != null).map((d) => ({
      value: [d.enr.lng, d.enr.lat, dim.get(d)], size: sizeOf(d), d,
    }));
  }

  // basemap heatmap points + isoline line items for the active field
  function baseLayers() {
    const f = (baseKey !== 'none' && FIELD && FIELD.fields) ? FIELD.fields[baseKey] : null;
    if (!f) return { heat: [], lines: [], vm: { min: 0, max: 1, ramp: 'temp' } };
    const span = (f.max - f.min) || 1;
    const lines = [];
    Object.keys(f.isolines || {}).forEach((lvl) => {
      const t = (parseFloat(lvl) - f.min) / span;
      const color = rampColorAt(f.ramp, t);
      f.isolines[lvl].forEach((seg) => lines.push({ coords: seg, lineStyle: { color } }));
    });
    return { heat: f.points, lines, vm: { min: f.min, max: f.max, ramp: f.ramp } };
  }

  function renderMap() {
    if (!mapReady || !echartsMap) return;
    const dim = MAP_DIMS[dimKey];
    const data = mapSeriesData();
    const vals = data.map((p) => p.value[2]);
    const bl = baseLayers();
    echartsMap.setOption({
      tooltip: {
        trigger: 'item',
        formatter: (p) => {
          const d = p.data && p.data.d; if (!d) return '';
          const haz = d.hazard ? d.hazard.top.join('·') : '';
          return `<b>${cityLabel(d)}</b> · ${d.enr.geoLabel || ''}<br/>`
            + `<b style="color:#059669">${dim.label} ${dim.fmt(dim.get(d))}</b><br/>`
            + `总价 ${fmtWan(d.priceWan)} · ${d.area}㎡ · 单价 ${fmtInt(d.unitPrice)}元/㎡<br/>`
            + `宜居 ${d.comfortScore} · 1月${fmtTemp(d.janTemp)}/7月${fmtTemp(d.julTemp)} · 海拔 ${d.elevation == null ? '—' : fmtInt(d.elevation) + 'm'}<br/>`
            + `医院 ${fmtKm(d.hospitalKm)} · 火车 ${fmtKm(d.trainKm)} · 地震 ${d.seismic || '—'} · 台风 ${d.typhoon || '—'}`
            + (haz ? `<br/><span style="color:#b45309">主要灾害：${haz}</span>` : '')
            + `<br/><span style="color:#10b981">点击查看卫星图 / 周边 / 气候 / 灾害</span>`;
        },
      },
      visualMap: [
        { // listing-point dimension (legend bottom-left)
          type: 'continuous', dimension: 2, seriesIndex: 0,
          min: Math.min(...vals), max: Math.max(...vals),
          left: 'left', bottom: 24, calculable: true,
          text: dim.text, itemWidth: 14, itemHeight: 120,
          inRange: { color: RAMPS[dim.ramp] }, textStyle: { color: C.slate500 },
          formatter: (v) => dim.fmt(v),
        },
        { // basemap field (drives heatmap colour) — legend rendered in HTML instead
          type: 'continuous', seriesIndex: 1, show: false,
          min: bl.vm.min, max: bl.vm.max, inRange: { color: BASE_RAMPS[bl.vm.ramp] },
        },
      ],
      series: [
        {
          type: 'scatter', coordinateSystem: 'geo', zlevel: 3,
          symbolSize: (val, params) => (params.data && params.data.size) || 9,
          itemStyle: { borderColor: 'rgba(255,255,255,0.9)', borderWidth: 1, shadowBlur: 3, shadowColor: 'rgba(15,23,42,0.3)' },
          emphasis: { scale: 1.5 },
          data,
        },
        {
          type: 'heatmap', coordinateSystem: 'geo', zlevel: 1,
          pointSize: 20, blurSize: 16, minOpacity: 0, maxOpacity: 0.62,
          data: bl.heat,
        },
        {
          type: 'lines', coordinateSystem: 'geo', zlevel: 2, polyline: true, silent: true,
          lineStyle: { width: 1, opacity: 0.45, join: 'round' },
          data: bl.lines,
        },
      ],
    });
    renderBaseLegend();
  }

  function renderBaseLegend() {
    const box = document.getElementById('base-legend');
    if (!box) return;
    const f = (baseKey !== 'none' && FIELD && FIELD.fields) ? FIELD.fields[baseKey] : null;
    if (!f) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'flex';
    const grad = (BASE_RAMPS[f.ramp] || BASE_RAMPS.temp).join(',');
    box.innerHTML = `<span class="text-xs text-slate-500 whitespace-nowrap">${f.label}底图</span>`
      + `<span class="text-[11px] text-slate-400 tabular-nums">${fmtInt(f.min)}</span>`
      + `<span class="inline-block h-2.5 w-28 rounded" style="background:linear-gradient(90deg,${grad})"></span>`
      + `<span class="text-[11px] text-slate-400 tabular-nums">${fmtInt(f.max)}${f.unit}</span>`;
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
      b.textContent = MAP_DIMS[b.dataset.dim].label;
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
      echartsMap.setOption({
        geo: {
          map: 'china', roam: true, zoom: 1, scaleLimit: { min: 1, max: 14 },
          nameProperty: 'name',
          itemStyle: { areaColor: '#f8fafc', borderColor: '#cbd5e1', borderWidth: 0.6 },
          emphasis: { itemStyle: { areaColor: '#eef2f7' }, label: { show: false } },
          select: { disabled: true },
        },
      });
      baseGeoOpt = { center: echartsMap.getOption().geo[0].center };
      mapReady = true;
      renderMap();
      dimTabs();
      baseTabs();
      echartsMap.on('click', (p) => {
        if (p && p.data && p.data.d) openListing(p.data.d.id);
      });
      window.addEventListener('resize', () => echartsMap && echartsMap.resize());
    } catch (e) {
      mapFail('地图边界数据加载失败（网络受限），省份对比可见下方柱状图，表格不受影响。');
    }
  }

  // ---- table (master data source) ----------------------------------------
  const SEISMIC_ORD = { '高': 4, '较高': 3, '中': 2, '低': 1 };
  const TYPH_ORD = { '高': 4, '中': 3, '弱': 2, '极低': 1 };
  const FREQ_COLOR = { 3: '#dc2626', 2: '#ea580c', 1: '#d97706', 0: '#94a3b8' };

  const yMinT = Math.min(...DATA.map((d) => d.yieldPct));
  const yMaxT = Math.max(...DATA.map((d) => d.yieldPct));
  const csMax = 100;
  const exMaxT = Math.max(1, ...DATA.map((d) => nz(d.extremeMonths, 0)));

  function pill(html, bg, fg) {
    return `<span class="inline-block rounded px-1.5 py-0.5 text-xs font-medium" style="background:${bg};color:${fg || '#0f172a'}">${html}</span>`;
  }
  function bandCell(level, kind) {
    if (!level) return '<span class="text-slate-300">—</span>';
    const ord = (kind === 'seismic' ? SEISMIC_ORD : TYPH_ORD)[level] || 1;
    const t = (ord - 1) / 3;
    return pill(level, mix([226, 232, 240], [225, 90, 60], t), t > 0.5 ? '#fff' : '#0f172a');
  }
  function hazardCell(d) {
    if (!d.hazard) return '<span class="text-slate-300">—</span>';
    const tags = d.hazard.hazards.slice(0, 3).map((h) =>
      `<span style="color:${FREQ_COLOR[h.freq]}">${h.type}</span>`).join('<span class="text-slate-300"> · </span>');
    const full = d.hazard.hazards.map((h) => `${h.type}(${h.freqLabel})`).join('、');
    return `<span title="${d.hazard.headline}｜${full}">${tags}</span>`;
  }
  function scoreCell(v) {
    if (v == null) return '<span class="text-slate-300">—</span>';
    const t = v / csMax;
    return pill(fmtInt(v), comfortColor(t), t > 0.5 ? '#fff' : '#0f172a');
  }
  function extremeCell(v) {
    if (v == null) return '<span class="text-slate-300">—</span>';
    const t = v / exMaxT;
    return pill(v + '月', badColor(t), t > 0.5 ? '#fff' : '#0f172a');
  }
  function yieldCell(d) {
    const t = (d.yieldPct - yMinT) / (yMaxT - yMinT || 1);
    return pill(fmtPct(d.yieldPct), lerpColor(t), t > 0.5 ? '#fff' : '#0f172a');
  }

  // group: core/price always shown; live/infra/risk/invest are toggleable.
  const COLS = [
    { key: 'id', label: '#', group: 'core', num: true, get: (d) => d.id, cell: (d) => d.id, dir: 1 },
    { key: 'prov', label: '省份', group: 'core', str: true, get: (d) => d.prov, cell: (d) => d.prov, dir: 1 },
    { key: 'city', label: '城市', group: 'core', str: true, get: (d) => d.city, cell: (d) => d.city, dir: 1 },
    { key: 'dist', label: '区/镇', group: 'core', str: true, get: (d) => d.dist, cell: (d) => d.dist, dir: 1 },
    { key: 'loc', label: '小区/位置', group: 'core', str: true, get: (d) => d.loc, cell: (d) => `<span class="font-medium text-slate-900">${d.loc}</span>` , dir: 1 },
    { key: 'priceWan', label: '总价', group: 'price', num: true, get: (d) => d.priceWan, cell: (d) => fmtWan(d.priceWan) },
    { key: 'area', label: '面积㎡', group: 'price', num: true, get: (d) => d.area, cell: (d) => trim(d.area.toFixed(1)) },
    { key: 'unitPrice', label: '单价 元/㎡', group: 'price', num: true, get: (d) => d.unitPrice, cell: (d) => fmtInt(d.unitPrice) },
    { key: 'rent', label: '月租 元', group: 'price', num: true, get: (d) => d.rent, cell: (d) => fmtInt(d.rent) },
    { key: 'comfortScore', label: '宜居指数', group: 'live', num: true, get: (d) => nz(d.comfortScore, -1), cell: (d) => scoreCell(d.comfortScore) },
    { key: 'janTemp', label: '1月均温', group: 'live', num: true, get: (d) => nz(d.janTemp, -999), cell: (d) => fmtTemp(d.janTemp) },
    { key: 'julTemp', label: '7月均温', group: 'live', num: true, get: (d) => nz(d.julTemp, -999), cell: (d) => fmtTemp(d.julTemp) },
    { key: 'comfortMonths', label: '舒适月', group: 'live', num: true, get: (d) => nz(d.comfortMonths, -1), cell: (d) => d.comfortMonths == null ? '—' : d.comfortMonths + '月' },
    { key: 'extremeMonths', label: '极端月', group: 'live', num: true, get: (d) => nz(d.extremeMonths, 99), cell: (d) => extremeCell(d.extremeMonths) },
    { key: 'annualPrecip', label: '年降水mm', group: 'live', num: true, get: (d) => nz(d.annualPrecip, -1), cell: (d) => d.annualPrecip == null ? '—' : fmtInt(d.annualPrecip) },
    { key: 'elevation', label: '海拔m', group: 'live', num: true, get: (d) => nz(d.elevation, -1), cell: (d) => d.elevation == null ? '—' : fmtInt(d.elevation) },
    { key: 'hospitalKm', label: '医院km', group: 'infra', num: true, get: (d) => nz(d.hospitalKm, 1e9), cell: (d) => fmtKm(d.hospitalKm) },
    { key: 'trainKm', label: '火车km', group: 'infra', num: true, get: (d) => nz(d.trainKm, 1e9), cell: (d) => fmtKm(d.trainKm) },
    { key: 'airportKm', label: '机场km', group: 'infra', num: true, get: (d) => nz(d.airportKm, 1e9), cell: (d) => fmtKm(d.airportKm) },
    { key: 'coastKm', label: '海岸km', group: 'infra', num: true, get: (d) => nz(d.coastKm, 1e9), cell: (d) => fmtKm(d.coastKm) },
    { key: 'seismic', label: '地震带', group: 'risk', get: (d) => SEISMIC_ORD[d.seismic] || 0, cell: (d) => bandCell(d.seismic, 'seismic') },
    { key: 'typhoon', label: '台风', group: 'risk', get: (d) => TYPH_ORD[d.typhoon] || 0, cell: (d) => bandCell(d.typhoon, 'typhoon') },
    { key: 'hazard', label: '主要灾害', group: 'risk', get: (d) => d.hazard ? d.hazard.hazards[0].freq * 10 + d.hazard.hazards.length : 0, cell: (d) => hazardCell(d) },
    { key: 'yieldPct', label: '毛回报', group: 'invest', num: true, get: (d) => d.yieldPct, cell: (d) => yieldCell(d) },
    { key: 'payback', label: '回本年', group: 'invest', num: true, get: (d) => d.payback, cell: (d) => fmtYrs(d.payback) },
    { key: '_act', label: '详情', group: 'core', act: true, cell: (d) => d.enr
      ? `<button data-open="${d.id}" class="text-emerald-700 hover:text-emerald-900 font-medium whitespace-nowrap">查看</button>`
      : '<span class="text-slate-300" title="暂无定位数据">—</span>' },
  ];
  const tstate = { sortKey: 'comfortScore', sortDir: -1, prov: '', q: '', groups: new Set(['live', 'infra', 'risk']) };

  const visibleCols = () => COLS.filter((c) => c.group === 'core' || c.group === 'price' || tstate.groups.has(c.group));

  function tableView() {
    const rows = DATA.filter((d) => (!tstate.prov || d.prov === tstate.prov) &&
      (!tstate.q || (d.city + d.dist + d.loc + d.prov).toLowerCase().includes(tstate.q)));
    const col = COLS.find((c) => c.key === tstate.sortKey) || COLS[0];
    rows.sort((a, b) => {
      const av = col.get(a), bv = col.get(b);
      const cmp = col.str ? String(av).localeCompare(String(bv), 'zh') : (av - bv);
      return cmp * tstate.sortDir;
    });
    return rows;
  }

  function renderTable() {
    const cols = visibleCols();
    const rows = tableView();
    const head = cols.map((c) => {
      if (c.act) return `<th class="px-3 py-2.5 font-medium text-right text-slate-400 whitespace-nowrap">${c.label}</th>`;
      const active = tstate.sortKey === c.key;
      const arrow = active ? (tstate.sortDir === 1 ? '▲' : '▼') : '';
      return `<th data-col="${c.key}" class="px-3 py-2.5 font-medium cursor-pointer select-none whitespace-nowrap ${c.num ? 'text-right' : 'text-left'} ${active ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700'}">${c.label}<span class="ml-0.5 text-[0.6rem]">${arrow}</span></th>`;
    }).join('');
    const body = rows.map((d) => {
      const tds = cols.map((c) => {
        if (c.act) return `<td class="px-3 py-2 text-right whitespace-nowrap">${c.cell(d)}</td>`;
        const cls = c.num ? 'text-right tabular-nums text-slate-700' : 'text-slate-700';
        return `<td class="px-3 py-2 ${cls} whitespace-nowrap">${c.cell(d)}</td>`;
      }).join('');
      return `<tr class="border-t border-slate-100 hover:bg-slate-50/70">${tds}</tr>`;
    }).join('');
    document.getElementById('table-head').innerHTML = `<tr class="bg-slate-50 text-xs uppercase tracking-wider">${head}</tr>`;
    document.getElementById('table-body').innerHTML = body;
    document.getElementById('table-count').textContent = `显示 ${rows.length} / ${DATA.length} 套`;
  }

  function styleGroupChips() {
    document.querySelectorAll('[data-group]').forEach((b) => {
      const on = tstate.groups.has(b.dataset.group);
      b.className = 'px-3 py-1.5 rounded-md text-xs font-medium transition-colors ' +
        (on ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-900');
    });
  }

  function wireTable() {
    const sel = document.getElementById('prov-filter');
    const provs = [...new Set(DATA.map((d) => d.prov))];
    sel.innerHTML = `<option value="">全部省份（${DATA.length}）</option>` +
      provs.map((p) => `<option value="${p}">${p}（${DATA.filter((d) => d.prov === p).length}）</option>`).join('');
    sel.addEventListener('change', () => { tstate.prov = sel.value; renderTable(); });

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
      ['宜居指数', (d) => d.comfortScore], ['1月均温(℃)', (d) => d.janTemp], ['7月均温(℃)', (d) => d.julTemp],
      ['舒适月数', (d) => d.comfortMonths], ['极端月数', (d) => d.extremeMonths],
      ['年降水(mm)', (d) => d.annualPrecip], ['海拔(m)', (d) => d.elevation],
      ['医院(km)', (d) => d.hospitalKm], ['火车站(km)', (d) => d.trainKm],
      ['机场(km)', (d) => d.airportKm], ['海岸(km)', (d) => d.coastKm],
      ['地震带(省级)', (d) => d.seismic], ['台风暴露', (d) => d.typhoon],
      ['主要灾害', (d) => d.hazard ? d.hazard.hazards.map((h) => `${h.type}(${h.freqLabel})`).join('、') : ''],
      ['毛回报(%)', (d) => d.yieldPct.toFixed(1)], ['回本(年)', (d) => d.payback.toFixed(1)],
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
    airport: { label: '机场', color: '#0891b2' }, hospital: { label: '医院', color: '#dc2626' },
    mall: { label: '商场', color: '#d97706' }, coast: { label: '海边', color: '#0ea5e9' },
  };
  const ZOOM_BY_LEVEL = { loc: 16, dist: 14, city: 12, prefecture: 11 };
  let lmCurrent = null, lmSatMap = null, lmNearMap = null, lmClimateChart = null, lmTabInit = {};

  function lmStyleTabs(active) {
    document.querySelectorAll('[data-lm-tab]').forEach((b) => {
      const on = b.dataset.lmTab === active;
      b.className = 'lm-tab px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' +
        (on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-900');
    });
    document.querySelectorAll('[data-lm-pane]').forEach((p) =>
      p.classList.toggle('hidden', p.dataset.lmPane !== active));
  }

  function openListing(id) {
    const d = DATA.find((x) => x.id === id);
    if (!d || !d.enr) return;
    lmCurrent = d; lmTabInit = {};
    const e = d.enr;
    document.getElementById('lm-title').textContent = cityLabel(d);
    document.getElementById('lm-sub').innerHTML =
      `${d.prov} · ${d.city}${d.dist ? ' · ' + d.dist : ''} &nbsp;|&nbsp; 总价 ${fmtWan(d.priceWan)} · ${d.area}㎡ · 宜居 ${d.comfortScore} ` +
      `<span class="ml-1 inline-block rounded bg-slate-100 text-slate-500 px-1.5 py-0.5 text-xs">定位 ${e.geoLabel || '?'}</span>`;
    const tabs = { sat: '🛰 卫星图', near: '📍 周边', climate: '🌡 气候 / 灾害' };
    document.querySelectorAll('[data-lm-tab]').forEach((b) => { b.textContent = tabs[b.dataset.lmTab]; });
    document.getElementById('listing-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    lmShowTab('sat');
  }

  function lmShowTab(tab) {
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

  function lmInitNear(d) {
    const e = d.enr;
    lmNearMap = L.map('lm-near-map', { scrollWheelZoom: true }).setView([e.lat, e.lng], 11);
    L.tileLayer(TILE_STREET, { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(lmNearMap);
    const pts = [[e.lat, e.lng]];
    L.circleMarker([e.lat, e.lng], { radius: 8, color: '#fff', weight: 2, fillColor: '#059669', fillOpacity: 1 }).addTo(lmNearMap).bindPopup('小区：' + d.loc);
    const pois = e.pois || {};
    const items = Object.keys(POI_META).map((cat) => {
      const m = POI_META[cat], p = pois[cat];
      if (!p) return `<div class="flex items-center gap-2 text-slate-400"><span class="inline-block w-2 h-2 rounded-full shrink-0" style="background:${m.color}"></span>${m.label}：—</div>`;
      const dk = fmtKm(p.distKm);
      const tag = p.source === 'research' ? ' <span class="text-[10px] text-amber-600" title="子代理调研补充">调研</span>' : '';
      if (p.lat != null && p.lng != null) {
        pts.push([p.lat, p.lng]);
        L.circleMarker([p.lat, p.lng], { radius: 6, color: '#fff', weight: 1.5, fillColor: m.color, fillOpacity: 0.95 }).addTo(lmNearMap).bindPopup(`${m.label}：${p.name || ''}<br/>${dk}`);
      }
      const noPin = (p.lat == null && p.distKm == null && p.name) ? ' <span class="text-[10px] text-slate-400">名称(未定位)</span>' : '';
      return `<div class="flex items-center gap-2"><span class="inline-block w-2 h-2 rounded-full shrink-0" style="background:${m.color}"></span><span class="text-slate-700 truncate"><b>${m.label}</b> ${p.name || ''} <span class="text-slate-400">${dk}</span>${tag}${noPin}</span></div>`;
    });
    document.getElementById('lm-near-list').innerHTML = items.join('');
    if (pts.length > 1) lmNearMap.fitBounds(pts, { padding: [28, 28], maxZoom: 13 });
    setTimeout(() => lmNearMap.invalidateSize(), 60);
  }

  function lmRenderClimate(d) {
    const e = d.enr, risk = e.risk, cl = e.climate;
    const riskLine = risk
      ? `<span class="font-medium text-slate-800">气候与风险（粗略）</span>：${risk.summary} · 宜居指数 ${d.comfortScore}（舒适 ${d.comfortMonths} 月 / 极端 ${d.extremeMonths} 月）`
      : '';
    let hazLine = '';
    if (d.hazard) {
      const tags = d.hazard.hazards.map((h) =>
        `<span class="inline-block rounded px-1.5 py-0.5 text-xs" style="background:rgba(15,23,42,0.04);color:${FREQ_COLOR[h.freq]}" title="${h.note}">${h.type} · ${h.freqLabel}</span>`).join(' ');
      hazLine = `<div class="mt-3"><span class="font-medium text-slate-800">${d.prov}省级历史灾害概况</span>` +
        `<span class="text-slate-500">（${d.hazard.headline}）</span><div class="mt-1.5 flex flex-wrap gap-1.5">${tags}</div></div>`;
    }
    document.getElementById('lm-risk').innerHTML = (riskLine || '<span class="text-slate-400">暂无风险数据</span>') + hazLine;
    if (lmClimateChart) { lmClimateChart.destroy(); lmClimateChart = null; }
    if (!cl || !window.Chart) return;
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
          yT: { position: 'left', title: { display: true, text: '℃' }, grid: { color: 'rgba(100,116,139,0.12)' } },
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
  function init() {
    chartBase();
    renderKPIs();
    renderScatter();
    renderRankings();
    renderProvinceChart();
    wireTable();
    renderTable();

    document.querySelectorAll('[data-rank]').forEach((b) =>
      b.addEventListener('click', () => { rankKey = b.dataset.rank; renderRankings(); }));
    document.querySelectorAll('[data-prov]').forEach((b) =>
      b.addEventListener('click', () => { provMetric = b.dataset.prov; renderProvinceChart(); }));
    document.querySelectorAll('[data-dim]').forEach((b) =>
      b.addEventListener('click', () => { dimKey = b.dataset.dim; renderMap(); dimTabs(); }));
    document.querySelectorAll('[data-base]').forEach((b) =>
      b.addEventListener('click', () => { baseKey = b.dataset.base; renderMap(); baseTabs(); }));
    const zi = document.getElementById('map-zoom-in'), zo = document.getElementById('map-zoom-out'), zr = document.getElementById('map-zoom-reset');
    if (zi) zi.addEventListener('click', () => zoomBy(1.45));
    if (zo) zo.addEventListener('click', () => zoomBy(1 / 1.45));
    if (zr) zr.addEventListener('click', zoomReset);

    document.getElementById('lm-close').addEventListener('click', closeModal);
    document.getElementById('lm-backdrop').addEventListener('click', closeModal);
    document.querySelectorAll('[data-lm-tab]').forEach((b) =>
      b.addEventListener('click', () => lmShowTab(b.dataset.lmTab)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    initMap();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
