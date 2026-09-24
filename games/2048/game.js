import { createGame, highestTile, playTurn } from "./engine.mjs";
import { createVersionedGameStore, showSaveConflict } from "../../assets/js/safe-storage.js";
import { startPlayLimit } from "../../assets/js/play-limit.js";
import { createDefaultSave, normalizeNickname, sortLeaderboard, validate2048Save } from "./save-state.mjs";

const SAVE_KEY = "lulu-2048-save-v1";
const $ = (id) => document.getElementById(id);
const elements = {
  board: $("board"), setupPanel: $("setupPanel"), resultPanel: $("resultPanel"), nicknameInput: $("nicknameInput"), setupError: $("setupError"),
  startButton: $("startButton"), newGameButton: $("newGameButton"), playAgainButton: $("playAgainButton"), scoreValue: $("scoreValue"),
  bestValue: $("bestValue"), playerLabel: $("playerLabel"), resultIcon: $("resultIcon"), resultTitle: $("resultTitle"), resultMessage: $("resultMessage"),
  leaderboardButton: $("leaderboardButton"), resultLeaderboardButton: $("resultLeaderboardButton"), leaderboardDialog: $("leaderboardDialog"),
  closeLeaderboardButton: $("closeLeaderboardButton"), editNicknameInput: $("editNicknameInput"), saveNicknameButton: $("saveNicknameButton"),
  nicknameError: $("nicknameError"), leaderboardRows: $("leaderboardRows"), emptyLeaderboard: $("emptyLeaderboard"),
};
const gameStore = createVersionedGameStore({ key: SAVE_KEY, validate: validate2048Save, storage: localStorage, onConflict: showSaveConflict });
let save = gameStore.load() ?? createDefaultSave();
let touchStart = null;

function persist() { gameStore.save(save); }

function renderBoard() {
  const game = save.currentRun?.game;
  elements.board.replaceChildren();
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const value = game?.board?.[row]?.[col] ?? 0;
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.value = String(value);
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", value ? `${value}` : "空格");
      cell.textContent = value ? String(value) : "";
      elements.board.append(cell);
    }
  }
  elements.scoreValue.textContent = String(game?.score ?? 0);
  elements.bestValue.textContent = String(save.bestScore);
  elements.playerLabel.textContent = save.currentRun ? `玩家：${save.currentRun.nickname}` : save.nickname ? `玩家：${save.nickname}` : "玩家：尚未设置";
  elements.newGameButton.disabled = !save.nickname;
  elements.setupPanel.classList.toggle("hidden", Boolean(save.currentRun));
  elements.resultPanel.classList.toggle("hidden", !save.currentRun || save.currentRun.game.status === "playing");
  if (save.currentRun && save.currentRun.game.status !== "playing") renderResult();
}

function renderResult() {
  const game = save.currentRun.game;
  if (game.status === "won") {
    elements.resultIcon.textContent = "🎉";
    elements.resultTitle.textContent = "恭喜你，合成 2048！";
    elements.resultMessage.textContent = `${save.currentRun.nickname}，你以 ${game.score} 分赢得了游戏！本局已经结束，成绩已保存到本地排行榜。`;
  } else {
    elements.resultIcon.textContent = "🧩";
    elements.resultTitle.textContent = "棋盘没有可移动的位置了";
    elements.resultMessage.textContent = `${save.currentRun.nickname}，本局得分 ${game.score}，最高数字 ${highestTile(game.board)}。试试换一种合并顺序再挑战一次吧！成绩已记入本地排行榜。`;
  }
}

function startNewGame(nickname = save.nickname) {
  const normalized = normalizeNickname(nickname);
  if (!normalized) {
    elements.setupError.textContent = "请先填写昵称，再开始游戏。";
    elements.nicknameInput.focus();
    return false;
  }
  save.nickname = normalized;
  save.currentRun = { runId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, nickname: normalized, game: createGame(), recorded: false };
  elements.setupError.textContent = "";
  persist();
  renderBoard();
  elements.board.focus();
  return true;
}

