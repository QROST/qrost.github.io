/* Orchestrator: filters, KPIs, catalogs, modals, theme. window.CHINA_AUTO_APP */
(function () {
  'use strict';
  var I18N = window.CHINA_AUTO_I18N, D = window.CHINA_AUTO_DATA, CH = window.CHINA_AUTO_CHARTS, MAP = window.CHINA_AUTO_MAP;
  var S = window.CHINA_AUTO_SEARCH;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    map: { dim: 'output', role: '', cluster: '', tier: '', layer: 'cities' },
    cat: { search: '', tier: '', role: '', cluster: '', sort: 'output', dir: -1 },
    org: { search: '', type: '', sort: 'type', dir: 1, groups: { identity: true, scale: true, product: true, network: false } },
    cluster: { selected: '', layers: { hq: true, brands: true, plants: true } }
  };
  var cityModalTab = 'tabOverview';
  var openCityId = null;
  var openOrgId = null;
  var dialogReturnFocus = null;

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
    if (m.qualifier === 'approximately') s = I18N.t('approxPrefix') + s;
    return m.year ? s + ' <span class="text-faint">(' + m.year + ')</span>' : s;
  }
  function dash() { return '<span class="text-faint">—</span>'; }
  function evidenceLink(url) {
    return url ? ' <a class="evidence-link" href="' + esc(url) + '" target="_blank" rel="noopener" aria-label="' + esc(I18N.t('openSource')) + '" title="' + esc(I18N.t('openSource')) + '">↗</a>' : '';
  }
  function availabilityOf(o, field) {
    var en = enrichOf(o), a = en.availability || {};
    if (a[field]) return a[field];
    if (field === 'founded' && (en.founded || o.founded_year)) return 'verified';
    if (field === 'listing' && en.listing && en.listing.source_url) return en.listing.listed ? 'verified' : 'not_separately_listed';
    if ((field === 'employees' || field === 'vehicle_sales') && en[field] && en[field].source_url) return 'verified';
    if (field === 'plants' && D.plantCount(o.id)) return 'partial';
    return 'unverified';
  }
  function statusCell(status) {
    var key = {
      not_disclosed: 'statusNotDisclosed',
      not_applicable: 'statusNotApplicable',
      not_separately_listed: 'statusNotSeparatelyListed',
      unresolved: 'statusUnverified',
      unverified: 'statusUnverified',
      partial: 'statusPartial'
    }[status] || 'statusUnverified';
    return '<span class="field-status field-status-' + esc(status || 'unverified') + '">' + esc(I18N.t(key)) + '</span>';
  }
  function parentContext(o, getter) {
    var seen = {}, p = o;
    while (p && p.parent_id && !seen[p.parent_id]) {
      seen[p.parent_id] = 1;
      p = D.getOrg(p.parent_id);
      if (p) {
        var value = getter(p);
        if (value) return { org: p, value: value };
      }
    }
    return null;
  }
  function foundedValue(o) {
    var en = enrichOf(o), f = en.founded;
    return (f && f.value) || o.founded_year || null;
  }
  function metricContext(o, field) {
    var own = enrichOf(o)[field];
    if (own && own.value != null) return { org: o, value: own, inherited: false };
    if (field !== 'employees') return null;
    var p = parentContext(o, function (parent) {
      var m = enrichOf(parent)[field];
      return m && m.value != null ? m : null;
    });
    return p ? { org: p.org, value: p.value, inherited: true } : null;
  }
  function ownershipContext(o) {
    var own = enrichOf(o);
    var ownStatus = availabilityOf(o, 'ownership');
    if (own.ownership && (ownStatus === 'verified' || ownStatus === 'partial')) {
      return { org: o, value: own, inherited: false, status: ownStatus };
    }
    var p = parentContext(o, function (parent) {
      var en = enrichOf(parent);
      var status = availabilityOf(parent, 'ownership');
      return en.ownership && (status === 'verified' || status === 'partial') ? { enrichment: en, status: status } : null;
    });
    if (p) return { org: p.org, value: p.value.enrichment, inherited: true, status: p.value.status };
    return own.ownership ? { org: o, value: own, inherited: false, status: ownStatus } : null;
  }
  function familyPlantDetail(o) {
    var out = { total: 0, explicit: 0, verified: 0, candidate: 0 };
    var seen = {};
    function visit(org) {
      if (!org || seen[org.id]) return;
      seen[org.id] = 1;
      var d = D.plantCountDetail(org.id);
      ['total', 'explicit', 'verified', 'candidate'].forEach(function (key) { out[key] += d[key] || 0; });
      D.childrenOf(org.id).forEach(visit);
    }
    visit(o);
    return out;
  }
  function plantContext(o) {
    var kids = D.childrenOf(o.id);
    var own = kids.length ? familyPlantDetail(o) : D.plantCountDetail(o.id);
    if (own.total) return { org: o, value: own, inherited: !!kids.length, scopeKey: kids.length ? 'childrenScope' : '' };
    var p = parentContext(o, function (parent) {
      var detail = familyPlantDetail(parent);
      return detail.total ? detail : null;
    });
    return p ? { org: p.org, value: p.value, inherited: true, scopeKey: 'parentScope' } : null;
  }
  function scopedValue(html, ctx) {
    if (!ctx || !ctx.inherited) return html;
    return html + '<br><span class="text-faint scope-note">' + esc(I18N.t(ctx.scopeKey || 'parentScope')) + ' · ' + esc(I18N.name(ctx.org)) + '</span>';
  }
  var FACT_SCOPE_LABELS = {
    "Cayman_holding_company": ["开曼控股公司", "Cayman holding company"],
    "FAW_Toyota_sales_scope_unspecified": ["一汽丰田销量（地区范围未注明）", "FAW Toyota sales (region unspecified)"],
    "Hozon_legal_entity": ["合众汽车法人实体", "Hozon legal entity"],
    "NIO_ONVO_FIREFLY_deliveries": ["蔚来、乐道与萤火虫交付量", "NIO, ONVO and firefly deliveries"],
    "Shanghai_factory_deliveries": ["上海工厂交付量", "Shanghai factory deliveries"],
    "Tesla_Shanghai_legal_entity": ["特斯拉上海法人实体", "Tesla Shanghai legal entity"],
    "Xiaomi_EV_Inc": ["小米汽车有限公司", "Xiaomi EV Inc."],
    "association_legal_person": ["协会法人", "association legal entity"],
    "association_lineage": ["协会沿革", "association lineage"],
    "brand": ["品牌销量", "brand sales"],
    "brand_birth": ["品牌诞生", "brand birth"],
    "brand_company_sales": ["品牌公司销量", "brand-company sales"],
    "brand_creation": ["品牌创立", "brand creation"],
    "brand_deliveries": ["品牌交付量", "brand deliveries"],
    "brand_launch": ["品牌发布", "brand launch"],
    "brand_origin": ["品牌源起", "brand origin"],
    "brand_sales": ["品牌销量", "brand sales"],
    "brand_sales_unaudited": ["品牌销量（未经审计）", "brand sales (unaudited)"],
    "bus_sales": ["客车销量", "bus sales"],
    "channel_launch": ["频道上线", "channel launch"],
    "china_domestic_sales": ["中国境内销量", "China domestic sales"],
    "company_JV_and_associates": ["公司、合营及联营口径销量", "company, joint-venture and associate sales"],
    "company_lineage": ["公司沿革", "company lineage"],
    "company_sales_unaudited": ["公司销量（未经审计）", "company sales (unaudited)"],
    "company_wholesale": ["公司批发量", "company wholesale"],
    "continuous_educational_lineage": ["持续办学沿革", "continuous educational lineage"],
    "current_Cayman_listed_entity": ["当前开曼上市主体", "current Cayman listed entity"],
    "current_company": ["当前公司", "current company"],
    "current_group": ["当前集团", "current group"],
    "current_group_lineage": ["现集团沿革", "current-group lineage"],
    "current_joint_venture": ["当前合资公司", "current joint venture"],
    "current_legal_entity_lineage": ["现法人实体沿革", "current legal-entity lineage"],
    "current_listed_company": ["当前上市公司", "current listed company"],
    "current_listed_company_lineage": ["现上市公司沿革", "current listed-company lineage"],
    "dongfeng_commercial_vehicle_company_sales": ["东风商用车公司销量", "Dongfeng Commercial Vehicle company sales"],
    "entity_renaming_and_brand_creation": ["法人更名与品牌创立", "entity renaming and brand creation"],
    "first_factory_lineage": ["首座工厂沿革", "first-factory lineage"],
    "forum_foundation": ["论坛成立", "forum foundation"],
    "global_deliveries": ["全球交付量", "global deliveries"],
    "group_lineage": ["集团沿革", "group lineage"],
    "group_sales": ["集团销量", "group sales"],
    "group_sales_including_foton_daimler": ["集团销量（含福田戴姆勒）", "group sales including Foton Daimler"],
    "group_vehicle_sales": ["集团整车销量", "group vehicle sales"],
    "group_wholesale": ["集团批发量", "group wholesale"],
    "holding_group_brand_aggregate": ["控股集团品牌合计", "holding-group brand aggregate"],
    "holding_group_lineage": ["控股集团沿革", "holding-group lineage"],
    "independent_brand_launch": ["独立品牌发布", "independent brand launch"],
    "institution_lineage": ["院校沿革", "institution lineage"],
    "integrated_operating_system": ["一体化运营体系", "integrated operating system"],
    "internal_business_unit": ["内部业务单元", "internal business unit"],
    "joint_venture": ["合资公司", "joint venture"],
    "joint_venture_wholesale": ["合资公司批发量", "joint-venture wholesale"],
    "jv_terminal": ["合资公司终端销量", "joint-venture terminal sales"],
    "listed_group": ["上市集团", "listed group"],
    "listed_group_five_brands": ["上市集团五品牌口径", "listed-group five-brand scope"],
    "listed_group_legal_continuity": ["上市集团法人延续", "listed-group legal continuity"],
    "listed_group_lineage": ["上市集团沿革", "listed-group lineage"],
    "listed_group_reported_precision": ["上市集团披露精度", "listed-group reported precision"],
    "listed_group_worldwide": ["上市集团全球口径", "listed group worldwide"],
    "listed_operating_group": ["上市运营集团", "listed operating group"],
    "media_brand": ["媒体品牌", "media brand"],
    "media_company": ["媒体公司", "media company"],
    "media_company_and_platform": ["媒体公司及平台", "media company and platform"],
    "new_energy_vehicle_sales": ["新能源汽车销量", "new-energy vehicle sales"],
    "operating_group_lineage": ["运营集团沿革", "operating-group lineage"],
    "operating_legal_entity": ["运营法人实体", "operating legal entity"],
    "product_brand_launch": ["产品品牌发布", "product-brand launch"],
    "product_brand_sales_unaudited": ["产品品牌销量（未经审计）", "product-brand sales (unaudited)"],
    "product_launch": ["产品上线", "product launch"],
    "publication_launch": ["刊物创刊", "publication launch"],
    "qualified": ["限定口径（非精确实体）", "qualified scope (not exact-entity)"],
    "vehicle_deliveries": ["车辆交付量", "vehicle deliveries"],
    "vehicles_and_chassis": ["整车及底盘销量", "vehicle and chassis sales"],
    "website_launch": ["网站上线", "website launch"],
    "wholesale_including_Venucia_and_Infiniti": ["批发量（含启辰与英菲尼迪）", "wholesale including Venucia and Infiniti"]
  };
  function humanScope(scope) {
    var known = FACT_SCOPE_LABELS[scope];
    return known ? known[I18N.isEn() ? 1 : 0] : (I18N.isEn() ? 'Scope unavailable' : '口径信息暂缺');
  }
  function factContext(value) {
    if (!value) return '';
    var parts = [];
    if (value.scope) parts.push(I18N.t('scopeShort') + ': ' + humanScope(value.scope));
    if (value.scope_quality) parts.push((I18N.isEn() ? 'Scope quality' : '口径质量') + ': ' + humanScope(value.scope_quality));
    if (value.source_authority === 'secondary') parts.push(I18N.t('secondarySource'));
    var note = I18N.isEn() ? value.note_en : value.note_zh;
    if (note) parts.push(note);
    return parts.length ? '<span class="field-context" title="' + esc(parts.join(' · ')) + '">' + esc(parts.join(' · ')) + '</span>' : '';
  }
  function metricCell(o, field, kind) {
    var ctx = metricContext(o, field);
    if (!ctx) return statusCell(availabilityOf(o, field));
    var value = fmtMetric(ctx.value, kind) + evidenceLink(ctx.value.source_url) + factContext(ctx.value);
    var status = availabilityOf(o, field);
    if (ctx.inherited || status !== 'verified') value += '<br>' + statusCell(status);
    return scopedValue(value, ctx);
  }
  function plantCell(o) {
    var ctx = plantContext(o);
    if (!ctx) return statusCell(availabilityOf(o, 'plants'));
    var d = ctx.value;
    var detail = d.candidate ? '<span class="text-faint" title="' + esc(I18N.t('candidatePlantNote')) + '"> (' + d.verified + '+' + d.candidate + '*)</span>' : '';
    return scopedValue('<span class="num">' + d.total + '</span>' + detail + '<br>' + statusCell('partial'), ctx);
  }
  function tinyBadges(vals, group) {
    if (!vals || !vals.length) return dash();
    return vals.map(function (v) { return '<span class="badge" style="background:var(--bg-elev)">' + esc(I18N.enumLabel(group, v)) + '</span>'; }).join(' ');
  }
  function enrichOf(o) { return (o && o.enrich) || {}; }
  function confBadge(c) {
    if (c == null) return '';
    var cls = c >= 0.8 ? 'badge-grade-A' : c > 0.5 ? 'badge-grade-B' : 'badge-grade-C';
    var label = c <= 0.5 ? I18N.t('candidate') + ' · ' + I18N.t('confidence') : I18N.t('confidence');
    return '<span class="badge ' + cls + '">' + esc(label) + ' ' + c.toFixed(2) + '</span>';
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

  function sourceLinksHtml(ids) {
    var seen = {};
    var links = (ids || []).filter(function (sid) {
      if (!sid || seen[sid]) return false;
      seen[sid] = true;
      return !!D.getSource(sid);
    }).map(function (sid) {
      var s = D.getSource(sid);
      var title = I18N.pick(s.title_zh, s.title_en) || sid;
      return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(title) + '</a>';
    });
    return links.length ? ' <span class="evidence-links">· ' + links.join(' · ') + '</span>' : '';
  }

  function renderRuntimeFallbacks() {
    var messages = [];
    var noEcharts = !!window.CHINA_AUTO_ECHARTS_FAILED || !window.echarts;
    if (noEcharts) messages.push(I18N.t('echartsFallback'));
    var warning = $('runtime-warning');
    if (warning) {
      warning.classList.toggle('hidden', !messages.length);
      $('runtime-warning-title').textContent = messages.length ? I18N.t('runtimeWarnTitle') : '';
      $('runtime-warning-body').textContent = messages.join(' ');
    }
    if (noEcharts) {
      ['overview-chart', 'china-map', 'cluster-graph'].forEach(function (id) {
        var el = $(id);
        if (el) el.innerHTML = '<p class="runtime-chart-fallback">' + esc(I18N.t('chartUnavailable')) + '</p>';
      });
    }
  }

  function orgCount(cityId) { return D.orgsForCity(cityId).length; }

  function verifiedOutputStat(city) {
    var stat = city && D.stat2025(city.id);
    return stat && stat.confidence > 0.5 && (stat.source_ids || []).length && stat.total_vehicle_output != null ? stat : null;
  }

  function compareOutputCities(a, b, dir) {
    var sa = verifiedOutputStat(a), sb = verifiedOutputStat(b);
    if (!!sa !== !!sb) return sa ? -1 : 1;
    if (sa && sb) {
      var byOutput = (sa.total_vehicle_output - sb.total_vehicle_output) * dir;
      if (byOutput) return byOutput;
    }
    // Candidate/no-output cities stay accessible after the verified group,
    // but their raw candidate figures never determine an implicit ranking.
    return localeName(a, b);
  }

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
      return !!verifiedOutputStat(c);
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
        return compareOutputCities(a, b, dir);
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
      var ariaSort = state.cat.sort === c[0] ? (state.cat.dir > 0 ? 'ascending' : 'descending') : 'none';
      return '<th data-sort="' + c[0] + '" role="button" tabindex="0" aria-sort="' + ariaSort + '">' + I18N.t(c[1]) + arrow + '</th>';
    }).join('');
    var list = filteredCatalog();
    $('cat-count').textContent = list.length + ' / ' + D.cities.length;
    $('catalog-body').innerHTML = list.map(function (c) {
      var st = D.stat2025(c.id);
      var tags = (c.role_tags || []).slice(0, 3).map(rtBadge).join(' ');
      return '<tr data-city="' + esc(c.id) + '" role="button" tabindex="0" aria-label="' + esc(I18N.t('viewCity') + ': ' + I18N.name(c)) + '">' +
        '<td>' + esc(I18N.name(c)) + '</td>' +
        '<td>' + esc(I18N.pick(c.province_zh, c.province_en)) + '</td>' +
        '<td>' + tierBadge(c.tier) + '</td>' +
        '<td class="num">' + fmtWan(st && st.total_vehicle_output) + (st ? ' ' + confBadge(st.confidence) : '') + '</td>' +
        '<td class="num">' + fmtWan(st && st.nev_output) + '</td>' +
        '<td>' + tags + '</td>' +
        '<td class="num">' + orgCount(c.id) + '</td></tr>';
    }).join('') || '<tr><td colspan="7" class="loading">' + I18N.t('noData') + '</td></tr>';
  }

  function renderClusters() {
    var selected = state.cluster.selected;
    $('cluster-cards').innerHTML = D.clusters.map(function (cl) {
      var cityObjs = (cl.city_ids || []).map(function (id) { return D.getCity(id); }).filter(Boolean);
      var cities = cityObjs.map(function (c) { return I18N.name(c); }).join(' · ');
      var hqN = 0, brandN = 0, plantN = 0;
      cityObjs.forEach(function (c) {
        D.orgsForCity(c.id).forEach(function (o) {
          if (o.headquarters_city_id !== c.id) return;
          if (o.organization_type === 'brand') brandN += 1;
          else if (o.organization_type === 'automaker' || o.organization_type === 'battery_company' ||
            o.organization_type === 'supplier' || o.organization_type === 'software_company' ||
            o.organization_type === 'chip_company') hqN += 1;
        });
        plantN += D.manufacturingCountForCity(c.id);
      });
      var note = I18N.pick(cl.output_note_zh, cl.output_note_en);
      var on = selected === cl.id;
      return '<article class="cluster-card' + (on ? ' active' : '') + '" data-cluster="' + esc(cl.id) +
        '" role="button" tabindex="0" aria-pressed="' + (on ? 'true' : 'false') + '"' +
        ' aria-label="' + esc(I18N.name(cl) + ' · ' + I18N.t('clusterCardHint')) + '">' +
        '<h3>' + esc(I18N.name(cl)) + ' ' + confBadge(cl.confidence) + '</h3>' +
        '<p>' + esc(I18N.pick(cl.summary_zh, cl.summary_en)) + '</p>' +
        (note ? '<p class="text-faint text-xs mt-2">' + esc(note) + '</p>' : '') +
        '<p class="text-faint text-xs mt-2">' + I18N.t('citiesInCluster') + ': ' + esc(cities) +
        ' · ' + I18N.t('countHq') + ' ' + hqN + ' · ' + I18N.t('countBrands') + ' ' + brandN +
        ' · ' + I18N.t('countPlants') + ' ' + plantN + '</p>' +
        '<p class="cluster-card-hint">' + esc(on ? I18N.t('clusterCardOn') : I18N.t('clusterCardHint')) + '</p></article>';
    }).join('') || '<p class="loading">' + I18N.t('noData') + '</p>';

    var resetBtn = $('cluster-reset');
    document.querySelectorAll('#cluster-layers [data-cluster-layer]').forEach(function (btn) {
      var k = btn.getAttribute('data-cluster-layer');
      btn.classList.toggle('active', !!state.cluster.layers[k]);
      btn.disabled = false;
      btn.setAttribute('aria-pressed', state.cluster.layers[k] ? 'true' : 'false');
    });
    if (resetBtn) resetBtn.disabled = !selected;

    CH.renderClusterGraph({
      cities: D.cities, relations: D.relations, clusters: D.clusters,
      selectedClusterId: selected, layers: state.cluster.layers,
      getCluster: D.getCluster, getStat: D.stat2025, getOrg: D.getOrg, getFacility: D.getFacility,
      getCity: D.getCity, childrenOf: D.childrenOf,
      orgsForCity: D.orgsForCity, facilitiesForCity: D.plantFacilitiesForCity,
      manufacturingRolesForCity: D.manufacturingRolesForCity,
      manufacturingCountForCity: D.manufacturingCountForCity,
      mediaForCity: D.mediaForCity, institutionsForCity: D.institutionsForCity
    });
    CH.resizeAll();
  }

  function selectCluster(id, opts) {
    opts = opts || {};
    if (!id) state.cluster.selected = '';
    else if (opts.toggle !== false && state.cluster.selected === id) state.cluster.selected = '';
    else state.cluster.selected = id;
    renderClusters();
    if (opts.scroll) {
      var g = $('cluster-graph');
      if (g) g.scrollIntoView({ block: 'nearest' });
    }
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
      if (k === 'founded') return ((foundedValue(a) || 0) - (foundedValue(b) || 0)) * dir;
      if (k === 'ownership') {
        var oa = ownershipContext(a), ob = ownershipContext(b);
        return (((oa && oa.value.ownership) || '').localeCompare((ob && ob.value.ownership) || '')) * dir;
      }
      if (k === 'listing') {
        var la = (enrichOf(a).listing && enrichOf(a).listing.listed) ? 1 : 0;
        var lb = (enrichOf(b).listing && enrichOf(b).listing.listed) ? 1 : 0;
        return (la - lb) * dir;
      }
      if (k === 'employees') {
        var ma = metricContext(a, 'employees'), mb = metricContext(b, 'employees');
        return (((ma && ma.value.value) || -1) - ((mb && mb.value.value) || -1)) * dir;
      }
      if (k === 'sales') return ((((enrichOf(a).vehicle_sales || {}).value) || -1) - (((enrichOf(b).vehicle_sales || {}).value) || -1)) * dir;
      if (k === 'plants') {
        var pa = plantContext(a), pb = plantContext(b);
        return (((pa && pa.value.total) || 0) - ((pb && pb.value.total) || 0)) * dir;
      }
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
    if (key === 'name') return esc(I18N.name(o)) + ' ' + confBadge(o.confidence);
    if (key === 'type') return '<span class="badge" style="background:var(--bg-elev)">' + esc(I18N.enumLabel('organization_type', o.organization_type)) + '</span>';
    if (key === 'parent') {
      var parent = o.parent_id ? D.getOrg(o.parent_id) : null;
      return parent ? '<button type="button" class="chip-link" data-org-link="' + esc(parent.id) + '">' + esc(I18N.name(parent)) + '</button>' : dash();
    }
    if (key === 'hq') {
      var hq = o.headquarters_city_id ? D.getCity(o.headquarters_city_id) : null;
      return hq ? '<button type="button" class="chip-link" data-city-link="' + esc(hq.id) + '">' + esc(I18N.name(hq)) + '</button>' : dash();
    }
    if (key === 'founded') {
      var fv = foundedValue(o), founded = en.founded || {};
      var foundedStatus = availabilityOf(o, 'founded');
      return fv ? esc(fv) + evidenceLink(founded.source_url) + factContext(founded) + (foundedStatus === 'unverified' ? '<br>' + statusCell('unverified') : '') : statusCell(foundedStatus);
    }
    if (key === 'ownership') {
      var ownCtx = ownershipContext(o);
      if (!ownCtx) return statusCell(availabilityOf(o, 'ownership'));
      var ownValue = ownCtx.value;
      var ownership = esc(I18N.enumLabel('ownership', ownValue.ownership)) + evidenceLink((ownValue.ownership_evidence || {}).source_url) + factContext(ownValue.ownership_evidence);
      if (ownCtx.status !== 'verified') ownership += '<br>' + statusCell(ownCtx.status);
      return ownCtx.inherited ? scopedValue(ownership, ownCtx) : ownership;
    }
    if (key === 'listing') {
      var L = en.listing;
      if (L && L.listed) {
        var listed = esc((L.ticker || '') + (L.exchange ? '.' + L.exchange : '')) + evidenceLink(L.source_url);
        listed += factContext(L);
        return availabilityOf(o, 'listing') === 'unverified' ? listed + '<br>' + statusCell('unverified') : listed;
      }
      var listingStatus = availabilityOf(o, 'listing');
      var parentListing = parentContext(o, function (parent) {
        var pl = enrichOf(parent).listing;
        return pl && pl.listed ? pl : null;
      });
      var status = statusCell(listingStatus);
      if (parentListing) {
        status += '<br><span class="text-faint scope-note">' + esc(I18N.t('parentListed')) + ' ' + esc((parentListing.value.ticker || '') + (parentListing.value.exchange ? '.' + parentListing.value.exchange : '')) + '</span>';
      }
      return status + factContext(L);
    }
    if (key === 'employees') return metricCell(o, 'employees', 'people');
    if (key === 'sales') return metricCell(o, 'vehicle_sales', 'vehicles');
    if (key === 'plants') return plantCell(o);
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
      var ariaSort = state.org.sort === c.key ? (state.org.dir > 0 ? 'ascending' : 'descending') : 'none';
      return '<th data-sort="' + c.key + '" role="button" tabindex="0" aria-sort="' + ariaSort + '">' + I18N.t(c.label) + arrow + '</th>';
    }).join('');
    var list = filteredOrgs();
    $('org-count').textContent = list.length + ' / ' + D.organizations.length;
    $('orgs-body').innerHTML = list.map(function (o) {
      return '<tr data-org="' + esc(o.id) + '" data-candidate="' + (o.confidence <= 0.5 ? 'true' : 'false') + '" role="button" tabindex="0" aria-label="' + esc(I18N.t('viewOrg') + ': ' + I18N.name(o) + (o.confidence <= 0.5 ? ' · ' + I18N.t('candidate') : '')) + '">' + cols.map(function (c) {
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
        '<td class="source-scope-cell">' + esc(I18N.pick((s.support_scope || {}).scope_zh, (s.support_scope || {}).scope_en)) + '</td>' +
        '<td>' + esc(s.source_type || '') + '</td>' +
        '<td>' + esc(s.published_at || s.fact_date || '') + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="loading">' + I18N.t('noData') + '</td></tr>';
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
    renderRuntimeFallbacks();
  }

  // ---------- city modal ----------
  function visibleDialog() {
    return ['org-modal', 'city-modal'].map(function (id) { return $(id); }).filter(function (el) {
      return el && !el.classList.contains('hidden');
    })[0] || null;
  }

  function showModal(id) {
    var alreadyOpen = visibleDialog();
    if (!alreadyOpen) dialogReturnFocus = document.activeElement;
    ['city-modal', 'org-modal'].forEach(function (modalId) {
      var modal = $(modalId);
      var on = modalId === id;
      modal.classList.toggle('hidden', !on);
      modal.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    document.body.classList.add('modal-open');
    window.requestAnimationFrame(function () {
      var close = $(id).querySelector('.modal-close');
      if (close) close.focus();
    });
  }

  function dialogFocusables(dialog) {
    return Array.prototype.slice.call(dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (el) { return !el.hidden && el.getAttribute('aria-hidden') !== 'true'; });
  }

  function trapDialogFocus(e) {
    var dialog = visibleDialog();
    if (!dialog || e.key !== 'Tab') return;
    var focusable = dialogFocusables(dialog);
    if (!focusable.length) { e.preventDefault(); dialog.querySelector('.modal-panel').focus(); return; }
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openCityModal(id) {
    var city = D.getCity(id); if (!city) return;
    openCityId = id;
    openOrgId = null;
    $('city-modal-head').innerHTML =
      '<h3 id="city-modal-title" class="text-xl font-semibold">' + esc(I18N.name(city)) + '</h3>' +
      '<div class="mt-1 flex flex-wrap items-center gap-2 text-sm">' + tierBadge(city.tier) +
      '<span class="text-muted">' + esc(I18N.pick(city.province_zh, city.province_en)) + '</span>' +
      confBadge(city.confidence) + '</div>';
    var tabs = ['tabOverview', 'tabOrgs', 'tabFacilities', 'tabRelations', 'tabStats'];
    if (tabs.indexOf(cityModalTab) === -1) cityModalTab = 'tabOverview';
    $('city-modal-tabs').innerHTML = tabs.map(function (t) {
      var on = t === cityModalTab;
      return '<button type="button" role="tab" id="city-' + t + '" aria-controls="city-modal-body" aria-selected="' + on + '" tabindex="' + (on ? '0' : '-1') + '" class="modal-tab-btn ' + (on ? 'active' : '') + '" data-tab="' + t + '">' + I18N.t(t) + '</button>';
    }).join('');
    $('city-modal-body').setAttribute('aria-labelledby', 'city-' + cityModalTab);
    renderCityModalBody(city);
    showModal('city-modal');
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
      body += sourcesHtml(city.source_ids);
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
          ' — <span class="text-faint">' + esc(roleLabel) + '</span> ' + confBadge((row.role || ent).confidence) +
          sourceLinksHtml((row.role || ent).source_ids) + '</li>';
      }).join('') + '</ul>' : '<p class="text-faint">' + I18N.t('noData') + '</p>';
    } else if (cityModalTab === 'tabFacilities') {
      var facs = D.facilitiesForCity(city.id);
      body = facs.length ? '<ul>' + facs.map(function (f) {
        return '<li><b>' + esc(I18N.pick(f.name_zh, f.name_en)) + '</b> — ' + esc(I18N.enumLabel('facility_type', f.facility_type)) +
          ' <span class="text-faint">(' + esc(I18N.enumLabel('facility_status', f.status)) + ')</span> ' +
          confBadge(f.confidence) + sourceLinksHtml(f.source_ids) + '</li>';
      }).join('') + '</ul>' : '<p class="text-faint">' + I18N.t('noData') + '</p>';
    } else if (cityModalTab === 'tabRelations') {
      var rels = D.relationsFor(city.id);
      body = rels.length ? '<ul>' + rels.map(function (r) {
        var otherId = r.from_id === city.id ? r.to_id : r.from_id;
        var other = D.getCity(otherId) || D.getOrg(otherId) || D.getCluster(otherId);
        var otherName = other ? I18N.name(other) : otherId;
        return '<li>' + esc(I18N.enumLabel('relation_type', r.relation_type)) + ' → ' + esc(otherName) + ' ' + confBadge(r.confidence) +
          sourceLinksHtml(r.source_ids) +
          (r.description_zh || r.description_en ? '<br/><span class="text-muted">' + esc(I18N.pick(r.description_zh, r.description_en)) + '</span>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="text-faint">' + I18N.t('noData') + '</p>';
    } else if (cityModalTab === 'tabStats') {
      var stats = D.statsForCity(city.id);
      body = stats.length ? '<table class="data-table"><thead><tr><th>' + I18N.t('stats') + '</th><th>' + I18N.t('thOutput') + '</th><th>' + I18N.t('nev') + '</th></tr></thead><tbody>' +
        stats.map(function (s) {
          return '<tr><td>' + s.year + ' ' + confBadge(s.confidence) + '</td><td class="num">' + fmtWan(s.total_vehicle_output) + '</td><td class="num">' + fmtWan(s.nev_output) + '</td></tr>';
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
    openOrgId = id;
    $('org-modal-head').innerHTML = '<h3 id="org-modal-title" class="text-lg font-semibold">' + esc(I18N.name(o)) + '</h3>' +
      '<div class="text-sm text-muted mt-1">' + esc(I18N.enumLabel('organization_type', o.organization_type)) + ' ' + confBadge(o.confidence) + '</div>';
    var hq = o.headquarters_city_id ? D.getCity(o.headquarters_city_id) : null;
    var parent = o.parent_id ? D.getOrg(o.parent_id) : null;
    var kids = D.childrenOf(o.id);
    var inst = D.institutionForOrg(o.id);
    var media = D.mediaForOrg(o.id);
    var en = enrichOf(o);
    var body = '<dl class="kv">' +
      '<dt>' + I18N.t('founded') + '</dt><dd>' + orgCell(o, 'founded') + '</dd>' +
      (hq ? '<dt>' + I18N.t('hqCity') + '</dt><dd><button type="button" class="chip-link" data-city-link="' + esc(hq.id) + '">' + esc(I18N.name(hq)) + '</button></dd>' : '<dt>' + I18N.t('hqCity') + '</dt><dd class="text-faint">' + I18N.t('hqUnknown') + '</dd>') +
      (parent ? '<dt>' + I18N.t('parentBrand') + '</dt><dd><button type="button" class="chip-link" data-org-link="' + esc(parent.id) + '">' + esc(I18N.name(parent)) + '</button></dd>' : '') +
      (kids.length ? '<dt>' + I18N.t('childBrands') + '</dt><dd>' + kids.map(function (k) {
        return '<button type="button" class="chip-link" data-org-link="' + esc(k.id) + '">' + esc(I18N.name(k)) + '</button>';
      }).join(' ') + '</dd>' : '') +
      (o.website ? '<dt>' + I18N.t('website') + '</dt><dd><a href="' + esc(o.website) + '" target="_blank" rel="noopener">' + esc(o.website) + '</a></dd>' : '') +
      (o.status ? '<dt>' + I18N.t('status') + '</dt><dd>' + esc(o.status) + '</dd>' : '') +
      '<dt>' + I18N.t('thOwnership') + '</dt><dd>' + orgCell(o, 'ownership') + '</dd>' +
      '<dt>' + I18N.t('thListing') + '</dt><dd>' + orgCell(o, 'listing') + '</dd>' +
      '<dt>' + I18N.t('thEmployees') + '</dt><dd>' + orgCell(o, 'employees') + '</dd>' +
      '<dt>' + I18N.t('thSales') + '</dt><dd>' + orgCell(o, 'sales') + '</dd>' +
      '<dt>' + I18N.t('thPlants') + '</dt><dd>' + orgCell(o, 'plants') + '</dd>' +
      (en.export_role ? '<dt>' + I18N.t('thExport') + '</dt><dd>' + esc(I18N.enumLabel('export_role', en.export_role)) + '</dd>' : '') +
      '</dl>';
    if (en.powertrain && en.powertrain.length) body += '<h4>' + I18N.t('thPowertrain') + '</h4><p>' + tinyBadges(en.powertrain, 'powertrain') + '</p>';
    if (en.segment && en.segment.length) body += '<h4>' + I18N.t('thSegment') + '</h4><p>' + tinyBadges(en.segment, 'segment') + '</p>';
    if (en.education_tags && en.education_tags.length) body += '<h4>' + I18N.t('school') + '</h4><p>' + tinyBadges(en.education_tags, 'education_tag') + '</p>';
    if (inst) {
      body += '<h4>' + I18N.t('college') + '</h4><p>' + esc(I18N.pick(inst.college_zh, inst.college_en) || '—') + ' ' +
        confBadge(inst.confidence) + sourceLinksHtml(inst.source_ids) + '</p>';
      if (inst.strengths_zh || inst.strengths_en) {
        body += '<h4>' + I18N.t('strengths') + '</h4><p>' + esc(I18N.pick(inst.strengths_zh, inst.strengths_en)) + '</p>';
      }
    }
    if (media) {
      var ed = media.editorial_city_id ? D.getCity(media.editorial_city_id) : null;
      body += '<dl class="kv mt-2">' +
        '<dt>' + I18N.t('thType') + '</dt><dd>' + esc(I18N.enumLabel('media_type', media.media_type)) +
        (media.national_platform ? ' · ' + I18N.t('nationalPlatform') : '') + ' ' + confBadge(media.confidence) + sourceLinksHtml(media.source_ids) + '</dd>' +
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
        return '<li>' + esc(I18N.enumLabel('relation_type', r.relation_type)) + ' → ' + link + ' ' +
          confBadge(r.confidence) + sourceLinksHtml(r.source_ids) + '</li>';
      }).join('') + '</ul>';
    }
    body += sourcesHtml(o.source_ids);
    $('org-modal-body').innerHTML = body;
    showModal('org-modal');
  }

  function closeModals(restoreFocus) {
    ['city-modal', 'org-modal'].forEach(function (id) {
      $(id).classList.add('hidden');
      $(id).setAttribute('aria-hidden', 'true');
    });
    document.body.classList.remove('modal-open');
    openCityId = null;
    openOrgId = null;
    if (restoreFocus !== false && dialogReturnFocus && document.contains(dialogReturnFocus)) {
      try { dialogReturnFocus.focus(); } catch (e) {}
    }
    dialogReturnFocus = null;
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
      if (S.match(c, q)) hits.push({ kind: 'city', id: c.id, score: S.score(c, q), label: I18N.name(c), sub: I18N.pick(c.province_zh, c.province_en), confidence: c.confidence });
    });
    D.organizations.forEach(function (o) {
      if (S.match(o, q)) {
        var hq = o.headquarters_city_id ? D.getCity(o.headquarters_city_id) : null;
        hits.push({
          kind: 'org', id: o.id, orgType: o.organization_type, score: S.score(o, q), label: I18N.name(o), confidence: o.confidence,
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
      html += '<button type="button" class="search-pop-item" role="option" data-i="' + i + '" data-candidate="' + (h.confidence <= 0.5 ? 'true' : 'false') + '" aria-selected="' + (i === searchSel) + '">' +
        esc(h.label) + (h.sub ? ' <span class="text-faint text-xs">' + esc(h.sub) + '</span>' : '') +
        (h.confidence <= 0.5 ? ' ' + confBadge(h.confidence) : '') + '</button>';
    });
    box.innerHTML = html;
  }

  function activateSearchHit(i) {
    var h = searchHits[i]; if (!h) return;
    hideSearchPop();
    if (h.kind === 'city') { cityModalTab = 'tabOverview'; openCityModal(h.id); }
    else openOrgModal(h.id);
  }

  function selectCityTabButton(button) {
    if (!button) return;
    cityModalTab = button.getAttribute('data-tab');
    $('city-modal-tabs').querySelectorAll('button[role="tab"]').forEach(function (tab) {
      var on = tab === button;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.setAttribute('tabindex', on ? '0' : '-1');
    });
    $('city-modal-body').setAttribute('aria-labelledby', button.id);
    if (openCityId) { var c = D.getCity(openCityId); if (c) renderCityModalBody(c); }
  }

  function activateOnKeyboard(e, selector, callback) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var target = e.target.closest(selector);
    if (!target || e.target.closest('button, a, input, select, textarea')) return;
    e.preventDefault();
    callback(target);
  }

  function bind() {
    $('lang-toggle').addEventListener('click', function () { I18N.toggleLang(); });
    $('theme-toggle').addEventListener('click', toggleTheme);

    document.querySelectorAll('[data-close-city]').forEach(function (b) {
      b.addEventListener('click', closeModals);
    });
    document.querySelectorAll('[data-close-org]').forEach(function (b) {
      b.addEventListener('click', closeModals);
    });
    [['city-modal'], ['org-modal']].forEach(function (m) {
      $(m[0]).addEventListener('click', function (e) { if (e.target === this) closeModals(); });
    });
    document.addEventListener('keydown', function (e) {
      trapDialogFocus(e);
      if (e.key === 'Escape') {
        hideSearchPop();
        if (visibleDialog()) { e.preventDefault(); closeModals(); }
      }
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
    $('catalog-head').addEventListener('keydown', function (e) {
      activateOnKeyboard(e, 'th[data-sort]', function (th) { th.click(); });
    });
    $('catalog-body').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-city]'); if (tr) { cityModalTab = 'tabOverview'; openCityModal(tr.getAttribute('data-city')); }
    });
    $('catalog-body').addEventListener('keydown', function (e) {
      activateOnKeyboard(e, 'tr[data-city]', function (tr) {
        cityModalTab = 'tabOverview'; openCityModal(tr.getAttribute('data-city'));
      });
    });

    $('city-modal-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]'); if (!b) return;
      selectCityTabButton(b);
    });
    $('city-modal-tabs').addEventListener('keydown', function (e) {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) return;
      var tabs = Array.prototype.slice.call($('city-modal-tabs').querySelectorAll('button[role="tab"]'));
      var i = tabs.indexOf(e.target); if (i < 0) return;
      e.preventDefault();
      if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = tabs.length - 1;
      else i = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectCityTabButton(tabs[i]);
      tabs[i].focus();
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
    $('orgs-head').addEventListener('keydown', function (e) {
      activateOnKeyboard(e, 'th[data-sort]', function (th) { th.click(); });
    });
    $('orgs-body').addEventListener('click', function (e) {
      var ol = e.target.closest('[data-org-link]'); if (ol) { e.stopPropagation(); openOrgModal(ol.getAttribute('data-org-link')); return; }
      var cl = e.target.closest('[data-city-link]'); if (cl) { e.stopPropagation(); openCityModal(cl.getAttribute('data-city-link')); return; }
      if (e.target.closest('a, button, input, select, textarea')) return;
      var tr = e.target.closest('tr[data-org]'); if (tr) openOrgModal(tr.getAttribute('data-org'));
    });
    $('orgs-body').addEventListener('keydown', function (e) {
      activateOnKeyboard(e, 'tr[data-org]', function (tr) { openOrgModal(tr.getAttribute('data-org')); });
    });
    $('org-modal-body').addEventListener('click', function (e) {
      var ol = e.target.closest('[data-org-link]'); if (ol) { openOrgModal(ol.getAttribute('data-org-link')); return; }
      var cl = e.target.closest('[data-city-link]'); if (cl) { openCityModal(cl.getAttribute('data-city-link')); }
    });
    $('cluster-cards').addEventListener('click', function (e) {
      var card = e.target.closest('[data-cluster]'); if (!card) return;
      selectCluster(card.getAttribute('data-cluster'), { toggle: true, scroll: true });
    });
    $('cluster-cards').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = e.target.closest('[data-cluster]'); if (!card) return;
      e.preventDefault();
      selectCluster(card.getAttribute('data-cluster'), { toggle: true, scroll: true });
    });
    $('cluster-reset').addEventListener('click', function () { selectCluster('', { toggle: false }); });
    $('cluster-layers').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-cluster-layer]'); if (!b || b.disabled) return;
      var k = b.getAttribute('data-cluster-layer');
      state.cluster.layers[k] = !state.cluster.layers[k];
      renderClusters();
    });
    $('cluster-legend').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cluster]'); if (!b) return;
      selectCluster(b.getAttribute('data-cluster'), { toggle: true });
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
        openCityModal(openCityId);
      } else if (openOrgId && !$('org-modal').classList.contains('hidden')) openOrgModal(openOrgId);
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
    renderRuntimeFallbacks();
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

  window.CHINA_AUTO_APP = {
    init: init, openCityModal: openCityModal, openOrgModal: openOrgModal,
    selectCluster: selectCluster, renderRuntimeFallbacks: renderRuntimeFallbacks
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
