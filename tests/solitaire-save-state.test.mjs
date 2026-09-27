import test from "node:test";
import assert from "node:assert/strict";
import { createGame, drawFromStock } from "../games/solitaire/engine.mjs";
import { createDefaultSolitaireSave, validateSolitaireSave } from "../games/solitaire/save-state.mjs";

test("validates and clones a standard Klondike save with a legal move history", () => {
  const initial = createGame(() => 0.37);
  const played = drawFromStock(initial);
  const validated = validateSolitaireSave({ version: 1, game: played });
  assert.ok(validated);
  assert.equal(validated.game.stock.length, 23);
  assert.equal(validated.game.waste.length, 1);
  assert.equal(validated.game.history.length, 1);
  assert.notEqual(validated.game.stock, played.stock);
  assert.notEqual(validated.game.stock[0], played.stock[0]);
});

test("creates a valid default save and rejects missing, duplicated, or malformed cards", () => {
  const saved = createDefaultSolitaireSave(() => 0.22);
  assert.ok(validateSolitaireSave(saved));
  assert.equal(validateSolitaireSave(null), null);
  const duplicate = structuredClone(saved);
  duplicate.game.stock[0] = { ...duplicate.game.stock[0], id: duplicate.game.tableau[0][0].id };
  assert.equal(validateSolitaireSave(duplicate), null);
  const malformed = structuredClone(saved);
  malformed.game.tableau[0][0].rank = 14;
  assert.equal(validateSolitaireSave(malformed), null);
});

test("rejects invalid pile ordering, face-down waste, status mismatch, and history", () => {
  const valid = createDefaultSolitaireSave(() => 0.61);
  const badTableau = structuredClone(valid);
  badTableau.game.tableau[0][0].faceUp = false;
  assert.equal(validateSolitaireSave(badTableau), null);

  const badWaste = structuredClone(valid);
  badWaste.game.waste.push(badWaste.game.stock.pop());
  assert.equal(validateSolitaireSave(badWaste), null);

  const badStatus = structuredClone(valid);
  badStatus.game.status = "won";
  assert.equal(validateSolitaireSave(badStatus), null);

  const badHistory = structuredClone(valid);
  badHistory.game.history = [{ stock: [], waste: [], foundations: [[], [], [], []], tableau: [[], [], [], [], [], [], []], moves: 0, status: "playing" }];
  assert.equal(validateSolitaireSave(badHistory), null);
});
