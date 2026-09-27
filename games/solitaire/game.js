import { createVersionedGameStore, showSaveConflict } from "../../assets/js/safe-storage.js";
import { startPlayLimit } from "../../assets/js/play-limit.js";
import {
  SUITS, cardLabel, createGame, drawFromStock, moveToFoundation, moveToTableau, undoMove, updateElapsed,
} from "./engine.mjs";
import { createDefaultSolitaireSave, validateSolitaireSave } from "./save-state.mjs";

const SAVE_KEY = "lulu-solitaire-save-v1";
const SUIT_SYMBOLS = { spades: "♠", hearts: "♥", clubs: "♣", diamonds: "♦" };
const $ = (id) => document.getElementById(id);
const elements = {
  board: $("board"), stock: $("stockSlot"), waste: $("wasteSlot"), foundations: $("foundations"), tableau: $("tableau"),
  timer: $("timer"), moves: $("moveCount"), stockCount: $("stockCount"), status: $("liveStatus"), foundationButton: $("foundationButton"),
  undoButton: $("undoButton"), newGameButton: $("newGameButton"), resultPanel: $("resultPanel"), resultMessage: $("resultMessage"), resultButton: $("resultButton"),
};
const gameStore = createVersionedGameStore({ key: SAVE_KEY, validate: validateSolitaireSave, onConflict: showSaveConflict });
const loaded = gameStore.load();
let game = loaded?.game ?? createDefaultSolitaireSave().game;
let selectedSource = null;
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

function sourceKey(source) {
  return source ? `${source.pile}:${source.index ?? ""}:${source.cardIndex ?? ""}` : "";
}

function cardMarkup(card) {
  const symbol = SUIT_SYMBOLS[card.suit];
  const rank = card.rank === 1 ? "A" : card.rank === 11 ? "J" : card.rank === 12 ? "Q" : card.rank === 13 ? "K" : String(card.rank);
  return `<span class="card-corner">${rank}<small>${symbol}</small></span><span class="card-center" aria-hidden="true">${symbol}</span><span class="card-corner bottom" aria-hidden="true">${rank}<small>${symbol}</small></span>`;
}

function createFaceUpCard(card, source, top = 0) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `playing-card face-up ${["hearts", "diamonds"].includes(card.suit) ? "red" : "black"}`;
  button.dataset.sourcePile = source.pile;
  if (source.index !== undefined) button.dataset.sourceIndex = String(source.index);
  if (source.cardIndex !== undefined) button.dataset.sourceCardIndex = String(source.cardIndex);
  button.dataset.cardId = card.id;
  button.style.setProperty("--card-top", `${top}px`);
  button.draggable = true;
  button.setAttribute("aria-label", cardLabel(card));
  button.innerHTML = cardMarkup(card);
  if (sourceKey(source) === sourceKey(selectedSource)) button.classList.add("selected");
  return button;
}

