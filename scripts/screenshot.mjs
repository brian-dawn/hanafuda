// Take screenshots of both themes for visual verification.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 5174;

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
for (const theme of ['dark', 'light']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(t => localStorage.setItem('koikoi-theme', t), theme);
  await page.goto(`http://localhost:${PORT}/?seed=11`);
  await page.waitForFunction(() => window.__koiKoi && window.__koiKoi.state);
  await page.waitForTimeout(400);  // let card images render
  const out = path.join(ROOT, `screenshot-${theme}.png`);
  await page.screenshot({ path: out, fullPage: true });
  console.log(`wrote ${out}`);
  await page.close();
}
await browser.close();
server.close();
