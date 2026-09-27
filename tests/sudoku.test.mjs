import test from "node:test";
import assert from "node:assert/strict";
import {
  DIFFICULTY_CLUES, DIFFICULTIES, EMPTY, SIZE, countSolutions, createGame, createPuzzle,
  createSolution, enterDigit, eraseCell, getConflicts, isValidSolution, revealHint, undoMove, updateElapsed,
} from "../games/sudoku/engine.mjs";

function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

test("generates valid complete solution grids", () => {
  for (const seed of [1, 5, 17]) {
    const solution = createSolution(seeded(seed));
    assert.equal(solution.length, SIZE * SIZE);
    assert.equal(isValidSolution(solution), true);
    assert.equal(countSolutions(solution), 1);
  }
});

test("generates uniquely solvable puzzles at the requested clue count", () => {
  for (const difficulty of DIFFICULTIES) {
    const puzzle = createPuzzle(difficulty, seeded(difficulty.length * 100));
    assert.equal(puzzle.clues, DIFFICULTY_CLUES[difficulty]);
    assert.equal(puzzle.puzzle.filter((value) => value !== EMPTY).length, DIFFICULTY_CLUES[difficulty]);
    assert.equal(countSolutions(puzzle.puzzle, 2), 1);
    puzzle.puzzle.forEach((value, index) => { if (value) assert.equal(value, puzzle.solution[index]); });
  }
});

test("caps solution counting and rejects impossible or ambiguous grids", () => {
  assert.equal(countSolutions(Array(81).fill(0), 2), 2);
  const contradiction = Array(81).fill(0);
  contradiction[0] = 1;
  contradiction[1] = 1;
  assert.equal(countSolutions(contradiction), 0);
  assert.equal(countSolutions([1, 2]), 0);
});

test("protects given digits and supports pencil marks, values, erasing, and undo", () => {
  const game = createGame("easy", seeded(77));
  const givenIndex = game.puzzle.findIndex((value) => value !== EMPTY);
  const blankIndex = game.puzzle.findIndex((value) => value === EMPTY);
  assert.equal(enterDigit(game, givenIndex, 9), game);
  assert.equal(enterDigit(game, -1, 1), game);
  assert.equal(enterDigit(game, blankIndex, 0, true), game);

  const withNote = enterDigit(game, blankIndex, 1, true);
  assert.deepEqual(withNote.notes[blankIndex], [1]);
  const withoutNote = enterDigit(withNote, blankIndex, 1, true);
  assert.deepEqual(withoutNote.notes[blankIndex], []);
  assert.deepEqual(undoMove(withoutNote), withNote);

  const entered = enterDigit(game, blankIndex, game.solution[blankIndex]);
  assert.equal(entered.grid[blankIndex], game.solution[blankIndex]);
  assert.deepEqual(eraseCell(entered, blankIndex).grid, game.grid);
});

test("reveals only correct answers, consumes hints, and completes a correct board", () => {
  const game = createGame("easy", seeded(12));
  const target = game.puzzle.findIndex((value) => value === EMPTY);
  const hinted = revealHint(game, target);
  assert.equal(hinted.grid[target], game.solution[target]);
  assert.equal(hinted.hintsRemaining, game.hintsRemaining - 1);
  assert.equal(revealHint(hinted, target), hinted);

  let completed = { ...game, hintsRemaining: 0 };
  game.puzzle.forEach((value, index) => {
    if (value === EMPTY) completed = enterDigit(completed, index, game.solution[index]);
  });
  assert.equal(completed.status, "won");
  assert.equal(enterDigit(completed, target, 0), completed);
});

test("highlights every duplicate in a row, column, or box and ignores empty cells", () => {
  const grid = Array(81).fill(0);
  grid[0] = 4; grid[1] = 4; grid[9] = 4; grid[10] = 4;
  assert.deepEqual([...getConflicts(grid)].sort((a, b) => a - b), [0, 1, 9, 10]);
  assert.equal(getConflicts(Array(81).fill(0)).size, 0);
});

test("elapsed time advances only for finite nonnegative intervals", () => {
  const game = createGame("easy", seeded(33));
  assert.equal(updateElapsed(game, 1000).elapsedMs, 1000);
  assert.equal(updateElapsed(game, -1), game);
  assert.equal(updateElapsed(game, Infinity), game);
});
