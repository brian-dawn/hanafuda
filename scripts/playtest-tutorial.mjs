// Step through the tutorial, capturing a screenshot after each Next click
// to see the layout shift the user is complaining about.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 8715;

const MIME = {
  '.html':'text/html','.js':'application/javascript','.mjs':'application/javascript',
  '.css':'text/css','.svg':'image/svg+xml','.md':'text/markdown',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const abs = path.join(ROOT, p);
  if (!abs.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(abs, (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript(() => localStorage.setItem('koikoi-theme', 'dark'));
await page.goto(`http://localhost:${PORT}/?fast=1`);
await page.waitForFunction(() => window.__koiKoi && window.__koiKoi.state);

await page.click('#tutorial-btn');
await page.waitForSelector('#tutorial-bar:not([hidden])');

const snapshots = [];
const record = async (label) => {
  const out = path.join(ROOT, `playtest-${label}.png`);
  await page.screenshot({ path: out, fullPage: false });
  const metrics = await page.evaluate(() => {
    const bar = document.querySelector('#tutorial-bar');
    const rect = bar.getBoundingClientRect();
    const opp = document.querySelector('.lane-opponent').getBoundingClientRect();
    return {
      barHeight: rect.height,
      barTop: rect.top,
      barBottom: rect.bottom,
      oppTop: opp.top,   // opponent lane top position — changes if page shifts
      title: document.querySelector('#tutorial-title').textContent,
    };
  });
  snapshots.push({ label, ...metrics });
  console.log(`[${label}]`, metrics);
};

await record('slide-1');
for (let i = 2; i <= 7; i++) {
  await page.click('#tutorial-next');
  await page.waitForTimeout(150);
  await record(`slide-${i}`);
}

// Report on how much content moved
const firstOppTop = snapshots[0].oppTop;
const maxShift = Math.max(...snapshots.map(s => Math.abs(s.oppTop - firstOppTop)));
console.log(`\nOpponent lane max vertical shift across slides: ${maxShift.toFixed(1)}px`);
console.log(`Bar height range: ${Math.min(...snapshots.map(s => s.barHeight)).toFixed(1)}px ... ${Math.max(...snapshots.map(s => s.barHeight)).toFixed(1)}px`);

await page.close();
await browser.close();
server.close();
