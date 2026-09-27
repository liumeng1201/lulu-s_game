export const WORLD_WIDTH = 1000;
export const WORLD_HEIGHT = 600;
export const BALL_RADIUS = 10;
export const PADDLE_WIDTH = 132;
export const PADDLE_HEIGHT = 18;
export const MAX_LEVEL = 3;
export const MAX_LIVES = 3;

const BRICK_WIDTH = 80;
const BRICK_HEIGHT = 26;
const BRICK_GAP_X = 10;
const BRICK_GAP_Y = 12;
const BRICK_LEFT = (WORLD_WIDTH - (10 * BRICK_WIDTH + 9 * BRICK_GAP_X)) / 2;
const BRICK_TOP = 76;
const BASE_SPEED = 335;

export function createBricks(level = 1) {
  const rows = 4 + level;
  return Array.from({ length: rows * 10 }, (_, index) => {
    const row = Math.floor(index / 10);
    const column = index % 10;
    const hollow = level === 2 && row > 0 && row < rows - 1 && column > 1 && column < 8 && (row + column) % 2 === 0;
    const skip = level === 3 && row > 1 && row < rows - 1 && column > 2 && column < 7 && (row + column) % 3 === 0;
    return {
      id: `${row}-${column}`,
      x: BRICK_LEFT + column * (BRICK_WIDTH + BRICK_GAP_X),
      y: BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP_Y),
      width: BRICK_WIDTH,
      height: BRICK_HEIGHT,
      hits: level === 3 && row < 2 ? 2 : 1,
      active: !hollow && !skip,
    };
  });
}

export function createGame() {
  return {
    level: 1,
    lives: MAX_LIVES,
    score: 0,
    status: "ready",
    resumeStatus: null,
    elapsedMs: 0,
    paddleX: WORLD_WIDTH / 2,
    ball: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT - 76, vx: 0, vy: 0, radius: BALL_RADIUS },
    bricks: createBricks(1),
  };
}

export function movePaddle(game, x) {
  if (!Number.isFinite(x)) return game;
  const paddleX = Math.max(PADDLE_WIDTH / 2, Math.min(WORLD_WIDTH - PADDLE_WIDTH / 2, x));
  return {
    ...game,
    paddleX,
    ball: game.status === "ready"
      ? { ...game.ball, x: paddleX }
      : game.ball,
  };
}

export function serveGame(game) {
  if (game.status !== "ready") return game;
  const speed = BASE_SPEED + (game.level - 1) * 38;
  const direction = game.paddleX < WORLD_WIDTH * 0.35 ? 0.55 : game.paddleX > WORLD_WIDTH * 0.65 ? -0.55 : 0.2;
  const vx = direction * speed;
  const vy = -Math.sqrt(speed * speed - vx * vx);
  return {
    ...game,
    status: "playing",
    ball: { ...game.ball, x: game.paddleX, y: WORLD_HEIGHT - 76, vx, vy },
  };
}

export function pauseGame(game) {
  if (game.status === "paused" || ["won", "lost", "level-complete"].includes(game.status)) return game;
  return { ...game, status: "paused", resumeStatus: game.status };
}

export function resumeGame(game) {
  if (game.status !== "paused") return game;
  return { ...game, status: game.resumeStatus === "playing" ? "playing" : "ready", resumeStatus: null };
}

export function advanceLevel(game) {
  if (game.status !== "level-complete" || game.level >= MAX_LEVEL) return game;
  const level = game.level + 1;
  return {
    ...game,
    level,
    status: "ready",
    resumeStatus: null,
    paddleX: WORLD_WIDTH / 2,
    ball: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT - 76, vx: 0, vy: 0, radius: BALL_RADIUS },
    bricks: createBricks(level),
  };
}

