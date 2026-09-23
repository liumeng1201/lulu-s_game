import { BLACK, EMPTY, WHITE, playMove } from "./engine.mjs";

const SIZES = [9, 13, 19];
const validPlayer = (value) => value === BLACK || value === WHITE;
const validPoint = (value, size) => Number.isInteger(value?.row) && value.row >= 0 && value.row < size && Number.isInteger(value?.col) && value.col >= 0 && value.col < size;
const validBoard = (board, size) => Array.isArray(board) && board.length === size && board.every((row) => Array.isArray(row) && row.length === size && row.every((cell) => [EMPTY, BLACK, WHITE].includes(cell)));
const validCaptures = (value) => value && Number.isInteger(value[BLACK]) && value[BLACK] >= 0 && Number.isInteger(value[WHITE]) && value[WHITE] >= 0;

function validSnapshot(value, size) {
  return value && validBoard(value.board, size) && validPlayer(value.currentPlayer) && validCaptures(value.captures)
    // History stores pre-turn snapshots; the game enters scoring immediately after pass two.
    && Number.isInteger(value.consecutivePasses) && value.consecutivePasses >= 0 && value.consecutivePasses <= 1
    && (value.lastMove === null || (validPoint(value.lastMove, size) && value.board[value.lastMove.row][value.lastMove.col] !== EMPTY));
}

function sameBoard(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isNextTurn(before, after, size) {
  if (after.currentPlayer === before.currentPlayer) return false;
  const sameCaptures = after.captures[BLACK] === before.captures[BLACK] && after.captures[WHITE] === before.captures[WHITE];
  if (sameBoard(before.board, after.board)) {
    const normalPass = after.consecutivePasses === before.consecutivePasses + 1;
    const resumedAfterTwoPasses = before.consecutivePasses === 1 && after.consecutivePasses === 0;
    return sameCaptures && after.lastMove === null && (normalPass || resumedAfterTwoPasses);
  }
  if (after.consecutivePasses !== 0 || !validPoint(after.lastMove, size)) return false;
  const played = playMove(before.board, after.lastMove.row, after.lastMove.col, before.currentPlayer);
  if (!played.legal || !sameBoard(played.board, after.board)) return false;
  const opponent = before.currentPlayer === BLACK ? WHITE : BLACK;
  return after.captures[before.currentPlayer] === before.captures[before.currentPlayer] + played.captured.length
    && after.captures[opponent] === before.captures[opponent];
}

function validHistory(value) {
  if (!value.history.length) {
    return value.currentPlayer === BLACK && value.consecutivePasses === 0 && value.lastMove == null
      && value.captures[BLACK] === 0 && value.captures[WHITE] === 0
      && value.board.every((row) => row.every((cell) => cell === EMPTY));
  }
  const first = value.history[0];
  if (first.currentPlayer !== BLACK || first.consecutivePasses !== 0 || first.lastMove !== null
    || first.captures[BLACK] !== 0 || first.captures[WHITE] !== 0
    || !first.board.every((row) => row.every((cell) => cell === EMPTY))) return false;
  for (let index = 1; index < value.history.length; index += 1) {
    if (!isNextTurn(value.history[index - 1], value.history[index], value.size)) return false;
  }
  const previous = value.history.at(-1);
  const scoringOrFinished = value.scoring || value.resultOpen || value.settingsOpen;
  const scoreReviewState = scoringOrFinished && previous.consecutivePasses === 1 && value.consecutivePasses === 2
    && sameBoard(previous.board, value.board)
    && value.captures[BLACK] === previous.captures[BLACK] && value.captures[WHITE] === previous.captures[WHITE]
    && value.lastMove == null
    && value.currentPlayer === (value.scoringConfirmations.length ? previous.currentPlayer : (previous.currentPlayer === BLACK ? WHITE : BLACK));
  return isNextTurn(previous, value, value.size) || scoreReviewState;
}

export function validateGoSave(value) {
  if (!value || value.version !== 1 || !SIZES.includes(value.size) || !validBoard(value.board, value.size) || !["pvp", "ai"].includes(value.mode)
    || !validPlayer(value.currentPlayer) || !validCaptures(value.captures)
    || !Number.isInteger(value.consecutivePasses) || value.consecutivePasses < 0 || value.consecutivePasses > 2) return null;
  if (!Array.isArray(value.history) || !value.history.every((item) => validSnapshot(item, value.size)) || !validCaptures(value.captures)) return null;
  if (!validHistory(value)) return null;
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
  if ((running && value.consecutivePasses > 1) || (scoring && value.consecutivePasses !== 2) || (resultOpen && value.consecutivePasses !== 2)) return null;
  if (!scoring && !resultOpen && !settingsOpen && value.scoringConfirmations.length) return null;
  if (!scoring && !resultOpen && !settingsOpen && value.deadStones.length) return null;
  if (resultOpen && new Set(value.scoringConfirmations).size !== 2) return null;
  if (value.lastMove != null && (!validPoint(value.lastMove, value.size) || value.board[value.lastMove.row][value.lastMove.col] === EMPTY)) return null;
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
