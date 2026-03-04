// ═══════════════════════════════════════════
// SECTION: Board Rendering
// ═══════════════════════════════════════════

// Cached grid of cell DOM elements for fast lookup
const cellElements = [];

function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  cellElements.length = 0;

  for (let r = 0; r < CONFIG.BOARD_SIZE; r++) {
    cellElements[r] = [];
    for (let c = 0; c < CONFIG.BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;

      if (r === CONFIG.ANCHOR_ROW && c === CONFIG.ANCHOR_COL) {
        cell.classList.add('anchor');
      }

      const card = GameState.board[r][c];
      if (card) {
        cell.appendChild(createBoardCardElement(card));
      }

      boardEl.appendChild(cell);
      cellElements[r][c] = cell;
    }
  }
}

function getCellElement(row, col) {
  return cellElements[row]?.[col] || null;
}

function createBoardCardElement(card) {
  const el = document.createElement('div');
  el.className = 'board-card';
  el.dataset.cardId = card.id;

  if (card.isJoker) {
    el.classList.add('joker');
    el.innerHTML = '<span class="card-rank">\u2605</span><span class="card-suit">W</span>';
  } else {
    const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
    el.classList.add(isRed ? 'red' : 'black');
    el.innerHTML = `<span class="card-rank">${card.rank}</span><span class="card-suit">${SUIT_SYMBOLS[card.suit]}</span>`;
  }

  return el;
}

// ═══════════════════════════════════════════
// SECTION: Place Card on Board
// ═══════════════════════════════════════════