function collideCircleRect(ball, rect) {
  const closestX = Math.max(rect.x, Math.min(ball.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(ball.y, rect.y + rect.height));
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  if (dx * dx + dy * dy >= ball.radius * ball.radius) return null;

  if (dx === 0 && dy === 0) {
    const overlaps = [
      { axis: "x", amount: Math.min(ball.x - rect.x, rect.x + rect.width - ball.x), sign: ball.x < rect.x + rect.width / 2 ? -1 : 1 },
      { axis: "y", amount: Math.min(ball.y - rect.y, rect.y + rect.height - ball.y), sign: ball.y < rect.y + rect.height / 2 ? -1 : 1 },
    ];
    overlaps.sort((left, right) => left.amount - right.amount);
    return { axis: overlaps[0].axis, sign: overlaps[0].sign };
  }

  const horizontalOverlap = ball.radius - Math.abs(dx);
  const verticalOverlap = ball.radius - Math.abs(dy);
  if (dx && dy && horizontalOverlap > 0 && verticalOverlap > 0) {
    return horizontalOverlap < verticalOverlap
      ? { axis: "x", sign: Math.sign(dx) }
      : { axis: "y", sign: Math.sign(dy) };
  }
  if (Math.abs(dx) > Math.abs(dy)) return { axis: "x", sign: Math.sign(dx) };
  return { axis: "y", sign: Math.sign(dy) };
}

function reflect(ball, collision) {
  if (collision.axis === "x") ball.vx = Math.abs(ball.vx) * collision.sign;
  else ball.vy = Math.abs(ball.vy) * collision.sign;
}

function loseBall(game) {
  const lives = game.lives - 1;
  if (lives <= 0) return { ...game, lives: 0, status: "lost", ball: { ...game.ball, vx: 0, vy: 0 } };
  return {
    ...game,
    lives,
    status: "ready",
    resumeStatus: null,
    ball: { x: game.paddleX, y: WORLD_HEIGHT - 76, vx: 0, vy: 0, radius: BALL_RADIUS },
  };
}

export function stepGame(game, elapsedMs) {
  if (game.status !== "playing" || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return game;
  const duration = Math.min(elapsedMs, 100);
  const speed = Math.hypot(game.ball.vx, game.ball.vy);
  const steps = Math.max(1, Math.ceil(speed * duration / 1000 / (BALL_RADIUS * 0.45)));
  const dt = duration / steps / 1000;
  let next = { ...game, ball: { ...game.ball }, bricks: game.bricks.map((brick) => ({ ...brick })), elapsedMs: game.elapsedMs + duration };

  for (let index = 0; index < steps && next.status === "playing"; index += 1) {
    const ball = next.ball;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.radius <= 0) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx); }
    if (ball.x + ball.radius >= WORLD_WIDTH) { ball.x = WORLD_WIDTH - ball.radius; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - ball.radius <= 0) { ball.y = ball.radius; ball.vy = Math.abs(ball.vy); }
    if (ball.y - ball.radius > WORLD_HEIGHT) { next = loseBall(next); continue; }

    const paddle = { x: next.paddleX - PADDLE_WIDTH / 2, y: WORLD_HEIGHT - 52, width: PADDLE_WIDTH, height: PADDLE_HEIGHT };
    const paddleCollision = collideCircleRect(ball, paddle);
    if (paddleCollision && ball.vy > 0) {
      ball.y = paddle.y - ball.radius;
      const offset = Math.max(-1, Math.min(1, (ball.x - next.paddleX) / (PADDLE_WIDTH / 2)));
      const reboundSpeed = Math.max(BASE_SPEED, speed);
      ball.vx = offset * reboundSpeed * 0.82;
      ball.vy = -Math.sqrt(reboundSpeed * reboundSpeed - ball.vx * ball.vx);
    }

    let hitBrick = false;
    for (const brick of next.bricks) {
      if (!brick.active) continue;
      const collision = collideCircleRect(ball, brick);
      if (!collision) continue;
      brick.hits -= 1;
      if (brick.hits <= 0) { brick.active = false; next.score += 10; }
      if (collision.axis === "x") ball.x = collision.sign < 0 ? brick.x - ball.radius - 0.01 : brick.x + brick.width + ball.radius + 0.01;
      else ball.y = collision.sign < 0 ? brick.y - ball.radius - 0.01 : brick.y + brick.height + ball.radius + 0.01;
      reflect(ball, collision);
      hitBrick = true;
      break;
    }
    if (hitBrick && next.bricks.every((brick) => !brick.active)) {
      next.status = next.level === MAX_LEVEL ? "won" : "level-complete";
    }
  }
  return next;
}
