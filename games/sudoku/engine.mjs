export const SIZE = 9;
export const BOX = 3;
export const EMPTY = 0;
export const DIFFICULTY_CLUES = Object.freeze({ easy: 42, medium: 36, hard: 30 });
export const DIFFICULTIES = Object.freeze(["easy", "medium", "hard"]);
export const HINTS_PER_GAME = 3;

function sampleIndex(random, length) {
  const value = random();
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(0.999999999, value)) : 0.5;
  return Math.floor(normalized * length);
}

function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = sampleIndex(random, index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function shuffledAxis(random) {
  return shuffle([0, 1, 2], random).flatMap((band) => shuffle([0, 1, 2], random).map((offset) => band * 3 + offset));
}

export function createSolution(random = Math.random) {
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
  const rows = shuffledAxis(random);
  const columns = shuffledAxis(random);
  const transpose = sampleIndex(random, 2) === 1;
  return Array.from({ length: SIZE }, (_, row) => Array.from({ length: SIZE }, (_, column) => {
    const sourceRow = transpose ? columns[column] : rows[row];
    const sourceColumn = transpose ? rows[row] : columns[column];
    const patternDigit = (sourceRow * BOX + Math.floor(sourceRow / BOX) + sourceColumn) % SIZE;
    return digits[patternDigit];
  })).flat();
}

function candidateDigits(grid, index) {
  const row = Math.floor(index / SIZE);
  const column = index % SIZE;
  const used = new Set();
  for (let offset = 0; offset < SIZE; offset += 1) {
    used.add(grid[row * SIZE + offset]);
    used.add(grid[offset * SIZE + column]);
  }
  const boxRow = Math.floor(row / BOX) * BOX;
  const boxColumn = Math.floor(column / BOX) * BOX;
  for (let r = boxRow; r < boxRow + BOX; r += 1) {
    for (let c = boxColumn; c < boxColumn + BOX; c += 1) used.add(grid[r * SIZE + c]);
  }
  return Array.from({ length: SIZE }, (_, offset) => offset + 1).filter((digit) => !used.has(digit));
}

function findBestEmpty(grid) {
  let bestIndex = -1;
  let bestCandidates = null;
  for (let index = 0; index < grid.length; index += 1) {
    if (grid[index] !== EMPTY) continue;
    const candidates = candidateDigits(grid, index);
    if (!candidates.length) return { index, candidates };
    if (!bestCandidates || candidates.length < bestCandidates.length) {
      bestIndex = index;
      bestCandidates = candidates;
      if (candidates.length === 1) break;
    }
  }
  return bestIndex < 0 ? null : { index: bestIndex, candidates: bestCandidates };
}

function hasDuplicateValues(grid) {
  for (let row = 0; row < SIZE; row += 1) {
    const seen = new Set();
    for (let column = 0; column < SIZE; column += 1) {
      const value = grid[row * SIZE + column];
      if (value && seen.has(value)) return true;
      if (value) seen.add(value);
    }
  }
  for (let column = 0; column < SIZE; column += 1) {
    const seen = new Set();
    for (let row = 0; row < SIZE; row += 1) {
      const value = grid[row * SIZE + column];
      if (value && seen.has(value)) return true;
      if (value) seen.add(value);
    }
  }
  for (let boxRow = 0; boxRow < SIZE; boxRow += BOX) {
    for (let boxColumn = 0; boxColumn < SIZE; boxColumn += BOX) {
      const seen = new Set();
      for (let row = boxRow; row < boxRow + BOX; row += 1) {
        for (let column = boxColumn; column < boxColumn + BOX; column += 1) {
          const value = grid[row * SIZE + column];
          if (value && seen.has(value)) return true;
          if (value) seen.add(value);
        }
      }
    }
  }
  return false;
}

export function countSolutions(grid, limit = 2) {
  if (!Array.isArray(grid) || grid.length !== SIZE * SIZE || grid.some((value) => !Number.isInteger(value) || value < EMPTY || value > SIZE)
    || !Number.isInteger(limit) || limit < 1 || hasDuplicateValues(grid)) return 0;
  const board = [...grid];
  let solutions = 0;
  function search() {
    if (solutions >= limit) return;
    const best = findBestEmpty(board);
    if (!best) { solutions += 1; return; }
    if (!best.candidates.length) return;
    for (const digit of best.candidates) {
      board[best.index] = digit;
      search();
      board[best.index] = EMPTY;
      if (solutions >= limit) return;
    }
  }
  search();
  return solutions;
}

export function isValidSolution(grid) {
  return Array.isArray(grid) && grid.length === SIZE * SIZE
    && grid.every((value) => Number.isInteger(value) && value >= 1 && value <= SIZE)
    && !hasDuplicateValues(grid);
}

export function createPuzzle(difficulty = "easy", random = Math.random) {
  if (!DIFFICULTIES.includes(difficulty)) throw new RangeError("Unsupported Sudoku difficulty");
  const target = DIFFICULTY_CLUES[difficulty];
  let best = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const solution = createSolution(random);
    const puzzle = [...solution];
    let clues = SIZE * SIZE;
    for (const index of shuffle(Array.from({ length: SIZE * SIZE }, (_, offset) => offset), random)) {
      if (clues <= target) break;
      const original = puzzle[index];
      puzzle[index] = EMPTY;
      if (countSolutions(puzzle, 2) === 1) clues -= 1;
      else puzzle[index] = original;
    }
    if (!best || clues < best.clues) best = { puzzle: [...puzzle], solution, clues };
    if (clues <= target) break;
  }
  return best;
}

