/* Orchestrator: filters, KPIs, catalogs, modals, theme. window.CHINA_AUTO_APP */
(function () {
  'use strict';
  var I18N = window.CHINA_AUTO_I18N, D = window.CHINA_AUTO_DATA, CH = window.CHINA_AUTO_CHARTS, MAP = window.CHINA_AUTO_MAP;
  var S = window.CHINA_AUTO_SEARCH;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    map: { dim: 'output', role: '', cluster: '', tier: '', layer: 'cities' },
    cat: { search: '', tier: '', role: '', cluster: '', sort: 'output', dir: -1 },
    org: { search: '', type: '', sort: 'type', dir: 1, groups: { identity: true, scale: true, product: true, network: false } }
  };
  var cityModalTab = 'tabOverview';
  var openCityId = null;

  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]; }); }
  function uniq(a) { var o = {}; a.forEach(function (x) { if (x) o[x] = 1; }); return Object.keys(o); }
  var ORG_TYPE_ORDER = ['automaker', 'brand', 'battery_company', 'supplier', 'software_company', 'chip_company', 'university', 'media_company', 'research_institute', 'testing_body', 'industry_association'];
  function typeRank(t) { var i = ORG_TYPE_ORDER.indexOf(t); return i < 0 ? 99 : i; }
  function localeName(a, b) { return I18N.name(a).localeCompare(I18N.name(b), I18N.isEn() ? 'en' : 'zh'); }
  function opt(v, label) { return '<option value="' + esc(v) + '">' + esc(label) + '</option>'; }

  function fmtWan(val) {
    if (val == null) return '—';
    return (val / 10000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function fmtMetric(m, kind) {
    if (!m || m.value == null) return '—';
    var n = m.value, s;
    if (kind === 'vehicles') s = I18N.isEn() ? n.toLocaleString() : (fmtWan(n) + '万辆');
    else if (kind === 'people') s = I18N.isEn() ? n.toLocaleString() : (n >= 10000 ? fmtWan(n) + '万' : String(n));
    else s = String(n);
    return m.year ? s + ' <span class="text-faint">(' + m.year + ')</span>' : s;
  }
  function dash() { return '<span class="text-faint">—</span>'; }
  function tinyBadges(vals, group) {
    if (!vals || !vals.length) return dash();
    return vals.map(function (v) { return '<span class="badge" style="background:var(--bg-elev)">' + esc(I18N.enumLabel(group, v)) + '</span>'; }).join(' ');
  }
  function enrichOf(o) { return (o && o.enrich) || {}; }
  function confBadge(c) {
    if (c == null) return '';
    var cls = c >= 0.8 ? 'badge-grade-A' : c >= 0.5 ? 'badge-grade-B' : 'badge-grade-C';
    return '<span class="badge ' + cls + '">' + I18N.t('confidence') + ' ' + c.toFixed(2) + '</span>';
  }
  function rtBadge(tag) { return '<span class="badge badge-rt-' + tag + '">' + esc(I18N.enumLabel('role_tag', tag)) + '</span>'; }
  function tierBadge(t) { return '<span class="badge badge-tier-' + t + '">' + esc(I18N.enumLabel('city_tier', t)) + '</span>'; }
  function gradeBadge(g) { return '<span class="badge badge-grade-' + g + '">' + esc(I18N.enumLabel('source_grade', g)) + '</span>'; }

  function sourcesHtml(ids) {
    if (!ids || !ids.length) return '';
    return '<h4>' + I18N.t('sources') + '</h4><ul class="space-y-1">' + ids.map(function (sid) {
      var s = D.getSource(sid); if (!s) return '';
      var title = I18N.pick(s.title_zh, s.title_en) || sid;
      return '<li>' + (s.url ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(title) + '</a>' : esc(title)) +
        ' ' + gradeBadge(s.grade) + (s.accessed_at ? ' <span class="text-faint">· ' + esc(s.accessed_at) + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  function orgCount(cityId) { return D.orgsForCity(cityId).length; }

  function filteredCities() {
    var f = state.map;
    return D.cities.filter(function (c) {
      if (f.tier && c.tier !== f.tier) return false;
      if (f.cluster && (c.cluster_ids || []).indexOf(f.cluster) === -1) return false;
      if (f.role && (c.role_tags || []).indexOf(f.role) === -1) return false;
      return true;
    });
  }

  function filteredFacilities() {
    var cities = filteredCities();
    var ids = {};
    cities.forEach(function (c) { ids[c.id] = 1; });
    return D.facilities.filter(function (fac) { return ids[fac.city_id]; });
  }

  function renderKpis() {
    $('kpi-cities').textContent = D.cities.length || '0';
    $('kpi-orgs').textContent = D.organizations.length || '0';
    $('kpi-facilities').textContent = D.facilities.length || '0';
    $('kpi-clusters').textContent = D.clusters.length || '0';
    var outN = D.cities.filter(function (c) {
      var s = D.stat2025(c.id); return s && s.total_vehicle_output != null;
    }).length;
    $('kpi-output-cities').textContent = outN || '0';
  }

  function fillMapSelects() {
    var roles = uniq(D.cities.reduce(function (a, c) { return a.concat(c.role_tags || []); }, []));
    var clusters = D.clusters;
    $('map-filter-role').innerHTML = opt('', I18N.t('allRoles')) + roles.map(function (r) { return opt(r, I18N.enumLabel('role_tag', r)); }).join('');
    $('map-filter-cluster').innerHTML = opt('', I18N.t('allClusters')) + clusters.map(function (cl) { return opt(cl.id, I18N.name(cl)); }).join('');
    $('map-filter-tier').innerHTML = opt('', I18N.t('allTiers')) +
      opt('core', I18N.enumLabel('city_tier', 'core')) + opt('specialist', I18N.enumLabel('city_tier', 'specialist'));
    var dims = [['output', 'dimOutput'], ['cluster', 'dimCluster'], ['role', 'dimRole']];
    $('map-dims').innerHTML = dims.map(function (d) {
      return '<button type="button" data-dim="' + d[0] + '" class="' + (d[0] === state.map.dim ? 'active' : '') + '">' + I18N.t(d[1]) + '</button>';
    }).join('');
    var layers = [['cities', 'layerCities'], ['facilities', 'layerFacilities']];
    $('map-layers').innerHTML = layers.map(function (d) {
      return '<button type="button" data-layer="' + d[0] + '" class="' + (d[0] === state.map.layer ? 'active' : '') + '">' + I18N.t(d[1]) + '</button>';
    }).join('');
  }

  function renderMap() {
    MAP.render({
      dim: state.map.dim, layer: state.map.layer,
      cities: filteredCities(), facilities: filteredFacilities(), clusters: D.clusters,
      getCity: D.getCity, getStat: D.stat2025,
      clusterName: function (id) { var cl = D.getCluster(id); return cl ? I18N.name(cl) : id; },
      onClick: function (id, kind) {
        if (kind === 'city') openCityModal(id);
        else {
          var f = D.getFacility(id);
          if (f && f.city_id) openCityModal(f.city_id);
        }
      }
    });
  }

  function filteredCatalog() {
    var f = state.cat, q = f.search.toLowerCase();
    var list = D.cities.filter(function (c) {
      if (f.tier && c.tier !== f.tier) return false;
      if (f.cluster && (c.cluster_ids || []).indexOf(f.cluster) === -1) return false;
      if (f.role && (c.role_tags || []).indexOf(f.role) === -1) return false;
      if (q && !S.match(c, q)) return false;
      return true;
    });
    var k = f.sort, dir = f.dir;
    list.sort(function (a, b) {
      var va, vb;
      if (k === 'name') { return I18N.name(a).localeCompare(I18N.name(b)) * dir; }
      if (k === 'province') { va = I18N.pick(a.province_zh, a.province_en); vb = I18N.pick(b.province_zh, b.province_en); return va.localeCompare(vb) * dir; }
      if (k === 'tier') { va = a.tier || ''; vb = b.tier || ''; return va.localeCompare(vb) * dir; }
      if (k === 'output') {
        va = (D.stat2025(a.id) || {}).total_vehicle_output || -1;
        vb = (D.stat2025(b.id) || {}).total_vehicle_output || -1;
        return (va - vb) * dir;
      }
      if (k === 'orgs') { return (orgCount(a.id) - orgCount(b.id)) * dir; }
      return 0;
    });
    return list;
  }

  function renderCatalog() {
    var cols = [['name', 'thCity'], ['province', 'thProvince'], ['tier', 'thTier'], ['output', 'thOutput'], ['nev', 'thNev'], ['roles', 'thRoles'], ['orgs', 'thOrgs']];
    $('catalog-head').innerHTML = cols.map(function (c) {
      var arrow = state.cat.sort === c[0] ? (state.cat.dir > 0 ? ' ▲' : ' ▼') : '';
      return '<th data-sort="' + c[0] + '">' + I18N.t(c[1]) + arrow + '</th>';
    }).join('');
    var list = filteredCatalog();
    $('cat-count').textContent = list.length + ' / ' + D.cities.length;
    $('catalog-body').innerHTML = list.map(function (c) {
      var st = D.stat2025(c.id);
      var tags = (c.role_tags || []).slice(0, 3).map(rtBadge).join(' ');
      return '<tr data-city="' + esc(c.id) + '">' +
        '<td>' + esc(I18N.name(c)) + '</td>' +
        '<td>' + esc(I18N.pick(c.province_zh, c.province_en)) + '</td>' +
        '<td>' + tierBadge(c.tier) + '</td>' +
        '<td class="num">' + fmtWan(st && st.total_vehicle_output) + '</td>' +
        '<td class="num">' + fmtWan(st && st.nev_output) + '</td>' +
        '<td>' + tags + '</td>' +
        '<td class="num">' + orgCount(c.id) + '</td></tr>';
    }).join('') || '<tr><td colspan="7" class="loading">' + I18N.t('noData') + '</td></tr>';
  }

  function renderClusters() {
    $('cluster-cards').innerHTML = D.clusters.map(function (cl) {
      var cities = (cl.city_ids || []).map(function (id) { var c = D.getCity(id); return c ? I18N.name(c) : id; }).join(' · ');
      return '<article class="cluster-card" data-cluster="' + esc(cl.id) + '">' +
        '<h3>' + esc(I18N.name(cl)) + '</h3>' +
        '<p>' + esc(I18N.pick(cl.summary_zh, cl.summary_en)) + '</p>' +
        '<p class="text-faint text-xs mt-2">' + I18N.t('citiesInCluster') + ': ' + esc(cities) + '</p></article>';
    }).join('') || '<p class="loading">' + I18N.t('noData') + '</p>';
    CH.renderClusterGraph(D.cities, D.relations, D.clusters, D.getCluster);
  }

  function parentName(o) {
    if (!o || !o.parent_id) return '';
    var p = D.getOrg(o.parent_id);
    return p ? I18N.name(p) : o.parent_id;
  }
  function hqName(o) {
    if (!o || !o.headquarters_city_id) return '';
    var c = D.getCity(o.headquarters_city_id);
    return c ? I18N.name(c) : '';
  }

  function filteredOrgs() {
    var f = state.org, q = f.search;
    var list = D.organizations.filter(function (o) {
      if (f.type && o.organization_type !== f.type) return false;
      if (q && !S.match(o, q)) return false;
      return true;
    });
    var k = f.sort, dir = f.dir;
    list.sort(function (a, b) {
      var d;
      if (k === 'type') {
        d = typeRank(a.organization_type) - typeRank(b.organization_type);
        if (d) return d * dir;
        return localeName(a, b) * dir;
      }
      if (k === 'parent') return parentName(a).localeCompare(parentName(b), I18N.isEn() ? 'en' : 'zh') * dir;
      if (k === 'hq') return hqName(a).localeCompare(hqName(b), I18N.isEn() ? 'en' : 'zh') * dir;
      if (k === 'founded') return ((a.founded_year || 0) - (b.founded_year || 0)) * dir;
      if (k === 'ownership') return (enrichOf(a).ownership || '').localeCompare(enrichOf(b).ownership || '') * dir;
      if (k === 'listing') {
        var la = (enrichOf(a).listing && enrichOf(a).listing.listed) ? 1 : 0;
        var lb = (enrichOf(b).listing && enrichOf(b).listing.listed) ? 1 : 0;
        return (la - lb) * dir;
      }
      if (k === 'employees') return ((((enrichOf(a).employees || {}).value) || -1) - (((enrichOf(b).employees || {}).value) || -1)) * dir;
      if (k === 'sales') return ((((enrichOf(a).vehicle_sales || {}).value) || -1) - (((enrichOf(b).vehicle_sales || {}).value) || -1)) * dir;
      if (k === 'plants') return (D.plantCount(a.id) - D.plantCount(b.id)) * dir;
      if (k === 'children') return (D.childrenOf(a.id).length - D.childrenOf(b.id).length) * dir;
      if (k === 'export') return (enrichOf(a).export_role || '').localeCompare(enrichOf(b).export_role || '') * dir;
      return localeName(a, b) * dir;
    });
    return list;
  }

  function renderOrgChips() {
    var counts = {};
    D.organizations.forEach(function (o) {
      counts[o.organization_type] = (counts[o.organization_type] || 0) + 1;
    });
    var types = ORG_TYPE_ORDER.filter(function (t) { return counts[t]; });
    var html = '<button type="button" class="type-chip' + (!state.org.type ? ' active' : '') + '" data-org-type="" aria-pressed="' + (!state.org.type ? 'true' : 'false') + '">' +
      I18N.t('allTypes') + ' · ' + D.organizations.length + '</button>';
    html += types.map(function (t) {
      var on = state.org.type === t;
      return '<button type="button" class="type-chip' + (on ? ' active' : '') + '" data-org-type="' + esc(t) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        esc(I18N.enumLabel('organization_type', t)) + ' · ' + counts[t] + '</button>';
    }).join('');
    $('org-type-chips').innerHTML = html;
  }

  function renderOrgGroupChips() {
    var groups = [['identity', 'colGroupIdentity'], ['scale', 'colGroupScale'], ['product', 'colGroupProduct'], ['network', 'colGroupNetwork']];
    $('org-col-groups').innerHTML = groups.map(function (g) {
      var on = !!state.org.groups[g[0]];
      return '<button type="button" class="type-chip' + (on ? ' active' : '') + '" data-org-group="' + g[0] + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        I18N.t(g[1]) + '</button>';
    }).join('');
  }

  function orgCols() {
    var g = state.org.groups;
    var cols = [
      { key: 'name', label: 'thName', group: 'core' },
      { key: 'type', label: 'thType', group: 'core' },
      { key: 'parent', label: 'thParent', group: 'identity' },
      { key: 'hq', label: 'thHq', group: 'identity' },
      { key: 'founded', label: 'thFounded', group: 'identity' },
      { key: 'ownership', label: 'thOwnership', group: 'identity' },
      { key: 'listing', label: 'thListing', group: 'identity' },
      { key: 'employees', label: 'thEmployees', group: 'scale' },
      { key: 'sales', label: 'thSales', group: 'scale' },
      { key: 'plants', label: 'thPlants', group: 'scale' },
      { key: 'powertrain', label: 'thPowertrain', group: 'product' },
      { key: 'segment', label: 'thSegment', group: 'product' },
      { key: 'export', label: 'thExport', group: 'product' },
      { key: 'children', label: 'thChildren', group: 'network' }
    ];
    return cols.filter(function (c) { return c.group === 'core' || g[c.group]; });
  }

  function orgCell(o, key) {
    var en = enrichOf(o);
    if (key === 'name') return esc(I18N.name(o));
    if (key === 'type') return '<span class="badge" style="background:var(--bg-elev)">' + esc(I18N.enumLabel('organization_type', o.organization_type)) + '</span>';
    if (key === 'parent') {
      var parent = o.parent_id ? D.getOrg(o.parent_id) : null;
      return parent ? '<button type="button" class="chip-link" data-org-link="' + esc(parent.id) + '">' + esc(I18N.name(parent)) + '</button>' : dash();
    }
    if (key === 'hq') {
      var hq = o.headquarters_city_id ? D.getCity(o.headquarters_city_id) : null;
      return hq ? '<button type="button" class="chip-link" data-city-link="' + esc(hq.id) + '">' + esc(I18N.name(hq)) + '</button>' : dash();
    }
    if (key === 'founded') return o.founded_year || dash();
    if (key === 'ownership') return en.ownership ? esc(I18N.enumLabel('ownership', en.ownership)) : dash();
    if (key === 'listing') {
      var L = en.listing;
      if (!L || !L.listed) return dash();
      return esc((L.ticker || '') + (L.exchange ? '.' + L.exchange : ''));
    }
    if (key === 'employees') return fmtMetric(en.employees, 'people');
    if (key === 'sales') return fmtMetric(en.vehicle_sales, 'vehicles');
    if (key === 'plants') {
      var n = D.plantCount(o.id);
      return n ? '<span class="num">' + n + '</span>' : dash();
    }
    if (key === 'powertrain') return tinyBadges(en.powertrain, 'powertrain');
    if (key === 'segment') return tinyBadges(en.segment, 'segment');
    if (key === 'export') return en.export_role ? esc(I18N.enumLabel('export_role', en.export_role)) : dash();
    if (key === 'children') {
      var kids = D.childrenOf(o.id);
      return kids.length ? String(kids.length) : dash();
    }
    return dash();
  }

  function renderOrgs() {
    renderOrgChips();
    renderOrgGroupChips();
    var cols = orgCols();
    $('orgs-head').innerHTML = cols.map(function (c) {
      var arrow = state.org.sort === c.key ? (state.org.dir > 0 ? ' ▲' : ' ▼') : '';
      return '<th data-sort="' + c.key + '">' + I18N.t(c.label) + arrow + '</th>';
    }).join('');
    var list = filteredOrgs();
    $('org-count').textContent = list.length + ' / ' + D.organizations.length;
    $('orgs-body').innerHTML = list.map(function (o) {
      return '<tr data-org="' + esc(o.id) + '">' + cols.map(function (c) {
        return '<td' + (c.key === 'employees' || c.key === 'sales' || c.key === 'plants' || c.key === 'children' ? ' class="num"' : '') + '>' + orgCell(o, c.key) + '</td>';
      }).join('') + '</tr>';
    }).join('') || '<tr><td colspan="' + cols.length + '" class="loading">' + I18N.t('noData') + '</td></tr>';
  }

  function renderMethodology() {
    var rows = D.sources.slice().sort(function (a, b) { return (a.grade || 'Z').localeCompare(b.grade || 'Z'); });
    $('sources-body').innerHTML = rows.map(function (s) {
      return '<tr>' +
        '<td>' + gradeBadge(s.grade) + '</td>' +
        '<td>' + esc(I18N.pick(s.publisher_zh, s.publisher_en)) + '</td>' +
        '<td>' + (s.url ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(I18N.pick(s.title_zh, s.title_en)) + '</a>' : esc(I18N.pick(s.title_zh, s.title_en))) + '</td>' +
        '<td>' + esc(s.source_type || '') + '</td>' +
        '<td>' + esc(s.published_at || s.fact_date || '') + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="loading">' + I18N.t('noData') + '</td></tr>';
    var foot = $('foot-build');
    if (foot && D.manifest) foot.textContent = (D.manifest.data_version || '') + ' · ' + (D.manifest.generated_at || '');
  }

  function renderAll() {
    renderKpis();
    CH.renderOverview(D.cities, D.stat2025);
    renderMap();
    renderCatalog();
    renderClusters();
    renderOrgs();
    renderMethodology();
    MAP.resize();
    CH.resizeAll();
  }

  // ---------- city modal ----------
  function openCityModal(id) {
    var city = D.getCity(id); if (!city) return;
    openCityId = id;
    $('city-modal-head').innerHTML =
      '<h3 class="text-xl font-semibold">' + esc(I18N.name(city)) + '</h3>' +
      '<div class="mt-1 flex flex-wrap items-center gap-2 text-sm">' + tierBadge(city.tier) +
      '<span class="text-muted">' + esc(I18N.pick(city.province_zh, city.province_en)) + '</span>' +
      confBadge(city.confidence) + '</div>';
    var tabs = ['tabOverview', 'tabOrgs', 'tabFacilities', 'tabRelations', 'tabStats'];
    if (tabs.indexOf(cityModalTab) === -1) cityModalTab = 'tabOverview';
    $('city-modal-tabs').innerHTML = tabs.map(function (t) {
      return '<button type="button" class="modal-tab-btn ' + (t === cityModalTab ? 'active' : '') + '" data-tab="' + t + '">' + I18N.t(t) + '</button>';
    }).join('');
    renderCityModalBody(city);
    $('city-modal').classList.remove('hidden');
    $('city-modal').setAttribute('aria-hidden', 'false');
  }

  function renderCityModalBody(city) {
    var body = '';
    if (cityModalTab === 'tabOverview') {
      body = '<p>' + esc(I18N.pick(city.summary_zh, city.summary_en)) + '</p>';
      if (city.history_summary_zh || city.history_summary_en) {
        body += '<h4>' + I18N.t('history') + '</h4><p>' + esc(I18N.pick(city.history_summary_zh, city.history_summary_en)) + '</p>';
      }
      body += '<h4>' + I18N.t('roleTags') + '</h4><p>' + (city.role_tags || []).map(rtBadge).join(' ') + '</p>';
      var dist = I18N.pick((city.districts_zh || []).join('、'), (city.districts_en || []).join(', '));
      if (dist) body += '<h4>' + I18N.t('districts') + '</h4><p>' + esc(dist) + '</p>';
    } else if (cityModalTab === 'tabOrgs') {
      var seen = {};
      var rows = [];
      D.rolesForCity(city.id).forEach(function (r) {
        if (seen[r.entity_id]) return;
        seen[r.entity_id] = 1;
        rows.push({ org: D.getOrg(r.entity_id), role: r });
      });
      D.orgsForCity(city.id).forEach(function (o) {
        if (seen[o.id]) return;
        seen[o.id] = 1;
        rows.push({ org: o, role: null });
      });
      body = rows.length ? '<ul>' + rows.map(function (row) {
        var ent = row.org;
        if (!ent) return '';
        var roleLabel = row.role ? I18N.enumLabel('role_type', row.role.role_type) : I18N.t('hqCity');
        return '<li><button type="button" class="chip-link" data-org-link="' + esc(ent.id) + '">' + esc(I18N.name(ent)) + '</button>' +
          ' <span class="badge" style="background:var(--bg-elev)">' + esc(I18N.enumLabel('organization_type', ent.organization_type)) + '</span>' +
          ' — <span class="text-faint">' + esc(roleLabel) + '</span></li>';
      }).join('') + '</ul>' : '<p class="text-faint">' + I18N.t('noData') + '</p>';
    } else if (cityModalTab === 'tabFacilities') {
      var facs = D.facilitiesForCity(city.id);
      body = facs.length ? '<ul>' + facs.map(function (f) {
        return '<li><b>' + esc(I18N.pick(f.name_zh, f.name_en)) + '</b> — ' + esc(I18N.enumLabel('facility_type', f.facility_type)) +
          ' <span class="text-faint">(' + esc(I18N.enumLabel('facility_status', f.status)) + ')</span></li>';
      }).join('') + '</ul>' : '<p class="text-faint">' + I18N.t('noData') + '</p>';
    } else if (cityModalTab === 'tabRelations') {
      var rels = D.relationsFor(city.id);
      body = rels.length ? '<ul>' + rels.map(function (r) {
        var otherId = r.from_id === city.id ? r.to_id : r.from_id;
        var other = D.getCity(otherId) || D.getOrg(otherId) || D.getCluster(otherId);
        var otherName = other ? I18N.name(other) : otherId;
        return '<li>' + esc(I18N.enumLabel('relation_type', r.relation_type)) + ' → ' + esc(otherName) +
          (r.description_zh || r.description_en ? '<br/><span class="text-muted">' + esc(I18N.pick(r.description_zh, r.description_en)) + '</span>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="text-faint">' + I18N.t('noData') + '</p>';
    } else if (cityModalTab === 'tabStats') {
      var stats = D.statsForCity(city.id);
      body = stats.length ? '<table class="data-table"><thead><tr><th>' + I18N.t('stats') + '</th><th>' + I18N.t('thOutput') + '</th><th>' + I18N.t('nev') + '</th></tr></thead><tbody>' +
        stats.map(function (s) {
          return '<tr><td>' + s.year + '</td><td class="num">' + fmtWan(s.total_vehicle_output) + '</td><td class="num">' + fmtWan(s.nev_output) + '</td></tr>';
        }).join('') + '</tbody></table>' : '<p class="text-faint">' + I18N.t('noData') + '</p>';
      stats.forEach(function (s) {
        if (s.scope_note_zh || s.scope_note_en) {
          body += '<p class="warn-box mt-2"><strong>' + I18N.t('statisticalScope') + ' (' + s.year + ')</strong><br/>' +
            esc(I18N.pick(s.scope_note_zh, s.scope_note_en)) + '</p>';
        }
      });
      var srcIds = [];
      stats.forEach(function (s) { (s.source_ids || []).forEach(function (x) { if (srcIds.indexOf(x) === -1) srcIds.push(x); }); });
      body += sourcesHtml(srcIds);
    }
    $('city-modal-body').innerHTML = body;
  }

  function openOrgModal(id) {
    var o = D.getOrg(id); if (!o) return;
    $('org-modal-head').innerHTML = '<h3 class="text-lg font-semibold">' + esc(I18N.name(o)) + '</h3>' +
      '<div class="text-sm text-muted mt-1">' + esc(I18N.enumLabel('organization_type', o.organization_type)) + '</div>';
    var hq = o.headquarters_city_id ? D.getCity(o.headquarters_city_id) : null;
    var parent = o.parent_id ? D.getOrg(o.parent_id) : null;
    var kids = D.childrenOf(o.id);
    var inst = D.institutionForOrg(o.id);
    var media = D.mediaForOrg(o.id);
    var en = enrichOf(o);
    var body = '<dl class="kv">' +
      (o.founded_year ? '<dt>' + I18N.t('founded') + '</dt><dd>' + o.founded_year + '</dd>' : '') +
      (hq ? '<dt>' + I18N.t('hqCity') + '</dt><dd><button type="button" class="chip-link" data-city-link="' + esc(hq.id) + '">' + esc(I18N.name(hq)) + '</button></dd>' : '<dt>' + I18N.t('hqCity') + '</dt><dd class="text-faint">' + I18N.t('hqUnknown') + '</dd>') +
      (parent ? '<dt>' + I18N.t('parentBrand') + '</dt><dd><button type="button" class="chip-link" data-org-link="' + esc(parent.id) + '">' + esc(I18N.name(parent)) + '</button></dd>' : '') +
      (kids.length ? '<dt>' + I18N.t('childBrands') + '</dt><dd>' + kids.map(function (k) {
        return '<button type="button" class="chip-link" data-org-link="' + esc(k.id) + '">' + esc(I18N.name(k)) + '</button>';
      }).join(' ') + '</dd>' : '') +
      (o.website ? '<dt>' + I18N.t('website') + '</dt><dd><a href="' + esc(o.website) + '" target="_blank" rel="noopener">' + esc(o.website) + '</a></dd>' : '') +
      (o.status ? '<dt>' + I18N.t('status') + '</dt><dd>' + esc(o.status) + '</dd>' : '') +
      (en.ownership ? '<dt>' + I18N.t('thOwnership') + '</dt><dd>' + esc(I18N.enumLabel('ownership', en.ownership)) + '</dd>' : '') +
      (en.listing && en.listing.listed ? '<dt>' + I18N.t('thListing') + '</dt><dd>' + esc((en.listing.ticker || '') + (en.listing.exchange ? ' · ' + en.listing.exchange : '')) + '</dd>' : '') +
      (en.employees ? '<dt>' + I18N.t('thEmployees') + '</dt><dd>' + fmtMetric(en.employees, 'people') + (en.employees.source_url ? ' <a href="' + esc(en.employees.source_url) + '" target="_blank" rel="noopener">↗</a>' : '') + '</dd>' : '') +
      (en.vehicle_sales ? '<dt>' + I18N.t('thSales') + '</dt><dd>' + fmtMetric(en.vehicle_sales, 'vehicles') + (en.vehicle_sales.source_url ? ' <a href="' + esc(en.vehicle_sales.source_url) + '" target="_blank" rel="noopener">↗</a>' : '') + '</dd>' : '') +
      (en.export_role ? '<dt>' + I18N.t('thExport') + '</dt><dd>' + esc(I18N.enumLabel('export_role', en.export_role)) + '</dd>' : '') +
      '</dl>';
    if (en.powertrain && en.powertrain.length) body += '<h4>' + I18N.t('thPowertrain') + '</h4><p>' + tinyBadges(en.powertrain, 'powertrain') + '</p>';
    if (en.segment && en.segment.length) body += '<h4>' + I18N.t('thSegment') + '</h4><p>' + tinyBadges(en.segment, 'segment') + '</p>';
    if (en.education_tags && en.education_tags.length) body += '<h4>' + I18N.t('school') + '</h4><p>' + tinyBadges(en.education_tags, 'education_tag') + '</p>';
    if (inst) {
      body += '<h4>' + I18N.t('college') + '</h4><p>' + esc(I18N.pick(inst.college_zh, inst.college_en) || '—') + '</p>';
      if (inst.strengths_zh || inst.strengths_en) {
        body += '<h4>' + I18N.t('strengths') + '</h4><p>' + esc(I18N.pick(inst.strengths_zh, inst.strengths_en)) + '</p>';
      }
    }
    if (media) {
      var ed = media.editorial_city_id ? D.getCity(media.editorial_city_id) : null;
      body += '<dl class="kv mt-2">' +
        '<dt>' + I18N.t('thType') + '</dt><dd>' + esc(I18N.enumLabel('media_type', media.media_type)) +
        (media.national_platform ? ' · ' + I18N.t('nationalPlatform') : '') + '</dd>' +
        (ed ? '<dt>' + I18N.t('editorialCity') + '</dt><dd><button type="button" class="chip-link" data-city-link="' + esc(ed.id) + '">' + esc(I18N.name(ed)) + '</button></dd>' : '') +
        '</dl>';
    }
    var rels = D.relationsFor(o.id).filter(function (r) {
      return r.from_id === o.id && r.relation_type !== 'belongs_to_cluster' && r.relation_type !== 'cluster_adjacent';
    });
    if (rels.length) {
      body += '<h4>' + I18N.t('relations') + '</h4><ul>' + rels.map(function (r) {
        var other = D.getOrg(r.to_id) || D.getCity(r.to_id);
        var otherName = other ? I18N.name(other) : r.to_id;
        var link;
        if (other && other.organization_type) {
          link = '<button type="button" class="chip-link" data-org-link="' + esc(r.to_id) + '">' + esc(otherName) + '</button>';
        } else if (other && other.admin_level) {
          link = '<button type="button" class="chip-link" data-city-link="' + esc(r.to_id) + '">' + esc(otherName) + '</button>';
        } else {
          link = esc(otherName);
        }
        return '<li>' + esc(I18N.enumLabel('relation_type', r.relation_type)) + ' → ' + link + '</li>';
      }).join('') + '</ul>';
    }
    body += sourcesHtml(o.source_ids);
    $('org-modal-body').innerHTML = body;
    $('org-modal').classList.remove('hidden');
  }

  function closeModals() {
    ['city-modal', 'org-modal'].forEach(function (id) {
      $(id).classList.add('hidden');
      $(id).setAttribute('aria-hidden', 'true');
    });
  }

  function toggleTheme() {
    var dark = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('china-auto-theme', dark ? 'dark' : 'light'); } catch (e) {}
    renderAll();
    MAP.setTheme();
    CH.setTheme();
  }

  function restoreFilters() {
    $('map-filter-role').value = state.map.role;
    $('map-filter-cluster').value = state.map.cluster;
    $('map-filter-tier').value = state.map.tier;
    $('cat-filter-tier').value = state.cat.tier;
    $('cat-filter-role').value = state.cat.role;
    $('cat-filter-cluster').value = state.cat.cluster;
    $('cat-search').value = state.cat.search;
    $('org-search').value = state.org.search;
  }

  var searchHits = [];
  var searchSel = -1;

  function collectSearch(q) {
    var hits = [];
    if (!q || !S.fold(q)) return hits;
    D.cities.forEach(function (c) {
      if (S.match(c, q)) hits.push({ kind: 'city', id: c.id, score: S.score(c, q), label: I18N.name(c), sub: I18N.pick(c.province_zh, c.province_en) });
    });
    D.organizations.forEach(function (o) {
      if (S.match(o, q)) {
        var hq = o.headquarters_city_id ? D.getCity(o.headquarters_city_id) : null;
        hits.push({
          kind: 'org', id: o.id, orgType: o.organization_type, score: S.score(o, q), label: I18N.name(o),
          sub: I18N.enumLabel('organization_type', o.organization_type) + (hq ? ' · ' + I18N.name(hq) : '')
        });
      }
    });
    function byScore(a, b) { return b.score !== a.score ? b.score - a.score : a.label.localeCompare(b.label, I18N.isEn() ? 'en' : 'zh'); }
    var cities = hits.filter(function (h) { return h.kind === 'city'; }).sort(byScore);
    var orgs = hits.filter(function (h) { return h.kind === 'org'; }).sort(function (a, b) {
      var d = typeRank(a.orgType) - typeRank(b.orgType);
      if (d) return d;
      return byScore(a, b);
    });
    return cities.concat(orgs).slice(0, 12);
  }

  function hideSearchPop() {
    var box = $('search-results'), inp = $('global-search');
    box.classList.add('hidden');
    box.innerHTML = '';
    if (inp) inp.setAttribute('aria-expanded', 'false');
    searchHits = [];
    searchSel = -1;
  }

  function renderSearchPop(q) {
    var box = $('search-results'), inp = $('global-search');
    searchHits = collectSearch(q);
    if (!S.fold(q)) { hideSearchPop(); return; }
    inp.setAttribute('aria-expanded', 'true');
    box.classList.remove('hidden');
    if (!searchHits.length) {
      box.innerHTML = '<div class="search-pop-empty">' + I18N.t('searchNoResult') + '</div>';
      searchSel = -1;
      return;
    }
    if (searchSel < 0 || searchSel >= searchHits.length) searchSel = 0;
    var html = '', last = '';
    searchHits.forEach(function (h, i) {
      var group = h.kind === 'city' ? I18N.t('searchCities')
        : h.orgType === 'brand' ? I18N.t('searchBrands')
        : h.orgType === 'university' ? I18N.t('searchUnis')
        : h.orgType === 'media_company' ? I18N.t('searchMedia')
        : I18N.t('searchOrgs');
      if (group !== last) { html += '<div class="search-pop-group">' + esc(group) + '</div>'; last = group; }
      html += '<button type="button" class="search-pop-item" role="option" data-i="' + i + '" aria-selected="' + (i === searchSel) + '">' +
        esc(h.label) + (h.sub ? ' <span class="text-faint text-xs">' + esc(h.sub) + '</span>' : '') + '</button>';
    });
    box.innerHTML = html;
  }

  function activateSearchHit(i) {
    var h = searchHits[i]; if (!h) return;
    hideSearchPop();
    $('global-search').blur();
    if (h.kind === 'city') { cityModalTab = 'tabOverview'; openCityModal(h.id); }
    else openOrgModal(h.id);
  }

  function bind() {
    $('lang-toggle').addEventListener('click', function () { I18N.toggleLang(); });
    $('theme-toggle').addEventListener('click', toggleTheme);

    document.querySelectorAll('[data-close-city]').forEach(function (b) {
      b.addEventListener('click', closeModals);
    });
    document.querySelectorAll('[data-close-org]').forEach(function (b) {
      b.addEventListener('click', function () { $('org-modal').classList.add('hidden'); });
    });
    [['city-modal'], ['org-modal']].forEach(function (m) {
      $(m[0]).addEventListener('click', function (e) { if (e.target === this) closeModals(); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { hideSearchPop(); closeModals(); }
      var tag = (e.target && e.target.tagName) || '';
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        $('global-search').focus();
      }
    });

    $('global-search').addEventListener('input', function (e) { renderSearchPop(e.target.value); });
    $('global-search').addEventListener('focus', function (e) { if (e.target.value) renderSearchPop(e.target.value); });
    $('global-search').addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!searchHits.length) { searchSel = 0; renderSearchPop(e.target.value); return; }
        searchSel = Math.min(searchHits.length - 1, searchSel + 1);
        renderSearchPop(e.target.value);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        searchSel = Math.max(0, searchSel - 1);
        renderSearchPop(e.target.value);
      } else if (e.key === 'Enter') {
        if (searchHits.length) { e.preventDefault(); activateSearchHit(searchSel < 0 ? 0 : searchSel); }
      } else if (e.key === 'Escape') {
        hideSearchPop(); e.target.blur();
      }
    });
    $('search-results').addEventListener('mousedown', function (e) {
      var btn = e.target.closest('[data-i]'); if (!btn) return;
      e.preventDefault();
      activateSearchHit(parseInt(btn.getAttribute('data-i'), 10));
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search-wrap')) hideSearchPop();
    });

    $('map-dims').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-dim]'); if (!b) return;
      state.map.dim = b.getAttribute('data-dim');
      $('map-dims').querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
      renderMap();
    });
    $('map-layers').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-layer]'); if (!b) return;
      state.map.layer = b.getAttribute('data-layer');
      $('map-layers').querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
      renderMap();
    });
    $('map-filter-role').addEventListener('change', function (e) { state.map.role = e.target.value; renderMap(); renderCatalog(); });
    $('map-filter-cluster').addEventListener('change', function (e) { state.map.cluster = e.target.value; renderMap(); renderCatalog(); });
    $('map-filter-tier').addEventListener('change', function (e) { state.map.tier = e.target.value; renderMap(); renderCatalog(); });
    $('map-reset').addEventListener('click', function () {
      state.map.role = state.map.cluster = state.map.tier = '';
      restoreFilters(); renderMap(); renderCatalog();
    });

    $('cat-search').addEventListener('input', function (e) { state.cat.search = e.target.value; renderCatalog(); });
    $('cat-filter-tier').addEventListener('change', function (e) { state.cat.tier = e.target.value; renderCatalog(); });
    $('cat-filter-role').addEventListener('change', function (e) { state.cat.role = e.target.value; renderCatalog(); });
    $('cat-filter-cluster').addEventListener('change', function (e) { state.cat.cluster = e.target.value; renderCatalog(); });
    $('cat-reset').addEventListener('click', function () {
      state.cat.search = state.cat.tier = state.cat.role = state.cat.cluster = '';
      restoreFilters(); renderCatalog();
    });
    $('catalog-head').addEventListener('click', function (e) {
      var th = e.target.closest('th[data-sort]'); if (!th) return;
      var k = th.getAttribute('data-sort');
      if (state.cat.sort === k) state.cat.dir *= -1; else { state.cat.sort = k; state.cat.dir = k === 'name' ? 1 : -1; }
      renderCatalog();
    });
    $('catalog-body').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-city]'); if (tr) { cityModalTab = 'tabOverview'; openCityModal(tr.getAttribute('data-city')); }
    });

    $('city-modal-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]'); if (!b) return;
      cityModalTab = b.getAttribute('data-tab');
      $('city-modal-tabs').querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
      if (openCityId) { var c = D.getCity(openCityId); if (c) renderCityModalBody(c); }
    });
    $('city-modal-body').addEventListener('click', function (e) {
      var ol = e.target.closest('[data-org-link]'); if (ol) { openOrgModal(ol.getAttribute('data-org-link')); return; }
      var cl = e.target.closest('[data-city-link]'); if (cl) { cityModalTab = 'tabOverview'; openCityModal(cl.getAttribute('data-city-link')); }
    });

    $('org-search').addEventListener('input', function (e) { state.org.search = e.target.value; renderOrgs(); });
    $('org-type-chips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-org-type]'); if (!b) return;
      state.org.type = b.getAttribute('data-org-type') || '';
      renderOrgs();
    });
    $('org-col-groups').addEventListener('click', function (e) {
      var b = e.target.closest('[data-org-group]'); if (!b) return;
      var g = b.getAttribute('data-org-group');
      state.org.groups[g] = !state.org.groups[g];
      renderOrgs();
    });
    $('orgs-head').addEventListener('click', function (e) {
      var th = e.target.closest('th[data-sort]'); if (!th) return;
      var k = th.getAttribute('data-sort');
      if (state.org.sort === k) state.org.dir *= -1; else { state.org.sort = k; state.org.dir = 1; }
      renderOrgs();
    });
    $('orgs-body').addEventListener('click', function (e) {
      var ol = e.target.closest('[data-org-link]'); if (ol) { e.stopPropagation(); openOrgModal(ol.getAttribute('data-org-link')); return; }
      var cl = e.target.closest('[data-city-link]'); if (cl) { e.stopPropagation(); openCityModal(cl.getAttribute('data-city-link')); return; }
      var tr = e.target.closest('tr[data-org]'); if (tr) openOrgModal(tr.getAttribute('data-org'));
    });
    $('org-modal-body').addEventListener('click', function (e) {
      var ol = e.target.closest('[data-org-link]'); if (ol) { openOrgModal(ol.getAttribute('data-org-link')); return; }
      var cl = e.target.closest('[data-city-link]'); if (cl) { closeModals(); openCityModal(cl.getAttribute('data-city-link')); }
    });
    $('cluster-cards').addEventListener('click', function (e) {
      var card = e.target.closest('[data-cluster]'); if (!card) return;
      var cl = D.getCluster(card.getAttribute('data-cluster'));
      if (cl && cl.city_ids && cl.city_ids[0]) openCityModal(cl.city_ids[0]);
    });

    var catRoles = uniq(D.cities.reduce(function (a, c) { return a.concat(c.role_tags || []); }, []));
    $('cat-filter-role').innerHTML = opt('', I18N.t('allRoles')) + catRoles.map(function (r) { return opt(r, I18N.enumLabel('role_tag', r)); }).join('');
    $('cat-filter-cluster').innerHTML = opt('', I18N.t('allClusters')) + D.clusters.map(function (cl) { return opt(cl.id, I18N.name(cl)); }).join('');
    $('cat-filter-tier').innerHTML = opt('', I18N.t('allTiers')) +
      opt('core', I18N.enumLabel('city_tier', 'core')) + opt('specialist', I18N.enumLabel('city_tier', 'specialist'));

    I18N.onChange(function () {
      fillMapSelects();
      var catRoles = uniq(D.cities.reduce(function (a, c) { return a.concat(c.role_tags || []); }, []));
      $('cat-filter-role').innerHTML = opt('', I18N.t('allRoles')) + catRoles.map(function (r) { return opt(r, I18N.enumLabel('role_tag', r)); }).join('');
      $('cat-filter-cluster').innerHTML = opt('', I18N.t('allClusters')) + D.clusters.map(function (cl) { return opt(cl.id, I18N.name(cl)); }).join('');
      $('cat-filter-tier').innerHTML = opt('', I18N.t('allTiers')) +
        opt('core', I18N.enumLabel('city_tier', 'core')) + opt('specialist', I18N.enumLabel('city_tier', 'specialist'));
      restoreFilters(); renderAll();
      if (openCityId && !$('city-modal').classList.contains('hidden')) {
        var c = D.getCity(openCityId); if (c) {
          $('city-modal-tabs').querySelectorAll('button').forEach(function (b) {
            b.textContent = I18N.t(b.getAttribute('data-tab'));
          });
          renderCityModalBody(c);
        }
      }
    });
  }

  function applyLegacyHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (h === 'institutions') state.org.type = 'university';
    else if (h === 'media') state.org.type = 'media_company';
    else return;
    renderOrgs();
    var el = $('orgs');
    if (el) el.scrollIntoView({ block: 'start' });
  }

  async function init() {
    I18N.applyLangToUI();
    try {
      await D.initCore();
      fillMapSelects();
      bind();
      renderAll();
      applyLegacyHash();
      window.addEventListener('hashchange', applyLegacyHash);
    } catch (e) {
      console.error('[china-auto]', e);
      $('init-error').classList.remove('hidden');
      try { bind(); } catch (e2) {}
    }
  }

  window.CHINA_AUTO_APP = { init: init, openCityModal: openCityModal };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
