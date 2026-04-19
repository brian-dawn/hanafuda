// Yaku detection for Koi-Koi.
//
// scoreHand(captures) returns { yaku: [{name, points}], base, doubled, total }
//   - base: sum of points from each detected yaku
//   - doubled: true if base >= 7 (in which case total = base * 2)
//   - total: final score for that player's capture pile this hand
//
// scoreInitialHand(hand) checks Teshi (4-of-a-month) and Kuttsuki (4 pairs)
// which are scored immediately at deal time, independent of captures.
//
// The Sake yaku (Tsukimi-zake, Hanami-zake) are only counted when the Sake
// cup captures alongside the relevant Hikari. If the Sake cup is captured
// alone it still contributes to Tane count, but no seasonal yaku fires.

import { TYPES } from './cards.js';

// --- helpers -----------------------------------------------------------

const count = (cards, pred) => cards.reduce((n, c) => n + (pred(c) ? 1 : 0), 0);

const hasId = (cards, id) => cards.some(c => c.id === id);

const countHikari = cards => count(cards, c => c.type === TYPES.HIKARI);
const countHikariNonRain = cards => count(cards, c => c.type === TYPES.HIKARI && !c.rainman);
const hasRainman = cards => cards.some(c => c.rainman);

// Ino-Shika-Chō members: boar (24), deer (36), butterflies (20)
const ISC_IDS = [20, 24, 36];
// Poetry ribbons (Akatan): Jan/Feb/Mar tanzaku = ids 1, 5, 9
const POETRY_IDS = [1, 5, 9];
// Blue ribbons (Aotan): Jun/Sep/Oct tanzaku = ids 21, 33, 37
const BLUE_IDS = [21, 33, 37];

// --- yaku definitions (capture-based) ----------------------------------

// Returns null or { name, points }. Order matters: the Hikari yaku are
// mutually exclusive — we pick the highest single one.
function scoreHikari(cards) {
  const h = countHikari(cards);
  const nonRain = countHikariNonRain(cards);
  const rain = hasRainman(cards);
  if (h === 5) return { name: 'Gokō', points: 10 };
  if (h === 4 && nonRain === 4) return { name: 'Shikō', points: 8 };
  if (h === 4 && rain) return { name: 'Ame-Shikō', points: 7 };
  if (h === 3 && nonRain === 3) return { name: 'Sankō', points: 5 };
  return null;
}

function scoreInoShikaCho(cards) {
  const hits = ISC_IDS.every(id => hasId(cards, id));
  return hits ? { name: 'Ino-Shika-Chō', points: 5 } : null;
}

function scoreTane(cards) {
  const n = count(cards, c => c.type === TYPES.TANE);
  if (n < 5) return null;
  return { name: 'Tane', points: 1 + (n - 5) };
}

function scoreAkatan(cards) {
  return POETRY_IDS.every(id => hasId(cards, id))
    ? { name: 'Akatan', points: 5 } : null;
}

function scoreAotan(cards) {
  return BLUE_IDS.every(id => hasId(cards, id))
    ? { name: 'Aotan', points: 5 } : null;
}

function scoreTan(cards) {
  const n = count(cards, c => c.type === TYPES.TANZAKU);
  if (n < 5) return null;
  return { name: 'Tan', points: 1 + (n - 5) };
}

function scoreKasu(cards) {
  const n = count(cards, c => c.type === TYPES.KASU);
  if (n < 10) return null;
  return { name: 'Kasu', points: 1 + (n - 10) };
}

function scoreTsukimi(cards) {
  // Moon (id 28) + Sake Cup (id 32)
  return (hasId(cards, 28) && hasId(cards, 32))
    ? { name: 'Tsukimi-zake', points: 5 } : null;
}

function scoreHanami(cards) {
  // Cherry Curtain (id 8) + Sake Cup (id 32)
  return (hasId(cards, 8) && hasId(cards, 32))
    ? { name: 'Hanami-zake', points: 5 } : null;
}

// --- public API --------------------------------------------------------

export function scoreHand(captures) {
  const yaku = [];
  const h = scoreHikari(captures);
  if (h) yaku.push(h);

  for (const fn of [scoreInoShikaCho, scoreTane, scoreAkatan, scoreAotan, scoreTan, scoreKasu, scoreTsukimi, scoreHanami]) {
    const y = fn(captures);
    if (y) yaku.push(y);
  }

  const base = yaku.reduce((s, y) => s + y.points, 0);
  const doubled = base >= 7;
  const total = doubled ? base * 2 : base;
  return { yaku, base, doubled, total };
}

// Hand yaku — scored once at deal time.
export function scoreInitialHand(hand) {
  if (hand.length !== 8) return null;

  // Teshi: 4 cards of the same month
  const monthCounts = {};
  for (const c of hand) monthCounts[c.month] = (monthCounts[c.month] || 0) + 1;
  if (Object.values(monthCounts).some(n => n === 4)) {
    return { name: 'Teshi', points: 6 };
  }
  // Kuttsuki: 4 pairs (every month in hand appears exactly twice)
  const counts = Object.values(monthCounts);
  if (counts.length === 4 && counts.every(n => n === 2)) {
    return { name: 'Kuttsuki', points: 6 };
  }
  return null;
}

// Returns yaku list diff between two capture sets: yaku in `after` that
// weren't present (or had lower points) in `before`. Used by game.js to
// decide whether to prompt for koi-koi.
export function newYakuSince(beforeCaps, afterCaps) {
  const before = scoreHand(beforeCaps).yaku;
  const after = scoreHand(afterCaps).yaku;
  const newOnes = [];
  for (const y of after) {
    const prior = before.find(b => b.name === y.name);
    if (!prior || prior.points < y.points) newOnes.push(y);
  }
  return newOnes;
}
