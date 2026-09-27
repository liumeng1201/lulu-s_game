import { DRAW_COUNT, FOUNDATION_PILES, SUITS, TABLEAU_PILES, createGame, isValidTableauSequence } from "./engine.mjs";

const STATUSES = new Set(["playing", "won"]);

function validateCard(value) {
  if (!value || !SUITS.includes(value.suit) || !Number.isInteger(value.rank) || value.rank < 1 || value.rank > 13
    || value.id !== `${value.suit}-${value.rank}` || typeof value.faceUp !== "boolean") return null;
  return { id: value.id, suit: value.suit, rank: value.rank, faceUp: value.faceUp };
}

function validateCards(values) {
  if (!Array.isArray(values)) return null;
  const cards = values.map(validateCard);
  return cards.every(Boolean) ? cards : null;
}

function validatePiles(values, count) {
  if (!Array.isArray(values) || values.length !== count) return null;
  const piles = values.map(validateCards);
  return piles.every(Boolean) ? piles : null;
}

function validatePosition(value) {
  if (!value || !Number.isInteger(value.moves) || value.moves < 0 || !STATUSES.has(value.status)) return null;
  const stock = validateCards(value.stock);
  const waste = validateCards(value.waste);
  const foundations = validatePiles(value.foundations, FOUNDATION_PILES);
  const tableau = validatePiles(value.tableau, TABLEAU_PILES);
  if (!stock || !waste || !foundations || !tableau) return null;
  if (stock.some((card) => card.faceUp) || waste.some((card) => !card.faceUp)) return null;

  for (const pile of foundations) {
    if (pile.some((card, index) => !card.faceUp || card.rank !== index + 1 || index > 0 && card.suit !== pile[0].suit)) return null;
  }
  for (const pile of tableau) {
    let faceUpSeen = false;
    for (const card of pile) {
      if (card.faceUp) faceUpSeen = true;
      else if (faceUpSeen) return null;
    }
    const faceUpCards = pile.filter((card) => card.faceUp);
    if (pile.length && !faceUpCards.length) return null;
    if (faceUpCards.length && !isValidTableauSequence(faceUpCards)) return null;
  }

  const allCards = [...stock, ...waste, ...foundations.flat(), ...tableau.flat()];
  if (allCards.length !== 52 || new Set(allCards.map((card) => card.id)).size !== 52) return null;
  const won = foundations.every((pile) => pile.length === 13);
  if ((value.status === "won") !== won) return null;

  const position = {
    stock, waste, foundations, tableau, moves: value.moves, status: value.status,
  };
  return position;
}

function validateHistory(values, moves) {
  if (!Array.isArray(values) || values.length > 100 || values.length > moves) return null;
  const entries = [];
  let previousMoves = -1;
  for (const value of values) {
    const entry = validatePosition(value);
    if (!entry || entry.status !== "playing" || entry.moves <= previousMoves || entry.moves >= moves) return null;
    previousMoves = entry.moves;
    entries.push(entry);
  }
  return entries;
}

export function validateSolitaireSave(value) {
  if (!value || value.version !== 1 || !value.game) return null;
  const game = value.game;
  if (game.drawCount !== DRAW_COUNT || !Number.isFinite(game.elapsedMs) || game.elapsedMs < 0) return null;
  const position = validatePosition(game);
  const history = validateHistory(game.history, game.moves);
  if (!position || !history) return null;
  return { version: 1, game: { ...position, drawCount: DRAW_COUNT, elapsedMs: game.elapsedMs, history } };
}

export function createDefaultSolitaireSave(random = Math.random) {
  return { version: 1, game: createGame(random) };
}
