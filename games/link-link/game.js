import { createVersionedGameStore, showSaveConflict } from "../../assets/js/safe-storage.js";
import { startPlayLimit } from "../../assets/js/play-limit.js";
import {
  BOARD_SIZE, ICON_COUNT, ROUND_DURATION_MS, advanceTimer, createEmptyBoard, createGame, formatTime,
  indexToCell, selectTile, shuffleRemaining, useHint,
} from "./engine.mjs";
import { createDefaultSave, validateLinkLinkSave } from "./save-state.mjs";

const SAVE_KEY = "lulu-link-link-save-v1";
const ICONS = ["🐱", "🐶", "🐰", "🐼", "🐸", "🐵", "🦊", "🐻", "🐯", "🐨", "🐷", "🐮", "🐔", "🐧", "🦄", "🐝", "🍎", "🍋", "🍇", "🍓", "🍉", "🍒", "🍍", "🥝", "🍊", "🍑", "🥕", "🌽", "🍄", "🌻", "🌈", "⭐"];
if (ICONS.length !== ICON_COUNT) throw new Error("The link-link icon set must match the engine tile count.");

const $ = (id) => document.getElementById(id);
const elements = {
  board: $("board"), startPanel: $("startPanel"), startButton: $("startButton"), pausePanel: $("pausePanel"), pauseMessage: $("pauseMessage"),
  resumeButton: $("resumeButton"), resultPanel: $("resultPanel"), resultIcon: $("resultIcon"), resultTitle: $("resultTitle"), resultMessage: $("resultMessage"),
  restartButton: $("restartButton"), timer: $("timer"), roundTime: document.querySelector(".round-time"), matchCount: $("matchCount"),
  hintCount: $("hintCount"), hintButtonCount: $("hintButtonCount"), hintButton: $("hintButton"), shuffleButton: $("shuffleButton"),
  pauseButton: $("pauseButton"), statusMessage: $("statusMessage"),
};
const gameStore = createVersionedGameStore({ key: SAVE_KEY, validate: validateLinkLinkSave, storage: localStorage, onConflict: showSaveConflict });
const save = gameStore.load() ?? createDefaultSave();
const state = { keyboardCursor: 0, hintPair: null, hintTimeout: null, lastTickAt: null, lastSavedSecond: null };
const emptyBoard = createEmptyBoard();
let game = save.currentGame;
let timerInterval;

function persist() {
  save.currentGame = game;
  gameStore.save(save);
}

function renderResult() {
  if (!game) return;
  const elapsed = ROUND_DURATION_MS - game.remainingMs;
  if (game.status === "won") {
    elements.resultIcon.textContent = "🎉";
    elements.resultTitle.textContent = "全部配对成功！";
    elements.resultMessage.textContent = `太棒了！你用了 ${formatTime(elapsed)} 清空棋盘，失误 ${game.mistakes} 次，还剩 ${game.hintsLeft} 次提示。`;
  } else if (game.status === "lost") {
    elements.resultIcon.textContent = "⏰";
    elements.resultTitle.textContent = "时间到啦！";
    elements.resultMessage.textContent = `本局完成了 ${game.matches} 对，还剩 ${BOARD_SIZE ** 2 / 2 - game.matches} 对。再试一次，留意能绕开图案的连线路径吧！`;
  }
}

function setStatusMessage() {
  if (!game) {
    elements.statusMessage.textContent = "点击“开始挑战”进入游戏。";
  } else if (game.status === "playing" && game.selected !== null) {
    const { row, col } = indexToCell(game.selected);
    elements.statusMessage.textContent = `已选中第 ${row + 1} 行第 ${col + 1} 列，再选一张相同图案。`;
  } else if (game.status === "playing") {
    elements.statusMessage.textContent = "找到一对相同图案，将它们连起来消除。";
  } else if (game.status === "paused") {
    elements.statusMessage.textContent = game.pauseReason === "limit" ? "休息时间结束后会自动恢复本局。" : "游戏已暂停。";
  } else if (game.status === "won") {
    elements.statusMessage.textContent = "全部图案都配对成功，恭喜通关！";
  } else {
    elements.statusMessage.textContent = "本局倒计时已结束。";
  }
}

