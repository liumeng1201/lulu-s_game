import { BOARD_SIZE, EMPTY, O, X, chooseAiMove, createBoard, getOutcome } from "./engine.mjs";
import { startPlayLimit } from "../../assets/js/play-limit.js";
import { createVersionedGameStore, showSaveConflict } from "../../assets/js/safe-storage.js";
import { validateTicTacToeSave } from "./save-state.mjs";

const SAVE_KEY = "lulu-tic-tac-toe-save-v1";
const names = { [X]: "X", [O]: "O" };
const difficultyNames = { easy: "简单", medium: "中等", hard: "困难" };
const ids = ["board", "modePanel", "difficultyGroup", "startButton", "resultPanel", "resultEmoji", "resultTitle", "resultMessage", "restartButton", "resultModeButton", "undoButton", "restartControl", "modeButton", "soundButton", "modeBadge", "turnText", "xCard", "oCard", "xName", "oName"];
const elements = Object.fromEntries(ids.map((id) => [id, document.querySelector("#" + id)]));
const state = { mode: "pvp", difficulty: "medium", board: createBoard(), currentPlayer: X, running: false, thinking: false, winner: null, winningLine: [], history: [], soundOn: true, cursor: { row: 0, col: 0 }, aiTimer: null };
let audioContext;
let resumeAiAfterLimit = false;

const gameStore = createVersionedGameStore({ key: SAVE_KEY, validate: validateTicTacToeSave, onConflict: showSaveConflict });

function saveGame() {
  return gameStore.save({ version: 1, mode: state.mode, difficulty: state.difficulty, board: state.board, currentPlayer: state.currentPlayer, running: state.running, winner: state.winner, winningLine: state.winningLine, history: state.history, soundOn: state.soundOn, cursor: state.cursor, modeOpen: !elements.modePanel.classList.contains("hidden"), resultOpen: !elements.resultPanel.classList.contains("hidden") });
}

function playTone(frequency, duration = .1, type = "sine") {
  if (!state.soundOn) return;
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain();
  oscillator.type = type; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.08, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
}

function updateStatus() {
  elements.xCard.classList.toggle("active", state.running && state.currentPlayer === X);
  elements.oCard.classList.toggle("active", state.running && state.currentPlayer === O);
  elements.modeBadge.textContent = state.mode === "ai" ? "人机 · " + difficultyNames[state.difficulty] : "人人对战";
  elements.xName.textContent = state.mode === "ai" ? "你" : "玩家一";
  elements.oName.textContent = state.mode === "ai" ? "电脑" : "玩家二";
  elements.turnText.textContent = state.thinking ? "电脑正在思考…" : state.running ? names[state.currentPlayer] + "回合" : "准备开始";
  elements.undoButton.disabled = !state.history.length || state.thinking;
}

function renderBoard() {
  elements.board.replaceChildren();
  const winning = new Set(state.winningLine.map(([row, col]) => row + "," + col));
  state.board.forEach((line, row) => line.forEach((value, col) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.tabIndex = -1;
    cell.className = "cell " + (value === X ? "x" : value === O ? "o" : "") + (winning.has(row + "," + col) ? " winner" : "");
    cell.textContent = value === X ? "×" : value === O ? "○" : "";
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", value ? (row + 1) + "行" + (col + 1) + "列，" + names[value] : (row + 1) + "行" + (col + 1) + "列，空位");
    cell.disabled = !state.running || state.thinking || value !== EMPTY;
    cell.addEventListener("click", () => { state.cursor = { row, col }; placeMark(row, col); if (state.running) elements.board.focus(); });
    elements.board.append(cell);
  }));
  elements.board.setAttribute("aria-activedescendant", "cell-" + state.cursor.row + "-" + state.cursor.col);
  const active = elements.board.children[state.cursor.row * 3 + state.cursor.col];
  if (active) active.id = "cell-" + state.cursor.row + "-" + state.cursor.col;
}

function finishGame(result) {
  state.running = false; state.thinking = false; state.winner = result.winner; state.winningLine = result.line;
  updateResultPanel();
  playTone(result.winner ? (state.mode !== "ai" || result.winner === X ? 660 : 260) : 400, result.winner ? .4 : .3, result.winner ? "triangle" : "sine");
  renderBoard(); updateStatus(); elements.resultPanel.classList.remove("hidden"); elements.restartButton.focus(); saveGame();
}

function updateResultPanel() {
  const playerWon = state.mode !== "ai" || state.winner === X;
  if (state.winner) {
    elements.resultEmoji.textContent = playerWon ? "🎉" : "🌟";
    elements.resultTitle.textContent = state.mode === "ai" ? (playerWon ? "你赢啦！" : "电脑获胜") : names[state.winner] + "获胜！";
    elements.resultMessage.textContent = playerWon ? "漂亮的连线，太厉害啦！" : "这一步很精彩，再挑战一次吧！";
  } else {
    elements.resultEmoji.textContent = "🤝"; elements.resultTitle.textContent = "平局！"; elements.resultMessage.textContent = "棋盘下满了，双方都很厉害！";
  }
}

function placeMark(row, col) {
  if (!state.running || state.thinking || state.board[row]?.[col] !== EMPTY) return false;
  const player = state.currentPlayer;
  state.board[row][col] = player; state.history.push({ row, col, player }); state.cursor = { row, col }; playTone(player === X ? 280 : 390, .1, "triangle");
  const result = getOutcome(state.board);
  if (result) { finishGame(result); return true; }
  state.currentPlayer = player === X ? O : X; renderBoard(); updateStatus(); saveGame();
  if (state.mode === "ai" && state.currentPlayer === O) requestAiMove();
  return true;
}

