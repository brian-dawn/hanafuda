# Hanafuda Koi-Koi — Web Game Design

**Date:** 2026-04-19
**Status:** Approved for planning

## Goal

A playable, single-page Hanafuda Koi-Koi game vs. a simple AI opponent, runnable by double-clicking `index.html`. No build tools, no bundler, no framework. Plain HTML/CSS/JS.

## Constraints

- **Build-less:** no webpack/vite/npm build step. Optional CDN script tags only.
- **Plain JS:** vanilla DOM + modules (`<script type="module">`). No framework.
- **Legal-safe assets:** all card imagery sourced from Wikimedia Commons, downloaded once into `/assets/cards/` via a one-shot shell script. Attribution preserved in an in-game credits panel.
- **Offline-capable** once assets are fetched.

## Scope

### In-scope
- Single-player vs. heuristic AI.
- 3-hand match, running score, winner screen.
- Full standard yaku set:
  - Brights: Gokō (10), Shikō (8), Ame-Shikō (7), Sankō (5)
  - Animals: Ino-Shika-Chō (5), Tane 5+ (1 + 1/extra)
  - Ribbons: Akatan (5), Aotan (5), Tan 5+ (1 + 1/extra)
  - Plain: Kasu 10+ (1 + 1/extra)
  - Seasonal: Tsukimi-zake (5), Hanami-zake (5)
  - Hand-deal: Teshi (4-of-a-month, 6), Kuttsuki (4 pairs, 6)
- 7+ point doubling (any yaku total ≥ 7 at scoring time doubles final score).
- Koi-koi mechanic: on new yaku, player chooses "agari" (stop, score) or "koi-koi" (continue; if opponent scores next, their score doubles).

### Out-of-scope
- Multiplayer / networking.
- Mobile-optimized layout (desktop-first; should still be usable on tablet).
- Sound effects, animations beyond simple CSS transitions.
- Full 12-month match, dealer rotation, oya/ko bonuses.
- Variant rulesets (Hachi-Hachi, etc.).

## Architecture

### File layout
```
show-off-ai-crap/
├── index.html
├── style.css
├── src/
│   ├── main.js             # entry, wires UI to game
│   ├── cards.js            # card data: 48 cards, metadata, asset paths
│   ├── game.js             # game state machine, turn logic
│   ├── scoring.js          # pure scoreHand() — yaku detection + totals
│   ├── ai.js               # opponent heuristic
│   └── ui.js               # DOM rendering, event handlers
├── assets/
│   ├── cards/              # 48 PNGs from Wikimedia (populated by script)
│   └── CREDITS.md          # attribution
├── scripts/
│   └── fetch-assets.sh     # one-shot curl of Wikimedia URLs
└── docs/
    └── superpowers/specs/2026-04-19-hanafuda-koi-koi-design.md
```

### Module boundaries