function renderBoard() {
  const board = game?.board ?? emptyBoard;
  elements.board.replaceChildren();
  elements.board.setAttribute("aria-activedescendant", `tile-${state.keyboardCursor}`);
  for (let index = 0; index < BOARD_SIZE ** 2; index += 1) {
    const { row, col } = indexToCell(index);
    const value = board[row][col];
    const tile = document.createElement("div");
    tile.id = `tile-${index}`;
    tile.className = "tile";
    tile.setAttribute("role", "gridcell");
    tile.setAttribute("aria-label", value === null ? `第 ${row + 1} 行第 ${col + 1} 列，空位` : `${ICONS[value]}，第 ${row + 1} 行第 ${col + 1} 列`);
    if (value === null) tile.classList.add("empty");
    else {
      tile.textContent = ICONS[value];
      tile.style.setProperty("--tile-color", `hsl(${(value * 37 + 28) % 360} 78% 94%)`);
    }
    if (game?.selected === index) tile.classList.add("selected");
    if (state.hintPair?.includes(index)) tile.classList.add("hinted");
    if (state.keyboardCursor === index) tile.classList.add("keyboard-cursor");
    tile.addEventListener("click", () => {
      state.keyboardCursor = index;
      selectAt(index);
      elements.board.focus();
    });
    elements.board.append(tile);
  }
  elements.board.inert = !game || game.status !== "playing";
}

function renderPanels() {
  elements.startPanel.classList.toggle("hidden", Boolean(game));
  elements.pausePanel.classList.toggle("hidden", game?.status !== "paused");
  elements.resultPanel.classList.toggle("hidden", !game || !["won", "lost"].includes(game.status));
  if (game?.status === "paused") {
    const limited = game.pauseReason === "limit";
    elements.pauseMessage.textContent = limited ? "休息时间结束后，就会自动回到刚才的棋盘。" : "倒计时已暂停，准备好后继续吧。";
    elements.resumeButton.hidden = limited;
  }
  if (game && ["won", "lost"].includes(game.status)) renderResult();
  elements.hintButton.disabled = !game || game.status !== "playing" || game.hintsLeft <= 0;
  elements.shuffleButton.disabled = !game || game.status !== "playing";
  elements.pauseButton.disabled = !game || game.status !== "playing";
}

function render() {
  renderBoard();
  renderPanels();
  elements.matchCount.textContent = `${game?.matches ?? 0}/${BOARD_SIZE ** 2 / 2}`;
  elements.hintCount.textContent = String(game?.hintsLeft ?? 3);
  elements.hintButtonCount.textContent = String(game?.hintsLeft ?? 3);
  const remaining = game?.remainingMs ?? ROUND_DURATION_MS;
  elements.timer.textContent = formatTime(remaining);
  elements.roundTime.classList.toggle("urgent", Boolean(game && game.status === "playing" && remaining <= 30_000));
  setStatusMessage();
}

function persistClockIfNeeded(force = false) {
  const second = game ? Math.ceil(game.remainingMs / 1000) : null;
  if (force || second !== state.lastSavedSecond) {
    state.lastSavedSecond = second;
    persist();
  }
}

function chargeElapsed(now = performance.now()) {
  if (!game || game.status !== "playing" || state.lastTickAt === null) return false;
  const previous = game;
  game = advanceTimer(game, Math.max(0, now - state.lastTickAt));
  state.lastTickAt = now;
  elements.timer.textContent = formatTime(game.remainingMs);
  elements.roundTime.classList.toggle("urgent", game.status === "playing" && game.remainingMs <= 30_000);
  if (game.status !== previous.status || Math.ceil(game.remainingMs / 1000) !== Math.ceil(previous.remainingMs / 1000)) {
    persistClockIfNeeded(game.status !== "playing");
  }
  if (game.status === "lost") {
    stopClock();
    render();
    elements.restartButton.focus();
  }
  return game.status === "playing";
}

function flushClock() {
  chargeElapsed();
  state.lastTickAt = null;
  persistClockIfNeeded(true);
}

function startClock() {
  stopClock();
  if (!game || game.status !== "playing" || document.hidden) return;
  state.lastTickAt = performance.now();
  timerInterval = window.setInterval(() => {
    if (!game || game.status !== "playing" || document.hidden) return;
    chargeElapsed();
  }, 100);
}

function stopClock() {
  if (timerInterval !== undefined) window.clearInterval(timerInterval);
  timerInterval = undefined;
  state.lastTickAt = null;
}

function startGame() {
  clearTimeout(state.hintTimeout);
  state.hintPair = null;
  state.keyboardCursor = 0;
  game = createGame();
  state.lastSavedSecond = null;
  persistClockIfNeeded(true);
  render();
  startClock();
  elements.board.focus();
}

