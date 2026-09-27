import {
  DIFFICULTIES, EMPTY, SIZE, createGame, enterDigit, eraseCell, getConflicts,
  revealHint, setSelectedCell, undoMove, updateElapsed,
} from "./engine.mjs";
import { createVersionedGameStore, showSaveConflict } from "../../assets/js/safe-storage.js";
import { startPlayLimit } from "../../assets/js/play-limit.js";
import { createDefaultSudokuSave, validateSudokuSave } from "./save-state.mjs";

const SAVE_KEY = "lulu-sudoku-save-v1";
const $ = (id) => document.getElementById(id);
const elements = {
  board: $("board"), timer: $("timer"), hints: $("hintsRemaining"), status: $("liveStatus"), noteButton: $("noteButton"),
  undoButton: $("undoButton"), hintButton: $("hintButton"), resultPanel: $("resultPanel"), resultMessage: $("resultMessage"),
};
const gameStore = createVersionedGameStore({ key: SAVE_KEY, validate: validateSudokuSave, onConflict: showSaveConflict });
const loaded = gameStore.load();
let game = loaded?.game ?? createDefaultSudokuSave().game;
let noteMode = false;
let restLocked = false;
let dirty = !loaded;
let lastTick = performance.now();
let lastPersist = lastTick;

function persist() {
  if (!dirty) return;
  gameStore.save({ version: 1, game });
  dirty = false;
  lastPersist = performance.now();
}

function formatTime(milliseconds) {
  const total = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function renderTimer() {
  elements.timer.textContent = formatTime(game.elapsedMs);
  elements.hints.textContent = String(game.hintsRemaining);
  elements.undoButton.disabled = game.history.length === 0;
  elements.hintButton.disabled = game.hintsRemaining <= 0 || game.status !== "playing";
  elements.noteButton.setAttribute("aria-pressed", String(noteMode));
  document.querySelectorAll(".difficulty-button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.difficulty === game.difficulty));
  });
}

function focusSelectedCell() {
  elements.board.querySelector(`[data-cell-index="${game.selectedIndex}"]`)?.focus();
}

function renderBoard() {
  const conflicts = getConflicts(game.grid);
  const selectedValue = game.grid[game.selectedIndex];
  elements.board.replaceChildren();
  for (let index = 0; index < SIZE * SIZE; index += 1) {
    const row = Math.floor(index / SIZE);
    const column = index % SIZE;
    const value = game.grid[index];
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "sudoku-cell";
    cell.dataset.cellIndex = String(index);
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-selected", String(index === game.selectedIndex));
    cell.tabIndex = index === game.selectedIndex ? 0 : -1;
    if (game.puzzle[index]) cell.classList.add("clue");
    if (index === game.selectedIndex) cell.classList.add("selected");
    if (index !== game.selectedIndex && (row === Math.floor(game.selectedIndex / SIZE) || column === game.selectedIndex % SIZE
      || Math.floor(row / 3) === Math.floor(Math.floor(game.selectedIndex / SIZE) / 3)
      && Math.floor(column / 3) === Math.floor((game.selectedIndex % SIZE) / 3))) cell.classList.add("peer");
    if (value && selectedValue && value === selectedValue) cell.classList.add("same-value");
    if (conflicts.has(index)) cell.classList.add("conflict");
    if (column === 2 || column === 5) cell.classList.add("box-right");
    if (row === 2 || row === 5) cell.classList.add("box-bottom");
    const position = `第 ${row + 1} 行，第 ${column + 1} 列`;
    cell.setAttribute("aria-label", `${position}${game.puzzle[index] ? `，题目数字 ${value}` : value ? `，数字 ${value}` : "，空格"}${conflicts.has(index) ? "，与同行、同列或同宫数字冲突" : ""}`);
    if (value) cell.textContent = String(value);
    else {
      const notes = document.createElement("span");
      notes.className = "notes-grid";
      for (let digit = 1; digit <= 9; digit += 1) {
        const note = document.createElement("span");
        note.textContent = game.notes[index].includes(digit) ? String(digit) : "";
        notes.append(note);
      }
      cell.append(notes);
    }
    elements.board.append(cell);
  }
  renderTimer();
  renderResult();
}

function renderResult() {
  if (game.status !== "won") {
    elements.resultPanel.classList.add("hidden");
    return;
  }
  elements.resultPanel.classList.remove("hidden");
  elements.resultMessage.textContent = `你用时 ${formatTime(game.elapsedMs)} 完成${game.difficulty === "easy" ? "简单" : game.difficulty === "medium" ? "中等" : "困难"}数独！`;
  elements.status.textContent = "恭喜完成数独！";
}

function selectCell(index) {
  game = setSelectedCell(game, index);
  renderBoard();
  focusSelectedCell();
}

function applyDigit(digit) {
  const before = game;
  game = enterDigit(game, game.selectedIndex, digit, noteMode);
  if (game === before) return;
  dirty = true;
  const index = game.selectedIndex;
  if (noteMode) elements.status.textContent = `已更新第 ${Math.floor(index / SIZE) + 1} 行第 ${index % SIZE + 1} 列的候选笔记。`;
  else if (game.status === "won") elements.status.textContent = "恭喜完成数独！";
  else elements.status.textContent = game.grid[index] === game.solution[index] ? "填得正确，继续找出其他数字。" : "数字已填入；注意检查同行、同列和同宫。";
  persist();
  renderBoard();
  focusSelectedCell();
}

