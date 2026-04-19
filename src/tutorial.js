// Beginner tutorial. When active, a tip bar at the top narrates the game
// and explains each phase as it happens. Advances automatically based on
// state — no scripted "click Next" — so the player learns by doing.
//
// The module is a pure state observer: UI calls nextTip(state) each
// render and gets back either `null` (no tip) or a tip object.

import { TYPES } from './cards.js';

const SEEN = new Set();

export function resetTutorial() {
  SEEN.clear();
}

// Mark a tip as seen so it doesn't flash again on every re-render.
function fire(id) { SEEN.add(id); }
function seen(id) { return SEEN.has(id); }

// Sticky tips: these reflect the current decision the player is making
// and should show every time, even if fired before.
const STICKY = new Set(['koi-koi', 'hand-over', 'match-over', 'pick-match']);

export function nextTip(state) {
  return computeTip(state);
}

function computeTip(state) {
  // --- Sticky phase-based tips (always show while in that phase) ---
  if (state.phase === 'ask-koi-koi' && state.turn === 0) {
    const total = sumYaku(state.players[0].captures);
    const opp = sumYaku(state.players[1].captures);
    const advice = koiAdvice(state, total, opp);
    return {
      id: 'koi-koi',
      title: 'Decision: Agari or Koi-Koi?',
      text:  `Agari locks in your ${total} points now. Koi-Koi keeps you playing — any future yaku will double, but if the CPU scores first, THEIR points double too.`,
      strategy: advice,
    };
  }
  if (state.phase === 'choose-match' && state.turn === 0) {
    return {
      id: 'pick-match',
      title: 'Two cards match',
      text:  'Your played card matches two field cards of the same month. Click one to capture it. Prefer the higher-value one (Hikari > Tane > Tan > Kasu).',
    };
  }
  if (state.phase === 'choose-match-deck' && state.turn === 0) {
    return {
      id: 'pick-match',
      title: 'Drawn card has two matches',
      text:  'The card you drew from the deck matches two field cards. Pick the more valuable one to capture.',
    };
  }
  if (state.phase === 'hand-over') {
    const ls = state.lastScore;
    const msg = ls
      ? `${ls.player === 0 ? 'You' : 'CPU'} scored ${ls.total} points this hand.`
      : 'No yaku formed — nobody scored this hand.';
    return {
      id: 'hand-over',
      title: `Hand ${state.hand} complete`,
      text: `${msg} Close the dialog to continue.`,
    };
  }
  if (state.phase === 'match-over') {
    const [a, b] = state.scores;
    const verdict = a > b ? 'You won!' : a < b ? 'CPU won.' : 'Tie.';
    return {
      id: 'match-over',
      title: 'Match complete',
      text: `Final: ${a} – ${b}. ${verdict} Tap "New Match" to play again, or end the tutorial from the header.`,
    };
  }

  // --- First-time tips (fired once) ---
  if (state.turn === 0 && state.phase === 'play-hand' && !seen('welcome')) {
    fire('welcome');
    return {
      id: 'welcome',
      title: 'Welcome',
      text:  'Your hand is at the bottom, the field is in the middle. Tap one of your cards to play it. Match the month (plant) on the card to capture a field card.',
      strategy: 'Hover any card (or long-press on mobile) to see what yaku it belongs to.',
    };
  }

  // Player's captures hint progress tips
  const myCaps = state.players[0].captures;
  const taneCount = myCaps.filter(c => c.type === TYPES.TANE).length;
  const tanCount  = myCaps.filter(c => c.type === TYPES.TANZAKU).length;
  const hikariCount = myCaps.filter(c => c.type === TYPES.HIKARI).length;
  const hasMoon = myCaps.some(c => c.moon);
  const hasCherry = myCaps.some(c => c.cherry);
  const hasSake = myCaps.some(c => c.sake);
  const iscCount = myCaps.filter(c => c.isc).length;

  if (taneCount >= 4 && !seen('close-tane')) {
    fire('close-tane');
    return {
      id: 'close-tane',
      title: 'Close to a Tane yaku',
      text:  `You have ${taneCount} Tane cards. 5 = 1 point, each extra +1. Keep collecting animals!`,
    };
  }
  if (tanCount >= 4 && !seen('close-tan')) {
    fire('close-tan');
    return {
      id: 'close-tan',
      title: 'Close to a Tan yaku',
      text:  `You have ${tanCount} Tan (ribbon) cards. 5 = 1 point; grab one more!`,
    };
  }
  if (hikariCount >= 2 && !seen('hikari-progress')) {
    fire('hikari-progress');
    return {
      id: 'hikari-progress',
      title: 'Building toward Brights',
      text:  `You have ${hikariCount} Hikari. 3 = Sankō (5 pts), 4 = Shikō (8), all 5 = Gokō (10). Huge upside — protect these.`,
    };
  }
  if (iscCount >= 2 && !seen('isc-progress')) {
    fire('isc-progress');
    return {
      id: 'isc-progress',
      title: 'Ino-Shika-Chō on the table',
      text:  `You have ${iscCount} of the 3 special animals (Boar, Deer, Butterflies). Complete the set for 5 points!`,
    };
  }
  if (hasMoon && hasSake && !seen('tsukimi-hint')) {
    fire('tsukimi-hint');
    return {
      id: 'tsukimi-hint',
      title: 'Tsukimi-zake forming',
      text:  'Moon + Sake Cup = Tsukimi-zake (5 pts). You should see this yaku in your Yaku panel now.',
    };
  }
  if (hasCherry && hasSake && !seen('hanami-hint')) {
    fire('hanami-hint');
    return {
      id: 'hanami-hint',
      title: 'Hanami-zake forming',
      text:  'Cherry Curtain + Sake Cup = Hanami-zake (5 pts).',
    };
  }

  // Phase transitions
  if (state.turn === 1 && !seen('ai-first')) {
    fire('ai-first');
    return {
      id: 'ai-first',
      title: 'CPU turn',
      text:  'The opponent plays automatically, one step at a time. Watch the log on the right to see what they captured.',
    };
  }

  // Starting a hand after the first
  if (state.hand >= 2 && state.phase === 'play-hand' && state.turn === 0 && !seen(`hand-${state.hand}`)) {
    fire(`hand-${state.hand}`);
    return {
      id: `hand-${state.hand}`,
      title: `Hand ${state.hand} of ${state.maxHands}`,
      text:  'New deal. Captures reset but the running match score carries over.',
    };
  }

  return null;  // no tip this render
}

function sumYaku(caps) {
  // local lightweight sum; import-free so tutorial stays decoupled.
  // UI passes the real scoring if needed — we just approximate here.
  return caps.length > 0 ? caps.length : 0;
}

function koiAdvice(state, myTotal, oppActivity) {
  const myHand = state.players[0].hand.length;
  // Beginner heuristic suggestion.
  if (state.koiKoi[1]) return 'CPU already called Koi-Koi — ANY yaku you score doubles. Go for Agari unless you see an easy bigger score.';
  if (myHand <= 2) return `Only ${myHand} cards left — low chance of extending. Agari is safer.`;
  if (myTotal >= 14) return 'You already have a doubled score. Taking it is the safe play.';
  return 'As a beginner: Agari when you already have 3+ points, Koi-Koi if you see a clear path to a bigger yaku (e.g. 1 card away from Sankō or ISC).';
}
