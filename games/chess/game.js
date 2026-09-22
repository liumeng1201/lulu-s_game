import { BLACK, WHITE, applyMove, chooseAiMove, colorOf, createBoard, findKing, generateLegalMoves, getGameStatus, initialPosition, movesEqual, otherColor } from "./engine.mjs";
import { startPlayLimit } from "../../assets/js/play-limit.js";
import { createVersionedGameStore, showSaveConflict } from "../../assets/js/safe-storage.js";
import { validateChessSave } from "./save-state.mjs";

const SAVE_KEY = "lulu-chess-save-v1";
const names = { [WHITE]: "白方", [BLACK]: "黑方" };
const difficultyNames = { easy: "简单", medium: "中等", hard: "困难" };
const pieceSymbols = { wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙", bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟" };
const ids = ["board", "modePanel", "difficultyGroup", "startButton", "resultPanel", "resultEmoji", "resultTitle", "resultMessage", "restartButton", "resultModeButton", "undoButton", "restartControl", "modeButton", "soundButton", "modeBadge", "turnText", "whiteCard", "blackCard", "whiteName", "blackName", "promotionPanel"];
const elements = Object.fromEntries(ids.map((id) => [id, document.querySelector(`#${id}`)]));
const state = { mode: "pvp", difficulty: "medium", board: createBoard(), position: initialPosition(), currentPlayer: WHITE, history: [], running: false, thinking: false, winner: null, reason: null, selected: null, cursor: { row: 7, col: 0 }, soundOn: true, aiRequestId: 0 };
let audioContext; let aiWorker; let pendingPromotion = null; let resumeAiAfterLimit = false;
const gameStore = createVersionedGameStore({ key: SAVE_KEY, validate: validateChessSave, storage: localStorage, sessionStorage, onConflict: showSaveConflict });

function saveGame() {
  gameStore.save({ version: 1, mode: state.mode, difficulty: state.difficulty, board: state.board, position: state.position, currentPlayer: state.currentPlayer, history: state.history, running: state.running, winner: state.winner, reason: state.reason, soundOn: state.soundOn, cursor: state.cursor, modeOpen: !elements.modePanel.classList.contains("hidden"), resultOpen: !elements.resultPanel.classList.contains("hidden") });
}

function playTone(frequency, duration = .1, type = "sine") {
  if (!state.soundOn) return;
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain();
  oscillator.type = type; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.08, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration); oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
}

function currentStatus() { return getGameStatus(state.board, state.position, state.currentPlayer); }
function selectedMoves() { return state.selected ? generateLegalMoves(state.board, state.position, state.currentPlayer).filter((move) => movesEqual(move, { from: state.selected, to: move.to })) : []; }
function lastMove() { return state.history.at(-1) ?? null; }

function updateStatus() {
  elements.whiteCard.classList.toggle("active", state.running && state.currentPlayer === WHITE);
  elements.blackCard.classList.toggle("active", state.running && state.currentPlayer === BLACK);
  elements.modeBadge.textContent = state.mode === "ai" ? `人机 · ${difficultyNames[state.difficulty]}` : "人人对战";
  elements.whiteName.textContent = state.mode === "ai" ? "你" : "玩家一";
  elements.blackName.textContent = state.mode === "ai" ? "电脑" : "玩家二";
  const status = state.running ? currentStatus() : null;
  elements.turnText.textContent = state.thinking ? "电脑正在思考…" : state.running ? `${names[state.currentPlayer]}回合${status?.check ? " · 将军！" : ""}` : "准备开始";
  elements.undoButton.disabled = !state.history.length || state.thinking || Boolean(pendingPromotion);
}

function renderBoard() {
  const legal = state.running && !state.thinking ? generateLegalMoves(state.board, state.position, state.currentPlayer) : [];
  const selected = state.selected ? legal.filter((move) => move.from.row === state.selected.row && move.from.col === state.selected.col) : [];
  const checkedKing = state.running && currentStatus().check ? findKing(state.board, state.currentPlayer) : null;
  const last = lastMove(); elements.board.replaceChildren();
  state.board.forEach((line, row) => line.forEach((piece, col) => {
    const cell = document.createElement("button"); const target = selected.find((move) => move.to.row === row && move.to.col === col);
    cell.type = "button"; cell.tabIndex = -1; cell.className = `cell ${(row + col) % 2 ? "dark" : "light"}${piece ? ` ${colorOf(piece) === WHITE ? "white-piece" : "black-piece"}` : ""}${state.selected?.row === row && state.selected?.col === col ? " selected" : ""}${target ? ` ${piece ? "capture" : "target"}` : ""}${(last?.from.row === row && last?.from.col === col) || (last?.to.row === row && last?.to.col === col) ? " last" : ""}${checkedKing?.row === row && checkedKing?.col === col ? " check" : ""}`;
    cell.textContent = pieceSymbols[piece] ?? ""; cell.setAttribute("role", "gridcell"); cell.setAttribute("aria-label", `${8 - row}行${String.fromCharCode(65 + col)}列${piece ? `，${colorOf(piece) === WHITE ? "白" : "黑"}${({ K: "王", Q: "后", R: "车", B: "象", N: "马", P: "兵" })[piece[1]]}` : "，空格"}`);
    cell.disabled = !state.running || state.thinking || Boolean(pendingPromotion); cell.addEventListener("click", () => { state.cursor = { row, col }; handleSquare(row, col); if (state.running) elements.board.focus(); }); elements.board.append(cell);
  }));
  elements.board.setAttribute("aria-activedescendant", `cell-${state.cursor.row}-${state.cursor.col}`); const active = elements.board.children[state.cursor.row * 8 + state.cursor.col]; if (active) active.id = `cell-${state.cursor.row}-${state.cursor.col}`;
}