function startNewGame(difficulty = game.difficulty) {
  elements.status.textContent = "正在生成唯一解数独…";
  requestAnimationFrame(() => {
    game = createGame(difficulty);
    noteMode = false;
    dirty = true;
    persist();
    elements.status.textContent = `已开始${difficulty === "easy" ? "简单" : difficulty === "medium" ? "中等" : "困难"}数独。`;
    renderBoard();
    focusSelectedCell();
  });
}

function moveSelection(dx, dy) {
  const row = Math.floor(game.selectedIndex / SIZE);
  const column = game.selectedIndex % SIZE;
  selectCell(Math.max(0, Math.min(SIZE - 1, row + dy)) * SIZE + Math.max(0, Math.min(SIZE - 1, column + dx)));
}

function eraseSelected() {
  const before = game;
  game = eraseCell(game, game.selectedIndex);
  if (game === before) return;
  dirty = true;
  persist();
  elements.status.textContent = "已清除选中格子的数字。";
  renderBoard();
  focusSelectedCell();
}

function undo() {
  const before = game;
  game = undoMove(game);
  if (game === before) return;
  dirty = true;
  persist();
  elements.status.textContent = "已撤销上一步。";
  renderBoard();
  focusSelectedCell();
}

function giveHint() {
  let index = game.selectedIndex;
  if (game.puzzle[index] !== EMPTY || game.grid[index] === game.solution[index]) {
    index = game.puzzle.findIndex((value, cell) => value === EMPTY && game.grid[cell] !== game.solution[cell]);
  }
  if (index < 0) { elements.status.textContent = "棋盘上没有需要提示的空格。"; return; }
  const before = game;
  game = revealHint(game, index);
  if (game === before) return;
  dirty = true;
  game = setSelectedCell(game, index);
  persist();
  elements.status.textContent = `已填入第 ${Math.floor(index / SIZE) + 1} 行第 ${index % SIZE + 1} 列的正确数字。`;
  renderBoard();
  focusSelectedCell();
}

elements.board.addEventListener("click", (event) => {
  const cell = event.target.closest("[data-cell-index]");
  if (cell && elements.board.contains(cell)) selectCell(Number(cell.dataset.cellIndex));
});
elements.board.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") { event.preventDefault(); moveSelection(0, -1); }
  else if (event.key === "ArrowDown") { event.preventDefault(); moveSelection(0, 1); }
  else if (event.key === "ArrowLeft") { event.preventDefault(); moveSelection(-1, 0); }
  else if (event.key === "ArrowRight") { event.preventDefault(); moveSelection(1, 0); }
});
document.addEventListener("keydown", (event) => {
  const cell = event.target.closest?.("[data-cell-index]");
  if (!cell && event.target.closest?.("button, a, input, textarea")) return;
  if ((event.ctrlKey || event.metaKey) && (event.key === "z" || event.key === "Z")) { event.preventDefault(); undo(); return; }
  if (event.key >= "1" && event.key <= "9") { event.preventDefault(); applyDigit(Number(event.key)); }
  else if (event.key === "Backspace" || event.key === "Delete") { event.preventDefault(); eraseSelected(); }
  else if (event.key === "n" || event.key === "N") { noteMode = !noteMode; renderTimer(); }
});

$("numberPad").addEventListener("click", (event) => {
  const button = event.target.closest("[data-digit]");
  if (button) applyDigit(Number(button.dataset.digit));
});
document.querySelectorAll(".difficulty-button").forEach((button) => {
  button.addEventListener("click", () => startNewGame(button.dataset.difficulty));
});
elements.noteButton.addEventListener("click", () => { noteMode = !noteMode; renderTimer(); elements.status.textContent = noteMode ? "笔记模式已开启。" : "笔记模式已关闭。"; });
$("eraseButton").addEventListener("click", eraseSelected);
elements.undoButton.addEventListener("click", undo);
elements.hintButton.addEventListener("click", giveHint);
$("newGameButton").addEventListener("click", () => startNewGame());
$("resultButton").addEventListener("click", () => startNewGame());

function tick() {
  const now = performance.now();
  const elapsed = Math.max(0, now - lastTick);
  lastTick = now;
  if (!document.hidden && !restLocked && game.status === "playing" && elapsed > 0 && elapsed < 5000) {
    game = updateElapsed(game, elapsed);
    dirty = true;
    renderTimer();
  }
  if (dirty && now - lastPersist >= 1000) persist();
}
const ticker = window.setInterval(tick, 250);
document.addEventListener("visibilitychange", () => { lastTick = performance.now(); if (document.hidden) persist(); });
window.addEventListener("pagehide", () => { persist(); window.clearInterval(ticker); });

renderBoard();
if (dirty) persist();
startPlayLimit({
  onLock(reason) {
    restLocked = true;
    lastTick = performance.now();
    if (reason === "busy") { gameStore.suspend(); return; }
    persist();
  },
  onResume() {
    restLocked = false;
    lastTick = performance.now();
    renderBoard();
  },
});
