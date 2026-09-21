import test from "node:test";
import assert from "node:assert/strict";
import { createBoard as createGomokuBoard, BLACK as GOMOKU_BLACK } from "../games/gomoku/engine.mjs";
import { validateGomokuSave } from "../games/gomoku/save-state.mjs";
import { createBoard as createGoBoard, BLACK, WHITE } from "../games/go/engine.mjs";
import { validateGoSave } from "../games/go/save-state.mjs";
import { validateCatchStarsSave } from "../games/catch-stars/save-state.js";
import { createBoard as createTicTacToeBoard, X } from "../games/tic-tac-toe/engine.mjs";
import { validateTicTacToeSave } from "../games/tic-tac-toe/save-state.mjs";

test("catch-stars rejects impossible coordinates and accepts a valid save", () => {
  const valid = { version: 1, running: true, paused: false, score: 4, lives: 2, basketX: 200, starX: 300, starY: 120, soundOn: true };
  assert.equal(validateCatchStarsSave(valid).score, 4);
  assert.equal(validateCatchStarsSave({ ...valid, starY: Infinity }), null);
});

test("gomoku rejects malformed history that would crash board rendering", () => {
  const valid = { version: 1, mode: "pvp", difficulty: "medium", board: createGomokuBoard(), currentPlayer: GOMOKU_BLACK, running: true, winner: null, winningLine: [], history: [], soundOn: true, cursor: { row: 7, col: 7 } };
  assert.ok(validateGomokuSave(valid));
  assert.equal(validateGomokuSave({ ...valid, history: [{}] }), null);
});

test("go validates snapshots and stored dead-stone coordinates", () => {
  const board = createGoBoard(9);
  const valid = {
    version: 1, mode: "pvp", difficulty: "medium", size: 9, board, currentPlayer: BLACK, running: true, history: [],
    captures: { [BLACK]: 0, [WHITE]: 0 }, consecutivePasses: 0, soundOn: true, cursor: { row: 4, col: 4 }, lastMove: null,
    settingsOpen: false, scoring: false, deadStones: [], scoringConfirmations: [], draft: { mode: "pvp", difficulty: "medium", size: 9 }, resultOpen: false, notice: "",
  };
  assert.ok(validateGoSave(valid));
  assert.equal(validateGoSave({ ...valid, deadStones: ["10,1"] }), null);
  assert.equal(validateGoSave({ ...valid, history: [{}] }), null);
});

test("tic-tac-toe rejects history that does not reproduce its board", () => {
  const board = createTicTacToeBoard();
  const valid = { version: 1, mode: "pvp", difficulty: "medium", board, currentPlayer: X, running: true, winner: null, winningLine: [], history: [], soundOn: true, cursor: { row: 0, col: 0 }, modeOpen: false, resultOpen: false };
  assert.ok(validateTicTacToeSave(valid));
  const inconsistent = { ...valid, history: [{ row: 0, col: 0, player: X }] };
  assert.equal(validateTicTacToeSave(inconsistent), null);
});

test("game saves reject mutually exclusive UI states", () => {
  const catchStars = { version: 1, running: true, paused: false, score: 10, lives: 2, basketX: 200, starX: 300, starY: 120, resultOpen: true };
  assert.equal(validateCatchStarsSave(catchStars), null);
});
