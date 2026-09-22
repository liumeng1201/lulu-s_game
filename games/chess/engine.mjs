export const BOARD_SIZE = 8;
export const WHITE = "w";
export const BLACK = "b";
export const EMPTY = null;

const BACK_RANK = ["R", "N", "B", "Q", "K", "B", "N", "R"];
const KNIGHT_STEPS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KING_STEPS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const ORTHOGONAL = [[-1,0],[1,0],[0,-1],[0,1]];
const DIAGONAL = [[-1,-1],[-1,1],[1,-1],[1,1]];
const PIECE_VALUE = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20_000 };

export function createBoard() {
  return [BACK_RANK.map((piece) => `${BLACK}${piece}`), Array(BOARD_SIZE).fill(`${BLACK}P`), ...Array.from({ length: 4 }, () => Array(BOARD_SIZE).fill(EMPTY)), Array(BOARD_SIZE).fill(`${WHITE}P`), BACK_RANK.map((piece) => `${WHITE}${piece}`)];
}

export const initialPosition = () => ({ castling: "KQkq", enPassant: null });
export const otherColor = (color) => color === WHITE ? BLACK : WHITE;
export const colorOf = (piece) => piece?.[0] ?? null;
export const typeOf = (piece) => piece?.[1] ?? null;
export const cloneBoard = (board) => board.map((row) => [...row]);
export const isInside = (row, col) => row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
export const sameSquare = (left, right) => Boolean(left && right && left.row === right.row && left.col === right.col);
const isCapturable = (piece, color) => Boolean(piece && colorOf(piece) !== color && typeOf(piece) !== "K");

function move(fromRow, fromCol, toRow, toCol, extra = {}) {
  return { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol }, ...extra };
}

function slidingMoves(board, row, col, color, directions) {
  const moves = [];
  for (const [dr, dc] of directions) {
    let nextRow = row + dr; let nextCol = col + dc;
    while (isInside(nextRow, nextCol)) {
      const target = board[nextRow][nextCol];
      if (!target) moves.push(move(row, col, nextRow, nextCol));
      else {
        if (isCapturable(target, color)) moves.push(move(row, col, nextRow, nextCol));
        break;
      }
      nextRow += dr; nextCol += dc;
    }
  }
  return moves;
}

export function isSquareAttacked(board, row, col, byColor) {
  const pawnRow = row + (byColor === WHITE ? 1 : -1);
  for (const pawnCol of [col - 1, col + 1]) if (isInside(pawnRow, pawnCol) && board[pawnRow][pawnCol] === `${byColor}P`) return true;
  for (const [dr, dc] of KNIGHT_STEPS) if (board[row + dr]?.[col + dc] === `${byColor}N`) return true;
  for (const [dr, dc] of KING_STEPS) if (board[row + dr]?.[col + dc] === `${byColor}K`) return true;
  for (const [directions, types] of [[ORTHOGONAL, ["R", "Q"]], [DIAGONAL, ["B", "Q"]]]) {
    for (const [dr, dc] of directions) {
      let nextRow = row + dr; let nextCol = col + dc;
      while (isInside(nextRow, nextCol)) {
        const piece = board[nextRow][nextCol];
        if (piece) { if (colorOf(piece) === byColor && types.includes(typeOf(piece))) return true; break; }
        nextRow += dr; nextCol += dc;
      }
    }
  }
  return false;
}

export function findKing(board, color) {
  for (let row = 0; row < BOARD_SIZE; row += 1) for (let col = 0; col < BOARD_SIZE; col += 1) if (board[row][col] === `${color}K`) return { row, col };
  return null;
}

export function isInCheck(board, color) {
  const king = findKing(board, color);
  return !king || isSquareAttacked(board, king.row, king.col, otherColor(color));
}

