import { BLACK, WHITE, boardKey, createBoard, getGroup, playMove, scoreBoard } from "./engine.mjs";

const names = { [BLACK]: "黑棋", [WHITE]: "白棋" };
const difficultyNames = { easy: "简单", medium: "中等", hard: "困难" };
const sizeNames = { 9: "九路", 13: "十三路", 19: "十九路" };
const ids = ["board", "modePanel", "difficultyGroup", "startButton", "resultPanel", "resultTitle", "resultMessage", "scoreDetails", "scoringPanel", "scoringText", "resumeButton", "confirmScoreButton", "restartButton", "resultModeButton", "undoButton", "passButton", "restartControl", "modeButton", "soundButton", "modeBadge", "turnText", "blackCard", "whiteCard", "blackName", "whiteName", "blackCaptures", "whiteCaptures", "notice"];
const elements = Object.fromEntries(ids.map((id) => [id, document.querySelector(`#${id}`)]));
const context = elements.board.getContext("2d");

const state = {
  mode: "pvp", difficulty: "medium", size: 9, board: createBoard(9), currentPlayer: BLACK,
  running: false, thinking: false, history: [], captures: { [BLACK]: 0, [WHITE]: 0 },
  consecutivePasses: 0, soundOn: true, cursor: { row: 4, col: 4 }, lastMove: null,
  settingsOpen: true, scoring: false, deadStones: new Set(), scoringConfirmations: new Set(), aiRequestId: 0,
};
const draft = { mode: "pvp", difficulty: "medium", size: 9 };
let aiWorker;
let audioContext;

function restartAiWorker() {
  aiWorker?.terminate();
  aiWorker = new Worker(new URL("./ai-worker.js", import.meta.url), { type: "module" });
  aiWorker.addEventListener("message", ({ data }) => {
    if (data.requestId !== state.aiRequestId || !state.running || state.currentPlayer !== WHITE) return;
    state.thinking = false;
    if (data.move) placeStone(...data.move, true); else passTurn(true);
  });
}

function cancelAi() {
  state.aiRequestId += 1;
  state.thinking = false;
  restartAiWorker();
}

