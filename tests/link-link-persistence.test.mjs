import test from "node:test";
import assert from "node:assert/strict";
import { createVersionedGameStore } from "../assets/js/safe-storage.js";
import { advanceTimer, createGame } from "../games/link-link/engine.mjs";
import { createDefaultSave, validateLinkLinkSave } from "../games/link-link/save-state.mjs";

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("an in-progress board and its remaining time survive a page reload", () => {
  const storage = memoryStorage();
  const first = createVersionedGameStore({ key: "link-link", validate: validateLinkLinkSave, storage, sessionStorage: memoryStorage() });
  const save = createDefaultSave();
  save.currentGame = createGame(() => 0.41);
  save.currentGame = { ...save.currentGame, selected: 2, hintsLeft: 2, mistakes: 1 };
  save.currentGame = advanceTimer(save.currentGame, 12_500);
  assert.equal(first.save(save), true);

  const reopened = createVersionedGameStore({ key: "link-link", validate: validateLinkLinkSave, storage, sessionStorage: memoryStorage() });
  const restored = reopened.load();
  assert.deepEqual(restored, save);
  assert.equal(restored.currentGame.remainingMs, 287_500);
  assert.equal(restored.currentGame.selected, 2);
  assert.equal(restored.currentGame.hintsLeft, 2);
});

test("a play-limit pause survives reload and resumes without consuming round time", () => {
  const storage = memoryStorage();
  const first = createVersionedGameStore({ key: "link-link", validate: validateLinkLinkSave, storage, sessionStorage: memoryStorage() });
  const save = createDefaultSave();
  const game = createGame(() => 0.7);
  save.currentGame = { ...game, status: "paused", remainingMs: 123_000, pauseReason: "limit" };
  assert.equal(first.save(save), true);

  const reopened = createVersionedGameStore({ key: "link-link", validate: validateLinkLinkSave, storage, sessionStorage: memoryStorage() });
  const restored = reopened.load();
  assert.equal(restored.currentGame.pauseReason, "limit");
  assert.equal(restored.currentGame.remainingMs, 123_000);
  restored.currentGame = { ...restored.currentGame, status: "playing", pauseReason: null };
  assert.equal(reopened.save(restored), true);
  assert.equal(reopened.load().currentGame.remainingMs, 123_000);
});
