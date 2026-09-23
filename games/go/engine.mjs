export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const BOARD_SIZES = [9, 13, 19];
export const DEFAULT_KOMI = 7.5;

const DIRECTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function createBoard(size = 9) {
  if (!BOARD_SIZES.includes(size)) throw new RangeError("Unsupported board size");
  return Array.from({ length: size }, () => Array(size).fill(EMPTY));
}

export function cloneBoard(board) {
  return board.map((row) => [...row]);
}

export function boardKey(board) {
  return board.map((row) => row.join("")).join("/");
}

function neighbors(board, row, col) {
  return DIRECTIONS.map(([dr, dc]) => [row + dr, col + dc])
    .filter(([r, c]) => r >= 0 && c >= 0 && r < board.length && c < board.length);
}

export function getGroup(board, row, col) {
  const color = board[row]?.[col];
  if (!color) return { stones: [], liberties: [] };
  const stones = [];
  const liberties = new Set();
  const seen = new Set([`${row},${col}`]);
  const stack = [[row, col]];
  while (stack.length) {
    const [r, c] = stack.pop();
    stones.push([r, c]);
    for (const [nr, nc] of neighbors(board, r, c)) {
      if (board[nr][nc] === EMPTY) liberties.add(`${nr},${nc}`);
      else if (board[nr][nc] === color && !seen.has(`${nr},${nc}`)) {
        seen.add(`${nr},${nc}`);
        stack.push([nr, nc]);
      }
    }
  }
  return { stones, liberties: [...liberties].map((point) => point.split(",").map(Number)) };
}

export function playMove(board, row, col, player, previousBoardKey = null) {
  if (player !== BLACK && player !== WHITE) return { legal: false, reason: "玩家无效" };
  if (!board[row]?.[col] && board[row]?.[col] !== EMPTY) return { legal: false, reason: "落点超出棋盘" };
  if (board[row][col] !== EMPTY) return { legal: false, reason: "这里已经有棋子" };
  const next = cloneBoard(board);
  next[row][col] = player;
  const opponent = player === BLACK ? WHITE : BLACK;
  const captured = [];
  for (const [nr, nc] of neighbors(next, row, col)) {
    if (next[nr][nc] !== opponent) continue;
    const group = getGroup(next, nr, nc);
    if (group.liberties.length === 0) {
      for (const [r, c] of group.stones) {
        next[r][c] = EMPTY;
        captured.push([r, c]);
      }
    }
  }
  if (getGroup(next, row, col).liberties.length === 0) return { legal: false, reason: "不能自杀落子" };
  if (previousBoardKey && boardKey(next) === previousBoardKey) return { legal: false, reason: "打劫：不能立即还原上一局面" };
  return { legal: true, board: next, captured, boardKey: boardKey(next) };
}

export function getLegalMoves(board, player, previousBoardKey = null) {
  const moves = [];
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      if (board[row][col] === EMPTY && playMove(board, row, col, player, previousBoardKey).legal) moves.push([row, col]);
    }
  }
  return moves;
}

export function findObviousDeadStones(board) {
  const dead = [];
  const seen = new Set();
  for (let row = 0; row < board.length; row += 1) for (let col = 0; col < board.length; col += 1) {
    if (!board[row][col] || seen.has(`${row},${col}`)) continue;
    const group = getGroup(board, row, col);
    group.stones.forEach(([r, c]) => seen.add(`${r},${c}`));
    if (group.liberties.length !== 1) continue;
    const [libertyRow, libertyCol] = group.liberties[0];
    const opponent = board[row][col] === BLACK ? WHITE : BLACK;
    const capture = playMove(board, libertyRow, libertyCol, opponent);
    if (capture.legal && capture.captured.length >= group.stones.length) group.stones.forEach(([r, c]) => dead.push(`${r},${c}`));
  }
  return dead;
}

function emptyRegion(board, startRow, startCol, visited) {
  const points = [];
  const borders = new Set();
  const stack = [[startRow, startCol]];
  visited.add(`${startRow},${startCol}`);
  while (stack.length) {
    const [row, col] = stack.pop();
    points.push([row, col]);
    for (const [nr, nc] of neighbors(board, row, col)) {
      const value = board[nr][nc];
      if (value === EMPTY && !visited.has(`${nr},${nc}`)) {
        visited.add(`${nr},${nc}`);
        stack.push([nr, nc]);
      } else if (value !== EMPTY) borders.add(value);
    }
  }
  return { points, borders };
}

