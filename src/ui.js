// DOM rendering for Koi-Koi. Rebuilds the relevant DOM subtrees on each
// render() call; the state object is the source of truth.

import { TYPES, MONTH_NAMES, cardYakuRoles } from './cards.js';
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
  $('#theme-toggle').addEventListener('click', toggleTheme);
  wireHelpDialog();
  wireTooltip();

  syncThemeIcon();
  return { render: state => render(state, handlers) };
}

function wireHelpDialog() {
  const dlg = $('#help-dialog');
  $('#help-btn').addEventListener('click', () => dlg.showModal());
  $('#btn-help-close').addEventListener('click', () => dlg.close());
  dlg.querySelector('.dialog-close')?.addEventListener('click', () => dlg.close());
  // Clicking the backdrop closes too.
  dlg.addEventListener('click', e => {
    if (e.target === dlg) dlg.close();
  });
}

// Card tooltip: shows card name, month, type, and yaku roles on hover.
// Uses event delegation on document so it works even after re-renders.
function wireTooltip() {
  const tip = $('#tooltip');
  let longPressTimer = null;

  function showFor(el, ev) {
    const id = el.dataset.cardId;
    const card = CARDS_BY_ID_LOCAL.get(id);
    if (!card) return;
    tip.innerHTML = tooltipHTML(card);
    tip.hidden = false;
    positionTooltip(ev);
  }
  function positionTooltip(ev) {
    const pad = 14;
    const rect = tip.getBoundingClientRect();
    let x = ev.clientX + pad;
    let y = ev.clientY + pad;
    if (x + rect.width > window.innerWidth - 4) x = ev.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - 4) y = ev.clientY - rect.height - pad;
    tip.style.left = Math.max(4, x) + 'px';
    tip.style.top  = Math.max(4, y) + 'px';
  }
  function hide() { tip.hidden = true; }

  document.addEventListener('mouseover', ev => {
    const el = ev.target.closest('[data-card-id]');
    if (!el || el.classList.contains('face-down')) { hide(); return; }
    showFor(el, ev);
  });
  document.addEventListener('mousemove', ev => {
    if (!tip.hidden) positionTooltip(ev);
  });
  document.addEventListener('mouseout', ev => {
    if (!ev.relatedTarget || !ev.relatedTarget.closest?.('[data-card-id]')) hide();
  });

  // Long-press on touch for card info.
  document.addEventListener('touchstart', ev => {
    const el = ev.target.closest('[data-card-id]');
    if (!el || el.classList.contains('face-down')) return;
    longPressTimer = setTimeout(() => {
      const t = ev.touches[0];
      showFor(el, { clientX: t.clientX, clientY: t.clientY });
      // auto-hide after a while
      setTimeout(hide, 3000);
    }, 450);
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  });
  document.addEventListener('touchmove', () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  });
}

// Populated lazily so we don't circular-import CARD_BY_ID.
const CARDS_BY_ID_LOCAL = new Map();
export function registerCards(cards) {
  for (const c of cards) CARDS_BY_ID_LOCAL.set(String(c.id), c);
}

function tooltipHTML(card) {
  const roles = cardYakuRoles(card);
  const rolesHTML = roles.map(r => `<div class="tip-role"><b>${esc(r.label)}</b><span class="detail">${esc(r.detail)}</span></div>`).join('');
  return `
    <div class="tip-name">${esc(card.name)}</div>
    <div class="tip-month">${esc(MONTH_NAMES[card.month] || '')}</div>
    ${rolesHTML}
  `;
}

function toggleTheme() {
  const curr = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = curr === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('koikoi-theme', next);
  syncThemeIcon();
}

function syncThemeIcon() {
  const icon = $('#theme-icon');
  if (!icon) return;
  const curr = document.documentElement.getAttribute('data-theme') || 'dark';
  icon.textContent = curr === 'dark' ? '☾' : '☀';
}

// Track the previous card locations so captured/moved cards can be
// identified and glow briefly after moving.
let priorCardParents = new Map();  // cardId -> parent container dataset.zone
let priorLogLength = 0;

function render(state, handlers) {
  // --- FLIP: record old positions before DOM rebuild ---
  const prevRects = new Map();
  for (const el of document.querySelectorAll('[data-card-id]')) {
    prevRects.set(el.dataset.cardId, el.getBoundingClientRect());
  }
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

  applyFLIP(prevRects, state);
}

function applyFLIP(prevRects, state) {
  // Figure out which cards are now in captures that weren't before —
  // those get a capture-glow highlight.
  const newParents = new Map();
  for (const el of document.querySelectorAll('[data-card-id]')) {
    const id = el.dataset.cardId;
    const zone = el.closest('[data-zone]')?.dataset.zone || '';
    newParents.set(id, zone);
  }

  for (const el of document.querySelectorAll('[data-card-id]')) {
    const id = el.dataset.cardId;
    const prev = prevRects.get(id);
    // Flag freshly moved into captures (for the glow)
    const newZone = newParents.get(id);
    const oldZone = priorCardParents.get(id);
    if (newZone && newZone.startsWith('cap-') && oldZone !== newZone) {
      el.classList.add('fresh-capture');
      setTimeout(() => el.classList.remove('fresh-capture'), 700);
    }
    if (!prev) continue;  // new card with no prior position — skip animation
    const now = el.getBoundingClientRect();
    const dx = prev.left - now.left;
    const dy = prev.top - now.top;
    const ds = prev.width && now.width ? prev.width / now.width : 1;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(ds - 1) < 0.02) continue;

    // Start at prior position (inverted), then release to new.
    el.classList.remove('flipping');
    el.style.transformOrigin = '0 0';
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${ds})`;
    // Force reflow so the starting transform is committed.
    void el.offsetWidth;
    el.classList.add('flipping');
    el.style.transform = '';
    // Clean up
    setTimeout(() => {
      el.classList.remove('flipping');
      el.style.transform = '';
      el.style.transformOrigin = '';
    }, 500);
  }

  priorCardParents = newParents;
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
  el.dataset.zone = sel === '#me-hand' ? 'hand-me' : 'hand-opp';
  el.innerHTML = '';
  for (const card of cards) {
    el.appendChild(cardEl(card, opts));
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
  if (opts.clickable) {
    el.classList.add('selectable');
    el.addEventListener('click', () => opts.onClick(card.id));
  }
  return el;
}

function renderCaptures(sel, cards) {
  const el = $(sel);
  const who = sel === '#me-captures' ? 'me' : 'opp';
  el.innerHTML = '';
  if (cards.length === 0) { el.classList.add('empty'); }
  else { el.classList.remove('empty'); }
  for (const g of CAP_GROUPS) {
    const group = document.createElement('div');
    group.className = 'capture-group';
    group.dataset.group = g.key;
    group.dataset.zone = `cap-${who}-${g.key}`;
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
  el.dataset.zone = 'field';
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
  const tail = state.log.slice(-20);
  const freshLines = Math.min(tail.length, Math.max(0, state.log.length - priorLogLength));
  priorLogLength = state.log.length;
  el.innerHTML = tail.map((line, i) => {
    const isNew = i >= tail.length - freshLines;
    const cls = (line.startsWith('—') ? 'log-hand-header ' : '') + (isNew ? 'log-new' : '');
    return `<div class="${cls}">${esc(line)}</div>`;
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
