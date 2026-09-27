import test from "node:test";
import assert from "node:assert/strict";
import { createGame, enterDigit } from "../games/sudoku/engine.mjs";
import { createDefaultSudokuSave, validateSudokuSave } from "../games/sudoku/save-state.mjs";

function seeded(seed) { let value = seed; return () => ((value = value * 48271 % 2147483647) / 2147483647); }

test("creates a valid game save and clones its board and candidate marks", () => {
  const save = createDefaultSudokuSave(seeded(11));
  const index = save.game.puzzle.findIndex((value) => value === 0);
  const entered = enterDigit(save.game, index, save.game.solution[index]);
  const restored = validateSudokuSave({ ...save, game: entered });
  assert.ok(restored);
  assert.deepEqual(restored.game, entered);
  assert.notEqual(restored.game.grid, entered.grid);
  assert.notEqual(restored.game.notes, entered.notes);
});

test("accepts ordinary mistakes but rejects corruption and changed given clues", () => {
  const save = createDefaultSudokuSave(seeded(21));
  const blank = save.game.puzzle.findIndex((value) => value === 0);
  const wrongValue = save.game.solution[blank] % 9 + 1;
  const mistake = enterDigit(save.game, blank, wrongValue);
  assert.ok(validateSudokuSave({ ...save, game: mistake }));

  const changedGiven = [...save.game.grid];
  const given = save.game.puzzle.findIndex((value) => value !== 0);
  changedGiven[given] = changedGiven[given] % 9 + 1;
  assert.equal(validateSudokuSave({ ...save, game: { ...save.game, grid: changedGiven } }), null);
  assert.equal(validateSudokuSave({ ...save, game: { ...save.game, grid: [1, 2] } }), null);
  assert.equal(validateSudokuSave({ ...save, game: { ...save.game, hintsRemaining: -1 } }), null);
});

test("rejects malformed notes, impossible solutions, and contradictory completion flags", () => {
  const save = createDefaultSudokuSave(seeded(31));
  const blank = save.game.puzzle.findIndex((value) => value === 0);
  const notes = save.game.notes.map((cell) => [...cell]);
  notes[blank] = [2, 2];
  assert.equal(validateSudokuSave({ ...save, game: { ...save.game, notes } }), null);

  const solution = [...save.game.solution];
  solution[0] = solution[1];
  assert.equal(validateSudokuSave({ ...save, game: { ...save.game, solution } }), null);
  assert.equal(validateSudokuSave({ ...save, game: { ...save.game, status: "won" } }), null);
});