export function scoreBoard(board, komi = DEFAULT_KOMI, deadStones = []) {
  const scoredBoard = cloneBoard(board);
  for (const point of deadStones) {
    const [row, col] = Array.isArray(point) ? point : point.split(",").map(Number);
    if (scoredBoard[row]?.[col]) scoredBoard[row][col] = EMPTY;
  }
  let blackStones = 0;
  let whiteStones = 0;
  let blackTerritory = 0;
  let whiteTerritory = 0;
  const visited = new Set();
  scoredBoard.forEach((line, row) => line.forEach((cell, col) => {
    if (cell === BLACK) blackStones += 1;
    else if (cell === WHITE) whiteStones += 1;
    else if (!visited.has(`${row},${col}`)) {
      const region = emptyRegion(scoredBoard, row, col, visited);
      if (region.borders.size === 1 && region.borders.has(BLACK)) blackTerritory += region.points.length;
      if (region.borders.size === 1 && region.borders.has(WHITE)) whiteTerritory += region.points.length;
    }
  }));
  const black = blackStones + blackTerritory;
  const white = whiteStones + whiteTerritory + komi;
  return {
    blackStones, whiteStones, blackTerritory, whiteTerritory, komi, black, white,
    winner: black > white ? BLACK : white > black ? WHITE : null,
    margin: Math.abs(black - white),
  };
}

function countAdjacent(board, row, col, player) {
  return neighbors(board, row, col).filter(([r, c]) => board[r][c] === player).length;
}

function moveValue(board, move, player, previousBoardKey) {
  const [row, col] = move;
  const result = playMove(board, row, col, player, previousBoardKey);
  if (!result.legal) return -Infinity;
  const opponent = player === BLACK ? WHITE : BLACK;
  const group = getGroup(result.board, row, col);
  const center = (board.length - 1) / 2;
  const centerBias = board.length - Math.hypot(row - center, col - center);
  const edgePenalty = Math.min(row, col, board.length - 1 - row, board.length - 1 - col) === 0 ? 3 : 0;
  const friendly = countAdjacent(board, row, col, player);
  const pressure = countAdjacent(board, row, col, opponent);
  return result.captured.length * 120 + group.liberties.length * 7 + friendly * 6 + pressure * 4 + centerBias - edgePenalty;
}

export function isOwnEye(board, row, col, player) {
  if (board[row]?.[col] !== EMPTY) return false;
  if (neighbors(board, row, col).some(([r, c]) => board[r][c] !== player)) return false;
  const diagonals = [[-1,-1],[-1,1],[1,-1],[1,1]];
  let hostileCorners = 0;
  let offBoardCorners = 0;
  for (const [dr, dc] of diagonals) {
    const value = board[row + dr]?.[col + dc];
    if (value === undefined) offBoardCorners += 1;
    else if (value !== player) hostileCorners += 1;
  }
  return offBoardCorners > 0 ? hostileCorners === 0 : hostileCorners <= 1;
}

export function chooseAiMove(board, difficulty = "medium", player = WHITE, previousBoardKey = null, random = Math.random, options = {}) {
  if (options.opponentPassed) return null;
  const moves = getLegalMoves(board, player, previousBoardKey);
  if (!moves.length) return null;
  const usefulMoves = moves.filter(([row, col]) => {
    if (!isOwnEye(board, row, col, player)) return true;
    return playMove(board, row, col, player, previousBoardKey).captured.length > 0;
  });
  if (!usefulMoves.length) return null;
  const ranked = usefulMoves.map((move) => ({ move, score: moveValue(board, move, player, previousBoardKey) }))
    .sort((a, b) => b.score - a.score);
  if (difficulty === "easy") {
    const pool = ranked.slice(0, Math.min(18, ranked.length));
    return pool[Math.floor(random() * pool.length)].move;
  }
  if (difficulty === "medium") {
    const pool = ranked.slice(0, Math.min(5, ranked.length));
    return pool[Math.floor(random() * pool.length * .7)].move;
  }
  const candidates = ranked.slice(0, Math.min(board.length === 19 ? 10 : 16, ranked.length));
  const deadline = performance.now() + (options.timeBudgetMs ?? 120);
  let best = candidates[0];
  for (const candidate of candidates) {
    const first = playMove(board, ...candidate.move, player, previousBoardKey);
    const opponent = player === BLACK ? WHITE : BLACK;
    const replies = getLegalMoves(first.board, opponent, boardKey(board))
      .map((move) => moveValue(first.board, move, opponent, boardKey(board)))
      .sort((a, b) => b - a);
    const replyThreat = replies[0] ?? 0;
    const value = candidate.score - replyThreat * .72;
    if (value > (best.value ?? -Infinity)) best = { ...candidate, value };
    if (performance.now() >= deadline) break;
  }
  return best.move;
}
