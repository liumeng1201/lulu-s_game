import { BLACK, BOARD_SIZE, EMPTY, WHITE, checkWin, chooseAiMove, createBoard, isBoardFull } from "./engine.mjs";

const names = { [BLACK]: "黑棋", [WHITE]: "白棋" };
const difficultyNames = { easy: "简单", medium: "中等", hard: "困难" };
const elements = Object.fromEntries(["board", "modePanel", "difficultyGroup", "startButton", "resultPanel", "resultEmoji", "resultTitle", "resultMessage", "restartButton", "resultModeButton", "undoButton", "restartControl", "modeButton", "soundButton", "modeBadge", "turnText", "blackCard", "whiteCard", "blackName", "whiteName"].map((id) => [id, document.querySelector(`#${id}`)]));
const context = elements.board.getContext("2d");

const state = { mode: "pvp", difficulty: "medium", board: createBoard(), currentPlayer: BLACK, running: false, thinking: false, winner: null, winningLine: [], history: [], soundOn: true, cursor: { row: 7, col: 7 }, aiTimer: null };
let audioContext;

function playTone(frequency, duration, type = "sine") {
  if (!state.soundOn) return;
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(.1, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function canvasMetrics() {
  const size = elements.board.clientWidth;
  const padding = size * .055;
  return { size, padding, gap: (size - padding * 2) / (BOARD_SIZE - 1) };
}

function drawBoard() {
  const { size, padding, gap } = canvasMetrics();
  const ratio = window.devicePixelRatio || 1;
  elements.board.width = Math.round(size * ratio);
  elements.board.height = Math.round(size * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, size, size);
  const gradient = context.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#f4d597");
  gradient.addColorStop(1, "#dca75c");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  context.strokeStyle = "rgba(83,56,50,.72)";
  context.lineWidth = Math.max(1, size / 520);
  for (let index = 0; index < BOARD_SIZE; index += 1) {
    const position = padding + index * gap;
    context.beginPath(); context.moveTo(padding, position); context.lineTo(size - padding, position); context.stroke();
    context.beginPath(); context.moveTo(position, padding); context.lineTo(position, size - padding); context.stroke();
  }
  context.fillStyle = "#6a463c";
  for (const [row, col] of [[3,3],[3,11],[7,7],[11,3],[11,11]]) {
    context.beginPath(); context.arc(padding + col * gap, padding + row * gap, Math.max(2.5, gap * .09), 0, Math.PI * 2); context.fill();
  }
  state.board.forEach((line, row) => line.forEach((cell, col) => { if (cell) drawStone(row, col, cell, gap, padding); }));
  if (state.history.length) {
    const { row, col } = state.history.at(-1);
    context.strokeStyle = state.board[row][col] === BLACK ? "#ffe272" : "#7655d6";
    context.lineWidth = Math.max(2, gap * .07);
    context.beginPath(); context.arc(padding + col * gap, padding + row * gap, gap * .13, 0, Math.PI * 2); context.stroke();
  }
  if (state.winningLine.length) {
    context.strokeStyle = "#ff5e78"; context.lineWidth = Math.max(4, gap * .11); context.lineCap = "round";
    const first = state.winningLine[0]; const last = state.winningLine.at(-1);
    context.beginPath(); context.moveTo(padding + first[1] * gap, padding + first[0] * gap); context.lineTo(padding + last[1] * gap, padding + last[0] * gap); context.stroke();
  }
  if (document.activeElement === elements.board && state.running && !state.thinking) {
    context.strokeStyle = "#fff4a3"; context.lineWidth = 3; context.setLineDash([4,3]);
    context.strokeRect(padding + state.cursor.col * gap - gap * .43, padding + state.cursor.row * gap - gap * .43, gap * .86, gap * .86);
    context.setLineDash([]);
  }
}

function drawStone(row, col, player, gap, padding) {
  const x = padding + col * gap; const y = padding + row * gap; const radius = gap * .4;
  const gradient = context.createRadialGradient(x - radius * .35, y - radius * .4, radius * .1, x, y, radius);
  if (player === BLACK) { gradient.addColorStop(0, "#746b81"); gradient.addColorStop(1, "#211a2c"); }
  else { gradient.addColorStop(0, "#fff"); gradient.addColorStop(1, "#ddd8df"); }
  context.shadowColor = "rgba(55,35,60,.35)"; context.shadowBlur = radius * .3; context.shadowOffsetY = radius * .15;
  context.fillStyle = gradient; context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
  context.shadowColor = "transparent";
}

function updateStatus() {
  elements.blackCard.classList.toggle("active", state.running && state.currentPlayer === BLACK);
  elements.whiteCard.classList.toggle("active", state.running && state.currentPlayer === WHITE);
  elements.modeBadge.textContent = state.mode === "ai" ? `人机 · ${difficultyNames[state.difficulty]}` : "人人对战";
  elements.blackName.textContent = state.mode === "ai" ? "你" : "玩家一";
  elements.whiteName.textContent = state.mode === "ai" ? "电脑" : "玩家二";
  elements.turnText.textContent = state.thinking ? "电脑正在思考…" : state.running ? `${names[state.currentPlayer]}回合` : "准备开始";
  elements.undoButton.disabled = !state.history.length || state.thinking;
}

function finishGame(winner, line = []) {
  state.running = false; state.winner = winner; state.winningLine = line;
  if (winner) {
    const playerWon = state.mode !== "ai" || winner === BLACK;
    elements.resultEmoji.textContent = playerWon ? "🎉" : "🌟";
    elements.resultTitle.textContent = state.mode === "ai" ? (winner === BLACK ? "你赢啦！" : "电脑获胜") : `${names[winner]}获胜！`;
    elements.resultMessage.textContent = playerWon ? "漂亮的五连，太厉害啦！" : "这一步很精彩，再挑战一次吧！";
    playTone(playerWon ? 660 : 260, .45, "triangle");
  } else {
    elements.resultEmoji.textContent = "🤝"; elements.resultTitle.textContent = "平局！"; elements.resultMessage.textContent = "棋盘下满了，双方都很厉害！";
    playTone(400, .35);
  }
  drawBoard(); updateStatus(); elements.resultPanel.classList.remove("hidden"); elements.restartButton.focus();
}

function placeStone(row, col) {
  if (!state.running || state.thinking || state.board[row]?.[col] !== EMPTY) return false;
  const player = state.currentPlayer;
  state.board[row][col] = player; state.history.push({ row, col, player });
  state.cursor = { row, col }; playTone(player === BLACK ? 280 : 390, .1, "triangle");
  const line = checkWin(state.board, row, col, player);
  if (line) { finishGame(player, line); return true; }
  if (isBoardFull(state.board)) { finishGame(null); return true; }
  state.currentPlayer = player === BLACK ? WHITE : BLACK;
  drawBoard(); updateStatus();
  if (state.mode === "ai" && state.currentPlayer === WHITE) requestAiMove();
  return true;
}

function requestAiMove() {
  state.thinking = true; updateStatus();
  state.aiTimer = setTimeout(() => {
    const move = chooseAiMove(state.board, state.difficulty, WHITE);
    state.thinking = false;
    if (move && state.running) placeStone(...move);
  }, 350);
}

function resetGame() {
  clearTimeout(state.aiTimer); state.board = createBoard(); state.currentPlayer = BLACK; state.running = true; state.thinking = false; state.winner = null; state.winningLine = []; state.history = []; state.cursor = { row: 7, col: 7 };
  elements.modePanel.classList.add("hidden"); elements.resultPanel.classList.add("hidden");
  drawBoard(); updateStatus(); elements.board.focus();
}

function showModePanel() {
  clearTimeout(state.aiTimer); state.running = false; state.thinking = false; elements.resultPanel.classList.add("hidden"); elements.modePanel.classList.remove("hidden"); updateStatus();
}

function undo() {
  if (!state.history.length || state.thinking) return;
  elements.resultPanel.classList.add("hidden"); state.winner = null; state.winningLine = []; state.running = true;
  const count = state.mode === "ai" && state.history.length >= 2 ? 2 : 1;
  for (let index = 0; index < count; index += 1) { const move = state.history.pop(); if (move) state.board[move.row][move.col] = EMPTY; }
  state.currentPlayer = state.mode === "ai" ? BLACK : (state.history.at(-1)?.player === BLACK ? WHITE : BLACK);
  drawBoard(); updateStatus(); elements.board.focus();
}

function boardPosition(event) {
  const rect = elements.board.getBoundingClientRect(); const { padding, gap } = canvasMetrics();
  const x = event.clientX - rect.left - elements.board.clientLeft;
  const y = event.clientY - rect.top - elements.board.clientTop;
  const col = Math.round((x - padding) / gap); const row = Math.round((y - padding) / gap);
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE ? [row, col] : null;
}

document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
  state.mode = button.dataset.mode;
  document.querySelectorAll("[data-mode]").forEach((item) => { const selected = item === button; item.classList.toggle("selected", selected); item.setAttribute("aria-pressed", selected); });
  elements.difficultyGroup.classList.toggle("hidden", state.mode !== "ai"); updateStatus();
}));
document.querySelectorAll("[data-difficulty]").forEach((button) => button.addEventListener("click", () => {
  state.difficulty = button.dataset.difficulty;
  document.querySelectorAll("[data-difficulty]").forEach((item) => { const selected = item === button; item.classList.toggle("selected", selected); item.setAttribute("aria-pressed", selected); }); updateStatus();
}));
elements.board.addEventListener("pointerup", (event) => { const position = boardPosition(event); if (position) placeStone(...position); });
elements.board.addEventListener("keydown", (event) => {
  const offsets = { ArrowUp: [-1,0], ArrowDown: [1,0], ArrowLeft: [0,-1], ArrowRight: [0,1] };
  if (offsets[event.key]) { event.preventDefault(); state.cursor.row = Math.max(0, Math.min(14, state.cursor.row + offsets[event.key][0])); state.cursor.col = Math.max(0, Math.min(14, state.cursor.col + offsets[event.key][1])); drawBoard(); }
  if (["Enter", " "].includes(event.key)) { event.preventDefault(); placeStone(state.cursor.row, state.cursor.col); }
});
elements.board.addEventListener("focus", drawBoard); elements.board.addEventListener("blur", drawBoard);
elements.startButton.addEventListener("click", resetGame); elements.restartButton.addEventListener("click", resetGame); elements.restartControl.addEventListener("click", resetGame); elements.undoButton.addEventListener("click", undo); elements.modeButton.addEventListener("click", showModePanel); elements.resultModeButton.addEventListener("click", showModePanel);
elements.soundButton.addEventListener("click", () => { state.soundOn = !state.soundOn; elements.soundButton.textContent = state.soundOn ? "🔊" : "🔇"; elements.soundButton.setAttribute("aria-label", state.soundOn ? "关闭声音" : "打开声音"); });
window.addEventListener("resize", drawBoard);
drawBoard(); updateStatus();
