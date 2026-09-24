import test from "node:test";
import assert from "node:assert/strict";
import { createVersionedGameStore } from "../assets/js/safe-storage.js";
import { createBoard, createGame, playTurn } from "../games/2048/engine.mjs";
import { createDefaultSave, validate2048Save } from "../games/2048/save-state.mjs";

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("the current game survives a storage-backed reload and can continue moving", () => {
  const storage = memoryStorage();
  const firstStore = createVersionedGameStore({ key: "2048", validate: validate2048Save, storage, sessionStorage: memoryStorage() });
  const save = createDefaultSave();
  save.nickname = "小明";
  save.currentRun = { runId: "run-1", nickname: "小明", game: createGame(() => 0), recorded: false };
  assert.equal(firstStore.save(save), true);

  const restoredStore = createVersionedGameStore({ key: "2048", validate: validate2048Save, storage, sessionStorage: memoryStorage() });
  const restored = restoredStore.load();
  assert.deepEqual(restored, save);
  const turn = playTurn(restored.currentRun.game, "left", () => 0);
  assert.equal(turn.moved, true);
  restored.currentRun.game = turn.game;
  assert.equal(restoredStore.save(restored), true);
  assert.deepEqual(createVersionedGameStore({ key: "2048", validate: validate2048Save, storage, sessionStorage: memoryStorage() }).load(), restored);
});

test("a completed winning run and its leaderboard result survive reload", () => {
  const storage = memoryStorage();
  const store = createVersionedGameStore({ key: "2048", validate: validate2048Save, storage, sessionStorage: memoryStorage() });
  const save = createDefaultSave();
  save.nickname = "小明";
  const board = createBoard();
  board[0][0] = 2048;
  save.currentRun = { runId: "win-1", nickname: "小明", game: { board, score: 4088, status: "won" }, recorded: true };
  save.bestScore = 4088;
  save.leaderboard = [{ runId: "win-1", nickname: "小明", score: 4088, highestTile: 2048, outcome: "won", completedAt: 123 }];
  assert.equal(store.save(save), true);

  const loaded = createVersionedGameStore({ key: "2048", validate: validate2048Save, storage, sessionStorage: memoryStorage() }).load();
  assert.equal(loaded.currentRun.game.status, "won");
  assert.equal(loaded.leaderboard[0].outcome, "won");
  assert.equal(loaded.leaderboard[0].highestTile, 2048);
});
