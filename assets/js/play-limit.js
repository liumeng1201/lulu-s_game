const STORAGE_KEY = "lulu-play-limit-v1";
const PLAY_LIMIT_MS = 10 * 60 * 1000;
const REST_DURATION_MS = 60 * 60 * 1000;
const LEASE_MS = 3000;
const TICK_MS = 1000;

const tabId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

export function defaultPlayLimitState() {
  return { version: 1, usedMs: 0, blockedUntil: 0, updatedAt: 0, ownerId: "", leaseUntil: 0 };
}

export function normalizePlayLimitState(value) {
  const fallback = defaultPlayLimitState();
  if (!value || value.version !== 1) return fallback;
  return {
    version: 1,
    usedMs: Number.isFinite(value.usedMs) ? Math.max(0, value.usedMs) : 0,
    blockedUntil: Number.isFinite(value.blockedUntil) ? Math.max(0, value.blockedUntil) : 0,
    updatedAt: Number.isFinite(value.updatedAt) ? Math.max(0, value.updatedAt) : 0,
    ownerId: typeof value.ownerId === "string" ? value.ownerId : "",
    leaseUntil: Number.isFinite(value.leaseUntil) ? Math.max(0, value.leaseUntil) : 0,
  };
}

export function formatRemaining(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export function transitionPlayLimit(value, { now, tabId: owner, visible }) {
  const state = normalizePlayLimitState(value);
  let changed = false;
  if (state.blockedUntil || state.usedMs >= PLAY_LIMIT_MS) {
    if (!state.blockedUntil) { state.blockedUntil = now + REST_DURATION_MS; changed = true; }
    if (state.ownerId === owner) { state.ownerId = ""; state.leaseUntil = 0; changed = true; }
    return { state, status: state.blockedUntil > now ? "resting" : "ready", changed };
  }
  if (!visible) {
    if (state.ownerId === owner) {
      state.usedMs += Math.max(0, now - state.updatedAt);
      state.updatedAt = now; state.ownerId = ""; state.leaseUntil = 0; changed = true;
      if (state.usedMs >= PLAY_LIMIT_MS) { state.usedMs = PLAY_LIMIT_MS; state.blockedUntil = now + REST_DURATION_MS; }
    }
    return { state, status: state.blockedUntil ? "resting" : "active", changed };
  }
  if (!state.ownerId || state.ownerId === owner || state.leaseUntil <= now) {
    if (state.ownerId === owner) state.usedMs += Math.max(0, now - state.updatedAt);
    state.ownerId = owner; state.updatedAt = now; state.leaseUntil = now + LEASE_MS; changed = true;
    if (state.usedMs >= PLAY_LIMIT_MS) {
      state.usedMs = PLAY_LIMIT_MS; state.blockedUntil = now + REST_DURATION_MS; state.ownerId = ""; state.leaseUntil = 0;
      return { state, status: "resting", changed };
    }
  }
  return { state, status: "active", changed };
}

export function resumePlayLimitState(value, now) {
  const state = normalizePlayLimitState(value);
  return state.blockedUntil > 0 && state.blockedUntil <= now ? { ...defaultPlayLimitState(), updatedAt: now } : null;
}

function ensureStyles() {
  if (document.querySelector("link[data-play-limit-styles]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../css/play-limit.css", import.meta.url).href;
  link.dataset.playLimitStyles = "";
  document.head.append(link);
}

function createOverlay() {
  const overlay = document.createElement("section");
  overlay.className = "play-limit-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "playLimitTitle");
  overlay.innerHTML = `
    <div class="play-limit-card" tabindex="-1">
      <div class="play-limit-mascot" aria-hidden="true">🌙</div>
      <p class="play-limit-eyebrow">休息时间</p>
      <h2 id="playLimitTitle">眼睛也要放个假</h2>
      <p class="play-limit-message">今天已经认真玩了 10 分钟，休息一会儿吧！</p>
      <strong class="play-limit-countdown" role="timer">01:00:00</strong>
      <p class="play-limit-hint">倒计时结束后就可以回来继续游戏。</p>
      <button class="play-limit-continue" type="button" hidden>继续游戏</button>
      <a class="play-limit-home" href="${new URL("../../index.html", import.meta.url).href}">返回游戏大厅</a>
    </div>`;
  document.body.append(overlay);
  return overlay;
}

export function startPlayLimit({ onLock = () => {}, onResume = () => {}, storage = localStorage } = {}) {
  const stateStore = createSafeJsonStore(STORAGE_KEY, storage);
  ensureStyles();
  const overlay = createOverlay();
  const title = overlay.querySelector("h2");
  const message = overlay.querySelector(".play-limit-message");
  const countdown = overlay.querySelector(".play-limit-countdown");
  const hint = overlay.querySelector(".play-limit-hint");
  const continueButton = overlay.querySelector(".play-limit-continue");
  const card = overlay.querySelector(".play-limit-card");
  let locked = false;
  let timer;
  let previousFocus;
  let backgroundStates = [];

  function setBackgroundInert(active) {
    if (active) {
      backgroundStates = [...document.body.children].filter((item) => item !== overlay).map((item) => [item, item.inert]);
      backgroundStates.forEach(([item]) => { item.inert = true; });
    } else {
      backgroundStates.forEach(([item, inert]) => { item.inert = inert; });
      backgroundStates = [];
    }
  }

  function blockGameInput(event) {
    if (!locked) return;
    if (!event.target?.closest?.(".play-limit-overlay")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (event.key === "Tab") {
      const focusable = [...overlay.querySelectorAll("button:not([hidden]), a[href]")];
      const first = focusable[0]; const last = focusable.at(-1);
      if (!first) { event.preventDefault(); card.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }

  function showLocked(state, now) {
    if (!locked) {
      locked = true;
      previousFocus = document.activeElement;
      try { onLock(); } catch (error) { console.error("Failed to save game before rest period", error); }
      overlay.hidden = false;
      setBackgroundInert(true);
      card.focus();
    }
    overlay.hidden = false;
    const remaining = state.blockedUntil - now;
    if (remaining > 0) {
      title.textContent = "眼睛也要放个假";
      message.textContent = "今天已经认真玩了 10 分钟，休息一会儿吧！";
      countdown.hidden = false;
      countdown.textContent = formatRemaining(remaining);
      hint.textContent = "倒计时结束后就可以回来继续游戏。";
      continueButton.hidden = true;
    } else {
      const becameReady = continueButton.hidden;
      title.textContent = "休息完成啦！";
      message.textContent = "欢迎回来，准备好后可以继续刚才的游戏。";
      countdown.hidden = true;
      hint.textContent = "点击按钮开始新一轮 10 分钟游戏时间。";
      continueButton.hidden = false;
      if (becameReady) continueButton.focus();
    }
  }

  function hideOverlay() {
    const wasLocked = locked;
    overlay.hidden = true;
    locked = false;
    if (wasLocked) {
      setBackgroundInert(false);
      try { onResume(); } catch (error) { console.error("Failed to resume game after rest period", error); }
      if (previousFocus?.isConnected) previousFocus.focus();
      previousFocus = undefined;
    }
  }

  function flushAndRelease(now = Date.now()) {
    const result = transitionPlayLimit(stateStore.read(), { now, tabId, visible: false });
    if (result.changed) stateStore.write(result.state);
  }

  function tick() {
    const now = Date.now();
    const result = transitionPlayLimit(stateStore.read(), { now, tabId, visible: !document.hidden });
    if (result.changed) stateStore.write(result.state);
    if (result.status === "resting" || result.status === "ready") showLocked(result.state, now);
    else hideOverlay();
  }

  function resume() {
    const now = Date.now();
    const state = resumePlayLimitState(stateStore.read(), now);
    if (!state) return;
    stateStore.write(state);
    hideOverlay();
    tick();
  }

  continueButton.addEventListener("click", resume);
  window.addEventListener("keydown", blockGameInput, true);
  window.addEventListener("keyup", blockGameInput, true);
  const handleStorage = (event) => { if (event.key === STORAGE_KEY) tick(); };
  const handlePageHide = () => flushAndRelease();
  document.addEventListener("visibilitychange", tick);
  window.addEventListener("storage", handleStorage);
  window.addEventListener("pagehide", handlePageHide);
  timer = window.setInterval(tick, TICK_MS);
  tick();

  return { tick, stop() { clearInterval(timer); flushAndRelease(); document.removeEventListener("visibilitychange", tick); window.removeEventListener("storage", handleStorage); window.removeEventListener("pagehide", handlePageHide); window.removeEventListener("keydown", blockGameInput, true); window.removeEventListener("keyup", blockGameInput, true); setBackgroundInert(false); overlay.remove(); } };
}

export { PLAY_LIMIT_MS, REST_DURATION_MS, STORAGE_KEY };
import { createSafeJsonStore } from "./safe-storage.js";