export function generatePseudoMoves(board, position, row, col) {
  const piece = board[row]?.[col];
  if (!piece) return [];
  const color = colorOf(piece); const type = typeOf(piece); const moves = [];
  if (type === "P") {
    const direction = color === WHITE ? -1 : 1; const startRow = color === WHITE ? 6 : 1; const promotionRow = color === WHITE ? 0 : 7;
    const oneRow = row + direction;
    if (isInside(oneRow, col) && !board[oneRow][col]) {
      moves.push(move(row, col, oneRow, col, oneRow === promotionRow ? { promotion: "Q" } : {}));
      const twoRow = row + direction * 2;
      if (row === startRow && !board[twoRow][col]) moves.push(move(row, col, twoRow, col, { doublePawn: true }));
    }
    for (const nextCol of [col - 1, col + 1]) {
      if (!isInside(oneRow, nextCol)) continue;
      const target = board[oneRow][nextCol];
      if (isCapturable(target, color)) moves.push(move(row, col, oneRow, nextCol, oneRow === promotionRow ? { promotion: "Q" } : {}));
      if (position.enPassant && position.enPassant.row === oneRow && position.enPassant.col === nextCol) moves.push(move(row, col, oneRow, nextCol, { enPassant: true }));
    }
  } else if (type === "N") {
    for (const [dr, dc] of KNIGHT_STEPS) { const nextRow = row + dr; const nextCol = col + dc; const target = board[nextRow]?.[nextCol]; if (isInside(nextRow, nextCol) && (!target || isCapturable(target, color))) moves.push(move(row, col, nextRow, nextCol)); }
  } else if (type === "B") moves.push(...slidingMoves(board, row, col, color, DIAGONAL));
  else if (type === "R") moves.push(...slidingMoves(board, row, col, color, ORTHOGONAL));
  else if (type === "Q") moves.push(...slidingMoves(board, row, col, color, [...ORTHOGONAL, ...DIAGONAL]));
  else if (type === "K") {
    for (const [dr, dc] of KING_STEPS) { const nextRow = row + dr; const nextCol = col + dc; const target = board[nextRow]?.[nextCol]; if (isInside(nextRow, nextCol) && (!target || isCapturable(target, color))) moves.push(move(row, col, nextRow, nextCol)); }
    const homeRow = color === WHITE ? 7 : 0; const enemy = otherColor(color);
    if (row === homeRow && col === 4 && !isInCheck(board, color)) {
      const kingSide = color === WHITE ? "K" : "k"; const queenSide = color === WHITE ? "Q" : "q";
      if (position.castling.includes(kingSide) && board[homeRow][7] === `${color}R` && !board[homeRow][5] && !board[homeRow][6] && !isSquareAttacked(board, homeRow, 5, enemy) && !isSquareAttacked(board, homeRow, 6, enemy)) moves.push(move(row, col, homeRow, 6, { castle: "king" }));
      if (position.castling.includes(queenSide) && board[homeRow][0] === `${color}R` && !board[homeRow][1] && !board[homeRow][2] && !board[homeRow][3] && !isSquareAttacked(board, homeRow, 3, enemy) && !isSquareAttacked(board, homeRow, 2, enemy)) moves.push(move(row, col, homeRow, 2, { castle: "queen" }));
    }
  }
  return moves;
}

function removeCastling(rights, values) { return [...rights].filter((value) => !values.includes(value)).join(""); }

export function applyMove(board, position, selectedMove) {
  const nextBoard = cloneBoard(board); const nextPosition = { castling: position.castling, enPassant: null };
  const { from, to } = selectedMove; const piece = nextBoard[from.row][from.col]; const color = colorOf(piece); const type = typeOf(piece);
  let captured = nextBoard[to.row][to.col];
  nextBoard[from.row][from.col] = EMPTY;
  if (selectedMove.enPassant) { const capturedRow = to.row + (color === WHITE ? 1 : -1); captured = nextBoard[capturedRow][to.col]; nextBoard[capturedRow][to.col] = EMPTY; }
  nextBoard[to.row][to.col] = type === "P" && (to.row === 0 || to.row === 7) ? `${color}${selectedMove.promotion ?? "Q"}` : piece;
  if (selectedMove.castle === "king") { nextBoard[to.row][5] = nextBoard[to.row][7]; nextBoard[to.row][7] = EMPTY; }
  if (selectedMove.castle === "queen") { nextBoard[to.row][3] = nextBoard[to.row][0]; nextBoard[to.row][0] = EMPTY; }
  if (type === "K") nextPosition.castling = removeCastling(nextPosition.castling, color === WHITE ? ["K", "Q"] : ["k", "q"]);
  if (type === "R") {
    if (from.row === 7 && from.col === 0) nextPosition.castling = removeCastling(nextPosition.castling, ["Q"]);
    if (from.row === 7 && from.col === 7) nextPosition.castling = removeCastling(nextPosition.castling, ["K"]);
    if (from.row === 0 && from.col === 0) nextPosition.castling = removeCastling(nextPosition.castling, ["q"]);
    if (from.row === 0 && from.col === 7) nextPosition.castling = removeCastling(nextPosition.castling, ["k"]);
  }
  if (captured === "wR") { if (to.row === 7 && to.col === 0) nextPosition.castling = removeCastling(nextPosition.castling, ["Q"]); if (to.row === 7 && to.col === 7) nextPosition.castling = removeCastling(nextPosition.castling, ["K"]); }
  if (captured === "bR") { if (to.row === 0 && to.col === 0) nextPosition.castling = removeCastling(nextPosition.castling, ["q"]); if (to.row === 0 && to.col === 7) nextPosition.castling = removeCastling(nextPosition.castling, ["k"]); }
  if (type === "P" && Math.abs(to.row - from.row) === 2) nextPosition.enPassant = { row: (from.row + to.row) / 2, col: from.col };
  return { board: nextBoard, position: nextPosition, captured };
}

