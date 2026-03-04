// ═══════════════════════════════════════════
// SECTION: Constants & Config
// ═══════════════════════════════════════════

const CONFIG = {
  BOARD_SIZE: 13,
  HAND_SIZE: 7,
  DECK_SIZE: 54,
  MAX_LINE_LENGTH: 5,
  ANCHOR_ROW: 6,
  ANCHOR_COL: 6,
};

const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS = ['hearts','diamonds','clubs','spades'];
const SUIT_SYMBOLS = { hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660', wild: '\u2605' };

const CARD_VALUES = {
  'A': 11, 'K': 10, 'Q': 10, 'J': 10, '10': 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5,
  '4': 4, '3': 3, '2': 2, 'JOKER': 0,
};

// Rank ordinals for straight detection (separate from point values)
const RANK_ORDINALS = {
  'A': 14, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
  '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13,
};

// Pre-computed joker substitution candidates (all 52 real cards)
const ALL_CARD_SUBS = [];
for (const suit of SUITS) {
  for (const rank of RANKS) {
    ALL_CARD_SUBS.push({ rank, suit });
  }
}

const HAND_SCORING = {
  ROYAL_FLUSH:     { name: 'Royal Flush',     mult: 25, bespoke: 3000 },
  STEEL_WHEEL:     { name: 'Steel Wheel',     mult: 25, bespoke: 2000 },
  QUINT_ACES:      { name: 'Quint Aces',      mult: 0,  bespoke: 1500 },
  QUINTS:          { name: 'Five of a Kind',   mult: 0,  bespoke: 1250 },
  QUAD_ACES:       { name: 'Quad Aces',        mult: 15, bespoke: 1000 },
  QUAD_DEUCES:     { name: 'Quad Deuces',      mult: 15, bespoke: 800  },
  STRAIGHT_FLUSH:  { name: 'Straight Flush',   mult: 25, bespoke: null },
  FOUR_OF_A_KIND:  { name: 'Four of a Kind',   mult: 15, bespoke: null },
  FULL_HOUSE:      { name: 'Full House',       mult: 10, bespoke: null },
  FLUSH:           { name: 'Flush',            mult: 6,  bespoke: null },
  BROADWAY:        { name: 'Broadway',         mult: 5,  bespoke: 300  },
  WHEEL:           { name: 'Wheel',            mult: 5,  bespoke: 250  },
  STRAIGHT:        { name: 'Straight',         mult: 5,  bespoke: null },
  THREE_OF_A_KIND: { name: 'Three of a Kind',  mult: 4,  bespoke: null },
  TWO_PAIR:        { name: 'Two Pair',         mult: 3,  bespoke: null },
  ONE_PAIR:        { name: 'One Pair',         mult: 2,  bespoke: null },
  PAI_GOW:         { name: 'Pai Gow!',         mult: 1,  bespoke: 75   },
  LOWBALL:         { name: 'Lowball',          mult: 1,  bespoke: 50   },
  SINGLETONS:      { name: 'Singletons',      mult: 1,  bespoke: null },
};

// ═══════════════════════════════════════════
// SECTION: Game State
// ═══════════════════════════════════════════

const GameState = {
  deck: [],
  deckIndex: 0,
  board: [],
  hand: [],
  score: 0,
  handsScored: [],
  turnNumber: 0,
  placedThisTurn: [],
  phase: 'PLACING',
  isAnimating: false,
  nextCardId: 0,
  totalCardsPlaced: 0,
};

// ═══════════════════════════════════════════
// SECTION: Deck & Card Logic
// ═══════════════════════════════════════════

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, id: GameState.nextCardId++, isJoker: false, jokerAs: null });
    }
  }
  deck.push({ rank: 'JOKER', suit: 'wild', id: GameState.nextCardId++, isJoker: true, jokerAs: null });
  deck.push({ rank: 'JOKER', suit: 'wild', id: GameState.nextCardId++, isJoker: true, jokerAs: null });
  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function drawCards(count) {
  const drawn = [];
  while (drawn.length < count && GameState.deckIndex < GameState.deck.length) {
    drawn.push(GameState.deck[GameState.deckIndex++]);
  }
  return drawn;
}

