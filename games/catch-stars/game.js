import { startPlayLimit } from "../../assets/js/play-limit.js";
import { createVersionedGameStore, showSaveConflict } from "../../assets/js/safe-storage.js";
import { validateCatchStarsSave } from "./save-state.js";

const WIN_SCORE = 10;
const MAX_LIVES = 3;
const SAVE_KEY = "lulu-catch-stars-save-v1";
const ENCOURAGEMENT_DURATION = 2000;
const ENCOURAGEMENTS = [
  "太棒了，已经完成一半啦！",
  "继续加油，胜利就在前面！",
  "你的反应越来越快啦！",
  "好厉害，又接住一颗！",
  "只差一点点就成功啦！",
];

const elements = {
  gameArea: document.querySelector("#gameArea"),
  basket: document.querySelector("#basket"),
  star: document.querySelector("#fallingStar"),
  score: document.querySelector("#score"),
  lives: document.querySelector("#lives"),
  progressBar: document.querySelector("#progressBar"),
  progressTrack: document.querySelector(".progress-track"),
  startPanel: document.querySelector("#startPanel"),
  resultPanel: document.querySelector("#resultPanel"),
  resultTitle: document.querySelector("#resultTitle"),
  resultMessage: document.querySelector("#resultMessage"),
  resultEmoji: document.querySelector("#resultEmoji"),
  startButton: document.querySelector("#startButton"),
  restartButton: document.querySelector("#restartButton"),
  leftButton: document.querySelector("#leftButton"),
  rightButton: document.querySelector("#rightButton"),
  pauseButton: document.querySelector("#pauseButton"),
  pauseBadge: document.querySelector("#pauseBadge"),
  soundButton: document.querySelector("#soundButton"),
  encouragement: document.querySelector("#encouragement"),
};

const state = {
  running: false,
  paused: false,
  score: 0,
  lives: MAX_LIVES,
  basketX: 0,
  starX: 0,
  starY: -60,
  lastTime: 0,
  moveLeft: false,
  moveRight: false,
  soundOn: true,
  animationId: null,
};

let audioContext;
let encouragementTimer;
let pausedBeforePlayLimit = null;
const gameStore = createVersionedGameStore({ key: SAVE_KEY, validate: validateCatchStarsSave, storage: localStorage, onConflict: showSaveConflict });

function saveGame() {
  const value = {
    version: 1, running: state.running, paused: pausedBeforePlayLimit ?? state.paused, score: state.score, lives: state.lives,
    basketX: state.basketX, starX: state.starX, starY: state.starY, soundOn: state.soundOn,
    resultOpen: !elements.resultPanel.classList.contains("hidden"), resultTitle: elements.resultTitle.textContent,
    resultMessage: elements.resultMessage.textContent, resultEmoji: elements.resultEmoji.textContent,
  };
  gameStore.save(value);
}

function loadGame() {
  const value = gameStore.load();
  if (!value) return null;
  state.running = value.running; state.paused = value.paused; state.score = value.score; state.lives = value.lives;
  state.basketX = value.basketX; state.starX = value.starX; state.starY = value.starY; state.soundOn = value.soundOn;
  return value;
}

