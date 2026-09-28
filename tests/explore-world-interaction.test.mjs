import test from "node:test";
import assert from "node:assert/strict";
import { isWithinInteractionDistance } from "../games/explore-world/src/interaction-rules.js";

test("NPC interactions are allowed only within the inclusive interaction radius", () => {
  const player = { x: 100, y: 100 };
  assert.equal(isWithinInteractionDistance(player, { x: 220, y: 100 }, 120), true);
  assert.equal(isWithinInteractionDistance(player, { x: 220.01, y: 100 }, 120), false);
  assert.equal(isWithinInteractionDistance(player, { x: 190, y: 190 }, 120), false, "diagonal range uses Euclidean distance");
});

test("invalid positions and radii never enable interaction", () => {
  assert.equal(isWithinInteractionDistance(null, { x: 0, y: 0 }, 120), false);
  assert.equal(isWithinInteractionDistance({ x: NaN, y: 0 }, { x: 0, y: 0 }, 120), false);
  assert.equal(isWithinInteractionDistance({ x: 0, y: 0 }, { x: 0, y: 0 }, -1), false);
});
