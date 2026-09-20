import { BLACK, BOARD_SIZE, EMPTY, WHITE } from "./engine.mjs";

const validPlayer = (value) => value === BLACK || value === WHITE;
const validPoint = (value) => Number.isInteger(value?.row) && value.row >= 0 && value.row < BOARD_SIZE && Number.isInteger(value?.col) && value.col >= 0 && value.col < BOARD_SIZE;
const validBoard = (board) => Array.isArray(board) && board.length === BOARD_SIZE && board.every((row) => Array.isArray(row) && row.length === BOARD_SIZE && row.every((cell) => [EMPTY, BLACK, WHITE].includes(cell)));

export function validateGomokuSave(value) {
  if (!value || value.version !== 1 || !validBoard(value.board) || !["pvp", "ai"].includes(value.mode)) return null;
  if (!Array.isArray(value.history) || !value.history.every((move) => validPoint(move) && validPlayer(move.player))) return null;
  if (!Array.isArray(value.winningLine) || !value.winningLine.every((point) => Array.isArray(point) && point.length === 2 && point.every((part) => Number.isInteger(part) && part >= 0 && part < BOARD_SIZE))) return null;
  const cursor = validPoint(value.cursor) ? { row: value.cursor.row, col: value.cursor.col } : { row: 7, col: 7 };
  return {
    version: 1, mode: value.mode, difficulty: ["easy", "medium", "hard"].includes(value.difficulty) ? value.difficulty : "medium",
    board: value.board.map((row) => [...row]), currentPlayer: validPlayer(value.currentPlayer) ? value.currentPlayer : BLACK,
    running: Boolean(value.running), winner: validPlayer(value.winner) ? value.winner : null,
    winningLine: value.winningLine.map((point) => [...point]), history: value.history.map((move) => ({ row: move.row, col: move.col, player: move.player })),
    soundOn: value.soundOn !== false, cursor, modeOpen: Boolean(value.modeOpen), resultOpen: Boolean(value.resultOpen),
  };
}
