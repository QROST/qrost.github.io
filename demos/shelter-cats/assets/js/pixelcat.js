/* Procedural pixel-cat generator — the interactive "game" layer (phase 1).
   A deterministic sitting-cat sprite built from a cat's REAL attributes
   (colors / pattern / coat_length / size / id-seed). Pure canvas, no AI, no network.

   Phase-2 AIGC hook: if cat.avatar_sprite is set, app.js can swap in that image
   instead of calling draw(); this module is the fallback + the immediate demo.

   window.SHELTERCATS_PIXELCAT = { draw(canvas, cat), animate(canvas, cat) -> stop() } */
(function () {
  'use strict';
  var I18N = window.SHELTERCATS_I18N;
  var GRID = 24;
  var WHITE = '#f3efe7', PINK = '#e8a0a0', NOSE = '#d77a7a';
  var EYE_COLORS = ['#5fa85f', '#d9a441', '#6c8ebf', '#b87333', '#7bb36b'];

  // ---- seeded PRNG ----------------------------------------------------------
  function hashStr(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function vnoise(x, y, seed) {
    var n = Math.sin((x * 12.9898 + y * 78.233 + seed * 0.137)) * 43758.5453;
    return n - Math.floor(n);
  }

  // ---- color helpers --------------------------------------------------------
  function hex2rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function rgb2hex(r) { return '#' + r.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return ('0' + v.toString(16)).slice(-2); }).join(''); }
  function shade(hex, pct) {
    var c = hex2rgb(hex);
    if (pct < 0) { var k = 1 + pct / 100; return rgb2hex([c[0] * k, c[1] * k, c[2] * k]); }
    var k2 = pct / 100; return rgb2hex([c[0] + (255 - c[0]) * k2, c[1] + (255 - c[1]) * k2, c[2] + (255 - c[2]) * k2]);
  }

  // ---- geometry (normalized 0..1) ------------------------------------------
  function inEllipse(nx, ny, cx, cy, rx, ry) { var dx = (nx - cx) / rx, dy = (ny - cy) / ry; return dx * dx + dy * dy <= 1; }
  function inTri(px, py, ax, ay, bx, by, cx, cy) {
    var d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
    var d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
    var d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
    var neg = (d1 < 0) || (d2 < 0) || (d3 < 0), pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(neg && pos);
  }

  // ---- build a cat model (grid of hex|null) --------------------------------
  function buildModel(cat) {
    var rnd = mulberry32(hashStr(cat.id || cat.name || 'cat'));
    var seed = hashStr((cat.id || '') + (cat.pattern || ''));
    var colors = (cat.colors && cat.colors.length) ? cat.colors : ['gray'];
    var base = I18N.enumHex(colors[0]);
    var second = colors[1] ? I18N.enumHex(colors[1]) : shade(base, -30);
    var pattern = cat.pattern || 'solid';
    var coat = cat.coat_length || 'short';
    var hairless = coat === 'hairless';
    if (hairless) { base = '#e7c9bf'; second = '#d8b3a8'; }
    var dark = shade(base, -42);
    var eyeColor = EYE_COLORS[Math.floor(rnd() * EYE_COLORS.length)];

    // slight size scaling
    var grow = cat.size === 'large' ? 1.06 : (cat.size === 'small' ? 0.94 : 1.0);
    function sc(v, c) { return c + (v - c) * grow; }

    var earL = { ax: 0.30, ay: 0.04, bx: 0.24, by: 0.22, cx: 0.44, cy: 0.18 };
    var earR = { ax: 0.70, ay: 0.04, bx: 0.76, by: 0.22, cx: 0.56, cy: 0.18 };
    var fluff = (coat === 'long') ? 0.02 : 0.0;

    function region(nx, ny) {
      // returns one of: 'head','ear','earin','body','tail','eye','nose',null
      // eyes / nose first (within head)
      if (inEllipse(nx, ny, 0.42, 0.30, 0.05, 0.055) || inEllipse(nx, ny, 0.58, 0.30, 0.05, 0.055)) return 'eye';
      if (inEllipse(nx, ny, 0.50, 0.40, 0.025, 0.02)) return 'nose';
      if (inTri(nx, ny, earL.ax + 0.02, earL.ay + 0.06, earL.bx + 0.03, earL.by - 0.02, earL.cx - 0.02, earL.cy - 0.01)) return 'earin';
      if (inTri(nx, ny, earR.ax - 0.02, earR.ay + 0.06, earR.bx - 0.03, earR.by - 0.02, earR.cx + 0.02, earR.cy - 0.01)) return 'earin';
      if (inTri(nx, ny, earL.ax, earL.ay, earL.bx, earL.by, earL.cx, earL.cy)) return 'ear';
      if (inTri(nx, ny, earR.ax, earR.ay, earR.bx, earR.by, earR.cx, earR.cy)) return 'ear';
      if (inEllipse(nx, ny, 0.50, sc(0.30, 0.5), 0.21 + fluff, 0.20 + fluff)) return 'head';
      if (inEllipse(nx, ny, 0.50, 0.73, 0.29 * grow + fluff, 0.27 * grow + fluff)) return 'body';
      // tail: curved ellipse on the right
      if (inEllipse(nx, ny, 0.83, 0.62, 0.075 + fluff, 0.17) || inEllipse(nx, ny, 0.74, 0.50, 0.06, 0.08)) return 'tail';
      return null;
    }

    // white-prone zones (chest/belly/muzzle/paws)
    function inWhiteZone(nx, ny) {
      return inEllipse(nx, ny, 0.50, 0.82, 0.13, 0.14) ||      // chest/belly
        inEllipse(nx, ny, 0.50, 0.42, 0.09, 0.05) ||           // muzzle
        (ny > 0.90 && nx > 0.30 && nx < 0.70);                 // paws
    }
    function isPoint(nx, ny, reg) {  // colorpoint zones
      return reg === 'ear' || (ny > 0.92) || inEllipse(nx, ny, 0.50, 0.40, 0.12, 0.10) ||
        reg === 'tail';
    }

    function coatColor(nx, ny, reg) {
      var x = Math.floor(nx * GRID), y = Math.floor(ny * GRID);
      if (hairless) return shade(base, (ny - 0.5) * -12);
      switch (pattern) {
        case 'tabby': {
          var wob = Math.round(Math.sin(y * 0.7) * 1.3);
          var stripe = ((x + wob) % 3 === 0) || (reg === 'head' && Math.abs(nx - 0.5) < 0.03 && ny < 0.28);
          return stripe ? dark : base;
        }
        case 'tuxedo':
          return inWhiteZone(nx, ny) ? WHITE : base;
        case 'bicolor': {
          if (inWhiteZone(nx, ny)) return WHITE;
          return (vnoise(x, y, seed) > 0.62 && nx > 0.5) ? WHITE : base;
        }
        case 'calico': {
          if (inWhiteZone(nx, ny)) return WHITE;
          var v = vnoise(x, y, seed);
          if (v < 0.34) return I18N.enumHex('orange');
          if (v < 0.64) return '#2b2b30';
          return WHITE;
        }
        case 'tortie': {
          var v2 = vnoise(x, y, seed);
          return v2 < 0.5 ? I18N.enumHex('orange') : '#2b2b30';
        }
        case 'pointed':
          return isPoint(nx, ny, reg) ? shade(base, -38) : '#e8d3a8';
        case 'smoke': {
          var t = Math.max(0, Math.min(1, (ny - 0.2) * 1.1));
          var c = hex2rgb(base), w = hex2rgb(WHITE);
          return rgb2hex([w[0] + (c[0] - w[0]) * t, w[1] + (c[1] - w[1]) * t, w[2] + (c[2] - w[2]) * t]);
        }
        default: // solid
          return inWhiteZone(nx, ny) && colors.indexOf('white') !== -1 ? WHITE : base;
      }
    }

    var grid = [];      // grid[y][x] = hex | null
    var eyeCells = [], tailCells = [];
    for (var y = 0; y < GRID; y++) {
      grid[y] = [];
      for (var x = 0; x < GRID; x++) {
        var nx = (x + 0.5) / GRID, ny = (y + 0.5) / GRID;
        var reg = region(nx, ny);
        if (!reg) { grid[y][x] = null; continue; }
        if (reg === 'eye') { grid[y][x] = eyeColor; eyeCells.push([x, y]); continue; }
        if (reg === 'nose') { grid[y][x] = NOSE; continue; }
        if (reg === 'earin') { grid[y][x] = PINK; continue; }
        var col = coatColor(nx, ny, reg);
        grid[y][x] = col;
        if (reg === 'tail') tailCells.push([x, y]);
      }
    }
    return { grid: grid, eyeCells: eyeCells, tailCells: tailCells, eyeColor: eyeColor,
             coat: base, dark: dark, G: GRID };
  }

  // ---- paint ----------------------------------------------------------------
  function paint(canvas, model, opts) {
    opts = opts || {};
    var G = model.G;
    var ctx = canvas.getContext('2d');
    var size = canvas.width;
    var cell = size / G;
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;

    var tailShift = opts.tailShift || 0;
    var blink = opts.blink || 0;   // 0..1 eyelid closed amount
    var tailSet = {};
    if (tailShift) { model.tailCells.forEach(function (c) { tailSet[c[0] + ',' + c[1]] = true; }); }

    for (var y = 0; y < G; y++) {
      for (var x = 0; x < G; x++) {
        var col = model.grid[y][x];
        if (!col) continue;
        var dx = x;
        if (tailShift && tailSet[x + ',' + y]) dx = x; // tail handled below
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(dx * cell), Math.round(y * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }
    // tail flick: redraw tail cells shifted by tailShift columns over coat/blank
    if (tailShift) {
      model.tailCells.forEach(function (c) {
        var x = c[0], y = c[1];
        // clear original
        ctx.clearRect(Math.round(x * cell), Math.round(y * cell), Math.ceil(cell), Math.ceil(cell));
      });
      model.tailCells.forEach(function (c) {
        var x = c[0] + tailShift, y = c[1] - Math.abs(tailShift);
        ctx.fillStyle = model.grid[c[1]][c[0]] || model.coat;
        ctx.fillRect(Math.round(x * cell), Math.round(y * cell), Math.ceil(cell), Math.ceil(cell));
      });
    }
    // blink: cover eye cells with coat-ish lid
    if (blink > 0.5) {
      ctx.fillStyle = model.dark;
      model.eyeCells.forEach(function (c) {
        ctx.fillRect(Math.round(c[0] * cell), Math.round((c[1] + 0.3) * cell), Math.ceil(cell), Math.ceil(cell * 0.5));
      });
    }
  }

  function ensureSize(canvas) {
    // keep crisp: internal resolution multiple of GRID
    var css = Math.max(48, canvas.clientWidth || canvas.width || 96);
    var px = Math.min(240, Math.round(css));
    px = Math.round(px / GRID) * GRID;
    if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
  }

  function draw(canvas, cat) {
    ensureSize(canvas);
    paint(canvas, buildModel(cat), {});
  }

  function animate(canvas, cat) {
    ensureSize(canvas);
    var model = buildModel(cat);
    var raf = null, start = null, stopped = false;
    var nextBlink = 1500 + Math.random() * 2500;
    function frame(ts) {
      if (stopped) return;
      if (start == null) start = ts;
      var t = ts - start;
      var blink = 0;
      if (t > nextBlink) {
        var into = t - nextBlink;
        blink = into < 140 ? 1 : 0;
        if (into > 220) { nextBlink = t + 1800 + Math.random() * 2600; }
      }
      var tailShift = Math.round(Math.sin(t / 520) * 1.5);
      paint(canvas, model, { blink: blink, tailShift: tailShift });
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return function stop() { stopped = true; if (raf) cancelAnimationFrame(raf); };
  }

  window.SHELTERCATS_PIXELCAT = { draw: draw, animate: animate, buildModel: buildModel };
})();
