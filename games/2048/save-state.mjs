import { EMPTY, SIZE, hasMoves, hasWon, highestTile } from "./engine.mjs";

const POWER_TILES = new Set(Array.from({ length: 11 }, (_, index) => 2 ** (index + 1)));
const OUTCOMES = new Set(["won", "lost"]);

export function normalizeNickname(value) {
  return [...String(value ?? "").normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, "").trim()].slice(0, 12).join("");
}

function isValidBoard(board) {
  return Array.isArray(board) && board.length === SIZE
    && board.every((row) => Array.isArray(row) && row.length === SIZE && row.every((value) => value === EMPTY || POWER_TILES.has(value)));
}

export function validate2048Game(value) {
  if (!value || !isValidBoard(value.board) || !Number.isInteger(value.score) || value.score < 0
    || !["playing", "won", "lost"].includes(value.status)) return null;
  const won = hasWon(value.board);
  if ((value.status === "playing" && (won || !hasMoves(value.board)))
    || (value.status === "won" && !won)
    || (value.status === "lost" && (won || hasMoves(value.board)))) return null;
  return { board: value.board.map((row) => [...row]), score: value.score, status: value.status };
}

function validLeaderboardEntry(value) {
  return value && typeof value.runId === "string" && value.runId.length >= 1 && value.runId.length <= 100
    && typeof value.nickname === "string" && value.nickname === normalizeNickname(value.nickname) && value.nickname.length > 0
    && Number.isInteger(value.score) && value.score >= 0 && POWER_TILES.has(value.highestTile)
    && OUTCOMES.has(value.outcome) && Number.isFinite(value.completedAt) && value.completedAt >= 0;
}

function compareEntries(left, right) {
  return right.score - left.score || right.highestTile - left.highestTile || left.completedAt - right.completedAt;
}

export function sortLeaderboard(entries) {
  return [...entries].sort(compareEntries).slice(0, 10);
}

export function validate2048Save(value) {
  if (!value || value.version !== 1 || typeof value.nickname !== "string"
    || value.nickname !== normalizeNickname(value.nickname) || !Array.isArray(value.leaderboard)
    || value.leaderboard.length > 10 || !value.leaderboard.every(validLeaderboardEntry)
    || !Number.isInteger(value.bestScore) || value.bestScore < 0) return null;
  const ids = new Set(value.leaderboard.map((entry) => entry.runId));
  if (ids.size !== value.leaderboard.length || value.leaderboard.some((entry, index, all) => index > 0 && compareEntries(all[index - 1], entry) > 0)) return null;
  const currentRun = value.currentRun == null ? null : value.currentRun;
  if (currentRun) {
    const game = validate2048Game(currentRun.game);
    if (!game || typeof currentRun.runId !== "string" || currentRun.runId.length < 1 || currentRun.runId.length > 100
      || typeof currentRun.nickname !== "string" || currentRun.nickname !== normalizeNickname(currentRun.nickname) || !currentRun.nickname
      || typeof currentRun.recorded !== "boolean" || (game.status === "playing" && currentRun.recorded)
      || (game.status !== "playing" && !currentRun.recorded)) return null;
    const record = value.leaderboard.find((entry) => entry.runId === currentRun.runId);
    if (record && (record.nickname !== currentRun.nickname || record.score !== game.score
      || record.outcome !== game.status || record.highestTile !== highestTile(game.board))) return null;
  }
  if (value.bestScore < Math.max(0, ...value.leaderboard.map((entry) => entry.score))) return null;
  return {
    version: 1, nickname: value.nickname, currentRun: currentRun && {
      runId: currentRun.runId, nickname: currentRun.nickname, game: validate2048Game(currentRun.game), recorded: currentRun.recorded,
    },
    leaderboard: value.leaderboard.map((entry) => ({ ...entry })), bestScore: value.bestScore,
  };
}

export function createDefaultSave() {
  return { version: 1, nickname: "", currentRun: null, leaderboard: [], bestScore: 0 };
}
