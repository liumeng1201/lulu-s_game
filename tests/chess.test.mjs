import test from "node:test";
import assert from "node:assert/strict";
import { BLACK, EMPTY, WHITE, applyMove, chooseAiMove, createBoard, generateLegalMoves, getGameStatus, initialPosition, isInCheck, isInsufficientMaterial, movesEqual } from "../games/chess/engine.mjs";
import { validateChessSave } from "../games/chess/save-state.mjs";

const emptyBoard = () => Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
const findMove = (board, position, color, from, to) => generateLegalMoves(board, position, color).find((move) => move.from.row === from[0] && move.from.col === from[1] && move.to.row === to[0] && move.to.col === to[1]);

test("creates the standard chess opening position", () => {
  const board = createBoard();
  assert.equal(board[0].join(""), "bRbNbBbQbKbBbNbR");
  assert.equal(board[7].join(""), "wRwNwBwQwKwBwNwR");
  assert.equal(generateLegalMoves(board, initialPosition(), WHITE).length, 20);
});

test("allows a pawn double step only from its initial rank", () => {
  const board = createBoard(); const position = initialPosition();
  assert.ok(findMove(board, position, WHITE, [6, 4], [4, 4]));
  const result = applyMove(board, position, findMove(board, position, WHITE, [6, 4], [4, 4]));
  assert.deepEqual(result.position.enPassant, { row: 5, col: 4 });
  assert.equal(findMove(result.board, result.position, WHITE, [4, 4], [2, 4]), undefined);
});

test("does not permit a pinned piece to expose its king", () => {
  const board = emptyBoard(); board[7][4] = "wK"; board[6][4] = "wR"; board[0][4] = "bR"; board[0][0] = "bK";
  assert.equal(isInCheck(board, WHITE), false);
  assert.equal(findMove(board, initialPosition(), WHITE, [6, 4], [6, 3]), undefined);
  assert.ok(findMove(board, initialPosition(), WHITE, [6, 4], [0, 4]));
});

test("ends with checkmate instead of allowing a king capture", () => {
  const board = emptyBoard(); board[7][4] = "wK"; board[1][4] = "wQ"; board[0][4] = "bK";
  assert.equal(findMove(board, initialPosition(), WHITE, [1, 4], [0, 4]), undefined);
});

test("supports king-side castling when path and attacked squares are clear", () => {
  const board = emptyBoard(); board[7][4] = "wK"; board[7][7] = "wR"; board[0][4] = "bK";
  const castle = findMove(board, initialPosition(), WHITE, [7, 4], [7, 6]);
  assert.equal(castle.castle, "king");
  const result = applyMove(board, initialPosition(), castle);
  assert.equal(result.board[7][6], "wK"); assert.equal(result.board[7][5], "wR"); assert.equal(result.position.castling.includes("K"), false);
});

test("supports en passant on the immediately following turn", () => {
  const board = emptyBoard(); board[7][4] = "wK"; board[0][4] = "bK"; board[3][4] = "wP"; board[1][3] = "bP";
  const blackDouble = findMove(board, initialPosition(), BLACK, [1, 3], [3, 3]); const afterDouble = applyMove(board, initialPosition(), blackDouble);
  const capture = findMove(afterDouble.board, afterDouble.position, WHITE, [3, 4], [2, 3]);
  assert.equal(capture.enPassant, true);
  const afterCapture = applyMove(afterDouble.board, afterDouble.position, capture);
  assert.equal(afterCapture.board[3][3], EMPTY); assert.equal(afterCapture.board[2][3], "wP");
});

test("allows all promotion choices", () => {
  const board = emptyBoard(); board[7][7] = "wK"; board[0][7] = "bK"; board[1][0] = "wP";
  const promotion = findMove(board, initialPosition(), WHITE, [1, 0], [0, 0]);
  const result = applyMove(board, initialPosition(), { ...promotion, promotion: "N" });
  assert.equal(result.board[0][0], "wN");
});

test("detects checkmate, stalemate, and insufficient material", () => {
  const mate = emptyBoard(); mate[0][7] = "bK"; mate[1][6] = "wQ"; mate[2][5] = "wK";
  assert.deepEqual(getGameStatus(mate, initialPosition(), BLACK).reason, "checkmate");
  const stalemate = emptyBoard(); stalemate[0][7] = "bK"; stalemate[1][5] = "wQ"; stalemate[2][5] = "wK";
  assert.equal(getGameStatus(stalemate, initialPosition(), BLACK).reason, "stalemate");
  const kings = emptyBoard(); kings[0][0] = "bK"; kings[7][7] = "wK"; assert.equal(isInsufficientMaterial(kings), true);
});

test("AI always returns a legal move", () => {
  const board = createBoard(); const position = initialPosition();
  const opening = findMove(board, position, WHITE, [6, 4], [4, 4]); const afterOpening = applyMove(board, position, opening);
  for (const difficulty of ["easy", "medium", "hard"]) {
    const move = chooseAiMove(afterOpening.board, afterOpening.position, difficulty, BLACK, () => 0);
    assert.ok(generateLegalMoves(afterOpening.board, afterOpening.position, BLACK).some((candidate) => movesEqual(candidate, move)));
  }
});

test("validates a saved legal history and rejects an illegal one", () => {
  const board = createBoard(); const position = initialPosition(); const first = findMove(board, position, WHITE, [6, 4], [4, 4]); const applied = applyMove(board, position, first);
  const valid = { version: 1, mode: "pvp", difficulty: "medium", board: applied.board, position: applied.position, currentPlayer: BLACK, history: [first], running: true, winner: null, reason: null, soundOn: true, cursor: { row: 4, col: 4 }, modeOpen: false, resultOpen: false };
  assert.ok(validateChessSave(valid));
  assert.equal(validateChessSave({ ...valid, history: [{ from: { row: 4, col: 4 }, to: { row: 3, col: 4 } }] }), null);
});