function requestAiMove() {
  state.thinking = true; updateStatus(); saveGame();
  state.aiTimer = setTimeout(() => { const move = chooseAiMove(state.board, state.difficulty, O); state.thinking = false; if (move && state.running) placeMark(move[0], move[1]); }, 350);
}

function resetGame() {
  clearTimeout(state.aiTimer); state.board = createBoard(); state.currentPlayer = X; state.running = true; state.thinking = false; state.winner = null; state.winningLine = []; state.history = []; state.cursor = { row: 0, col: 0 };
  elements.modePanel.classList.add("hidden"); elements.resultPanel.classList.add("hidden"); renderBoard(); updateStatus(); elements.board.focus(); saveGame();
}

function showModePanel() {
  clearTimeout(state.aiTimer); state.running = false; state.thinking = false; elements.resultPanel.classList.add("hidden"); elements.modePanel.classList.remove("hidden"); updateStatus(); saveGame();
}

function undo() {
  if (!state.history.length || state.thinking) return;
  elements.resultPanel.classList.add("hidden"); state.winner = null; state.winningLine = []; state.running = true;
  const count = state.mode === "ai" && state.history.length >= 2 ? 2 : 1;
  for (let index = 0; index < count; index += 1) { const move = state.history.pop(); if (move) state.board[move.row][move.col] = EMPTY; }
  state.currentPlayer = state.mode === "ai" ? X : (state.history.at(-1)?.player === X ? O : X);
  renderBoard(); updateStatus(); elements.board.focus(); saveGame();
}

function restoreUi(value) {
  document.querySelectorAll("[data-mode]").forEach((button) => { const selected = button.dataset.mode === state.mode; button.classList.toggle("selected", selected); button.setAttribute("aria-pressed", selected); });
  document.querySelectorAll("[data-difficulty]").forEach((button) => { const selected = button.dataset.difficulty === state.difficulty; button.classList.toggle("selected", selected); button.setAttribute("aria-pressed", selected); });
  elements.difficultyGroup.classList.toggle("hidden", state.mode !== "ai");
  if (value) { elements.modePanel.classList.toggle("hidden", !value.modeOpen); elements.resultPanel.classList.toggle("hidden", !value.resultOpen); if (value.resultOpen) updateResultPanel(); }
  elements.soundButton.textContent = state.soundOn ? "🔊" : "🔇"; elements.soundButton.setAttribute("aria-label", state.soundOn ? "关闭声音" : "打开声音"); renderBoard(); updateStatus();
}

document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => { state.mode = button.dataset.mode; document.querySelectorAll("[data-mode]").forEach((item) => { const selected = item === button; item.classList.toggle("selected", selected); item.setAttribute("aria-pressed", selected); }); elements.difficultyGroup.classList.toggle("hidden", state.mode !== "ai"); updateStatus(); saveGame(); }));
document.querySelectorAll("[data-difficulty]").forEach((button) => button.addEventListener("click", () => { state.difficulty = button.dataset.difficulty; document.querySelectorAll("[data-difficulty]").forEach((item) => { const selected = item.dataset.difficulty === state.difficulty; item.classList.toggle("selected", selected); item.setAttribute("aria-pressed", selected); }); updateStatus(); saveGame(); }));
elements.board.addEventListener("keydown", (event) => { const offsets = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }; if (offsets[event.key]) { event.preventDefault(); state.cursor.row = Math.max(0, Math.min(2, state.cursor.row + offsets[event.key][0])); state.cursor.col = Math.max(0, Math.min(2, state.cursor.col + offsets[event.key][1])); renderBoard(); } if (["Enter", " "].includes(event.key)) { event.preventDefault(); placeMark(state.cursor.row, state.cursor.col); } });
elements.startButton.addEventListener("click", resetGame); elements.restartButton.addEventListener("click", resetGame); elements.restartControl.addEventListener("click", resetGame); elements.undoButton.addEventListener("click", undo); elements.modeButton.addEventListener("click", showModePanel); elements.resultModeButton.addEventListener("click", showModePanel);
elements.soundButton.addEventListener("click", () => { state.soundOn = !state.soundOn; elements.soundButton.textContent = state.soundOn ? "🔊" : "🔇"; elements.soundButton.setAttribute("aria-label", state.soundOn ? "关闭声音" : "打开声音"); saveGame(); });
const savedGame = gameStore.load();
if (savedGame) Object.assign(state, { mode: savedGame.mode, difficulty: savedGame.difficulty, board: savedGame.board, currentPlayer: savedGame.currentPlayer, running: savedGame.running, winner: savedGame.winner, winningLine: savedGame.winningLine, history: savedGame.history, soundOn: savedGame.soundOn, cursor: savedGame.cursor });
restoreUi(savedGame);

function lockGame(reason) { if (reason === "busy") gameStore.suspend(); else saveGame(); resumeAiAfterLimit = state.running && state.mode === "ai" && state.currentPlayer === O; clearTimeout(state.aiTimer); state.thinking = false; updateStatus(); }
function resumeGameAfterLimit() { if (resumeAiAfterLimit && state.running && state.currentPlayer === O) requestAiMove(); resumeAiAfterLimit = false; saveGame(); }
window.addEventListener("pagehide", saveGame);
const playLimit = startPlayLimit({ onLock: lockGame, onResume: resumeGameAfterLimit });
if (!playLimit.isLocked() && state.running && state.mode === "ai" && state.currentPlayer === O) requestAiMove();
