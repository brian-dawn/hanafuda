// DOM rendering for Koi-Koi. Rebuilds the relevant DOM subtrees on each
// render() call; the state object is the source of truth.

import { TYPES } from './cards.js';
import { scoreHand } from './scoring.js';

const $ = sel => document.querySelector(sel);

const CAP_GROUPS = [
  { key: 'hikari', label: 'Hikari', type: TYPES.HIKARI },
  { key: 'tane',   label: 'Tane',   type: TYPES.TANE },
  { key: 'tan',    label: 'Tan',    type: TYPES.TANZAKU },
  { key: 'kasu',   label: 'Kasu',   type: TYPES.KASU },
];

export function createUI(handlers) {
  // handlers: { onPlayHand(cardId), onPickField(cardId), onKoiKoi(choice),
  //             onNextHand(), onNewMatch() }

  $('#btn-agari').addEventListener('click', () => handlers.onKoiKoi('agari'));
  $('#btn-koikoi').addEventListener('click', () => handlers.onKoiKoi('koi-koi'));
  $('#btn-next-hand').addEventListener('click', () => handlers.onNextHand());
  $('#btn-new-match').addEventListener('click', () => handlers.onNewMatch());
  $('#new-match').addEventListener('click', () => handlers.onNewMatch());

  return { render: state => render(state, handlers) };
}

function render(state, handlers) {
  renderTurnIndicator(state);
  renderScoreboard(state);
  renderHand('#opp-hand', state.players[1].hand, { faceDown: true });
  renderHand('#me-hand', state.players[0].hand, {
    faceDown: false,
    clickable: state.turn === 0 && state.phase === 'play-hand',
    onClick: cardId => handlers.onPlayHand(cardId),
  });
  renderCaptures('#opp-captures', state.players[1].captures);
  renderCaptures('#me-captures', state.players[0].captures);
  renderField(state, handlers);
  renderDeck(state);
  renderYakuPanel(state);
  renderLog(state);
  renderDialogs(state);
}

