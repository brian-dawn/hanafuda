// Game state machine for Koi-Koi.
//
// All functions return a *new* state object (shallow-cloned where useful) —
// callers rebind the state. This keeps reasoning simple; performance is not
// a concern for a card game.
//
// Phases:
//   'play-hand'        — current player picks a hand card
//   'choose-match'     — 2 field cards match the hand card; player picks one
//   'choose-match-deck'— same but for the drawn deck card
//   'ask-koi-koi'      — a new yaku formed; player decides to stop or continue
//   'hand-over'        — hand ended (scored or deck exhausted); caller advances
//   'match-over'       — all hands played
//
// The state also carries `pendingMatch` when in a choose-match phase, and
// `pendingDraw` when a drawn card is waiting to resolve.

import { shuffledDeck } from './cards.js';
import { scoreHand, scoreInitialHand, newYakuSince } from './scoring.js';

export const HAND_SIZE = 8;
export const FIELD_SIZE = 8;
export const MAX_HANDS = 3;

// ----- creation --------------------------------------------------------

export function createGame({ rng = Math.random, maxHands = MAX_HANDS, startingPlayer = 0, deckOverride = null } = {}) {
  const s = dealHand({
    deck: [],
    field: [],
    players: [emptyPlayer(), emptyPlayer()],
    turn: startingPlayer,
    phase: 'play-hand',
    pendingMatch: null,
    pendingDraw: null,
    koiKoi: [false, false],
    yakuSnapshot: [[], []],
    lastScore: null,
    scores: [0, 0],
    hand: 1,
    maxHands,
    log: [],
    rng,
    deckOverride,
  });
  return s;
}

function emptyPlayer() {
  return { hand: [], captures: [] };
}

function dealHand(state) {
  // If caller supplied a fixed deck order (tutorial mode), use it verbatim
  // and skip the shuffle-until-no-4-of-a-month loop.
  let deck, players, field;
  if (state.deckOverride && state.hand === 1) {
    const d = state.deckOverride.slice();
    players = [{ hand: d.splice(0, HAND_SIZE), captures: [] },
               { hand: d.splice(0, HAND_SIZE), captures: [] }];
    field = d.splice(0, FIELD_SIZE);
    deck = d;
  } else {
    deck = shuffledDeck(state.rng);
    for (let tries = 0; tries < 10; tries++) {
      const d = deck.slice();
      players = [{ hand: d.splice(0, HAND_SIZE), captures: [] },
                 { hand: d.splice(0, HAND_SIZE), captures: [] }];
      field = d.splice(0, FIELD_SIZE);
      if (!hasFourOfMonth(field)) { deck = d; break; }
      deck = shuffledDeck(state.rng);
    }
  }

  const log = state.log.slice();
  log.push(`— Hand ${state.hand} dealt —`);

  // Check hand yaku (Teshi / Kuttsuki) immediately. If either player has one,
  // that hand ends with just their yaku scored.
  const h0 = scoreInitialHand(players[0].hand);
  const h1 = scoreInitialHand(players[1].hand);
  if (h0 || h1) {
    const winner = h0 ? 0 : 1;
    const yaku = h0 || h1;
    const scores = state.scores.slice();
    scores[winner] += yaku.points;
    log.push(`Hand yaku: Player ${winner + 1} has ${yaku.name} (+${yaku.points}).`);
    return {
      ...state,
      deck, field, players,
      scores,
      lastScore: { player: winner, yaku: [yaku], base: yaku.points, total: yaku.points, handYaku: true },
      phase: 'hand-over',
      log,
    };
  }

  return {
    ...state,
    deck, field, players,
    phase: 'play-hand',
    pendingMatch: null,
    pendingDraw: null,
    koiKoi: [false, false],
    yakuSnapshot: [[], []],
    lastScore: null,
    log,
  };
}

function hasFourOfMonth(cards) {
  const m = {};
  for (const c of cards) {
    m[c.month] = (m[c.month] || 0) + 1;
    if (m[c.month] >= 4) return true;
  }
  return false;
}

// ----- turn actions ----------------------------------------------------

