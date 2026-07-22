(function (global) {
  'use strict';

  // Canonical taxonomy mirrored from shelter-cats/assets/data/enums.json.
  // Shelter records describe whole-coat categories; they do not annotate
  // per-part regions. Placement of socks, bibs, points and patches therefore
  // remains renderer-owned rather than being invented here as shelter data.

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  const COLORS = deepFreeze({
    black: { zh: '黑色', en: 'Black', hex: '#2b2b30' },
    white: { zh: '白色', en: 'White', hex: '#f3efe7' },
    gray: { zh: '灰色', en: 'Gray', hex: '#8d909b' },
    blue: { zh: '蓝灰', en: 'Blue (gray)', hex: '#7d8a9c' },
    brown: { zh: '棕色', en: 'Brown', hex: '#6b4a34' },
    chocolate: { zh: '巧克力', en: 'Chocolate', hex: '#4a2f24' },
    orange: { zh: '橙色', en: 'Orange/Ginger', hex: '#d98036' },
    cream: { zh: '奶油色', en: 'Cream', hex: '#e8d3a8' },
    tan: { zh: '浅黄褐', en: 'Tan/Buff', hex: '#c9a86b' },
    lilac: { zh: '丁香灰', en: 'Lilac', hex: '#b9adb0' },
  });

  const PATTERNS = deepFreeze({
    solid: { zh: '纯色', en: 'Solid' },
    tabby: { zh: '虎斑', en: 'Tabby' },
    bicolor: { zh: '双色', en: 'Bicolor' },
    tuxedo: { zh: '燕尾服', en: 'Tuxedo' },
    calico: { zh: '三花/玳瑁白', en: 'Calico' },
    tortie: { zh: '玳瑁', en: 'Tortoiseshell' },
    pointed: { zh: '重点色', en: 'Pointed' },
    smoke: { zh: '烟色', en: 'Smoke/Shaded' },
  });

  const FUR_LENGTHS = deepFreeze({
    short: { zh: '短毛', en: 'Short hair' },
    medium: { zh: '中长毛', en: 'Medium hair' },
    long: { zh: '长毛', en: 'Long hair' },
    hairless: { zh: '无毛', en: 'Hairless' },
  });

  const WHITE_LEVELS = deepFreeze({
    none: { zh: '无浅色斑', en: 'No light markings' },
    low: { zh: '少量浅色斑', en: 'Low light markings' },
    medium: { zh: '中等浅色斑', en: 'Medium light markings' },
    high: { zh: '大量浅色斑', en: 'High light markings' },
  });

  // Each colorway references only the canonical color tokens above. The role
  // hints select a palette; they intentionally say nothing about body regions.
  const COLORWAYS = deepFreeze({
    solid: {
      black: { zh: '黑色', en: 'Black', colors: ['black'], base: 'black' },
      white: { zh: '白色', en: 'White', colors: ['white'], base: 'white' },
      gray: { zh: '灰色', en: 'Gray', colors: ['gray'], base: 'gray' },
      blue: { zh: '蓝灰', en: 'Blue', colors: ['blue'], base: 'blue' },
      brown: { zh: '棕色', en: 'Brown', colors: ['brown'], base: 'brown' },
      chocolate: { zh: '巧克力', en: 'Chocolate', colors: ['chocolate'], base: 'chocolate' },
      orange: { zh: '橙色', en: 'Orange', colors: ['orange'], base: 'orange' },
      cream: { zh: '奶油色', en: 'Cream', colors: ['cream'], base: 'cream' },
      tan: { zh: '浅黄褐', en: 'Tan', colors: ['tan'], base: 'tan' },
      lilac: { zh: '丁香灰', en: 'Lilac', colors: ['lilac'], base: 'lilac' },
    },
    tabby: {
      gray: { zh: '灰虎斑', en: 'Gray tabby', colors: ['gray'], base: 'gray' },
      brown: { zh: '棕虎斑', en: 'Brown tabby', colors: ['brown'], base: 'brown' },
      orange: { zh: '橙虎斑', en: 'Orange tabby', colors: ['orange'], base: 'orange' },
      cream: { zh: '奶油虎斑', en: 'Cream tabby', colors: ['cream'], base: 'cream' },
      tan: { zh: '浅黄褐虎斑', en: 'Tan tabby', colors: ['tan'], base: 'tan' },
      blue: { zh: '蓝灰虎斑', en: 'Blue tabby', colors: ['blue'], base: 'blue' },
    },
    bicolor: {
      'black-white': { zh: '黑白', en: 'Black & white', colors: ['black', 'white'], base: 'black', accent: 'white', white: 'white' },
      'gray-white': { zh: '灰白', en: 'Gray & white', colors: ['gray', 'white'], base: 'gray', accent: 'white', white: 'white' },
      'orange-white': { zh: '橙白', en: 'Orange & white', colors: ['orange', 'white'], base: 'orange', accent: 'white', white: 'white' },
      'brown-cream': { zh: '棕色与奶油色', en: 'Brown & cream', colors: ['brown', 'cream'], base: 'brown', accent: 'cream', white: 'cream' },
      'blue-cream': { zh: '蓝灰与奶油', en: 'Blue & cream', colors: ['blue', 'cream'], base: 'blue', accent: 'cream', white: 'cream' },
      'chocolate-cream': { zh: '巧克力与奶油', en: 'Chocolate & cream', colors: ['chocolate', 'cream'], base: 'chocolate', accent: 'cream', white: 'cream' },
      'lilac-white': { zh: '丁香与白', en: 'Lilac & white', colors: ['lilac', 'white'], base: 'lilac', accent: 'white', white: 'white' },
    },
    tuxedo: {
      'black-white': { zh: '黑白燕尾服', en: 'Black tuxedo', colors: ['black', 'white'], base: 'black', accent: 'white', white: 'white' },
      'gray-white': { zh: '灰白燕尾服', en: 'Gray tuxedo', colors: ['gray', 'white'], base: 'gray', accent: 'white', white: 'white' },
      'blue-white': { zh: '蓝灰燕尾服', en: 'Blue tuxedo', colors: ['blue', 'white'], base: 'blue', accent: 'white', white: 'white' },
    },
    calico: {
      classic: { zh: '经典三花', en: 'Classic calico', colors: ['white', 'black', 'orange'], base: 'white', accent: 'black', third: 'orange', white: 'white' },
      dilute: { zh: '淡三花', en: 'Dilute calico', colors: ['white', 'blue', 'cream'], base: 'white', accent: 'blue', third: 'cream', white: 'white' },
    },
    tortie: {
      classic: { zh: '经典玳瑁', en: 'Classic tortie', colors: ['black', 'orange', 'brown'], base: 'black', accent: 'orange', third: 'brown' },
      dilute: { zh: '淡玳瑁', en: 'Dilute tortie', colors: ['blue', 'cream', 'lilac'], base: 'blue', accent: 'cream', third: 'lilac' },
    },
    pointed: {
      seal: { zh: '海豹重点色', en: 'Seal point', colors: ['cream', 'brown'], base: 'cream', accent: 'brown', third: 'black' },
      chocolate: { zh: '巧克力重点色', en: 'Chocolate point', colors: ['cream', 'chocolate'], base: 'cream', accent: 'chocolate' },
      blue: { zh: '蓝重点色', en: 'Blue point', colors: ['cream', 'blue'], base: 'cream', accent: 'blue' },
      lilac: { zh: '丁香重点色', en: 'Lilac point', colors: ['cream', 'lilac'], base: 'cream', accent: 'lilac' },
      flame: { zh: '火焰重点色', en: 'Flame point', colors: ['cream', 'orange'], base: 'cream', accent: 'orange' },
    },
    smoke: {
      black: { zh: '黑烟色', en: 'Black smoke', colors: ['black', 'white'], base: 'black', accent: 'white' },
      blue: { zh: '蓝烟色', en: 'Blue smoke', colors: ['blue', 'white'], base: 'blue', accent: 'white' },
      gray: { zh: '灰烟色', en: 'Gray smoke', colors: ['gray', 'white'], base: 'gray', accent: 'white' },
    },
  });

  const LEGAL_COLORWAYS = deepFreeze(Object.keys(PATTERNS).reduce(function (result, pattern) {
    result[pattern] = Object.keys(COLORWAYS[pattern]);
    return result;
  }, {}));

  const LEGAL_WHITE_LEVELS = deepFreeze({
    solid: ['none'],
    tabby: ['none', 'low', 'medium'],
    bicolor: ['low', 'medium', 'high'],
    tuxedo: ['medium'],
    calico: ['low', 'medium', 'high'],
    // A tortie with white is classified as calico in the sibling data model.
    tortie: ['none'],
    pointed: ['none'],
    smoke: ['none'],
  });

  const DEFAULT = deepFreeze({
    pattern: 'tabby',
    colorway: 'orange',
    whiteLevel: 'low',
    furLength: 'short',
  });

  const EMPTY = Object.freeze([]);

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function validColorways(pattern) {
    return hasOwn(LEGAL_COLORWAYS, pattern) ? LEGAL_COLORWAYS[pattern] : EMPTY;
  }

  function validWhiteLevels(pattern) {
    return hasOwn(LEGAL_WHITE_LEVELS, pattern) ? LEGAL_WHITE_LEVELS[pattern] : EMPTY;
  }

  function normalize(state) {
    const input = state && typeof state === 'object' ? state : {};
    let pattern = hasOwn(PATTERNS, input.pattern) ? input.pattern : DEFAULT.pattern;
    const furLength = hasOwn(FUR_LENGTHS, input.furLength) ? input.furLength : DEFAULT.furLength;

    // Smoke describes colored hair over a pale undercoat, so it has no honest
    // hairless rendering. Preserve the selected smoke base as a solid skin
    // color when possible instead of silently putting fur on a hairless cat.
    if (furLength === 'hairless' && pattern === 'smoke') pattern = 'solid';

    const ways = validColorways(pattern);
    const requestedColorway = typeof input.colorway === 'string' ? input.colorway : DEFAULT.colorway;
    const colorway = ways.indexOf(requestedColorway) !== -1 ? requestedColorway : ways[0];
    const levels = validWhiteLevels(pattern);
    const requestedWhite = typeof input.whiteLevel === 'string' ? input.whiteLevel : DEFAULT.whiteLevel;
    const whiteLevel = levels.indexOf(requestedWhite) !== -1 ? requestedWhite : levels[0];

    return { pattern: pattern, colorway: colorway, whiteLevel: whiteLevel, furLength: furLength };
  }

  function hexToRgb(hex) {
    const match = typeof hex === 'string' && /^#([0-9a-f]{6})$/i.exec(hex);
    if (!match) return { r: 0, g: 0, b: 0 };
    const value = parseInt(match[1], 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }

  function channelHex(value) {
    return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  }

  function mixHex(from, to, amount) {
    const a = hexToRgb(from);
    const b = hexToRgb(to);
    const t = Number.isFinite(amount) ? Math.max(0, Math.min(1, amount)) : 0;
    return '#' + channelHex(a.r + (b.r - a.r) * t)
      + channelHex(a.g + (b.g - a.g) * t)
      + channelHex(a.b + (b.b - a.b) * t);
  }

  function rgba(hex, alpha) {
    const rgb = hexToRgb(hex);
    const a = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
    return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + a + ')';
  }

  function tokenHex(token, fallback) {
    return hasOwn(COLORS, token) ? COLORS[token].hex : fallback;
  }

  function resolvePalette(state, dark) {
    const canonical = normalize(state);
    const way = COLORWAYS[canonical.pattern][canonical.colorway];
    const darkMode = Boolean(dark);
    const canvasWhite = darkMode ? '#eee6d8' : COLORS.white.hex;
    let fur = tokenHex(way.base, COLORS.orange.hex);
    let coatAccent = tokenHex(way.accent, mixHex(fur, '#151319', 0.48));
    let coatThird = tokenHex(way.third, coatAccent);
    let coatWhite = tokenHex(way.white, canvasWhite);

    if (canonical.furLength === 'hairless') {
      const skin = darkMode ? '#b9877d' : '#c99586';
      fur = mixHex(fur, skin, 0.58);
      coatAccent = mixHex(coatAccent, skin, 0.35);
      coatThird = mixHex(coatThird, skin, 0.35);
      coatWhite = mixHex(coatWhite, skin, 0.24);
    } else if (darkMode) {
      fur = mixHex(fur, '#ffffff', 0.09);
      coatAccent = mixHex(coatAccent, '#ffffff', 0.07);
      coatThird = mixHex(coatThird, '#ffffff', 0.07);
      coatWhite = mixHex(coatWhite, '#ffffff', 0.03);
    }

    const furLight = mixHex(fur, canvasWhite, canonical.furLength === 'hairless' ? 0.18 : 0.29);
    const furDark = mixHex(fur, '#171319', canonical.furLength === 'hairless' ? 0.27 : 0.42);
    const stripeHex = mixHex(fur, '#171319', canonical.pattern === 'tabby' ? 0.54 : 0.43);
    const earHex = mixHex(fur, darkMode ? '#c47778' : '#b86768', 0.48);

    // Canonical state and token IDs travel with the renderer colors so callers
    // never need to reverse-engineer the user's selection from mixed hex values.
    return {
      pattern: canonical.pattern,
      colorway: canonical.colorway,
      whiteLevel: canonical.whiteLevel,
      furLength: canonical.furLength,
      colorTokens: way.colors.slice(),
      fur: fur,
      furLight: furLight,
      furDark: furDark,
      stripe: rgba(stripeHex, darkMode ? 0.68 : 0.56),
      cream: coatWhite,
      coatWhite: coatWhite,
      coatAccent: coatAccent,
      coatThird: coatThird,
      earShade: rgba(earHex, darkMode ? 0.58 : 0.46),
      nose: darkMode ? '#bd756d' : '#a75f57',
      skinLine: rgba(furDark, canonical.furLength === 'hairless' ? 0.72 : 0.82),
    };
  }

  function randomIndex(length, random) {
    let value;
    try { value = random(); } catch (_) { value = 0; }
    if (!Number.isFinite(value)) value = 0;
    value = Math.max(0, Math.min(0.9999999999999999, value));
    return Math.floor(value * length);
  }

  function randomize(random) {
    const rng = typeof random === 'function' ? random : Math.random;
    const furLengths = Object.keys(FUR_LENGTHS);
    const furLength = furLengths[randomIndex(furLengths.length, rng)];
    const patterns = Object.keys(PATTERNS).filter(function (pattern) {
      return furLength !== 'hairless' || pattern !== 'smoke';
    });
    const pattern = patterns[randomIndex(patterns.length, rng)];
    const ways = validColorways(pattern);
    const levels = validWhiteLevels(pattern);
    return {
      pattern: pattern,
      colorway: ways[randomIndex(ways.length, rng)],
      whiteLevel: levels[randomIndex(levels.length, rng)],
      furLength: furLength,
    };
  }

  const CATALOGS = deepFreeze({
    colors: COLORS,
    patterns: PATTERNS,
    furLengths: FUR_LENGTHS,
    colorways: COLORWAYS,
    whiteLevels: WHITE_LEVELS,
    legalColorways: LEGAL_COLORWAYS,
    legalWhiteLevels: LEGAL_WHITE_LEVELS,
  });

  global.CatAppearance = Object.freeze({
    COLORS: COLORS,
    PATTERNS: PATTERNS,
    FUR_LENGTHS: FUR_LENGTHS,
    COLORWAYS: COLORWAYS,
    WHITE_LEVELS: WHITE_LEVELS,
    LEGAL_COLORWAYS: LEGAL_COLORWAYS,
    LEGAL_WHITE_LEVELS: LEGAL_WHITE_LEVELS,
    CATALOGS: CATALOGS,
    DEFAULT: DEFAULT,
    normalize: normalize,
    resolvePalette: resolvePalette,
    randomize: randomize,
    validColorways: validColorways,
    validWhiteLevels: validWhiteLevels,
  });
})(window);
