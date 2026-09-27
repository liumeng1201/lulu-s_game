import { MAX_LEVEL, canMovePiece, createGame, movePiece, undoMove } from "./engine.mjs";
import { createVersionedGameStore, showSaveConflict } from "../../assets/js/safe-storage.js";
import { startPlayLimit } from "../../assets/js/play-limit.js";
import { createDefaultKlotskiSave, validateKlotskiSave } from "./save-state.mjs";

const SAVE_KEY = "lulu-klotski-save-v1";
const $ = (id) => document.getElementById(id);
const boardElement = $("board");
const elements = {
  level: $("levelValue"), moves: $("moveValue"), liveStatus: $("liveStatus"), resultPanel: $("resultPanel"),
  resultTitle: $("resultTitle"), resultMessage: $("resultMessage"), resultButton: $("resultButton"), undoButton: $("undoButton"),
};
const gameStore = createVersionedGameStore({ key: SAVE_KEY, validate: validateKlotskiSave, onConflict: showSaveConflict });
const loaded = gameStore.load();
let game = loaded?.game ?? createDefaultKlotskiSave().game;
let selectedId = null;
let drag = null;

function persist() { gameStore.save({ version: 1, game }); }

function focusSelectedPiece() {
  if (!selectedId) return;
  boardElement.querySelector(`[data-piece-id="${CSS.escape(selectedId)}"]`)?.focus();
}

