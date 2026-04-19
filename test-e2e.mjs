// End-to-end test: starts a static http server, launches chromium, runs
// scoring unit tests in a real browser, then plays through a full match
// via the window.__koiKoi bridge.
//
// Usage: node test-e2e.mjs [--headed]

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const PORT = 8713;
const HEADED = process.argv.includes('--headed');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.md':   'text/markdown; charset=utf-8',
};

function serve() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const abs = path.join(__dirname, p);
    if (!abs.startsWith(__dirname)) { res.writeHead(403); res.end(); return; }
    fs.readFile(abs, (err, buf) => {
      if (err) { res.writeHead(404); res.end(`not found: ${p}`); return; }
      const ext = path.extname(abs).toLowerCase();
      res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
      res.end(buf);
    });
  });
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`ASSERT FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`  ok — ${msg}`);
  }
}

async function runScoringTests(browser) {
  console.log('\n[1/3] scoring unit tests in browser');
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/src/scoring.test.html`);
  await page.waitForFunction(() => !!window.__testResult, { timeout: 5000 });
  const { pass, fail } = await page.evaluate(() => window.__testResult);
  console.log(`  ${pass} passed, ${fail} failed`);
  assert(consoleErrors.length === 0, `no page errors (got ${consoleErrors.length}: ${consoleErrors.join('; ')})`);
  assert(fail === 0, 'all scoring tests passed');
  await page.close();
}

async function runGameSmoke(browser) {
  console.log('\n[2/3] game smoke test with fixed seed');
  const page = await browser.newPage();
  const consoleErrors = [];
  const consoleLogs = [];
  page.on('pageerror', e => consoleErrors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); consoleLogs.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/?seed=42&fast=1`);

  // Wait for game to load.
  await page.waitForFunction(() => window.__koiKoi && window.__koiKoi.state, { timeout: 5000 });

  const initial = await page.evaluate(() => {
    const s = window.__koiKoi.state;
    return {
      phase: s.phase,
      turn: s.turn,
      myHand: s.players[0].hand.length,
      oppHand: s.players[1].hand.length,
      field: s.field.length,
      deck: s.deck.length,
      hand: s.hand,
    };
  });
  console.log(`  initial: ${JSON.stringify(initial)}`);
  assert(initial.myHand === 8, 'player has 8 cards in hand');
  assert(initial.oppHand === 8, 'opponent has 8 cards');
  assert(initial.field === 8, 'field has 8 cards');
  assert(initial.deck === 24, 'deck has 24 remaining (48 - 8 - 8 - 8)');
  await page.close();
}

async function runFullMatch(browser) {
  console.log('\n[3/3] play a full 3-hand match');
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/?seed=7&fast=1`);
  await page.waitForFunction(() => window.__koiKoi && window.__koiKoi.state, { timeout: 5000 });

  // A simple human strategy in the page: for each hand card, try to play
  // the one with the most captures available. Helper injected in browser.
  const result = await page.evaluate(async () => {
    const k = window.__koiKoi;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const SAFETY = 500;

    function pickBestHandMove() {
      const s = k.state;
      const me = s.players[0].hand;
      // Prefer cards that match a field card (= capture immediately).
      let best = null, bestMatch = 0;
      for (const c of me) {
        const matches = s.field.filter(f => f.month === c.month).length;
        if (matches > bestMatch || (best === null && matches >= 0)) {
          best = c; bestMatch = matches;
        }
      }
      return best?.id;
    }

    function pickFieldTarget() {
      const s = k.state;
      const src = s.phase === 'choose-match' ? s.pendingMatch : s.pendingDraw;
      return src?.candidates[0]?.id;
    }

    let steps = 0;
    const phases = [];
    while (k.state.phase !== 'match-over' && steps < SAFETY) {
      steps++;
      phases.push(k.state.phase + '/' + k.state.turn);
      const s = k.state;
      if (s.phase === 'hand-over') { k.next(); await sleep(10); continue; }
      if (s.turn === 1) { await sleep(50); continue; }
      if (s.phase === 'play-hand') {
        const id = pickBestHandMove();
        if (id == null) { await sleep(10); continue; }
        k.play(id);
      } else if (s.phase === 'choose-match' || s.phase === 'choose-match-deck') {
        const id = pickFieldTarget();
        if (id != null) k.pick(id);
      } else if (s.phase === 'ask-koi-koi') {
        k.decide('agari');  // always stop for deterministic test
      }
      await sleep(20);
    }

    return {
      steps,
      finalPhase: k.state.phase,
      scores: k.state.scores,
      hand: k.state.hand,
      uniquePhases: Array.from(new Set(phases)),
    };
  });

  console.log(`  steps: ${result.steps}`);
  console.log(`  final phase: ${result.finalPhase}`);
  console.log(`  scores: You=${result.scores[0]}, CPU=${result.scores[1]}`);
  console.log(`  hand reached: ${result.hand}`);
  console.log(`  unique phases: ${result.uniquePhases.join(' ')}`);

  assert(result.finalPhase === 'match-over', 'match completed');
  assert(result.steps < 500, 'match converged');
  assert(consoleErrors.length === 0, `no console errors (got ${consoleErrors.length}: ${consoleErrors.join('; ')})`);
  await page.close();
}

async function main() {
  const server = serve().listen(PORT);
  console.log(`Static server on http://localhost:${PORT}`);
  try {
    const browser = await chromium.launch({ headless: !HEADED });
    try {
      await runScoringTests(browser);
      await runGameSmoke(browser);
      await runFullMatch(browser);
    } finally {
      await browser.close();
    }
    console.log('\nAll e2e checks passed.');
  } finally {
    server.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
