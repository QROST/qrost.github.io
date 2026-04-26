// Pinned — thin API client.
// Central place to configure the backend base URL + handle offline gracefully.
// The site is fully usable without a backend (localStorage fallback); these helpers
// simply no-op / return the cached local copy when the API is unreachable.

(function () {
  'use strict';

  // Pick the backend base URL in this order:
  //   1. URL query param  ?api=http://host:port   (useful for demos / preview env)
  //   2. localStorage['pinned_api_base']           (set via devtools)
  //   3. window.PINNED_API_BASE (if injected by server-rendered HTML)
  //   4. Sensible default when running on localhost
  //   5. Same-origin '/api' fallback (Cloudflare/Vercel reverse-proxy deploy)
  function resolveBase() {
    try {
      const qs = new URLSearchParams(location.search);
      if (qs.get('api')) return qs.get('api').replace(/\/$/, '');
      const ls = localStorage.getItem('pinned_api_base');
      if (ls) return ls.replace(/\/$/, '');
    } catch (_) {}
    if (typeof window !== 'undefined' && window.PINNED_API_BASE) {
      return String(window.PINNED_API_BASE).replace(/\/$/, '');
    }
    if (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(location.hostname)) {
      return 'http://localhost:4000';
    }
    return '';
  }

  const BASE = resolveBase();

  // Backend availability probe, cached per page load.
  let _healthPromise = null;
  function checkHealth() {
    if (_healthPromise) return _healthPromise;
    if (!BASE) { _healthPromise = Promise.resolve(false); return _healthPromise; }
    _healthPromise = fetch(BASE + '/api/health', { method: 'GET' })
      .then(r => r.ok)
      .catch(() => false);
    return _healthPromise;
  }

  async function request(path, opts = {}) {
    if (!BASE) throw new Error('no_backend_configured');
    const url = BASE + path;
    const res = await fetch(url, Object.assign({
      headers: Object.assign({ 'content-type': 'application/json' }, opts.headers || {}),
    }, opts));
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error('api_error_' + res.status + (text ? ': ' + text.slice(0, 200) : ''));
      err.status = res.status;
      throw err;
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  }

  const API = {
    base: BASE,
    health: checkHealth,

    // ---------- Pins ----------
    listPins(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return request('/api/pins' + (qs ? '?' + qs : ''));
    },

    // ---------- Designs ----------
    async saveDesign(design) {
      // Optimistic: always persist locally first so the UI never blocks on network.
      try { localStorage.setItem('pinned_design', JSON.stringify(design)); } catch (_) {}
      if (!(await checkHealth())) return { id: null, local_only: true };
      const body = JSON.stringify({
        frame_color: design.frameColor || 'black',
        plate_text: design.plateText || '',
        finish: design.finish || 'silver',
        placements: design.placements || {},
      });
      const out = await request('/api/designs', { method: 'POST', body });
      if (out && out.id) {
        try { localStorage.setItem('pinned_design_id', out.id); } catch (_) {}
      }
      return out;
    },

    getDesign(id) {
      return request('/api/designs/' + encodeURIComponent(id));
    },

    // ---------- Orders (stub; handed off to Shopify in production) ----------
    createOrderStub(payload) {
      return request('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
    },

    listOrders() {
      return request('/api/orders');
    },

    // ---------- AI preview stub ----------
    enqueuePreview(payload) {
      return request('/api/ai/preview', { method: 'POST', body: JSON.stringify(payload) });
    },
    getPreviewJob(id) {
      return request('/api/ai/preview/' + encodeURIComponent(id));
    },
  };

  window.PinnedAPI = API;

  // Emit a DOM event once we know whether the backend is alive, so pages can
  // conditionally show "save to cloud" UI without racing.
  checkHealth().then(ok => {
    window.PINNED_API_ALIVE = ok;
    window.dispatchEvent(new CustomEvent('pinned:api-status', { detail: { ok, base: BASE } }));
  });
})();
