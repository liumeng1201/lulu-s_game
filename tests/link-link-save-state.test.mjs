import test from "node:test";
import assert from "node:assert/strict";
import { BOARD_SIZE, ICON_COUNT, PAIR_COUNT, ROUND_DURATION_MS, STARTING_HINTS, createEmptyBoard } from "../games/link-link/engine.mjs";
import { createDefaultSave, validateLinkLinkGame, validateLinkLinkSave } from "../games/link-link/save-state.mjs";

function playableGame() {
  const board = createEmptyBoard();
  for (let icon = 0; icon < ICON_COUNT; icon += 1) {
    for (const index of [icon * 2, icon * 2 + 1]) {
      board[Math.floor(index / BOARD_SIZE)][index % BOARD_SIZE] = icon;
    }
  }
  return { board, status: "playing", remainingMs: ROUND_DURATION_MS, selected: null, hintsLeft: STARTING_HINTS, matches: 0, mistakes: 0, pauseReason: null };
}

test("validates and clones an active game state", () => {
  const game = playableGame();
  const restored = validateLinkLinkGame(game);
  assert.deepEqual(restored, game);
  assert.notEqual(restored.board, game.board);
  assert.notEqual(restored.board[0], game.board[0]);
  assert.deepEqual(validateLinkLinkSave({ version: 1, currentGame: game }), { version: 1, currentGame: game });
});

test("accepts manual and play-limit pauses for refresh and resume", () => {
  for (const pauseReason of ["manual", "limit"]) {
    assert.equal(validateLinkLinkGame({ ...playableGame(), status: "paused", pauseReason }).status, "paused");
  }
  assert.equal(validateLinkLinkGame({ ...playableGame(), status: "paused", pauseReason: null }), null);
  assert.equal(validateLinkLinkGame({ ...playableGame(), status: "playing", pauseReason: "limit" }), null);
});

test("accepts a completed board and a timed-out board only when state agrees", () => {
  const won = playableGame();
  won.board = createEmptyBoard();
  won.status = "won";
  won.remainingMs = 1;
  won.matches = PAIR_COUNT;
  assert.equal(validateLinkLinkGame(won).status, "won");
  assert.equal(validateLinkLinkGame({ ...won, selected: 0 }), null);

  const lost = playableGame();
  lost.board = createEmptyBoard();
  lost.board[0][0] = 0; lost.board[0][1] = 0;
  lost.status = "lost"; lost.remainingMs = 0; lost.matches = PAIR_COUNT - 1;
  assert.equal(validateLinkLinkGame(lost).status, "lost");
  assert.equal(validateLinkLinkGame({ ...lost, remainingMs: 1 }), null);
});

test("rejects orphaned tiles, invalid selection, and contradictory match counts", () => {
  const game = playableGame();
  game.board[0][1] = null;
  assert.equal(validateLinkLinkGame(game), null);
  const invalidSelection = playableGame();
  invalidSelection.selected = 64;
  assert.equal(validateLinkLinkGame(invalidSelection), null);
  const inconsistentMatches = playableGame();
  inconsistentMatches.matches = 1;
  assert.equal(validateLinkLinkGame(inconsistentMatches), null);
  assert.deepEqual(validateLinkLinkSave(createDefaultSave()), createDefaultSave());
  assert.equal(validateLinkLinkSave({ version: 2, currentGame: null }), null);
});
