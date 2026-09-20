import test from "node:test";
import assert from "node:assert/strict";
import { PLAY_LIMIT_MS, REST_DURATION_MS, defaultPlayLimitState, formatRemaining, normalizePlayLimitState } from "../assets/js/play-limit.js";

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
