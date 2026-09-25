import test from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_SIZE, ICON_COUNT, PAIR_COUNT, ROUND_DURATION_MS, STARTING_HINTS, advanceTimer, createEmptyBoard,
  createGame, findAvailablePair, findConnectionPath, formatTime, indexToCell, selectTile, shuffleRemaining, useHint,
} from "../games/link-link/engine.mjs";

function position(board, row, col, value) { board[row][col] = value; }

test("creates an 8 by 8 board with thirty-two complete pairs and at least one move", () => {
  const game = createGame(() => 0.25);
  assert.equal(game.board.length, BOARD_SIZE);
  assert.ok(game.board.every((row) => row.length === BOARD_SIZE));
  assert.equal(game.board.flat().length, BOARD_SIZE ** 2);
  for (let icon = 0; icon < ICON_COUNT; icon += 1) assert.equal(game.board.flat().filter((tile) => tile === icon).length, 2);
  assert.ok(findAvailablePair(game.board));
  assert.equal(game.remainingMs, ROUND_DURATION_MS);
  assert.equal(game.hintsLeft, STARTING_HINTS);
});

test("finds direct, one-turn, and two-turn connections", () => {
  const direct = createEmptyBoard();
  position(direct, 2, 1, 3); position(direct, 2, 4, 3);
  assert.ok(findConnectionPath(direct, 17, 20));

  const oneTurn = createEmptyBoard();
  position(oneTurn, 1, 1, 4); position(oneTurn, 3, 3, 4);
  assert.ok(findConnectionPath(oneTurn, 9, 27));

  const twoTurns = createEmptyBoard();
  for (let col = 0; col < BOARD_SIZE; col += 1) for (let row = 0; row < BOARD_SIZE; row += 1) twoTurns[row][col] = 7;
  position(twoTurns, 4, 1, 5); position(twoTurns, 0, 2, 5);
  for (let col = 2; col <= 5; col += 1) twoTurns[4][col] = null;
  for (let row = 0; row <= 3; row += 1) twoTurns[row][5] = null;
  twoTurns[0][3] = null; twoTurns[0][4] = null;
  assert.ok(findConnectionPath(twoTurns, 33, 2));
});

test("allows a route around the outside border", () => {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(6));
  board[0][0] = 2;
  board[0][BOARD_SIZE - 1] = 2;
  const path = findConnectionPath(board, 0, BOARD_SIZE - 1);
  assert.ok(path);
  assert.ok(path.some(({ row, col }) => row === -1 || row === BOARD_SIZE || col === -1 || col === BOARD_SIZE));
});

test("rejects mismatched tiles, a blocked path, and a route requiring three turns", () => {
  const blocked = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(7));
  position(blocked, 3, 3, 1); position(blocked, 3, 5, 1); position(blocked, 3, 4, 2);
  assert.equal(findConnectionPath(blocked, 27, 29), null);
  blocked[3][5] = 3;
  assert.equal(findConnectionPath(blocked, 27, 29), null);

  const maze = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(7));
  maze[4][1] = 5; maze[1][2] = 5;
  for (let col = 2; col <= 5; col += 1) maze[4][col] = null;
  for (let row = 0; row <= 3; row += 1) maze[row][5] = null;
  for (let col = 2; col <= 5; col += 1) maze[0][col] = null;
  assert.equal(findConnectionPath(maze, 33, 10), null);
  assert.equal(findConnectionPath(maze, 33, 33), null);
  assert.equal(indexToCell(10).row, 1);
});

test("selects and clears connected pairs, counts misses, and ends on the final pair", () => {
  const board = createEmptyBoard();
  board[0][0] = 0; board[0][1] = 0;
  const game = { board, status: "playing", remainingMs: 1000, selected: null, hintsLeft: 3, matches: PAIR_COUNT - 1, mistakes: 0, pauseReason: null };
  const selected = selectTile(game, 0);
  assert.equal(selected.game.selected, 0);
  const result = selectTile(selected.game, 1);
  assert.equal(result.matched, true);
  assert.equal(result.game.status, "won");
  assert.equal(result.game.matches, PAIR_COUNT);
  assert.deepEqual(result.game.board[0].slice(0, 2), [null, null]);

  const mismatchBoard = createEmptyBoard();
  mismatchBoard[0][0] = 0; mismatchBoard[0][1] = 1;
  const mismatchGame = { ...game, board: mismatchBoard, matches: 0 };
  const miss = selectTile(selectTile(mismatchGame, 0).game, 1);
  assert.equal(miss.game.mistakes, 1);
  assert.equal(miss.game.selected, 1);
});

test("hints consume a use, while shuffle preserves tiles and guarantees a legal pair", () => {
  const game = createGame(() => 0.6);
  const hint = useHint(game);
  assert.ok(hint.pair);
  assert.equal(hint.game.hintsLeft, STARTING_HINTS - 1);
  assert.equal(useHint({ ...game, hintsLeft: 0 }).pair, null);

  const shuffled = shuffleRemaining(game.board, () => 0);
  assert.deepEqual([...shuffled.board.flat()].sort(), [...game.board.flat()].sort());
  assert.ok(findAvailablePair(shuffled.board));
});

test("every generated round can keep progressing until all pairs are cleared", () => {
  for (let seed = 1; seed <= 12; seed += 1) {
    let randomState = seed;
    const random = () => { randomState = (randomState * 48271) % 2147483647; return randomState / 2147483647; };
    let game = createGame(random);
    for (let match = 0; match < PAIR_COUNT; match += 1) {
      const pair = findAvailablePair(game.board);
      assert.ok(pair, `seed ${seed} must have a move after ${match} matches`);
      game = selectTile(game, pair.first, random).game;
      const cleared = selectTile(game, pair.second, random);
      assert.equal(cleared.matched, true);
      game = cleared.game;
    }
    assert.equal(game.status, "won");
    assert.equal(game.board.flat().filter((tile) => tile !== null).length, 0);
  }
});

test("pauses time outside active play and ends when the five-minute clock expires", () => {
  const game = createGame(() => 0.3);
  const active = advanceTimer(game, 12_000);
  assert.equal(active.remainingMs, ROUND_DURATION_MS - 12_000);
  assert.equal(Number.isInteger(advanceTimer(game, 100.75).remainingMs), true);
  assert.equal(advanceTimer({ ...active, status: "paused" }, 30_000).remainingMs, active.remainingMs);
  assert.equal(advanceTimer(active, ROUND_DURATION_MS).status, "lost");
  assert.equal(formatTime(ROUND_DURATION_MS), "05:00");
  assert.equal(formatTime(1000), "00:01");
});