function renderBoard() {
  const cardHeight = Number.parseFloat(getComputedStyle(elements.board).getPropertyValue("--card-height")) || 72;
  const downStep = cardHeight * .2;
  const upStep = cardHeight * .27;

  elements.stock.replaceChildren();
  elements.stock.classList.toggle("has-cards", game.stock.length > 0);
  elements.stock.setAttribute("aria-label", game.stock.length ? `牌堆，剩余 ${game.stock.length} 张，点击摸一张` : game.waste.length ? "牌堆已空，点击回收废牌" : "牌堆和废牌堆均已空");
  if (game.stock.length) {
    const back = document.createElement("span");
    back.className = "playing-card face-down";
    back.setAttribute("aria-hidden", "true");
    elements.stock.append(back);
  } else {
    const marker = document.createElement("span");
    marker.className = "empty-foundation";
    marker.textContent = game.waste.length ? "↻" : "·";
    elements.stock.append(marker);
  }

  elements.waste.replaceChildren();
  const wasteTop = game.waste.at(-1);
  if (wasteTop) elements.waste.append(createFaceUpCard(wasteTop, { pile: "waste" }));

  elements.foundations.replaceChildren();
  game.foundations.forEach((pile, index) => {
    const button = document.createElement("div");
    button.className = "card-slot foundation-slot";
    button.dataset.dropFoundation = String(index);
    button.tabIndex = 0;
    button.setAttribute("role", "button");
    const top = pile.at(-1);
    button.setAttribute("aria-label", top ? `基础牌堆 ${index + 1}，${cardLabel(top)}，共 ${pile.length} 张` : `基础牌堆 ${index + 1}，空位；从 A 开始`);
    if (top) button.append(createFaceUpCard(top, { pile: "foundation", index }));
    else {
      const marker = document.createElement("span");
      marker.className = "empty-foundation";
      marker.textContent = SUIT_SYMBOLS[SUITS[index]];
      button.append(marker);
    }
    elements.foundations.append(button);
  });

  elements.tableau.replaceChildren();
  game.tableau.forEach((pile, pileIndex) => {
    const column = document.createElement("div");
    column.className = "tableau-pile";
    column.dataset.dropTableau = String(pileIndex);
    column.setAttribute("role", "group");
    column.setAttribute("aria-label", `第 ${pileIndex + 1} 列，${pile.length} 张牌`);
    if (!pile.length) {
      column.tabIndex = 0;
      column.setAttribute("role", "button");
      column.setAttribute("aria-label", `第 ${pileIndex + 1} 列，空列；可放置 K 或合法牌组`);
      const marker = document.createElement("span");
      marker.className = "empty-pile";
      marker.textContent = "K";
      marker.setAttribute("aria-hidden", "true");
      column.append(marker);
    } else {
      let faceUpIndex = 0;
      let faceDownIndex = 0;
      pile.forEach((card, cardIndex) => {
        let top;
        if (card.faceUp) {
          top = (pile.length - pile.filter((item) => item.faceUp).length) * downStep + faceUpIndex * upStep;
          faceUpIndex += 1;
        } else {
          top = faceDownIndex * downStep;
          faceDownIndex += 1;
        }
        if (card.faceUp) column.append(createFaceUpCard(card, { pile: "tableau", index: pileIndex, cardIndex }, top));
        else {
          const back = document.createElement("span");
          back.className = "playing-card face-down";
          back.style.setProperty("--card-top", `${top}px`);
          back.setAttribute("aria-label", `第 ${pileIndex + 1} 列，盖住的牌`);
          column.append(back);
        }
      });
      const hiddenCount = pile.filter((item) => !item.faceUp).length;
      const shownCount = pile.filter((item) => item.faceUp).length;
      const stackHeight = Math.max(cardHeight, hiddenCount * downStep + cardHeight + Math.max(0, shownCount - 1) * upStep);
      column.style.minHeight = `${stackHeight}px`;
    }
    elements.tableau.append(column);
  });

  elements.timer.textContent = formatTime(game.elapsedMs);
  elements.moves.textContent = String(game.moves);
  elements.stockCount.textContent = String(game.stock.length);
  elements.undoButton.disabled = game.history.length === 0;
  elements.foundationButton.disabled = game.status !== "playing" || !selectedSource;
  elements.board.inert = game.status === "won";
  elements.resultPanel.classList.toggle("hidden", game.status !== "won");
  if (game.status === "won") elements.resultMessage.textContent = `你用了 ${formatTime(game.elapsedMs)}，共走了 ${game.moves} 步。`;
  if (game.status === "won") elements.status.textContent = "四种花色都已整理完成，恭喜接龙成功！";
  else if (selectedSource) elements.status.textContent = "已选中一张牌，点击目标列或基础牌堆完成移动。";
  else elements.status.textContent = "红黑交替、数字递减；双击单张牌可尝试移到基础牌堆。";
}

function selectSource(source) {
  selectedSource = sourceKey(source) === sourceKey(selectedSource) ? null : source;
  renderBoard();
}

function applyMove(nextGame, successMessage = "移动完成。") {
  if (nextGame === game) return false;
  game = nextGame;
  selectedSource = null;
  dirty = true;
  elements.status.textContent = game.status === "won" ? "四种花色都已整理完成，恭喜接龙成功！" : successMessage;
  persist();
  renderBoard();
  return true;
}

function moveToColumn(source, index) {
  return applyMove(moveToTableau(game, source, index), "纸牌已移到目标列。");
}

function moveToBase(source, index) {
  return applyMove(moveToFoundation(game, source, index), "纸牌已移到基础牌堆。");
}

function parseSource(element) {
  if (!element?.dataset?.sourcePile) return null;
  const source = { pile: element.dataset.sourcePile };
  if (element.dataset.sourceIndex !== undefined) source.index = Number(element.dataset.sourceIndex);
  if (element.dataset.sourceCardIndex !== undefined) source.cardIndex = Number(element.dataset.sourceCardIndex);
  return source;
}

function handleCardClick(button) {
  const source = parseSource(button);
  if (!source) return;
  if (selectedSource) {
    if (sourceKey(selectedSource) === sourceKey(source)) { selectSource(source); return; }
    const moved = source.pile === "tableau" ? moveToColumn(selectedSource, source.index)
      : source.pile === "foundation" ? moveToBase(selectedSource, source.index) : false;
    if (moved) return;
  }
  selectSource(source);
}

