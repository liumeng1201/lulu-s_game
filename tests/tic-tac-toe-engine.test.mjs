import test from "node:test";
import assert from "node:assert/strict";
import { O, X, EMPTY, checkWinner, chooseAiMove, createBoard, getOutcome } from "../games/tic-tac-toe/engine.mjs";

test("creates an empty 3 by 3 board", () => {
  assert.deepEqual(createBoard(), [[EMPTY, EMPTY, EMPTY], [EMPTY, EMPTY, EMPTY], [EMPTY, EMPTY, EMPTY]]);
});

test("detects rows, columns, and diagonals", () => {
  assert.equal(checkWinner([[X, X, X], [O, EMPTY, O], [EMPTY, EMPTY, EMPTY]]).winner, X);
  assert.equal(checkWinner([[O, X, EMPTY], [O, X, EMPTY], [O, EMPTY, X]]).winner, O);
  assert.equal(checkWinner([[X, O, EMPTY], [O, X, EMPTY], [EMPTY, EMPTY, X]]).winner, X);
});

test("detects a draw and ignores unfinished games", () => {
  const draw = [[X, O, X], [X, O, O], [O, X, X]];
  assert.deepEqual(getOutcome(draw), { winner: null, line: [] });
  assert.equal(getOutcome([[X, EMPTY, EMPTY], [EMPTY, O, EMPTY], [EMPTY, EMPTY, EMPTY]]), null);
});

test("AI takes a winning move and blocks the opponent", () => {
  const winning = [[O, O, EMPTY], [X, X, EMPTY], [EMPTY, EMPTY, EMPTY]];
  assert.deepEqual(chooseAiMove(winning, "easy", O, () => 0.9), [0, 2]);
  const blocking = [[X, X, EMPTY], [O, EMPTY, EMPTY], [EMPTY, EMPTY, EMPTY]];
  assert.deepEqual(chooseAiMove(blocking, "medium", O, () => 0), [0, 2]);
});

test("every AI difficulty returns an empty legal move", () => {
  const board = [[X, O, EMPTY], [EMPTY, X, EMPTY], [EMPTY, EMPTY, O]];
  for (const difficulty of ["easy", "medium", "hard"]) {
    const move = chooseAiMove(board, difficulty, O, () => 0);
    assert.equal(board[move[0]][move[1]], EMPTY);
  }
});

test("hard AI never loses against every legal first player move", () => {
  function canAiAvoidLoss(board, player) {
    const outcome = getOutcome(board);
    if (outcome) return outcome.winner !== X;
    const moves = board.flatMap((row, r) => row.map((cell, c) => cell === EMPTY ? [r, c] : null).filter(Boolean));
    if (player === X) return moves.every(([r, c]) => { board[r][c] = X; const safe = canAiAvoidLoss(board, O); board[r][c] = EMPTY; return safe; });
    const move = chooseAiMove(board, "hard", O);
    if (!move) return true;
    board[move[0]][move[1]] = O;
    const safe = canAiAvoidLoss(board, X);
    board[move[0]][move[1]] = EMPTY;
    return safe;
  }
  assert.equal(canAiAvoidLoss(createBoard(), X), true);
});
