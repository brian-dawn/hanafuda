// Entry point: owns the game state, wires UI events to game transitions,
// and drives the AI turn automatically.

import { createGame, playCard, chooseMatch, decideKoiKoi, nextHand } from './game.js';
import { chooseMove, chooseMatchTarget, chooseKoiKoi } from './ai.js';
import { createUI } from './ui.js';

// URL ?fast=1 collapses animations for automated tests.
const params = new URLSearchParams(location.search);
const FAST = params.get('fast') === '1';
const AI_DELAY_MS = FAST ? 20 : 700;
const AI_SUBSTEP_MS = FAST ? 10 : 500;

// Deterministic RNG for repeatable tests — toggled on by ?seed=N in URL.
function rngFromUrl() {
  const seed = params.get('seed');
  if (!seed) return Math.random;
  let s = Number(seed) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

let state = createGame({ rng: rngFromUrl() });
const ui = createUI({
  onPlayHand,
  onPickField,
  onKoiKoi,
  onNextHand,
  onNewMatch,
});

// Expose state to tests (playwright) via window.
window.__koiKoi = {
  get state() { return state; },
  play: (cardId) => onPlayHand(cardId),
  pick: (cardId) => onPickField(cardId),
  decide: (choice) => onKoiKoi(choice),
  next: () => onNextHand(),
  skipAi: () => { while (state.turn === 1 && state.phase !== 'hand-over' && state.phase !== 'match-over') stepAi(); ui.render(state); },
};

function set(newState) {
  state = newState;
  ui.render(state);
  maybeAITurn();
}

function onPlayHand(cardId) {
  if (state.turn !== 0 || state.phase !== 'play-hand') return;
  set(playCard(state, cardId));
}

function onPickField(cardId) {
  if (state.turn !== 0) return;
  if (state.phase !== 'choose-match' && state.phase !== 'choose-match-deck') return;
  set(chooseMatch(state, cardId));
}

function onKoiKoi(choice) {
  if (state.turn !== 0 || state.phase !== 'ask-koi-koi') return;
  set(decideKoiKoi(state, choice));
}

function onNextHand() {
  if (state.phase === 'match-over') {
    onNewMatch();
    return;
  }
  if (state.phase !== 'hand-over') return;
  set(nextHand(state));
}

function onNewMatch() {
  state = createGame({ rng: rngFromUrl() });
  ui.render(state);
  maybeAITurn();
}

function maybeAITurn() {
  if (state.turn !== 1) return;
  if (state.phase === 'hand-over' || state.phase === 'match-over') return;
  setTimeout(stepAiAndRender, AI_DELAY_MS);
}

function stepAiAndRender() {
  if (state.turn !== 1) return;
  const acted = stepAi();  // does exactly one state transition
  ui.render(state);
  if (!acted) return;
  if (state.turn === 1 && state.phase !== 'hand-over' && state.phase !== 'match-over') {
    setTimeout(stepAiAndRender, AI_SUBSTEP_MS);
  }
}

// One primitive action per call — returns true if a transition happened.
// Splitting this way gives the player time to see each step render.
function stepAi() {
  switch (state.phase) {
    case 'play-hand': {
      const move = chooseMove(state);
      if (!move || move.cardId == null) return false;
      state = playCard(state, move.cardId);
      // Remember the preferred match target so next stepAi can use it.
      aiPreferredMatch = move.matchId;
      return true;
    }
    case 'choose-match':
    case 'choose-match-deck': {
      const pick = aiPreferredMatch != null && currentPendingCandidatesInclude(aiPreferredMatch)
        ? aiPreferredMatch
        : chooseMatchTarget(state);
      aiPreferredMatch = null;
      if (pick != null) { state = chooseMatch(state, pick); return true; }
      return false;
    }
    case 'ask-koi-koi': {
      const choice = chooseKoiKoi(state);
      state = decideKoiKoi(state, choice);
      return true;
    }
    default:
      return false;
  }
}

let aiPreferredMatch = null;

function currentPendingCandidatesInclude(id) {
  const p = state.pendingMatch || state.pendingDraw;
  return p && p.candidates.some(c => c.id === id);
}

ui.render(state);
maybeAITurn();
