/* Coarse-pointer map/graph gate.
 * Default: one-finger vertical page scroll (touch-action: pan-y, roam/drag off).
 * Explicit toggle unlocks pan/pinch. Window (or modal) scroll auto-relocks.
 * Viewport watch covers fold/unfold, posture, and visualViewport (not just width). */
(function (global) {
  'use strict';

  function coarsePointer() {
    try {
      if (global.matchMedia) {
        if (global.matchMedia('(any-pointer: coarse)').matches) return true;
        if (global.matchMedia('(pointer: coarse)').matches) return true;
      }
    } catch (e) {}
    return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  }

  var viewportFns = [];
  var viewportHooked = false;
  var viewportTimer = 0;

  function flushViewport() {
    viewportTimer = 0;
    for (var i = 0; i < viewportFns.length; i++) {
      try { viewportFns[i](); } catch (err) {}
    }
  }

  function scheduleViewport() {
    if (viewportTimer) global.clearTimeout(viewportTimer);
    viewportTimer = global.setTimeout(flushViewport, 100);
  }

  function hookViewport() {
    if (viewportHooked) return;
    viewportHooked = true;
    global.addEventListener('resize', scheduleViewport);
    global.addEventListener('orientationchange', scheduleViewport);
    var vv = global.visualViewport;
    if (vv) {
      vv.addEventListener('resize', scheduleViewport);
      vv.addEventListener('scroll', scheduleViewport);
    }
    try {
      if (global.matchMedia) {
        ['(any-pointer: coarse)', '(pointer: coarse)'].forEach(function (query) {
          var mq = global.matchMedia(query);
          if (mq.addEventListener) mq.addEventListener('change', scheduleViewport);
          else if (mq.addListener) mq.addListener(scheduleViewport);
        });
      }
    } catch (e) {}
    var posture = global.navigator && global.navigator.devicePosture;
    if (posture && posture.addEventListener) posture.addEventListener('change', scheduleViewport);
    var orientation = global.screen && global.screen.orientation;
    if (orientation && orientation.addEventListener) orientation.addEventListener('change', scheduleViewport);
  }

  function watchViewport(fn) {
    if (typeof fn !== 'function') return function () {};
    hookViewport();
    viewportFns.push(fn);
    return function () {
      var idx = viewportFns.indexOf(fn);
      if (idx >= 0) viewportFns.splice(idx, 1);
    };
  }

  function resizeChart(surface) {
    if (!surface || !global.echarts || !global.echarts.getInstanceByDom) return;
    var inst = global.echarts.getInstanceByDom(surface);
    if (inst && typeof inst.resize === 'function') inst.resize();
  }

  function applySurfaceTouch(surface, interactive) {
    if (!surface) return;
    var action = interactive ? 'none' : 'pan-y';
    surface.style.touchAction = action;
    var nodes = surface.querySelectorAll('canvas, .leaflet-container');
    for (var i = 0; i < nodes.length; i++) nodes[i].style.touchAction = action;
    if (surface.classList) {
      surface.classList.toggle('is-touch-unlocked', interactive);
      surface.classList.toggle('is-touch-locked', !interactive);
    }
  }

  function attach(surface, options) {
    options = options || {};
    if (!surface) {
      return {
        coarse: false,
        isInteractive: function () { return true; },
        syncSurface: function () {},
        refresh: function () {},
        setActive: function () {},
      };
    }
    if (surface._qrostGate) {
      surface._qrostGate.refresh();
      return surface._qrostGate;
    }

    var coarse = coarsePointer();
    var active = false;
    var button = options.button || null;
    var relockOnScroll = options.relockOnScroll !== false;
    var scrollParent = options.scrollParent || null;

    if (!button) {
      var mount = options.mount || surface.parentNode;
      var existing = mount && mount.querySelector
        ? mount.querySelector('.qrost-touch-toggle[data-touch-for="' + (surface.id || '') + '"]')
        : null;
      if (existing) {
        button = existing;
      } else {
        button = document.createElement('button');
        button.type = 'button';
        button.className = options.buttonClass || 'qrost-touch-toggle';
        if (surface.id) button.setAttribute('data-touch-for', surface.id);
        if (mount) {
          if (surface.parentNode === mount && surface.nextSibling) {
            mount.insertBefore(button, surface.nextSibling);
          } else {
            mount.appendChild(button);
          }
        }
      }
    }

    function labels() {
      if (typeof options.labels === 'function') return options.labels();
      return options.labels || { enable: 'Move map', disable: 'Lock map' };
    }

    function interactive() {
      return !coarse || active;
    }

    function paint() {
      var on = interactive();
      applySurfaceTouch(surface, on);
      if (button) {
        var L = labels();
        button.hidden = !coarse;
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
        button.textContent = active ? (L.disable || '') : (L.enable || '');
        var aria = active ? (L.disableAria || L.disable) : (L.enableAria || L.enable);
        if (aria) button.setAttribute('aria-label', aria);
      }
      if (typeof options.onChange === 'function') {
        options.onChange(on, { coarse: coarse, unlocked: active });
      }
    }

    function setActive(next) {
      active = !!next && coarse;
      paint();
    }

    if (button && !button._qrostTouchBound) {
      button._qrostTouchBound = true;
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        setActive(!active);
      });
    }

    function maybeRelock(event) {
      if (!active) return;
      if (event && event.target && surface.contains(event.target)) return;
      setActive(false);
    }

    if (relockOnScroll) {
      global.addEventListener('scroll', maybeRelock, { passive: true });
      if (scrollParent && scrollParent !== global && scrollParent.addEventListener) {
        scrollParent.addEventListener('scroll', maybeRelock, { passive: true });
      }
    }

    var gate = {
      coarse: coarse,
      isInteractive: interactive,
      syncSurface: function () { applySurfaceTouch(surface, interactive()); },
      refresh: paint,
      setActive: setActive,
    };
    surface._qrostGate = gate;
    watchViewport(function () {
      var next = coarsePointer();
      if (next !== coarse) {
        coarse = next;
        gate.coarse = next;
        active = false;
        paint();
      } else {
        applySurfaceTouch(surface, interactive());
      }
      resizeChart(surface);
      if (typeof options.onViewport === 'function') options.onViewport();
    });
    paint();
    return gate;
  }

  global.QrostTouchGate = {
    coarsePointer: coarsePointer,
    attach: attach,
    applySurfaceTouch: applySurfaceTouch,
    watchViewport: watchViewport,
  };
})(typeof window !== 'undefined' ? window : this);
