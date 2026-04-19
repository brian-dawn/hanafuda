// Scripted beginner tutorial.
//
// A pre-constructed deal plus a recommend-next-move function. The deck is
// ordered so the player is dealt all three Ino-Shika-Chō animals (Boar,
// Deer, Butterflies) with matching field cards nearby. The tutorial coaches
// them through playing those three in sequence, forming the yaku, and
// choosing Agari.
//
// The UI calls tutorialAdvice(state) every render. The returned object
// has:
//   tip:        { title, text, strategy }  — for the tip bar
//   recommend:  { handCardId, fieldCardId? } — for card highlighting
// Either may be null when no advice applies.

import { CARD_BY_ID } from './cards.js';
import { TYPES } from './cards.js';
import { scoreHand } from './scoring.js';

// Ordered deck for the scripted hand. Positions:
//   [0..7]   player hand       (has Moon, Sake, Boar, Butterflies, Deer)
//   [8..15]  cpu hand          (weak, no Hikari)
//   [16..23] field             (has matches for Boar/Butterflies/Deer/Moon/Sake)
//   [24..47] deck draw order   (mostly misses, keeps tutorial predictable)
export const TUTORIAL_DECK_IDS = [
  // --- player hand ---
  24,  // Jul Tane — Boar (ISC)
  20,  // Jun Tane — Butterflies (ISC)
  36,  // Oct Tane — Deer (ISC)
  28,  // Aug Hikari — Moon
  32,  // Sep Tane — Sake Cup
  2,   // Jan Kasu — chaff
  14,  // Apr Kasu — chaff
  18,  // May Kasu — chaff

  // --- cpu hand ---
  41,  // Nov Tane — Swallow
  42,  // Nov Tanzaku
  43,  // Nov Kasu — Lightning
  46,  // Dec Kasu 2
  47,  // Dec Kasu 3
  39,  // Oct Kasu 2   (CPU might grab this, but Deer still has Oct Kasu 1 on field)
  29,  // Aug Tane — Geese
  27,  // Jul Kasu 2   (CPU can capture Jul via this? no, Jul Kasu 1 is on field; Jul Kasu 2 in hand, same month)

  // --- field ---
  26,  // Jul Kasu 1 — match for Boar
  22,  // Jun Kasu 1 — match for Butterflies
  38,  // Oct Kasu 1 — match for Deer
  30,  // Aug Kasu 1 — match for Moon
  34,  // Sep Kasu 1 — match for Sake
  9,   // Mar Tanzaku — sits
  45,  // Dec Kasu 1 — will match CPU Dec cards
  11,  // Mar Kasu 2 — sits

  // --- deck draw order (24 cards, mostly non-matching for predictability) ---
  0, 1, 3,                    // Jan cards
  4, 5, 6, 7,                 // Feb
  8, 10,                      // Mar (match 9 or 11 on field)
  12, 13, 15,                 // Apr
  16, 17, 19,                 // May
  21, 23,                     // Jun leftover
  25,                         // Jul leftover
  31, 33, 35, 37,             // Aug/Sep/Oct ribbons + chaff
  40, 44,                     // Rain-Man, Phoenix
];

// Lookup the full card list for the fixed deck.
export function tutorialDeck() {
  return TUTORIAL_DECK_IDS.map(id => CARD_BY_ID[id]);
}

// --- advice ---------------------------------------------------------------

export function tutorialAdvice(state) {
  // Sticky phase tips always win.
  if (state.phase === 'ask-koi-koi' && state.turn === 0) return koiAdvice(state);
  if (state.phase === 'choose-match' && state.turn === 0) return pickMatchAdvice(state, 'hand');
  if (state.phase === 'choose-match-deck' && state.turn === 0) return pickMatchAdvice(state, 'deck');
  if (state.phase === 'hand-over') return handOverAdvice(state);
  if (state.phase === 'match-over') return matchOverAdvice(state);

  // Player's turn, deciding which hand card to play.
  if (state.phase === 'play-hand' && state.turn === 0) {
    return playHandAdvice(state);
  }
  // CPU's turn.
  if (state.turn === 1 && state.phase !== 'hand-over') {
    return {
      tip: {
        title: 'CPU turn',
        text:  'The opponent plays automatically. Watch which cards they capture — their captures threaten their own yaku and can starve yours.',
      },
    };
  }
  return {};
}

