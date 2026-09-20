export const BOARD_SIZE = 3;
export const EMPTY = 0;
export const X = 1;
export const O = 2;

const LINES = [
  [[0, 0], [0, 1], [0, 2]],
  [[1, 0], [1, 1], [1, 2]],
  [[2, 0], [2, 1], [2, 2]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 1], [1, 1], [2, 1]],
  [[0, 2], [1, 2], [2, 2]],
  [[0, 0], [1, 1], [2, 2]],
  [[0, 2], [1, 1], [2, 0]],
];

export function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
}

export function getAvailableMoves(board) {
  const moves = [];
  board.forEach((row, r) => row.forEach((cell, c) => {
    if (cell === EMPTY) moves.push([r, c]);
  }));
  return moves;
}

export function checkWinner(board) {
  for (const line of LINES) {
    const [first, second, third] = line;
    const value = board[first[0]]?.[first[1]];
    if (value && value === board[second[0]]?.[second[1]] && value === board[third[0]]?.[third[1]]) {
      return { winner: value, line };
    }
  }
  return null;
}

export function getOutcome(board) {
  const result = checkWinner(board);
  if (result) return result;
  if (!getAvailableMoves(board).length) return { winner: null, line: [] };
  return null;
}

function otherPlayer(player) {
  return player === X ? O : X;
}

function findTacticalMove(board, player) {
  for (const [row, col] of getAvailableMoves(board)) {
    board[row][col] = player;
    const won = checkWinner(board)?.winner === player;
    board[row][col] = EMPTY;
    if (won) return [row, col];
  }
  return null;
}

function centerFirst(moves) {
  return [...moves].sort(([ar, ac], [br, bc]) => {
    const a = Math.abs(ar - 1) + Math.abs(ac - 1);
    const b = Math.abs(br - 1) + Math.abs(bc - 1);
    return a - b;
  });
}

function minimax(board, player, aiPlayer, alpha, beta) {
  const outcome = getOutcome(board);
  if (outcome) {
    if (outcome.winner === aiPlayer) return 10;
    if (outcome.winner === null) return 0;
    return -10;
  }
  const maximizing = player === aiPlayer;
  let best = maximizing ? -Infinity : Infinity;
  for (const [row, col] of centerFirst(getAvailableMoves(board))) {
    board[row][col] = player;
    const score = minimax(board, otherPlayer(player), aiPlayer, alpha, beta);
    board[row][col] = EMPTY;
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

export function chooseAiMove(board, difficulty = "medium", aiPlayer = O, random = Math.random) {
  const moves = getAvailableMoves(board);
  if (!moves.length) return null;
  const win = findTacticalMove(board, aiPlayer);
  if (win) return win;
  const block = findTacticalMove(board, otherPlayer(aiPlayer));
  if (block) return block;
  if (difficulty === "easy") return moves[Math.floor(random() * moves.length)];
  if (difficulty === "medium") {
    const ranked = centerFirst(moves);
    const pool = ranked.slice(0, Math.min(3, ranked.length));
    return pool[Math.floor(random() * pool.length)];
  }
  let bestMove = moves[0];
  let bestScore = -Infinity;
  for (const [row, col] of centerFirst(moves)) {
    board[row][col] = aiPlayer;
    const score = minimax(board, otherPlayer(aiPlayer), aiPlayer, -Infinity, Infinity);
    board[row][col] = EMPTY;
    if (score > bestScore) { bestScore = score; bestMove = [row, col]; }
  }
  return bestMove;
}
