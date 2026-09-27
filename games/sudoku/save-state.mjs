import { DIFFICULTIES, HINTS_PER_GAME, SIZE, createGame, isValidSolution } from "./engine.mjs";

function validGrid(grid, { solution = false } = {}) {
  return Array.isArray(grid) && grid.length === SIZE * SIZE
    && grid.every((value) => Number.isInteger(value) && value >= 0 && value <= SIZE)
    && (!solution || isValidSolution(grid));
}

function validNotes(notes, grid) {
  return Array.isArray(notes) && notes.length === SIZE * SIZE && notes.every((cell, index) => Array.isArray(cell)
    && cell.length <= SIZE && cell.every((value, noteIndex) => Number.isInteger(value) && value >= 1 && value <= SIZE
      && (noteIndex === 0 || cell[noteIndex - 1] < value)) && (grid[index] === 0 || cell.length === 0));
}

function validHistoryEntry(entry, puzzle) {
  return entry && validGrid(entry.grid) && validNotes(entry.notes, entry.grid)
    && Number.isInteger(entry.hintsRemaining) && entry.hintsRemaining >= 0 && entry.hintsRemaining <= HINTS_PER_GAME
    && puzzle.every((value, index) => value === 0 || entry.grid[index] === value);
}

export function validateSudokuGame(value) {
  if (!value || !DIFFICULTIES.includes(value.difficulty) || !validGrid(value.puzzle)
    || !validGrid(value.solution, { solution: true }) || !validGrid(value.grid)
    || !value.puzzle.every((given, index) => given === 0 || given === value.solution[index] && value.grid[index] === given)
    || !validNotes(value.notes, value.grid)
    || !Number.isInteger(value.selectedIndex) || value.selectedIndex < 0 || value.selectedIndex >= SIZE * SIZE
    || !Number.isInteger(value.hintsRemaining) || value.hintsRemaining < 0 || value.hintsRemaining > HINTS_PER_GAME
    || !Number.isFinite(value.elapsedMs) || value.elapsedMs < 0
    || !["playing", "won"].includes(value.status)
    || !Array.isArray(value.history) || value.history.length > 250
    || !value.history.every((entry) => validHistoryEntry(entry, value.puzzle))) return null;

  const solved = value.grid.every((digit, index) => digit === value.solution[index]);
  if ((value.status === "won") !== solved) return null;
  return {
    difficulty: value.difficulty,
    puzzle: [...value.puzzle],
    solution: [...value.solution],
    grid: [...value.grid],
    notes: value.notes.map((cell) => [...cell]),
    selectedIndex: value.selectedIndex,
    hintsRemaining: value.hintsRemaining,
    elapsedMs: value.elapsedMs,
    status: value.status,
    history: value.history.map((entry) => ({ grid: [...entry.grid], notes: entry.notes.map((cell) => [...cell]), hintsRemaining: entry.hintsRemaining })),
  };
}

export function createDefaultSudokuSave(random = Math.random) {
  return { version: 1, game: createGame("easy", random) };
}

export function validateSudokuSave(value) {
  if (!value || value.version !== 1) return null;
  const game = validateSudokuGame(value.game);
  return game ? { version: 1, game } : null;
}
