/* Pinyin / initials / alias matcher. window.CHINA_AUTO_SEARCH */
(function () {
  'use strict';

  function fold(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/ü/g, 'v')
      .replace(/u:/g, 'v')
      .replace(/['’`]/g, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^0-9a-z\u4e00-\u9fff]+/g, '');
  }

  function extraKeys(entity) {
    if (!entity) return [];
    var fields = [
      entity.id, entity.name_zh, entity.name_en,
      entity.display_name_zh, entity.display_name_en,
      entity.legal_name_zh, entity.legal_name_en,
      entity.province_zh, entity.province_en,
      entity.media_name_zh, entity.media_name_en,
      entity.school_zh, entity.school_en
    ];
    var aliases = entity.aliases || [];
    return fields.concat(aliases);
  }

  function keysOf(entity) {
    var out = [], seen = {};
    function add(s) {
      var k = fold(s);
      if (!k || seen[k]) return;
      seen[k] = 1;
      out.push(k);
    }
    (entity && entity.search_keys || []).forEach(add);
    extraKeys(entity).forEach(add);
    return out;
  }

  function match(entity, query) {
    var q = fold(query);
    if (!q) return true;
    var keys = keysOf(entity);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k.indexOf(q) !== -1) return true;
      if (q.length >= 2 && k.length >= 2 && q.indexOf(k) !== -1) return true;
    }
    return false;
  }

  function score(entity, query) {
    var q = fold(query);
    if (!q) return 0;
    var keys = keysOf(entity);
    var best = 0;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === q) best = Math.max(best, 100);
      else if (k.indexOf(q) === 0) best = Math.max(best, 86);
      else if (q.indexOf(k) === 0 && k.length >= 2) best = Math.max(best, 72);
      else if (k.indexOf(q) !== -1) best = Math.max(best, 55);
    }
    return best;
  }

  window.CHINA_AUTO_SEARCH = { fold: fold, match: match, score: score, keysOf: keysOf };
})();