function cardsRemaining() {
  return GameState.deck.length - GameState.deckIndex;
}

// ═══════════════════════════════════════════
// SECTION: Board Helpers
// ═══════════════════════════════════════════

function createEmptyBoard() {
  const board = [];
  for (let r = 0; r < CONFIG.BOARD_SIZE; r++) {
    board.push(new Array(CONFIG.BOARD_SIZE).fill(null));
  }
  return board;
}

function inBounds(r, c) {
  return r >= 0 && r < CONFIG.BOARD_SIZE && c >= 0 && c < CONFIG.BOARD_SIZE;
}

function getAdjacentCells(row, col) {
  const adj = [];
  if (row > 0) adj.push({ row: row - 1, col });
  if (row < CONFIG.BOARD_SIZE - 1) adj.push({ row: row + 1, col });
  if (col > 0) adj.push({ row, col: col - 1 });
  if (col < CONFIG.BOARD_SIZE - 1) adj.push({ row, col: col + 1 });
  return adj;
}

function isPlacedThisTurn(r, c) {
  return GameState.placedThisTurn.some(p => p.row === r && p.col === c);
}

function getProjectedLineLength(row, col, direction) {
  const dr = direction === 'vertical' ? 1 : 0;
  const dc = direction === 'horizontal' ? 1 : 0;
  let count = 1;
  let r = row + dr, c = col + dc;
  while (inBounds(r, c) && (GameState.board[r][c] || isPlacedThisTurn(r, c))) {
    count++; r += dr; c += dc;
  }
  r = row - dr; c = col - dc;
  while (inBounds(r, c) && (GameState.board[r][c] || isPlacedThisTurn(r, c))) {
    count++; r -= dr; c -= dc;
  }
  return count;
}

// ═══════════════════════════════════════════
// SECTION: Placement Validation
// ═══════════════════════════════════════════

// No 2×2 filled squares allowed. This prevents L-shapes and corners
// while still allowing T-shapes and crosses (lines intersecting at a shared card).
function wouldCreate2x2(row, col) {
  const board = GameState.board;
  // The candidate cell participates in 4 possible 2×2 blocks.
  // Check if placing here would complete any of them.
  const offsets = [
    [[0,1],[1,0],[1,1]],   // candidate is top-left
    [[0,-1],[1,-1],[1,0]],  // candidate is top-right
    [[-1,0],[-1,1],[0,1]],  // candidate is bottom-left
    [[-1,-1],[-1,0],[0,-1]], // candidate is bottom-right
  ];
  for (const trio of offsets) {
    if (trio.every(([dr, dc]) => {
      const r = row + dr, c = col + dc;
      return inBounds(r, c) && board[r][c] !== null;
    })) {
      return true;
    }
  }
  return false;
}

