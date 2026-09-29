const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const echarts = fs.readFileSync(path.join(root, 'node_modules/echarts/dist/echarts.min.js'));
const chart = fs.readFileSync(path.join(root, 'node_modules/chart.js/dist/chart.umd.js'));
const leaflet = fs.readFileSync(path.join(root, 'demos/pebble-beach-2026/assets/vendor/leaflet/leaflet.js'));
const leafletCSS = fs.readFileSync(path.join(root, 'demos/pebble-beach-2026/assets/vendor/leaflet/leaflet.css'));
const chartSRI = 'sha384-' + crypto.createHash('sha384').update(chart).digest('base64');

// Production uses jsDelivr's extra-minified Chart.js build. Only that fixture's
// SRI is replaced with the hash of the locked, same-version npm UMD build.
// ECharts and Leaflet retain their real production SRI, including Leaflet CSS.
async function offline(page) {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') {
      if (url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
        const response = await route.fetch();
        const body = (await response.text()).replace(
          'sha384-vsrfeLOOY6KuIYKDlmVH5UiBmgIdB1oEf7p01YgWHuqmOHfZr374+odEv96n9tNC', chartSRI);
        return route.fulfill({ response, body });
      }
      return route.continue();
    }
    const headers = { 'access-control-allow-origin': '*' };
    if (url.pathname.includes('echarts@6.1.0/')) return route.fulfill({ contentType: 'application/javascript', body: echarts, headers });
    if (url.pathname.includes('chart.js@4.4.7/')) return route.fulfill({ contentType: 'application/javascript', body: chart, headers });
    if (url.pathname.endsWith('/leaflet.js')) return route.fulfill({ contentType: 'application/javascript', body: leaflet, headers });
    if (url.pathname.endsWith('/leaflet.css')) return route.fulfill({ contentType: 'text/css', body: leafletCSS, headers });
    // Fonts, FX providers, images and optional map tiles are deliberately offline.
    return route.abort('internetdisconnected');
  });
}

module.exports = { offline };
