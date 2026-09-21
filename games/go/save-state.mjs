import { BLACK, EMPTY, WHITE } from "./engine.mjs";

const SIZES = [9, 13, 19];
const validPlayer = (value) => value === BLACK || value === WHITE;
const validPoint = (value, size) => Number.isInteger(value?.row) && value.row >= 0 && value.row < size && Number.isInteger(value?.col) && value.col >= 0 && value.col < size;
const validBoard = (board, size) => Array.isArray(board) && board.length === size && board.every((row) => Array.isArray(row) && row.length === size && row.every((cell) => [EMPTY, BLACK, WHITE].includes(cell)));
const validCaptures = (value) => value && Number.isInteger(value[BLACK]) && value[BLACK] >= 0 && Number.isInteger(value[WHITE]) && value[WHITE] >= 0;

function validSnapshot(value, size) {
  return value && validBoard(value.board, size) && validPlayer(value.currentPlayer) && validCaptures(value.captures)
    && Number.isInteger(value.consecutivePasses) && value.consecutivePasses >= 0 && value.consecutivePasses <= 2
    && (value.lastMove === null || validPoint(value.lastMove, size));
}

export function validateGoSave(value) {
  if (!value || value.version !== 1 || !SIZES.includes(value.size) || !validBoard(value.board, value.size) || !["pvp", "ai"].includes(value.mode)) return null;
  if (!Array.isArray(value.history) || !value.history.every((item) => validSnapshot(item, value.size)) || !validCaptures(value.captures)) return null;
  const validStoredPoint = (point) => {
    if (typeof point !== "string") return false;
    const parts = point.split(",");
    return parts.length === 2 && parts.every((part) => /^\d+$/.test(part)) && parts.map(Number).every((part) => part >= 0 && part < value.size);
  };
  if (!Array.isArray(value.deadStones) || !value.deadStones.every(validStoredPoint)) return null;
  if (value.deadStones.some((point) => { const [row, col] = point.split(",").map(Number); return value.board[row][col] === EMPTY; })) return null;
  if (!Array.isArray(value.scoringConfirmations) || !value.scoringConfirmations.every(validPlayer)) return null;
  const running = Boolean(value.running); const settingsOpen = Boolean(value.settingsOpen); const scoring = Boolean(value.scoring); const resultOpen = Boolean(value.resultOpen);
  if ((running && (settingsOpen || scoring || resultOpen)) || (settingsOpen && (scoring || resultOpen)) || (scoring && resultOpen)) return null;
  if (!scoring && !resultOpen && value.scoringConfirmations.length) return null;
  if (!scoring && !resultOpen && value.deadStones.length) return null;
  const cursor = validPoint(value.cursor, value.size) ? { ...value.cursor } : { row: Math.floor(value.size / 2), col: Math.floor(value.size / 2) };
  const draft = value.draft && ["pvp", "ai"].includes(value.draft.mode) && SIZES.includes(value.draft.size)
    ? { mode: value.draft.mode, difficulty: ["easy", "medium", "hard"].includes(value.draft.difficulty) ? value.draft.difficulty : "medium", size: value.draft.size }
    : { mode: value.mode, difficulty: value.difficulty, size: value.size };
  return {
    ...value, difficulty: ["easy", "medium", "hard"].includes(value.difficulty) ? value.difficulty : "medium",
    board: value.board.map((row) => [...row]), currentPlayer: validPlayer(value.currentPlayer) ? value.currentPlayer : BLACK,
    running, history: value.history.map((item) => ({ ...item, board: item.board.map((row) => [...row]), captures: { ...item.captures }, lastMove: item.lastMove && { ...item.lastMove } })),
    captures: { ...value.captures }, consecutivePasses: Number.isInteger(value.consecutivePasses) ? Math.max(0, Math.min(2, value.consecutivePasses)) : 0,
    soundOn: value.soundOn !== false, cursor, lastMove: value.lastMove && validPoint(value.lastMove, value.size) ? { ...value.lastMove } : null,
    settingsOpen, scoring, deadStones: [...value.deadStones],
    scoringConfirmations: [...new Set(value.scoringConfirmations)], draft, resultOpen,
    notice: typeof value.notice === "string" ? value.notice.slice(0, 300) : "",
  };
}