elements.board.addEventListener("click", (event) => {
  const card = event.target.closest("[data-source-pile]");
  if (card && elements.board.contains(card)) { handleCardClick(card); return; }
  const foundation = event.target.closest("[data-drop-foundation]");
  if (foundation && selectedSource) { moveToBase(selectedSource, Number(foundation.dataset.dropFoundation)); return; }
  const column = event.target.closest("[data-drop-tableau]");
  if (column && selectedSource) moveToColumn(selectedSource, Number(column.dataset.dropTableau));
});

elements.board.addEventListener("dblclick", (event) => {
  const card = event.target.closest("[data-source-pile]");
  const source = parseSource(card);
  if (!source || source.pile === "tableau" && game.tableau[source.index].length - 1 !== source.cardIndex) return;
  event.preventDefault();
  const cardData = source.pile === "waste" ? game.waste.at(-1)
    : source.pile === "foundation" ? game.foundations[source.index].at(-1)
      : game.tableau[source.index].at(source.cardIndex);
  if (!cardData) return;
  const target = game.foundations.findIndex((pile) => !pile.length ? cardData.rank === 1 : pile.at(-1).suit === cardData.suit && pile.at(-1).rank + 1 === cardData.rank);
  if (target >= 0) moveToBase(source, target);
});

elements.board.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-source-pile]");
  const source = parseSource(card);
  if (!source) return;
  selectedSource = source;
  event.dataTransfer?.setData("text/plain", JSON.stringify(source));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  card.classList.add("selected");
});
elements.board.addEventListener("dragover", (event) => {
  if (event.target.closest("[data-drop-tableau],[data-drop-foundation]")) event.preventDefault();
});
elements.board.addEventListener("drop", (event) => {
  const target = event.target.closest("[data-drop-tableau],[data-drop-foundation]");
  if (!target) return;
  event.preventDefault();
  let source = selectedSource;
  try { source = JSON.parse(event.dataTransfer?.getData("text/plain") || "null") ?? source; } catch { /* keep the selected card source */ }
  if (!source) return;
  if (target.dataset.dropTableau !== undefined) moveToColumn(source, Number(target.dataset.dropTableau));
  else moveToBase(source, Number(target.dataset.dropFoundation));
});
elements.board.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const foundation = event.target.closest("[data-drop-foundation]");
  const column = event.target.closest("[data-drop-tableau]");
  if (!foundation && !(column && !game.tableau[Number(column.dataset.dropTableau)].length)) return;
  event.preventDefault();
  if (!selectedSource) return;
  if (foundation) moveToBase(selectedSource, Number(foundation.dataset.dropFoundation));
  else moveToColumn(selectedSource, Number(column.dataset.dropTableau));
});

elements.stock.addEventListener("click", () => {
  if (game.status !== "playing") return;
  const next = drawFromStock(game);
  if (next === game) return;
  game = next;
  selectedSource = null;
  dirty = true;
  persist();
  renderBoard();
});
elements.foundationButton.addEventListener("click", () => {
  if (!selectedSource) return;
  const sourceCard = selectedSource.pile === "waste" ? game.waste.at(-1)
    : selectedSource.pile === "tableau" ? game.tableau[selectedSource.index]?.[selectedSource.cardIndex]
      : game.foundations[selectedSource.index]?.at(-1);
  if (!sourceCard) return;
  const target = game.foundations.findIndex((pile) => !pile.length ? sourceCard.rank === 1 : pile.at(-1).suit === sourceCard.suit && pile.at(-1).rank + 1 === sourceCard.rank);
  if (target >= 0) moveToBase(selectedSource, target);
  else elements.status.textContent = "这张牌暂时不能放入基础牌堆。";
});
elements.undoButton.addEventListener("click", () => applyMove(undoMove(game), "已撤销上一步。"));
function startNewGame() {
  game = createGame();
  selectedSource = null;
  dirty = true;
  persist();
  renderBoard();
}
elements.newGameButton.addEventListener("click", startNewGame);
elements.resultButton.addEventListener("click", startNewGame);

function tick() {
  const now = performance.now();
  const elapsed = Math.max(0, now - lastTick);
  lastTick = now;
  if (!document.hidden && !restLocked && game.status === "playing" && elapsed > 0 && elapsed < 5000) {
    game = updateElapsed(game, elapsed);
    dirty = true;
    elements.timer.textContent = formatTime(game.elapsedMs);
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
