// Verify the whole board fits the viewport without scrolling on common sizes.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 8716;
const MIME = {'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.md':'text/markdown'};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const abs = path.join(ROOT, p);
  fs.readFile(abs, (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT);

const browser = await chromium.launch({ headless: true });
const sizes = [
  { name: 'laptop-1280x720',  w: 1280, h: 720  },
  { name: 'laptop-1440x900',  w: 1440, h: 900  },
  { name: 'desktop-1920x1080',w: 1920, h: 1080 },
  { name: '2k-2560x1440',     w: 2560, h: 1440 },
];

for (const s of sizes) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
  await page.goto(`http://localhost:${PORT}/?fast=1&seed=9`);
  await page.waitForFunction(() => window.__koiKoi && window.__koiKoi.state);
  await page.waitForTimeout(300);
  const data = await page.evaluate(() => {
    const cardEl = document.querySelector('#me-hand .card');
    const cardH = cardEl ? cardEl.getBoundingClientRect().height : 0;
    const measure = sel => {
      const el = document.querySelector(sel);
      return el ? Math.round(el.getBoundingClientRect().height) : 0;
    };
    return {
      scrollH: document.documentElement.scrollHeight,
      clientH: document.documentElement.clientHeight,
      overflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      cardH,
      header: measure('header'),
      oppLane: measure('.lane-opponent'),
      centerLane: measure('.lane-center'),
      youLane: measure('.lane-you'),
      footer: measure('footer'),
      field: measure('.field'),
      sidePanel: measure('.side-panel'),
    };
  });
  console.log(`${s.name.padEnd(22)} viewport=${s.h} overflow=${data.overflow}px cardH=${data.cardH.toFixed(0)}  [header=${data.header} opp=${data.oppLane} center=${data.centerLane} you=${data.youLane} foot=${data.footer}]  field=${data.field} side=${data.sidePanel}`);
  const out = path.join(ROOT, `scroll-${s.name}.png`);
  await page.screenshot({ path: out, fullPage: false });
  await page.close();
}

await browser.close();
server.close();