// Player plays a card from their hand. If it matches exactly one field card,
// we capture automatically. If 2, phase becomes 'choose-match'. If 3, capture
// all four. If 0, card goes to field.
export function playCard(state, cardId) {
  if (state.phase !== 'play-hand') throw new Error(`playCard called in phase ${state.phase}`);
  const p = state.turn;
  const player = state.players[p];
  const idx = player.hand.findIndex(c => c.id === cardId);
  if (idx < 0) throw new Error(`card ${cardId} not in player ${p}'s hand`);
  const card = player.hand[idx];

  const matches = state.field.filter(f => f.month === card.month);
  const newHand = player.hand.filter(c => c.id !== cardId);
  let log = state.log.slice();
  log.push(`Player ${p + 1} plays ${card.name}.`);

  if (matches.length === 0) {
    const state2 = withPlayer(state, p, { hand: newHand });
    state2.field = state.field.concat(card);
    state2.log = log;
    log.push(`  (no match — added to field)`);
    return proceedToDraw(state2);
  }
  if (matches.length === 1) {
    const captured = [card, matches[0]];
    const state2 = withPlayer(state, p, {
      hand: newHand,
      captures: player.captures.concat(captured),
    });
    state2.field = state.field.filter(f => f.id !== matches[0].id);
    state2.log = log;
    log.push(`  captures ${matches[0].name}.`);
    return proceedToDraw(state2);
  }
  if (matches.length >= 3) {
    // Capture all: the played card plus all 3+ matches.
    const captured = [card, ...matches];
    const matchIds = new Set(matches.map(m => m.id));
    const state2 = withPlayer(state, p, {
      hand: newHand,
      captures: player.captures.concat(captured),
    });
    state2.field = state.field.filter(f => !matchIds.has(f.id));
    state2.log = log;
    log.push(`  sweeps all ${matches.length} month-${card.month} cards.`);
    return proceedToDraw(state2);
  }
  // Exactly 2 matches: player must pick.
  const state2 = {
    ...state,
    players: state.players.map((pl, i) => i === p ? { ...pl, hand: newHand } : pl),
    phase: 'choose-match',
    pendingMatch: { card, candidates: matches, from: 'hand' },
    log,
  };
  log.push(`  must choose between ${matches.map(m => m.name).join(' / ')}.`);
  return state2;
}

// Resolve a choose-match phase. `pickedFieldId` is the chosen field card.
export function chooseMatch(state, pickedFieldId) {
  if (state.phase !== 'choose-match' && state.phase !== 'choose-match-deck') {
    throw new Error(`chooseMatch called in phase ${state.phase}`);
  }
  const src = state.phase === 'choose-match' ? state.pendingMatch : state.pendingDraw;
  const picked = src.candidates.find(c => c.id === pickedFieldId);
  if (!picked) throw new Error(`card ${pickedFieldId} not in candidates`);

  const p = state.turn;
  const player = state.players[p];
  const captured = [src.card, picked];
  const nextField = state.field.filter(f => f.id !== picked.id);
  const log = state.log.slice();
  log.push(`  captures ${picked.name}.`);

  const mid = {
    ...state,
    field: nextField,
    players: state.players.map((pl, i) => i === p
      ? { ...pl, captures: pl.captures.concat(captured) }
      : pl),
    phase: 'play-hand',  // placeholder, overridden below
    pendingMatch: null,
    pendingDraw: null,
    log,
  };

  if (state.phase === 'choose-match') {
    // Still need to draw from deck.
    return proceedToDraw(mid);
  } else {
    // Draw already happened; check yaku and advance.
    return resolveAfterCapture(mid);
  }
}

function proceedToDraw(state) {
  if (state.deck.length === 0) {
    return finishTurn(state);
  }
  const drawn = state.deck[0];
  const deck = state.deck.slice(1);
  const log = state.log.slice();
  log.push(`Player ${state.turn + 1} draws ${drawn.name}.`);

  const matches = state.field.filter(f => f.month === drawn.month);
  const p = state.turn;
  const player = state.players[p];

  if (matches.length === 0) {
    const s2 = { ...state, deck, field: state.field.concat(drawn), log };
    log.push(`  (no match — added to field)`);
    return resolveAfterCapture(s2);
  }
  if (matches.length === 1) {
    const captured = [drawn, matches[0]];
    const s2 = {
      ...state,
      deck,
      field: state.field.filter(f => f.id !== matches[0].id),
      players: state.players.map((pl, i) => i === p
        ? { ...pl, captures: pl.captures.concat(captured) }
        : pl),
      log,
    };
    log.push(`  captures ${matches[0].name}.`);
    return resolveAfterCapture(s2);
  }
  if (matches.length >= 3) {
    const captured = [drawn, ...matches];
    const matchIds = new Set(matches.map(m => m.id));
    const s2 = {
      ...state,
      deck,
      field: state.field.filter(f => !matchIds.has(f.id)),
      players: state.players.map((pl, i) => i === p
        ? { ...pl, captures: pl.captures.concat(captured) }
        : pl),
      log,
    };
    log.push(`  sweeps all ${matches.length} month-${drawn.month} cards.`);
    return resolveAfterCapture(s2);
  }
  // 2 matches from deck draw — need to pick.
  log.push(`  must choose between ${matches.map(m => m.name).join(' / ')}.`);
  return {
    ...state,
    deck,
    phase: 'choose-match-deck',
    pendingDraw: { card: drawn, candidates: matches, from: 'deck' },
    log,
  };
}

