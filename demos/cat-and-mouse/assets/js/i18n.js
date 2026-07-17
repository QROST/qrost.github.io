/* Cat & Mouse — flat bilingual labels. Default language: 中文. */
(function attachCatMouseI18n() {
  'use strict';

  const LANG_KEY = 'cat-and-mouse-lang';
  const LABELS = {
    pageTitle: { zh: '猫鼠之间 · Cat & Mouse', en: 'Cat & Mouse · 猫鼠之间' },
    metaDescription: {
      zh: '一只俯视角的小猫会观察、潜行、慢步靠近或追逐化作小老鼠的指针，由四肢耦合步态控制器驱动。',
      en: 'A top-down cat watches, stalks, approaches and chases your pointer-as-mouse, driven by a coupled quadruped gait controller.',
    },
    homeAria: { zh: '返回 QROST 首页', en: 'Back to QROST home' },
    pageControlsAria: { zh: '页面控件', en: 'Page controls' },
    displayOptionsAria: { zh: '显示选项', en: 'Display options' },
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
    hintPointer: { zh: '移动小老鼠，看看它会选择盯梢、潜行，还是追逐', en: 'Move the mouse. It may watch, stalk, or give chase.' },
    hintTouch: { zh: '点按或拖动，让小老鼠在地毯上跑', en: 'Tap or drag to send the mouse across the rug.' },
    hintKeyboard: { zh: '方向键控制 · 空格暂停 · Esc 离开', en: 'Arrow keys steer · Space pauses · Esc releases' },
    gaitLabel: { zh: '落足相位', en: 'FOOTFALL PHASE' },
    gaitStill: { zh: '静止', en: 'still' },
    gaitProwl: { zh: '四拍慢步', en: 'four-beat walk' },
    gaitStalk: { zh: '四拍潜行', en: 'four-beat stalk' },
    gaitChase: { zh: '对角小跑', en: 'diagonal trot' },
    rightHind: { zh: '右后', en: 'RH' },
    rightFore: { zh: '右前', en: 'RF' },
    leftHind: { zh: '左后', en: 'LH' },
    leftFore: { zh: '左前', en: 'LF' },
    rightHindLong: { zh: '右后足', en: 'right hind paw' },
    rightForeLong: { zh: '右前足', en: 'right fore paw' },
    leftHindLong: { zh: '左后足', en: 'left hind paw' },
    leftForeLong: { zh: '左前足', en: 'left fore paw' },
    stateProwl: { zh: '巡游', en: 'prowling' },
    stateObserve: { zh: '发现目标', en: 'target spotted' },
    stateWatch: { zh: '盯梢', en: 'watching' },
    stateStalk: { zh: '潜行靠近', en: 'stalking' },
    stateChase: { zh: '追逐', en: 'chasing' },
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
