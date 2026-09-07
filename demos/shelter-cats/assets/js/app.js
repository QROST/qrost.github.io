/* App orchestration: load → KPIs → map → filters → grid → modal. window.SHELTERCATS_APP */
(function () {
  'use strict';
  var D = window.SHELTERCATS_DATA, I18N = window.SHELTERCATS_I18N,
      MAP = window.SHELTERCATS_MAP, PX = window.SHELTERCATS_PIXELCAT,
      PERSONA = window.SHELTERCATS_PERSONA;
  var PAGE_SIZE = 48;

  var state = {
    f: { search: '', region: '', color: '', pattern: '', coat: '', age: '', sex: '', includeAdopted: false, shelter: '' },
    me: null, sort: 'newest', page: 0
  };
  var modalStop = null, modalReturnFocus = null, ready = false, loading = false;

  function $(id) { return document.getElementById(id); }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function haversine(a, b, c, d) {
    var R = 6371, dLat = (c - a) * Math.PI / 180, dLon = (d - b) * Math.PI / 180;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function shelterOf(cat) { return D.getShelter(cat.shelter_id); }
  function distOf(cat) {
    if (!state.me) return null;
    var s = shelterOf(cat); if (!s || typeof s.lat !== 'number') return null;
    return haversine(state.me.lat, state.me.lng, s.lat, s.lng);
  }

  // ---------- filters ----------
  function pass(cat) {
    var f = state.f;
    if (!f.includeAdopted && (cat.status === 'adopted' || cat.status === 'removed')) return false;
    if (f.shelter && cat.shelter_id !== f.shelter) return false;
    if (f.region) { var s = shelterOf(cat); if (!s || s.region !== f.region) return false; }
    if (f.color && (cat.colors || []).indexOf(f.color) === -1) return false;
    if (f.pattern && cat.pattern !== f.pattern) return false;
    if (f.coat && cat.coat_length !== f.coat) return false;
    if (f.age && cat.age_bucket !== f.age) return false;
    if (f.sex && cat.sex !== f.sex) return false;
    if (f.search) {
      var s2 = shelterOf(cat);
      var hay = (cat.name + ' ' + cat.breed_primary + ' ' + (cat.breed_secondary || '') + ' ' + (s2 ? s2.name : '')).toLowerCase();
      if (hay.indexOf(f.search.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function filtered() {
    var list = D.cats.filter(pass);
    var sort = state.sort;
    list.sort(function (a, b) {
      if (sort === 'distance' && state.me) { var da = distOf(a), db = distOf(b); return (da == null ? 1e9 : da) - (db == null ? 1e9 : db); }
      if (sort === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sort === 'age') return ageRank(a) - ageRank(b);
      return (b.first_seen || '').localeCompare(a.first_seen || ''); // newest
    });
    return list;
  }
  function ageRank(c) { return { kitten: 0, young: 1, adult: 2, senior: 3 }[c.age_bucket] != null ? { kitten: 0, young: 1, adult: 2, senior: 3 }[c.age_bucket] : 9; }

  // ---------- render ----------
  function swatch(tok) { return '<span class="swatch" style="background:' + I18N.enumHex(tok) + '"></span>'; }

  function renderGrid(keepPage) {
    if (!keepPage) state.page = 0;
    var list = filtered();
    var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    state.page = Math.max(0, Math.min(state.page, pages - 1));
    var start = state.page * PAGE_SIZE, end = Math.min(start + PAGE_SIZE, list.length);
    var countText = list.length + (I18N.isEn() ? ' cats' : ' 只');
    if (list.length) {
      countText += ' · ' + I18N.t('resultsRange').replace('{start}', start + 1).replace('{end}', end);
    }
    if (D.failedShards.length) countText += ' · ' + I18N.t('partialResults');
    $('result-count').textContent = countText;
    $('cat-pagination').classList.toggle('hidden', pages === 1);
    $('cat-prev').disabled = state.page === 0;
    $('cat-next').disabled = state.page === pages - 1;
    $('cat-page').textContent = I18N.t('pageRange').replace('{page}', state.page + 1).replace('{pages}', pages);
    var grid = $('cat-grid'), empty = $('cat-empty');
    grid.innerHTML = '';
    empty.textContent = I18N.t(D.failedShards.length ? 'partialEmpty' : 'noResults');
    if (!list.length) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    var frag = document.createDocumentFragment();
    list.slice(start, end).forEach(function (cat) {
      var s = shelterOf(cat);
      var dist = distOf(cat);
      var meta = [cat.breed_primary, cat.age_text || I18N.enumLabel('age_bucket', cat.age_bucket), I18N.enumLabel('sex', cat.sex)].filter(Boolean).join(' · ');
      var loc = s ? (s.city + ', ' + (s.state || s.country)) : '';
      if (dist != null) loc += ' · ' + Math.round(dist) + (I18N.isEn() ? ' km' : ' 公里');
      var tags = (cat.colors || []).slice(0, 2).map(function (c) { return swatch(c) + I18N.enumLabel('colors', c); }).join(' ');
      tags += ' <span class="chip">' + I18N.enumLabel('patterns', cat.pattern) + '</span>';
      tags += ' <span class="chip">' + I18N.enumLabel('coat', cat.coat_length) + '</span>';
      var card = el(
        '<button type="button" class="cat-card" data-id="' + escapeHtml(cat.id) + '" aria-label="' +
        escapeHtml((I18N.isEn() ? 'View ' : '查看 ') + cat.name + ' · ' + meta) + '">' +
        '<div class="cat-media"><canvas></canvas><span class="px-badge">pixel</span></div>' +
        '<div class="cat-body">' +
        '<div class="cat-name">' + escapeHtml(cat.name) + ' <span class="badge badge-status-' + cat.status + '">' + I18N.enumLabel('status', cat.status) + '</span></div>' +
        '<div class="cat-meta">' + escapeHtml(meta) + '</div>' +
        '<div class="cat-meta">' + escapeHtml(loc) + '</div>' +
        '<div class="cat-tags">' + tags + '</div>' +
        '</div></button>');
      card.addEventListener('click', function () { openModal(cat); });
      frag.appendChild(card);
    });
    grid.appendChild(frag);
    // draw pixel cats after layout (so clientWidth is known)
    requestAnimationFrame(function () {
      grid.querySelectorAll('.cat-card').forEach(function (card) {
        var cat = D.getCat(card.getAttribute('data-id'));
        var cv = card.querySelector('canvas');
        if (cat && cv) PX.draw(cv, cat);
      });
    });
  }

  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]; }); }

  // ---------- modal ----------
  function openModal(cat) {
    var s = shelterOf(cat);
    var body = $('cat-modal-body');
    var photo = cat.thumb_path ? cat.thumb_path : (cat.photo_url || '');
    var photoFrame = photo
      ? '<div class="frame"><span class="cap" data-i18n="mPhoto">' + I18N.t('mPhoto') + '</span><img loading="lazy" src="' + escapeHtml(photo) + '" onerror="this.style.display=\'none\'" alt="' + escapeHtml(cat.name) + '"/></div>'
      : '<div class="frame"><span class="cap">' + I18N.t('mPhoto') + '</span><span class="text-faint text-xs px-2">' + (I18N.isEn() ? 'no photo' : '暂无照片') + '</span></div>';
    var per = PERSONA.forCat(cat);
    var rows = [
      ['detBreed', cat.breed_primary + (cat.breed_secondary ? ' / ' + cat.breed_secondary : '') + (cat.breed_mixed ? (I18N.isEn() ? ' (mix)' : ' (混)') : '')],
      ['detAge', (cat.age_text || '') + (cat.age_bucket ? ' · ' + I18N.enumLabel('age_bucket', cat.age_bucket) : '')],
      ['detBirth', cat.birth_estimate || '—'],
      ['detSex', I18N.enumLabel('sex', cat.sex) + (cat.spayed_neutered ? (I18N.isEn() ? ' · fixed' : ' · 已绝育') : '')],
      ['detColor', (cat.colors || []).map(function (c) { return swatch(c) + escapeHtml(I18N.enumLabel('colors', c)); }).join('  '), true],
      ['detPattern', I18N.enumLabel('patterns', cat.pattern)],
      ['detCoat', I18N.enumLabel('coat', cat.coat_length)],
      ['detSize', I18N.enumLabel('size', cat.size)],
      ['detStatus', I18N.enumLabel('status', cat.status)],
      ['detShelter', s ? (s.name + (s.city ? ' — ' + s.city + ', ' + (s.state || s.country) : '')) : '—'],
      ['detSeen', (cat.first_seen || '').slice(0, 10)]
    ];
    var kv = rows.map(function (r) { return '<dt>' + I18N.t(r[0]) + '</dt><dd>' + (r[2] ? r[1] : escapeHtml(r[1] || '—')) + '</dd>'; }).join('');
    var goodLis = per.good.map(function (x) { return '<li>' + escapeHtml(x) + '</li>'; }).join('') || '<li class="text-faint">—</li>';
    var quirkLis = per.quirk.map(function (x) { return '<li>' + escapeHtml(x) + '</li>'; }).join('') || '<li class="text-faint">—</li>';

    body.innerHTML =
      '<h3 id="cat-modal-title" class="text-xl font-semibold">' + escapeHtml(cat.name) + ' <span class="badge badge-status-' + cat.status + '">' + I18N.enumLabel('status', cat.status) + '</span></h3>' +
      '<div class="cat-hero mt-3">' +
        photoFrame +
        '<div class="frame"><span class="cap">' + I18N.t('mGen') + '</span><canvas id="modal-cat"></canvas></div>' +
      '</div>' +
      '<p class="text-xs text-faint mt-2">' + I18N.t('mGenNote') + '</p>' +
      '<h4>' + I18N.t('mPersona') + '</h4>' +
      '<div class="persona">' +
        '<div class="persona-col persona-good"><h5>😺 ' + I18N.t('mGood') + '</h5><ul>' + goodLis + '</ul></div>' +
        '<div class="persona-col persona-quirk"><h5>🙀 ' + I18N.t('mQuirk') + '</h5><ul>' + quirkLis + '</ul></div>' +
      '</div>' +
      '<h4>' + I18N.t('mDetails') + '</h4>' +
      '<dl class="kv">' + kv + '</dl>' +
      '<div class="mt-4 flex flex-wrap gap-2">' +
        (cat.adoption_url ? '<a class="btn-accent" href="' + escapeHtml(cat.adoption_url) + '" target="_blank" rel="noopener">' + I18N.t('mAdopt') + ' ↗</a>' : '') +
        (s && s.website ? '<a class="btn-ghost" href="' + escapeHtml(s.website) + '" target="_blank" rel="noopener">' + I18N.t('detShelter') + ' ↗</a>' : '') +
      '</div>' +
      '<p class="text-xs text-faint mt-3">' + I18N.t('mSource') + ': ' + escapeHtml(sourceLabel(cat.source)) + '</p>';

    modalReturnFocus = document.activeElement;
    $('cat-modal').classList.remove('hidden');
    $('cat-modal').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var close = $('cat-modal').querySelector('[data-close-modal]');
    if (close) close.focus({ preventScroll: true });
    if (modalStop) { modalStop(); modalStop = null; }
    requestAnimationFrame(function () {
      var cv = $('modal-cat'); if (cv) modalStop = PX.animate(cv, cat);
    });
  }
  function closeModal() {
    var modal = $('cat-modal');
    if (modal.classList.contains('hidden')) return;
    modal.classList.add('hidden'); modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (modalStop) { modalStop(); modalStop = null; }
    if (modalReturnFocus && typeof modalReturnFocus.focus === 'function') modalReturnFocus.focus({ preventScroll: true });
    modalReturnFocus = null;
  }
  function trapModalFocus(e) {
    var modal = $('cat-modal');
    if (e.key !== 'Tab' || modal.classList.contains('hidden')) return;
    var nodes = modal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
    if (!nodes.length) return;
    var first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function sourceLabel(src) {
    var m = (D.manifest && D.manifest.sources || []).filter(function (x) { return x.id === src; })[0];
    return m ? (m.attribution || src) : src;
  }

  // ---------- map ----------
  function renderMap() {
    try {
      if (!window.echarts || !window.WORLD_GEO || !MAP) throw new Error('Map library or geography unavailable');
      var missingRegions = D.failedShards.map(function (shard) { return shard.region; });
      MAP.render({
      shelters: D.shelters.filter(function (shelter) { return missingRegions.indexOf(shelter.region) === -1; }),
      sizeMax: Math.max.apply(null, [0].concat(D.shelters.map(function (shelter) { return D.catsForShelter(shelter.id).length; }))),
      includeAdopted: state.f.includeAdopted,
      me: state.me,
      countFor: function (id) { return D.catsForShelter(id).filter(function (c) { return state.f.includeAdopted || (c.status !== 'adopted' && c.status !== 'removed'); }).length; },
      onClick: function (sid) {
        state.f.shelter = (state.f.shelter === sid) ? '' : sid;
        renderShelterPill(); renderGrid();
        document.getElementById('browse').scrollIntoView({ behavior: 'smooth' });
      }
      });
      $('library-warning').classList.add('hidden');
    } catch (error) {
      $('library-warning').classList.remove('hidden');
      console.warn('Shelter map unavailable', error);
    }
  }
  function renderShelterPill() {
    var wrap = $('shelter-filter');
    if (!state.f.shelter) { wrap.classList.add('hidden'); wrap.innerHTML = ''; return; }
    var s = D.getShelter(state.f.shelter);
    wrap.classList.remove('hidden');
    wrap.innerHTML = '<button type="button" class="chip-toggle active">📍 ' + escapeHtml(s ? s.name : state.f.shelter) +
      ' ✕</button>';
    wrap.querySelector('.chip-toggle').addEventListener('click', function () { state.f.shelter = ''; renderShelterPill(); renderGrid(); renderMap(); });
  }

  // ---------- filter UI population ----------
  function opt(v, label) { return '<option value="' + v + '">' + label + '</option>'; }
  function fillSelect(id, anyKey, group, tokens) {
    var sel = $(id);
    var html = opt('', I18N.t(anyKey));
    tokens.forEach(function (t) { html += opt(t, I18N.enumLabel(group, t)); });
    sel.innerHTML = html;
    var field = { 'f-region': 'region', 'f-color': 'color', 'f-pattern': 'pattern', 'f-coat': 'coat', 'f-age': 'age', 'f-sex': 'sex' }[id];
    sel.value = state.f[field] || '';
  }
  function presentTokens(group, accessor) {
    var counts = (D.manifest && D.manifest[group]) || null;
    if (counts) return Object.keys(counts);
    var set = {}; D.cats.forEach(function (c) { var v = accessor(c); (Array.isArray(v) ? v : [v]).forEach(function (x) { if (x) set[x] = 1; }); });
    return Object.keys(set);
  }
  function buildFilters() {
    fillSelect('f-region', 'anyRegion', 'regions', (D.enums && D.enums.regions_live) || []);
    fillSelect('f-color', 'anyColor', 'colors', presentTokens('color_counts', function (c) { return c.colors; }));
    fillSelect('f-pattern', 'anyPattern', 'patterns', presentTokens('pattern_counts', function (c) { return c.pattern; }));
    fillSelect('f-coat', 'anyCoat', 'coat', presentTokens('coat_counts', function (c) { return c.coat_length; }));
    fillSelect('f-age', 'anyAge', 'age_bucket', presentTokens('age_counts', function (c) { return c.age_bucket; }));
    fillSelect('f-sex', 'anySex', 'sex', presentTokens('sex_counts', function (c) { return c.sex; }));
    var sortSel = $('f-sort');
    var sortHtml = opt('newest', I18N.t('sortNewest')) + opt('name', I18N.t('sortName')) + opt('age', I18N.t('sortAge'));
    if (state.me) sortHtml = opt('distance', I18N.t('nearMeOn')) + sortHtml;
    sortSel.innerHTML = sortHtml;
    sortSel.value = state.sort;
  }

  // ---------- KPIs / about / footer ----------
  function renderMeta() {
    var m = D.manifest || {};
    $('kpi-cats').textContent = D.cats.length;
    $('kpi-adoptable').textContent = D.cats.filter(function (cat) { return cat.status === 'adoptable'; }).length;
    $('kpi-shelters').textContent = D.shelters.length;
    $('kpi-regions').textContent = (m.regions_live || []).length;
    $('kpi-photos').textContent = D.cats.filter(function (cat) { return cat.thumb_path; }).length;
    $('data-warning').classList.toggle('hidden', D.failedShards.length === 0);
    $('data-warning-text').textContent = I18N.t('partialData').replace('{loaded}', D.cats.length).replace('{total}', m.total_cats) +
      ' ' + D.failedShards.map(function (s) { return I18N.enumLabel('regions', s.region); }).join(' · ');
    $('foot-updated').textContent = (m.build_time || '').slice(0, 10);
    $('foot-build').textContent = 'build ' + (m.data_version || 'dev');

    var live = (D.enums && D.enums.regions_live || []).map(function (r) { return I18N.enumLabel('regions', r); }).join(' · ');
    $('coverage-banner').innerHTML = '<span>🗺️ ' + I18N.t('coverageLive') + '<b>' + live + '</b></span><span class="text-faint">' + I18N.t('coverageNote') + '</span>';

    var sources = (m.sources || []).map(function (sc) {
      return '<li><b>' + escapeHtml(sc.attribution || sc.id) + '</b>' + (sc.last_fetch ? ' — ' + (I18N.isEn() ? 'last fetched ' : '最近抓取 ') + sc.last_fetch.slice(0, 10) : '') + '</li>';
    }).join('');
    var safety = I18N.isEn()
      ? 'Data is fetched at build time only (never in your browser) from public open-data APIs and the RescueGroups API, throttled + cached + identifying itself, honoring robots.txt for any HTML source. Photos are cached as small thumbnails so a cat’s record survives after it is adopted/removed; the original source and adoption link are always kept. This is a non-commercial demo, not an official adoption channel — always confirm a cat on the shelter’s own page.'
      : '所有数据仅在构建时（本地）抓取，绝不在你的浏览器里发起：来自公共开放数据 API 与 RescueGroups API，限速+缓存+表明身份，HTML 源遵守 robots.txt。照片以小缩略图缓存，使猫被领养/下架后档案仍然保留；始终保留原始来源与领养链接。这是非商业演示，并非官方领养渠道——请以收容所页面为准。';
    $('about-body').innerHTML =
      '<p><b>' + (I18N.isEn() ? 'Snapshot sources' : '快照数据来源') + ':</b></p><ul class="list-disc ml-5">' + sources + '</ul>' +
      '<p class="mt-2">' + safety + '</p>' +
      '<p class="mt-2 text-faint">' + (I18N.isEn()
        ? 'Step 2 (planned): AIGC/CV-generated avatars & animations replace the procedural pixel-cat; the personality preview becomes LLM-narrated. The schema already reserves the hooks.'
        : '第二步（规划中）：用 AIGC/CV 生成的形象与动作替换程序化像素猫，性格预览改由大模型叙述。数据结构已预留接口。') + '</p>';
  }

  // ---------- near me ----------
  function nearMe() {
    if (!navigator.geolocation) { alert(I18N.isEn() ? 'Geolocation not available' : '无法获取定位'); return; }
    var btn = $('btn-near'); btn.textContent = '…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      state.me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      state.sort = 'distance';
      btn.textContent = '📍 ' + I18N.t('nearMe'); btn.classList.add('active');
      buildFilters(); renderMap(); renderGrid();
      try { if (MAP) MAP.focus(state.me.lng, state.me.lat, 3); } catch (_) {}
    }, function () {
      btn.textContent = I18N.t('nearMe');
      alert(I18N.isEn() ? 'Location permission denied.' : '定位权限被拒绝。');
    }, { timeout: 10000 });
  }

  // ---------- bind ----------
  function bind() {
    function changePage(delta) {
      state.page += delta; renderGrid(true);
      $('result-count').focus({ preventScroll: true });
      $('browse').scrollIntoView({ block: 'start' });
    }
    $('cat-prev').addEventListener('click', function () { changePage(-1); });
    $('cat-next').addEventListener('click', function () { changePage(1); });
    $('data-retry').addEventListener('click', boot);
    $('init-retry').addEventListener('click', boot);
    $('f-search').addEventListener('input', function (e) { state.f.search = e.target.value; renderGrid(); });
    [['f-region', 'region'], ['f-color', 'color'], ['f-pattern', 'pattern'], ['f-coat', 'coat'], ['f-age', 'age'], ['f-sex', 'sex']].forEach(function (p) {
      $(p[0]).addEventListener('change', function (e) { state.f[p[1]] = e.target.value; renderGrid(); });
    });
    $('f-sort').addEventListener('change', function (e) { state.sort = e.target.value; renderGrid(); });
    $('f-adopted').addEventListener('change', function (e) { state.f.includeAdopted = e.target.checked; renderGrid(); renderMap(); });
    $('btn-near').addEventListener('click', nearMe);
    $('btn-reset').addEventListener('click', function () {
      state.f = { search: '', region: '', color: '', pattern: '', coat: '', age: '', sex: '', includeAdopted: false, shelter: '' };
      state.me = null; state.sort = 'newest';
      $('btn-near').classList.remove('active'); $('btn-near').textContent = I18N.t('nearMe');
      $('f-search').value = ''; $('f-adopted').checked = false;
      buildFilters(); renderShelterPill(); renderMap(); renderGrid();
    });
    document.querySelectorAll('[data-close-modal]').forEach(function (b) { b.addEventListener('click', closeModal); });
    $('cat-modal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); else trapModalFocus(e); });

    $('theme-toggle').addEventListener('click', function () {
      var dark = !document.documentElement.classList.contains('dark');
      document.documentElement.classList.toggle('dark', dark);
      try { localStorage.setItem('shelter-cats-theme', dark ? 'dark' : 'light'); } catch (e) {}
      if (ready) renderMap();
    });
    $('lang-toggle').addEventListener('click', function () { I18N.toggleLang(); });
    I18N.onChange(function () { if (ready) { buildFilters(); renderMeta(); renderShelterPill(); renderMap(); renderGrid(true); } });
  }

  // ---------- boot ----------
  async function boot() {
    if (loading) return;
    loading = true;
    $('data-retry').disabled = $('init-retry').disabled = true;
    $('browse').setAttribute('aria-busy', 'true');
    I18N.apply();
    try {
      await D.init();
    } catch (e) {
      $('init-error').classList.remove('hidden');
      console.warn('Shelter data load failed', e);
      return;
    } finally {
      loading = false;
      $('data-retry').disabled = $('init-retry').disabled = false;
      $('browse').setAttribute('aria-busy', 'false');
    }
    ready = true;
    $('init-error').classList.add('hidden');
    buildFilters();
    renderMeta(); renderShelterPill(); renderGrid(); renderMap();
    I18N.apply();
  }

  function start() { bind(); boot(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.SHELTERCATS_APP = { state: state, renderGrid: renderGrid };
})();