function isValidPlacement(row, col) {
  const { board, placedThisTurn, turnNumber } = GameState;

  if (board[row][col] !== null) return false;
  if (isPlacedThisTurn(row, col)) return false;

  // All placed cards this turn must form one contiguous sequence
  if (placedThisTurn.length > 0) {
    const allRows = [...placedThisTurn.map(p => p.row), row];
    const allCols = [...placedThisTurn.map(p => p.col), col];
    const sameRow = new Set(allRows).size === 1;
    const sameCol = new Set(allCols).size === 1;
    if (!sameRow && !sameCol) return false;

    // Direction lock: when only 1 card placed, the next card must extend in
    // the direction that the placed card connects to existing board cards.
    // This prevents starting a perpendicular sequence from the placed card.
    if (placedThisTurn.length === 1) {
      const p = placedThisTurn[0];
      const hasHBoard = (inBounds(p.row, p.col - 1) && board[p.row][p.col - 1] !== null) ||
                        (inBounds(p.row, p.col + 1) && board[p.row][p.col + 1] !== null);
      const hasVBoard = (inBounds(p.row - 1, p.col) && board[p.row - 1][p.col] !== null) ||
                        (inBounds(p.row + 1, p.col) && board[p.row + 1][p.col] !== null);
      // If placed card has board neighbors in only one direction, lock to that direction
      if (hasHBoard && !hasVBoard && !sameRow) return false;
      if (hasVBoard && !hasHBoard && !sameCol) return false;
    }

    // Contiguity: no gaps allowed between placed cards (board cards can fill gaps)
    if (sameRow) {
      const r = allRows[0];
      const minC = Math.min(...allCols);
      const maxC = Math.max(...allCols);
      for (let c = minC; c <= maxC; c++) {
        if (c === col) continue; // the candidate itself
        if (!board[r][c] && !isPlacedThisTurn(r, c)) return false;
      }
    } else {
      const c = allCols[0];
      const minR = Math.min(...allRows);
      const maxR = Math.max(...allRows);
      for (let r = minR; r <= maxR; r++) {
        if (r === row) continue; // the candidate itself
        if (!board[r][c] && !isPlacedThisTurn(r, c)) return false;
      }
    }
  }

  // Check line lengths won't exceed 5
  if (getProjectedLineLength(row, col, 'horizontal') > CONFIG.MAX_LINE_LENGTH) return false;
  if (getProjectedLineLength(row, col, 'vertical') > CONFIG.MAX_LINE_LENGTH) return false;

  // No 2×2 filled squares (prevents L-shapes/corners)
  if (wouldCreate2x2(row, col)) return false;

  // Adjacency check: must be adjacent to an existing board card or a placed-this-turn card
  const hasAdjacentExisting = getAdjacentCells(row, col).some(n => board[n.row]?.[n.col] !== null);
  const hasAdjacentPlaced = getAdjacentCells(row, col).some(n => isPlacedThisTurn(n.row, n.col));
  if (!hasAdjacentExisting && !hasAdjacentPlaced) return false;

  return true;
}

function isValidTurnEnd() {
  const { placedThisTurn, turnNumber, board } = GameState;
  if (placedThisTurn.length === 0) return false;

  // At least one placed card must touch a pre-existing card (not placed this turn)
  const touchesExisting = placedThisTurn.some(p =>
    getAdjacentCells(p.row, p.col).some(n =>
      board[n.row]?.[n.col] !== null &&
      !placedThisTurn.some(pp => pp.row === n.row && pp.col === n.col)
    )
  );
  if (!touchesExisting) return false;

  // Check contiguity along the line (no gaps between placed cards, unless filled by board cards)
  if (placedThisTurn.length > 1) {
    const rows = placedThisTurn.map(p => p.row);
    const cols = placedThisTurn.map(p => p.col);
    const sameRow = new Set(rows).size === 1;
    const sameCol = new Set(cols).size === 1;

    if (sameRow) {
      const r = rows[0];
      const minC = Math.min(...cols);
      const maxC = Math.max(...cols);
      for (let c = minC; c <= maxC; c++) {
        if (!board[r][c] && !isPlacedThisTurn(r, c)) return false;
      }
    } else if (sameCol) {
      const c = cols[0];
      const minR = Math.min(...rows);
      const maxR = Math.max(...rows);
      for (let r = minR; r <= maxR; r++) {
        if (!board[r][c] && !isPlacedThisTurn(r, c)) return false;
      }
    }
  }

  return true;
}

function hasAnyValidPlacement() {
  // Clear placedThisTurn temporarily to check fresh placements
  const saved = GameState.placedThisTurn;
  GameState.placedThisTurn = [];
  for (let row = 0; row < CONFIG.BOARD_SIZE; row++) {
    for (let col = 0; col < CONFIG.BOARD_SIZE; col++) {
      if (isValidPlacement(row, col)) {
        GameState.placedThisTurn = saved;
        return true;
      }
    }
  }
  GameState.placedThisTurn = saved;
  return false;
}

// ═══════════════════════════════════════════
// SECTION: Line Detection
// ═══════════════════════════════════════════

