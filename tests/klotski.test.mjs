import test from "node:test";
import assert from "node:assert/strict";
import {
  COLUMNS, ROWS, canMovePiece, createClassicPieces, createGame, getLegalMoves,
  isSolved, movePiece, restartGame, undoMove,
} from "../games/klotski/engine.mjs";

function countOccupied(pieces) {
  const cells = new Set();
  for (const piece of pieces) {
    for (let row = piece.row; row < piece.row + piece.height; row += 1) {
      for (let column = piece.column; column < piece.column + piece.width; column += 1) cells.add(`${row}:${column}`);
    }
  }
  return cells.size;
}

test("creates the traditional 4 by 5 formation with ten pieces and two open cells", () => {
  const pieces = createClassicPieces();
  assert.equal(pieces.length, 10);
  assert.equal(countOccupied(pieces), ROWS * COLUMNS - 2);
  assert.equal(isSolved(pieces), false);
  assert.ok(getLegalMoves(pieces).length > 0);
});

test("preset levels are deterministic, distinct, and generated only by legal moves", () => {
  const classic = createGame(1);
  const second = createGame(2);
  const third = createGame(3);
  assert.deepEqual(second, createGame(2));
  assert.notDeepEqual(second.pieces, classic.pieces);
  assert.notDeepEqual(third.pieces, second.pieces);
  for (const game of [classic, second, third]) {
    assert.equal(countOccupied(game.pieces), ROWS * COLUMNS - 2);
    assert.ok(game.pieces.every((piece) => piece.row + piece.height <= ROWS && piece.column + piece.width <= COLUMNS));
    assert.ok(getLegalMoves(game.pieces).length > 0);
    assert.equal(game.moves, 0);
  }
});

test("blocks moves through occupied cells, off the board, and on two axes at once", () => {
  const pieces = createClassicPieces();
  assert.equal(canMovePiece(pieces, "cao", 0, -1), false);
  assert.equal(canMovePiece(pieces, "cao", -1, 0), false);
  assert.equal(canMovePiece(pieces, "cao", 1, 1), false);
  assert.equal(canMovePiece(pieces, "soldier-southwest", -1, 0), false);
  assert.equal(canMovePiece(pieces, "missing-piece", 0, 1), false);
  assert.equal(canMovePiece(pieces, "soldier-west-center", 0, 0), false);
});

test("moves slide through each clear intermediate cell and count one piece slide", () => {
  const game = createGame(1);
  const moved = movePiece(game, "soldier-west-center", 0, 1);
  assert.equal(moved.moves, 1);
  assert.equal(moved.pieces.find((item) => item.id === "soldier-west-center").row, 4);
  assert.equal(moved.history.length, 1);
  assert.equal(movePiece(game, "soldier-west-center", 0, 2), game);
});

test("supports undo and restart while retaining the selected preset level", () => {
  const game = createGame(2);
  const move = getLegalMoves(game.pieces)[0];
  const afterMove = movePiece(game, move.id, move.dx, move.dy);
  assert.equal(afterMove.moves, 1);
  assert.deepEqual(undoMove(afterMove), game);
  assert.deepEqual(restartGame(afterMove), createGame(2));
  assert.equal(undoMove(game), game);
});

test("recognizes Cao Cao reaching the centered bottom exit", () => {
  const game = {
    ...createGame(),
    pieces: [{ id: "cao", kind: "cao", row: 2, column: 1, width: 2, height: 2, label: "曹操" }],
  };
  assert.equal(isSolved(game.pieces), false);
  const won = movePiece(game, "cao", 0, 1);
  assert.equal(won.status, "won");
  assert.equal(isSolved(won.pieces), true);
  assert.equal(movePiece(won, "cao", 0, -1), won);
  assert.equal(undoMove(won).status, "playing");
});

test("rejects unsupported level identifiers", () => {
  assert.throws(() => createGame(0), RangeError);
  assert.throws(() => createGame(4), RangeError);
});
