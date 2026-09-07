/* Bilingual (zh/en) labels + enum-label resolution. window.SHELTERCATS_I18N
   Enum labels come from assets/data/enums.json (loaded by data-loader); UI strings
   live here. Mirrors the i18n API used across the other QROST demos. */
(function () {
  'use strict';
  var KEY = 'shelter-cats-lang';
  var lang = 'en';
  try { lang = localStorage.getItem(KEY) === 'zh' ? 'zh' : 'en'; } catch (e) {}
  var listeners = [];

  var L = {
    zh: {
      navBrand: '全球收容所猫', navMap: '地图', navBrowse: '浏览', navAbout: '关于',
      heroTitle: '全球收容所猫 · 在线大一统',
      heroSub: '把已覆盖开放数据地区的收容所猫缓存档案汇到一张地图：按颜色、花纹、毛长与距离筛选；每只猫还会根据真实属性生成像素形象与性格预览。',
      heroNote: '基于真实开放数据的构建时快照；当前领养状态请以来源页面为准。',
      kpiCats: '收录猫咪', kpiAdoptable: '可领养', kpiShelters: '收容所', kpiRegions: '覆盖地区', kpiPhotos: '已缓存照片',
      mapTitle: '已覆盖地区的收容所地图', mapSub: '每个圆是一家收容所，圆越大，缓存猫咪记录越多；点击查看该收容所的猫咪。',
      mapSizeLegend: '圆大小 · 猫咪记录数（只）',
      mapCountAll: '当前计数包含已领养 / 下架记录。', mapCountActive: '当前计数不含已领养 / 下架记录。',
      mapSizeNote: '只有“包含已领养/下架”开关改变圆点计数；其他目录筛选不影响计数。大小标尺固定于当前已加载的完整快照（包含所有状态）。',
      mapTouchEnable: '移动地图', mapTouchDisable: '锁定地图（可滚动页面）',
      browseTitle: '浏览猫咪', filtersReset: '重置', nearMe: '离我最近', nearMeOn: '已按距离排序',
      fColor: '颜色', fPattern: '花纹', fCoat: '毛长', fAge: '年龄', fSex: '性别', fStatus: '状态', fRegion: '地区',
      searchPh: '搜索名字 / 品种 / 收容所…', sortNewest: '最新收录', sortName: '名字', sortAge: '年龄',
      anyColor: '全部颜色', anyPattern: '全部花纹', anyCoat: '全部毛长', anyAge: '全部年龄', anySex: '全部性别', anyRegion: '全部地区',
      includeAdopted: '包含已领养/下架',
      ariaSort: '排序方式', mClose: '关闭',
      aboutTitle: '关于与数据来源', aboutSummary: '数据范围、安全抓取与归属说明',
      mGen: '像素形象', mGenNote: '由这只猫的真实属性（颜色/花纹/毛长/体型）确定性生成，纯前端无 AI。第二期将由 AIGC/CV 升级。',
      mPersona: '性格预览', mGood: '可能的好习惯', mQuirk: '可能的小毛病',
      mDetails: '档案', mPhoto: '收容所照片', mAdopt: '去领养页', mSource: '数据来源',
      detName: '名字', detBreed: '品种', detAge: '年龄', detBirth: '出生(估)', detSex: '性别', detColor: '颜色',
      detPattern: '花纹', detCoat: '毛长', detSize: '体型', detStatus: '状态', detShelter: '收容所', detSeen: '收录时间',
      noResults: '没有符合条件的猫咪。', loading: '加载中…',
      resultsRange: '显示 {start}–{end}', pageRange: '第 {page} / {pages} 页',
      previous: '上一页', next: '下一页', pagination: '猫咪目录分页', retry: '重试',
      partialResults: '仅含已加载记录', partialEmpty: '已加载的记录中没有匹配项；部分地区尚未加载，请重试。',
      partialData: '当前已加载 {loaded} / {total} 条猫咪记录。猫咪数量与筛选结果仅含已加载记录；收容所与覆盖地区数量来自完整快照目录。地图暂不显示下列未加载地区的收容所：',
      errTitle: '数据加载失败', errBody: '目录未能加载。请检查网络后重试；已显示的记录会继续保留。',
      footUpdated: '快照构建', footDisclaimer: '基于真实开放数据的演示 · 非官方领养渠道',
      coverageLive: '已覆盖地区：', coverageNote: '更多地区将通过新增数据源适配器逐步接入。',
      yes: '是', no: '否', unknown: '未知',
    },
    en: {
      navBrand: 'Shelter Cats', navMap: 'Map', navBrowse: 'Browse', navAbout: 'About',
      heroTitle: 'Shelter Cats — one platform for the world',
      heroSub: 'Cached shelter-cat records from covered open-data regions on a single map: filter by color, pattern, coat length and distance. Every cat gets a generated pixel avatar and a personality preview.',
      heroNote: 'A build-time snapshot of real open data; confirm current availability at the source page.',
      kpiCats: 'Cats', kpiAdoptable: 'Adoptable', kpiShelters: 'Shelters', kpiRegions: 'Regions', kpiPhotos: 'Cached photos',
      mapTitle: 'Shelters in covered regions', mapSub: 'Each circle is a shelter. Larger circles mean more cached cat records; click to see that shelter’s cats.',
      mapSizeLegend: 'Circle size · cached cat records',
      mapCountAll: 'Counts include adopted / removed records.', mapCountActive: 'Counts exclude adopted / removed records.',
      mapSizeNote: 'Only the “Include adopted/removed” switch changes circle counts; other catalog filters do not. The size scale stays fixed to all loaded snapshot records, including every status.',
      mapTouchEnable: 'Move map', mapTouchDisable: 'Lock map (scroll page)',
      browseTitle: 'Browse cats', filtersReset: 'Reset', nearMe: 'Near me', nearMeOn: 'Sorted by distance',
      fColor: 'Color', fPattern: 'Pattern', fCoat: 'Coat', fAge: 'Age', fSex: 'Sex', fStatus: 'Status', fRegion: 'Region',
      searchPh: 'Search name / breed / shelter…', sortNewest: 'Newest', sortName: 'Name', sortAge: 'Age',
      anyColor: 'Any color', anyPattern: 'Any pattern', anyCoat: 'Any coat', anyAge: 'Any age', anySex: 'Any sex', anyRegion: 'Any region',
      includeAdopted: 'Include adopted/removed',
      ariaSort: 'Sort by', mClose: 'Close',
      aboutTitle: 'About & data sources', aboutSummary: 'Coverage, polite fetching & attribution',
      mGen: 'Pixel avatar', mGenNote: 'Deterministically generated from this cat’s real attributes (color/pattern/coat/size) — pure front-end, no AI. Phase 2 upgrades this with AIGC/CV.',
      mPersona: 'Personality preview', mGood: 'Likely good habits', mQuirk: 'Possible quirks',
      mDetails: 'Profile', mPhoto: 'Shelter photo', mAdopt: 'Adoption page', mSource: 'Source',
      detName: 'Name', detBreed: 'Breed', detAge: 'Age', detBirth: 'Born (est.)', detSex: 'Sex', detColor: 'Color',
      detPattern: 'Pattern', detCoat: 'Coat', detSize: 'Size', detStatus: 'Status', detShelter: 'Shelter', detSeen: 'First seen',
      noResults: 'No cats match these filters.', loading: 'Loading…',
      resultsRange: 'Showing {start}–{end}', pageRange: 'Page {page} / {pages}',
      previous: 'Previous', next: 'Next', pagination: 'Cat pages', retry: 'Retry',
      partialResults: 'Loaded records only', partialEmpty: 'No matches in the loaded records. Some regions have not loaded; please retry.',
      partialData: 'Loaded {loaded} / {total} cat records. Cat counts and search results include loaded records only; shelter and region counts describe the full snapshot directory. Shelters in these unloaded regions are omitted from the map:',
      errTitle: 'Data failed to load', errBody: 'The catalog could not load. Check your connection and retry; any records already displayed remain available.',
      footUpdated: 'Snapshot built', footDisclaimer: 'Demo on real open data · not an official adoption channel',
      coverageLive: 'Covered regions: ', coverageNote: 'More regions are added incrementally via new source adapters.',
      yes: 'Yes', no: 'No', unknown: 'Unknown',
    }
  };

  function enums() { return (window.SHELTERCATS_DATA && window.SHELTERCATS_DATA.enums) || {}; }

  var I = {
    isEn: function () { return lang === 'en'; },
    lang: function () { return lang; },
    t: function (k) { return (L[lang][k] != null) ? L[lang][k] : (L.en[k] != null ? L.en[k] : k); },
    pick: function (zh, en) { return lang === 'zh' ? (zh || en) : (en || zh); },
    enumLabel: function (group, token) {
      var g = enums()[group];
      if (g && g[token]) return g[token][lang] || g[token].en || token;
      return token || '';
    },
    enumHex: function (token) {
      var g = enums().colors; return (g && g[token] && g[token].hex) || '#8d909b';
    },
    toggleLang: function () {
      lang = (lang === 'en') ? 'zh' : 'en';
      try { localStorage.setItem(KEY, lang); } catch (e) {}
      apply(); listeners.forEach(function (cb) { try { cb(lang); } catch (e) {} });
    },
    onChange: function (cb) { listeners.push(cb); },
    apply: function () { apply(); }
  };

  function apply() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = I.t(el.getAttribute('data-i18n')); if (v != null) el.textContent = v;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      var v = I.t(el.getAttribute('data-i18n-ph')); if (v != null) el.setAttribute('placeholder', v);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var v = I.t(el.getAttribute('data-i18n-aria')); if (v != null) el.setAttribute('aria-label', v);
    });
    var lt = document.getElementById('lang-toggle');
    if (lt) lt.textContent = (lang === 'en') ? '中' : 'EN';
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh' : 'en');
  }

  window.SHELTERCATS_I18N = I;
})();
