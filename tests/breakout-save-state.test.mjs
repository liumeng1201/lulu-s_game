import test from "node:test";
import assert from "node:assert/strict";
import { pauseGame, serveGame } from "../games/breakout/engine.mjs";
import { createDefaultBreakoutSave, validateBreakoutSave } from "../games/breakout/save-state.mjs";

test("creates and clones a ready board with its brick layout", () => {
  const valid = createDefaultBreakoutSave();
  const restored = validateBreakoutSave(valid);
  assert.ok(restored);
  assert.notEqual(restored.game, valid.game);
  assert.notEqual(restored.game.bricks, valid.game.bricks);
  assert.equal(restored.game.bricks.length, 50);
});

test("accepts an active or paused game without losing its exact physics state", () => {
  const valid = createDefaultBreakoutSave();
  const active = { ...valid, game: serveGame(valid.game) };
  assert.deepEqual(validateBreakoutSave(active)?.game, active.game);

  const paused = { ...valid, game: pauseGame(active.game) };
  assert.equal(validateBreakoutSave(paused)?.game.status, "paused");
  assert.equal(validateBreakoutSave(paused)?.game.resumeStatus, "playing");
});

test("rejects impossible physics values, malformed bricks, and contradictory results", () => {
  const valid = createDefaultBreakoutSave();
  assert.equal(validateBreakoutSave({ ...valid, game: { ...valid.game, paddleX: -1 } }), null);
  assert.equal(validateBreakoutSave({ ...valid, game: { ...valid.game, ball: { ...valid.game.ball, vx: Infinity } } }), null);
  assert.equal(validateBreakoutSave({ ...valid, game: { ...valid.game, bricks: [] } }), null);
  assert.equal(validateBreakoutSave({ ...valid, game: { ...valid.game, status: "won" } }), null);
  assert.equal(validateBreakoutSave({ ...valid, game: { ...valid.game, status: "paused", resumeStatus: "won" } }), null);
});
