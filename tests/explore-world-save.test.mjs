import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SAVE, SAVE_KEY, loadSave, savePosition } from "../games/explore-world/src/save-system.js";

function memoryStorage(initial) {
  const values = new Map(initial ? [[SAVE_KEY, initial]] : []);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key,value) => values.set(key,value) };
}

test("new players start in the home living room", () => {
  assert.deepEqual(loadSave(memoryStorage()), DEFAULT_SAVE);
});

test("a valid position can be saved and restored", () => {
  const storage = memoryStorage();
  savePosition("school-classroom", 412.4, 309.7, storage);
  const loaded = loadSave(storage);
  assert.equal(loaded.version, 4);
  assert.equal(loaded.sceneId, "school-classroom");
  assert.equal(loaded.x, 412);
  assert.equal(loaded.y, 310);
});

test("a legacy 4:3 save is migrated to the wide scene", () => {
  const legacy = JSON.stringify({ version: 1, sceneId: "hospital-lobby", x: 480, y: 300 });
  const loaded = loadSave(memoryStorage(legacy));
  assert.equal(loaded.version, 4);
  assert.equal(loaded.x, 640);
  assert.equal(loaded.y, 323);
});

test("a version 2 save is migrated to the shorter wide scene", () => {
  const previous = JSON.stringify({ version: 2, sceneId: "school-hall", x: 640, y: 540 });
  const loaded = loadSave(memoryStorage(previous));
  assert.equal(loaded.version, 4);
  assert.equal(loaded.x, 640);
  assert.equal(loaded.y, 510);
});

test("invalid save data falls back to home", () => {
  assert.deepEqual(loadSave(memoryStorage("not json")), DEFAULT_SAVE);
});
