import test from "node:test";
import assert from "node:assert/strict";
import { BLACK, EMPTY, WHITE, checkWin, chooseAiMove, createBoard, getCandidates, isBoardFull } from "../games/gomoku/engine.mjs";

test("creates an empty 15 by 15 board", () => {
  const board = createBoard();
  assert.equal(board.length, 15);
  assert.ok(board.every((row) => row.length === 15 && row.every((cell) => cell === EMPTY)));
});

for (const [name, direction] of [["horizontal", [0,1]], ["vertical", [1,0]], ["diagonal", [1,1]], ["anti-diagonal", [1,-1]]]) {
  test(`detects a ${name} win`, () => {
    const board = createBoard();
    for (let step = 0; step < 5; step += 1) board[7 + direction[0] * step][7 + direction[1] * step] = BLACK;
    assert.equal(checkWin(board, 7, 7, BLACK).length, 5);
  });
}

test("does not report four stones as a win", () => {
  const board = createBoard();
  for (let col = 2; col < 6; col += 1) board[3][col] = WHITE;
  assert.equal(checkWin(board, 3, 4, WHITE), null);
});

test("detects a full board", () => {
  const board = createBoard(3).map((row, r) => row.map((_, c) => (r + c) % 2 ? BLACK : WHITE));
  assert.equal(isBoardFull(board), true);
  board[1][1] = EMPTY;
  assert.equal(isBoardFull(board), false);
});

test("uses the center as the first candidate", () => {
  assert.deepEqual(getCandidates(createBoard()), [[7, 7]]);
});

test("AI takes an immediate win at every difficulty", () => {
  for (const difficulty of ["easy", "medium", "hard"]) {
    const board = createBoard();
    for (let col = 4; col < 8; col += 1) board[6][col] = WHITE;
    const [row, col] = chooseAiMove(board, difficulty, WHITE, () => 0);
    board[row][col] = WHITE;
    assert.ok(checkWin(board, row, col, WHITE), `${difficulty} should finish five`);
  }
});

test("AI blocks an immediate player win", () => {
  const board = createBoard();
  for (let row = 3; row < 7; row += 1) board[row][9] = BLACK;
  const [row, col] = chooseAiMove(board, "medium", WHITE, () => 0);
  assert.ok((row === 2 || row === 7) && col === 9);
});

test("AI always chooses an empty candidate", () => {
  const board = createBoard();
  board[7][7] = BLACK;
  for (const difficulty of ["easy", "medium", "hard"]) {
    const move = chooseAiMove(board, difficulty, WHITE, () => .4);
    assert.equal(board[move[0]][move[1]], EMPTY);
  }
});