function selectAt(index) {
  if (!game || game.status !== "playing") return;
  flushClock();
  if (game.status !== "playing") return;
  const previousSelected = game.selected;
  const result = selectTile(game, index);
  if (!result.changed) return;
  game = result.game;
  clearTimeout(state.hintTimeout);
  state.hintPair = null;
  if (result.matched) {
    elements.statusMessage.textContent = result.autoShuffled
      ? "配对成功！棋盘没有可连的组合，已自动洗牌。"
      : "配对成功！继续找下一组相同图案。";
  } else if (previousSelected === null) {
    elements.statusMessage.textContent = "选好了，再找一张相同图案。";
  } else if (previousSelected === index) {
    elements.statusMessage.textContent = "已取消选择。";
  } else {
    elements.statusMessage.textContent = "这两张图案不能配对，已选中后一张，再找相同图案吧。";
  }
  persistClockIfNeeded(true);
  render();
  if (game.status === "won") {
    stopClock();
    elements.restartButton.focus();
  }
}

function pauseGame(reason = "manual") {
  if (!game || game.status !== "playing") return;
  flushClock();
  if (game.status !== "playing") return;
  game = { ...game, status: "paused", pauseReason: reason };
  stopClock();
  persistClockIfNeeded(true);
  render();
  if (reason === "manual") elements.resumeButton.focus();
}

function resumeGame() {
  if (!game || game.status !== "paused" || game.pauseReason !== "manual") return;
  game = { ...game, status: "playing", pauseReason: null };
  persistClockIfNeeded(true);
  render();
  startClock();
  elements.board.focus();
}

function shuffleBoard() {
  if (!game || game.status !== "playing") return;
  flushClock();
  if (game.status !== "playing") return;
  const shuffled = shuffleRemaining(game.board);
  game = { ...game, board: shuffled.board, selected: null };
  elements.statusMessage.textContent = "剩余图案已重新排列，已消除的配对不会恢复。";
  persistClockIfNeeded(true);
  render();
  elements.board.focus();
}

function showHint() {
  if (!game || game.status !== "playing") return;
  flushClock();
  if (game.status !== "playing") return;
  const result = useHint(game);
  if (!result.pair) {
    elements.statusMessage.textContent = "提示次数已用完，或当前没有可提示的组合。";
    return;
  }
  game = result.game;
  state.hintPair = result.pair;
  elements.statusMessage.textContent = "提示：闪光的两张图案可以配对。";
  persistClockIfNeeded(true);
  render();
  clearTimeout(state.hintTimeout);
  state.hintTimeout = window.setTimeout(() => {
    state.hintPair = null;
    renderBoard();
  }, 1300);
}

function handleBoardKey(event) {
  const offsets = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (offsets[event.key]) {
    event.preventDefault();
    const { row, col } = indexToCell(state.keyboardCursor);
    const [rowOffset, colOffset] = offsets[event.key];
    const nextRow = Math.max(0, Math.min(BOARD_SIZE - 1, row + rowOffset));
    const nextCol = Math.max(0, Math.min(BOARD_SIZE - 1, col + colOffset));
    state.keyboardCursor = nextRow * BOARD_SIZE + nextCol;
    renderBoard();
  } else if (["Enter", " "].includes(event.key)) {
    event.preventDefault();
    selectAt(state.keyboardCursor);
    elements.board.focus();
  } else if (event.key === "Escape" && game?.status === "playing") {
    event.preventDefault();
    pauseGame();
  }
}

elements.board.addEventListener("keydown", handleBoardKey);
elements.startButton.addEventListener("click", startGame);
elements.restartButton.addEventListener("click", startGame);
elements.pauseButton.addEventListener("click", () => pauseGame());
elements.resumeButton.addEventListener("click", resumeGame);
elements.shuffleButton.addEventListener("click", shuffleBoard);
elements.hintButton.addEventListener("click", showHint);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    flushClock();
    stopClock();
  } else if (game?.status === "playing") startClock();
});
window.addEventListener("pagehide", () => { flushClock(); stopClock(); });
window.addEventListener("pageshow", () => { if (game?.status === "playing") startClock(); });

if (game?.status === "paused" && game.pauseReason === "limit") {
  // Keep the play-limit pause durable across refreshes until its overlay permits resuming.
  save.currentGame = game;
}
render();
if (game?.status === "playing") startClock();
else if (!game) elements.startButton.focus();
else if (game.status === "paused" && game.pauseReason === "manual") elements.resumeButton.focus();
else if (["won", "lost"].includes(game.status)) elements.restartButton.focus();
startPlayLimit({
  onLock() { pauseGame("limit"); },
  onResume() {
    if (game?.status === "paused" && game.pauseReason === "limit") {
      game = { ...game, status: "playing", pauseReason: null };
      persistClockIfNeeded(true);
      render();
      startClock();
    }
  },
});
