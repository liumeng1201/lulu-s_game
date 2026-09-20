import test from "node:test";
import assert from "node:assert/strict";
import { PLAY_LIMIT_MS, REST_DURATION_MS, defaultPlayLimitState, formatRemaining, normalizePlayLimitState, resumePlayLimitState, transitionPlayLimit } from "../assets/js/play-limit.js";

test("play limit uses the agreed durations", () => {
  assert.equal(PLAY_LIMIT_MS, 10 * 60 * 1000);
  assert.equal(REST_DURATION_MS, 60 * 60 * 1000);
});

test("formats countdown without losing partial seconds", () => {
  assert.equal(formatRemaining(60 * 60 * 1000), "01:00:00");
  assert.equal(formatRemaining(60_001), "00:01:01");
  assert.equal(formatRemaining(-1), "00:00:00");
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

test("ten visible minutes starts a one hour rest period", () => {
  const acquired = transitionPlayLimit(defaultPlayLimitState(), { now: 1000, tabId: "a", visible: true });
  const limited = transitionPlayLimit(acquired.state, { now: 1000 + PLAY_LIMIT_MS, tabId: "a", visible: true });
  assert.equal(limited.status, "resting");
  assert.equal(limited.state.usedMs, PLAY_LIMIT_MS);
  assert.equal(limited.state.blockedUntil, 1000 + PLAY_LIMIT_MS + REST_DURATION_MS);
  assert.equal(resumePlayLimitState(limited.state, limited.state.blockedUntil - 1), null);
  assert.deepEqual(resumePlayLimitState(limited.state, limited.state.blockedUntil), { ...defaultPlayLimitState(), updatedAt: limited.state.blockedUntil });
});
