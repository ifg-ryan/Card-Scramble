// ═══════════════════════════════════════════
// SECTION: Hand Rendering
// ═══════════════════════════════════════════

function renderHand() {
  const tray = document.getElementById('hand-tray');
  tray.innerHTML = '';

  GameState.hand.forEach((card) => {
    const el = document.createElement('div');
    el.className = 'hand-card';
    el.dataset.cardId = card.id;

    if (card.isJoker) {
      el.classList.add('joker');
      el.innerHTML = '<span class="card-rank">\u2605</span><span class="card-suit">W</span>';
    } else {
      const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
      el.classList.add(isRed ? 'red' : 'black');
      el.innerHTML = `<span class="card-rank">${card.rank}</span><span class="card-suit">${SUIT_SYMBOLS[card.suit]}</span>`;
    }

    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startDrag(card, 'hand', null, null, el, e.clientX, e.clientY);
    });
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.touches[0];
      startDrag(card, 'hand', null, null, el, touch.clientX, touch.clientY);
    }, { passive: false });

    tray.appendChild(el);
  });
}

// ═══════════════════════════════════════════
// SECTION: HUD Updates
// ═══════════════════════════════════════════

function updateHUD() {
  document.getElementById('score-value').textContent = GameState.score.toLocaleString();
  document.getElementById('deck-count').textContent = cardsRemaining();
  document.getElementById('turn-count').textContent = GameState.turnNumber + 1;
  updateDeckVisual();
}

// ═══════════════════════════════════════════
// SECTION: Deck Visual
// ═══════════════════════════════════════════

function updateDeckVisual() {
  const remaining = cardsRemaining();
  const total = CONFIG.DECK_SIZE;
  const pct = remaining / total;

  // Show 0-8 card backs proportional to remaining
  const backs = document.querySelectorAll('#deck-pile .deck-card-back');
  const visibleCount = remaining === 0 ? 0
    : pct > 0.85 ? 8
    : pct > 0.7 ? 7
    : pct > 0.55 ? 6
    : pct > 0.4 ? 5
    : pct > 0.3 ? 4
    : pct > 0.2 ? 3
    : pct > 0.1 ? 2
    : 1;
  backs.forEach((b, i) => {
    b.style.display = i < visibleCount ? '' : 'none';
  });

  // Color-code the count
  const countEl = document.getElementById('deck-count');
  if (countEl) {
    countEl.classList.remove('low', 'empty');
    if (remaining === 0) countEl.classList.add('empty');
    else if (remaining < 10) countEl.classList.add('low');
  }
}

// ═══════════════════════════════════════════
// SECTION: Controls
// ═══════════════════════════════════════════

function updateControls() {
  const scoreBtn = document.getElementById('score-btn');
  const undoBtn = document.getElementById('undo-btn');

  scoreBtn.disabled = !isValidTurnEnd();
  undoBtn.disabled = GameState.placedThisTurn.length === 0;
}

// ═══════════════════════════════════════════
// SECTION: Scoring Phase
// ═══════════════════════════════════════════

async function runScoringPhase() {
  GameState.phase = 'SCORING';
  GameState.isAnimating = true;
  clearCellHighlights();
  renderHand();

  const hands = detectNewHands();

  if (hands.length === 0) {
    showMessage('No hands formed');
    await wait(800);
    hideMessage();
  } else {
    for (let i = 0; i < hands.length; i++) {
      const hand = hands[i];
      const prevScore = GameState.score;
      await showScoringCeremony(hand, i, hands.length);
      GameState.score += hand.points;
      GameState.handsScored.push(hand);

      // Rolling score counter with bump
      const scoreEl = document.getElementById('score-value');
      scoreEl.classList.add('bump');
      await animateScoreCounter(scoreEl, prevScore, GameState.score, 400);
      setTimeout(() => scoreEl.classList.remove('bump'), 300);
    }

    // Combo text for 2+ hands
    if (hands.length > 1) {
      const combo = document.createElement('div');
      combo.className = 'combo-text';
      combo.textContent = `COMBO x${hands.length}!`;
      document.body.appendChild(combo);

      // Particles for combo
      ParticlePresets.scoreMid(window.innerWidth / 2, window.innerHeight / 2);

      await wait(800);
      combo.remove();
    }
  }

  // Clear placed-this-turn markers
  document.querySelectorAll('.board-card.placed-this-turn').forEach(el => {
    el.classList.remove('placed-this-turn');
  });
  GameState.placedThisTurn = [];
  GameState.turnNumber++;

  GameState.isAnimating = false;

  // Check game over or draw
  await checkGameStateAndContinue();
}