function recordFinishedRun() {
  const run = save.currentRun;
  if (!run || run.recorded || run.game.status === "playing") return;
  const entry = {
    runId: run.runId,
    nickname: run.nickname,
    score: run.game.score,
    highestTile: highestTile(run.game.board),
    outcome: run.game.status,
    completedAt: Date.now(),
  };
  save.leaderboard = sortLeaderboard([...save.leaderboard.filter((item) => item.runId !== run.runId), entry]);
  save.bestScore = Math.max(save.bestScore, entry.score);
  run.recorded = true;
}

function move(direction) {
  const run = save.currentRun;
  if (!run || run.game.status !== "playing") return;
  const turn = playTurn(run.game, direction);
  if (!turn.moved) return;
  run.game = turn.game;
  save.bestScore = Math.max(save.bestScore, run.game.score);
  if (run.game.status !== "playing") recordFinishedRun();
  persist();
  renderBoard();
}

const keyDirections = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
document.addEventListener("keydown", (event) => {
  if (elements.leaderboardDialog.open || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
    || event.target.closest?.("button, a")) return;
  if (keyDirections[event.key]) {
    event.preventDefault();
    move(keyDirections[event.key]);
  }
});
elements.board.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse") return;
  touchStart = { x: event.clientX, y: event.clientY };
});
elements.board.addEventListener("pointerup", (event) => {
  if (!touchStart) return;
  const dx = event.clientX - touchStart.x;
  const dy = event.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
});
elements.board.addEventListener("pointercancel", () => { touchStart = null; });

function showLeaderboard() {
  renderLeaderboard();
  elements.editNicknameInput.value = save.nickname;
  elements.nicknameError.textContent = "";
  elements.leaderboardDialog.showModal();
}

function renderLeaderboard() {
  elements.leaderboardRows.replaceChildren();
  save.leaderboard.forEach((entry, index) => {
    const row = document.createElement("tr");
    const place = document.createElement("td"); place.textContent = String(index + 1);
    const nickname = document.createElement("td"); nickname.textContent = entry.nickname;
    const score = document.createElement("td"); score.textContent = entry.score.toLocaleString("zh-CN");
    const tile = document.createElement("td"); tile.textContent = String(entry.highestTile);
    const outcome = document.createElement("td");
    const badge = document.createElement("span"); badge.className = `outcome-badge${entry.outcome === "lost" ? " lost" : ""}`; badge.textContent = entry.outcome === "won" ? "获胜" : "结束"; outcome.append(badge);
    row.append(place, nickname, score, tile, outcome);
    elements.leaderboardRows.append(row);
  });
  elements.emptyLeaderboard.classList.toggle("hidden", save.leaderboard.length > 0);
}

elements.startButton.addEventListener("click", () => startNewGame(elements.nicknameInput.value));
elements.nicknameInput.addEventListener("keydown", (event) => { if (event.key === "Enter") startNewGame(elements.nicknameInput.value); });
elements.newGameButton.addEventListener("click", () => startNewGame());
elements.playAgainButton.addEventListener("click", () => startNewGame());
elements.leaderboardButton.addEventListener("click", showLeaderboard);
elements.resultLeaderboardButton.addEventListener("click", showLeaderboard);
elements.closeLeaderboardButton.addEventListener("click", () => elements.leaderboardDialog.close());
elements.saveNicknameButton.addEventListener("click", () => {
  const nickname = normalizeNickname(elements.editNicknameInput.value);
  if (!nickname) { elements.nicknameError.textContent = "昵称不能为空，请填写 1–12 个字符。"; elements.editNicknameInput.focus(); return; }
  save.nickname = nickname;
  persist();
  elements.nicknameError.textContent = "昵称已保存在当前浏览器中。";
  elements.nicknameError.style.color = "#348263";
  renderBoard();
});
elements.editNicknameInput.addEventListener("input", () => { elements.nicknameError.textContent = ""; elements.nicknameError.style.color = ""; });

if (save.currentRun?.game.status !== "playing" && save.currentRun && !save.currentRun.recorded) recordFinishedRun();
renderBoard();
if (!save.nickname && !save.currentRun) elements.nicknameInput.focus();
window.addEventListener("pagehide", persist);
startPlayLimit({ onLock: persist, onResume: renderBoard });