function playHandAdvice(state) {
  const me = state.players[0];
  const field = state.field;

  // Priority 1: complete or build Ino-Shika-Chō
  const iscInHand = me.hand.filter(c => c.isc);
  const iscInCaps = me.captures.filter(c => c.isc).length;
  if (iscInHand.length > 0) {
    for (const c of iscInHand) {
      const match = field.find(f => f.month === c.month);
      if (match) {
        const needed = 3 - iscInCaps - 1;
        const why = iscInCaps === 2
          ? `Playing this completes Ino-Shika-Chō (Boar + Deer + Butterflies = 5 pts)!`
          : iscInCaps === 1
          ? `This is your 2nd ISC animal. One more and you score 5 points.`
          : `This is one of the 3 Ino-Shika-Chō animals (Boar, Deer, Butterflies). Collecting all 3 is worth 5 points.`;
        return {
          tip: {
            title: `Play ${c.name.split(' ')[0]}`,
            text:  `${c.name} matches ${match.name} on the field. Click your ${c.name} to capture it.`,
            strategy: why,
          },
          recommend: { handCardId: c.id, fieldCardId: match.id },
        };
      }
    }
  }

  // Priority 2: Tsukimi-zake (Moon + Sake)
  const haveMoonCap = me.captures.some(c => c.moon);
  const haveSakeCap = me.captures.some(c => c.sake);
  const moonInHand = me.hand.find(c => c.moon);
  const sakeInHand = me.hand.find(c => c.sake);
  if (haveMoonCap && sakeInHand) {
    const match = field.find(f => f.month === sakeInHand.month);
    if (match) {
      return {
        tip: {
          title: 'Play the Sake Cup',
          text:  `${sakeInHand.name} matches ${match.name} on the field.`,
          strategy: 'Sake Cup + Moon = Tsukimi-zake (5 pts). You already have the Moon, so grabbing Sake locks in the yaku.',
        },
        recommend: { handCardId: sakeInHand.id, fieldCardId: match.id },
      };
    }
  }
  if (haveSakeCap && moonInHand) {
    const match = field.find(f => f.month === moonInHand.month);
    if (match) {
      return {
        tip: {
          title: 'Play the Moon',
          text:  `${moonInHand.name} captures ${match.name}.`,
          strategy: 'Moon + Sake Cup = Tsukimi-zake (5 pts). You have the Sake already.',
        },
        recommend: { handCardId: moonInHand.id, fieldCardId: match.id },
      };
    }
  }

  // Priority 3: capture any Hikari if possible
  const hikari = me.hand.find(c => c.type === TYPES.HIKARI);
  if (hikari) {
    const match = field.find(f => f.month === hikari.month);
    if (match) {
      return {
        tip: {
          title: 'Grab the Bright',
          text:  `${hikari.name} captures ${match.name}.`,
          strategy: 'Brights (Hikari) are the highest-value cards. 3 = Sankō (5 pts), 4 = Shikō (8), all 5 = Gokō (10).',
        },
        recommend: { handCardId: hikari.id, fieldCardId: match.id },
      };
    }
  }

  // Priority 4: any capture at all
  for (const c of me.hand) {
    const match = field.find(f => f.month === c.month);
    if (match) {
      return {
        tip: {
          title: 'Capture',
          text:  `${c.name} matches ${match.name}.`,
          strategy: 'A capture is always better than burning a card into the field.',
        },
        recommend: { handCardId: c.id, fieldCardId: match.id },
      };
    }
  }

  // Priority 5: no captures — sacrifice a chaff
  const chaff = me.hand.find(c => c.type === TYPES.KASU) || me.hand[0];
  return {
    tip: {
      title: 'Burn a card',
      text:  `No field card matches any of yours. Sacrifice a chaff (Kasu) so you don't lose a valuable card to the field.`,
      strategy: `If you must give up a card, give up the one your opponent is least likely to use.`,
    },
    recommend: chaff ? { handCardId: chaff.id } : null,
  };
}

function koiAdvice(state) {
  const me = state.players[0];
  const total = scoreHand(me.captures).total;
  const oppCalled = state.koiKoi[1];
  const remaining = me.hand.length;
  let strategy;
  if (oppCalled) {
    strategy = 'CPU already called Koi-Koi. Agari — any yaku you declare now doubles automatically, so take the points instead of risking their counter.';
  } else if (remaining <= 2) {
    strategy = `Only ${remaining} cards left in your hand — hard to extend. Take the win with Agari.`;
  } else if (total >= 7) {
    strategy = 'Your score is already 7+ and doubled. The safe play is Agari.';
  } else {
    strategy = 'For this tutorial: choose Agari. Koi-Koi is a gamble — worth it only when you have a clear path to a bigger yaku, like being 1 card from Sankō.';
  }
  return {
    tip: {
      title: 'Agari or Koi-Koi?',
      text:  `You formed a yaku worth ${total} points. Agari takes it now; Koi-Koi keeps playing — but if CPU scores first, their points double.`,
      strategy,
    },
  };
}

function pickMatchAdvice(state, source) {
  return {
    tip: {
      title: 'Pick a field card',
      text:  `Two cards on the field share a month with your ${source === 'deck' ? 'drawn' : 'played'} card. Tap the one you want to capture.`,
      strategy: 'Take the more valuable one: Hikari > Tane > Tan > Kasu. If both are the same type, pick the one that feeds into a yaku you\'re building.',
    },
  };
}

function handOverAdvice(state) {
  const ls = state.lastScore;
  const text = ls && ls.player === 0
    ? `You scored ${ls.total} points this hand. Those add to your match score.`
    : ls && ls.player === 1
    ? `CPU scored ${ls.total} points. Don't worry — you'll get more chances.`
    : 'Nobody scored this hand. Deck exhausted.';
  return {
    tip: { title: `Hand ${state.hand} complete`, text, strategy: 'Close the dialog to continue.' },
  };
}

function matchOverAdvice(state) {
  const [a, b] = state.scores;
  const verdict = a > b ? 'You won!' : a < b ? 'CPU won this match.' : 'Tie.';
  return {
    tip: {
      title: 'Match over',
      text:  `Final: ${a} – ${b}. ${verdict}`,
      strategy: 'You can replay the tutorial by clicking New Match, or click End to exit tutorial mode and play freely.',
    },
  };
}
