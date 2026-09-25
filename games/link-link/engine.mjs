export const BOARD_SIZE = 8;
export const ICON_COUNT = 32;
export const PAIR_COUNT = BOARD_SIZE * BOARD_SIZE / 2;
export const ROUND_DURATION_MS = 5 * 60 * 1000;
export const STARTING_HINTS = 3;

const DIRECTIONS = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
];

export function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

export function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function randomIndex(length, random) {
  return Math.max(0, Math.min(length - 1, Math.floor(random() * length)));
}

function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = randomIndex(index + 1, random);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function cellIndex(row, col) {
  return row * BOARD_SIZE + col;
}

export function indexToCell(index) {
  return { row: Math.floor(index / BOARD_SIZE), col: index % BOARD_SIZE };
}

export function findConnectionPath(board, startIndex, endIndex) {
  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)
    || startIndex < 0 || startIndex >= BOARD_SIZE ** 2
    || endIndex < 0 || endIndex >= BOARD_SIZE ** 2 || startIndex === endIndex) return null;
  const start = indexToCell(startIndex);
  const end = indexToCell(endIndex);
  const tile = board[start.row]?.[start.col];
  if (tile == null || board[end.row]?.[end.col] !== tile) return null;

  const queue = [{ ...start, direction: -1, turns: 0, path: [start] }];
  const visited = new Set([`${start.row},${start.col},-1,0`]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    for (let direction = 0; direction < DIRECTIONS.length; direction += 1) {
      const [rowStep, colStep] = DIRECTIONS[direction];
      const row = current.row + rowStep;
      const col = current.col + colStep;
      const turns = current.turns + (current.direction !== -1 && current.direction !== direction ? 1 : 0);
      if (row < -1 || row > BOARD_SIZE || col < -1 || col > BOARD_SIZE || turns > 2) continue;
      const atDestination = row === end.row && col === end.col;
      const insideBoard = row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
      if (insideBoard && !atDestination && board[row][col] !== null) continue;
      const path = [...current.path, { row, col }];
      if (atDestination) return path;
      const key = `${row},${col},${direction},${turns}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ row, col, direction, turns, path });
    }
  }
  return null;
}

export function findAvailablePair(board) {
  const positions = new Map();
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const tile = board[row][col];
      if (tile === null) continue;
      if (!positions.has(tile)) positions.set(tile, []);
      positions.get(tile).push(cellIndex(row, col));
    }
  }
  for (const pair of positions.values()) {
    if (pair.length === 2) {
      const path = findConnectionPath(board, pair[0], pair[1]);
      if (path) return { first: pair[0], second: pair[1], path };
    }
  }
  return null;
}

function fallbackPlayableBoard(board) {
  const values = board.flat().filter((tile) => tile !== null);
  if (values.length < 2) return createEmptyBoard();
  const pairTile = values[0];
  const remaining = [];
  let removed = 0;
  for (const value of values) {
    if (value === pairTile && removed < 2) removed += 1;
    else remaining.push(value);
  }
  const result = createEmptyBoard();
  result[0][0] = pairTile;
  result[0][1] = pairTile;
  let offset = 0;
  for (let index = 2; index < BOARD_SIZE ** 2 && offset < remaining.length; index += 1) {
    const { row, col } = indexToCell(index);
    result[row][col] = remaining[offset];
    offset += 1;
  }
  return result;
}

export function shuffleRemaining(board, random = Math.random) {
  const positions = [];
  const values = [];
  board.forEach((row, r) => row.forEach((tile, c) => {
    if (tile !== null) {
      positions.push([r, c]);
      values.push(tile);
    }
  }));
  if (values.length < 2) return { board: cloneBoard(board), autoShuffled: false };

  for (let attempt = 0; attempt < 64; attempt += 1) {
    const shuffledValues = shuffle(values, random);
    const next = createEmptyBoard();
    positions.forEach(([row, col], index) => { next[row][col] = shuffledValues[index]; });
    if (findAvailablePair(next)) return { board: next, autoShuffled: false };
  }
  const next = fallbackPlayableBoard(board);
  return { board: next, autoShuffled: true };
}

export function createGame(random = Math.random) {
  const tiles = Array.from({ length: ICON_COUNT }, (_, icon) => [icon, icon]).flat();
  const board = createEmptyBoard();
  shuffle(tiles, random).forEach((tile, index) => {
    const { row, col } = indexToCell(index);
    board[row][col] = tile;
  });
  const playable = findAvailablePair(board) ? board : shuffleRemaining(board, random).board;
  return {
    board: playable,
    status: "playing",
    remainingMs: ROUND_DURATION_MS,
    selected: null,
    hintsLeft: STARTING_HINTS,
    matches: 0,
    mistakes: 0,
    pauseReason: null,
  };
}

export function selectTile(game, index, random = Math.random) {
  if (game.status !== "playing" || !Number.isInteger(index) || index < 0 || index >= BOARD_SIZE ** 2) {
    return { game, matched: false, path: null, autoShuffled: false, changed: false };
  }
  const { row, col } = indexToCell(index);
  if (game.board[row][col] === null) return { game, matched: false, path: null, autoShuffled: false, changed: false };
  if (game.selected === null) {
    return { game: { ...game, selected: index }, matched: false, path: null, autoShuffled: false, changed: true };
  }
  if (game.selected === index) {
    return { game: { ...game, selected: null }, matched: false, path: null, autoShuffled: false, changed: true };
  }

  const first = game.selected;
  const firstCell = indexToCell(first);
  const path = game.board[row][col] === game.board[firstCell.row]?.[firstCell.col]
    ? findConnectionPath(game.board, first, index) : null;
  if (!path) {
    return { game: { ...game, selected: index, mistakes: game.mistakes + 1 }, matched: false, path: null, autoShuffled: false, changed: true };
  }

  const board = cloneBoard(game.board);
  for (const tileIndex of [first, index]) {
    const cell = indexToCell(tileIndex);
    board[cell.row][cell.col] = null;
  }
  const next = { ...game, board, selected: null, matches: game.matches + 1 };
  if (next.matches === BOARD_SIZE ** 2 / 2) next.status = "won";
  let autoShuffled = false;
  if (next.status === "playing" && !findAvailablePair(board)) {
    const result = shuffleRemaining(board, random);
    next.board = result.board;
    autoShuffled = true;
  }
  return { game: next, matched: true, path, autoShuffled, changed: true };
}

export function useHint(game) {
  if (game.status !== "playing" || game.hintsLeft <= 0) return { game, pair: null };
  const pair = findAvailablePair(game.board);
  if (!pair) return { game, pair: null };
  return { game: { ...game, hintsLeft: game.hintsLeft - 1 }, pair: [pair.first, pair.second] };
}

export function advanceTimer(game, elapsedMs) {
  if (game.status !== "playing" || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return game;
  const remainingMs = Math.max(0, Math.ceil(game.remainingMs - elapsedMs));
  return { ...game, remainingMs, status: remainingMs === 0 ? "lost" : "playing", selected: remainingMs === 0 ? null : game.selected };
}

export function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