// After any capture sequence completes, check for new yaku. If found, enter
// ask-koi-koi phase. Otherwise advance turn.
function resolveAfterCapture(state) {
  const p = state.turn;
  const caps = state.players[p].captures;
  const current = scoreHand(caps);
  const prior = state.yakuSnapshot[p];
  // New yaku: any in current.yaku not in prior.yaku (by name + points)
  const priorNames = new Set(prior.map(y => `${y.name}:${y.points}`));
  const newOnes = current.yaku.filter(y => !priorNames.has(`${y.name}:${y.points}`));

  if (newOnes.length > 0) {
    const log = state.log.slice();
    log.push(`Player ${p + 1} forms: ${newOnes.map(y => `${y.name} (${y.points})`).join(', ')} — koi-koi?`);
    return {
      ...state,
      phase: 'ask-koi-koi',
      pendingYaku: { player: p, newYaku: newOnes, currentScore: current },
      yakuSnapshot: state.yakuSnapshot.map((s, i) => i === p ? current.yaku : s),
      log,
    };
  }
  return finishTurn(state);
}

// Player responds to koi-koi prompt with either 'agari' (stop) or 'koi-koi' (continue).
export function decideKoiKoi(state, choice) {
  if (state.phase !== 'ask-koi-koi') throw new Error(`decideKoiKoi called in phase ${state.phase}`);
  const p = state.turn;
  const log = state.log.slice();

  if (choice === 'agari') {
    const score = scoreHand(state.players[p].captures);
    // Koi-koi doubling: if either player had koi-koi active this hand, double.
    const koiActive = state.koiKoi[0] || state.koiKoi[1];
    const total = score.total * (koiActive ? 2 : 1);
    const scores = state.scores.slice();
    scores[p] += total;
    log.push(`Player ${p + 1} calls Agari for ${total} points${koiActive ? ' (koi-koi x2)' : ''}.`);
    return {
      ...state,
      scores,
      phase: 'hand-over',
      lastScore: { player: p, yaku: score.yaku, base: score.base, total, koiDoubled: koiActive },
      log,
    };
  }
  if (choice === 'koi-koi') {
    const koiKoi = state.koiKoi.slice();
    koiKoi[p] = true;
    log.push(`Player ${p + 1} calls KOI-KOI!`);
    return {
      ...finishTurn({ ...state, koiKoi, log }),
      koiKoi,
    };
  }
  throw new Error(`unknown koi-koi choice: ${choice}`);
}

function finishTurn(state) {
  // Has the hand ended because both players ran out of hand cards?
  const done = state.players.every(pl => pl.hand.length === 0);
  if (done) {
    const log = state.log.slice();
    log.push(`Hand ends — no yaku, no points.`);
    return {
      ...state,
      phase: 'hand-over',
      lastScore: null,
      log,
    };
  }
  return {
    ...state,
    turn: 1 - state.turn,
    phase: 'play-hand',
    pendingMatch: null,
    pendingDraw: null,
    pendingYaku: null,
  };
}

// Advance to next hand, or finish match.
export function nextHand(state) {
  if (state.phase !== 'hand-over') throw new Error(`nextHand called in phase ${state.phase}`);
  if (state.hand >= state.maxHands) {
    return { ...state, phase: 'match-over' };
  }
  // Winner of this hand deals next (for a proper implementation) — we'll
  // just alternate starting player.
  return dealHand({
    ...state,
    hand: state.hand + 1,
    turn: state.lastScore ? state.lastScore.player : 1 - state.turn,
  });
}

// ----- utilities -------------------------------------------------------

function withPlayer(state, i, patch) {
  return {
    ...state,
    players: state.players.map((pl, j) => j === i ? { ...pl, ...patch } : pl),
  };
}

// For AI / UI: return all legal hand cards this turn. (Just the current player's hand.)
export function legalCards(state) {
  if (state.phase !== 'play-hand') return [];
  return state.players[state.turn].hand.slice();
}
