// ---------------------------------------------------------------------------
// Intro slides: plain-language walkthrough of the rules BEFORE any gameplay
// advice. The tutorial starts here; the player clicks "Next" through the
// slides and only after the last one does card-highlighting guided play
// begin. This prevents the tutorial from dropping jargon like "Ino-Shika-Chō"
// on a player who has never seen the game before.
// ---------------------------------------------------------------------------

// Each slide may spotlight a UI region by name; the UI applies a glow to
// the matching element during that slide so the player knows what the
// words are talking about. Valid spotlight targets:
//   'my-hand', 'opp-hand', 'field', 'deck-area', 'captures', 'yaku-panel'
export const INTRO_SLIDES = [
  {
    title: 'Welcome to Hanafuda Koi-Koi',
    body:  'Hanafuda (花札, "flower cards") is a traditional Japanese card game with 48 illustrated cards — one plant per month, four cards per month. Koi-Koi is the most popular way to play them. This walkthrough will teach you the whole game in about 5 minutes.',
    spotlight: null,
  },
  {
    title: 'This is your hand',
    body:  'At the bottom are YOUR 8 cards (highlighted). Only you can see them. You\'ll play one per turn by clicking it. The AI opponent has their own 8 cards at the top, face-down — you\'ll see them flip over when played.',
    spotlight: 'my-hand',
  },
  {
    title: 'This is the field',
    body:  'The 8 face-up cards in the middle are the shared field. Both players can see these. When you play a card from your hand, if any field card has the same plant (same month), you CAPTURE both — they go into your pile. Otherwise your card joins the field.',
    spotlight: 'field',
  },
  {
    title: 'The deck',
    body:  'After you play a hand card, the top of the deck is flipped automatically. Same matching rule applies to the flipped card: match a field card → capture both, no match → join the field. The deck has 24 cards at the start (48 minus 8+8+8 dealt).',
    spotlight: 'deck-area',
  },
  {
    title: 'Four card types',
    body:  'Every card has one of 4 types. The type tells you how it scores. As you capture, your pile groups itself by type:\n\n• Brights — 5 in the deck, highest value\n• Animals — 9 cards\n• Ribbons — 10 cards\n• Chaff — 24 cards, low but plentiful\n\nHover any card to see its type and scoring role.',
    spotlight: 'captures',
  },
  {
    title: 'Yaku — the scoring combos',
    body:  'You don\'t score from single captures. You score when your captures form a YAKU — a special combination (like a poker hand). Examples:\n\n• 3 Brights = 5 points\n• Boar + Deer + Butterflies = 5 points\n• 5 or more Animals = 1 point + 1 each extra\n• 5 or more Ribbons = same scaling\n• 10 or more Chaff = same scaling\n\nYour current yaku progress is shown in this panel.',
    spotlight: 'yaku-panel',
  },
  {
    title: 'Agari or Koi-Koi',
    body:  'Whenever you form a yaku, a dialog will pop up asking you to choose:\n\n• AGARI — stop the hand, lock in your points.\n• KOI-KOI — keep going. If you form another yaku, your score doubles. But if the opponent scores instead, THEIR score doubles.\n\n"Koi-Koi" means "come on, come on!" — gambling for more.',
    spotlight: null,
  },
  {
    title: 'Your hand is set up for teaching',
    body:  'You\'ve been dealt a friendly hand: it includes all three of the animals needed for the "Boar + Deer + Butterflies" yaku (5 points), plus the Moon and Sake Cup for a bonus combo. Every one has a matching card waiting on the field.\n\nFrom here on, I\'ll highlight the best card to play and explain why. Ready?',
    spotlight: 'my-hand',
    lastLabel: 'Start playing',
  },
];

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

// Intro-aware advice: while introStep < INTRO_SLIDES.length, return the
// corresponding slide. Once the intro is done, fall through to reactive
// gameplay advice.
export function tutorialAdvice(state, introStep = INTRO_SLIDES.length) {
  if (introStep < INTRO_SLIDES.length) {
    const slide = INTRO_SLIDES[introStep];
    return {
      intro: {
        step: introStep,
        total: INTRO_SLIDES.length,
        title: slide.title,
        body:  slide.body,
        nextLabel: slide.lastLabel || 'Next',
        spotlight: slide.spotlight,
      },
    };
  }
  return tutorialPlayAdvice(state);
}

function tutorialPlayAdvice(state) {
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