function renderBoard() {
  const cells = Array.from({ length: 20 }, () => null);
  for (const item of game.pieces) {
    for (let row = item.row; row < item.row + item.height; row += 1) {
      for (let column = item.column; column < item.column + item.width; column += 1) cells[row * 4 + column] = item;
    }
  }
  boardElement.replaceChildren();
  const rendered = new Set();
  cells.forEach((item, index) => {
    if (!item) {
      const empty = document.createElement("div");
      empty.className = "empty-cell";
      empty.setAttribute("role", "gridcell");
      empty.setAttribute("aria-label", "空格");
      empty.style.gridRow = String(Math.floor(index / 4) + 1);
      empty.style.gridColumn = String(index % 4 + 1);
      boardElement.append(empty);
      return;
    }
    if (rendered.has(item.id)) return;
    rendered.add(item.id);
    const slot = document.createElement("div");
    slot.className = "piece-slot";
    slot.setAttribute("role", "gridcell");
    slot.style.gridRow = `${item.row + 1} / span ${item.height}`;
    slot.style.gridColumn = `${item.column + 1} / span ${item.width}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `piece ${item.kind}${selectedId === item.id ? " selected" : ""}`;
    button.dataset.pieceId = item.id;
    button.setAttribute("aria-label", `${item.label}，${item.width} 格宽，${item.height} 格高`);
    button.setAttribute("aria-pressed", String(selectedId === item.id));
    button.textContent = item.label;
    slot.append(button);
    boardElement.append(slot);
  });
  const exitMarker = document.createElement("span");
  exitMarker.className = "exit-marker";
  exitMarker.setAttribute("aria-hidden", "true");
  exitMarker.textContent = "曹操出口";
  boardElement.append(exitMarker);
  const levelNames = ["", "横刀立马", "换个阵型", "最终挑战"];
  elements.level.textContent = `${levelNames[game.level]} · ${game.level} / ${MAX_LEVEL}`;
  elements.moves.textContent = String(game.moves);
  elements.undoButton.disabled = game.history.length === 0;
  elements.liveStatus.textContent = game.status === "won"
    ? `第 ${game.level} 关完成，共用了 ${game.moves} 步。`
    : selectedId ? `已选中${game.pieces.find((item) => item.id === selectedId)?.label ?? "棋子"}，使用方向键或下方按钮移动。`
      : "先点选一个棋子，再点击方向按钮移动；也可以直接拖动棋子。";
  renderResult();
}

function renderResult() {
  if (game.status !== "won") {
    elements.resultPanel.classList.add("hidden");
    return;
  }
  elements.resultPanel.classList.remove("hidden");
  elements.resultTitle.textContent = game.level === MAX_LEVEL ? "三关全部完成！" : "曹操成功逃出！";
  elements.resultMessage.textContent = game.level === MAX_LEVEL
    ? `你完成了全部三种阵型，共使用 ${game.moves} 步。`
    : `第 ${game.level} 关用 ${game.moves} 步完成，准备挑战下一个阵型吗？`;
  elements.resultButton.innerHTML = game.level === MAX_LEVEL
    ? "再挑战一次 <span aria-hidden=\"true\">↻</span>"
    : "下一关 <span aria-hidden=\"true\">→</span>";
}

function tryMove(id, dx, dy) {
  if (game.status !== "playing") return;
  if (!canMovePiece(game.pieces, id, dx, dy)) {
    selectedId = id;
    elements.liveStatus.textContent = "这个方向被其他棋子挡住了。";
    renderBoard();
    focusSelectedPiece();
    return;
  }
  game = movePiece(game, id, dx, dy);
  selectedId = id;
  persist();
  renderBoard();
  focusSelectedPiece();
}

function moveSelection(dx, dy) {
  if (!selectedId) {
    elements.liveStatus.textContent = "请先选择要移动的棋子。";
    return;
  }
  tryMove(selectedId, dx, dy);
}

function selectPiece(id) {
  selectedId = selectedId === id ? null : id;
  renderBoard();
  focusSelectedPiece();
}

boardElement.addEventListener("click", (event) => {
  const button = event.target.closest("[data-piece-id]");
  if (button && boardElement.contains(button)) selectPiece(button.dataset.pieceId);
});

boardElement.addEventListener("pointerdown", (event) => {
  const button = event.target.closest("[data-piece-id]");
  if (!button || game.status !== "playing") return;
  drag = { id: button.dataset.pieceId, x: event.clientX, y: event.clientY };
  button.setPointerCapture?.(event.pointerId);
});

boardElement.addEventListener("pointerup", (event) => {
  if (!drag) return;
  const current = drag;
  drag = null;
  const dxPixels = event.clientX - current.x;
  const dyPixels = event.clientY - current.y;
  if (Math.max(Math.abs(dxPixels), Math.abs(dyPixels)) < 12) {
    selectedId = current.id;
    renderBoard();
    focusSelectedPiece();
    return;
  }
  const rect = boardElement.getBoundingClientRect();
  const style = getComputedStyle(boardElement);
  const horizontalGaps = parseFloat(style.columnGap) || 0;
  const verticalGaps = parseFloat(style.rowGap) || 0;
  const cellWidth = (rect.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - horizontalGaps * 3) / 4;
  const cellHeight = (rect.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - verticalGaps * 4) / 5;
  let dx = Math.round(dxPixels / cellWidth);
  let dy = Math.round(dyPixels / cellHeight);
  if (Math.abs(dxPixels) / cellWidth >= Math.abs(dyPixels) / cellHeight) dy = 0;
  else dx = 0;
  if (dx === 0 && dy === 0) { selectedId = current.id; renderBoard(); focusSelectedPiece(); return; }
  tryMove(current.id, dx, dy);
});

boardElement.addEventListener("pointercancel", () => { drag = null; });
boardElement.addEventListener("keydown", (event) => {
  const directions = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  const direction = directions[event.key];
  if (direction) {
    event.preventDefault();
    const focusedId = event.target.closest("[data-piece-id]")?.dataset.pieceId;
    selectedId = focusedId ?? selectedId;
    moveSelection(...direction);
  } else if ((event.key === "z" || event.key === "Z") && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    undoButtonClick();
  }
});

function undoButtonClick() {
  game = undoMove(game);
  persist();
  renderBoard();
}

$("upButton").addEventListener("click", () => moveSelection(0, -1));
$("downButton").addEventListener("click", () => moveSelection(0, 1));
$("leftButton").addEventListener("click", () => moveSelection(-1, 0));
$("rightButton").addEventListener("click", () => moveSelection(1, 0));
elements.undoButton.addEventListener("click", undoButtonClick);
$("restartButton").addEventListener("click", () => { game = createGame(game.level); selectedId = null; persist(); renderBoard(); });
elements.resultButton.addEventListener("click", () => {
  game = createGame(game.level < MAX_LEVEL ? game.level + 1 : 1);
  selectedId = null;
  persist();
  renderBoard();
});
window.addEventListener("pagehide", persist);

renderBoard();
startPlayLimit({
  onLock(reason) {
    if (reason === "busy") { gameStore.suspend(); return; }
    persist();
  },
  onResume: renderBoard,
});