function showResult(withSound = true) {
  const playerWon = state.mode !== "ai" || state.winner === WHITE;
  if (state.reason === "checkmate") { elements.resultEmoji.textContent = playerWon ? "🎉" : "🌟"; elements.resultTitle.textContent = state.mode === "ai" ? (state.winner === WHITE ? "你赢啦！" : "电脑获胜") : `${names[state.winner]}获胜！`; elements.resultMessage.textContent = playerWon ? "漂亮的将杀，太厉害啦！" : "这一步很精彩，再挑战一次吧！"; if (withSound) playTone(playerWon ? 660 : 260, .4, "triangle"); }
  else { elements.resultEmoji.textContent = "🤝"; elements.resultTitle.textContent = "平局！"; elements.resultMessage.textContent = state.reason === "stalemate" ? "没有合法走法，但王没有被将军。" : "棋盘上剩余子力不足以将死。"; if (withSound) playTone(400, .3); }
  elements.resultPanel.classList.remove("hidden"); elements.restartButton.focus();
}

function finishGame(status) { state.running = false; state.thinking = false; state.winner = status.winner; state.reason = status.reason; state.selected = null; pendingPromotion = null; elements.promotionPanel.classList.add("hidden"); showResult(); renderBoard(); updateStatus(); saveGame(); }

function commitMove(candidate, promotion = candidate.promotion) {
  const move = { from: { ...candidate.from }, to: { ...candidate.to }, ...(promotion ? { promotion } : {}) }; const result = applyMove(state.board, state.position, move);
  state.board = result.board; state.position = result.position; state.history.push(move); state.currentPlayer = otherColor(state.currentPlayer); state.cursor = { ...move.to }; state.selected = null; pendingPromotion = null; elements.promotionPanel.classList.add("hidden"); playTone(result.captured ? 430 : 300, .11, "triangle");
  const status = currentStatus(); if (status.finished) { finishGame(status); return true; }
  renderBoard(); updateStatus(); saveGame(); if (state.mode === "ai" && state.currentPlayer === BLACK) requestAiMove(); return true;
}

function handleSquare(row, col) {
  if (!state.running || state.thinking || pendingPromotion) return;
  const piece = state.board[row][col]; const legal = generateLegalMoves(state.board, state.position, state.currentPlayer);
  const selectedMove = state.selected && legal.find((move) => move.from.row === state.selected.row && move.from.col === state.selected.col && move.to.row === row && move.to.col === col);
  if (selectedMove) {
    if (state.board[state.selected.row][state.selected.col]?.[1] === "P" && (row === 0 || row === 7)) { pendingPromotion = selectedMove; elements.promotionPanel.classList.remove("hidden"); updateStatus(); return; }
    commitMove(selectedMove); return;
  }
  if (colorOf(piece) === state.currentPlayer) { state.selected = { row, col }; renderBoard(); updateStatus(); }
  else if (state.selected) { state.selected = null; renderBoard(); }
}

function restartAiWorker() {
  aiWorker?.terminate(); aiWorker = new Worker(new URL("./ai-worker.js", import.meta.url), { type: "module" });
  aiWorker.addEventListener("message", ({ data }) => { if (data.requestId !== state.aiRequestId || !state.running || state.currentPlayer !== BLACK) return; state.thinking = false; if (data.move) commitMove(data.move); });
}
function cancelAi() { state.aiRequestId += 1; state.thinking = false; restartAiWorker(); }
function requestAiMove() { state.thinking = true; updateStatus(); renderBoard(); saveGame(); const requestId = ++state.aiRequestId; aiWorker.postMessage({ requestId, board: state.board, position: state.position, difficulty: state.difficulty, color: BLACK }); }

function resetGame() { cancelAi(); Object.assign(state, { board: createBoard(), position: initialPosition(), currentPlayer: WHITE, history: [], running: true, thinking: false, winner: null, reason: null, selected: null, cursor: { row: 7, col: 0 } }); pendingPromotion = null; elements.promotionPanel.classList.add("hidden"); elements.modePanel.classList.add("hidden"); elements.resultPanel.classList.add("hidden"); renderBoard(); updateStatus(); elements.board.focus(); saveGame(); }
function showModePanel() { cancelAi(); state.running = false; state.selected = null; pendingPromotion = null; elements.promotionPanel.classList.add("hidden"); elements.resultPanel.classList.add("hidden"); elements.modePanel.classList.remove("hidden"); renderBoard(); updateStatus(); saveGame(); }