function renderTurnIndicator(state) {
  let el = $('.turn-indicator');
  if (!el) {
    el = document.createElement('div');
    el.className = 'turn-indicator';
    document.body.appendChild(el);
  }
  if (state.phase === 'match-over' || state.phase === 'hand-over') {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  if (state.turn === 0) {
    el.textContent = 'Your turn';
    el.className = 'turn-indicator you';
  } else {
    el.textContent = 'Opponent thinking…';
    el.className = 'turn-indicator opponent';
  }
}

function renderScoreboard(state) {
  $('#scoreboard').innerHTML = `
    <div class="score"><span class="name">You</span><span class="value" data-testid="score-you">${state.scores[0]}</span></div>
    <div class="score"><span class="name">Hand</span><span class="value">${state.hand}/${state.maxHands}</span></div>
    <div class="score"><span class="name">CPU</span><span class="value" data-testid="score-opp">${state.scores[1]}</span></div>
  `;
}

function renderHand(sel, cards, opts) {
  const el = $(sel);
  el.innerHTML = '';
  const n = opts.faceDown ? cards.length : cards.length;
  for (const card of cards) {
    el.appendChild(cardEl(card, opts));
  }
  // Pad face-down hand to hand size so the row stays wide
  if (opts.faceDown) {
    // nothing; just render the cards we know about
  }
}

function cardEl(card, opts) {
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.cardId = card.id;
  el.dataset.testid = `card-${card.id}`;
  if (opts.faceDown) {
    el.classList.add('face-down');
    return el;
  }
  const img = document.createElement('img');
  img.src = card.file;
  img.alt = card.name;
  img.loading = 'lazy';
  img.onerror = () => {
    // fall back to a readable placeholder
    img.remove();
    const ph = document.createElement('div');
    ph.className = 'placeholder';
    ph.textContent = card.name;
    el.appendChild(ph);
  };
  el.appendChild(img);
  el.title = card.name;
  if (opts.clickable) {
    el.classList.add('selectable');
    el.addEventListener('click', () => opts.onClick(card.id));
  }
  return el;
}

function renderCaptures(sel, cards) {
  const el = $(sel);
  el.innerHTML = '';
  if (cards.length === 0) { el.classList.add('empty'); }
  else { el.classList.remove('empty'); }
  for (const g of CAP_GROUPS) {
    const group = document.createElement('div');
    group.className = 'capture-group';
    group.dataset.group = g.key;
    const label = document.createElement('div');
    label.className = 'capture-group-label';
    label.textContent = g.label;
    group.appendChild(label);
    const row = document.createElement('div');
    row.className = 'capture-group-cards';
    const matching = cards.filter(c => c.type === g.type);
    for (const c of matching) {
      row.appendChild(cardEl(c, { faceDown: false }));
    }
    group.appendChild(row);
    el.appendChild(group);
  }
}

function renderField(state, handlers) {
  const el = $('#field');
  el.innerHTML = '';
  // Highlight matchable cards when user is picking a field card.
  let pending = null;
  let clickable = false;
  if (state.turn === 0 && (state.phase === 'choose-match' || state.phase === 'choose-match-deck')) {
    pending = state.phase === 'choose-match' ? state.pendingMatch : state.pendingDraw;
    clickable = true;
  }
  for (const card of state.field) {
    const c = cardEl(card, { faceDown: false });
    if (pending && pending.candidates.some(p => p.id === card.id)) {
      c.classList.add('matchable');
      c.addEventListener('click', () => handlers.onPickField(card.id));
    }
    el.appendChild(c);
  }
}

function renderDeck(state) {
  const el = $('#deck');
  const count = $('#deck-count');
  if (state.deck.length === 0) el.classList.add('empty');
  else el.classList.remove('empty');
  count.textContent = `${state.deck.length} left`;
}

function renderYakuPanel(state) {
  const out = $('#yaku-list');
  out.innerHTML = '';
  for (let p = 0; p < 2; p++) {
    const h = document.createElement('div');
    h.className = 'yaku-player';
    h.textContent = p === 0 ? 'You' : 'Opponent';
    out.appendChild(h);
    const { yaku, total } = scoreHand(state.players[p].captures);
    if (yaku.length === 0) {
      const row = document.createElement('div');
      row.className = 'yaku-item';
      row.innerHTML = `<span>—</span><span class="points">0</span>`;
      out.appendChild(row);
    } else {
      for (const y of yaku) {
        const row = document.createElement('div');
        row.className = 'yaku-item';
        row.innerHTML = `<span>${y.name}</span><span class="points">${y.points}</span>`;
        out.appendChild(row);
      }
      const tot = document.createElement('div');
      tot.className = 'yaku-total';
      tot.innerHTML = `<span>Total</span><span class="points">${total}</span>`;
      out.appendChild(tot);
    }
    if (state.koiKoi[p]) {
      const k = document.createElement('div');
      k.className = 'yaku-item';
      k.innerHTML = `<span style="color:var(--red);font-weight:700">KOI-KOI active</span><span></span>`;
      out.appendChild(k);
    }
  }
}

function renderLog(state) {
  const el = $('#log');
  el.innerHTML = state.log.slice(-20).map(line => {
    if (line.startsWith('—')) {
      return `<div class="log-hand-header">${esc(line)}</div>`;
    }
    return `<div>${esc(line)}</div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

function renderDialogs(state) {
  const koi = $('#koikoi-dialog');
  const handover = $('#handover-dialog');
  const matchover = $('#matchover-dialog');

  // Koi-koi prompt: only for human player.
  if (state.phase === 'ask-koi-koi' && state.turn === 0) {
    const { newYaku, currentScore } = state.pendingYaku;
    $('#koikoi-yaku').innerHTML = `
      <p>New yaku formed:</p>
      <ul>${newYaku.map(y => `<li><b>${y.name}</b>: ${y.points} pts</li>`).join('')}</ul>
      <p>Current total: <b>${currentScore.total}</b> pts${currentScore.doubled ? ' (7+ doubled)' : ''}.</p>
    `;
    if (!koi.open) koi.showModal();
  } else if (koi.open) {
    koi.close();
  }

  // Hand-over
  if (state.phase === 'hand-over') {
    $('#handover-title').textContent = `Hand ${state.hand} complete`;
    const ls = state.lastScore;
    let body = '';
    if (ls) {
      const who = ls.player === 0 ? 'You' : 'Opponent';
      body += `<p><b>${who}</b> scored <b>${ls.total}</b> pts</p>`;
      body += `<ul>${ls.yaku.map(y => `<li>${y.name}: ${y.points}</li>`).join('')}</ul>`;
      if (ls.koiDoubled) body += `<p><em>×2 koi-koi multiplier</em></p>`;
    } else {
      body += `<p>Deck exhausted. No yaku, no score.</p>`;
    }
    body += `<p>Match score: You ${state.scores[0]} — ${state.scores[1]} CPU</p>`;
    $('#handover-body').innerHTML = body;
    if (!handover.open) handover.showModal();
  } else if (handover.open) {
    handover.close();
  }

  // Match-over
  if (state.phase === 'match-over') {
    const [a, b] = state.scores;
    const title = a > b ? 'You win!' : (b > a ? 'CPU wins!' : 'Draw');
    $('#matchover-title').textContent = title;
    $('#matchover-body').innerHTML = `
      <p>Final score: You <b>${a}</b> — <b>${b}</b> CPU</p>
    `;
    if (!matchover.open) matchover.showModal();
  } else if (matchover.open) {
    matchover.close();
  }
}

function esc(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]));
}
