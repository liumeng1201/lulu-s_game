import { BOARD_SIZE, EMPTY, O, X, createBoard, getOutcome } from "./engine.mjs";

const validPlayer = (value) => value === X || value === O;
const validPoint = (value) => Number.isInteger(value?.row) && value.row >= 0 && value.row < BOARD_SIZE
  && Number.isInteger(value?.col) && value.col >= 0 && value.col < BOARD_SIZE;

export function validateTicTacToeSave(value) {
  if (!value || value.version !== 1 || !["pvp", "ai"].includes(value.mode) || !["easy", "medium", "hard"].includes(value.difficulty)) return null;
  if (!Array.isArray(value.history) || value.history.length > BOARD_SIZE ** 2 || !value.history.every((move) => validPoint(move) && validPlayer(move.player))) return null;
  const board = createBoard();
  for (let index = 0; index < value.history.length; index += 1) {
    const move = value.history[index];
    const expectedPlayer = index % 2 === 0 ? X : O;
    if (move.player !== expectedPlayer || board[move.row][move.col] !== EMPTY || getOutcome(board)) return null;
    board[move.row][move.col] = move.player;
  }
  if (!Array.isArray(value.board) || JSON.stringify(value.board) !== JSON.stringify(board)) return null;
  const outcome = getOutcome(board);
  if ((outcome?.winner ?? null) !== value.winner) return null;
  if (!Array.isArray(value.winningLine) || JSON.stringify(value.winningLine) !== JSON.stringify(outcome?.line ?? [])) return null;
  const expectedPlayer = outcome ? value.history.at(-1)?.player ?? X : value.history.length % 2 === 0 ? X : O;
  if (value.currentPlayer !== expectedPlayer || !validPoint(value.cursor)) return null;
  const running = Boolean(value.running); const modeOpen = Boolean(value.modeOpen); const resultOpen = Boolean(value.resultOpen);
  if ((running && (outcome || modeOpen || resultOpen)) || (modeOpen && resultOpen) || (resultOpen && !outcome)) return null;
  return {
    version: 1, mode: value.mode, difficulty: value.difficulty, board: board.map((row) => [...row]),
    currentPlayer: value.currentPlayer, running, winner: value.winner, winningLine: (outcome?.line ?? []).map((point) => [...point]),
    history: value.history.map((move) => ({ row: move.row, col: move.col, player: move.player })), soundOn: value.soundOn !== false,
    cursor: { row: value.cursor.row, col: value.cursor.col }, modeOpen, resultOpen,
  };
}
