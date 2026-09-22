import { BLACK, BOARD_SIZE, WHITE, applyMove, createBoard, getGameStatus, initialPosition, movesEqual, otherColor, generateLegalMoves } from "./engine.mjs";

const validColor = (value) => value === WHITE || value === BLACK;
const validPoint = (point) => Number.isInteger(point?.row) && Number.isInteger(point?.col) && point.row >= 0 && point.row < BOARD_SIZE && point.col >= 0 && point.col < BOARD_SIZE;
const validMove = (move) => validPoint(move?.from) && validPoint(move?.to) && (move.promotion == null || ["Q", "R", "B", "N"].includes(move.promotion));
const cloneMove = (move) => ({ from: { ...move.from }, to: { ...move.to }, ...(move.promotion ? { promotion: move.promotion } : {}) });

export function validateChessSave(value) {
  if (!value || value.version !== 1 || !["pvp", "ai"].includes(value.mode) || !Array.isArray(value.history) || value.history.length > 400 || !value.history.every(validMove)) return null;
  let board = createBoard(); let position = initialPosition(); let currentPlayer = WHITE;
  for (const storedMove of value.history) {
    const legal = generateLegalMoves(board, position, currentPlayer);
    const move = legal.find((candidate) => movesEqual(candidate, storedMove));
    if (!move) return null;
    ({ board, position } = applyMove(board, position, { ...move, promotion: storedMove.promotion ?? move.promotion }));
    currentPlayer = otherColor(currentPlayer);
  }
  const status = getGameStatus(board, position, currentPlayer);
  if (JSON.stringify(value.board) !== JSON.stringify(board) || JSON.stringify(value.position) !== JSON.stringify(position) || value.currentPlayer !== currentPlayer) return null;
  if ((value.winner ?? null) !== status.winner || (value.reason ?? null) !== status.reason) return null;
  const running = Boolean(value.running); const modeOpen = Boolean(value.modeOpen); const resultOpen = Boolean(value.resultOpen);
  if ((running && (status.finished || modeOpen || resultOpen)) || (modeOpen && resultOpen) || (resultOpen && !status.finished)) return null;
  const cursor = validPoint(value.cursor) ? { ...value.cursor } : { row: 7, col: 0 };
  return {
    version: 1, mode: value.mode, difficulty: ["easy", "medium", "hard"].includes(value.difficulty) ? value.difficulty : "medium",
    board, position, currentPlayer, history: value.history.map(cloneMove), running, winner: status.winner,
    reason: status.reason, soundOn: value.soundOn !== false, cursor, modeOpen, resultOpen,
  };
}
