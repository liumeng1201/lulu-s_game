import test from "node:test";
import assert from "node:assert/strict";
import { createSafeJsonStore, createVersionedGameStore } from "../assets/js/safe-storage.js";

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("safe storage keeps an in-memory value when persistent writes fail", () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  const store = createSafeJsonStore("state", storage);
  assert.equal(store.write({ value: 7 }), false);
  assert.deepEqual(store.read(), { value: 7 });
  assert.equal(store.isPersistent(), false);
});

test("a stale game tab cannot overwrite a newer revision", () => {
  const storage = memoryStorage();
  let conflicts = 0;
  const validate = (value) => Number.isInteger(value?.score) ? { score: value.score } : null;
  const first = createVersionedGameStore({ key: "game", validate, storage, sessionStorage: memoryStorage() });
  const second = createVersionedGameStore({ key: "game", validate, storage, sessionStorage: memoryStorage(), onConflict: () => { conflicts += 1; } });
  first.load(); second.load();
  assert.equal(first.save({ score: 1 }), true);
  assert.equal(second.save({ score: 2 }), false);
  assert.equal(conflicts, 1);
  assert.deepEqual(first.load(), { score: 1 });
});

test("a fresh tab can save after loading the latest revision", () => {
  const storage = memoryStorage();
  const validate = (value) => Number.isInteger(value?.score) ? { score: value.score } : null;
  const first = createVersionedGameStore({ key: "game", validate, storage, sessionStorage: memoryStorage() });
  first.load();
  assert.equal(first.save({ score: 1 }), true);
  const reopened = createVersionedGameStore({ key: "game", validate, storage, sessionStorage: memoryStorage() });
  assert.deepEqual(reopened.load(), { score: 1 });
  assert.equal(reopened.save({ score: 2 }), true);
});

test("duplicated tabs with cloned session storage still receive distinct writer identities", () => {
  const storage = memoryStorage();
  const clonedSessionStorage = memoryStorage();
  clonedSessionStorage.setItem("game:writer", "copied-tab-id");
  let conflicts = 0;
  const validate = (value) => Number.isInteger(value?.score) ? { score: value.score } : null;
  const first = createVersionedGameStore({ key: "game", validate, storage, sessionStorage: clonedSessionStorage });
  const second = createVersionedGameStore({ key: "game", validate, storage, sessionStorage: clonedSessionStorage, onConflict: () => { conflicts += 1; } });
  first.load(); second.load();
  assert.equal(first.save({ score: 1 }), true);
  assert.equal(second.save({ score: 2 }), false);
  assert.equal(conflicts, 1);
});

test("versioned save reports persistence failures instead of claiming success", () => {
  let failures = 0;
  const validate = (value) => Number.isInteger(value?.score) ? { score: value.score } : null;
  const store = createVersionedGameStore({
    key: "game", validate, sessionStorage: memoryStorage(),
    storage: { getItem: () => null, setItem: () => { throw new Error("quota"); } },
    onStorageError: () => { failures += 1; },
  });
  assert.equal(store.save({ score: 1 }), false);
  assert.equal(store.isPersistent(), false);
  assert.equal(failures, 1);
});

test("safe storage observes values removed by another tab", () => {
  const storage = memoryStorage();
  const store = createSafeJsonStore("state", storage);
  store.write({ value: 7 });
  storage.setItem("state", null);
  assert.equal(store.read(), null);
});