function cloneNotes(notes) { return notes.map((cell) => [...cell]); }

export function createGame(difficulty = "easy", random = Math.random) {
  const generated = createPuzzle(difficulty, random);
  return {
    difficulty,
    puzzle: generated.puzzle,
    solution: generated.solution,
    grid: [...generated.puzzle],
    notes: Array.from({ length: SIZE * SIZE }, () => []),
    selectedIndex: 40,
    hintsRemaining: HINTS_PER_GAME,
    elapsedMs: 0,
    status: "playing",
    history: [],
  };
}

function createHistoryEntry(game) {
  return { grid: [...game.grid], notes: cloneNotes(game.notes), hintsRemaining: game.hintsRemaining };
}

function withHistory(game, change) {
  return { ...change, history: [...game.history, createHistoryEntry(game)].slice(-250) };
}

export function setSelectedCell(game, index) {
  if (!Number.isInteger(index) || index < 0 || index >= SIZE * SIZE) return game;
  return { ...game, selectedIndex: index };
}

export function enterDigit(game, index, digit, noteMode = false) {
  if (game.status !== "playing" || !Number.isInteger(index) || index < 0 || index >= SIZE * SIZE
    || !Number.isInteger(digit) || digit < 0 || digit > SIZE || game.puzzle[index] !== EMPTY) return game;
  if (noteMode && digit === EMPTY) return game;
  if (noteMode) {
    const notes = cloneNotes(game.notes);
    notes[index] = notes[index].includes(digit) ? notes[index].filter((note) => note !== digit) : [...notes[index], digit].sort((a, b) => a - b);
    return withHistory(game, { ...game, notes });
  }
  if (game.grid[index] === digit && digit !== EMPTY) return game;
  const grid = [...game.grid];
  grid[index] = digit;
  const notes = cloneNotes(game.notes);
  notes[index] = [];
  const status = grid.every((value, cell) => value === game.solution[cell]) ? "won" : "playing";
  return withHistory(game, { ...game, grid, notes, status });
}

export function eraseCell(game, index) { return enterDigit(game, index, EMPTY, false); }

export function revealHint(game, index = game.selectedIndex) {
  if (game.status !== "playing" || game.hintsRemaining <= 0 || !Number.isInteger(index) || index < 0 || index >= SIZE * SIZE
    || game.puzzle[index] !== EMPTY || game.grid[index] === game.solution[index]) return game;
  const grid = [...game.grid];
  grid[index] = game.solution[index];
  const notes = cloneNotes(game.notes);
  notes[index] = [];
  const status = grid.every((value, cell) => value === game.solution[cell]) ? "won" : "playing";
  return withHistory(game, { ...game, grid, notes, hintsRemaining: game.hintsRemaining - 1, status });
}

export function undoMove(game) {
  if (!game.history.length) return game;
  const previous = game.history.at(-1);
  return {
    ...game,
    grid: [...previous.grid],
    notes: cloneNotes(previous.notes),
    hintsRemaining: previous.hintsRemaining,
    status: "playing",
    history: game.history.slice(0, -1),
  };
}

export function getConflicts(grid) {
  if (!Array.isArray(grid) || grid.length !== SIZE * SIZE) return new Set();
  const conflicts = new Set();
  const checkGroup = (indexes) => {
    const byValue = new Map();
    for (const index of indexes) {
      const value = grid[index];
      if (!value) continue;
      const cells = byValue.get(value) ?? [];
      cells.push(index);
      byValue.set(value, cells);
    }
    byValue.forEach((cells) => { if (cells.length > 1) cells.forEach((index) => conflicts.add(index)); });
  };
  for (let row = 0; row < SIZE; row += 1) checkGroup(Array.from({ length: SIZE }, (_, column) => row * SIZE + column));
  for (let column = 0; column < SIZE; column += 1) checkGroup(Array.from({ length: SIZE }, (_, row) => row * SIZE + column));
  for (let boxRow = 0; boxRow < SIZE; boxRow += BOX) {
    for (let boxColumn = 0; boxColumn < SIZE; boxColumn += BOX) {
      const indexes = [];
      for (let row = boxRow; row < boxRow + BOX; row += 1) {
        for (let column = boxColumn; column < boxColumn + BOX; column += 1) indexes.push(row * SIZE + column);
      }
      checkGroup(indexes);
    }
  }
  return conflicts;
}

export function updateElapsed(game, elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return game;
  return { ...game, elapsedMs: game.elapsedMs + elapsedMs };
}