function getCompleteLine(row, col, direction) {
  const board = GameState.board;
  const cells = [{ row, col }];
  const dr = direction === 'vertical' ? 1 : 0;
  const dc = direction === 'horizontal' ? 1 : 0;

  let r = row + dr, c = col + dc;
  while (inBounds(r, c) && board[r][c]) {
    cells.push({ row: r, col: c });
    r += dr; c += dc;
  }
  r = row - dr; c = col - dc;
  while (inBounds(r, c) && board[r][c]) {
    cells.unshift({ row: r, col: c });
    r -= dr; c -= dc;
  }
  return { cells, length: cells.length };
}

function detectNewHands() {
  const handsFound = [];
  const checkedLines = new Set();

  for (const { row, col } of GameState.placedThisTurn) {
    // Horizontal
    const hLine = getCompleteLine(row, col, 'horizontal');
    if (hLine.length === 5) {
      const hKey = `h-${hLine.cells[0].row}-${hLine.cells[0].col}`;
      if (!checkedLines.has(hKey)) {
        checkedLines.add(hKey);
        const cards = hLine.cells.map(c => GameState.board[c.row][c.col]);
        const result = classifyAndScore(cards);
        handsFound.push({ ...result, cells: hLine.cells, direction: 'horizontal' });
      }
    }

    // Vertical
    const vLine = getCompleteLine(row, col, 'vertical');
    if (vLine.length === 5) {
      const vKey = `v-${vLine.cells[0].row}-${vLine.cells[0].col}`;
      if (!checkedLines.has(vKey)) {
        checkedLines.add(vKey);
        const cards = vLine.cells.map(c => GameState.board[c.row][c.col]);
        const result = classifyAndScore(cards);
        handsFound.push({ ...result, cells: vLine.cells, direction: 'vertical' });
      }
    }
  }

  handsFound.sort((a, b) => b.points - a.points);
  return handsFound;
}

// ═══════════════════════════════════════════
// SECTION: Poker Hand Classification
// ═══════════════════════════════════════════

function getRankCounts(ranks) {
  const counts = {};
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
  return counts;
}

function checkStraight(sortedOrdinals) {
  if (sortedOrdinals.length !== 5) return false;
  const unique = [...new Set(sortedOrdinals)];
  if (unique.length !== 5) return false;

  const isConsecutive = unique.every((v, i) => i === 0 || v === unique[i - 1] + 1);
  if (isConsecutive) return true;

  // Ace-low: [2,3,4,5,14] → treat Ace as 1
  if (unique[4] === 14 && unique[0] === 2 && unique[1] === 3 && unique[2] === 4 && unique[3] === 5) {
    return true;
  }
  return false;
}

function classifyAndScore(cards) {
  const jokerIndices = [];
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].isJoker) jokerIndices.push(i);
  }

  if (jokerIndices.length === 0) {
    return classifyConcrete(cards);
  }

  // Brute-force best joker assignment
  let best = { handType: 'SINGLETONS', points: 0 };

  if (jokerIndices.length === 1) {
    const ji = jokerIndices[0];
    for (const sub of ALL_CARD_SUBS) {
      const testCards = cards.map((c, i) =>
        i === ji
          ? { rank: sub.rank, suit: sub.suit, isJoker: true, jokerAs: sub, id: c.id }
          : c
      );
      const result = classifyConcrete(testCards);
      if (result.points > best.points) {
        best = result;
        best.jokerAssignments = [{ index: ji, as: sub }];
      }
    }
  } else if (jokerIndices.length === 2) {
    const ji0 = jokerIndices[0];
    const ji1 = jokerIndices[1];
    for (const sub1 of ALL_CARD_SUBS) {
      for (const sub2 of ALL_CARD_SUBS) {
        const testCards = cards.map((c, i) => {
          if (i === ji0) return { rank: sub1.rank, suit: sub1.suit, isJoker: true, jokerAs: sub1, id: c.id };
          if (i === ji1) return { rank: sub2.rank, suit: sub2.suit, isJoker: true, jokerAs: sub2, id: c.id };
          return c;
        });
        const result = classifyConcrete(testCards);
        if (result.points > best.points) {
          best = result;
          best.jokerAssignments = [{ index: ji0, as: sub1 }, { index: ji1, as: sub2 }];
        }
      }
    }
  }

  return best;
}

