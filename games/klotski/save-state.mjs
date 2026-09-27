import { MAX_LEVEL, ROWS, COLUMNS, createClassicPieces, createGame, isSolved } from "./engine.mjs";

const STATUS = new Set(["playing", "won"]);
const PIECE_TEMPLATES = new Map(createClassicPieces().map((piece) => [piece.id, piece]));

function validatePieces(pieces) {
  if (!Array.isArray(pieces) || pieces.length !== PIECE_TEMPLATES.size) return null;
  const seen = new Set();
  const occupied = new Set();
  const cloned = [];
  for (const value of pieces) {
    if (!value || typeof value.id !== "string" || seen.has(value.id)) return null;
    const template = PIECE_TEMPLATES.get(value.id);
    if (!template || value.kind !== template.kind || value.width !== template.width || value.height !== template.height
      || value.label !== template.label || !Number.isInteger(value.row) || !Number.isInteger(value.column)
      || value.row < 0 || value.column < 0 || value.row + value.height > ROWS || value.column + value.width > COLUMNS) return null;
    seen.add(value.id);
    for (let row = value.row; row < value.row + value.height; row += 1) {
      for (let column = value.column; column < value.column + value.width; column += 1) {
        const cell = `${row}:${column}`;
        if (occupied.has(cell)) return null;
        occupied.add(cell);
      }
    }
    cloned.push({ ...template, row: value.row, column: value.column });
  }
  if (seen.size !== PIECE_TEMPLATES.size) return null;
  return cloned;
}

export function validateKlotskiSave(value) {
  if (!value || value.version !== 1 || !value.game) return null;
  const game = value.game;
  if (!Number.isInteger(game.level) || game.level < 1 || game.level > MAX_LEVEL
    || !Number.isInteger(game.moves) || game.moves < 0 || !STATUS.has(game.status)
    || !Array.isArray(game.history) || game.history.length > 200 || game.history.length > game.moves) return null;
  const pieces = validatePieces(game.pieces);
  if (!pieces || (game.status === "won") !== isSolved(pieces)) return null;
  const history = [];
  for (const entry of game.history) {
    if (!entry || !Number.isInteger(entry.moves) || entry.moves < 0 || entry.moves >= game.moves) return null;
    const previousPieces = validatePieces(entry.pieces);
    if (!previousPieces || isSolved(previousPieces)) return null;
    history.push({ pieces: previousPieces, moves: entry.moves });
  }
  if (history.some((entry, index) => index > 0 && entry.moves <= history[index - 1].moves)) return null;
  return { version: 1, game: { level: game.level, pieces, moves: game.moves, history, status: game.status } };
}

export function createDefaultKlotskiSave() { return { version: 1, game: createGame(1) }; }