- **cards.js** — exports `CARDS` (array of 48 objects: `{id, month, type, name, file}`). No logic.
- **scoring.js** — exports `scoreHand(captures) → {yaku: [{name, points}], total, doubled}`. Pure function. Fully unit-testable.
- **game.js** — exports `createGame()`, `playCard(state, cardId, fieldId?)`, `drawFromDeck(state)`, `decideKoiKoi(state, choice)`. State machine; returns new state objects (don't mutate).
- **ai.js** — exports `chooseMove(state)` and `chooseKoiKoi(state)`. Heuristic only; no search tree.
- **ui.js** — renders state to DOM; hooks click handlers that call into game.js.
- **main.js** — owns the top-level state; re-renders on each transition.

## Data model

```js
// Card
{ id: 0..47, month: 1..12, type: 'hikari'|'tane'|'tan'|'kasu', name, file }

// Game state
{
  deck: Card[],
  field: Card[],
  players: [
    { hand: Card[], captures: Card[] },
    { hand: Card[], captures: Card[] }  // index 1 = AI
  ],
  turn: 0|1,
  phase: 'play-hand' | 'play-deck' | 'await-match-choice' | 'await-koi-koi' | 'hand-over' | 'match-over',
  pendingMatch: {card, candidates: Card[]} | null,  // when hand/deck card matches 2+
  lastYaku: {player, yaku, total} | null,
  koiKoiState: { 0: {called: bool, baseline: number}, 1: {...} },
  scores: [number, number],  // running match score
  handNumber: 1|2|3,
  log: string[]
}
```

## Game flow

1. **Deal** — shuffle deck, deal 8 to each player, 8 to field. Check special: if field has 4-of-a-month, reshuffle. Check hand yaku (Teshi/Kuttsuki) — auto-scores that hand.
2. **Player turn** — player clicks a hand card:
   - If exactly one field card matches month → auto-capture both to captures.
   - If 2+ matches → phase `await-match-choice`; player clicks target.
   - If no match → card goes to field.
3. **Deck flip** — top of deck revealed; same match logic applies.
4. **Yaku check** — after captures added, recompute yaku. If new yaku formed since last check → phase `await-koi-koi`. UI shows current yaku + total; player picks "Agari" or "Koi-Koi".
   - Agari: end hand, score = current total × (koiKoi-active-by-opponent ? 2 : 1) × (total ≥ 7 ? 2 : 1).
   - Koi-Koi: mark koiKoiState.called for this player; continue turn to opponent.
5. **Opponent (AI) turn** — mirror logic via `ai.chooseMove` + `ai.chooseKoiKoi`.
6. **Hand end** — either agari or deck exhausted with no yaku (score = 0 this hand, or small penalty per variant; we'll use 0). Accumulate to match score.
7. **Match end** — after hand 3, show winner and final score breakdown.

## Scoring (`scoreHand`)

Pure function over a capture pile. Walks yaku definitions in order; each definition returns either `null` or `{name, points}`. Examples:

```js
const yakuDefs = [
  { name: 'Gokō', check: c => countType(c, 'hikari') === 5 ? 10 : null },
  { name: 'Ame-Shikō', check: c => countType(c, 'hikari') === 4 && has(c, OnoNoMichikaze) ? 7 : null },
  { name: 'Shikō', check: c => countType(c, 'hikari') === 4 && !has(c, OnoNoMichikaze) ? 8 : null },
  { name: 'Sankō', check: c => countType(c, 'hikari') === 3 && !has(c, OnoNoMichikaze) ? 5 : null },
  { name: 'Ino-Shika-Chō', check: c => hasAll(c, [Boar, Deer, Butterflies]) ? 5 : null },
  { name: 'Tane', check: c => { const n = countType(c, 'tane'); return n >= 5 ? 1 + (n-5) : null; } },
  // ... etc
];
```

Returns `{yaku: [...], total, doubled: boolean}`. Seasonal yaku (Tsukimi/Hanami-zake) require specific card pairs (Moon+Sake, Cherry Curtain+Sake).

## AI

Heuristic only (not minimax):

- **Move choice:** for each hand card, simulate playing it; score the resulting captures via `scoreHand` + a proximity bonus for partial yaku (e.g., 3 brights captured = count toward incomplete Sankō at weight 0.7). Pick max-value move. Tie-break: prefer capturing higher-rarity cards.
- **Koi-Koi choice:** call koi-koi if current total < 7 **and** at least one "reachable" yaku exists (needs ≤ 2 more specific cards still in deck+opponent hand). Otherwise agari.

This produces a plausible but beatable opponent. Good enough for a demo.

## Assets

### Fetching
`scripts/fetch-assets.sh` uses `curl` to pull 48 card images from Wikimedia Commons. The script contains a hardcoded URL table (card name → Commons URL). Images are saved as `assets/cards/<id>.png` where id is the card's 0-47 index.

Wikimedia Commons hosts Hanafuda card images as public domain (2D reproductions of pre-1900 art). License: PD-art / PD-Japan. We'll record the attribution URL for each card in `assets/CREDITS.md`.

### Fallback
If any URL 404s, `fetch-assets.sh` reports it and exits non-zero. Card rendering will show a placeholder with card name text if the file is missing, so the game is still playable for development.

## UI layout

Desktop CSS Grid:
```
┌────────────────────────────────────────────────────┐
│  [AI hand - face down cards, 8 slots]              │
│  [AI captures: Hikari | Tane | Tan | Kasu rows]    │
│  ┌─────────── Field (4x2 grid, grows) ───────────┐ │
│  │                                               │ │
│  └───────────────────────────────────────────────┘ │
│  Deck [count]                     Yaku Panel       │
│  [Your captures: Hikari | Tane | Tan | Kasu rows]  │
│  [Your hand - clickable face-up cards]             │
└────────────────────────────────────────────────────┘
```

Yaku panel (right): live list of yaku-in-progress (both players), current score, koi-koi indicator, log of recent actions.

Koi-koi prompt: modal dialog with "Agari (X pts)" / "Koi-Koi!" buttons.

Card visuals: 60x100px at base, scale up on hover for selected hand card.

## Testing

Since it's build-less and plain JS, unit tests for `scoring.js` live in `src/scoring.test.html` — a plain HTML page that imports `scoring.js`, runs assertions against known capture piles, and dumps pass/fail to a `<pre>` tag. Open in browser, see results. No test runner.

Manual QA checklist for game.js / ui.js in a separate doc.

## Risks / open questions

- **Wikimedia URL stability** — Commons file URLs are generally stable, but renames happen. Mitigation: fetch script is re-runnable; CREDITS.md records the Commons page (not just file URL) for each card.
- **Card identification in scoring** — the 48 cards need a canonical ID scheme. We'll use `month * 4 + sub` (1-indexed month, 0-3 sub-index within month) for a clean 0-47 range, and tag each with explicit `type` + `specialName` for yaku matching.
- **Koi-koi doubling interaction with 7+ doubling** — rule clarification: if both apply, they stack multiplicatively (total × 2 × 2 = 4x). Document this in-game as a tooltip.

## Success criteria

- Double-click `index.html` → playable game loads (after `fetch-assets.sh` has run once).
- Can complete a 3-hand match vs. AI without console errors.
- All 14 yaku detectable; scoring tests pass.
- AI makes non-random moves that visibly try to build yaku.
- Credits panel lists all 48 cards with Wikimedia source links.
