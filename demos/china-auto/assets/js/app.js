/* Orchestrator: filters, KPIs, catalogs, modals, theme. window.CHINA_AUTO_APP */
(function () {
  'use strict';
  var I18N = window.CHINA_AUTO_I18N, D = window.CHINA_AUTO_DATA, CH = window.CHINA_AUTO_CHARTS, MAP = window.CHINA_AUTO_MAP;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    map: { dim: 'output', role: '', cluster: '', tier: '', layer: 'cities' },
    cat: { search: '', tier: '', role: '', cluster: '', sort: 'output', dir: -1 },
    org: { search: '', type: '' }
  };
  var cityModalTab = 'tabOverview';
  var openCityId = null;

  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]; }); }
  function uniq(a) { var o = {}; a.forEach(function (x) { if (x) o[x] = 1; }); return Object.keys(o); }
  function opt(v, label) { return '<option value="' + esc(v) + '">' + esc(label) + '</option>'; }

  function fmtWan(val) {
    if (val == null) return '—';
    return (val / 10000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
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
      if (q) {
        var hay = ((c.name_zh || '') + ' ' + (c.name_en || '') + ' ' + (c.province_zh || '') + ' ' + (c.province_en || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
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

  function filteredOrgs() {
    var f = state.org, q = f.search.toLowerCase();
    return D.organizations.filter(function (o) {
      if (f.type && o.organization_type !== f.type) return false;
      if (q) {
        var hay = ((o.display_name_zh || '') + ' ' + (o.display_name_en || '') + ' ' + (o.legal_name_zh || '') + ' ' + (o.legal_name_en || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderOrgs() {
    var types = uniq(D.organizations.map(function (o) { return o.organization_type; }));
    $('org-filter-type').innerHTML = opt('', I18N.t('allTypes')) + types.map(function (t) { return opt(t, I18N.enumLabel('organization_type', t)); }).join('');
    var list = filteredOrgs();
    $('org-count').textContent = list.length + ' / ' + D.organizations.length;
    $('orgs-list').innerHTML = list.map(function (o) {
      var hq = o.headquarters_city_id ? D.getCity(o.headquarters_city_id) : null;
      return '<div class="list-card" data-org="' + esc(o.id) + '">' +
        '<div class="font-medium">' + esc(I18N.name(o)) + '</div>' +
        '<div class="text-faint text-xs mt-1">' +
        '<span class="badge" style="background:var(--bg-elev)">' + esc(I18N.enumLabel('organization_type', o.organization_type)) + '</span>' +
        (hq ? ' · ' + I18N.t('hqCity') + ': <button type="button" class="chip-link" data-city-link="' + esc(hq.id) + '">' + esc(I18N.name(hq)) + '</button>' : '') +
        '</div></div>';
    }).join('') || '<p class="loading">' + I18N.t('noData') + '</p>';
  }

  function renderInstitutions() {
    $('inst-list').innerHTML = D.institutions.map(function (i) {
      var city = D.getCity(i.city_id);
      return '<div class="list-card" data-inst="' + esc(i.id) + '">' +
        '<div class="font-medium">' + esc(I18N.name(i)) + '</div>' +
        '<div class="text-muted text-xs mt-1">' + esc(I18N.pick(i.college_zh, i.college_en)) + '</div>' +
        '<div class="text-faint text-xs mt-1">' + esc(I18N.pick(i.strengths_zh, i.strengths_en)) +
        (city ? ' · <button type="button" class="chip-link" data-city-link="' + esc(city.id) + '">' + esc(I18N.name(city)) + '</button>' : '') +
        '</div></div>';
    }).join('') || '<p class="loading">' + I18N.t('noData') + '</p>';
  }

  function renderMedia() {
    $('media-list').innerHTML = D.media.map(function (m) {
      var ed = m.editorial_city_id ? D.getCity(m.editorial_city_id) : null;
      return '<div class="list-card" data-media="' + esc(m.id) + '">' +
        '<div class="font-medium">' + esc(I18N.name(m)) + '</div>' +
        '<div class="text-faint text-xs mt-1">' +
        '<span class="badge" style="background:var(--bg-elev)">' + esc(I18N.enumLabel('media_type', m.media_type)) + '</span>' +
        (m.national_platform ? ' <span class="badge badge-tier-core">' + I18N.t('nationalPlatform') + '</span>' : '') +
        (ed ? ' · ' + I18N.t('editorialCity') + ': <button type="button" class="chip-link" data-city-link="' + esc(ed.id) + '">' + esc(I18N.name(ed)) + '</button>' : '') +
        '</div></div>';
    }).join('') || '<p class="loading">' + I18N.t('noData') + '</p>';
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
    renderInstitutions();
    renderMedia();
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
    var tabs = ['tabOverview', 'tabOrgs', 'tabFacilities', 'tabInstMedia', 'tabRelations', 'tabStats'];
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
      var roles = D.rolesForCity(city.id);
      body = roles.length ? '<ul>' + roles.map(function (r) {
        var ent = D.getOrg(r.entity_id);
        var label = ent ? I18N.name(ent) : r.entity_id;
        var link = ent ? ' <button type="button" class="chip-link" data-org-link="' + esc(ent.id) + '">' + esc(label) + '</button>' : esc(label);
        return '<li>' + link + ' — <span class="text-faint">' + esc(I18N.enumLabel('role_type', r.role_type)) + '</span>' +
          (r.description_zh || r.description_en ? '<br/><span class="text-muted">' + esc(I18N.pick(r.description_zh, r.description_en)) + '</span>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="text-faint">' + I18N.t('noData') + '</p>';
      var hqOrgs = D.orgsForCity(city.id);
      if (hqOrgs.length) {
        body += '<h4>' + I18N.t('hqCity') + '</h4><p>' + hqOrgs.map(function (o) {
          return '<button type="button" class="chip-link" data-org-link="' + esc(o.id) + '">' + esc(I18N.name(o)) + '</button>';
        }).join(' ') + '</p>';
      }
    } else if (cityModalTab === 'tabFacilities') {
      var facs = D.facilitiesForCity(city.id);
      body = facs.length ? '<ul>' + facs.map(function (f) {
        return '<li><b>' + esc(I18N.pick(f.name_zh, f.name_en)) + '</b> — ' + esc(I18N.enumLabel('facility_type', f.facility_type)) +
          ' <span class="text-faint">(' + esc(I18N.enumLabel('facility_status', f.status)) + ')</span></li>';
      }).join('') + '</ul>' : '<p class="text-faint">' + I18N.t('noData') + '</p>';
    } else if (cityModalTab === 'tabInstMedia') {
      var inst = D.institutionsForCity(city.id), med = D.mediaForCity(city.id);
      body += '<h4>' + I18N.t('institutions') + '</h4>';
      body += inst.length ? '<ul>' + inst.map(function (i) { return '<li>' + esc(I18N.name(i)) + '</li>'; }).join('') + '</ul>' : '<p class="text-faint">' + I18N.t('noData') + '</p>';
      body += '<h4>' + I18N.t('media') + '</h4>';
      body += med.length ? '<ul>' + med.map(function (m) { return '<li>' + esc(I18N.name(m)) + ' — ' + esc(I18N.enumLabel('media_type', m.media_type)) + '</li>'; }).join('') + '</ul>' : '<p class="text-faint">' + I18N.t('noData') + '</p>';
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
    var body = '<dl class="kv">' +
      (o.founded_year ? '<dt>' + I18N.t('founded') + '</dt><dd>' + o.founded_year + '</dd>' : '') +
      (hq ? '<dt>' + I18N.t('hqCity') + '</dt><dd><button type="button" class="chip-link" data-city-link="' + esc(hq.id) + '">' + esc(I18N.name(hq)) + '</button></dd>' : '') +
      (o.website ? '<dt>' + I18N.t('website') + '</dt><dd><a href="' + esc(o.website) + '" target="_blank" rel="noopener">' + esc(o.website) + '</a></dd>' : '') +
      (o.status ? '<dt>' + I18N.t('status') + '</dt><dd>' + esc(o.status) + '</dd>' : '') +
      '</dl>' + sourcesHtml(o.source_ids);
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
    $('org-filter-type').value = state.org.type;
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
      if (e.key === 'Escape') closeModals();
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
    $('org-filter-type').addEventListener('change', function (e) { state.org.type = e.target.value; renderOrgs(); });
    $('orgs-list').addEventListener('click', function (e) {
      var cl = e.target.closest('[data-city-link]'); if (cl) { openCityModal(cl.getAttribute('data-city-link')); return; }
      var card = e.target.closest('[data-org]'); if (card) openOrgModal(card.getAttribute('data-org'));
    });
    $('org-modal-body').addEventListener('click', function (e) {
      var cl = e.target.closest('[data-city-link]'); if (cl) { closeModals(); openCityModal(cl.getAttribute('data-city-link')); }
    });
    $('inst-list').addEventListener('click', function (e) {
      var cl = e.target.closest('[data-city-link]'); if (cl) openCityModal(cl.getAttribute('data-city-link'));
    });
    $('media-list').addEventListener('click', function (e) {
      var cl = e.target.closest('[data-city-link]'); if (cl) openCityModal(cl.getAttribute('data-city-link'));
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

  async function init() {
    I18N.applyLangToUI();
    try {
      await D.initCore();
      fillMapSelects();
      bind();
      renderAll();
    } catch (e) {
      console.error('[china-auto]', e);
      $('init-error').classList.remove('hidden');
      try { bind(); } catch (e2) {}
    }
  }

  window.CHINA_AUTO_APP = { init: init, openCityModal: openCityModal };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
