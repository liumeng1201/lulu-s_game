import { createSafeJsonStore, getLocalStorageSafely } from "./safe-storage.js";

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

export function transitionPlayLimit(value, { now, tabId: owner, visible, allowAcquire = true }) {
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
    const busy = state.ownerId && state.ownerId !== owner && state.leaseUntil > now;
    const status = state.blockedUntil ? "resting" : busy ? "busy" : allowAcquire ? "active" : "takeover";
    return { state, status, changed };
  }
  if (!allowAcquire && (!state.ownerId || state.leaseUntil <= now)) return { state, status: "takeover", changed };
  if (!state.ownerId || state.ownerId === owner || state.leaseUntil <= now) {
    if (state.ownerId === owner) state.usedMs += Math.max(0, now - state.updatedAt);
    state.ownerId = owner; state.updatedAt = now; state.leaseUntil = now + LEASE_MS; changed = true;
    if (state.usedMs >= PLAY_LIMIT_MS) {
      state.usedMs = PLAY_LIMIT_MS; state.blockedUntil = now + REST_DURATION_MS; state.ownerId = ""; state.leaseUntil = 0;
      return { state, status: "resting", changed };
    }
  } else {
    return { state, status: "busy", changed };
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

export function startPlayLimit({ onLock = () => {}, onResume = () => {}, storage = getLocalStorageSafely() } = {}) {
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
  let staleGameState = false;
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

  function showLocked(state, now, status) {
    if (!locked) {
      locked = true;
      previousFocus = document.activeElement;
      try { onLock(status); } catch (error) { console.error("Failed to save game before blocking this page", error); }
      overlay.hidden = false;
      setBackgroundInert(true);
      card.focus();
    }
    overlay.hidden = false;
    const remaining = state.blockedUntil - now;
    if (status === "busy") {
      title.textContent = "游戏正在另一个标签页运行";
      message.textContent = "请切回正在计时的游戏页面，或关闭它后再继续。";
      countdown.hidden = true;
      hint.textContent = "为避免绕过游玩时限，此页面暂时不可操作。";
      continueButton.hidden = true;
    } else if (status === "takeover") {
      title.textContent = "可以继续游戏啦！";
      message.textContent = "另一个标签页已结束游戏。请刷新此页，载入最新进度后继续。";
      countdown.hidden = true;
      hint.textContent = "刷新后会恢复另一标签页保存的进度。";
      continueButton.hidden = false;
      continueButton.textContent = "刷新并继续";
    } else if (remaining > 0) {
      title.textContent = "眼睛也要放个假";
      message.textContent = "今天已经认真玩了 10 分钟，休息一会儿吧！";
      countdown.hidden = false;
      countdown.textContent = formatRemaining(remaining);
      hint.textContent = "倒计时结束后就可以回来继续游戏。";
      continueButton.hidden = true;
    } else {
      const becameReady = continueButton.hidden;
      title.textContent = "休息完成啦！";
      message.textContent = staleGameState
        ? "休息结束啦。刷新页面以载入最新进度后继续游戏。"
        : "欢迎回来，准备好后可以继续刚才的游戏。";
      countdown.hidden = true;
      hint.textContent = staleGameState ? "刷新后会载入另一标签页保存的进度。" : "点击按钮开始新一轮 10 分钟游戏时间。";
      continueButton.hidden = false;
      continueButton.textContent = staleGameState ? "刷新并继续" : "继续游戏";
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
    const result = transitionPlayLimit(stateStore.read(), { now, tabId, visible: !document.hidden, allowAcquire: !staleGameState });
    if (result.changed) stateStore.write(result.state);
    if (result.status === "busy") staleGameState = true;
    if (["resting", "ready", "busy", "takeover"].includes(result.status)) showLocked(result.state, now, result.status);
    else if (staleGameState) showLocked(result.state, now, "takeover");
    else hideOverlay();
  }

  function resume() {
    const now = Date.now();
    if (staleGameState) {
      const reset = resumePlayLimitState(stateStore.read(), now);
      if (reset) stateStore.write(reset);
      window.location.reload();
      return;
    }
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

  return { tick, isLocked: () => locked, stop() { clearInterval(timer); flushAndRelease(); document.removeEventListener("visibilitychange", tick); window.removeEventListener("storage", handleStorage); window.removeEventListener("pagehide", handlePageHide); window.removeEventListener("keydown", blockGameInput, true); window.removeEventListener("keyup", blockGameInput, true); setBackgroundInert(false); overlay.remove(); } };
}

export { PLAY_LIMIT_MS, REST_DURATION_MS, STORAGE_KEY };
