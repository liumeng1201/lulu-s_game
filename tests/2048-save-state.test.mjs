import test from "node:test";
import assert from "node:assert/strict";
import { createBoard } from "../games/2048/engine.mjs";
import { createDefaultSave, normalizeNickname, sortLeaderboard, validate2048Game, validate2048Save } from "../games/2048/save-state.mjs";

function activeGame() {
  const board = createBoard();
  board[0][0] = 2;
  return { board, score: 0, status: "playing" };
}

function entry(runId, score, highest, completedAt = 100, outcome = "lost") {
  return { runId, nickname: "小明", score, highestTile: highest, outcome, completedAt };
}

test("normalizes required nicknames, strips controls, and caps by Unicode characters", () => {
  assert.equal(normalizeNickname("  小\n明  "), "小明");
  assert.equal(normalizeNickname("🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂"), "🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂🙂");
  assert.equal(normalizeNickname("   "), "");
});

test("validates active and terminal game states against the board", () => {
  assert.deepEqual(validate2048Game(activeGame()), activeGame());
  const won = createBoard();
  won[0][0] = 2048;
  assert.equal(validate2048Game({ board: won, score: 2048, status: "won" }).status, "won");
  assert.equal(validate2048Game({ board: won, score: 2048, status: "playing" }), null);
  const stuck = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
  assert.equal(validate2048Game({ board: stuck, score: 0, status: "lost" }).status, "lost");
  assert.equal(validate2048Game({ board: stuck, score: 0, status: "playing" }), null);
});

test("ranks by score, then highest tile, then earlier completion and keeps ten", () => {
  const ranked = sortLeaderboard([
    entry("a", 300, 256, 30), entry("b", 300, 512, 50), entry("c", 300, 512, 10),
    ...Array.from({ length: 10 }, (_, index) => entry(`low-${index}`, 100 - index, 128, 80 + index)),
  ]);
  assert.equal(ranked.length, 10);
  assert.deepEqual(ranked.slice(0, 3).map(({ runId }) => runId), ["c", "b", "a"]);
  assert.ok(ranked[9].score > 0);
});

test("validates and clones a saved active run without losing its board", () => {
  const save = createDefaultSave();
  save.nickname = "小明";
  save.currentRun = { runId: "run-1", nickname: "小明", game: activeGame(), recorded: false };
  const restored = validate2048Save(save);
  assert.deepEqual(restored, save);
  assert.notEqual(restored.currentRun.game.board, save.currentRun.game.board);
  assert.notEqual(restored.currentRun.game.board[0], save.currentRun.game.board[0]);
});

test("rejects malformed nicknames, duplicate entries, and inconsistent completed runs", () => {
  const save = createDefaultSave();
  save.nickname = "小明";
  save.leaderboard = [entry("run-1", 10, 4), entry("run-1", 10, 4, 101)];
  save.bestScore = 10;
  assert.equal(validate2048Save(save), null);

  const terminal = createDefaultSave();
  terminal.nickname = "小明";
  terminal.currentRun = { runId: "run-2", nickname: "小明", game: activeGame(), recorded: true };
  assert.equal(validate2048Save(terminal), null);

  const invalidNickname = { ...createDefaultSave(), nickname: " 小明 " };
  assert.equal(validate2048Save(invalidNickname), null);
});

test("accepts a finalized run when its low score falls outside the top ten", () => {
  const save = createDefaultSave();
  save.nickname = "小明";
  save.bestScore = 100;
  save.leaderboard = Array.from({ length: 10 }, (_, index) => entry(`top-${index}`, 100 - index, 128, index + 1));
  const board = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
  save.currentRun = { runId: "old-run", nickname: "小明", game: { board, score: 0, status: "lost" }, recorded: true };
  assert.notEqual(validate2048Save(save), null);
});
