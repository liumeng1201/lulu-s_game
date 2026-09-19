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
  assert.equal(loaded.sceneId, "school-classroom");
  assert.equal(loaded.x, 412);
  assert.equal(loaded.y, 310);
});

test("invalid save data falls back to home", () => {
  assert.deepEqual(loadSave(memoryStorage("not json")), DEFAULT_SAVE);
});
