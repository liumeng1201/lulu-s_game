import test from "node:test";
import assert from "node:assert/strict";
import { createGame, getLegalMoves, movePiece } from "../games/klotski/engine.mjs";
import { createDefaultKlotskiSave, validateKlotskiSave } from "../games/klotski/save-state.mjs";

test("creates a safe save and preserves each preset level", () => {
  assert.ok(validateKlotskiSave(createDefaultKlotskiSave()));
  for (const level of [2, 3]) {
    const save = { version: 1, game: createGame(level) };
    assert.equal(validateKlotskiSave(save)?.game.level, level);
  }
});

test("clones an active board and valid undo history", () => {
  const game = createGame(1);
  const move = getLegalMoves(game.pieces)[0];
  const after = movePiece(game, move.id, move.dx, move.dy);
  const restored = validateKlotskiSave({ version: 1, game: after });
  assert.ok(restored);
  assert.deepEqual(restored.game, after);
  assert.notEqual(restored.game.pieces, after.pieces);
});

test("rejects overlaps, unknown pieces, invalid counters, and contradictory wins", () => {
  const valid = createDefaultKlotskiSave();
  const pieces = valid.game.pieces.map((piece) => ({ ...piece }));
  pieces[1] = { ...pieces[1], row: 1, column: 1 };
  assert.equal(validateKlotskiSave({ ...valid, game: { ...valid.game, pieces } }), null);
  assert.equal(validateKlotskiSave({ ...valid, game: { ...valid.game, pieces: [{ ...valid.game.pieces[0], id: "unknown" }, ...valid.game.pieces.slice(1)] } }), null);
  assert.equal(validateKlotskiSave({ ...valid, game: { ...valid.game, moves: -1 } }), null);
  assert.equal(validateKlotskiSave({ ...valid, game: { ...valid.game, status: "won" } }), null);
});
