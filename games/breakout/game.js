import {
  advanceLevel, createGame, movePaddle, pauseGame, resumeGame, serveGame, stepGame,
  WORLD_HEIGHT, WORLD_WIDTH,
} from "./engine.mjs";
import { createVersionedGameStore, showSaveConflict } from "../../assets/js/safe-storage.js";
import { startPlayLimit } from "../../assets/js/play-limit.js";
import { createDefaultBreakoutSave, validateBreakoutSave } from "./save-state.mjs";

const SAVE_KEY = "lulu-breakout-save-v1";
const $ = (id) => document.getElementById(id);
const elements = {
  canvas: $("gameCanvas"), stage: $("gameStage"), level: $("levelValue"), score: $("scoreValue"), lives: $("livesValue"),
  overlay: $("overlayPanel"), panelTitle: $("panelTitle"), panelMessage: $("panelMessage"), panelButton: $("panelButton"),
  liveStatus: $("liveStatus"), pauseButton: $("pauseButton"), restartButton: $("restartButton"), leftButton: $("leftButton"), rightButton: $("rightButton"),
};
const gameStore = createVersionedGameStore({ key: SAVE_KEY, validate: validateBreakoutSave, onConflict: showSaveConflict });
const loaded = gameStore.load();
let game = loaded?.game ?? createDefaultBreakoutSave().game;
let lastFrameAt = 0;
let lastPersistAt = 0;
let dirty = !loaded;
let autoResumeAfterLock = false;
let panelAction = "serve";
let frameId = 0;
let scoreboardCache = "";

function persist() {
  if (!dirty) return;
  gameStore.save({ version: 1, game });
  dirty = false;
  lastPersistAt = performance.now();
}

function updateScoreboard() {
  const key = `${game.level}:${game.score}:${game.lives}`;
  if (key === scoreboardCache) return;
  scoreboardCache = key;
  elements.level.textContent = `${game.level} / 3`;
  elements.score.textContent = game.score.toLocaleString("zh-CN");
  elements.lives.textContent = `${"♥ ".repeat(game.lives)}${"♡ ".repeat(3 - game.lives)}`.trim();
}

function configurePanel(title, message, label, action) {
  elements.panelTitle.textContent = title;
  elements.panelMessage.textContent = message;
  elements.panelButton.innerHTML = `${label} <span aria-hidden="true">${action === "restart" ? "↻" : "▶"}</span>`;
  panelAction = action;
  elements.overlay.classList.remove("hidden");
}

function renderOverlay() {
  elements.pauseButton.disabled = !["playing", "paused"].includes(game.status);
  if (game.status === "playing") {
    elements.overlay.classList.add("hidden");
    elements.liveStatus.textContent = "小心别让小球掉下去！";
    elements.pauseButton.innerHTML = "Ⅱ <span>暂停</span>";
    return;
  }
  if (game.status === "ready") {
    const returning = game.elapsedMs > 0 || game.lives < 3 || game.level > 1;
    configurePanel(returning ? "准备好继续了吗？" : "准备好开球了吗？", returning
      ? `第 ${game.level} 关 · 得分 ${game.score} · 还剩 ${game.lives} 条生命。`
      : "移动球拍接住小球，清除砖块进入下一关。", returning ? "继续发球" : "开始发球", "serve");
    elements.liveStatus.textContent = "拖动球拍，接住弹回的小球！";
  } else if (game.status === "paused") {
    configurePanel("游戏已暂停", "休息一下，准备好后继续刚才的挑战。", "继续游戏", "resume");
    elements.liveStatus.textContent = "游戏已暂停。";
    elements.pauseButton.innerHTML = "▶ <span>继续</span>";
  } else if (game.status === "level-complete") {
    configurePanel(`第 ${game.level} 关完成！`, "太棒了！准备好迎接新的砖块阵型了吗？", "下一关", "next");
    elements.liveStatus.textContent = `第 ${game.level} 关完成。`;
  } else if (game.status === "won") {
    configurePanel("全部通关！", `你清除了三关砖块，获得 ${game.score} 分！`, "再玩一次", "restart");
    elements.liveStatus.textContent = "恭喜你完成全部关卡！";
  } else if (game.status === "lost") {
    configurePanel("再接再厉！", `这次得分 ${game.score}。再玩一轮，练习接球吧！`, "重新开始", "restart");
    elements.liveStatus.textContent = "生命用完了，本局结束。";
  }
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function canvasPoint(clientX) {
  const rect = elements.canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD_WIDTH, rect.height / WORLD_HEIGHT);
  if (!scale) return game.paddleX;
  const offsetX = (rect.width - WORLD_WIDTH * scale) / 2;
  return (clientX - rect.left - offsetX) / scale;
}