function playTone(frequency, duration, type = "sine") {
  if (!state.soundOn) return;
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.12, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function gameBounds() {
  return { width: elements.gameArea.clientWidth, height: elements.gameArea.clientHeight };
}

function resetStar() {
  const { width } = gameBounds();
  state.starX = 30 + Math.random() * Math.max(1, width - 60);
  state.starY = -55;
}

function render() {
  elements.basket.style.left = `${state.basketX}px`;
  elements.star.style.transform = `translate(${state.starX - 22}px, ${state.starY}px) rotate(${state.starY * 0.25}deg)`;
  elements.score.textContent = state.score;
  elements.lives.textContent = `${"♥ ".repeat(state.lives)}${"♡ ".repeat(MAX_LIVES - state.lives)}`.trim();
  elements.lives.setAttribute("aria-label", `${state.lives} 颗爱心`);
  const progress = Math.min(100, (state.score / WIN_SCORE) * 100);
  elements.progressBar.style.width = `${progress}%`;
  elements.progressTrack.setAttribute("aria-valuenow", state.score);
}

function showCatchPop() {
  const pop = document.createElement("span");
  pop.className = "catch-pop";
  pop.textContent = "+1 ✨";
  pop.style.left = `${state.starX - 18}px`;
  pop.style.top = `${state.starY}px`;
  elements.gameArea.append(pop);
  pop.addEventListener("animationend", () => pop.remove());
}

function hideEncouragement() {
  clearTimeout(encouragementTimer);
  encouragementTimer = undefined;
  elements.encouragement.classList.add("hidden");
  elements.encouragement.textContent = "";
}

function showEncouragement() {
  clearTimeout(encouragementTimer);
  const halfwayScore = Math.ceil(WIN_SCORE / 2);
  const messageIndex = (state.score - halfwayScore) % ENCOURAGEMENTS.length;
  elements.encouragement.textContent = ENCOURAGEMENTS[messageIndex];
  elements.encouragement.classList.remove("hidden");
  encouragementTimer = setTimeout(hideEncouragement, ENCOURAGEMENT_DURATION);
}

function finishGame(won) {
  state.running = false;
  hideEncouragement();
  cancelAnimationFrame(state.animationId);
  elements.star.classList.remove("playing");
  elements.pauseButton.classList.add("hidden");
  elements.pauseBadge.classList.add("hidden");
  elements.resultEmoji.textContent = won ? "🎉" : "🌙";
  elements.resultTitle.textContent = won ? "你赢啦！" : "再试一次吧！";
  elements.resultMessage.textContent = won
    ? `太棒了，你接住了 ${WIN_SCORE} 颗闪亮的星星！`
    : `你接住了 ${state.score} 颗星星，下次一定会更棒！`;
  elements.resultPanel.classList.remove("hidden");
  playTone(won ? 660 : 220, 0.5, won ? "triangle" : "sine");
  elements.restartButton.focus();
  saveGame();
}

function update(delta) {
  const { width, height } = gameBounds();
  const basketHalf = elements.basket.offsetWidth / 2;
  const direction = Number(state.moveRight) - Number(state.moveLeft);
  state.basketX = Math.max(basketHalf, Math.min(width - basketHalf, state.basketX + direction * 330 * delta));
  state.starY += (155 + state.score * 18) * delta;

  const basketTop = height - 93;
  const caughtHorizontally = Math.abs(state.starX - state.basketX) < 53;
  const caughtVertically = state.starY + 42 >= basketTop && state.starY < basketTop + 45;

  if (caughtHorizontally && caughtVertically) {
    state.score += 1;
    showCatchPop();
    playTone(520 + state.score * 25, 0.18, "triangle");
    resetStar();
    if (state.score >= WIN_SCORE) {
      finishGame(true);
    } else if (state.score >= Math.ceil(WIN_SCORE / 2)) {
      showEncouragement();
    }
  } else if (state.starY > height) {
    state.lives -= 1;
    elements.gameArea.classList.add("shake");
    setTimeout(() => elements.gameArea.classList.remove("shake"), 350);
    playTone(170, 0.25, "sawtooth");
    resetStar();
    if (state.lives <= 0) finishGame(false);
  }
}

function gameLoop(time) {
  if (!state.running) return;
  const delta = Math.min((time - state.lastTime) / 1000, 0.04);
  state.lastTime = time;
  if (!state.paused) update(delta);
  render();
  state.animationId = requestAnimationFrame(gameLoop);
}

function startGame() {
  const { width } = gameBounds();
  hideEncouragement();
  state.running = true;
  state.paused = false;
  state.score = 0;
  state.lives = MAX_LIVES;
  state.basketX = width / 2;
  state.moveLeft = false;
  state.moveRight = false;
  resetStar();
  elements.startPanel.classList.add("hidden");
  elements.resultPanel.classList.add("hidden");
  elements.pauseButton.classList.remove("hidden");
  elements.pauseButton.textContent = "Ⅱ";
  elements.pauseButton.setAttribute("aria-label", "暂停游戏");
  elements.star.classList.add("playing");
  state.lastTime = performance.now();
  cancelAnimationFrame(state.animationId);
  state.animationId = requestAnimationFrame(gameLoop);
  elements.gameArea.focus();
  saveGame();
}

function togglePause() {
  if (!state.running) return;
  state.paused = !state.paused;
  elements.pauseButton.textContent = state.paused ? "▶" : "Ⅱ";
  elements.pauseButton.setAttribute("aria-label", state.paused ? "继续游戏" : "暂停游戏");
  elements.pauseBadge.classList.toggle("hidden", !state.paused);
  state.lastTime = performance.now();
  saveGame();
}

function restoreUi(value) {
  elements.soundButton.textContent = state.soundOn ? "🔊" : "🔇";
  elements.soundButton.setAttribute("aria-label", state.soundOn ? "关闭声音" : "打开声音");
  if (state.running) {
    elements.startPanel.classList.add("hidden"); elements.resultPanel.classList.add("hidden");
    elements.pauseButton.classList.remove("hidden"); elements.star.classList.add("playing");
    elements.pauseButton.textContent = state.paused ? "▶" : "Ⅱ";
    elements.pauseButton.setAttribute("aria-label", state.paused ? "继续游戏" : "暂停游戏");
    elements.pauseBadge.classList.toggle("hidden", !state.paused);
    state.lastTime = performance.now();
    state.animationId = requestAnimationFrame(gameLoop);
  } else if (value?.resultOpen) {
    elements.startPanel.classList.add("hidden"); elements.resultPanel.classList.remove("hidden");
    elements.resultTitle.textContent = value.resultTitle; elements.resultMessage.textContent = value.resultMessage;
    elements.resultEmoji.textContent = value.resultEmoji;
  }
  render();
}

function lockGame() {
  saveGame();
  pausedBeforePlayLimit = state.paused;
  if (state.running) state.paused = true;
  setMovement("left", false); setMovement("right", false);
}

function resumeGameAfterLimit() {
  if (state.running && pausedBeforePlayLimit !== null) {
    state.paused = pausedBeforePlayLimit; state.lastTime = performance.now();
    elements.pauseButton.textContent = state.paused ? "▶" : "Ⅱ";
    elements.pauseButton.setAttribute("aria-label", state.paused ? "继续游戏" : "暂停游戏");
    elements.pauseBadge.classList.toggle("hidden", !state.paused);
  }
  pausedBeforePlayLimit = null;
  saveGame();
}

function setMovement(direction, active) {
  if (direction === "left") state.moveLeft = active;
  if (direction === "right") state.moveRight = active;
  elements[`${direction}Button`].classList.toggle("active", active);
}

function bindHoldButton(button, direction) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setMovement(direction, true);
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
    button.addEventListener(eventName, () => setMovement(direction, false));
  });
}

