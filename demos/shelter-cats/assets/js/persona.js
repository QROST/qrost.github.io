/* Personality preview — turns a cat's REAL structured attributes into a bilingual
   "likely good habits / possible quirks" preview, so an adopter can imagine living
   with THIS cat. Rule-based + a seeded playful wildcard (the imagination layer).
   Phase-2 AIGC hook: an LLM-narrated description can replace/augment this.
   window.SHELTERCATS_PERSONA.forCat(cat) -> { good:[...], quirk:[...] } (localized) */
(function () {
  'use strict';
  var I18N = window.SHELTERCATS_I18N;

  function hashStr(s) { var h = 2166136261 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // tag -> line(s). Some tags from RescueGroups "qualities".
  var TAG_RULES = {
    playful:     { good: ['zh:爱玩，互动性强|en:loves to play and engage'] },
    affectionate:{ good: ['zh:亲人黏人，喜欢陪伴|en:affectionate, wants to be near you'] },
    friendly:    { good: ['zh:性格友好，容易相处|en:friendly and easygoing'] },
    cuddly:      { good: ['zh:喜欢被抱、会贴贴|en:a cuddler who seeks laps'] },
    lap_cat:     { good: ['zh:典型的膝上猫|en:a classic lap cat'] },
    curious:     { good: ['zh:好奇心强，爱探索|en:curious and exploratory'] },
    gentle:      { good: ['zh:温和不抓人|en:gentle and well-mannered'] },
    independent: { good: ['zh:独立，不黏人，好养|en:independent and low-demand'], quirk: ['zh:有自己的小脾气，需要空间|en:has opinions and wants its own space'] },
    shy:         { quirk: ['zh:初到新家会害羞，需要耐心|en:shy at first — needs patience to settle'] },
    vocal:       { quirk: ['zh:话痨，会一直跟你聊天|en:very vocal — will narrate your day'] },
    energetic:   { quirk: ['zh:精力旺盛，需要玩具放电|en:high energy — needs toys to burn it off'] }
  };

  // seeded fun "imagined" quirks (clearly playful — the imagination layer)
  var WILD = [
    'zh:会全程监督你打字|en:will supervise every keystroke',
    'zh:凌晨两点开运动会|en:hosts 2am zoomies',
    'zh:认定纸箱比玩具好玩|en:rates the cardboard box over the toy',
    'zh:从窗台审视你的人生选择|en:judges your life choices from the windowsill',
    'zh:坚信键盘是最佳坐垫|en:insists the keyboard is the best seat',
    'zh:会把你叫醒催早饭|en:will wake you for breakfast on schedule',
    'zh:对纸团有不解之缘|en:has a deep bond with crumpled paper'
  ];

  function loc(s) { var i = s.indexOf('|'); var zh = s.slice(0, i).replace('zh:', ''); var en = s.slice(i + 1).replace('en:', ''); return I18N.isEn() ? en : zh; }

  function forCat(cat) {
    var good = [], quirk = [];
    var a = cat.attributes || {}, gw = cat.good_with || {};

    if (a.house_trained === true) good.push('zh:已学会用猫砂盆|en:litter-box trained');
    if (cat.spayed_neutered === true || a.spayed_neutered === true) good.push('zh:已绝育|en:already spayed/neutered');
    if (a.shots_current === true) good.push('zh:疫苗齐全|en:vaccinations up to date');
    if (a.special_needs === true) quirk.push('zh:有特殊照护需求|en:has special-care needs');

    if (gw.children === 'yes') good.push('zh:对小孩友好|en:good with children');
    if (gw.children === 'no') quirk.push('zh:更适合安静的成人家庭|en:prefers a calm, adult home');
    if (gw.dogs === 'yes') good.push('zh:能与狗相处|en:gets along with dogs');
    if (gw.dogs === 'no') quirk.push('zh:不太喜欢狗|en:would rather skip the dog');
    if (gw.cats === 'yes') good.push('zh:能与其他猫相处|en:good with other cats');
    if (gw.cats === 'no') quirk.push('zh:想当家里唯一的猫|en:wants to be the only cat');

    switch (cat.age_bucket) {
      case 'kitten': good.push('zh:幼猫，亲人快、可塑性强|en:a kitten — bonds fast and adapts'); quirk.push('zh:幼猫精力爆棚|en:full kitten energy'); break;
      case 'young': good.push('zh:年轻又稳定，仍爱玩|en:young, settled, still playful'); break;
      case 'adult': good.push('zh:成年猫，性格已定、好预期|en:an adult — known, predictable temperament'); break;
      case 'senior': good.push('zh:老年猫，安静省心的膝上伴侣|en:a senior — calm, low-maintenance lap companion'); quirk.push('zh:需要规律安静的环境|en:appreciates a quiet routine'); break;
    }

    if (cat.coat_length === 'long') { good.push('zh:一身华丽长毛|en:a glorious long coat'); quirk.push('zh:需要定期梳毛|en:needs regular brushing'); }
    if (cat.coat_length === 'hairless') quirk.push('zh:无毛猫，需要保暖和护肤|en:hairless — needs warmth and skin care');
    if (cat.pattern === 'calico' || cat.pattern === 'tortie') quirk.push('zh:自带一点“玳瑁脾气”，个性十足|en:comes with a dash of "tortitude" — full of personality');
    if (cat.pattern === 'tabby') good.push('zh:经典虎斑，通常随和|en:a classic tabby — usually easygoing');
    if (cat.size === 'large') { good.push('zh:大块头，抱起来超满足|en:a big, huggable cat'); quirk.push('zh:会霸占整张沙发|en:will claim the whole sofa'); }

    (cat.personality_tags || []).forEach(function (t) {
      var key = String(t).toLowerCase().replace(/[^a-z]+/g, '_');
      var r = TAG_RULES[key];
      if (r) {
        (r.good || []).forEach(function (s) { good.push(s); });
        (r.quirk || []).forEach(function (s) { quirk.push(s); });
      } else if (t) {
        good.push('zh:被描述为：' + t + '|en:described as: ' + t);
      }
    });

    // seeded selection for variety + one wildcard quirk
    var rnd = mulberry32(hashStr(cat.id || cat.name || 'cat'));
    quirk.push(WILD[Math.floor(rnd() * WILD.length)]);

    function dedupePick(list, n) {
      var seen = {}, out = [];
      list.forEach(function (s) { if (!seen[s]) { seen[s] = 1; out.push(s); } });
      // stable shuffle by seed
      out.sort(function () { return rnd() - 0.5; });
      return out.slice(0, n).map(loc);
    }
    return { good: dedupePick(good, 4), quirk: dedupePick(quirk, 3) };
  }

  window.SHELTERCATS_PERSONA = { forCat: forCat };
})();
