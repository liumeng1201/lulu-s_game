import { BOARD_SIZE, ICON_COUNT, PAIR_COUNT, ROUND_DURATION_MS, STARTING_HINTS } from "./engine.mjs";

const TILE_VALUES = new Set(Array.from({ length: ICON_COUNT }, (_, index) => index));
const STATUSES = new Set(["playing", "paused", "won", "lost"]);

export function validateLinkLinkGame(value) {
  if (!value || !Array.isArray(value.board) || value.board.length !== BOARD_SIZE
    || !value.board.every((row) => Array.isArray(row) && row.length === BOARD_SIZE
      && row.every((tile) => tile === null || TILE_VALUES.has(tile)))
    || !STATUSES.has(value.status) || !Number.isInteger(value.remainingMs)
    || value.remainingMs < 0 || value.remainingMs > ROUND_DURATION_MS
    || !Number.isInteger(value.selected) && value.selected !== null
    || value.selected !== null && (value.selected < 0 || value.selected >= BOARD_SIZE ** 2)
    || !Number.isInteger(value.hintsLeft) || value.hintsLeft < 0 || value.hintsLeft > STARTING_HINTS
    || !Number.isInteger(value.matches) || value.matches < 0 || value.matches > PAIR_COUNT
    || !Number.isInteger(value.mistakes) || value.mistakes < 0
    || ![null, "manual", "limit"].includes(value.pauseReason)) return null;

  const counts = new Map();
  let tileCount = 0;
  value.board.forEach((row) => row.forEach((tile) => {
    if (tile === null) return;
    tileCount += 1;
    counts.set(tile, (counts.get(tile) ?? 0) + 1);
  }));
  if ([...counts.values()].some((count) => count !== 2) || tileCount !== (PAIR_COUNT - value.matches) * 2) return null;
  if (value.selected !== null && value.board[Math.floor(value.selected / BOARD_SIZE)][value.selected % BOARD_SIZE] === null) return null;

  const paused = value.status === "paused";
  if ((paused && !["manual", "limit"].includes(value.pauseReason)) || (!paused && value.pauseReason !== null)) return null;
  if (value.status === "playing" && (value.remainingMs <= 0 || value.matches === PAIR_COUNT)) return null;
  if (value.status === "paused" && (value.remainingMs <= 0 || value.matches === PAIR_COUNT)) return null;
  if (value.status === "won" && (value.matches !== PAIR_COUNT || value.remainingMs <= 0 || value.selected !== null)) return null;
  if (value.status === "lost" && (value.remainingMs !== 0 || value.matches === PAIR_COUNT || value.selected !== null)) return null;

  return {
    board: value.board.map((row) => [...row]),
    status: value.status,
    remainingMs: value.remainingMs,
    selected: value.selected,
    hintsLeft: value.hintsLeft,
    matches: value.matches,
    mistakes: value.mistakes,
    pauseReason: value.pauseReason,
  };
}

export function validateLinkLinkSave(value) {
  if (!value || value.version !== 1) return null;
  if (value.currentGame == null) return { version: 1, currentGame: null };
  const game = validateLinkLinkGame(value.currentGame);
  return game ? { version: 1, currentGame: game } : null;
}

export function createDefaultSave() {
  return { version: 1, currentGame: null };
}
