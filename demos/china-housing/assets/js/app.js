/**
 * China small-city housing dashboard.
 *
 * Reads window.HOUSING_LISTINGS (assets/data/listings.js), derives per-listing
 * metrics, and renders: KPI cards, a price↔rent scatter (Chart.js), switchable
 * ranking bars, a per-province aggregation bar, an ECharts China choropleth
 * (degrades gracefully if the lib or GeoJSON fails to load), and an
 * interactive sort/filter/search table with CSV export.
 *
 * Derived metrics (all from raw priceWan / area / rent):
 *   priceYuan = priceWan × 10000           total ask, RMB
 *   unitPrice = priceYuan / area           单价, RMB / m²
 *   rentYear  = rent × 12                  annual rent, RMB
 *   yieldPct  = rentYear / priceYuan × 100 毛租金回报率 (gross yield), %
 *   payback   = priceYuan / rentYear       回本年限, years (ignoring costs)
 */
(function () {
  'use strict';

  // ---- palette -----------------------------------------------------------
  const C = {
    emerald: '#059669',
    emeraldSoft: 'rgba(5,150,105,0.55)',
    slate900: '#0f172a',
    slate500: '#64748b',
    slate300: '#cbd5e1',
    slate200: '#e2e8f0',
    grid: 'rgba(100,116,139,0.12)',
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
  const DATA = RAW.map((d) => {
    const priceYuan = d.priceWan * 10000;
    const rentYear = d.rent * 12;
    return {
      ...d,
      priceYuan,
      unitPrice: priceYuan / d.area,
      rentYear,
      yieldPct: (rentYear / priceYuan) * 100,
      payback: priceYuan / rentYear,
    };
  });

  // ---- formatting --------------------------------------------------------
  const trim = (s) => s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  const fmtWan = (v) => trim(v.toFixed(2)) + '万';
  const fmtInt = (v) => Math.round(v).toLocaleString('en-US');
  const fmtPct = (v) => v.toFixed(1) + '%';
  const fmtYrs = (v) => v.toFixed(1);
  const cityLabel = (d) => `${d.city.replace(/市$/, '')}·${d.loc}`;

  function median(arr) {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // Linear RGB interpolation slate-300 → emerald-600 for the yield colour ramp.
  function lerpColor(t) {
    const a = [203, 213, 225], b = [5, 150, 105];
    const c = a.map((x, i) => Math.round(x + (b[i] - x) * Math.max(0, Math.min(1, t))));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  // ---- KPI cards ---------------------------------------------------------
  function renderKPIs() {
    const provinces = new Set(DATA.map((d) => d.prov));
    const cheapest = DATA.reduce((a, b) => (b.priceWan < a.priceWan ? b : a));
    const bestYield = DATA.reduce((a, b) => (b.yieldPct > a.yieldPct ? b : a));
    const cards = [
      { label: '房源样本', value: DATA.length, unit: '套', sub: '社区级二手房挂牌' },
      { label: '覆盖省份', value: provinces.size, unit: '省/市', sub: '东北 → 华南' },
      { label: '最低总价', value: fmtWan(cheapest.priceWan), sub: cityLabel(cheapest) },
      { label: '总价中位数', value: fmtWan(median(DATA.map((d) => d.priceWan))), sub: '半数低于此价' },
      { label: '单价中位数', value: fmtInt(median(DATA.map((d) => d.unitPrice))), unit: '元/㎡', sub: '挂牌单价中位' },
      { label: '最高毛回报', value: fmtPct(bestYield.yieldPct), sub: `${cityLabel(bestYield)} · 回本${fmtYrs(bestYield.payback)}年` },
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

  // Shared pill-tab styling for the ranking + map metric switchers.
  function styleTab(b, on, base) {
    b.className = `${base} px-3 py-1.5 rounded-md text-xs font-medium transition-colors ` +
      (on ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-900');
  }
  function labelTabs() {
    document.querySelectorAll('[data-rank]').forEach((b) => {
      b.textContent = RANK_METRICS[b.dataset.rank].label;
      styleTab(b, b.dataset.rank === rankKey, 'rank-tab');
    });
    document.querySelectorAll('[data-map]').forEach((b) => {
      b.textContent = MAP_METRICS[b.dataset.map].label;
      styleTab(b, b.dataset.map === mapKey, 'map-tab');
    });
  }

  let scatterChart, rankChart, provChart;

  // ---- scatter: 总价 × 月租, coloured by gross yield ----------------------
  function renderScatter() {
    const ctx = document.getElementById('scatter-chart');
    if (!ctx || !window.Chart) return;
    const yMin = Math.min(...DATA.map((d) => d.yieldPct));
    const yMax = Math.max(...DATA.map((d) => d.yieldPct));
    const norm = (y) => (y - yMin) / (yMax - yMin || 1);
    const points = DATA.map((d) => ({ x: d.priceWan, y: d.rent, d }));
    scatterChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          data: points,
          parsing: false,
          pointRadius: 5,
          pointHoverRadius: 8,
          backgroundColor: points.map((p) => lerpColor(norm(p.d.yieldPct))),
          borderColor: 'rgba(255,255,255,0.85)',
          borderWidth: 1,
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
                  `总价 ${fmtWan(d.priceWan)} · ${d.area}㎡`,
                  `月租 ${fmtInt(d.rent)}元 · 单价 ${fmtInt(d.unitPrice)}元/㎡`,
                  `毛回报 ${fmtPct(d.yieldPct)} · 回本 ${fmtYrs(d.payback)}年`,
                ];
              },
            },
          },
        },
        scales: {
          x: { title: { display: true, text: '二手房总价（万元）' }, grid: { color: C.grid }, ticks: { callback: (v) => v + '万' } },
          y: { title: { display: true, text: '月租（元）' }, grid: { color: C.grid }, beginAtZero: true },
        },
      },
    });
  }

  // ---- ranking bars (switchable metric) ----------------------------------
  const RANK_METRICS = {
    cheap:   { label: '总价最低',   key: 'priceWan',  dir: 1,  axis: '总价（万元）',   fmt: fmtWan },
    unit:    { label: '单价最低',   key: 'unitPrice', dir: 1,  axis: '单价（元/㎡）',   fmt: (v) => fmtInt(v) },
    yield:   { label: '回报率最高', key: 'yieldPct',  dir: -1, axis: '毛租金回报率（%）', fmt: fmtPct },
    payback: { label: '回本最快',   key: 'payback',   dir: 1,  axis: '回本年限（年）',   fmt: fmtYrs },
  };
  let rankKey = 'yield';

  function renderRankings() {
    const ctx = document.getElementById('rank-chart');
    if (!ctx || !window.Chart) return;
    const m = RANK_METRICS[rankKey];
    // Top 15, rank #1 first. Chart.js horizontal bars draw index 0 at the top,
    // so the #1 listing sits at the top and bars descend from there.
    const top = [...DATA].sort((a, b) => (a[m.key] - b[m.key]) * m.dir).slice(0, 15);
    const labels = top.map((d, i) => `${i + 1}. ${cityLabel(d)}`);
    const values = top.map((d) => d[m.key]);
    const maxV = Math.max(...values);
    const cfg = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: values.map((v) => lerpColor(rankKey === 'yield' ? v / maxV : 1 - v / maxV)),
          borderRadius: 4,
          barThickness: 'flex',
          maxBarThickness: 18,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (it) => it[0].label.replace(/^\d+\.\s*/, ''),
              label: (it) => {
                const d = top[it.dataIndex];
                return [`${m.label.slice(0, 2)}：${m.fmt(d[m.key])}`,
                  `总价 ${fmtWan(d.priceWan)} · ${d.area}㎡ · 月租 ${fmtInt(d.rent)}元`];
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
    document.querySelectorAll('[data-rank]').forEach((b) => styleTab(b, b.dataset.rank === rankKey, 'rank-tab'));
  }

  // ---- province aggregation ---------------------------------------------
  function aggregateByProvince() {
    const map = new Map();
    DATA.forEach((d) => {
      if (!map.has(d.prov)) map.set(d.prov, []);
      map.get(d.prov).push(d);
    });
    return [...map.entries()].map(([prov, rows]) => {
      const avg = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
      return {
        prov, count: rows.length,
        avgPrice: avg('priceWan'), avgUnit: avg('unitPrice'),
        avgYield: avg('yieldPct'), avgRent: avg('rent'),
      };
    });
  }

  function renderProvinceChart() {
    const ctx = document.getElementById('province-chart');
    if (!ctx || !window.Chart) return;
    const agg = aggregateByProvince().sort((a, b) => b.avgUnit - a.avgUnit);
    provChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: agg.map((a) => a.prov),
        datasets: [{
          data: agg.map((a) => a.avgUnit),
          backgroundColor: C.emeraldSoft,
          borderColor: C.emerald,
          borderWidth: 1,
          borderRadius: 4,
          maxBarThickness: 22,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (it) => {
                const a = agg[it.dataIndex];
                return [`均单价 ${fmtInt(a.avgUnit)}元/㎡`,
                  `样本 ${a.count}套 · 均总价 ${fmtWan(a.avgPrice)}`,
                  `均月租 ${fmtInt(a.avgRent)}元 · 均回报 ${fmtPct(a.avgYield)}`];
              },
            },
          },
        },
        scales: {
          x: { title: { display: true, text: '样本均单价（元/㎡）' }, grid: { color: C.grid }, ticks: { callback: (v) => fmtInt(v) } },
          y: { grid: { display: false } },
        },
      },
    });
  }

  // ---- ECharts China map (graceful fallback) -----------------------------
  const MAP_METRICS = {
    count:    { label: '房源样本数', pick: (a) => a.count,    fmt: (v) => fmtInt(v) + '套' },
    avgUnit:  { label: '均单价',     pick: (a) => a.avgUnit,  fmt: (v) => fmtInt(v) + '元/㎡' },
    avgPrice: { label: '均总价',     pick: (a) => a.avgPrice, fmt: (v) => fmtWan(v) },
    avgYield: { label: '均毛回报',   pick: (a) => a.avgYield, fmt: (v) => fmtPct(v) },
  };
  let mapKey = 'avgUnit';
  let echartsMap = null;
  let mapReady = false;
  const GEO_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';

  function mapFail(msg) {
    const wrap = document.getElementById('map-wrap');
    const fb = document.getElementById('map-fallback');
    if (wrap) wrap.style.display = 'none';
    // Inline display wins over the .hidden class, so set it explicitly.
    if (fb) { fb.classList.remove('hidden'); fb.style.display = 'flex'; fb.textContent = msg; }
  }

  function renderMap() {
    if (!mapReady || !echartsMap) return;
    const agg = aggregateByProvince();
    const byProv = new Map(agg.map((a) => [a.prov, a]));
    const m = MAP_METRICS[mapKey];
    const seriesData = agg.map((a) => ({ name: PROV_FULL[a.prov] || a.prov, value: m.pick(a) }));
    const vals = seriesData.map((s) => s.value);
    echartsMap.setOption({
      tooltip: {
        trigger: 'item',
        formatter: (p) => {
          const short = Object.keys(PROV_FULL).find((k) => PROV_FULL[k] === p.name) || p.name;
          const a = byProv.get(short);
          if (!a) return `${p.name}<br/><span style="color:#94a3b8">样本外</span>`;
          return `<b>${short}</b> · ${a.count}套<br/>均总价 ${fmtWan(a.avgPrice)} · 均单价 ${fmtInt(a.avgUnit)}元/㎡<br/>均月租 ${fmtInt(a.avgRent)}元 · 均回报 ${fmtPct(a.avgYield)}`;
        },
      },
      visualMap: {
        min: Math.min(...vals), max: Math.max(...vals),
        left: 'left', bottom: 16, calculable: true,
        text: ['高', '低'], itemWidth: 12, itemHeight: 90,
        inRange: { color: ['#ecfdf5', '#6ee7b7', '#059669', '#065f46'] },
        textStyle: { color: C.slate500 },
        formatter: (v) => m.fmt(v),
      },
      series: [{
        type: 'map', map: 'china', roam: false,
        nameProperty: 'name',
        label: { show: false },
        itemStyle: { borderColor: '#fff', borderWidth: 0.6, areaColor: '#f1f5f9' },
        emphasis: { label: { show: true, color: C.slate900 }, itemStyle: { areaColor: '#fbbf24' } },
        select: { disabled: true },
        data: seriesData,
      }],
    });
    document.querySelectorAll('[data-map]').forEach((b) => styleTab(b, b.dataset.map === mapKey, 'map-tab'));
  }

  async function initMap() {
    if (!window.echarts) { mapFail('地图组件未能加载（ECharts CDN 不可达），其余图表不受影响。'); return; }
    try {
      const res = await fetch(GEO_URL, { mode: 'cors' });
      if (!res.ok) throw new Error('geojson http ' + res.status);
      const geo = await res.json();
      echarts.registerMap('china', geo);
      echartsMap = echarts.init(document.getElementById('china-map'));
      mapReady = true;
      renderMap();
      window.addEventListener('resize', () => echartsMap && echartsMap.resize());
    } catch (e) {
      mapFail('地图边界数据加载失败（网络受限），省份对比可见下方柱状图。');
    }
  }

  // ---- interactive table -------------------------------------------------
  const TABLE_COLS = [
    { key: 'id', label: '#', num: true, fmt: (d) => d.id },
    { key: 'prov', label: '省份', fmt: (d) => d.prov },
    { key: 'city', label: '城市', fmt: (d) => d.city },
    { key: 'dist', label: '区/镇', fmt: (d) => d.dist },
    { key: 'loc', label: '小区/位置', fmt: (d) => d.loc },
    { key: 'priceWan', label: '总价', num: true, fmt: (d) => fmtWan(d.priceWan) },
    { key: 'area', label: '面积㎡', num: true, fmt: (d) => trim(d.area.toFixed(1)) },
    { key: 'unitPrice', label: '单价 元/㎡', num: true, fmt: (d) => fmtInt(d.unitPrice) },
    { key: 'rent', label: '月租 元', num: true, fmt: (d) => fmtInt(d.rent) },
    { key: 'yieldPct', label: '毛回报', num: true, yield: true, fmt: (d) => fmtPct(d.yieldPct) },
    { key: 'payback', label: '回本(年)', num: true, fmt: (d) => fmtYrs(d.payback) },
    { key: 'updated', label: '更新', fmt: (d) => d.updated },
  ];
  const tstate = { sortKey: 'yieldPct', sortDir: -1, prov: '', q: '' };

  function tableView() {
    let rows = DATA.filter((d) => (!tstate.prov || d.prov === tstate.prov) &&
      (!tstate.q || (d.city + d.dist + d.loc).toLowerCase().includes(tstate.q)));
    const k = tstate.sortKey;
    rows.sort((a, b) => {
      const av = a[k], bv = b[k];
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'zh');
      return cmp * tstate.sortDir;
    });
    return rows;
  }

  const yMinT = Math.min(...DATA.map((d) => d.yieldPct));
  const yMaxT = Math.max(...DATA.map((d) => d.yieldPct));

  function renderTable() {
    const rows = tableView();
    const head = TABLE_COLS.map((c) => {
      const active = tstate.sortKey === c.key;
      const arrow = active ? (tstate.sortDir === 1 ? '▲' : '▼') : '';
      return `<th data-col="${c.key}" class="px-3 py-2.5 font-medium cursor-pointer select-none whitespace-nowrap ${c.num ? 'text-right' : 'text-left'} ${active ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700'}">${c.label}<span class="ml-0.5 text-[0.6rem]">${arrow}</span></th>`;
    }).join('');
    const body = rows.map((d) => {
      const tds = TABLE_COLS.map((c) => {
        if (c.yield) {
          const t = (d.yieldPct - yMinT) / (yMaxT - yMinT || 1);
          return `<td class="px-3 py-2 text-right tabular-nums"><span class="inline-block rounded px-1.5 py-0.5 text-xs font-medium" style="background:${lerpColor(t)};color:${t > 0.5 ? '#fff' : '#0f172a'}">${c.fmt(d)}</span></td>`;
        }
        const cls = c.num ? 'text-right tabular-nums text-slate-700' : 'text-slate-700';
        const strong = c.key === 'loc' ? ' font-medium text-slate-900' : '';
        return `<td class="px-3 py-2 ${cls}${strong} whitespace-nowrap">${c.fmt(d)}</td>`;
      }).join('');
      return `<tr class="border-t border-slate-100 hover:bg-slate-50/70">${tds}</tr>`;
    }).join('');
    document.getElementById('table-head').innerHTML = `<tr class="bg-slate-50 text-xs uppercase tracking-wider">${head}</tr>`;
    document.getElementById('table-body').innerHTML = body;
    document.getElementById('table-count').textContent = `显示 ${rows.length} / ${DATA.length} 套`;
  }

  function wireTable() {
    // province filter
    const sel = document.getElementById('prov-filter');
    const provs = [...new Set(DATA.map((d) => d.prov))];
    sel.innerHTML = `<option value="">全部省份（${DATA.length}）</option>` +
      provs.map((p) => `<option value="${p}">${p}（${DATA.filter((d) => d.prov === p).length}）</option>`).join('');
    sel.addEventListener('change', () => { tstate.prov = sel.value; renderTable(); });
    // search
    const q = document.getElementById('table-search');
    q.addEventListener('input', () => { tstate.q = q.value.trim().toLowerCase(); renderTable(); });
    // header sort (event delegation)
    document.getElementById('table-head').addEventListener('click', (e) => {
      const th = e.target.closest('[data-col]');
      if (!th) return;
      const key = th.dataset.col;
      if (tstate.sortKey === key) tstate.sortDir *= -1;
      else { tstate.sortKey = key; tstate.sortDir = (key === 'id' || key === 'prov' || key === 'city' || key === 'dist' || key === 'loc' || key === 'updated') ? 1 : -1; }
      renderTable();
    });
    // CSV export
    document.getElementById('csv-export').addEventListener('click', exportCSV);
  }

  function exportCSV() {
    const cols = [
      ['序号', (d) => d.id], ['省份', (d) => d.prov], ['城市', (d) => d.city],
      ['区/镇', (d) => d.dist], ['小区', (d) => d.loc], ['总价(万元)', (d) => d.priceWan],
      ['面积(㎡)', (d) => d.area], ['单价(元/㎡)', (d) => Math.round(d.unitPrice)],
      ['月租(元)', (d) => d.rent], ['毛回报(%)', (d) => d.yieldPct.toFixed(1)],
      ['回本(年)', (d) => d.payback.toFixed(1)], ['更新', (d) => d.updated],
    ];
    const esc = (s) => /[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s);
    const lines = [cols.map((c) => c[0]).join(',')];
    tableView().forEach((d) => lines.push(cols.map((c) => esc(c[1](d))).join(',')));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'china-small-city-housing.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---- boot --------------------------------------------------------------
  function init() {
    chartBase();
    labelTabs();
    renderKPIs();
    renderScatter();
    renderRankings();
    renderProvinceChart();
    wireTable();
    renderTable();

    document.querySelectorAll('[data-rank]').forEach((b) =>
      b.addEventListener('click', () => { rankKey = b.dataset.rank; renderRankings(); }));
    document.querySelectorAll('[data-map]').forEach((b) =>
      b.addEventListener('click', () => { mapKey = b.dataset.map; renderMap(); }));

    initMap();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
