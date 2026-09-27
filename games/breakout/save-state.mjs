import { BALL_RADIUS, MAX_LEVEL, MAX_LIVES, WORLD_HEIGHT, WORLD_WIDTH, createBricks } from "./engine.mjs";

const STATUSES = new Set(["ready", "playing", "paused", "level-complete", "won", "lost"]);

function isFiniteNumber(value) { return Number.isFinite(value); }

export function validateBreakoutSave(value) {
  if (!value || value.version !== 1 || !value.game) return null;
  const game = value.game;
  if (!Number.isInteger(game.level) || game.level < 1 || game.level > MAX_LEVEL
    || !Number.isInteger(game.lives) || game.lives < 0 || game.lives > MAX_LIVES
    || !Number.isInteger(game.score) || game.score < 0
    || !isFiniteNumber(game.elapsedMs) || game.elapsedMs < 0
    || !isFiniteNumber(game.paddleX) || game.paddleX < 66 || game.paddleX > WORLD_WIDTH - 66
    || !STATUSES.has(game.status) || !game.ball || !isFiniteNumber(game.ball.x) || game.ball.x < -BALL_RADIUS || game.ball.x > WORLD_WIDTH + BALL_RADIUS
    || !isFiniteNumber(game.ball.y) || game.ball.y < -BALL_RADIUS || game.ball.y > WORLD_HEIGHT + 60
    || !isFiniteNumber(game.ball.vx) || Math.abs(game.ball.vx) > 1200
    || !isFiniteNumber(game.ball.vy) || Math.abs(game.ball.vy) > 1200
    || game.ball.radius !== BALL_RADIUS || !Array.isArray(game.bricks)) return null;

  const expected = createBricks(game.level);
  if (game.bricks.length !== expected.length) return null;
  for (let index = 0; index < expected.length; index += 1) {
    const brick = game.bricks[index];
    const template = expected[index];
    if (!brick || brick.id !== template.id || brick.x !== template.x || brick.y !== template.y
      || brick.width !== template.width || brick.height !== template.height
      || !Number.isInteger(brick.hits) || brick.hits < 0 || brick.hits > template.hits
      || typeof brick.active !== "boolean" || (brick.active && brick.hits === 0)) return null;
  }

  const allCleared = game.bricks.every((brick) => !brick.active);
  const pausedStatusValid = game.status !== "paused" || ["ready", "playing"].includes(game.resumeStatus);
  const nonPausedStatusValid = game.status === "paused" || game.resumeStatus == null;
  if (!pausedStatusValid || !nonPausedStatusValid) return null;
  if (["ready", "playing", "paused"].includes(game.status) && game.lives === 0) return null;
  if (game.status === "ready" && (game.ball.vx !== 0 || game.ball.vy !== 0)) return null;
  if (game.status === "playing" && Math.hypot(game.ball.vx, game.ball.vy) === 0) return null;
  if (game.status === "paused" && game.resumeStatus === "ready" && (game.ball.vx !== 0 || game.ball.vy !== 0)) return null;
  if (game.status === "paused" && game.resumeStatus === "playing" && Math.hypot(game.ball.vx, game.ball.vy) === 0) return null;
  if (game.status === "level-complete" && (game.level >= MAX_LEVEL || !allCleared)) return null;
  if (game.status === "won" && (game.level !== MAX_LEVEL || !allCleared)) return null;
  if (game.status === "lost" && game.lives !== 0) return null;

  return {
    version: 1,
    game: {
      level: game.level,
      lives: game.lives,
      score: game.score,
      status: game.status,
      resumeStatus: game.status === "paused" ? game.resumeStatus : null,
      elapsedMs: game.elapsedMs,
      paddleX: game.paddleX,
      ball: { x: game.ball.x, y: game.ball.y, vx: game.ball.vx, vy: game.ball.vy, radius: BALL_RADIUS },
      bricks: game.bricks.map((brick) => ({ ...brick })),
    },
  };
}

export function createDefaultBreakoutSave() {
  return { version: 1, game: {
    level: 1,
    lives: MAX_LIVES,
    score: 0,
    status: "ready",
    resumeStatus: null,
    elapsedMs: 0,
    paddleX: WORLD_WIDTH / 2,
    ball: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT - 76, vx: 0, vy: 0, radius: BALL_RADIUS },
    bricks: createBricks(1),
  } };
}
