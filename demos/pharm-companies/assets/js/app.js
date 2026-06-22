/* Orchestrator: state, filters, KPIs, catalog, company modal, countries, benchmarks,
   milestones, compare, theme. window.PHARM_APP */
(function () {
  'use strict';
  var I18N = window.PHARM_I18N, D = window.PHARM_DATA, CH = window.PHARM_CHARTS, MAP = window.PHARM_MAP;
  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  var state = {
    map: { dim: 'site_type', region: '', modality: '', ta: '' },
    cat: { search: '', region: '', type: '', modality: '', ta: '', tier: '', sort: 'name', dir: 1 },
    compare: [], countrySel: [], groupsFilter: '', policiesFilter: '', dealsFilter: ''
  };
  var companyModalities = {}, companyTAs = {}, companyPrimaryTA = {};
  var CAT_CAP = 400; // max catalog rows rendered at once (perf w/ large roster); refine via filters

  // ---------- FX + money formatting ----------
  // Raw values stay in local currency (ground truth in the data); DISPLAY converts to the reader's
  // currency — ¥ CNY in 中文, $ USD in English — so amounts are comparable/sortable across markets.
  // Rates = units per 1 USD; fetched live from open.er-api.com with a hardcoded ~2026 fallback.
  var CUR = { USD: '$', CNY: '¥', EUR: '€', JPY: '¥', CHF: 'CHF ', GBP: '£', DKK: 'kr ', KRW: '₩',
    INR: '₹', AUD: 'A$', SGD: 'S$', HKD: 'HK$', TWD: 'NT$', BRL: 'R$', CAD: 'C$', ILS: '₪', SEK: 'kr ',
    PLN: 'zł ', TRY: '₺', SAR: 'SAR ', NOK: 'kr ', HUF: 'Ft ', MXN: 'MX$', IDR: 'Rp ', MYR: 'RM ',
    THB: '฿', ZAR: 'R ', EGP: 'E£', AED: 'AED ', RUB: '₽', ARS: 'AR$ ',
    BDT: '৳ ', JOD: 'JD ', PHP: '₱', PKR: '₨ ', RON: 'lei ', VND: '₫ ' };
  var FX_FALLBACK = { USD: 1, CNY: 7.22, EUR: 0.925, JPY: 149, GBP: 0.787, CHF: 0.893, DKK: 6.9,
    KRW: 1330, INR: 83.3, AUD: 1.515, HKD: 7.81, TWD: 32.3, BRL: 5.55, ILS: 3.7, SEK: 10.5, PLN: 4.0,
    TRY: 33.3, SAR: 3.75, CAD: 1.37, NOK: 10.9, HUF: 357, MXN: 20, IDR: 16100, MYR: 4.55, THB: 34.5,
    SGD: 1.35, ZAR: 18.2, EGP: 50, AED: 3.67, JOD: 0.709, PKR: 278, RUB: 91, BDT: 110, VND: 25400,
    PHP: 58, NZD: 1.65, CZK: 23.3, RON: 4.6, ARS: 1200 };
  var FX = { rates: Object.assign({}, FX_FALLBACK), live: false };
  async function loadFx() {
    try {
      var r = await fetch('https://open.er-api.com/v6/latest/USD');
      if (r.ok) {
        var j = await r.json();
        if (j && j.rates && j.rates.CNY) { Object.assign(FX.rates, j.rates); FX.live = true; }
      }
    } catch (e) {}
  }
  function fxRate(cur) { return FX.rates[(cur || 'USD').toUpperCase()] || FX.rates.USD || 1; }
  function toUSD(m) { return (m && m.value != null) ? m.value / fxRate(m.currency) : null; }
  function usdVal(m) { var u = toUSD(m); return u == null ? -1 : u; }  // for sorting (missing -> bottom)
  function fmtNum(v) {
    var a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(a >= 1e10 ? 0 : 1) + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(0) + 'M';
    if (a >= 1e3) return (v / 1e3).toFixed(0) + 'K';
    return Math.round(v).toLocaleString();
  }
  function money(m, withOrig) {
    if (!m || m.value == null) return '—';
    var usd = toUSD(m); if (usd == null) return '—';
    var en = I18N.isEn();
    var disp = en ? usd : usd * fxRate('CNY');
    var out = (en ? '$' : '¥') + fmtNum(disp) + (m.year ? ' (' + m.year + ')' : '');
    var dcur = en ? 'USD' : 'CNY';
    if (withOrig && m.currency && String(m.currency).toUpperCase() !== dcur) {
      out += ' <span class="text-faint" style="font-size:.85em">· ' + I18N.t('origCur') + ' '
        + (CUR[m.currency] || (m.currency + ' ')) + fmtNum(m.value) + '</span>';
    }
    return out;
  }
  function num(n) { return n == null ? '—' : Number(n).toLocaleString(); }
  function confBadge(c) {
    if (c == null) return '';
    var cls = c >= 0.8 ? 'badge-conf-high' : c >= 0.5 ? 'badge-conf-med' : 'badge-conf-low';
    return '<span class="badge ' + cls + '">' + I18N.t('confidence') + ' ' + c.toFixed(2) + '</span>';
  }
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]; }); }
  function sourcesHtml(srcs) {
    if (!srcs || !srcs.length) return '';
    return '<h4>' + I18N.t('sources') + '</h4><ul class="space-y-1">' + srcs.map(function (s) {
      return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title || s.url) + '</a>' + (s.accessed ? ' <span class="text-faint">· ' + esc(s.accessed) + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function ctBadge(c) { return '<span class="badge badge-ct-' + c.company_type + '">' + I18N.enumLabel('company_type', c.company_type) + '</span>'; }
  function apprBadge(p) { return '<span class="badge badge-appr-' + p.approval_status + '">' + I18N.phaseLabel(p.approval_status) + '</span>'; }
  function coChip(co) { return '<button class="chip chip-link" data-company-link="' + esc(co.id) + '">' + esc(I18N.name(co)) + '</button>'; }
  function relationsHtml(c) {
    var g = c.group_id ? D.getGroup(c.group_id) : null;
    var parent = D.parentOf(c.id), subs = D.subsidiariesOf(c.id), sibs = D.groupSiblings(c.id);
    if (!g && !parent && !subs.length && !sibs.length) return '';
    var rows = '';
    if (g) rows += '<dt>' + I18N.t('grpMemberOf') + '</dt><dd>' + esc(I18N.name(g)) +
      (c.group_role ? ' <span class="badge" style="background:var(--bg-elev)">' + I18N.enumLabel('group_role', c.group_role) + '</span>' : '') + '</dd>';
    if (parent) rows += '<dt>' + I18N.t('grpParentCo') + '</dt><dd>' + coChip(parent) + '</dd>';
    if (subs.length) rows += '<dt>' + I18N.t('grpSubs') + '</dt><dd>' + subs.map(coChip).join(' ') + '</dd>';
    if (sibs.length) rows += '<dt>' + I18N.t('grpSiblings') + '</dt><dd>' + sibs.slice(0, 14).map(coChip).join(' ') + '</dd>';
    return '<h4 class="mt-4">' + I18N.t('grpRelations') + '</h4><dl class="kv">' + rows + '</dl>';
  }

  // ---------- indexes ----------
  function buildIndexes() {
    companyModalities = {}; companyTAs = {}; companyPrimaryTA = {};
    var taIds = {}; D.therapeuticAreas.forEach(function (t) { taIds[t.id] = 1; });  // valid TA id set
    var taCount = {};  // company_id -> { ta_id: product_count }
    D.products.forEach(function (p) {
      (companyModalities[p.company_id] = companyModalities[p.company_id] || new Set()).add(p.modality_id);
      (companyTAs[p.company_id] = companyTAs[p.company_id] || new Set()).add(p.therapeutic_area_id);
      if (p.therapeutic_area_id && taIds[p.therapeutic_area_id]) {
        (taCount[p.company_id] = taCount[p.company_id] || {});
        taCount[p.company_id][p.therapeutic_area_id] = (taCount[p.company_id][p.therapeutic_area_id] || 0) + 1;
      }
    });
    D.companies.forEach(function (c) {
      (c.therapeutic_focus || []).forEach(function (ta) { (companyTAs[c.id] = companyTAs[c.id] || new Set()).add(ta); });
      // primary TA = the area with the most pipeline/products; fallback = first declared focus.
      // Gate on the valid TA-id set so free-text focus tags (cdmo, drug-discovery…) don't pollute the map legend.
      var cnt = taCount[c.id];
      if (cnt) { var best = null, bn = -1; for (var k in cnt) { if (cnt[k] > bn) { bn = cnt[k]; best = k; } } companyPrimaryTA[c.id] = best; }
      else { var tf = (c.therapeutic_focus || []).filter(function (x) { return taIds[x]; }); if (tf.length) companyPrimaryTA[c.id] = tf[0]; }
    });
  }
  function getPrimaryTA(id) { return companyPrimaryTA[id] || null; }

  // ---------- filter population ----------
  function opt(v, label) { return '<option value="' + esc(v) + '">' + esc(label) + '</option>'; }
  function fillSelects() {
    var regions = uniq(D.companies.map(function (c) { return c.region; }));
    var types = uniq(D.companies.map(function (c) { return c.company_type; }));
    var mods = D.modalities.filter(function (m) { return D.products.some(function (p) { return p.modality_id === m.id; }); });
    var tas = D.therapeuticAreas.filter(function (t) { return D.products.some(function (p) { return p.therapeutic_area_id === t.id; }); });

    $('map-filter-region').innerHTML = opt('', I18N.t('allRegions')) + regions.map(function (r) { return opt(r, I18N.enumLabel('region', r)); }).join('');
    $('cat-filter-region').innerHTML = opt('', I18N.t('allRegions')) + regions.map(function (r) { return opt(r, I18N.enumLabel('region', r)); }).join('');
    $('cat-filter-type').innerHTML = opt('', I18N.t('allTypes')) + types.map(function (t) { return opt(t, I18N.enumLabel('company_type', t)); }).join('');
    var modOpts = opt('', I18N.t('allModalities')) + mods.map(function (m) { return opt(m.id, I18N.name(m)); }).join('');
    $('map-filter-modality').innerHTML = modOpts; $('cat-filter-modality').innerHTML = modOpts;
    $('cat-filter-tier').innerHTML = opt('', I18N.t('tierAll')) + opt('deep', I18N.t('tierDeep')) + opt('roster', I18N.t('tierRoster'));
    var taOpts = opt('', I18N.t('allTAs')) + tas.map(function (t) { return opt(t.id, I18N.name(t)); }).join('');
    $('map-filter-ta').innerHTML = taOpts;
    if ($('cat-filter-ta')) $('cat-filter-ta').innerHTML = taOpts;
    $('milestone-filter').innerHTML = opt('', I18N.t('allTAs')) + tas.map(function (t) { return opt(t.id, I18N.name(t)); }).join('');

    var dims = [['site_type', 'dimSiteType'], ['country', 'dimCountry'], ['company_type', 'dimType'], ['therapeutic_area', 'dimTA']];
    $('map-dims').innerHTML = dims.map(function (d) {
      return '<button data-dim="' + d[0] + '" class="' + (d[0] === state.map.dim ? 'active' : '') + '">' + I18N.t(d[1]) + '</button>';
    }).join('');
  }
  function uniq(a) { var o = {}; a.forEach(function (x) { if (x) o[x] = 1; }); return Object.keys(o); }

  // ---------- KPIs ----------
  function renderKpis() {
    $('kpi-companies').textContent = D.companies.length || '—';
    var ctys = uniq(D.companies.map(function (c) { return c.country; }));
    $('kpi-countries').textContent = ctys.length || '—';
    $('kpi-products').textContent = D.products.length || '—';
    $('kpi-blockbusters').textContent = D.products.filter(function (p) { return p.is_blockbuster; }).length || '0';
    $('kpi-sites').textContent = D.sites.length || '—';
  }

  // ---------- map ----------
  function filteredSites() {
    var f = state.map;
    return D.sites.filter(function (s) {
      var c = D.getCompany(s.company_id); if (!c) return false;
      if (f.region && c.region !== f.region) return false;
      if (f.modality && !(companyModalities[c.id] && companyModalities[c.id].has(f.modality))) return false;
      if (f.ta && !(companyTAs[c.id] && companyTAs[c.id].has(f.ta))) return false;
      return true;
    });
  }
  function renderMap() {
    MAP.render({
      dim: state.map.dim, sites: filteredSites(), getCompany: D.getCompany,
      getPrimaryTA: getPrimaryTA, taName: function (id) { var t = D.getTA(id); return t ? I18N.name(t) : id; },
      onClick: openCompanyModal
    });
  }

  // ---------- catalog ----------
  function filteredCompanies() {
    var f = state.cat, q = f.search.toLowerCase();
    var list = D.companies.filter(function (c) {
      if (f.region && c.region !== f.region) return false;
      if (f.type && c.company_type !== f.type) return false;
      if (f.tier && (c.tier || 'deep') !== f.tier) return false;
      if (f.modality && !(companyModalities[c.id] && companyModalities[c.id].has(f.modality))) return false;
      if (f.ta && !(companyTAs[c.id] && companyTAs[c.id].has(f.ta))) return false;
      if (q) {
        var tk = (c.tickers || []).map(function (x) { return x.symbol; }).join(' ');
        var hay = ((c.name_zh || '') + ' ' + (c.name_en || '') + ' ' + c.id + ' ' + (c.exchange || '') + ' ' + tk).toLowerCase();
        var prodHit = D.productsForCompany(c.id).some(function (p) { return ((p.brand_name || '') + ' ' + (p.name_en || '') + ' ' + (p.inn || '')).toLowerCase().indexOf(q) !== -1; });
        if (hay.indexOf(q) === -1 && !prodHit) return false;
      }
      return true;
    });
    var k = f.sort, dir = f.dir;
    list.sort(function (a, b) {
      var va, vb;
      if (k === 'name') { va = I18N.name(a); vb = I18N.name(b); return va.localeCompare(vb) * dir; }
      if (k === 'country') { va = a.country || ''; vb = b.country || ''; return va.localeCompare(vb) * dir; }
      if (k === 'type') { va = a.company_type || ''; vb = b.company_type || ''; return va.localeCompare(vb) * dir; }
      if (k === 'exchange') { va = exchOf(a); vb = exchOf(b); return va.localeCompare(vb) * dir; }
      if (k === 'revenue') { return (usdVal(a.revenue) - usdVal(b.revenue)) * dir; }
      if (k === 'products') { va = D.productsForCompany(a.id).length; vb = D.productsForCompany(b.id).length; return (va - vb) * dir; }
      return 0;
    });
    return list;
  }
  function exchOf(c) { return c.exchange || (c.tickers && c.tickers[0] && c.tickers[0].exchange) || ''; }
  function tickerOf(c) { return (c.tickers || []).map(function (x) { return x.symbol; }).join(', '); }
  function renderCatalog() {
    var cols = [['name', 'thCompany'], ['country', 'thCountry'], ['exchange', 'thExchange'], ['type', 'thType'], ['revenue', 'thRevenue'], ['products', 'thProducts'], ['focus', 'thFocus']];
    $('catalog-head').innerHTML = cols.map(function (c) {
      var arrow = state.cat.sort === c[0] ? (state.cat.dir > 0 ? ' ▲' : ' ▼') : '';
      return '<th data-sort="' + c[0] + '">' + I18N.t(c[1]) + arrow + '</th>';
    }).join('');
    var list = filteredCompanies();
    var shown = list.slice(0, CAT_CAP);
    $('cat-count').textContent = list.length === shown.length
      ? list.length + ' / ' + D.companies.length
      : I18N.t('catCapped').replace('{n}', CAT_CAP).replace('{m}', list.length);
    $('catalog-body').innerHTML = shown.map(function (c) {
      var roster = c.tier === 'roster';
      var listedBadge = roster ? ' <span class="badge" style="background:var(--bg-elev);color:var(--text-faint)">' + I18N.t('badgeListed') + '</span>' : '';
      var focus = roster ? esc(c.sub_sector || '')
        : esc((Array.from(companyTAs[c.id] || [])).slice(0, 3).map(function (ta) { var t = D.getTA(ta); return t ? I18N.name(t) : ta; }).join('、'));
      return '<tr data-company="' + c.id + '">' +
        '<td>' + esc(I18N.name(c)) + listedBadge + '</td>' +
        '<td>' + esc(I18N.pick(c.country_display_zh, c.country_display_en) || c.country) + '</td>' +
        '<td class="text-faint">' + esc(exchOf(c)) + (tickerOf(c) ? ' <span style="opacity:.7">' + esc(tickerOf(c)) + '</span>' : '') + '</td>' +
        '<td>' + ctBadge(c) + '</td>' +
        '<td class="num">' + money(roster ? c.market_cap : c.revenue) + '</td>' +
        '<td class="num">' + (roster ? '·' : D.productsForCompany(c.id).length) + '</td>' +
        '<td>' + focus + '</td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="7" class="loading">' + I18N.t('noData') + '</td></tr>';
  }

  // ---------- company modal ----------
  var modalTab = 'tabSummary';
  function openCompanyModal(id) {
    var c = D.getCompany(id); if (!c) return;
    $('company-modal-head').innerHTML =
      '<h3 class="text-xl font-semibold">' + esc(I18N.name(c)) + ' <span class="text-faint text-sm">' + esc(c.name_en !== I18N.name(c) ? c.name_en : '') + '</span></h3>' +
      '<div class="mt-1 flex flex-wrap items-center gap-2 text-sm">' + ctBadge(c) +
      '<span class="badge" style="background:var(--bg-elev)">' + I18N.enumLabel('region', c.region) + '</span>' +
      '<span class="text-muted">' + esc(I18N.pick(c.country_display_zh, c.country_display_en)) + ' · ' + esc(c.hq_city || '') + '</span>' +
      confBadge(c.confidence) + '</div>';
    if (c.tier === 'roster') modalTab = 'tabSummary';
    var tabs = c.tier === 'roster' ? [['tabSummary', 1]]
      : [['tabSummary', 1], ['tabSites', 1], ['tabPipeline', 1], ['tabFocus', 1], ['tabBench', 1], ['tabMilestones', 1]];
    if (c.tier !== 'roster' && D.dealsForCompany(c.id).length) tabs.splice(4, 0, ['tabDeals', 1]);  // after Focus
    if (modalTab === 'tabDeals' && !D.dealsForCompany(c.id).length) modalTab = 'tabSummary';
    $('company-modal-tabs').innerHTML = tabs.map(function (t) {
      return '<button class="modal-tab-btn ' + (t[0] === modalTab ? 'active' : '') + '" data-tab="' + t[0] + '">' + I18N.t(t[0]) + '</button>';
    }).join('');
    renderModalBody(c);
    $('company-modal').classList.remove('hidden');
  }
  function renderModalBody(c) {
    var b = $('company-modal-body'); var t = modalTab;
    if (t === 'tabSummary') {
      var kv = [
        [I18N.t('thExchange'), esc(exchOf(c)) || '—'],
        [I18N.t('ticker'), (c.tickers || []).map(function (x) { return x.exchange + ':' + x.symbol; }).join(', ') || (c.is_public === false ? '私有/Private' : '—')],
        [I18N.t('revenue'), money(c.revenue, true)], [I18N.t('marketCap'), money(c.market_cap, true)],
        [I18N.t('rndSpend'), money(c.rnd_spend, true)], [I18N.t('employees'), c.employees ? num(c.employees.value) + (c.employees.year ? ' (' + c.employees.year + ')' : '') : '—'],
        [I18N.t('founded'), c.founded || '—'], [I18N.t('hq'), esc(c.hq_city || '') + (c.hq_city ? ', ' : '') + esc(I18N.pick(c.country_display_zh, c.country_display_en))]
      ];
      b.innerHTML = (c.tier === 'roster' ? '<p class="text-faint" style="font-size:.78rem">' + esc(I18N.t('rosterNote')) + '</p>' : '') +
        (c.description_zh || c.description_en ? '<p class="text-muted">' + esc(I18N.pick(c.description_zh, c.description_en)) + '</p>' : '') +
        '<dl class="kv mt-3">' + kv.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>' +
        relationsHtml(c) +
        relatedPoliciesHtml(c) +
        (c.website ? '<p class="mt-3"><a href="' + esc(c.website) + '" target="_blank" rel="noopener">' + esc(c.website) + '</a></p>' : '') +
        sourcesHtml(c.sources);
    } else if (t === 'tabSites') {
      var sites = D.sitesForCompany(c.id);
      b.innerHTML = sites.length ? sites.map(function (s) {
        return '<div class="flex items-center gap-2 py-1 border-b border-base text-sm"><span class="badge badge-site-' + s.site_type + '">' + I18N.enumLabel('site_type', s.site_type) + '</span>' +
          '<span>' + esc(I18N.name(s)) + '</span><span class="text-faint ml-auto">' + esc(s.city || '') + ', ' + esc(s.country || '') + '</span></div>';
      }).join('') : '<p class="loading">' + I18N.t('noData') + '</p>';
    } else if (t === 'tabPipeline') {
      var prods = D.productsForCompany(c.id);
      b.innerHTML = prods.length ? '<table class="data-table"><tbody>' + prods.map(function (p) {
        var m = D.getModality(p.modality_id), ta = D.getTA(p.therapeutic_area_id);
        return '<tr><td>' + esc(p.brand_name || I18N.name(p)) + (p.is_blockbuster ? ' <span class="badge badge-bb">' + I18N.t('blockbuster') + '</span>' : '') +
          '<div class="text-faint" style="font-size:.7rem">' + esc(p.inn || '') + '</div></td>' +
          '<td>' + apprBadge(p) + '</td>' +
          '<td>' + (m ? esc(I18N.name(m)) : '') + '</td>' +
          '<td>' + (ta ? esc(I18N.name(ta)) : '') + '</td>' +
          '<td class="num">' + money(p.latest_annual_sales) + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="loading">' + I18N.t('noData') + '</p>';
    } else if (t === 'tabFocus') {
      var tas = Array.from(companyTAs[c.id] || []); var mods = Array.from(companyModalities[c.id] || []);
      b.innerHTML = '<h4>' + I18N.t('thFocus') + '</h4><div>' + (tas.map(function (x) { var o = D.getTA(x); return '<span class="chip">' + esc(o ? I18N.name(o) : x) + '</span>'; }).join('') || '—') + '</div>' +
        '<h4>' + I18N.t('navModalities') + '</h4><div>' + (mods.map(function (x) { var o = D.getModality(x); return '<span class="chip">' + esc(o ? I18N.name(o) : x) + '</span>'; }).join('') || '—') + '</div>' +
        '<div class="mt-3">' + (state.compare.indexOf(c.id) === -1 ? '<button class="btn-ghost" data-add-compare="' + c.id + '">' + I18N.t('addCompare') + '</button>' : '<span class="text-faint text-sm">' + I18N.t('inCompare') + '</span>') + '</div>';
    } else if (t === 'tabBench') {
      var pids = D.productsForCompany(c.id).map(function (p) { return p.id; });
      var related = D.pairs.filter(function (pr) {
        return pr.domestic_id === c.id || pr.international_id === c.id || pids.indexOf(pr.domestic_id) !== -1 || pids.indexOf(pr.international_id) !== -1;
      });
      b.innerHTML = related.length ? related.map(function (pr) { return benchCardHtml(pr); }).join('') :
        '<p class="loading">' + I18N.t('noData') + '</p>';
    } else if (t === 'tabMilestones') {
      var fwd = D.milestonesForCompany(c.id), rev = D.reverseMilestones(c.id);
      var all = fwd.concat(rev.filter(function (m) { return fwd.indexOf(m) === -1; }));
      b.innerHTML = all.length ? all.map(function (m) { return milestoneCardHtml(m, true); }).join('') : '<p class="loading">' + I18N.t('noData') + '</p>';
    } else if (t === 'tabDeals') {
      var ds = D.dealsForCompany(c.id).slice().sort(function (a, b2) { return (b2.date || '').localeCompare(a.date || ''); });
      b.innerHTML = ds.length ? ds.map(function (d) { return dealCardHtml(d, c.id); }).join('') : '<p class="loading">' + I18N.t('noDeals') + '</p>';
    }
  }

  // ---------- countries ----------
  function renderCountries() {
    var cols = ['name', 'colRegion', 'colMarket', 'colCompanies', 'colRegulator', 'colStrength'];
    $('country-head').innerHTML = ['thCountry', 'colRegion', 'colMarket', 'colCompanies', 'colRegulator', 'colStrength']
      .map(function (k) { return '<th>' + I18N.t(k) + '</th>'; }).join('');
    var list = D.countries.slice().sort(function (a, b) { return usdVal(b.market_size) - usdVal(a.market_size); });
    if (!state.countrySel.length) state.countrySel = list.slice(0, 4).map(function (c) { return c.country; });
    $('country-body').innerHTML = list.map(function (c) {
      var checked = state.countrySel.indexOf(c.country) !== -1;
      var strengths = (I18N.isEn() ? c.notable_strengths_en : c.notable_strengths_zh) || [];
      return '<tr data-country="' + c.country + '" class="' + (checked ? '' : 'opacity-60') + '">' +
        '<td><input type="checkbox" ' + (checked ? 'checked' : '') + ' data-cty="' + c.country + '"> ' + esc(I18N.name(c)) + '</td>' +
        '<td class="text-faint">' + esc(c.region ? I18N.enumLabel('region', c.region) : '') + '</td>' +
        '<td class="num">' + money(c.market_size) + '</td>' +
        '<td class="num">' + num(c.company_count) + '</td>' +
        '<td>' + esc(c.regulator || '') + '</td>' +
        '<td class="text-faint">' + esc(strengths.slice(0, 2).join('、')) + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="loading">' + I18N.t('noData') + '</td></tr>';
    CH.renderCountryRadar(D.countries, state.countrySel);
  }

  // ---------- benchmarks ----------
  function benchCardHtml(pr) {
    function side(id) {
      var p = D.getProduct(id), c = D.getCompany(id);
      if (p) { var co = D.getCompany(p.company_id); return '<div><div class="font-medium">' + esc(p.brand_name || I18N.name(p)) + '</div><div class="text-faint" style="font-size:.7rem">' + esc(co ? I18N.name(co) : '') + '</div></div>'; }
      if (c) return '<div><div class="font-medium">' + esc(I18N.name(c)) + '</div><div class="text-faint" style="font-size:.7rem">' + esc(I18N.pick(c.country_display_zh, c.country_display_en)) + '</div></div>';
      return '<div class="text-faint">' + esc(id) + '</div>';
    }
    return '<div class="bm-card"><div class="text-xs text-faint mb-1">' + esc(pr.dimension || '') + '</div>' +
      '<div class="bm-vs">' + side(pr.domestic_id) + '<span class="vs">vs</span>' + side(pr.international_id) + '</div>' +
      (pr.note_zh || pr.note_en ? '<p class="text-faint mt-2" style="font-size:.72rem">' + esc(I18N.pick(pr.note_zh, pr.note_en)) + '</p>' : '') + '</div>';
  }
  function renderBenchmarks() {
    $('benchmark-cards').innerHTML = D.pairs.length ? D.pairs.map(benchCardHtml).join('') : '<p class="loading">' + I18N.t('noData') + '</p>';
  }

  // ---------- milestones ----------
  function milestoneCardHtml(m, inModal) {
    var c = D.getCompany(m.company_id);
    var inc = (m.incumbent_product_ids || []).map(function (id) { var p = D.getProduct(id); return p ? (p.brand_name || I18N.name(p)) : id; }).join('、');
    var metrics = (m.metrics || []).map(function (x) { return '<span class="chip">' + esc(I18N.pick(x.label_zh, x.label_en)) + ': ' + esc(x.value) + '</span>'; }).join('');
    return '<div class="timeline-card">' +
      '<div class="timeline-date">' + esc(m.date) + ' · ' + esc(c ? I18N.name(c) : '') + '</div>' +
      '<div class="font-medium mt-1">' + esc(I18N.pick(m.headline_zh, m.headline_en)) + '</div>' +
      (inc ? '<div class="text-faint mt-1" style="font-size:.72rem">' + I18N.t('vsIncumbent') + ': ' + esc(inc) + '</div>' : '') +
      (inModal ? '<div class="text-muted mt-2" style="font-size:.78rem"><b>' + I18N.t('achievement') + '：</b>' + esc(I18N.pick(m.achievement_zh, m.achievement_en)) + '</div>' : '') +
      (metrics ? '<div class="mt-2">' + metrics + '</div>' : '') + '</div>';
  }
  function renderMilestones() {
    var f = $('milestone-filter').value;
    var list = D.milestones.filter(function (m) { return !f || m.therapeutic_area_id === f; })
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    $('milestone-timeline').innerHTML = list.length ? list.map(function (m) {
      return '<div class="timeline-node">' + milestoneCardHtml(m, false) + '</div>';
    }).join('') : '<p class="loading">' + I18N.t('noData') + '</p>';
    $('milestone-timeline').querySelectorAll('.timeline-card').forEach(function (card, i) {
      card.addEventListener('click', function () { openMilestone(list[i]); });
    });
  }
  function openMilestone(m) {
    var c = D.getCompany(m.company_id);
    modalTab = 'tabMilestones';
    if (c) { openCompanyModal(c.id); }
  }

  // ---------- compare ----------
  function toggleCompare(id) {
    var i = state.compare.indexOf(id);
    if (i === -1) { if (state.compare.length < 4) state.compare.push(id); } else state.compare.splice(i, 1);
    var badge = $('compare-badge');
    badge.textContent = state.compare.length;
    badge.classList.toggle('hidden', state.compare.length === 0);
  }
  function openCompare() {
    if (!state.compare.length) return;
    var rows = [
      ['thCountry', function (c) { return esc(I18N.pick(c.country_display_zh, c.country_display_en)); }],
      ['thType', function (c) { return ctBadge(c); }],
      ['revenue', function (c) { return money(c.revenue); }],
      ['marketCap', function (c) { return money(c.market_cap); }],
      ['rndSpend', function (c) { return money(c.rnd_spend); }],
      ['thProducts', function (c) { return D.productsForCompany(c.id).length; }],
      ['kpiBlockbusters', function (c) { return D.productsForCompany(c.id).filter(function (p) { return p.is_blockbuster; }).length; }]
    ];
    var cs = state.compare.map(D.getCompany).filter(Boolean);
    var html = '<table class="data-table"><thead><tr><th></th>' + cs.map(function (c) { return '<th>' + esc(I18N.name(c)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td class="text-faint">' + I18N.t(r[0]) + '</td>' + cs.map(function (c) { return '<td>' + r[1](c) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table><div class="mt-3"><button class="btn-ghost" id="compare-clear">' + I18N.t('reset') + '</button></div>';
    $('compare-body').innerHTML = html;
    $('compare-clear').addEventListener('click', function () { state.compare = []; $('compare-badge').classList.add('hidden'); $('compare-modal').classList.add('hidden'); });
    $('compare-modal').classList.remove('hidden');
  }

  // ---------- groups (corporate-ownership graph) ----------
  function renderGroups() {
    if (!window.GROUPS_GRAPH || !$('groups-graph')) return;
    var grouped = D.companies.filter(function (c) { return c.group_id; });
    var present = {}; grouped.forEach(function (c) { present[c.group_id] = 1; });
    var gs = D.groups.filter(function (g) { return present[g.id]; })
      .sort(function (a, b) { return I18N.name(a).localeCompare(I18N.name(b)); });
    $('groups-filter').innerHTML = opt('', I18N.t('allGroups')) + gs.map(function (g) { return opt(g.id, I18N.name(g)); }).join('');
    $('groups-filter').value = state.groupsFilter || '';
    $('groups-count').textContent = I18N.t('grpCountTpl').replace('{g}', gs.length).replace('{n}', grouped.length);
    GROUPS_GRAPH.render($('groups-graph'), {
      companies: D.companies, groups: D.groups, isEn: I18N.isEn(),
      filterGroupId: state.groupsFilter || '',
      getCompany: D.getCompany, getGroup: D.getGroup,
      onNodeClick: function (id) { modalTab = 'tabSummary'; openCompanyModal(id); }
    });
  }

  // ---------- China policy board ----------
  function effBadge(e) { return '<span class="badge eff-' + (e || 'neutral') + '">' + I18N.enumLabel('policy_effect', e) + '</span>'; }
  function ptBadge(p) { return '<span class="badge badge-pt-' + (p.policy_type || 'regulatory') + '">' + I18N.enumLabel('policy_type', p.policy_type) + '</span>'; }
  function policyName(p) { return I18N.pick(p.title_zh, p.title_en); }
  function polChip(p) { return '<button class="chip chip-link" data-policy-link="' + esc(p.id) + '">' + esc(policyName(p)) + '</button>'; }

  function policyCardHtml(p) {
    var aff = (p.affected_companies || []).length;
    return '<button class="policy-card" data-policy="' + esc(p.id) + '">' +
      '<div class="flex items-center gap-2 flex-wrap">' + ptBadge(p) +
        '<span class="text-xs text-faint">' + esc(p.date || '') + '</span>' + confBadge(p.confidence) + '</div>' +
      '<div class="font-medium mt-2">' + esc(policyName(p)) + '</div>' +
      '<p class="text-muted mt-1" style="font-size:.8rem">' + esc(I18N.pick(p.summary_zh, p.summary_en)) + '</p>' +
      '<div class="text-faint mt-2" style="font-size:.72rem">' + esc(I18N.pick(p.agency_zh, p.agency_en)) +
        (aff ? ' · ' + I18N.t('polAffected') + ' ' + aff : '') + '</div></button>';
  }
  function affectedHtml(p) {
    var list = (p.affected_companies || []).filter(function (a) { return a && a.company_id; });
    if (!list.length) return '';
    return '<h4 class="mt-4">' + I18N.t('polAffected') + '</h4><div class="space-y-1">' + list.map(function (a) {
      var co = D.getCompany(a.company_id);
      return '<div class="flex items-start gap-2 text-sm">' + effBadge(a.effect) +
        '<button class="chip chip-link" data-company-link="' + esc(a.company_id) + '">' + esc(co ? I18N.name(co) : a.company_id) + '</button>' +
        '<span class="text-faint">' + esc(I18N.pick(a.note_zh, a.note_en)) + '</span></div>';
    }).join('') + '</div>';
  }
  function polSourcesHtml(srcs) {
    if (!srcs || !srcs.length) return '';
    return '<h4 class="mt-4">' + I18N.t('polSources') + '</h4><ul class="space-y-1">' + srcs.map(function (s) {
      return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(I18N.pick(s.label_zh, s.label_en) || s.url) + '</a>' +
        (s.publisher ? ' <span class="text-faint">· ' + esc(s.publisher) + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function openPolicyModal(id) {
    var p = D.getPolicy(id); if (!p) return;
    $('company-modal').classList.add('hidden');  // avoid stacked modals
    $('policy-modal-head').innerHTML =
      '<h3 class="text-xl font-semibold">' + esc(policyName(p)) + '</h3>' +
      '<div class="mt-1 flex flex-wrap items-center gap-2 text-sm">' + ptBadge(p) +
      '<span class="badge" style="background:var(--bg-elev)">' + esc(I18N.pick(p.agency_zh, p.agency_en)) + '</span>' +
      '<span class="text-muted">' + esc(p.date || '') + '</span>' + confBadge(p.confidence) + '</div>';
    var d = p.detail || {};
    var inits = (d.initiatives || []).map(function (x) { return '<li>' + esc(I18N.pick(x.zh, x.en)) + '</li>'; }).join('');
    var tl = (d.timeline || []).map(function (x) {
      return '<div class="flex gap-2 text-sm"><span class="text-faint" style="min-width:4.5rem">' + esc(x.date) + '</span><span>' + esc(I18N.pick(x.zh, x.en)) + '</span></div>';
    }).join('');
    var related = (d.related || []).map(D.getPolicy).filter(Boolean);
    $('policy-modal-body').innerHTML =
      '<p class="text-muted">' + esc(I18N.pick(p.summary_zh, p.summary_en)) + '</p>' +
      (d.direction_zh || d.direction_en ? '<h4 class="mt-4">' + I18N.t('polDirection') + '</h4><p class="text-muted">' + esc(I18N.pick(d.direction_zh, d.direction_en)) + '</p>' : '') +
      (d.focus_zh || d.focus_en ? '<h4 class="mt-4">' + I18N.t('polFocus') + '</h4><p class="text-muted">' + esc(I18N.pick(d.focus_zh, d.focus_en)) + '</p>' : '') +
      (inits ? '<h4 class="mt-4">' + I18N.t('polInitiatives') + '</h4><ul class="pol-ul">' + inits + '</ul>' : '') +
      (d.implications_zh || d.implications_en ? '<h4 class="mt-4">' + I18N.t('polImplications') + '</h4><p class="text-muted">' + esc(I18N.pick(d.implications_zh, d.implications_en)) + '</p>' : '') +
      (tl ? '<h4 class="mt-4">' + I18N.t('polTimeline') + '</h4><div class="space-y-1">' + tl + '</div>' : '') +
      affectedHtml(p) +
      (related.length ? '<h4 class="mt-4">' + I18N.t('polRelatedPolicies') + '</h4><div>' + related.map(polChip).join(' ') + '</div>' : '') +
      polSourcesHtml(p.sources);
    $('policy-modal').classList.remove('hidden');
  }
  // reverse: policies affecting THIS company (shown in company modal summary)
  function relatedPoliciesHtml(c) {
    var pol = D.policiesForCompany(c.id); if (!pol.length) return '';
    var seen = {}, items = [];
    pol.forEach(function (x) { if (!seen[x.policy.id]) { seen[x.policy.id] = 1; items.push(x); } });
    return '<h4 class="mt-4">' + I18N.t('polRelated') + '</h4><div class="space-y-1">' + items.map(function (x) {
      return '<div class="flex items-center gap-2 text-sm">' + effBadge(x.effect) + polChip(x.policy) + '</div>';
    }).join('') + '</div>';
  }
  function renderPolicies() {
    if (!$('policies-grid')) return;
    var pols = D.policies.slice();
    var types = uniq(pols.map(function (p) { return p.policy_type; }));
    $('policies-filter').innerHTML = opt('', I18N.t('allPolicyTypes')) +
      types.sort().map(function (t) { return opt(t, I18N.enumLabel('policy_type', t)); }).join('');
    $('policies-filter').value = state.policiesFilter || '';
    var list = pols.filter(function (p) { return !state.policiesFilter || p.policy_type === state.policiesFilter; })
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    var links = 0; pols.forEach(function (p) { links += (p.affected_companies || []).length; });
    $('policies-count').textContent = I18N.t('polCountTpl').replace('{n}', pols.length).replace('{c}', links);
    $('policies-grid').innerHTML = list.length ? list.map(policyCardHtml).join('') : '<p class="loading">' + I18N.t('noData') + '</p>';
  }

  // ---------- deal / partnership network ----------
  var DEAL_COLORS = { license_out: '#14b8a6', license_in: '#3b82f6', m_and_a: '#ef4444', collaboration: '#94a3b8', jv: '#22c55e', equity_stake: '#a855f7' };
  function dtBadge(d) { return '<span class="badge badge-dt-' + (d.deal_type || 'collaboration') + '">' + I18N.enumLabel('deal_type', d.deal_type) + '</span>'; }
  function usdM(m) { return m == null ? '' : (m >= 1000 ? '$' + (m / 1000).toFixed(1) + 'B' : '$' + m + 'M'); }
  function dealCounterparties(d, selfId) {
    return (d.parties || []).filter(function (p) { return p.company_id !== selfId; }).map(function (p) {
      var co = p.company_id ? D.getCompany(p.company_id) : null;
      var nm = co ? I18N.name(co) : (I18N.pick(p.name_zh, p.name_en) || p.company_id || '');
      return co ? '<button class="chip chip-link" data-company-link="' + esc(p.company_id) + '">' + esc(nm) + '</button>' : '<span class="chip">' + esc(nm) + '</span>';
    }).join(' ');
  }
  function dealCardHtml(d, selfId) {
    var val = [];
    if (d.upfront_usd_m != null) val.push(I18N.t('dealUpfront') + ' ' + usdM(d.upfront_usd_m));
    if (d.total_usd_m != null) val.push(I18N.t('dealTotal') + ' ' + usdM(d.total_usd_m));
    var asset = I18N.pick(d.asset_zh, d.asset_en);
    var srcs = d.sources || [];
    var src1 = srcs.length ? '<a href="' + esc(srcs[0].url) + '" target="_blank" rel="noopener">' + esc(srcs[0].publisher || I18N.t('sources')) + '</a>' : '';
    return '<div class="deal-card">' +
      '<div class="flex items-center gap-2 flex-wrap">' + dtBadge(d) +
        '<span class="text-xs text-faint">' + esc(d.date || '') + '</span>' +
        '<span class="badge" style="background:var(--bg-elev)">' + I18N.enumLabel('deal_status', d.status) + '</span>' +
        (val.length ? '<span class="text-xs ml-auto" style="color:var(--accent-strong)">' + esc(val.join(' · ')) + '</span>' : '') + '</div>' +
      '<div class="mt-1 text-sm">' + esc(I18N.pick(d.headline_zh, d.headline_en)) + '</div>' +
      '<div class="mt-1 flex flex-wrap items-center gap-1 text-xs"><span class="text-faint">' + I18N.t('dealCounterparty') + '：</span> ' + dealCounterparties(d, selfId) + '</div>' +
      (asset ? '<div class="text-faint mt-1" style="font-size:.72rem">' + I18N.t('dealAsset') + '：' + esc(asset) + '</div>' : '') +
      (src1 ? '<div class="mt-1" style="font-size:.72rem">' + src1 + '</div>' : '') + '</div>';
  }
  function renderDeals() {
    if (!window.DEALS_GRAPH || !$('deals-graph')) return;
    var deals = D.deals || [];
    var types = uniq(deals.map(function (d) { return d.deal_type; }));
    $('deals-filter').innerHTML = opt('', I18N.t('allDealTypes')) + types.sort().map(function (t) { return opt(t, I18N.enumLabel('deal_type', t)); }).join('');
    $('deals-filter').value = state.dealsFilter || '';
    var res = DEALS_GRAPH.render($('deals-graph'), {
      deals: deals, getCompany: D.getCompany, isEn: I18N.isEn(),
      filterType: state.dealsFilter || '', i18n: I18N,
      onNodeClick: function (id) { modalTab = 'tabSummary'; openCompanyModal(id); }
    }) || {};
    $('deals-count').textContent = I18N.t('dealsCountTpl').replace('{n}', deals.length).replace('{c}', res.nodes || 0);
    var leg = $('deals-legend');
    if (leg) leg.innerHTML = types.sort().map(function (t) {
      return '<span><span class="dot" style="background:' + (DEAL_COLORS[t] || '#64748b') + '"></span>' + I18N.enumLabel('deal_type', t) + '</span>';
    }).join('');
  }

  // ---------- render all dynamic ----------
  function renderAll() {
    renderKpis();
    CH.renderOverview(D.companies, D.products);
    renderMap();
    renderCatalog();
    CH.renderModalitySunburst(D.products, D.modalities, function (modId) {
      state.cat.modality = modId; $('cat-filter-modality').value = modId; renderCatalog();
      document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
    });
    CH.renderTrendPhase(D.products); CH.renderTrendTA(D.products, D.getTA);
    CH.renderTrendModality(D.products, D.getModality); CH.renderTrendRegion(D.companies);
    renderCountries(); renderBenchmarks(); renderMilestones(); renderGroups(); renderDeals(); renderPolicies();
  }

  // ---------- theme ----------
  function toggleTheme() {
    var dark = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('pharm-companies-theme', dark ? 'dark' : 'light'); } catch (e) {}
    renderAll();
  }

  // ---------- events ----------
  function bind() {
    $('lang-toggle').addEventListener('click', function () { I18N.toggleLang(); });
    $('theme-toggle').addEventListener('click', toggleTheme);
    $('compare-btn').addEventListener('click', openCompare);
    document.querySelectorAll('[data-close-modal]').forEach(function (b) { b.addEventListener('click', function () { $('company-modal').classList.add('hidden'); }); });
    document.querySelectorAll('[data-close-compare]').forEach(function (b) { b.addEventListener('click', function () { $('compare-modal').classList.add('hidden'); }); });
    document.querySelectorAll('[data-close-policy]').forEach(function (b) { b.addEventListener('click', function () { $('policy-modal').classList.add('hidden'); }); });
    [['company-modal'], ['compare-modal'], ['policy-modal']].forEach(function (m) {
      $(m[0]).addEventListener('click', function (e) { if (e.target === this) this.classList.add('hidden'); });
    });

    $('map-dims').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-dim]'); if (!b) return;
      state.map.dim = b.getAttribute('data-dim');
      $('map-dims').querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
      renderMap();
    });
    $('map-filter-region').addEventListener('change', function (e) { state.map.region = e.target.value; renderMap(); });
    $('map-filter-modality').addEventListener('change', function (e) { state.map.modality = e.target.value; renderMap(); });
    $('map-filter-ta').addEventListener('change', function (e) { state.map.ta = e.target.value; renderMap(); });
    $('map-reset').addEventListener('click', function () { state.map.region = state.map.modality = state.map.ta = ''; $('map-filter-region').value = ''; $('map-filter-modality').value = ''; $('map-filter-ta').value = ''; renderMap(); });

    $('cat-search').addEventListener('input', function (e) { state.cat.search = e.target.value; renderCatalog(); });
    $('cat-filter-region').addEventListener('change', function (e) { state.cat.region = e.target.value; renderCatalog(); });
    $('cat-filter-type').addEventListener('change', function (e) { state.cat.type = e.target.value; renderCatalog(); });
    $('cat-filter-modality').addEventListener('change', function (e) { state.cat.modality = e.target.value; renderCatalog(); });
    if ($('cat-filter-ta')) $('cat-filter-ta').addEventListener('change', function (e) { state.cat.ta = e.target.value; renderCatalog(); });
    $('cat-filter-tier').addEventListener('change', function (e) { state.cat.tier = e.target.value; renderCatalog(); });
    $('cat-reset').addEventListener('click', function () {
      state.cat.search = state.cat.region = state.cat.type = state.cat.modality = state.cat.ta = state.cat.tier = '';
      $('cat-search').value = ''; $('cat-filter-region').value = ''; $('cat-filter-type').value = ''; $('cat-filter-modality').value = '';
      if ($('cat-filter-ta')) $('cat-filter-ta').value = ''; $('cat-filter-tier').value = ''; renderCatalog();
    });
    $('catalog-head').addEventListener('click', function (e) {
      var th = e.target.closest('th[data-sort]'); if (!th) return;
      var k = th.getAttribute('data-sort');
      if (state.cat.sort === k) state.cat.dir *= -1; else { state.cat.sort = k; state.cat.dir = 1; }
      renderCatalog();
    });
    $('catalog-body').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-company]'); if (tr) { modalTab = 'tabSummary'; openCompanyModal(tr.getAttribute('data-company')); }
    });

    $('company-modal-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]'); if (!b) return;
      modalTab = b.getAttribute('data-tab');
      $('company-modal-tabs').querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
      var head = $('company-modal-head').querySelector('h3'); // current company id via re-find
      renderModalBodyFromOpen();
    });
    $('company-modal-body').addEventListener('click', function (e) {
      var b = e.target.closest('[data-add-compare]'); if (b) { toggleCompare(b.getAttribute('data-add-compare')); renderModalBodyFromOpen(); return; }
      var pl = e.target.closest('[data-policy-link]'); if (pl) { openPolicyModal(pl.getAttribute('data-policy-link')); return; }
      var link = e.target.closest('[data-company-link]'); if (link) { modalTab = 'tabSummary'; openCompanyModal(link.getAttribute('data-company-link')); }
    });
    $('policy-modal-body').addEventListener('click', function (e) {
      var link = e.target.closest('[data-company-link]');
      if (link) { $('policy-modal').classList.add('hidden'); modalTab = 'tabSummary'; openCompanyModal(link.getAttribute('data-company-link')); return; }
      var pl = e.target.closest('[data-policy-link]'); if (pl) { openPolicyModal(pl.getAttribute('data-policy-link')); }
    });

    $('groups-filter').addEventListener('change', function (e) { state.groupsFilter = e.target.value; renderGroups(); });
    $('deals-filter').addEventListener('change', function (e) { state.dealsFilter = e.target.value; renderDeals(); });
    $('policies-filter').addEventListener('change', function (e) { state.policiesFilter = e.target.value; renderPolicies(); });
    $('policies-grid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-policy]'); if (b) openPolicyModal(b.getAttribute('data-policy'));
    });
    $('milestone-filter').addEventListener('change', renderMilestones);
    $('country-body').addEventListener('change', function (e) {
      var cb = e.target.closest('input[data-cty]'); if (!cb) return;
      var code = cb.getAttribute('data-cty'); var i = state.countrySel.indexOf(code);
      if (cb.checked && i === -1) state.countrySel.push(code); else if (!cb.checked && i !== -1) state.countrySel.splice(i, 1);
      renderCountries();
    });

    I18N.onChange(function () { fillSelects(); restoreFilterValues(); renderAll(); if (!$('company-modal').classList.contains('hidden')) renderModalBodyFromOpen(); });
  }
  var openCompanyId = null;
  function renderModalBodyFromOpen() { if (openCompanyId) { var c = D.getCompany(openCompanyId); if (c) renderModalBody(c); } }
  // wrap openCompanyModal to track current id
  var _open = openCompanyModal;
  openCompanyModal = function (id) { openCompanyId = id; _open(id); };

  function restoreFilterValues() {
    $('map-filter-region').value = state.map.region; $('map-filter-modality').value = state.map.modality; $('map-filter-ta').value = state.map.ta;
    $('cat-filter-region').value = state.cat.region; $('cat-filter-type').value = state.cat.type; $('cat-filter-modality').value = state.cat.modality; $('cat-filter-tier').value = state.cat.tier; $('cat-search').value = state.cat.search;
    if ($('cat-filter-ta')) $('cat-filter-ta').value = state.cat.ta;
  }

  // ---------- init ----------
  async function init() {
    I18N.applyLangToUI();
    var foot = $('foot-build');
    try {
      await Promise.all([D.initCore(), loadFx()]);
      buildIndexes(); fillSelects(); bind(); renderAll();
      if (D.manifest && foot) foot.textContent = 'build ' + (D.manifest.data_version || '') + ' · ' + (D.manifest.build_time || '');
    } catch (e) {
      console.error(e);
      $('init-error').classList.remove('hidden');
      // still bind toggles so the page isn't dead
      try { bind(); } catch (e2) {}
    }
  }
  window.PHARM_APP = { init: init, openCompanyModal: function (id) { openCompanyModal(id); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