function draw() {
  const canvas = elements.canvas;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const bitmapWidth = Math.round(rect.width * pixelRatio);
  const bitmapHeight = Math.round(rect.height * pixelRatio);
  if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
    canvas.width = bitmapWidth;
    canvas.height = bitmapHeight;
  }
  const context = canvas.getContext("2d");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(rect.width / WORLD_WIDTH, rect.height / WORLD_HEIGHT);
  const offsetX = (rect.width - WORLD_WIDTH * scale) / 2;
  const offsetY = (rect.height - WORLD_HEIGHT * scale) / 2;
  context.setTransform(scale * pixelRatio, 0, 0, scale * pixelRatio, offsetX * pixelRatio, offsetY * pixelRatio);

  const backdrop = context.createLinearGradient(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  backdrop.addColorStop(0, "#48357e");
  backdrop.addColorStop(.55, "#35265f");
  backdrop.addColorStop(1, "#7655a6");
  context.fillStyle = backdrop;
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  context.strokeStyle = "rgba(255,255,255,.14)";
  context.lineWidth = 2;
  for (let x = 28; x < WORLD_WIDTH; x += 48) {
    for (let y = 24 + (Math.floor(x / 48) % 2) * 18; y < WORLD_HEIGHT; y += 48) {
      context.beginPath(); context.arc(x, y, 1.4, 0, Math.PI * 2); context.stroke();
    }
  }

  game.bricks.forEach((brick, index) => {
    if (!brick.active) return;
    const row = Math.floor(index / 10);
    const shades = ["#ffdf79", "#ffab83", "#f48ab0", "#9de1d3", "#a4bbff", "#d4a8f2", "#f8c764"];
    const gradient = context.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.height);
    gradient.addColorStop(0, shades[(row + game.level) % shades.length]);
    gradient.addColorStop(1, shades[(row + game.level + 2) % shades.length]);
    roundedRect(context, brick.x, brick.y, brick.width, brick.height, 8);
    context.fillStyle = gradient;
    context.fill();
    context.strokeStyle = "rgba(255,255,255,.76)";
    context.lineWidth = 2;
    context.stroke();
    if (brick.hits > 1) {
      context.fillStyle = "rgba(73,48,128,.65)";
      context.font = "bold 13px system-ui, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(brick.hits), brick.x + brick.width / 2, brick.y + brick.height / 2);
    }
  });

  const paddle = { x: game.paddleX - 66, y: WORLD_HEIGHT - 52, width: 132, height: 18 };
  const paddleGradient = context.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y + paddle.height);
  paddleGradient.addColorStop(0, "#fff1a6");
  paddleGradient.addColorStop(1, "#ffb955");
  context.shadowColor = "rgba(255,205,97,.6)";
  context.shadowBlur = 14;
  roundedRect(context, paddle.x, paddle.y, paddle.width, paddle.height, 9);
  context.fillStyle = paddleGradient;
  context.fill();
  context.shadowBlur = 0;

  const ballGradient = context.createRadialGradient(game.ball.x - 3, game.ball.y - 4, 1, game.ball.x, game.ball.y, game.ball.radius);
  ballGradient.addColorStop(0, "#fffef0");
  ballGradient.addColorStop(1, "#ffcc62");
  context.beginPath();
  context.arc(game.ball.x, game.ball.y, game.ball.radius, 0, Math.PI * 2);
  context.fillStyle = ballGradient;
  context.shadowColor = "rgba(255,227,135,.8)";
  context.shadowBlur = 16;
  context.fill();
  context.shadowBlur = 0;

  if (game.status === "ready") {
    context.fillStyle = "rgba(255,255,255,.75)";
    context.font = "bold 16px system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText("点击按钮或按空格开始", WORLD_WIDTH / 2, WORLD_HEIGHT - 24);
  }
}