document.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
  if (event.key === "ArrowLeft") setMovement("left", true);
  if (event.key === "ArrowRight") setMovement("right", true);
  if (event.key === " " && state.running && !event.repeat) togglePause();
});

document.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft") setMovement("left", false);
  if (event.key === "ArrowRight") setMovement("right", false);
});

window.addEventListener("blur", () => {
  setMovement("left", false);
  setMovement("right", false);
  if (state.running && !state.paused) togglePause();
});

elements.startButton.addEventListener("click", startGame);
elements.restartButton.addEventListener("click", startGame);
elements.pauseButton.addEventListener("click", togglePause);
elements.soundButton.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  elements.soundButton.textContent = state.soundOn ? "🔊" : "🔇";
  elements.soundButton.setAttribute("aria-label", state.soundOn ? "关闭声音" : "打开声音");
  saveGame();
});

bindHoldButton(elements.leftButton, "left");
bindHoldButton(elements.rightButton, "right");
const savedGame = loadGame();
if (!savedGame) {
  state.basketX = gameBounds().width / 2;
  resetStar();
}
restoreUi(savedGame);
window.addEventListener("pagehide", saveGame);
window.setInterval(saveGame, 1000);
startPlayLimit({ onLock: lockGame, onResume: resumeGameAfterLimit });