function placeBoardCard(card, row, col) {
  GameState.board[row][col] = card;
  GameState.placedThisTurn.push({ row, col, card });
  GameState.totalCardsPlaced++;

  // Remove from hand
  GameState.hand = GameState.hand.filter(c => c.id !== card.id);

  // Render the card on the cell
  const cellEl = getCellElement(row, col);
  if (cellEl) {
    const existing = cellEl.querySelector('.board-card');
    if (existing) existing.remove();

    const cardEl = createBoardCardElement(card);
    cardEl.classList.add('placed-this-turn');
    attachBoardCardDragListeners(cardEl, card, row, col);
    cellEl.appendChild(cardEl);

    // Placement effects
    cardEl.classList.add('impact-bounce');
    setTimeout(() => cardEl.classList.remove('impact-bounce'), 200);

    const flash = document.createElement('div');
    flash.className = 'cell-flash';
    cellEl.appendChild(flash);
    setTimeout(() => flash.remove(), 250);

    // Neighbor jolt
    const joltDirs = [
      { dr: -1, dc: 0, cls: 'jolt-down' },
      { dr: 1, dc: 0, cls: 'jolt-up' },
      { dr: 0, dc: -1, cls: 'jolt-right' },
      { dr: 0, dc: 1, cls: 'jolt-left' },
    ];
    for (const { dr, dc, cls } of joltDirs) {
      const nr = row + dr, nc = col + dc;
      if (inBounds(nr, nc) && GameState.board[nr][nc]) {
        const neighborCell = getCellElement(nr, nc);
        const neighborCard = neighborCell?.querySelector('.board-card');
        if (neighborCard) {
          neighborCard.classList.add(cls);
          setTimeout(() => neighborCard.classList.remove(cls), 150);
        }
      }
    }

    // Particles
    if (typeof ParticlePresets !== 'undefined') {
      const rect = cellEl.getBoundingClientRect();
      ParticlePresets.place(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  }

  updateControls();
  renderHand();
  updateHUD();
}

function undoLastPlacement() {
  if (GameState.placedThisTurn.length === 0) return;

  const last = GameState.placedThisTurn.pop();
  GameState.board[last.row][last.col] = null;
  GameState.hand.push(last.card);
  GameState.totalCardsPlaced--;

  const cellEl = getCellElement(last.row, last.col);
  if (cellEl) {
    const cardEl = cellEl.querySelector('.board-card');
    if (cardEl) cardEl.remove();
  }

  updateControls();
  renderHand();
  updateHUD();
}

// ═══════════════════════════════════════════
// SECTION: Cell Highlights
// ═══════════════════════════════════════════

function clearCellHighlights() {
  document.querySelectorAll('.cell.valid-hover, .cell.invalid-hover').forEach(el => {
    el.classList.remove('valid-hover', 'invalid-hover');
  });
}

function highlightValidCells() {
  clearCellHighlights();
  for (let r = 0; r < CONFIG.BOARD_SIZE; r++) {
    for (let c = 0; c < CONFIG.BOARD_SIZE; c++) {
      if (isValidPlacement(r, c)) {
        const cellEl = getCellElement(r, c);
        if (cellEl) cellEl.classList.add('valid-hover');
      }
    }
  }
}

// ═══════════════════════════════════════════
// SECTION: Drag and Drop
// ═══════════════════════════════════════════

const dragState = {
  active: false,
  card: null,
  source: null,       // 'hand' | 'board'
  sourceRow: null,
  sourceCol: null,
  ghostEl: null,
  offsetX: 0,
  offsetY: 0,
  sourceEl: null,
};

function startDrag(card, source, sourceRow, sourceCol, sourceEl, clientX, clientY) {
  if (GameState.isAnimating) return;
  if (GameState.phase !== 'PLACING') return;

  const rect = sourceEl.getBoundingClientRect();

  dragState.active = true;
  dragState.card = card;
  dragState.source = source;
  dragState.sourceRow = sourceRow;
  dragState.sourceCol = sourceCol;
  dragState.sourceEl = sourceEl;
  dragState.offsetX = clientX - rect.left;
  dragState.offsetY = clientY - rect.top;

  // Create ghost element
  const ghost = sourceEl.cloneNode(true);
  ghost.classList.add('drag-ghost');
  ghost.style.width = rect.width + 'px';
  ghost.style.height = rect.height + 'px';
  ghost.style.left = (clientX - dragState.offsetX) + 'px';
  ghost.style.top = (clientY - dragState.offsetY) + 'px';
  document.body.appendChild(ghost);
  dragState.ghostEl = ghost;

  // Dim the original
  sourceEl.classList.add('drag-source-hidden');

  // If dragging from board, temporarily remove from state so validation works
  if (source === 'board') {
    GameState.board[sourceRow][sourceCol] = null;
    GameState.placedThisTurn = GameState.placedThisTurn.filter(
      p => !(p.row === sourceRow && p.col === sourceCol)
    );
    GameState.totalCardsPlaced--;
  }

  highlightValidCells();

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchmove', onDragMoveTouch, { passive: false });
  document.addEventListener('touchend', onDragEndTouch);
  document.addEventListener('touchcancel', onDragEndTouch);
}

function onDragMove(e) {
  if (!dragState.active) return;
  updateGhostPosition(e.clientX, e.clientY);
}

function onDragMoveTouch(e) {
  if (!dragState.active) return;
  e.preventDefault();
  const touch = e.touches[0];
  updateGhostPosition(touch.clientX, touch.clientY);
}

function updateGhostPosition(clientX, clientY) {
  if (!dragState.ghostEl) return;
  dragState.ghostEl.style.left = (clientX - dragState.offsetX) + 'px';
  dragState.ghostEl.style.top = (clientY - dragState.offsetY) + 'px';
}

function getCellAtPoint(clientX, clientY) {
  // Temporarily hide ghost so elementFromPoint finds the cell beneath
  if (dragState.ghostEl) dragState.ghostEl.style.display = 'none';
  const el = document.elementFromPoint(clientX, clientY);
  if (dragState.ghostEl) dragState.ghostEl.style.display = '';
  if (!el) return null;

  const cell = el.closest('.cell');
  if (!cell) return null;

  const row = parseInt(cell.dataset.row);
  const col = parseInt(cell.dataset.col);
  if (isNaN(row) || isNaN(col)) return null;

  return { row, col };
}

function isOverHandTray(clientX, clientY) {
  const tray = document.getElementById('hand-tray');
  const rect = tray.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right &&
         clientY >= rect.top && clientY <= rect.bottom;
}

function onDragEnd(e) {
  if (!dragState.active) return;
  finalizeDrag(e.clientX, e.clientY);
}

function onDragEndTouch(e) {
  if (!dragState.active) return;
  const touch = e.changedTouches?.[0];
  if (touch) {
    finalizeDrag(touch.clientX, touch.clientY);
  } else {
    cancelDragRestore();
    cleanupDrag();
  }
}

function finalizeDrag(clientX, clientY) {
  const cellInfo = getCellAtPoint(clientX, clientY);
  const overHandTray = isOverHandTray(clientX, clientY);

  if (cellInfo && isValidPlacement(cellInfo.row, cellInfo.col)) {
    // Valid board drop - remove old element if from board
    if (dragState.source === 'board') {
      const oldCellEl = getCellElement(dragState.sourceRow, dragState.sourceCol);
      const oldCardEl = oldCellEl?.querySelector('.board-card');
      if (oldCardEl) oldCardEl.remove();
    }
    placeBoardCard(dragState.card, cellInfo.row, cellInfo.col);
  } else if (dragState.source === 'board' && (overHandTray || !cellInfo)) {
    // Board card returned to hand (undo) - remove old element
    const oldCellEl = getCellElement(dragState.sourceRow, dragState.sourceCol);
    const oldCardEl = oldCellEl?.querySelector('.board-card');
    if (oldCardEl) oldCardEl.remove();
    GameState.hand.push(dragState.card);
    renderHand();
    updateControls();
    updateHUD();
  } else if (dragState.source === 'board') {
    // Board card dropped on invalid cell - snap back
    cancelDragRestore();
  } else {
    // Hand card dropped on invalid target - return to hand (re-render to unhide)
    renderHand();
  }

  cleanupDrag();
}

function cancelDragRestore() {
  // Restore the card to its original board position
  GameState.board[dragState.sourceRow][dragState.sourceCol] = dragState.card;
  GameState.placedThisTurn.push({
    row: dragState.sourceRow,
    col: dragState.sourceCol,
    card: dragState.card,
  });
  GameState.totalCardsPlaced++;

  // Re-render the cell
  const cellEl = getCellElement(dragState.sourceRow, dragState.sourceCol);
  if (cellEl) {
    const existing = cellEl.querySelector('.board-card');
    if (existing) existing.remove();
    const cardEl = createBoardCardElement(dragState.card);
    cardEl.classList.add('placed-this-turn');
    attachBoardCardDragListeners(cardEl, dragState.card, dragState.sourceRow, dragState.sourceCol);
    cellEl.appendChild(cardEl);
  }
}

function cleanupDrag() {
  if (dragState.ghostEl) {
    dragState.ghostEl.remove();
  }

  document.querySelectorAll('.drag-source-hidden').forEach(el => {
    el.classList.remove('drag-source-hidden');
  });

  clearCellHighlights();

  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.removeEventListener('touchmove', onDragMoveTouch);
  document.removeEventListener('touchend', onDragEndTouch);
  document.removeEventListener('touchcancel', onDragEndTouch);

  dragState.active = false;
  dragState.card = null;
  dragState.source = null;
  dragState.sourceRow = null;
  dragState.sourceCol = null;
  dragState.ghostEl = null;
  dragState.sourceEl = null;
}

function attachBoardCardDragListeners(cardEl, card, row, col) {
  cardEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    startDrag(card, 'board', row, col, cardEl, e.clientX, e.clientY);
  });
  cardEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    startDrag(card, 'board', row, col, cardEl, touch.clientX, touch.clientY);
  }, { passive: false });
}
