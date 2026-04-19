// Take screenshots of both themes at desktop + mobile sizes for review.
// Also captures the Help dialog and a hovered-card tooltip state.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 8714;

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

const viewports = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet',  width: 820,  height: 1100 },
  { name: 'phone',   width: 390,  height: 844 },
];

for (const vp of viewports) {
  for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.addInitScript(t => localStorage.setItem('koikoi-theme', t), theme);
    await page.goto(`http://localhost:${PORT}/?seed=11&fast=1`);
    await page.waitForFunction(() => window.__koiKoi && window.__koiKoi.state);
    await page.waitForTimeout(500);
    const out = path.join(ROOT, `screenshot-${vp.name}-${theme}.png`);
    await page.screenshot({ path: out, fullPage: true });
    console.log(`wrote ${out}`);
    await page.close();
  }
}

// Help dialog, desktop, dark
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(t => localStorage.setItem('koikoi-theme', t), 'dark');
  await page.goto(`http://localhost:${PORT}/?seed=11&fast=1`);
  await page.waitForFunction(() => window.__koiKoi && window.__koiKoi.state);
  await page.click('#help-btn');
  await page.waitForSelector('#help-dialog[open]');
  await page.waitForTimeout(200);
  const out = path.join(ROOT, 'screenshot-help-dark.png');
  await page.screenshot({ path: out, fullPage: false });
  console.log(`wrote ${out}`);
  await page.close();
}

// Tooltip, desktop, dark
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(t => localStorage.setItem('koikoi-theme', t), 'dark');
  await page.goto(`http://localhost:${PORT}/?seed=11&fast=1`);
  await page.waitForFunction(() => window.__koiKoi && window.__koiKoi.state);
  const card = await page.$('#me-hand [data-card-id]');
  await card.hover();
  await page.waitForSelector('#tooltip:not([hidden])');
  await page.waitForTimeout(200);
  const out = path.join(ROOT, 'screenshot-tooltip-dark.png');
  await page.screenshot({ path: out });
  console.log(`wrote ${out}`);
  await page.close();
}

await browser.close();
server.close();
