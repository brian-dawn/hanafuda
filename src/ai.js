// Heuristic AI opponent for Koi-Koi.
//
// No search tree — just value each possible move and pick the best.
// Good enough to make a game feel non-random while staying beatable.

import { TYPES } from './cards.js';
import { scoreHand } from './scoring.js';
import { playCard, chooseMatch } from './game.js';

// Per-card intrinsic value for the AI's valuation function.
function cardValue(card) {
  let v;
  switch (card.type) {
    case TYPES.HIKARI: v = 20; break;
    case TYPES.TANE:   v = card.isc ? 10 : 5; break;
    case TYPES.TANZAKU:
      v = (card.poetry || card.blue) ? 6 : 4;
      break;
    case TYPES.KASU:   v = 1; break;
    default: v = 0;
  }
  if (card.sake)    v += 8;   // seasonal yaku candidate
  if (card.moon)    v += 4;   // Tsukimi partner
  if (card.cherry)  v += 4;   // Hanami partner
  if (card.rainman) v -= 6;   // rain-man only qualifies for Ame-Shikō
  return v;
}

function pileValue(cards) {
  // Sum of per-card value plus current yaku total weighted heavily.
  const raw = cards.reduce((s, c) => s + cardValue(c), 0);
  const { total } = scoreHand(cards);
  return raw + total * 15;
}

// Choose the best hand card to play. When a hand card has multiple matches
// on the field, also returns the preferred match target.
export function chooseMove(state) {
  const p = state.turn;
  const me = state.players[p];
  let best = { cardId: null, matchId: null, score: -Infinity };

  for (const card of me.hand) {
    const matches = state.field.filter(f => f.month === card.month);
    if (matches.length <= 1 || matches.length >= 3) {
      const sim = simulatePlayCard(state, card.id);
      const s = scorePostMove(sim, p);
      if (s > best.score) best = { cardId: card.id, matchId: null, score: s };
    } else {
      // Multiple choices — evaluate each match target.
      for (const m of matches) {
        const sim1 = playCard(state, card.id);  // enters choose-match phase
        const sim2 = chooseMatch(sim1, m.id);
        const s = scorePostMove(sim2, p);
        if (s > best.score) best = { cardId: card.id, matchId: m.id, score: s };
      }
    }
  }
  return best;
}

// Non-throwing playCard wrapper — returns undefined on error.
function simulatePlayCard(state, cardId) {
  try { return playCard(state, cardId); }
  catch (_) { return null; }
}

function scorePostMove(postState, player) {
  if (!postState) return -Infinity;
  // The draw phase is deterministic in simulation but not in reality —
  // we don't know what will come off the deck. So valuation is based only
  // on the captures and field after the hand-card play step.
  return pileValue(postState.players[player].captures)
       - pileValue(postState.players[1 - player].captures) * 0.7;
}

// Choose which field card to capture when the AI's played/drawn card has
// multiple matches (i.e., in 'choose-match' or 'choose-match-deck' phase).
export function chooseMatchTarget(state) {
  const pending = state.pendingMatch || state.pendingDraw;
  if (!pending) return null;
  let best = { id: null, score: -Infinity };
  for (const c of pending.candidates) {
    const v = cardValue(c);
    if (v > best.score) best = { id: c.id, score: v };
  }
  return best.id;
}

// Choose stop-or-continue at koi-koi prompt.
// Returns 'agari' or 'koi-koi'.
export function chooseKoiKoi(state) {
  const p = state.turn;
  const me = state.players[p];
  const opp = state.players[1 - p];
  const myScore = scoreHand(me.captures).total;

  // If opponent has called koi-koi, scoring immediately already pays 2x —
  // lock it in.
  if (state.koiKoi[1 - p]) return 'agari';

  // Low hand remaining = few chances to extend. Stop.
  if (me.hand.length <= 2) return 'agari';

  // 7+ already guarantees the doubling bonus is active; taking it is safe.
  if (myScore >= 7) return 'agari';

  // Otherwise: continue if opponent's captures look weak (no hikari, few
  // tane / tanzaku). If opponent looks threatening, stop.
  const oppValue = pileValue(opp.captures);
  if (oppValue > 40) return 'agari';

  return 'koi-koi';
}
