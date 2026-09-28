import test from "node:test";
import assert from "node:assert/strict";
import { PLAY_LIMIT_MS, REST_DURATION_MS, defaultPlayLimitState, formatRemaining, normalizePlayLimitState, resolveGameHallUrl, resumePlayLimitState, transitionPlayLimit } from "../assets/js/play-limit.js";

test("play limit uses the agreed durations", () => {
  assert.equal(PLAY_LIMIT_MS, 15 * 60 * 1000);
  assert.equal(REST_DURATION_MS, 30 * 60 * 1000);
});

test("formats countdown without losing partial seconds", () => {
  assert.equal(formatRemaining(30 * 60 * 1000), "00:30:00");
  assert.equal(formatRemaining(60_001), "00:01:01");
  assert.equal(formatRemaining(-1), "00:00:00");
});

test("resolves the rest-dialog home link from game pages without losing deployment subpaths", () => {
  assert.equal(resolveGameHallUrl("http://127.0.0.1:5173/games/chess/index.html"), "http://127.0.0.1:5173/index.html");
  assert.equal(resolveGameHallUrl("https://player.github.io/lulu-s_game/games/go/index.html"), "https://player.github.io/lulu-s_game/index.html");
});

test("invalid persisted state safely resets", () => {
  assert.deepEqual(normalizePlayLimitState(null), defaultPlayLimitState());
  assert.deepEqual(normalizePlayLimitState({ version: 1, usedMs: -4, ownerId: 9 }), defaultPlayLimitState());
});

test("visible ownership accrues once and hidden pages release the lease", () => {
  const acquired = transitionPlayLimit(defaultPlayLimitState(), { now: 1000, tabId: "a", visible: true });
  const ignored = transitionPlayLimit(acquired.state, { now: 2000, tabId: "b", visible: true });
  assert.equal(ignored.state.usedMs, 0);
  assert.equal(ignored.state.ownerId, "a");
  const hidden = transitionPlayLimit(ignored.state, { now: 2500, tabId: "a", visible: false });
  assert.equal(hidden.state.usedMs, 1500);
  assert.equal(hidden.state.ownerId, "");
});

test("a visible non-owner is marked busy until the active page releases its lease", () => {
  const acquired = transitionPlayLimit(defaultPlayLimitState(), { now: 1000, tabId: "a", visible: true });
  const blocked = transitionPlayLimit(acquired.state, { now: 2000, tabId: "b", visible: true });
  assert.equal(blocked.status, "busy");
  assert.equal(blocked.state.ownerId, "a");
  assert.equal(blocked.state.usedMs, 0);

  const released = transitionPlayLimit(blocked.state, { now: 2500, tabId: "a", visible: false });
  const handedOff = transitionPlayLimit(released.state, { now: 2500, tabId: "b", visible: true });
  assert.equal(handedOff.status, "active");
  assert.equal(handedOff.state.ownerId, "b");
  assert.equal(handedOff.state.usedMs, 1500);
});

test("a hidden non-owner cannot claim an unexpired visible tab lease", () => {
  const acquired = transitionPlayLimit(defaultPlayLimitState(), { now: 1000, tabId: "a", visible: true });
  const hidden = transitionPlayLimit(acquired.state, { now: 2000, tabId: "b", visible: false });
  assert.equal(hidden.status, "busy");
  assert.equal(hidden.state.ownerId, "a");
});

test("a tab that was busy must reload before taking over the latest saved game", () => {
  const active = transitionPlayLimit(defaultPlayLimitState(), { now: 1000, tabId: "a", visible: true });
  const busy = transitionPlayLimit(active.state, { now: 2000, tabId: "b", visible: true });
  assert.equal(busy.status, "busy");
  const released = transitionPlayLimit(busy.state, { now: 2500, tabId: "a", visible: false });
  const waiting = transitionPlayLimit(released.state, { now: 2500, tabId: "b", visible: true, allowAcquire: false });
  assert.equal(waiting.status, "takeover");
  assert.equal(waiting.state.ownerId, "");

  const reloaded = transitionPlayLimit(waiting.state, { now: 2600, tabId: "new-b", visible: true });
  assert.equal(reloaded.status, "active");
  assert.equal(reloaded.state.ownerId, "new-b");
});

test("fifteen visible minutes starts a thirty-minute rest period", () => {
  const acquired = transitionPlayLimit(defaultPlayLimitState(), { now: 1000, tabId: "a", visible: true });
  const limited = transitionPlayLimit(acquired.state, { now: 1000 + PLAY_LIMIT_MS, tabId: "a", visible: true });
  assert.equal(limited.status, "resting");
  assert.equal(limited.state.usedMs, PLAY_LIMIT_MS);
  assert.equal(limited.state.blockedUntil, 1000 + PLAY_LIMIT_MS + REST_DURATION_MS);
  assert.equal(resumePlayLimitState(limited.state, limited.state.blockedUntil - 1), null);
  assert.deepEqual(resumePlayLimitState(limited.state, limited.state.blockedUntil), { ...defaultPlayLimitState(), updatedAt: limited.state.blockedUntil });
});