// ═══════════════════════════════════════════
// SECTION: 5-Phase Scoring Ceremony
// ═══════════════════════════════════════════

async function showScoringCeremony(hand, index, total) {
  const tier = HAND_TIERS[hand.handType] || 1;
  const popup = document.getElementById('scoring-popup');

  // ── Phase 1: The Reveal (400ms) ──
  // Dim all board cards
  document.querySelectorAll('.board-card').forEach(el => el.classList.add('scoring-dim'));

  // Sequentially light up scored cards
  for (let i = 0; i < hand.cells.length; i++) {
    const cell = hand.cells[i];
    const cellEl = getCellElement(cell.row, cell.col);
    if (cellEl) {
      const cardEl = cellEl.querySelector('.board-card');
      if (cardEl) {
        cardEl.classList.remove('scoring-dim');
        cardEl.classList.add('scoring-glow');
      }
    }
    await wait(80);
  }

  // ── Phase 2: The Name (500ms) ──
  popup.innerHTML = '';
  const nameEl = document.createElement('div');
  nameEl.className = `scoring-hand-name tier-${tier}`;
  if (hand.isBespoke) nameEl.classList.add('bespoke');
  nameEl.textContent = hand.handName;
  popup.appendChild(nameEl);
  popup.classList.add('visible');

  // Particles at popup center
  const popupRect = popup.getBoundingClientRect();
  const cx = popupRect.left + popupRect.width / 2;
  const cy = popupRect.top + popupRect.height / 2;
  ParticlePresets.scoreByTier(cx, cy, tier);

  // Screen shake
  ScreenShake.trigger(tier);

  await wait(500);

  // ── Phase 3: The Breakdown (600ms) ──
  const breakdownEl = document.createElement('div');
  breakdownEl.className = 'scoring-breakdown';
  popup.appendChild(breakdownEl);

  // Typewriter the breakdown
  const breakdownText = hand.breakdown;
  for (let i = 0; i < breakdownText.length; i++) {
    breakdownEl.textContent += breakdownText[i];
    await wait(20);
  }

  // Points punch in
  const pointsEl = document.createElement('div');
  pointsEl.className = 'scoring-points';
  pointsEl.textContent = `+${hand.points.toLocaleString()}`;
  popup.appendChild(pointsEl);
  await wait(400);

  // ── Phase 4: The Fly (350ms) ──
  const pointsRect = pointsEl.getBoundingClientRect();
  const startX = pointsRect.left + pointsRect.width / 2;
  const startY = pointsRect.top + pointsRect.height / 2;
  await flyPointsToScoreboard(startX, startY, `+${hand.points.toLocaleString()}`, 500);

  // Particles at scoreboard
  const scoreEl = document.getElementById('score-value');
  const scoreRect = scoreEl.getBoundingClientRect();
  ParticlePresets.scoreLand(
    scoreRect.left + scoreRect.width / 2,
    scoreRect.top + scoreRect.height / 2
  );

  // ── Phase 5: The Settle (200ms) ──
  popup.classList.remove('visible');

  // Clear highlights
  document.querySelectorAll('.board-card.scoring-glow').forEach(el => el.classList.remove('scoring-glow'));
  document.querySelectorAll('.board-card.scoring-dim').forEach(el => el.classList.remove('scoring-dim'));

  if (index < total - 1) await wait(300);
}

// ═══════════════════════════════════════════
// SECTION: Drawing Phase (with animation)
// ═══════════════════════════════════════════

async function drawPhase() {
  GameState.phase = 'DRAWING';
  const needed = CONFIG.HAND_SIZE - GameState.hand.length;
  if (needed > 0 && cardsRemaining() > 0) {
    const count = Math.min(needed, cardsRemaining());
    const drawn = drawCards(count);

    // Animate each card flying from deck to hand
    await animateDrawFromDeck(count);

    GameState.hand.push(...drawn);
    renderHand();
    updateHUD();
  }
}

async function animateDrawFromDeck(count) {
  const deckPile = document.getElementById('deck-pile');
  const handTray = document.getElementById('hand-tray');

  if (!deckPile || !handTray) return;

  const deckRect = deckPile.getBoundingClientRect();
  const trayRect = handTray.getBoundingClientRect();

  // Start position: center of the deck pile
  const startX = deckRect.left + deckRect.width / 2;
  const startY = deckRect.top + deckRect.height / 2;

  // End position: center of the hand tray
  const endX = trayRect.left + trayRect.width / 2;
  const endY = trayRect.top + trayRect.height / 3;

  const promises = [];

  for (let i = 0; i < count; i++) {
    // Stagger each card by 100ms
    const delay = i * 100;
    promises.push(flyCardFromDeck(startX, startY, endX, endY, delay));
  }

  await Promise.all(promises);
}