function classifyConcrete(cards) {
  const ranks = cards.map(c => c.jokerAs ? c.jokerAs.rank : c.rank);
  const suits = cards.map(c => c.jokerAs ? c.jokerAs.suit : c.suit);
  const ordinals = ranks.map(r => RANK_ORDINALS[r]).sort((a, b) => a - b);
  const isFlush = new Set(suits).size === 1;
  const isStraight = checkStraight(ordinals);
  const rankCounts = getRankCounts(ranks);
  const maxCount = Math.max(...Object.values(rankCounts));
  const pairCount = Object.values(rankCounts).filter(v => v === 2).length;
  const rankSet = new Set(ranks);

  // Bespoke checks first
  if (rankCounts['A'] === 5 && cards.some(c => c.isJoker)) {
    return scoreHand('QUINT_ACES', cards);
  }
  if (maxCount === 5 && cards.some(c => c.isJoker)) {
    return scoreHand('QUINTS', cards);
  }
  if (isFlush && isStraight && rankSet.has('A') && rankSet.has('K') && rankSet.has('Q') && rankSet.has('J') && rankSet.has('10')) {
    return scoreHand('ROYAL_FLUSH', cards);
  }
  if (isFlush && rankSet.has('A') && rankSet.has('2') && rankSet.has('3') && rankSet.has('4') && rankSet.has('5')) {
    return scoreHand('STEEL_WHEEL', cards);
  }
  if (rankCounts['A'] === 4 && !cards.some(c => c.isJoker)) {
    return scoreHand('QUAD_ACES', cards);
  }
  if (rankCounts['2'] === 4 && !cards.some(c => c.isJoker && c.jokerAs?.rank === '2')) {
    return scoreHand('QUAD_DEUCES', cards);
  }

  // Standard hands
  if (isFlush && isStraight) return scoreHand('STRAIGHT_FLUSH', cards);
  if (maxCount === 4) return scoreHand('FOUR_OF_A_KIND', cards);
  if (maxCount === 3 && pairCount === 1) return scoreHand('FULL_HOUSE', cards);
  if (isFlush) return scoreHand('FLUSH', cards);

  if (!isFlush && rankSet.has('A') && rankSet.has('K') && rankSet.has('Q') && rankSet.has('J') && rankSet.has('10')) {
    return scoreHand('BROADWAY', cards);
  }
  if (!isFlush && rankSet.has('A') && rankSet.has('2') && rankSet.has('3') && rankSet.has('4') && rankSet.has('5')) {
    return scoreHand('WHEEL', cards);
  }
  if (isStraight) return scoreHand('STRAIGHT', cards);
  if (maxCount === 3) return scoreHand('THREE_OF_A_KIND', cards);
  if (pairCount === 2) return scoreHand('TWO_PAIR', cards);
  if (pairCount === 1) return scoreHand('ONE_PAIR', cards);

  // Bespoke singletons
  if (rankSet.has('A') && rankSet.has('K') && rankSet.has('Q') && rankSet.has('J') && rankSet.has('9') && rankSet.size === 5) {
    return scoreHand('PAI_GOW', cards);
  }
  if (rankSet.has('2') && rankSet.has('3') && rankSet.has('4') && rankSet.has('5') && rankSet.has('7') && rankSet.size === 5) {
    return scoreHand('LOWBALL', cards);
  }

  return scoreHand('SINGLETONS', cards);
}

function scoreHand(handType, cards) {
  const config = HAND_SCORING[handType];
  const { points, breakdown } = calculateScore(handType, cards);
  return {
    handType,
    handName: config.name,
    points,
    breakdown,
    isBespoke: config.bespoke !== null,
    mult: config.mult,
    cards: cards.map(c => ({ ...c })),
  };
}

// ═══════════════════════════════════════════
// SECTION: Score Calculation
// ═══════════════════════════════════════════

function getCardValue(card) {
  if (card.isJoker && card.jokerAs) return CARD_VALUES[card.jokerAs.rank];
  return CARD_VALUES[card.rank];
}