function render() {
  updateScoreboard();
  renderOverlay();
  draw();
}

function setPaddle(x) {
  const next = movePaddle(game, x);
  if (next.paddleX === game.paddleX) return;
  game = next;
  dirty = true;
  draw();
}

function handlePanelAction() {
  if (panelAction === "serve") game = serveGame(game);
  else if (panelAction === "resume") game = resumeGame(game);
  else if (panelAction === "next") game = advanceLevel(game);
  else if (panelAction === "restart") game = createGame();
  dirty = true;
  persist();
  render();
  if (game.status === "playing") elements.canvas.focus();
}

function handlePause() {
  game = game.status === "paused" ? resumeGame(game) : pauseGame(game);
  dirty = true;
  persist();
  render();
  if (game.status === "playing") elements.canvas.focus();
}

function handleKeydown(event) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target.closest?.("button, a")) return;
  const left = ["ArrowLeft", "a", "A"].includes(event.key);
  const right = ["ArrowRight", "d", "D"].includes(event.key);
  if (left || right) {
    event.preventDefault();
    setPaddle(game.paddleX + (left ? -70 : 70));
  } else if (event.code === "Space") {
    event.preventDefault();
    if (game.status === "ready") handlePanelAction();
    else if (["playing", "paused"].includes(game.status)) handlePause();
  }
}

function loop(timestamp) {
  if (lastFrameAt && game.status === "playing") {
    const before = game.status;
    game = stepGame(game, timestamp - lastFrameAt);
    dirty = true;
    updateScoreboard();
    if (before !== game.status) {
      dirty = true;
      render();
    }
  }
  lastFrameAt = timestamp;
  if (dirty && timestamp - lastPersistAt >= 500) persist();
  draw();
  frameId = requestAnimationFrame(loop);
}

elements.panelButton.addEventListener("click", handlePanelAction);
elements.pauseButton.addEventListener("click", handlePause);
elements.restartButton.addEventListener("click", () => { game = createGame(); dirty = true; persist(); render(); });
elements.leftButton.addEventListener("click", () => setPaddle(game.paddleX - 85));
elements.rightButton.addEventListener("click", () => setPaddle(game.paddleX + 85));
elements.canvas.addEventListener("pointerdown", (event) => {
  elements.canvas.focus();
  elements.canvas.setPointerCapture?.(event.pointerId);
  setPaddle(canvasPoint(event.clientX));
});
elements.canvas.addEventListener("pointermove", (event) => {
  if (event.pointerType === "mouse" || event.buttons > 0) setPaddle(canvasPoint(event.clientX));
});
elements.canvas.addEventListener("pointerup", persist);
elements.canvas.addEventListener("pointercancel", persist);
document.addEventListener("keydown", handleKeydown);
document.addEventListener("visibilitychange", () => { lastFrameAt = 0; if (document.hidden) persist(); });
window.addEventListener("pagehide", persist);
window.addEventListener("pageshow", () => { lastFrameAt = 0; });
new ResizeObserver(draw).observe(elements.stage);

render();
frameId = requestAnimationFrame(loop);
startPlayLimit({
  onLock(reason) {
    if (reason === "busy") {
      gameStore.suspend();
      return;
    }
    if (game.status === "playing") {
      game = pauseGame(game);
      autoResumeAfterLock = true;
      dirty = true;
    }
    persist();
    render();
  },
  onResume() {
    if (autoResumeAfterLock && game.status === "paused") {
      game = resumeGame(game);
      dirty = true;
      autoResumeAfterLock = false;
      persist();
    }
    render();
  },
});

window.addEventListener("pagehide", () => cancelAnimationFrame(frameId), { once: true });
