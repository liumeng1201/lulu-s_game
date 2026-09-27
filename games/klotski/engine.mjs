export const ROWS = 5;
export const COLUMNS = 4;
export const MAX_LEVEL = 3;

const SCRAMBLE_LENGTH = [0, 0, 14, 26];

function piece(id, kind, row, column, width, height, label) {
  return { id, kind, row, column, width, height, label };
}

export function createClassicPieces() {
  return [
    piece("cao", "cao", 1, 1, 2, 2, "曹操"),
    piece("northwest", "general", 0, 0, 1, 2, "关羽"),
    piece("northeast", "general", 0, 3, 1, 2, "张飞"),
    piece("southwest", "general", 2, 0, 1, 2, "赵云"),
    piece("southeast", "general", 2, 3, 1, 2, "马超"),
    piece("guan-yu", "horizontal", 0, 1, 2, 1, "黄忠"),
    piece("soldier-west-center", "soldier", 3, 1, 1, 1, "兵"),
    piece("soldier-east-center", "soldier", 3, 2, 1, 1, "兵"),
    piece("soldier-southwest", "soldier", 4, 0, 1, 1, "兵"),
    piece("soldier-southeast", "soldier", 4, 3, 1, 1, "兵"),
  ];
}

function copyPieces(pieces) { return pieces.map((item) => ({ ...item })); }

function isInside(pieceItem, row, column) {
  return row >= 0 && column >= 0 && row + pieceItem.height <= ROWS && column + pieceItem.width <= COLUMNS;
}

function occupiedByOther(pieces, movingId, row, column) {
  return pieces.some((other) => other.id !== movingId
    && row >= other.row && row < other.row + other.height
    && column >= other.column && column < other.column + other.width);
}

export function canMovePiece(pieces, id, dx, dy) {
  if (!Number.isInteger(dx) || !Number.isInteger(dy) || (dx === 0 && dy === 0) || (dx !== 0 && dy !== 0)) return false;
  const moving = pieces.find((item) => item.id === id);
  if (!moving) return false;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const directionX = Math.sign(dx);
  const directionY = Math.sign(dy);
  for (let step = 1; step <= steps; step += 1) {
    const row = moving.row + directionY * step;
    const column = moving.column + directionX * step;
    if (!isInside(moving, row, column)) return false;
    for (let r = row; r < row + moving.height; r += 1) {
      for (let c = column; c < column + moving.width; c += 1) {
        if (occupiedByOther(pieces, id, r, c)) return false;
      }
    }
  }
  return true;
}

export function getLegalMoves(pieces) {
  const moves = [];
  for (const item of pieces) {
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (canMovePiece(pieces, item.id, dx, dy)) moves.push({ id: item.id, dx, dy });
    }
  }
  return moves;
}

export function isSolved(pieces) {
  const cao = pieces.find((item) => item.id === "cao");
  return Boolean(cao && cao.row === ROWS - cao.height && cao.column === 1);
}

function movePositions(pieces, id, dx, dy) {
  return pieces.map((item) => item.id === id ? { ...item, row: item.row + dy, column: item.column + dx } : { ...item });
}

function deterministicScramble(level) {
  const pieces = createClassicPieces();
  let seed = 9173 + level * 7919;
  let previous = null;
  const count = SCRAMBLE_LENGTH[level];
  for (let index = 0; index < count; index += 1) {
    const candidates = getLegalMoves(pieces).filter((candidate) => {
      if (previous && candidate.id === previous.id && candidate.dx === -previous.dx && candidate.dy === -previous.dy) return false;
      return !isSolved(movePositions(pieces, candidate.id, candidate.dx, candidate.dy));
    });
    if (!candidates.length) break;
    seed = (seed * 48271) % 2147483647;
    const chosen = candidates[seed % candidates.length];
    const moved = movePositions(pieces, chosen.id, chosen.dx, chosen.dy);
    pieces.splice(0, pieces.length, ...moved);
    previous = chosen;
  }
  return pieces;
}

export function createGame(level = 1) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) throw new RangeError("Unsupported Klotski level");
  return { level, pieces: level === 1 ? createClassicPieces() : deterministicScramble(level), moves: 0, history: [], status: "playing" };
}

export function movePiece(game, id, dx, dy) {
  if (game.status !== "playing" || !canMovePiece(game.pieces, id, dx, dy)) return game;
  const history = [...game.history, { pieces: copyPieces(game.pieces), moves: game.moves }].slice(-200);
  const pieces = movePositions(game.pieces, id, dx, dy);
  return { ...game, pieces, moves: game.moves + 1, history, status: isSolved(pieces) ? "won" : "playing" };
}

export function undoMove(game) {
  if (!game.history.length) return game;
  const previous = game.history.at(-1);
  return { ...game, pieces: copyPieces(previous.pieces), moves: previous.moves, history: game.history.slice(0, -1), status: "playing" };
}

export function restartGame(game) { return createGame(game.level); }