function calculateScore(handType, cards) {
  const config = HAND_SCORING[handType];

  if (config.bespoke !== null) {
    return { points: config.bespoke, breakdown: `Bespoke: ${config.bespoke}` };
  }

  const cardValues = cards.map(getCardValue);
  const total = cardValues.reduce((a, b) => a + b, 0);

  switch (handType) {
    case 'FOUR_OF_A_KIND':
    case 'FULL_HOUSE':
    case 'FLUSH':
    case 'STRAIGHT':
    case 'STRAIGHT_FLUSH': {
      const pts = total * config.mult;
      return { points: pts, breakdown: `(${total}) \u00d7 ${config.mult} = ${pts}` };
    }
    case 'THREE_OF_A_KIND':
    case 'TWO_PAIR':
    case 'ONE_PAIR': {
      const patternType = handType === 'THREE_OF_A_KIND' ? 3 : handType === 'ONE_PAIR' ? 2 : 'twoPair';
      const { coreSum, singletonSum } = splitCoreAndSingletons(cardValues, cards, patternType);
      const pts = (coreSum * config.mult) + singletonSum;
      return { points: pts, breakdown: `(${coreSum}) \u00d7 ${config.mult} + ${singletonSum} = ${pts}` };
    }
    case 'SINGLETONS': {
      return { points: total, breakdown: `${total} \u00d7 1 = ${total}` };
    }
    default:
      return { points: 0, breakdown: 'Unknown' };
  }
}

function splitCoreAndSingletons(cardValues, cards, patternType) {
  const effectiveRanks = cards.map(c => {
    if (c.isJoker && c.jokerAs) return c.jokerAs.rank;
    return c.rank;
  });

  const rankCounts = {};
  effectiveRanks.forEach((r, i) => {
    if (!rankCounts[r]) rankCounts[r] = [];
    rankCounts[r].push(i);
  });

  const coreIndices = new Set();

  if (patternType === 3) {
    for (const [, indices] of Object.entries(rankCounts)) {
      if (indices.length >= 3) {
        indices.slice(0, 3).forEach(i => coreIndices.add(i));
        break;
      }
    }
  } else if (patternType === 2) {
    for (const [, indices] of Object.entries(rankCounts)) {
      if (indices.length >= 2) {
        indices.slice(0, 2).forEach(i => coreIndices.add(i));
        break;
      }
    }
  } else if (patternType === 'twoPair') {
    let pairsFound = 0;
    const sorted = Object.entries(rankCounts).sort((a, b) => CARD_VALUES[b[0]] - CARD_VALUES[a[0]]);
    for (const [, indices] of sorted) {
      if (indices.length >= 2 && pairsFound < 2) {
        indices.slice(0, 2).forEach(i => coreIndices.add(i));
        pairsFound++;
      }
    }
  }

  let coreSum = 0, singletonSum = 0;
  cardValues.forEach((val, i) => {
    if (coreIndices.has(i)) coreSum += val;
    else singletonSum += val;
  });

  return { coreSum, singletonSum };
}

// ═══════════════════════════════════════════
// SECTION: Game Init
// ═══════════════════════════════════════════

function initGame() {
  GameState.deck = shuffleDeck(createDeck());
  GameState.deckIndex = 0;
  GameState.board = createEmptyBoard();
  GameState.hand = [];
  GameState.score = 0;
  GameState.handsScored = [];
  GameState.turnNumber = 0;
  GameState.placedThisTurn = [];
  GameState.phase = 'PLACING';
  GameState.isAnimating = false;
  GameState.totalCardsPlaced = 0;

  // Pre-place a wild card at center (not from the deck)
  const centerWild = {
    rank: 'JOKER',
    suit: 'wild',
    id: GameState.nextCardId++,
    isJoker: true,
    jokerAs: null,
  };
  GameState.board[CONFIG.ANCHOR_ROW][CONFIG.ANCHOR_COL] = centerWild;

  GameState.hand = drawCards(CONFIG.HAND_SIZE);
}
