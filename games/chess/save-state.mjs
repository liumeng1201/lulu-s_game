import { BLACK, BOARD_SIZE, WHITE, applyMove, createBoard, getAutomaticDrawReason, getGameStatus, initialPosition, movesEqual, otherColor, generateLegalMoves, positionKey, typeOf } from "./engine.mjs";

const validColor = (value) => value === WHITE || value === BLACK;
const validPoint = (point) => Number.isInteger(point?.row) && Number.isInteger(point?.col) && point.row >= 0 && point.row < BOARD_SIZE && point.col >= 0 && point.col < BOARD_SIZE;
const validMove = (move) => validPoint(move?.from) && validPoint(move?.to) && (move.promotion == null || ["Q", "R", "B", "N"].includes(move.promotion));
const cloneMove = (move) => ({ from: { ...move.from }, to: { ...move.to }, ...(move.promotion ? { promotion: move.promotion } : {}) });

function replay(history) {
  let board = createBoard(); let position = initialPosition(); let currentPlayer = WHITE; let halfmoveClock = 0;
  const positionHistory = [positionKey(board, position, currentPlayer)];
  for (const storedMove of history) {
    const legal = generateLegalMoves(board, position, currentPlayer);
    const move = legal.find((candidate) => movesEqual(candidate, storedMove));
    if (!move || (storedMove.promotion && !move.promotion)) return null;
    const result = applyMove(board, position, { ...move, promotion: storedMove.promotion ?? move.promotion });
    halfmoveClock = typeOf(result.piece) === "P" || result.captured ? 0 : halfmoveClock + 1;
    ({ board, position } = result); currentPlayer = otherColor(currentPlayer);
    positionHistory.push(positionKey(board, position, currentPlayer));
  }
  return { board, position, currentPlayer, halfmoveClock, positionHistory };
}

function outcome(replayed) {
  const standard = getGameStatus(replayed.board, replayed.position, replayed.currentPlayer);
  if (standard.finished) return standard;
  const drawReason = getAutomaticDrawReason(replayed.positionHistory, replayed.halfmoveClock);
  if (drawReason) return { finished: true, winner: null, reason: drawReason };
  return standard;
}

export function validateChessSave(value) {
  if (!value || ![1, 2].includes(value.version) || !["pvp", "ai"].includes(value.mode) || !Array.isArray(value.history) || value.history.length > 400 || !value.history.every(validMove)) return null;
  const replayed = replay(value.history); if (!replayed) return null;
  const result = outcome(replayed); const isLegacy = value.version === 1;
  if (JSON.stringify(value.board) !== JSON.stringify(replayed.board) || JSON.stringify(value.position) !== JSON.stringify(replayed.position) || value.currentPlayer !== replayed.currentPlayer) return null;
  if (!isLegacy && (value.halfmoveClock !== replayed.halfmoveClock || JSON.stringify(value.positionHistory) !== JSON.stringify(replayed.positionHistory))) return null;
  const drawOfferBy = value.drawOfferBy == null ? null : value.drawOfferBy;
  if (!isLegacy && drawOfferBy !== null && !validColor(drawOfferBy)) return null;
  if (drawOfferBy && (value.mode !== "pvp" || drawOfferBy === replayed.currentPlayer || result.finished)) return null;
  const agreed = value.reason === "agreement";
  if (agreed && (!isLegacy && !drawOfferBy && value.running)) return null;
  const finalResult = agreed ? { finished: true, winner: null, reason: "agreement" } : result;
  if ((value.winner ?? null) !== finalResult.winner || (value.reason ?? null) !== finalResult.reason) return null;
  let running = Boolean(value.running); let modeOpen = Boolean(value.modeOpen); let resultOpen = Boolean(value.resultOpen);
  if (isLegacy && finalResult.finished && running) { running = false; resultOpen = true; }
  if ((running && (finalResult.finished || modeOpen || resultOpen)) || (modeOpen && resultOpen) || (resultOpen && !finalResult.finished)) return null;
  const cursor = validPoint(value.cursor) ? { ...value.cursor } : { row: 7, col: 0 };
  return {
    version: 2, mode: value.mode, difficulty: ["easy", "medium", "hard"].includes(value.difficulty) ? value.difficulty : "medium",
    ...replayed, history: value.history.map(cloneMove), running, winner: finalResult.winner, reason: finalResult.reason,
    soundOn: value.soundOn !== false, cursor, modeOpen, resultOpen, drawOfferBy: isLegacy ? null : drawOfferBy,
  };
}