export function generateLegalMoves(board, position, color) {
  const legal = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) for (let col = 0; col < BOARD_SIZE; col += 1) {
    if (colorOf(board[row][col]) !== color) continue;
    for (const candidate of generatePseudoMoves(board, position, row, col)) {
      const result = applyMove(board, position, candidate);
      if (!isInCheck(result.board, color)) legal.push(candidate);
    }
  }
  return legal;
}

export function isInsufficientMaterial(board) {
  const pieces = [];
  board.forEach((line, row) => line.forEach((piece, col) => { if (piece && typeOf(piece) !== "K") pieces.push({ piece, row, col }); }));
  if (!pieces.length) return true;
  if (pieces.length === 1 && ["B", "N"].includes(typeOf(pieces[0].piece))) return true;
  return pieces.every(({ piece }) => typeOf(piece) === "B") && pieces.every(({ row, col }) => (row + col) % 2 === (pieces[0].row + pieces[0].col) % 2);
}

export function getGameStatus(board, position, color) {
  const legalMoves = generateLegalMoves(board, position, color); const check = isInCheck(board, color);
  if (!legalMoves.length) return check ? { finished: true, winner: otherColor(color), reason: "checkmate", check, legalMoves } : { finished: true, winner: null, reason: "stalemate", check, legalMoves };
  if (isInsufficientMaterial(board)) return { finished: true, winner: null, reason: "insufficient", check, legalMoves };
  return { finished: false, winner: null, reason: null, check, legalMoves };
}

function positionalBonus(piece, row, col) {
  const distance = Math.abs(3.5 - row) + Math.abs(3.5 - col);
  if (["N", "B", "Q"].includes(typeOf(piece))) return Math.round((7 - distance) * 4);
  if (typeOf(piece) === "P") return colorOf(piece) === WHITE ? (6 - row) * 7 : (row - 1) * 7;
  return 0;
}

export function evaluateBoard(board, color) {
  let total = 0;
  board.forEach((line, row) => line.forEach((piece, col) => { if (piece) { const value = PIECE_VALUE[typeOf(piece)] + positionalBonus(piece, row, col); total += colorOf(piece) === color ? value : -value; } }));
  return total;
}

function orderedMoves(board, position, color) {
  return generateLegalMoves(board, position, color).sort((left, right) => {
    const leftCapture = board[left.to.row][left.to.col] ? PIECE_VALUE[typeOf(board[left.to.row][left.to.col])] : left.enPassant ? PIECE_VALUE.P : 0;
    const rightCapture = board[right.to.row][right.to.col] ? PIECE_VALUE[typeOf(board[right.to.row][right.to.col])] : right.enPassant ? PIECE_VALUE.P : 0;
    return rightCapture - leftCapture + (right.promotion ? 800 : 0) - (left.promotion ? 800 : 0);
  });
}

function search(board, position, color, aiColor, depth, alpha, beta, deadline) {
  const status = getGameStatus(board, position, color);
  if (status.finished) return status.winner === aiColor ? 100_000 + depth : status.winner ? -100_000 - depth : 0;
  if (depth === 0 || performance.now() >= deadline) return evaluateBoard(board, aiColor);
  const maximize = color === aiColor; let best = maximize ? -Infinity : Infinity;
  for (const candidate of orderedMoves(board, position, color).slice(0, depth > 1 ? 16 : 24)) {
    const result = applyMove(board, position, candidate);
    const value = search(result.board, result.position, otherColor(color), aiColor, depth - 1, alpha, beta, deadline);
    if (maximize) { best = Math.max(best, value); alpha = Math.max(alpha, value); } else { best = Math.min(best, value); beta = Math.min(beta, value); }
    if (beta <= alpha || performance.now() >= deadline) break;
  }
  return best;
}

export function chooseAiMove(board, position, difficulty = "medium", color = BLACK, random = Math.random) {
  const moves = orderedMoves(board, position, color); if (!moves.length) return null;
  if (difficulty === "easy") return moves[Math.floor(random() * Math.min(moves.length, 10))];
  const depth = difficulty === "hard" ? 3 : 2; const deadline = performance.now() + (difficulty === "hard" ? 700 : 250);
  let bestMove = moves[0]; let bestValue = -Infinity;
  for (const candidate of moves.slice(0, difficulty === "hard" ? 18 : 14)) {
    const result = applyMove(board, position, candidate);
    const value = search(result.board, result.position, otherColor(color), color, depth - 1, -Infinity, Infinity, deadline);
    if (value > bestValue) { bestValue = value; bestMove = candidate; }
    if (performance.now() >= deadline) break;
  }
  return bestMove;
}

export function movesEqual(left, right) {
  return sameSquare(left?.from, right?.from) && sameSquare(left?.to, right?.to);
}
