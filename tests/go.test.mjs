import test from "node:test";
import assert from "node:assert/strict";
import { BLACK, EMPTY, WHITE, boardKey, chooseAiMove, createBoard, findObviousDeadStones, getGroup, getLegalMoves, isOwnEye, playMove, scoreBoard } from "../games/go/engine.mjs";

test("creates supported empty boards", () => {
  for (const size of [9, 13, 19]) {
    const board = createBoard(size);
    assert.equal(board.length, size);
    assert.ok(board.every((row) => row.length === size && row.every((cell) => cell === EMPTY)));
  }
  assert.throws(() => createBoard(11), RangeError);
});

test("finds connected stones and shared liberties", () => {
  const board = createBoard(9);
  board[4][4] = BLACK; board[4][5] = BLACK;
  const group = getGroup(board, 4, 4);
  assert.equal(group.stones.length, 2);
  assert.equal(group.liberties.length, 6);
});

test("captures a surrounded stone", () => {
  const board = createBoard(9);
  board[1][1] = WHITE; board[0][1] = BLACK; board[1][0] = BLACK; board[2][1] = BLACK;
  const result = playMove(board, 1, 2, BLACK);
  assert.equal(result.legal, true);
  assert.deepEqual(result.captured, [[1, 1]]);
  assert.equal(result.board[1][1], EMPTY);
});

test("rejects suicide unless the move captures", () => {
  const board = createBoard(9);
  board[0][1] = WHITE; board[1][0] = WHITE; board[1][2] = WHITE; board[2][1] = WHITE;
  assert.equal(playMove(board, 1, 1, BLACK).legal, false);
  board[0][0] = BLACK; board[0][2] = BLACK; board[2][0] = BLACK; board[2][2] = BLACK;
  assert.equal(playMove(board, 1, 1, BLACK).legal, true);
});

test("enforces simple ko", () => {
  const board = createBoard(9);
  board[0][1] = BLACK; board[1][0] = BLACK; board[2][1] = BLACK;
  board[0][2] = WHITE; board[1][1] = WHITE; board[2][2] = WHITE; board[1][3] = WHITE;
  const before = boardKey(board);
  const capture = playMove(board, 1, 2, BLACK);
  assert.equal(capture.legal, true);
  assert.equal(capture.captured.length, 1);
  const recapture = playMove(capture.board, 1, 1, WHITE, before);
  assert.equal(recapture.legal, false);
});

test("scores stones, enclosed territory, and komi with Chinese area scoring", () => {
  const board = createBoard(9);
  board[0][1] = BLACK; board[1][0] = BLACK; board[1][2] = BLACK; board[2][1] = BLACK;
  board[6][7] = WHITE; board[7][6] = WHITE; board[7][8] = WHITE; board[8][7] = WHITE;
  const score = scoreBoard(board);
  assert.equal(score.blackTerritory, 2);
  assert.equal(score.whiteTerritory, 2);
  assert.equal(score.black, 6);
  assert.equal(score.white, 13.5);
  assert.equal(score.winner, WHITE);
});

test("removes agreed dead stones before area scoring", () => {
  const board = createBoard(9);
  board[0][1] = BLACK; board[1][0] = BLACK; board[1][1] = WHITE;
  const score = scoreBoard(board, 7.5, [[1, 1]]);
  assert.equal(score.whiteStones, 0);
  assert.equal(score.blackTerritory, 79);
});

test("AI passes instead of filling its own final eyes", () => {
  const board = createBoard(9).map((row) => row.map(() => WHITE));
  board[2][2] = EMPTY; board[6][6] = EMPTY;
  assert.equal(isOwnEye(board, 2, 2, WHITE), true);
  assert.equal(chooseAiMove(board, "hard", WHITE), null);
});

test("AI passes when the opponent has already passed", () => {
  const board = createBoard(9);
  assert.equal(chooseAiMove(board, "easy", WHITE, null, () => 0, { opponentPassed: true }), null);
});

test("AI returns legal moves for every size and difficulty", () => {
  for (const size of [9, 13, 19]) {
    const board = createBoard(size); board[Math.floor(size / 2)][Math.floor(size / 2)] = BLACK;
    for (const difficulty of ["easy", "medium", "hard"]) {
      const move = chooseAiMove(board, difficulty, WHITE, null, () => 0);
      assert.ok(move);
      assert.equal(playMove(board, ...move, WHITE).legal, true);
    }
  }
});

test("legal move generation excludes occupied and suicidal points", () => {
  const board = createBoard(9); board[0][1] = WHITE; board[1][0] = WHITE;
  const legal = getLegalMoves(board, BLACK);
  assert.equal(legal.some(([r, c]) => r === 0 && c === 0), false);
  assert.equal(legal.some(([r, c]) => r === 0 && c === 1), false);
});

test("finds a group that is clearly capturable in one move", () => {
  const board = createBoard(9);
  board[1][1] = WHITE; board[0][1] = BLACK; board[1][0] = BLACK; board[2][1] = BLACK;
  assert.deepEqual(findObviousDeadStones(board), ["1,1"]);
});

test("reports a tied score as a draw", () => {
  const score = scoreBoard(createBoard(9), 0);
  assert.equal(score.winner, null);
  assert.equal(score.margin, 0);
});
