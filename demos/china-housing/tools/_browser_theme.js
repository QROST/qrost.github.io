'use strict';
/** Playwright regression: shell surfaces follow html.dark, not OS prefers-color-scheme. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8765;

function serve(req, res) {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p.replace(/^\//, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(file);
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

async function probe(colorScheme) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ colorScheme });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(800);

  async function sample(label) {
    return page.evaluate((label) => {
      const nav = document.querySelector('nav');
      const header = document.querySelector('header');
      const card = document.querySelector('#overview .rounded-xl');
      const kpi = document.querySelector('#kpi-grid > div');
      const tableWrap = document.querySelector('#table .rounded-xl.overflow-hidden');
      const cs = (el) => el ? getComputedStyle(el) : null;
      const navS = cs(nav), hdrS = cs(header), cardS = cs(card), kpiS = cs(kpi), tblS = cs(tableWrap);
      const lum = (rgb) => {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || '');
        if (!m) return null;
        const [r, g, b] = m.slice(1).map(Number);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      return {
        label,
        htmlDark: document.documentElement.classList.contains('dark'),
        stored: localStorage.getItem('housing-theme'),
        prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
        navBg: navS?.backgroundColor,
        navBgLum: lum(navS?.backgroundColor),
        headerBg: hdrS?.backgroundColor,
        headerBgLum: lum(hdrS?.backgroundColor),
        cardBg: cardS?.backgroundColor,
        cardBgLum: lum(cardS?.backgroundColor),
        kpiBg: kpiS?.backgroundColor,
        kpiBgLum: lum(kpiS?.backgroundColor),
        tableWrapBg: tblS?.backgroundColor,
        tableWrapBgLum: lum(tblS?.backgroundColor),
        navClasses: nav?.className,
      };
    }, label);
  }

  const initial = await sample('initial');
  await page.click('#theme-toggle');
  await page.waitForTimeout(600);
  const afterToggle = await sample('after-toggle');
  await browser.close();
  return { colorScheme, initial, afterToggle };
}

(async () => {
  const server = http.createServer(serve);
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  try {
    const results = [];
    for (const scheme of ['dark', 'light']) results.push(await probe(scheme));
    console.log(results.map((r) => JSON.stringify(r, null, 2)).join('\n---\n'));
    const darkCase = results.find((r) => r.colorScheme === 'dark');
    const lightNavAfter = darkCase.afterToggle.navBgLum;
    const darkNavAfter = results.find((r) => r.colorScheme === 'light').afterToggle.navBgLum;
    const ok = lightNavAfter > 200 && darkNavAfter < 100;
    console.log(ok ? '\nBROWSER_THEME_OK' : '\nBROWSER_THEME_FAIL');
    if (!ok) process.exit(1);
  } finally {
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
