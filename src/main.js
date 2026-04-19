// Entry point: owns the game state, wires UI events to game transitions,
// and drives the AI turn automatically.

import { createGame, playCard, chooseMatch, decideKoiKoi, nextHand } from './game.js';
import { chooseMove, chooseMatchTarget, chooseKoiKoi } from './ai.js';
import { createUI } from './ui.js';

const AI_DELAY_MS = 550;

// Deterministic RNG for repeatable tests — toggled on by ?seed=N in URL.
function rngFromUrl() {
  const params = new URLSearchParams(location.search);
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
  stepAi();
  ui.render(state);
  if (state.turn === 1 && state.phase !== 'hand-over' && state.phase !== 'match-over') {
    setTimeout(stepAiAndRender, AI_DELAY_MS);
  }
}

function stepAi() {
  switch (state.phase) {
    case 'play-hand': {
      const move = chooseMove(state);
      if (!move || move.cardId == null) {
        // No legal move; shouldn't happen unless hand is empty.
        return;
      }
      state = playCard(state, move.cardId);
      // If that transitioned into choose-match, immediately pick target
      if (state.phase === 'choose-match' && move.matchId != null) {
        state = chooseMatch(state, move.matchId);
      } else if (state.phase === 'choose-match') {
        const pick = chooseMatchTarget(state);
        if (pick != null) state = chooseMatch(state, pick);
      }
      // If drawn card led to choose-match-deck, pick target too
      if (state.phase === 'choose-match-deck') {
        const pick = chooseMatchTarget(state);
        if (pick != null) state = chooseMatch(state, pick);
      }
      break;
    }
    case 'choose-match':
    case 'choose-match-deck': {
      const pick = chooseMatchTarget(state);
      if (pick != null) state = chooseMatch(state, pick);
      break;
    }
    case 'ask-koi-koi': {
      const choice = chooseKoiKoi(state);
      state = decideKoiKoi(state, choice);
      break;
    }
    default:
      return;
  }
}

ui.render(state);
maybeAITurn();