function playTone(frequency, duration = .1) {
  if (!state.soundOn) return;
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(.08, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function metrics() {
  const size = elements.board.clientWidth;
  const padding = size * (state.size === 19 ? .055 : .075);
  return { size, padding, gap: (size - padding * 2) / (state.size - 1) };
}

function starPoints(size) {
  if (size === 9) return [[2,2],[2,6],[4,4],[6,2],[6,6]];
  const low = size === 13 ? 3 : 3;
  const high = size - 1 - low;
  const middle = (size - 1) / 2;
  return [[low,low],[low,high],[high,low],[high,high],[middle,middle], [low,middle],[high,middle],[middle,low],[middle,high]];
}

function drawStone(row, col, player, gap, padding) {
  const x = padding + col * gap;
  const y = padding + row * gap;
  const radius = Math.min(gap * .45, 17);
  const gradient = context.createRadialGradient(x - radius * .3, y - radius * .35, 1, x, y, radius);
  if (player === BLACK) { gradient.addColorStop(0, "#66706c"); gradient.addColorStop(1, "#17201c"); }
  else { gradient.addColorStop(0, "#fff"); gradient.addColorStop(1, "#dcded9"); }
  context.shadowColor = "rgba(43,40,29,.35)"; context.shadowBlur = radius * .3; context.shadowOffsetY = radius * .12;
  context.fillStyle = gradient; context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill(); context.shadowColor = "transparent";
}

function drawBoard() {
  const { size, padding, gap } = metrics();
  const ratio = window.devicePixelRatio || 1;
  elements.board.width = Math.round(size * ratio); elements.board.height = Math.round(size * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const wood = context.createLinearGradient(0, 0, size, size); wood.addColorStop(0, "#efd18f"); wood.addColorStop(1, "#d5a755");
  context.fillStyle = wood; context.fillRect(0, 0, size, size);
  context.strokeStyle = "rgba(52,45,28,.78)"; context.lineWidth = Math.max(1, size / 650);
  for (let index = 0; index < state.size; index += 1) {
    const pos = padding + index * gap;
    context.beginPath(); context.moveTo(padding, pos); context.lineTo(size - padding, pos); context.stroke();
    context.beginPath(); context.moveTo(pos, padding); context.lineTo(pos, size - padding); context.stroke();
  }
  context.fillStyle = "#51472f";
  for (const [row, col] of starPoints(state.size)) { context.beginPath(); context.arc(padding + col * gap, padding + row * gap, Math.max(2.2, gap * .075), 0, Math.PI * 2); context.fill(); }
  state.board.forEach((line, row) => line.forEach((cell, col) => { if (cell) drawStone(row, col, cell, gap, padding); }));
  for (const point of state.deadStones) {
    const [row, col] = point.split(",").map(Number);
    const x = padding + col * gap; const y = padding + row * gap; const radius = Math.min(gap * .28, 11);
    context.strokeStyle = "#e84f57"; context.lineWidth = Math.max(2.5, gap * .08); context.lineCap = "round";
    context.beginPath(); context.moveTo(x - radius, y - radius); context.lineTo(x + radius, y + radius); context.moveTo(x + radius, y - radius); context.lineTo(x - radius, y + radius); context.stroke();
  }
  if (state.lastMove) {
    const { row, col } = state.lastMove;
    context.fillStyle = state.board[row]?.[col] === BLACK ? "#f5cf5d" : "#46725b";
    context.beginPath(); context.arc(padding + col * gap, padding + row * gap, Math.max(2.3, gap * .1), 0, Math.PI * 2); context.fill();
  }
  if (document.activeElement === elements.board && (state.running || state.scoring) && !state.thinking) {
    context.strokeStyle = "#ffec6c"; context.lineWidth = 3; context.setLineDash([4, 3]);
    context.strokeRect(padding + state.cursor.col * gap - gap * .42, padding + state.cursor.row * gap - gap * .42, gap * .84, gap * .84); context.setLineDash([]);
  }
}

function updateStatus() {
  elements.blackCard.classList.toggle("active", (state.running || state.scoring) && state.currentPlayer === BLACK);
  elements.whiteCard.classList.toggle("active", (state.running || state.scoring) && state.currentPlayer === WHITE);
  elements.modeBadge.textContent = `${state.mode === "ai" ? `人机 · ${difficultyNames[state.difficulty]}` : "人人"} · ${sizeNames[state.size]}`;
  elements.blackName.textContent = state.mode === "ai" ? "你" : "玩家一";
  elements.whiteName.textContent = state.mode === "ai" ? "电脑" : "玩家二";
  elements.blackCaptures.textContent = state.captures[BLACK]; elements.whiteCaptures.textContent = state.captures[WHITE];
  elements.turnText.textContent = state.scoring ? `${names[state.currentPlayer]}确认死棋` : state.thinking ? "电脑正在思考…" : state.running ? `${names[state.currentPlayer]}回合` : "准备开始";
  elements.undoButton.disabled = !state.history.length || state.thinking || state.settingsOpen || state.scoring;
  elements.passButton.disabled = !state.running || state.thinking || state.settingsOpen || state.scoring;
  elements.restartControl.disabled = state.settingsOpen;
  elements.board.setAttribute("aria-label", `${sizeNames[state.size]}围棋棋盘。使用方向键移动，按回车或空格落子。`);
}

function snapshot() {
  return { board: state.board.map((row) => [...row]), currentPlayer: state.currentPlayer, captures: { ...state.captures }, consecutivePasses: state.consecutivePasses, lastMove: state.lastMove && { ...state.lastMove } };
}

function previousPositionKey() {
  return state.history.length ? boardKey(state.history.at(-1).board) : null;
}

function finishGame() {
  state.running = false; state.thinking = false; state.scoring = false;
  elements.scoringPanel.classList.add("hidden");
  const score = scoreBoard(state.board, undefined, state.deadStones);
  elements.resultTitle.textContent = `${names[score.winner]}获胜！`;
  elements.resultMessage.textContent = `${names[score.winner]}领先 ${score.margin.toFixed(1)} 目`;
  elements.scoreDetails.innerHTML = `<span>黑棋 ${score.black.toFixed(1)}<small>棋子 ${score.blackStones} · 地 ${score.blackTerritory}</small></span><span>白棋 ${score.white.toFixed(1)}<small>棋子 ${score.whiteStones} · 地 ${score.whiteTerritory} · 贴目 ${score.komi}</small></span>`;
  elements.resultPanel.classList.remove("hidden");
  playTone(score.winner === BLACK ? 620 : 720, .4); updateStatus(); elements.restartButton.focus();
}

function placeStone(row, col, automated = false) {
  if (!state.running || state.thinking || state.settingsOpen || state.scoring) return false;
  if (state.mode === "ai" && state.currentPlayer === WHITE && !automated) return false;
  const result = playMove(state.board, row, col, state.currentPlayer, previousPositionKey());
  if (!result.legal) { elements.notice.textContent = `${result.reason}，换个交叉点试试。`; playTone(170, .12); return false; }
  state.history.push(snapshot());
  const player = state.currentPlayer;
  state.board = result.board; state.captures[player] += result.captured.length; state.consecutivePasses = 0;
  state.lastMove = { row, col }; state.cursor = { row, col }; state.currentPlayer = player === BLACK ? WHITE : BLACK;
  elements.notice.textContent = result.captured.length ? `${names[player]}提掉了 ${result.captured.length} 颗棋子！` : `${names[state.currentPlayer]}请落子`;
  playTone(player === BLACK ? 260 : 370); drawBoard(); updateStatus();
  if (state.mode === "ai" && state.currentPlayer === WHITE) requestAiMove();
  return true;
}

function passTurn(automated = false) {
  if (!state.running || state.thinking || state.settingsOpen || state.scoring) return;
  if (state.mode === "ai" && state.currentPlayer === WHITE && !automated) return;
  state.history.push(snapshot()); state.consecutivePasses += 1; state.lastMove = null;
  const passed = state.currentPlayer; state.currentPlayer = passed === BLACK ? WHITE : BLACK;
  elements.notice.textContent = `${names[passed]}停一手`;
  if (state.consecutivePasses >= 2) { enterScoring(); return; }
  drawBoard(); updateStatus();
  if (state.mode === "ai" && state.currentPlayer === WHITE) requestAiMove();
}

function requestAiMove() {
  state.thinking = true; updateStatus();
  const requestId = ++state.aiRequestId;
  aiWorker.postMessage({ requestId, board: state.board, difficulty: state.difficulty, player: WHITE, previousBoardKey: previousPositionKey(), opponentPassed: state.consecutivePasses === 1 });
}

function resetGame() {
  cancelAi(); Object.assign(state, draft); state.board = createBoard(state.size); state.currentPlayer = BLACK; state.running = true; state.thinking = false;
  state.history = []; state.captures = { [BLACK]: 0, [WHITE]: 0 }; state.consecutivePasses = 0; state.lastMove = null;
  state.settingsOpen = false; state.scoring = false; state.deadStones = new Set(); state.scoringConfirmations = new Set();
  const center = Math.floor(state.size / 2); state.cursor = { row: center, col: center };
  elements.modePanel.classList.add("hidden"); elements.resultPanel.classList.add("hidden"); elements.scoringPanel.classList.add("hidden"); elements.notice.textContent = "黑棋先行，落子占地，也要留心棋子的气 ✨";
  drawBoard(); updateStatus(); elements.board.focus();
}

function showModePanel() {
  cancelAi(); Object.assign(draft, { mode: state.mode, difficulty: state.difficulty, size: state.size });
  state.running = false; state.settingsOpen = true; state.scoring = false; elements.scoringPanel.classList.add("hidden"); elements.resultPanel.classList.add("hidden"); elements.modePanel.classList.remove("hidden"); updateStatus();
}

function undo() {
  if (!state.history.length || state.thinking || state.settingsOpen || state.scoring) return;
  const steps = state.mode === "ai" && state.currentPlayer === BLACK && state.history.length >= 2 ? 2 : 1;
  let restored;
  for (let index = 0; index < steps; index += 1) restored = state.history.pop();
  Object.assign(state, restored); state.running = true; state.thinking = false;
  elements.resultPanel.classList.add("hidden"); elements.notice.textContent = "已撤回上一步"; drawBoard(); updateStatus(); elements.board.focus();
}

function enterScoring() {
  state.running = false; state.scoring = true; state.deadStones = new Set(); state.scoringConfirmations = new Set();
  elements.scoringPanel.classList.remove("hidden"); elements.notice.textContent = "点击棋盘上的死棋进行标记，双方确认后数子"; updateScoringStatus(); drawBoard(); updateStatus(); elements.board.focus();
}

function updateScoringStatus() {
  const marked = state.deadStones.size;
  elements.scoringText.textContent = `${names[state.currentPlayer]}确认 · 已标记 ${marked} 颗死棋`;
}

function toggleDeadGroup(row, col) {
  if (!state.scoring || !state.board[row]?.[col]) return;
  const group = getGroup(state.board, row, col).stones.map(([r, c]) => `${r},${c}`);
  const remove = group.every((point) => state.deadStones.has(point));
  for (const point of group) remove ? state.deadStones.delete(point) : state.deadStones.add(point);
  state.scoringConfirmations.clear(); updateScoringStatus(); drawBoard();
}

function confirmScoring() {
  if (!state.scoring) return;
  state.scoringConfirmations.add(state.currentPlayer);
  if (state.scoringConfirmations.size >= 2) { finishGame(); return; }
  state.currentPlayer = state.currentPlayer === BLACK ? WHITE : BLACK; updateScoringStatus(); updateStatus();
  if (state.mode === "ai" && state.currentPlayer === WHITE) {
    state.scoringConfirmations.add(WHITE); finishGame();
  }
}

function resumeGame() {
  if (!state.scoring) return;
  state.scoring = false; state.running = true; state.consecutivePasses = 0; state.deadStones.clear(); state.scoringConfirmations.clear();
  elements.scoringPanel.classList.add("hidden"); elements.notice.textContent = "对局继续"; drawBoard(); updateStatus(); elements.board.focus();
  if (state.mode === "ai" && state.currentPlayer === WHITE) requestAiMove();
}

function boardPosition(event) {
  const rect = elements.board.getBoundingClientRect(); const { padding, gap } = metrics();
  const col = Math.round((event.clientX - rect.left - padding) / gap); const row = Math.round((event.clientY - rect.top - padding) / gap);
  return row >= 0 && col >= 0 && row < state.size && col < state.size ? [row, col] : null;
}

function selectButtons(selector, chosen) {
  document.querySelectorAll(selector).forEach((item) => { const selected = item === chosen; item.classList.toggle("selected", selected); item.setAttribute("aria-pressed", selected); });
}

document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => { draft.mode = button.dataset.mode; selectButtons("[data-mode]", button); elements.difficultyGroup.classList.toggle("hidden", draft.mode !== "ai"); }));
document.querySelectorAll("[data-difficulty]").forEach((button) => button.addEventListener("click", () => { draft.difficulty = button.dataset.difficulty; selectButtons("[data-difficulty]", button); }));
document.querySelectorAll("[data-size]").forEach((button) => button.addEventListener("click", () => { draft.size = Number(button.dataset.size); selectButtons("[data-size]", button); }));
elements.board.addEventListener("pointerup", (event) => { const position = boardPosition(event); if (!position) return; state.scoring ? toggleDeadGroup(...position) : placeStone(...position); });
elements.board.addEventListener("keydown", (event) => {
  const offsets = { ArrowUp: [-1,0], ArrowDown: [1,0], ArrowLeft: [0,-1], ArrowRight: [0,1] };
  if (offsets[event.key]) { event.preventDefault(); state.cursor.row = Math.max(0, Math.min(state.size - 1, state.cursor.row + offsets[event.key][0])); state.cursor.col = Math.max(0, Math.min(state.size - 1, state.cursor.col + offsets[event.key][1])); drawBoard(); }
  if (["Enter", " "].includes(event.key)) { event.preventDefault(); state.scoring ? toggleDeadGroup(state.cursor.row, state.cursor.col) : placeStone(state.cursor.row, state.cursor.col); }
});
elements.board.addEventListener("focus", drawBoard); elements.board.addEventListener("blur", drawBoard);
elements.startButton.addEventListener("click", resetGame); elements.restartButton.addEventListener("click", resetGame); elements.restartControl.addEventListener("click", resetGame);
elements.undoButton.addEventListener("click", undo); elements.passButton.addEventListener("click", () => passTurn(false)); elements.modeButton.addEventListener("click", showModePanel); elements.resultModeButton.addEventListener("click", showModePanel);
elements.resumeButton.addEventListener("click", resumeGame); elements.confirmScoreButton.addEventListener("click", confirmScoring);
elements.soundButton.addEventListener("click", () => { state.soundOn = !state.soundOn; elements.soundButton.textContent = state.soundOn ? "🔊" : "🔇"; elements.soundButton.setAttribute("aria-label", state.soundOn ? "关闭声音" : "打开声音"); });
window.addEventListener("resize", drawBoard);
restartAiWorker();
drawBoard(); updateStatus();
