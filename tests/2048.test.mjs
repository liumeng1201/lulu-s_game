import test from "node:test";
import assert from "node:assert/strict";
import { createBoard, createGame, hasMoves, moveBoard, playTurn, spawnTile } from "../games/2048/engine.mjs";

test("creates a 4 by 4 game with two starting tiles", () => {
  const game = createGame(() => 0);
  assert.equal(game.board.length, 4);
  assert.equal(game.board.flat().filter(Boolean).length, 2);
  assert.equal(game.score, 0);
  assert.equal(game.status, "playing");
});

test("moves and merges in every direction", () => {
  const board = createBoard();
  board[0] = [0, 2, 2, 4];
  board[1] = [4, 0, 0, 4];
  board[2][0] = 2; board[3][0] = 2;
  board[0][3] = 8; board[1][3] = 8;

  assert.deepEqual(moveBoard(board, "left").board[0], [4, 8, 0, 0]);
  assert.deepEqual(moveBoard(board, "right").board[1], [0, 0, 4, 8]);
  assert.deepEqual(moveBoard(board, "up").board.map((row) => row[0]), [4, 4, 0, 0]);
  assert.deepEqual(moveBoard(board, "down").board.map((row) => row[3]), [0, 0, 0, 16]);
});

test("a tile can merge only once during one move", () => {
  const board = createBoard();
  board[0] = [2, 2, 2, 2];
  const result = moveBoard(board, "left");
  assert.deepEqual(result.board[0], [4, 4, 0, 0]);
  assert.equal(result.scoreGained, 8);
});

test("does not spawn or score for an ineffective move", () => {
  const board = createBoard();
  board[0][0] = 2;
  let randomCalls = 0;
  const result = playTurn({ board, score: 7, status: "playing" }, "left", () => { randomCalls += 1; return 0; });
  assert.equal(result.moved, false);
  assert.equal(result.game.score, 7);
  assert.equal(randomCalls, 0);
});

test("spawns a four on a deterministic empty cell", () => {
  const { board, tile } = spawnTile(createBoard(), (() => { const values = [0, .99]; return () => values.shift(); })());
  assert.deepEqual(tile, { row: 0, col: 0, value: 4 });
  assert.equal(board[0][0], 4);
});

test("reaching 2048 ends the round immediately without spawning another tile", () => {
  const board = createBoard();
  board[0] = [1024, 1024, 0, 0];
  const result = playTurn({ board, score: 2040, status: "playing" }, "left", () => { throw new Error("won games do not spawn tiles"); });
  assert.equal(result.game.status, "won");
  assert.equal(result.game.score, 4088);
  assert.equal(result.spawned, null);
});

test("detects a full board without any legal moves", () => {
  const board = [
    [2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2],
  ];
  assert.equal(hasMoves(board), false);
});
