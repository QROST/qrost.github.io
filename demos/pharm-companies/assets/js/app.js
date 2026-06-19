/* Orchestrator: state, filters, KPIs, catalog, company modal, countries, benchmarks,
   milestones, compare, theme. window.PHARM_APP */
(function () {
  'use strict';
  var I18N = window.PHARM_I18N, D = window.PHARM_DATA, CH = window.PHARM_CHARTS, MAP = window.PHARM_MAP;
  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  var state = {
    map: { dim: 'site_type', region: '', modality: '', ta: '' },
    cat: { search: '', region: '', type: '', modality: '', tier: '', sort: 'name', dir: 1 },
    compare: [], countrySel: []
  };
  var companyModalities = {}, companyTAs = {};
  var CAT_CAP = 400; // max catalog rows rendered at once (perf w/ large roster); refine via filters

  // ---------- formatting ----------
  var CUR = { USD: '$', CNY: '¥', EUR: '€', JPY: '¥', CHF: 'CHF ', GBP: '£', DKK: 'kr ', KRW: '₩', INR: '₹', AUD: 'A$', SGD: 'S$' };
  function money(m) {
    if (!m || m.value == null) return '—';
    var v = m.value, sym = CUR[m.currency] || (m.currency ? m.currency + ' ' : '');
    var s;
    if (v >= 1e9) s = (v / 1e9).toFixed(v >= 1e10 ? 0 : 1) + 'B';
    else if (v >= 1e6) s = (v / 1e6).toFixed(0) + 'M';
    else s = v.toLocaleString();
    return sym + s + (m.year ? ' (' + m.year + ')' : '');
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

  // ---------- indexes ----------
  function buildIndexes() {
    companyModalities = {}; companyTAs = {};
    D.products.forEach(function (p) {
      (companyModalities[p.company_id] = companyModalities[p.company_id] || new Set()).add(p.modality_id);
      (companyTAs[p.company_id] = companyTAs[p.company_id] || new Set()).add(p.therapeutic_area_id);
    });
    D.companies.forEach(function (c) {
      (c.therapeutic_focus || []).forEach(function (ta) { (companyTAs[c.id] = companyTAs[c.id] || new Set()).add(ta); });
    });
  }

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
    $('map-filter-ta').innerHTML = opt('', I18N.t('allTAs')) + tas.map(function (t) { return opt(t.id, I18N.name(t)); }).join('');
    $('milestone-filter').innerHTML = opt('', I18N.t('allTAs')) + tas.map(function (t) { return opt(t.id, I18N.name(t)); }).join('');

    var dims = [['site_type', 'dimSiteType'], ['country', 'dimCountry'], ['company_type', 'dimType']];
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
    MAP.render({ dim: state.map.dim, sites: filteredSites(), getCompany: D.getCompany, onClick: openCompanyModal });
  }

  // ---------- catalog ----------
  function filteredCompanies() {
    var f = state.cat, q = f.search.toLowerCase();
    var list = D.companies.filter(function (c) {
      if (f.region && c.region !== f.region) return false;
      if (f.type && c.company_type !== f.type) return false;
      if (f.tier && (c.tier || 'deep') !== f.tier) return false;
      if (f.modality && !(companyModalities[c.id] && companyModalities[c.id].has(f.modality))) return false;
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
      if (k === 'revenue') { va = a.revenue ? a.revenue.value : -1; vb = b.revenue ? b.revenue.value : -1; return (va - vb) * dir; }
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
        [I18N.t('revenue'), money(c.revenue)], [I18N.t('marketCap'), money(c.market_cap)],
        [I18N.t('rndSpend'), money(c.rnd_spend)], [I18N.t('employees'), c.employees ? num(c.employees.value) + (c.employees.year ? ' (' + c.employees.year + ')' : '') : '—'],
        [I18N.t('founded'), c.founded || '—'], [I18N.t('hq'), esc(c.hq_city || '') + (c.hq_city ? ', ' : '') + esc(I18N.pick(c.country_display_zh, c.country_display_en))]
      ];
      if (c.parent_id && D.getCompany(c.parent_id)) kv.push([I18N.t('parent'), esc(I18N.name(D.getCompany(c.parent_id)))]);
      b.innerHTML = (c.tier === 'roster' ? '<p class="text-faint" style="font-size:.78rem">' + esc(I18N.t('rosterNote')) + '</p>' : '') +
        (c.description_zh || c.description_en ? '<p class="text-muted">' + esc(I18N.pick(c.description_zh, c.description_en)) + '</p>' : '') +
        '<dl class="kv mt-3">' + kv.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>' +
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
    }
  }

  // ---------- countries ----------
  function renderCountries() {
    var cols = ['name', 'colRegion', 'colMarket', 'colCompanies', 'colRegulator', 'colStrength'];
    $('country-head').innerHTML = ['thCountry', 'colRegion', 'colMarket', 'colCompanies', 'colRegulator', 'colStrength']
      .map(function (k) { return '<th>' + I18N.t(k) + '</th>'; }).join('');
    var list = D.countries.slice().sort(function (a, b) { return (b.market_size ? b.market_size.value : 0) - (a.market_size ? a.market_size.value : 0); });
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
    renderCountries(); renderBenchmarks(); renderMilestones();
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
    [['company-modal'], ['compare-modal']].forEach(function (m) {
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
    $('cat-filter-tier').addEventListener('change', function (e) { state.cat.tier = e.target.value; renderCatalog(); });
    $('cat-reset').addEventListener('click', function () {
      state.cat.search = state.cat.region = state.cat.type = state.cat.modality = state.cat.tier = '';
      $('cat-search').value = ''; $('cat-filter-region').value = ''; $('cat-filter-type').value = ''; $('cat-filter-modality').value = ''; $('cat-filter-tier').value = ''; renderCatalog();
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
      var b = e.target.closest('[data-add-compare]'); if (b) { toggleCompare(b.getAttribute('data-add-compare')); renderModalBodyFromOpen(); }
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
  }

  // ---------- init ----------
  async function init() {
    I18N.applyLangToUI();
    var foot = $('foot-build');
    try {
      await D.initCore();
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
