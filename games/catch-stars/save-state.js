const finiteInRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;

export function validateCatchStarsSave(value) {
  if (!value || value.version !== 1) return null;
  if (!Number.isInteger(value.score) || !finiteInRange(value.score, 0, 10)) return null;
  if (!Number.isInteger(value.lives) || !finiteInRange(value.lives, 0, 3)) return null;
  const running = Boolean(value.running); const resultOpen = Boolean(value.resultOpen);
  if ((running && (value.score >= 10 || value.lives === 0 || resultOpen)) || (resultOpen && running)) return null;
  if (![value.basketX, value.starX, value.starY].every((item) => finiteInRange(item, -200, 5000))) return null;
  return {
    version: 1, running, paused: Boolean(value.paused), score: value.score, lives: value.lives,
    basketX: value.basketX, starX: value.starX, starY: value.starY, soundOn: value.soundOn !== false,
    resultOpen: Boolean(value.resultOpen),
    resultTitle: typeof value.resultTitle === "string" ? value.resultTitle.slice(0, 100) : "",
    resultMessage: typeof value.resultMessage === "string" ? value.resultMessage.slice(0, 300) : "",
    resultEmoji: typeof value.resultEmoji === "string" ? value.resultEmoji.slice(0, 10) : "",
  };
}
