import { BLACK, BOARD_SIZE, EMPTY, WHITE, checkWin, createBoard, isBoardFull } from "./engine.mjs";

const validPlayer = (value) => value === BLACK || value === WHITE;
const validPoint = (value) => Number.isInteger(value?.row) && value.row >= 0 && value.row < BOARD_SIZE
  && Number.isInteger(value?.col) && value.col >= 0 && value.col < BOARD_SIZE;

export function validateGomokuSave(value) {
  if (!value || value.version !== 1 || !["pvp", "ai"].includes(value.mode)) return null;
  if (!Array.isArray(value.history) || value.history.length > BOARD_SIZE ** 2 || !value.history.every((move) => validPoint(move) && validPlayer(move.player))) return null;
  const board = createBoard(); let winningLine = []; let winner = null;
  for (let index = 0; index < value.history.length; index += 1) {
    const move = value.history[index]; const expected = index % 2 === 0 ? BLACK : WHITE;
    if (move.player !== expected || board[move.row][move.col] !== EMPTY || winner) return null;
    board[move.row][move.col] = move.player;
    const line = checkWin(board, move.row, move.col, move.player);
    if (line) { winner = move.player; winningLine = line; }
  }
  if (!Array.isArray(value.board) || JSON.stringify(value.board) !== JSON.stringify(board)) return null;
  if ((value.winner ?? null) !== winner || JSON.stringify(value.winningLine) !== JSON.stringify(winningLine)) return null;
  const finished = Boolean(winner) || isBoardFull(board);
  const expectedPlayer = finished ? value.history.at(-1)?.player ?? BLACK : value.history.length % 2 === 0 ? BLACK : WHITE;
  if (value.currentPlayer !== expectedPlayer) return null;
  const cursor = validPoint(value.cursor) ? { row: value.cursor.row, col: value.cursor.col } : { row: 7, col: 7 };
  const running = Boolean(value.running); const modeOpen = Boolean(value.modeOpen); const resultOpen = Boolean(value.resultOpen);
  if ((running && (finished || modeOpen || resultOpen)) || (modeOpen && resultOpen) || (resultOpen && !finished)) return null;
  return {
    version: 1, mode: value.mode, difficulty: ["easy", "medium", "hard"].includes(value.difficulty) ? value.difficulty : "medium",
    board: board.map((row) => [...row]), currentPlayer: value.currentPlayer, running, winner,
    winningLine: winningLine.map((point) => [...point]), history: value.history.map((move) => ({ row: move.row, col: move.col, player: move.player })),
    soundOn: value.soundOn !== false, cursor, modeOpen, resultOpen,
  };
}
