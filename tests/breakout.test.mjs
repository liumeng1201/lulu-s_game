import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_LEVEL, MAX_LIVES, WORLD_HEIGHT, WORLD_WIDTH, advanceLevel, createBricks, createGame,
  movePaddle, pauseGame, resumeGame, serveGame, stepGame,
} from "../games/breakout/engine.mjs";

function playingGame(overrides = {}) {
  return { ...createGame(), status: "playing", ball: { ...createGame().ball, vx: 0, vy: -120 }, ...overrides };
}

test("creates a three-life ready game and progressively different brick fields", () => {
  const game = createGame();
  assert.equal(game.status, "ready");
  assert.equal(game.lives, MAX_LIVES);
  assert.equal(game.bricks.filter((brick) => brick.active).length, 50);
  assert.equal(createBricks(2).filter((brick) => brick.active).length, 48);
  assert.ok(createBricks(3).some((brick) => brick.hits === 2));
});

test("paddle stays inside the court and carries a waiting ball", () => {
  const moved = movePaddle(createGame(), -100);
  assert.equal(moved.paddleX, 66);
  assert.equal(moved.ball.x, 66);
  assert.equal(movePaddle(moved, Infinity), moved);
  assert.equal(movePaddle(moved, WORLD_WIDTH + 100).paddleX, WORLD_WIDTH - 66);
});

test("serves with an upward velocity and pauses/resumes the exact game phase", () => {
  const ready = createGame();
  const served = serveGame(ready);
  assert.equal(served.status, "playing");
  assert.ok(served.ball.vy < 0);
  assert.equal(serveGame(served), served);
  const paused = pauseGame(served);
  assert.equal(paused.status, "paused");
  assert.equal(paused.resumeStatus, "playing");
  assert.deepEqual(resumeGame(paused), { ...served, resumeStatus: null });
});

test("bounces cleanly from the side and top boundaries", () => {
  const side = stepGame(playingGame({ ball: { x: 12, y: 300, vx: -120, vy: 0, radius: 10 } }), 50);
  assert.ok(side.ball.x >= 10);
  assert.ok(side.ball.vx > 0);

  const top = stepGame(playingGame({ ball: { x: 500, y: 12, vx: 0, vy: -120, radius: 10 } }), 50);
  assert.ok(top.ball.y >= 10);
  assert.ok(top.ball.vy > 0);
});

test("breaks a brick once, awards points only when its durability reaches zero", () => {
  const bricks = createBricks(3).map((brick) => ({ ...brick, active: false }));
  bricks[0] = { ...bricks[0], active: true, hits: 2 };
  const game = playingGame({ level: 3, bricks, ball: { x: bricks[0].x + 40, y: bricks[0].y + 34, vx: 0, vy: -120, radius: 10 } });

  const firstHit = stepGame(game, 50);
  assert.equal(firstHit.bricks[0].hits, 1);
  assert.equal(firstHit.bricks[0].active, true);
  assert.equal(firstHit.score, 0);

  const secondHit = stepGame({ ...firstHit, ball: { ...firstHit.ball, y: bricks[0].y + 34, vx: 0, vy: -120 } }, 50);
  assert.equal(secondHit.bricks[0].hits, 0);
  assert.equal(secondHit.bricks[0].active, false);
  assert.equal(secondHit.score, 10);
  assert.equal(secondHit.status, "won");
});

test("paddle contact sends the ball back up with a direction based on the hit point", () => {
  const centered = stepGame(playingGame({ ball: { x: 500, y: 536, vx: 0, vy: 220, radius: 10 } }), 50);
  assert.ok(centered.ball.vy < 0);

  const edge = stepGame(playingGame({ ball: { x: 552, y: 536, vx: 0, vy: 220, radius: 10 } }), 50);
  assert.ok(edge.ball.vx > 0);
  assert.ok(edge.ball.vy < 0);
});

test("losing a ball consumes one life and losing the final life ends the game", () => {
  const escaped = { x: 500, y: WORLD_HEIGHT - 1, vx: 0, vy: 700, radius: 10 };
  const retry = stepGame(playingGame({ ball: escaped }), 100);
  assert.equal(retry.lives, MAX_LIVES - 1);
  assert.equal(retry.status, "ready");
  assert.equal(retry.ball.vy, 0);

  const lost = stepGame(playingGame({ lives: 1, ball: escaped }), 100);
  assert.equal(lost.lives, 0);
  assert.equal(lost.status, "lost");
});

test("clears each stage in order and only wins after the final stage", () => {
  let game = createGame();
  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    const bricks = game.bricks.map((brick) => ({ ...brick, active: false, hits: 0 }));
    bricks[0] = { ...bricks[0], active: true, hits: 1 };
    game = {
      ...game,
      level,
      status: "playing",
      bricks,
      ball: { x: bricks[0].x + 40, y: bricks[0].y + 34, vx: 0, vy: -120, radius: 10 },
    };
    game = stepGame(game, 50);
    assert.equal(game.status, level === MAX_LEVEL ? "won" : "level-complete");
    if (level < MAX_LEVEL) {
      game = advanceLevel(game);
      assert.equal(game.level, level + 1);
      assert.equal(game.status, "ready");
    }
  }
});

test("caps a delayed animation frame so a resumed tab cannot skip across the field", () => {
  const start = playingGame({ ball: { x: 500, y: 300, vx: 0, vy: -200, radius: 10 } });
  const after = stepGame(start, 10_000);
  assert.equal(after.elapsedMs, 100);
  assert.ok(after.ball.y > 250);
});
