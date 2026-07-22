/* Cat & Mouse — flat bilingual labels. Default language: 中文. */
(function attachCatMouseI18n() {
  'use strict';

  const LANG_KEY = 'cat-and-mouse-lang';
  const LABELS = {
    pageTitle: { zh: '猫鼠之间 · Cat & Mouse', en: 'Cat & Mouse · 猫鼠之间' },
    metaDescription: {
      zh: '一只俯视角的小猫会观察、潜行和追逐化作小老鼠的指针，安静时也会蹲坐、侧躺、打滚或蜷卧。',
      en: 'A top-down cat watches, stalks and chases your pointer-as-mouse, then sits, loafs, rolls or curls up when left alone.',
    },
    homeAria: { zh: '返回 QROST 首页', en: 'Back to QROST home' },
    pageControlsAria: { zh: '页面控件', en: 'Page controls' },
    displayOptionsAria: { zh: '显示选项', en: 'Display options' },
    appearanceToggleAria: { zh: '定制猫咪外观', en: 'Customize the cat' },
    appearanceToggleTitle: { zh: '定制猫咪外观', en: 'Customize cat appearance' },
    appearanceKicker: { zh: '收容所猫咪灵感', en: 'SHELTER-INSPIRED' },
    appearanceTitle: { zh: '定制猫咪', en: 'Customize the cat' },
    appearanceCloseAria: { zh: '关闭外观选项', en: 'Close appearance options' },
    appearanceCloseTitle: { zh: '关闭', en: 'Close' },
    appearancePatternLabel: { zh: '花纹类型', en: 'Coat pattern' },
    appearanceColorwayLabel: { zh: '配色组合', en: 'Color combination' },
    appearanceWhiteLevelLabel: { zh: '浅色斑区域', en: 'Light marking areas' },
    appearanceFurLengthLabel: { zh: '毛长', en: 'Fur length' },
    appearanceRandomize: { zh: '换一只', en: 'Surprise me' },
    appearanceReset: { zh: '恢复橘猫', en: 'Reset to ginger' },
    appearanceSource: {
      zh: '分类沿用 Shelter Cats 的受控词表；部位分布由本页程序化绘制。',
      en: 'Categories follow the Shelter Cats vocabulary; body-part placement is drawn procedurally here.',
    },
    appearancePreviewAria: {
      zh: '当前配色的实时预览',
      en: 'Live preview of the current coat',
    },
    appearancePatternGroupAria: { zh: '花纹类型选择', en: 'Coat pattern chooser' },
    appearanceColorwayGroupAria: { zh: '配色组合选择', en: 'Color combination chooser' },
    appearanceWhiteLevelGroupAria: { zh: '浅色斑区域选择', en: 'Light marking chooser' },
    appearanceCurrentColorway: { zh: '当前配色', en: 'Current color' },
    appearanceNoColorway: { zh: '当前花纹无配色变体', en: 'No color variants for this pattern' },
    patternSolid: { zh: '纯色', en: 'Solid' },
    patternTabby: { zh: '虎斑', en: 'Tabby' },
    patternBicolor: { zh: '双色', en: 'Bicolor' },
    patternTuxedo: { zh: '燕尾服', en: 'Tuxedo' },
    patternCalico: { zh: '三花', en: 'Calico' },
    patternTortie: { zh: '玳瑁', en: 'Tortoiseshell' },
    patternPointed: { zh: '重点色', en: 'Pointed' },
    patternSmoke: { zh: '烟色', en: 'Smoke / shaded' },
    colorBlack: { zh: '黑色', en: 'Black' },
    colorWhite: { zh: '白色', en: 'White' },
    colorGray: { zh: '灰色', en: 'Gray' },
    colorBlue: { zh: '蓝灰', en: 'Blue gray' },
    colorBrown: { zh: '棕色', en: 'Brown' },
    colorChocolate: { zh: '巧克力', en: 'Chocolate' },
    colorOrange: { zh: '橙色', en: 'Orange / ginger' },
    colorCream: { zh: '奶油色', en: 'Cream' },
    colorTan: { zh: '浅黄褐', en: 'Tan / buff' },
    colorLilac: { zh: '丁香灰', en: 'Lilac' },
    colorwayGrayTabby: { zh: '灰色虎斑', en: 'Gray tabby' },
    colorwayBrownTabby: { zh: '棕色虎斑', en: 'Brown tabby' },
    colorwayOrangeTabby: { zh: '橘色虎斑', en: 'Ginger tabby' },
    colorwayCreamTabby: { zh: '奶油虎斑', en: 'Cream tabby' },
    colorwayTanTabby: { zh: '黄褐虎斑', en: 'Tan tabby' },
    colorwayBlueTabby: { zh: '蓝灰虎斑', en: 'Blue tabby' },
    colorwayBlackWhite: { zh: '黑白', en: 'Black and white' },
    colorwayGrayWhite: { zh: '灰白', en: 'Gray and white' },
    colorwayOrangeWhite: { zh: '橘白', en: 'Ginger and white' },
    colorwayBrownCream: { zh: '棕色与奶油', en: 'Brown and cream' },
    colorwayBlueCream: { zh: '蓝灰与奶油', en: 'Blue and cream' },
    colorwayChocolateCream: { zh: '巧克力与奶油', en: 'Chocolate and cream' },
    colorwayLilacWhite: { zh: '丁香与白', en: 'Lilac and white' },
    colorwayGrayTuxedo: { zh: '灰白燕尾服', en: 'Gray tuxedo' },
    colorwayBlueTuxedo: { zh: '蓝灰燕尾服', en: 'Blue tuxedo' },
    colorwayClassicTuxedo: { zh: '经典黑白', en: 'Classic black tuxedo' },
    colorwayClassicCalico: { zh: '经典三花', en: 'Classic calico' },
    colorwayDiluteCalico: { zh: '淡三花', en: 'Dilute calico' },
    colorwayClassicTortie: { zh: '经典玳瑁', en: 'Classic tortie' },
    colorwayDiluteTortie: { zh: '淡玳瑁', en: 'Dilute tortie' },
    colorwaySealPoint: { zh: '海豹重点', en: 'Seal point' },
    colorwayChocolatePoint: { zh: '巧克力重点', en: 'Chocolate point' },
    colorwayBluePoint: { zh: '蓝灰重点', en: 'Blue point' },
    colorwayLilacPoint: { zh: '丁香重点', en: 'Lilac point' },
    colorwayFlamePoint: { zh: '火焰重点', en: 'Flame point' },
    colorwayBlackSmoke: { zh: '黑烟色', en: 'Black smoke' },
    colorwayBlueSmoke: { zh: '蓝烟色', en: 'Blue smoke' },
    colorwayGraySmoke: { zh: '灰烟色', en: 'Gray smoke' },
    whiteLevelNone: { zh: '无浅色斑', en: 'No light markings' },
    whiteLevelLow: { zh: '口鼻 · 胸口 · 爪尖', en: 'Muzzle · bib · paw tips' },
    whiteLevelMedium: { zh: '面部 · 胸腹 · 四袜', en: 'Face · belly · four socks' },
    whiteLevelHigh: { zh: '大面积浅色 · 头尾色块', en: 'Mostly light · head and tail patches' },
    furShort: { zh: '短毛', en: 'Short hair' },
    furMedium: { zh: '中毛', en: 'Medium hair' },
    furLong: { zh: '长毛', en: 'Long hair' },
    furHairless: { zh: '无毛', en: 'Hairless' },
    eyebrow: { zh: '四相猫科步态', en: 'FOUR-PHASE FELINE GAIT' },
    title: { zh: '猫鼠之间', en: 'CAT & MOUSE' },
    subtitle: { zh: '眼睛先动，脚步随后', en: 'eyes first, paws follow' },
    pauseAria: { zh: '暂停动画', en: 'Pause animation' },
    resumeAria: { zh: '继续动画', en: 'Resume animation' },
    langAria: { zh: 'Switch to English', en: '切换到中文' },
    themeDarkAria: { zh: '切换深色模式', en: 'Switch to dark mode' },
    themeLightAria: { zh: '切换浅色模式', en: 'Switch to light mode' },
    themeDarkTitle: { zh: '深色模式', en: 'Dark mode' },
    themeLightTitle: { zh: '浅色模式', en: 'Light mode' },
    canvasAria: {
      zh: '猫鼠互动区域。移动指针或用方向键控制小老鼠；空格键暂停，Escape 让小老鼠离开。',
      en: 'Cat and mouse interaction area. Move the pointer or use arrow keys to steer the mouse; Space pauses and Escape releases it.',
    },
    stateProwl: { zh: '巡游', en: 'prowling' },
    stateObserve: { zh: '发现目标', en: 'target spotted' },
    stateWatch: { zh: '盯梢', en: 'watching' },
    stateStalk: { zh: '潜行靠近', en: 'stalking' },
    stateChase: { zh: '追逐', en: 'chasing' },
    stateCrouch: { zh: '蓄势', en: 'coiling' },
    statePounce: { zh: '扑击', en: 'pouncing' },
    stateLand: { zh: '扑落', en: 'landing' },
    statePin: { zh: '按住', en: 'pinning' },
    stateSit: { zh: '蹲坐', en: 'sitting' },
    stateLoaf: { zh: '揣手蹲卧', en: 'loafing' },
    stateSideLie: { zh: '侧躺', en: 'lying on its side' },
    stateRoll: { zh: '打滚', en: 'rolling over' },
    stateCurl: { zh: '蜷卧', en: 'curled up' },
    stateGroom: { zh: '理毛', en: 'grooming' },
    stateStretch: { zh: '伸展', en: 'stretching' },
    paused: { zh: '暂停中', en: 'paused' },
    canvasFailure: { zh: '这个浏览器无法启动动画画布。', en: 'This browser could not start the animated canvas.' },
    noscript: { zh: '请启用 JavaScript，让小猫动起来。', en: 'Enable JavaScript to wake the cat.' },
  };

  let language = 'zh';
  const listeners = new Set();

  function readStoredLanguage() {
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored === 'zh' || stored === 'en') return stored;
    } catch (_) {}
    return 'zh';
  }

  function t(key) {
    const entry = LABELS[key];
    return entry ? entry[language] : key;
  }

  function apply() {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = t('pageTitle');

    const description = document.querySelector('meta[name="description"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    const twitterDescription = document.querySelector('meta[name="twitter:description"]');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (description) description.content = t('metaDescription');
    if (ogDescription) ogDescription.content = t('metaDescription');
    if (twitterDescription) twitterDescription.content = t('metaDescription');
    if (ogTitle) ogTitle.content = t('pageTitle');
    if (twitterTitle) twitterTitle.content = t('pageTitle');

    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.getAttribute('data-i18n');
      if (LABELS[key]) element.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
      const key = element.getAttribute('data-i18n-aria-label');
      if (LABELS[key]) element.setAttribute('aria-label', t(key));
    });
    document.querySelectorAll('[data-i18n-title]').forEach((element) => {
      const key = element.getAttribute('data-i18n-title');
      if (LABELS[key]) element.setAttribute('title', t(key));
    });

    const languageButton = document.getElementById('language-toggle');
    if (languageButton) {
      languageButton.textContent = language === 'zh' ? 'EN' : '中';
      languageButton.setAttribute('aria-label', t('langAria'));
      languageButton.setAttribute('title', language === 'zh' ? 'English' : '中文');
    }
    listeners.forEach((listener) => listener(language));
  }

  function setLanguage(next) {
    language = next === 'en' ? 'en' : 'zh';
    try { localStorage.setItem(LANG_KEY, language); } catch (_) {}
    apply();
  }

  function toggleLanguage() {
    setLanguage(language === 'zh' ? 'en' : 'zh');
  }

  function onChange(listener) {
    listeners.add(listener);
    return function unsubscribe() { listeners.delete(listener); };
  }

  language = readStoredLanguage();
  window.CatMouseI18n = Object.freeze({
    LABELS,
    t,
    apply,
    setLanguage,
    toggleLanguage,
    onChange,
    getLanguage: () => language,
  });

  document.addEventListener('DOMContentLoaded', () => {
    const languageButton = document.getElementById('language-toggle');
    if (languageButton) languageButton.addEventListener('click', toggleLanguage);
    apply();
  });
})();
