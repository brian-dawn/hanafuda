// 48-card Hanafuda deck. ID = (month - 1) * 4 + sub, so IDs are 0..47.
// Each card has a primary `type` used for scoring bulk-count yaku, plus
// specific flags used for named yaku (Ino-Shika-Chō, Aka-tan, etc.)

export const TYPES = {
  HIKARI: 'hikari',   // 5 Brights
  TANE: 'tane',       // animals / themed
  TANZAKU: 'tanzaku', // ribbons
  KASU: 'kasu',       // plain
};

// Using explicit objects instead of a loop so each card's properties are
// self-documenting.
export const CARDS = [
  // January — Pine & Crane
  { id: 0,  month: 1,  type: TYPES.HIKARI,  name: 'Crane & Sun (Pine)',        file: 'assets/cards/0.svg' },
  { id: 1,  month: 1,  type: TYPES.TANZAKU, name: 'Pine Poetry Ribbon',        file: 'assets/cards/1.svg',  poetry: true },
  { id: 2,  month: 1,  type: TYPES.KASU,    name: 'Pine Chaff 1',              file: 'assets/cards/2.svg' },
  { id: 3,  month: 1,  type: TYPES.KASU,    name: 'Pine Chaff 2',              file: 'assets/cards/3.svg' },

  // February — Plum Blossom & Bush Warbler
  { id: 4,  month: 2,  type: TYPES.TANE,    name: 'Bush Warbler (Plum)',       file: 'assets/cards/4.svg' },
  { id: 5,  month: 2,  type: TYPES.TANZAKU, name: 'Plum Poetry Ribbon',        file: 'assets/cards/5.svg',  poetry: true },
  { id: 6,  month: 2,  type: TYPES.KASU,    name: 'Plum Chaff 1',              file: 'assets/cards/6.svg' },
  { id: 7,  month: 2,  type: TYPES.KASU,    name: 'Plum Chaff 2',              file: 'assets/cards/7.svg' },

  // March — Cherry Blossom & Curtain
  { id: 8,  month: 3,  type: TYPES.HIKARI,  name: 'Cherry Curtain',            file: 'assets/cards/8.svg',  cherry: true },
  { id: 9,  month: 3,  type: TYPES.TANZAKU, name: 'Cherry Poetry Ribbon',      file: 'assets/cards/9.svg',  poetry: true },
  { id: 10, month: 3,  type: TYPES.KASU,    name: 'Cherry Chaff 1',            file: 'assets/cards/10.svg' },
  { id: 11, month: 3,  type: TYPES.KASU,    name: 'Cherry Chaff 2',            file: 'assets/cards/11.svg' },

  // April — Wisteria & Cuckoo
  { id: 12, month: 4,  type: TYPES.TANE,    name: 'Cuckoo (Wisteria)',         file: 'assets/cards/12.svg' },
  { id: 13, month: 4,  type: TYPES.TANZAKU, name: 'Wisteria Red Ribbon',       file: 'assets/cards/13.svg' },
  { id: 14, month: 4,  type: TYPES.KASU,    name: 'Wisteria Chaff 1',          file: 'assets/cards/14.svg' },
  { id: 15, month: 4,  type: TYPES.KASU,    name: 'Wisteria Chaff 2',          file: 'assets/cards/15.svg' },

  // May — Iris & Bridge
  { id: 16, month: 5,  type: TYPES.TANE,    name: 'Eight-plank Bridge (Iris)', file: 'assets/cards/16.svg' },
  { id: 17, month: 5,  type: TYPES.TANZAKU, name: 'Iris Red Ribbon',           file: 'assets/cards/17.svg' },
  { id: 18, month: 5,  type: TYPES.KASU,    name: 'Iris Chaff 1',              file: 'assets/cards/18.svg' },
  { id: 19, month: 5,  type: TYPES.KASU,    name: 'Iris Chaff 2',              file: 'assets/cards/19.svg' },

  // June — Peony & Butterflies
  { id: 20, month: 6,  type: TYPES.TANE,    name: 'Butterflies (Peony)',       file: 'assets/cards/20.svg', isc: true },
  { id: 21, month: 6,  type: TYPES.TANZAKU, name: 'Peony Blue Ribbon',         file: 'assets/cards/21.svg', blue: true },
  { id: 22, month: 6,  type: TYPES.KASU,    name: 'Peony Chaff 1',             file: 'assets/cards/22.svg' },
  { id: 23, month: 6,  type: TYPES.KASU,    name: 'Peony Chaff 2',             file: 'assets/cards/23.svg' },

  // July — Bush Clover & Boar
  { id: 24, month: 7,  type: TYPES.TANE,    name: 'Boar (Bush Clover)',        file: 'assets/cards/24.svg', isc: true },
  { id: 25, month: 7,  type: TYPES.TANZAKU, name: 'Bush Clover Red Ribbon',    file: 'assets/cards/25.svg' },
  { id: 26, month: 7,  type: TYPES.KASU,    name: 'Bush Clover Chaff 1',       file: 'assets/cards/26.svg' },
  { id: 27, month: 7,  type: TYPES.KASU,    name: 'Bush Clover Chaff 2',       file: 'assets/cards/27.svg' },

  // August — Pampas Grass, Moon & Geese
  { id: 28, month: 8,  type: TYPES.HIKARI,  name: 'Full Moon (Susuki)',        file: 'assets/cards/28.svg', moon: true },
  { id: 29, month: 8,  type: TYPES.TANE,    name: 'Geese (Susuki)',            file: 'assets/cards/29.svg' },
  { id: 30, month: 8,  type: TYPES.KASU,    name: 'Susuki Chaff 1',            file: 'assets/cards/30.svg' },
  { id: 31, month: 8,  type: TYPES.KASU,    name: 'Susuki Chaff 2',            file: 'assets/cards/31.svg' },

  // September — Chrysanthemum & Sake Cup
  { id: 32, month: 9,  type: TYPES.TANE,    name: 'Sake Cup (Chrysanthemum)',  file: 'assets/cards/32.svg', sake: true },
  { id: 33, month: 9,  type: TYPES.TANZAKU, name: 'Chrysanthemum Blue Ribbon', file: 'assets/cards/33.svg', blue: true },
  { id: 34, month: 9,  type: TYPES.KASU,    name: 'Chrysanthemum Chaff 1',     file: 'assets/cards/34.svg' },
  { id: 35, month: 9,  type: TYPES.KASU,    name: 'Chrysanthemum Chaff 2',     file: 'assets/cards/35.svg' },

  // October — Maple & Deer
  { id: 36, month: 10, type: TYPES.TANE,    name: 'Deer (Maple)',              file: 'assets/cards/36.svg', isc: true },
  { id: 37, month: 10, type: TYPES.TANZAKU, name: 'Maple Blue Ribbon',         file: 'assets/cards/37.svg', blue: true },
  { id: 38, month: 10, type: TYPES.KASU,    name: 'Maple Chaff 1',             file: 'assets/cards/38.svg' },
  { id: 39, month: 10, type: TYPES.KASU,    name: 'Maple Chaff 2',             file: 'assets/cards/39.svg' },

  // November — Willow, Rain Man, Swallow, Lightning
  { id: 40, month: 11, type: TYPES.HIKARI,  name: 'Ono no Michikaze (Rain)',   file: 'assets/cards/40.svg', rainman: true },
  { id: 41, month: 11, type: TYPES.TANE,    name: 'Swallow (Willow)',          file: 'assets/cards/41.svg' },
  { id: 42, month: 11, type: TYPES.TANZAKU, name: 'Willow Red Ribbon',         file: 'assets/cards/42.svg' },
  { id: 43, month: 11, type: TYPES.KASU,    name: 'Lightning (Willow)',        file: 'assets/cards/43.svg' },

  // December — Paulownia & Phoenix
  { id: 44, month: 12, type: TYPES.HIKARI,  name: 'Phoenix (Paulownia)',       file: 'assets/cards/44.svg' },
  { id: 45, month: 12, type: TYPES.KASU,    name: 'Paulownia Chaff 1',         file: 'assets/cards/45.svg' },
  { id: 46, month: 12, type: TYPES.KASU,    name: 'Paulownia Chaff 2',         file: 'assets/cards/46.svg' },
  { id: 47, month: 12, type: TYPES.KASU,    name: 'Paulownia Chaff 3',         file: 'assets/cards/47.svg' },
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));

export function cardsByMonth(month) {
  return CARDS.filter(c => c.month === month);
}

export function shuffledDeck(rng = Math.random) {
  const deck = CARDS.slice();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
