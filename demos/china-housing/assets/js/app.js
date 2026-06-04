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

  // Merge baked enrichment (assets/data/enriched.js). Keyed by listing id;
  // d.enr is null until `manage.py enrich` + `build` have populated it.
  const ENR = window.HOUSING_ENRICHED || {};
  DATA.forEach((d) => { d.enr = ENR[d.id] || ENR[String(d.id)] || null; });
  const GEOCODED = DATA.filter((d) => d.enr && d.enr.lat != null);

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

  // Province boundaries: prefer the locally-vendored copy (assets/data/china-geo.js,
  // window.CHINA_GEO) so the map works offline / over file:// with no third-party
  // request; fall back to the remote Aliyun source only if the vendored file is absent.
  async function loadChinaGeo() {
    if (window.CHINA_GEO && Array.isArray(window.CHINA_GEO.features)) return window.CHINA_GEO;
    const res = await fetch(GEO_URL, { mode: 'cors' });
    if (!res.ok) throw new Error('geojson http ' + res.status);
    return res.json();
  }

  async function initMap() {
    if (!window.echarts) { mapFail('地图组件未能加载（ECharts CDN 不可达），其余图表不受影响。'); return; }
    try {
      const geo = await loadChinaGeo();
      echarts.registerMap('china', geo);
      echartsMap = echarts.init(document.getElementById('china-map'));
      mapReady = true;
      renderMap();
      echartsMap.on('click', onMapClick);
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
    { key: '_act', label: '详情', act: true, fmt: (d) => d.enr
      ? `<button data-open="${d.id}" class="text-emerald-700 hover:text-emerald-900 font-medium whitespace-nowrap">🛰 查看</button>`
      : '<span class="text-slate-300" title="暂无定位数据">—</span>' },
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
      if (c.act) return `<th class="px-3 py-2.5 font-medium text-right text-slate-400 whitespace-nowrap">${c.label}</th>`;
      const active = tstate.sortKey === c.key;
      const arrow = active ? (tstate.sortDir === 1 ? '▲' : '▼') : '';
      return `<th data-col="${c.key}" class="px-3 py-2.5 font-medium cursor-pointer select-none whitespace-nowrap ${c.num ? 'text-right' : 'text-left'} ${active ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700'}">${c.label}<span class="ml-0.5 text-[0.6rem]">${arrow}</span></th>`;
    }).join('');
    const body = rows.map((d) => {
      const tds = TABLE_COLS.map((c) => {
        if (c.act) return `<td class="px-3 py-2 text-right whitespace-nowrap">${c.fmt(d)}</td>`;
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
    // open the per-listing detail modal from the 查看 button (event delegation)
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

  // ---- map: pin mode (小区位置) ------------------------------------------
  let mapMode = 'choropleth';

  function stylePinsToggle(on) {
    const b = document.getElementById('pins-toggle');
    if (!b) return;
    b.className = 'px-3 py-1.5 rounded-md text-xs font-medium transition-colors ' +
      (on ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-900');
    b.textContent = '📍 小区位置' + (GEOCODED.length ? ` (${GEOCODED.length})` : '');
  }

  // WGS-84 listing points over the GCJ-02 province polygons: at national scale
  // the ~0.5 km datum offset is sub-pixel, so the overlay reads correctly.
  function renderPins() {
    if (!echartsMap) return;
    const pts = GEOCODED.map((d) => ({ name: d.loc, value: [d.enr.lng, d.enr.lat, d.id], d }));
    echartsMap.setOption({
      tooltip: {
        trigger: 'item',
        formatter: (p) => {
          const d = p.data && p.data.d;
          if (!d) return p.name;
          return `<b>${cityLabel(d)}</b> · ${d.enr.geoLabel || ''}<br/>总价 ${fmtWan(d.priceWan)} · ${d.area}㎡ · 单价 ${fmtInt(d.unitPrice)}元/㎡<br/>月租 ${fmtInt(d.rent)}元 · 毛回报 ${fmtPct(d.yieldPct)}<br/><span style="color:#10b981">点击查看卫星图 / 周边 / 气候</span>`;
        },
      },
      geo: {
        map: 'china', roam: false, nameProperty: 'name',
        itemStyle: { areaColor: '#f1f5f9', borderColor: '#fff', borderWidth: 0.6 },
        emphasis: { itemStyle: { areaColor: '#e2e8f0' }, label: { show: false } },
        select: { disabled: true },
      },
      series: [{
        type: 'effectScatter', coordinateSystem: 'geo', zlevel: 2,
        symbolSize: 8, rippleEffect: { scale: 2.4, brushType: 'stroke' },
        itemStyle: { color: '#059669', shadowBlur: 4, shadowColor: 'rgba(5,150,105,0.4)' },
        data: pts,
      }],
    }, true);
  }

  function onMapClick(p) {
    if (p && p.seriesType === 'effectScatter' && p.data && Array.isArray(p.data.value)) {
      openListing(p.data.value[2]);
    }
  }

  function setMapMode(mode) {
    mapMode = mode;
    if (echartsMap) { echartsMap.clear(); if (mode === 'pins') renderPins(); else renderMap(); }
    document.querySelectorAll('[data-map]').forEach((b) =>
      styleTab(b, mode === 'choropleth' && b.dataset.map === mapKey, 'map-tab'));
    stylePinsToggle(mode === 'pins');
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

  const fmtDist = (km) => km == null ? '' : (km < 1 ? Math.round(km * 1000) + 'm' : km.toFixed(1) + 'km');

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
      `${d.prov} · ${d.city}${d.dist ? ' · ' + d.dist : ''} &nbsp;|&nbsp; 总价 ${fmtWan(d.priceWan)} · ${d.area}㎡ · 月租 ${fmtInt(d.rent)}元 ` +
      `<span class="ml-1 inline-block rounded bg-slate-100 text-slate-500 px-1.5 py-0.5 text-xs">定位 ${e.geoLabel || '?'}</span>`;
    const tabs = { sat: '🛰 卫星图', near: '📍 周边', climate: '🌡 气候' };
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
          setTimeout(() => lmSatMap && lmSatMap.invalidateSize(), 180);  // settle after modal layout
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
      const dk = fmtDist(p.distKm);
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
    document.getElementById('lm-risk').innerHTML = risk
      ? `<span class="font-medium text-slate-800">风险与环境（粗略）</span>：${risk.summary}`
      : '<span class="text-slate-400">暂无风险数据</span>';
    if (lmClimateChart) { lmClimateChart.destroy(); lmClimateChart = null; }
    if (!cl || !window.Chart) return;
    const M = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    const pick = (i) => M.map((m) => (cl[m] ? cl[m][i] : null));
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
      b.addEventListener('click', () => { mapKey = b.dataset.map; setMapMode('choropleth'); }));
    const pinsBtn = document.getElementById('pins-toggle');
    if (pinsBtn) pinsBtn.addEventListener('click', () => setMapMode(mapMode === 'pins' ? 'choropleth' : 'pins'));
    stylePinsToggle(false);

    // per-listing modal events
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
