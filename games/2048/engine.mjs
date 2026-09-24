export const SIZE = 4;
export const TARGET_TILE = 2048;
export const EMPTY = 0;

export function createBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
}

export function cloneBoard(board) {
  return board.map((row) => [...row]);
}

export function emptyCells(board) {
  const cells = [];
  board.forEach((row, r) => row.forEach((value, c) => {
    if (value === EMPTY) cells.push([r, c]);
  }));
  return cells;
}

export function spawnTile(board, random = Math.random) {
  const cells = emptyCells(board);
  if (!cells.length) return { board: cloneBoard(board), tile: null };
  const index = Math.min(cells.length - 1, Math.floor(random() * cells.length));
  const [row, col] = cells[index];
  const next = cloneBoard(board);
  const value = random() < 0.9 ? 2 : 4;
  next[row][col] = value;
  return { board: next, tile: { row, col, value } };
}

function mergeLine(line) {
  const compact = line.filter((value) => value !== EMPTY);
  const merged = [];
  let scoreGained = 0;
  for (let index = 0; index < compact.length; index += 1) {
    if (compact[index] === compact[index + 1]) {
      const value = compact[index] * 2;
      merged.push(value);
      scoreGained += value;
      index += 1;
    } else {
      merged.push(compact[index]);
    }
  }
  return { line: [...merged, ...Array(SIZE - merged.length).fill(EMPTY)], scoreGained };
}

function lineCoordinates(direction, index) {
  return Array.from({ length: SIZE }, (_, offset) => {
    if (direction === "left") return [index, offset];
    if (direction === "right") return [index, SIZE - 1 - offset];
    if (direction === "up") return [offset, index];
    return [SIZE - 1 - offset, index];
  });
}

export function moveBoard(board, direction) {
  if (!["left", "right", "up", "down"].includes(direction)) throw new RangeError("Unsupported move direction");
  const next = cloneBoard(board);
  let scoreGained = 0;
  for (let index = 0; index < SIZE; index += 1) {
    const coordinates = lineCoordinates(direction, index);
    const merged = mergeLine(coordinates.map(([row, col]) => board[row][col]));
    scoreGained += merged.scoreGained;
    coordinates.forEach(([row, col], offset) => { next[row][col] = merged.line[offset]; });
  }
  const moved = next.some((row, r) => row.some((value, c) => value !== board[r][c]));
  return { board: moved ? next : cloneBoard(board), moved, scoreGained };
}

export function hasWon(board) {
  return board.some((row) => row.some((value) => value >= TARGET_TILE));
}

export function hasMoves(board) {
  if (emptyCells(board).length) return true;
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (board[row][col] === board[row]?.[col + 1] || board[row][col] === board[row + 1]?.[col]) return true;
    }
  }
  return false;
}

export function highestTile(board) {
  return Math.max(0, ...board.flat());
}

export function createGame(random = Math.random) {
  let board = createBoard();
  board = spawnTile(board, random).board;
  board = spawnTile(board, random).board;
  return { board, score: 0, status: "playing" };
}

export function playTurn(game, direction, random = Math.random) {
  if (game.status !== "playing") return { game, moved: false, spawned: null, scoreGained: 0 };
  const result = moveBoard(game.board, direction);
  if (!result.moved) return { game, moved: false, spawned: null, scoreGained: 0 };
  const next = { ...game, board: result.board, score: game.score + result.scoreGained };
  if (hasWon(next.board)) next.status = "won";
  else {
    const spawn = spawnTile(next.board, random);
    next.board = spawn.board;
    if (!hasMoves(next.board)) next.status = "lost";
    return { game: next, moved: true, spawned: spawn.tile, scoreGained: result.scoreGained };
  }
  return { game: next, moved: true, spawned: null, scoreGained: result.scoreGained };
}
