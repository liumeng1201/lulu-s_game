export const BOARD_SIZE = 15;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

export function createBoard(size = BOARD_SIZE) {
  return Array.from({ length: size }, () => Array(size).fill(EMPTY));
}

export function checkWin(board, row, col, player) {
  if (!board[row]?.[col] || board[row][col] !== player) return null;
  for (const [dr, dc] of DIRECTIONS) {
    const line = [[row, col]];
    for (const sign of [-1, 1]) {
      for (let step = 1; step < 5; step += 1) {
        const r = row + dr * step * sign;
        const c = col + dc * step * sign;
        if (board[r]?.[c] !== player) break;
        sign < 0 ? line.unshift([r, c]) : line.push([r, c]);
      }
    }
    if (line.length >= 5) return line;
  }
  return null;
}

export function isBoardFull(board) {
  return board.every((row) => row.every(Boolean));
}

function countDirection(board, row, col, dr, dc, player) {
  let count = 0;
  let r = row + dr;
  let c = col + dc;
  while (board[r]?.[c] === player) {
    count += 1;
    r += dr;
    c += dc;
  }
  return { count, open: board[r]?.[c] === EMPTY };
}

export function scorePosition(board, row, col, player) {
  if (board[row][col] !== EMPTY) return -Infinity;
  let total = 0;
  board[row][col] = player;
  for (const [dr, dc] of DIRECTIONS) {
    const before = countDirection(board, row, col, -dr, -dc, player);
    const after = countDirection(board, row, col, dr, dc, player);
    const length = before.count + after.count + 1;
    const opens = Number(before.open) + Number(after.open);
    if (length >= 5) total += 1_000_000;
    else if (length === 4 && opens === 2) total += 100_000;
    else if (length === 4 && opens === 1) total += 20_000;
    else if (length === 3 && opens === 2) total += 8_000;
    else if (length === 3 && opens === 1) total += 1_000;
    else if (length === 2 && opens === 2) total += 400;
    else total += length * 12 + opens * 4;
  }
  board[row][col] = EMPTY;
  return total;
}

export function getCandidates(board, radius = 2) {
  const occupied = [];
  board.forEach((line, row) => line.forEach((cell, col) => {
    if (cell !== EMPTY) occupied.push([row, col]);
  }));
  if (!occupied.length) {
    const center = Math.floor(board.length / 2);
    return [[center, center]];
  }
  const candidates = new Set();
  for (const [row, col] of occupied) {
    for (let dr = -radius; dr <= radius; dr += 1) {
      for (let dc = -radius; dc <= radius; dc += 1) {
        const r = row + dr;
        const c = col + dc;
        if (board[r]?.[c] === EMPTY) candidates.add(`${r},${c}`);
      }
    }
  }
  return [...candidates].map((value) => value.split(",").map(Number));
}

function rankedCandidates(board, player, limit = 12) {
  const rival = player === BLACK ? WHITE : BLACK;
  const center = (board.length - 1) / 2;
  return getCandidates(board).map(([row, col]) => {
    const attack = scorePosition(board, row, col, player);
    const defense = scorePosition(board, row, col, rival);
    const centrality = board.length - Math.hypot(row - center, col - center);
    return { row, col, score: attack * 1.08 + defense + centrality };
  }).sort((a, b) => b.score - a.score).slice(0, limit);
}

function findForcedMove(board, player) {
  const rival = player === BLACK ? WHITE : BLACK;
  const candidates = getCandidates(board);
  for (const [row, col] of candidates) {
    if (scorePosition(board, row, col, player) >= 1_000_000) return [row, col];
  }
  for (const [row, col] of candidates) {
    if (scorePosition(board, row, col, rival) >= 1_000_000) return [row, col];
  }
  return null;
}

function evaluateBoard(board, player) {
  const rival = player === BLACK ? WHITE : BLACK;
  const candidates = getCandidates(board);
  let attack = 0;
  let defense = 0;
  for (const [row, col] of candidates) {
    attack = Math.max(attack, scorePosition(board, row, col, player));
    defense = Math.max(defense, scorePosition(board, row, col, rival));
  }
  return attack - defense * 1.08;
}

function minimax(board, depth, alpha, beta, maximizing, aiPlayer, deadline) {
  if (depth === 0 || performance.now() >= deadline) return evaluateBoard(board, aiPlayer);
  const player = maximizing ? aiPlayer : (aiPlayer === BLACK ? WHITE : BLACK);
  const moves = rankedCandidates(board, player, depth > 1 ? 8 : 10);
  let best = maximizing ? -Infinity : Infinity;
  for (const { row, col } of moves) {
    board[row][col] = player;
    const won = checkWin(board, row, col, player);
    const value = won
      ? (maximizing ? 10_000_000 + depth : -10_000_000 - depth)
      : minimax(board, depth - 1, alpha, beta, !maximizing, aiPlayer, deadline);
    board[row][col] = EMPTY;
    if (maximizing) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, value);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, value);
    }
    if (beta <= alpha || performance.now() >= deadline) break;
  }
  return best;
}

export function chooseAiMove(board, difficulty = "medium", player = WHITE, random = Math.random) {
  const forced = findForcedMove(board, player);
  if (forced) return forced;
  const ranked = rankedCandidates(board, player, difficulty === "hard" ? 10 : 16);
  if (!ranked.length) return null;
  if (difficulty === "easy") {
    const pool = ranked.slice(0, Math.min(8, ranked.length));
    const choice = pool[Math.floor(random() * pool.length)];
    return [choice.row, choice.col];
  }
  if (difficulty === "medium") {
    const pool = ranked.slice(0, Math.min(3, ranked.length));
    const choice = pool[Math.floor(random() * pool.length * 0.65)];
    return [choice.row, choice.col];
  }
  const deadline = performance.now() + 550;
  let best = ranked[0];
  let bestValue = -Infinity;
  for (const move of ranked) {
    board[move.row][move.col] = player;
    const value = minimax(board, 2, -Infinity, Infinity, false, player, deadline);
    board[move.row][move.col] = EMPTY;
    if (value > bestValue) {
      bestValue = value;
      best = move;
    }
    if (performance.now() >= deadline) break;
  }
  return [best.row, best.col];
}