function replayHistory() { let board = createBoard(); let position = initialPosition(); let player = WHITE; for (const storedMove of state.history) { const move = generateLegalMoves(board, position, player).find((candidate) => movesEqual(candidate, storedMove)); if (!move) return false; ({ board, position } = applyMove(board, position, { ...move, promotion: storedMove.promotion ?? move.promotion })); player = otherColor(player); } state.board = board; state.position = position; state.currentPlayer = player; return true; }
function undo() { if (!state.history.length || state.thinking || pendingPromotion) return; cancelAi(); elements.resultPanel.classList.add("hidden"); const count = state.mode === "ai" && state.history.length >= 2 ? 2 : 1; state.history.splice(Math.max(0, state.history.length - count), count); replayHistory(); state.running = true; state.winner = null; state.reason = null; state.selected = null; renderBoard(); updateStatus(); elements.board.focus(); saveGame(); }

function restoreUi(value) {
  document.querySelectorAll("[data-mode]").forEach((button) => { const selected = button.dataset.mode === state.mode; button.classList.toggle("selected", selected); button.setAttribute("aria-pressed", selected); }); document.querySelectorAll("[data-difficulty]").forEach((button) => { const selected = button.dataset.difficulty === state.difficulty; button.classList.toggle("selected", selected); button.setAttribute("aria-pressed", selected); }); elements.difficultyGroup.classList.toggle("hidden", state.mode !== "ai"); if (value) { elements.modePanel.classList.toggle("hidden", !value.modeOpen); elements.resultPanel.classList.toggle("hidden", !value.resultOpen); if (value.resultOpen) showResult(false); } elements.soundButton.textContent = state.soundOn ? "🔊" : "🔇"; elements.soundButton.setAttribute("aria-label", state.soundOn ? "关闭声音" : "打开声音"); renderBoard(); updateStatus(); if (state.running && state.mode === "ai" && state.currentPlayer === BLACK) requestAiMove();
}

document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => { state.mode = button.dataset.mode; document.querySelectorAll("[data-mode]").forEach((item) => { const selected = item === button; item.classList.toggle("selected", selected); item.setAttribute("aria-pressed", selected); }); elements.difficultyGroup.classList.toggle("hidden", state.mode !== "ai"); updateStatus(); saveGame(); }));
document.querySelectorAll("[data-difficulty]").forEach((button) => button.addEventListener("click", () => { state.difficulty = button.dataset.difficulty; document.querySelectorAll("[data-difficulty]").forEach((item) => { const selected = item === button; item.classList.toggle("selected", selected); item.setAttribute("aria-pressed", selected); }); saveGame(); }));
document.querySelectorAll("[data-promotion]").forEach((button) => button.addEventListener("click", () => { if (pendingPromotion) commitMove(pendingPromotion, button.dataset.promotion); }));
elements.board.addEventListener("keydown", (event) => { const offsets = { ArrowUp: [-1,0], ArrowDown: [1,0], ArrowLeft: [0,-1], ArrowRight: [0,1] }; if (offsets[event.key]) { event.preventDefault(); state.cursor.row = Math.max(0, Math.min(7, state.cursor.row + offsets[event.key][0])); state.cursor.col = Math.max(0, Math.min(7, state.cursor.col + offsets[event.key][1])); renderBoard(); } if (["Enter", " "].includes(event.key)) { event.preventDefault(); handleSquare(state.cursor.row, state.cursor.col); } });
elements.startButton.addEventListener("click", resetGame); elements.restartButton.addEventListener("click", resetGame); elements.restartControl.addEventListener("click", resetGame); elements.undoButton.addEventListener("click", undo); elements.modeButton.addEventListener("click", showModePanel); elements.resultModeButton.addEventListener("click", showModePanel); elements.soundButton.addEventListener("click", () => { state.soundOn = !state.soundOn; elements.soundButton.textContent = state.soundOn ? "🔊" : "🔇"; elements.soundButton.setAttribute("aria-label", state.soundOn ? "关闭声音" : "打开声音"); saveGame(); });
const savedGame = gameStore.load(); if (savedGame) Object.assign(state, { mode: savedGame.mode, difficulty: savedGame.difficulty, board: savedGame.board, position: savedGame.position, currentPlayer: savedGame.currentPlayer, history: savedGame.history, running: savedGame.running, winner: savedGame.winner, reason: savedGame.reason, soundOn: savedGame.soundOn, cursor: savedGame.cursor }); restartAiWorker(); restoreUi(savedGame); window.addEventListener("pagehide", saveGame);
function lockGame() { saveGame(); resumeAiAfterLimit = state.running && state.mode === "ai" && state.currentPlayer === BLACK; cancelAi(); updateStatus(); }
function resumeGameAfterLimit() { if (resumeAiAfterLimit && state.running && state.currentPlayer === BLACK) requestAiMove(); resumeAiAfterLimit = false; saveGame(); }
startPlayLimit({ onLock: lockGame, onResume: resumeGameAfterLimit });