function flyCardFromDeck(startX, startY, endX, endY, delay = 0) {
  return new Promise(resolve => {
    setTimeout(() => {
      const card = document.createElement('div');
      card.className = 'draw-fly-card';
      card.style.left = startX + 'px';
      card.style.top = startY + 'px';
      card.style.transform = 'translate(-50%, -50%) scale(1)';
      document.body.appendChild(card);

      // Update deck visual as each card "leaves"
      updateDeckVisual();

      const duration = 350;
      const startTime = performance.now();

      // Control point for arc — arc to the left and down
      const cpX = (startX + endX) / 2 - 40;
      const cpY = Math.min(startY, endY) - 30;

      function animate() {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const eased = easeInOutCubic(t);

        const x = quadBezier(startX, cpX, endX, eased);
        const y = quadBezier(startY, cpY, endY, eased);
        const scale = lerp(1, 0.7, eased);
        const rotation = lerp(0, -10, eased);
        const opacity = t > 0.85 ? lerp(1, 0, (t - 0.85) / 0.15) : 1;

        card.style.left = x + 'px';
        card.style.top = y + 'px';
        card.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`;
        card.style.opacity = opacity;

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          card.remove();
          resolve();
        }
      }
      animate();
    }, delay);
  });
}

// ═══════════════════════════════════════════
// SECTION: Game Flow
// ═══════════════════════════════════════════

async function checkGameStateAndContinue() {
  // Check game over: deck empty and hand empty
  if (cardsRemaining() === 0 && GameState.hand.length === 0) {
    showGameOver();
    return;
  }

  // Draw cards
  await drawPhase();

  // Check if any valid placements exist
  if (!hasAnyValidPlacement()) {
    showMessage('No valid moves!');
    await wait(1200);
    hideMessage();
    showGameOver();
    return;
  }

  GameState.phase = 'PLACING';
  updateControls();
}

async function showGameOver() {
  GameState.phase = 'GAME_OVER';

  const modal = document.getElementById('game-over-modal');
  modal.classList.remove('hidden');

  // Confetti behind modal
  ParticlePresets.confetti(window.innerWidth / 2, window.innerHeight / 2);

  // Score counts up from 0
  const finalScoreEl = document.getElementById('final-score');
  finalScoreEl.textContent = '0';
  await animateScoreCounter(finalScoreEl, 0, GameState.score, 1500);

  // Stats stagger in
  const bestHand = GameState.handsScored.length > 0
    ? GameState.handsScored.reduce((a, b) => a.points > b.points ? a : b)
    : null;

  const stats = [
    `Hands Scored: ${GameState.handsScored.length}`,
    `Best Hand: ${bestHand ? `${bestHand.handName} (${bestHand.points})` : 'None'}`,
    `Cards Placed: ${GameState.totalCardsPlaced}`,
    `Turns Played: ${GameState.turnNumber}`,
  ];

  document.getElementById('game-stats').innerHTML = stats
    .map(s => `<div class="stat-line">${s}</div>`)
    .join('');
}

// ═══════════════════════════════════════════
// SECTION: Messages
// ═══════════════════════════════════════════

function showMessage(text) {
  const overlay = document.getElementById('message-overlay');
  overlay.textContent = text;
  overlay.classList.remove('hidden');
}

function hideMessage() {
  document.getElementById('message-overlay').classList.add('hidden');
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════
// SECTION: Event Wiring & Init
// ═══════════════════════════════════════════

document.getElementById('score-btn').addEventListener('click', () => {
  if (GameState.phase !== 'PLACING') return;
  if (!isValidTurnEnd()) return;
  runScoringPhase();
});

document.getElementById('undo-btn').addEventListener('click', () => {
  if (GameState.phase !== 'PLACING') return;
  undoLastPlacement();
});

document.getElementById('play-again-btn').addEventListener('click', () => {
  document.getElementById('game-over-modal').classList.add('hidden');
  startGame();
});

function startGame() {
  initGame();
  initEffects();
  renderBoard();
  renderHand();
  updateHUD();
  updateControls();
}

startGame();
