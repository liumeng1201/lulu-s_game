export const SUITS = Object.freeze(["spades", "hearts", "clubs", "diamonds"]);
export const RANKS = Object.freeze(["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]);
export const TABLEAU_PILES = 7;
export const FOUNDATION_PILES = 4;
export const DRAW_COUNT = 1;

function randomIndex(random, length) {
  const value = random();
  return Math.floor((Number.isFinite(value) ? Math.max(0, Math.min(.999999999, value)) : .5) * length);
}

export function createDeck(random = Math.random) {
  const deck = SUITS.flatMap((suit) => Array.from({ length: 13 }, (_, index) => ({
    id: `${suit}-${index + 1}`, suit, rank: index + 1, faceUp: false,
  })));
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(random, index + 1);
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }
  return deck;
}

function cloneCard(card) { return { ...card }; }
function cloneCards(cards) { return cards.map(cloneCard); }
function clonePiles(piles) { return piles.map(cloneCards); }

function snapshot(game) {
  return {
    stock: cloneCards(game.stock),
    waste: cloneCards(game.waste),
    foundations: clonePiles(game.foundations),
    tableau: clonePiles(game.tableau),
    moves: game.moves,
    status: game.status,
  };
}

function withMove(game, change) {
  return { ...change, elapsedMs: game.elapsedMs, history: [...game.history, snapshot(game)].slice(-100) };
}

export function createGame(random = Math.random) {
  const deck = createDeck(random);
  const tableau = Array.from({ length: TABLEAU_PILES }, (_, pileIndex) => {
    const pile = deck.splice(0, pileIndex + 1);
    pile.forEach((card, index) => { card.faceUp = index === pile.length - 1; });
    return pile;
  });
  const stock = deck.map((card) => ({ ...card, faceUp: false }));
  return {
    drawCount: DRAW_COUNT,
    stock,
    waste: [],
    foundations: Array.from({ length: FOUNDATION_PILES }, () => []),
    tableau,
    moves: 0,
    elapsedMs: 0,
    status: "playing",
    history: [],
  };
}

export function cardColor(card) { return card?.suit === "hearts" || card?.suit === "diamonds" ? "red" : "black"; }

export function isValidTableauSequence(cards) {
  if (!Array.isArray(cards) || !cards.length || cards.some((card) => !card?.faceUp)) return false;
  for (let index = 1; index < cards.length; index += 1) {
    if (cardColor(cards[index - 1]) === cardColor(cards[index]) || cards[index - 1].rank !== cards[index].rank + 1) return false;
  }
  return true;
}

export function canPlaceOnTableau(cards, targetPile) {
  if (!isValidTableauSequence(cards) || !Array.isArray(targetPile)) return false;
  const moving = cards[0];
  const top = targetPile.at(-1);
  return top ? top.faceUp && cardColor(top) !== cardColor(moving) && top.rank === moving.rank + 1 : moving.rank === 13;
}

export function canPlaceOnFoundation(card, targetPile) {
  if (!card?.faceUp || !Array.isArray(targetPile)) return false;
  const top = targetPile.at(-1);
  return top ? top.suit === card.suit && top.rank + 1 === card.rank : card.rank === 1;
}

function sourceCards(game, source) {
  if (!source || !["waste", "tableau", "foundation"].includes(source.pile)) return null;
  if (source.pile === "waste") return game.waste.length ? [game.waste.at(-1)] : null;
  if (source.pile === "foundation") {
    const pile = game.foundations[source.index];
    return Array.isArray(pile) && pile.length ? [pile.at(-1)] : null;
  }
  const pile = game.tableau[source.index];
  if (!Array.isArray(pile) || !Number.isInteger(source.cardIndex) || source.cardIndex < 0 || source.cardIndex >= pile.length) return null;
  const cards = pile.slice(source.cardIndex);
  return isValidTableauSequence(cards) ? cards : null;
}

function sourceIsTopCard(game, source) {
  if (!source || !["waste", "tableau", "foundation"].includes(source.pile)) return false;
  if (source.pile === "waste") return true;
  if (source.pile === "foundation") return true;
  return source.pile === "tableau" && game.tableau[source.index]?.length - 1 === source.cardIndex;
}

function removeSource(game, source) {
  const next = { ...game, stock: cloneCards(game.stock), waste: cloneCards(game.waste), foundations: clonePiles(game.foundations), tableau: clonePiles(game.tableau) };
  if (source.pile === "waste") return { next, cards: [next.waste.pop()] };
  if (source.pile === "foundation") return { next, cards: [next.foundations[source.index].pop()] };
  const cards = next.tableau[source.index].splice(source.cardIndex);
  const top = next.tableau[source.index].at(-1);
  if (top && !top.faceUp) top.faceUp = true;
  return { next, cards };
}

export function drawFromStock(game) {
  if (game.status !== "playing" || (!game.stock.length && !game.waste.length)) return game;
  const next = { ...game, stock: cloneCards(game.stock), waste: cloneCards(game.waste), foundations: clonePiles(game.foundations), tableau: clonePiles(game.tableau), moves: game.moves + 1 };
  if (next.stock.length) {
    const card = next.stock.pop();
    card.faceUp = true;
    next.waste.push(card);
  } else {
    next.stock = next.waste.reverse().map((card) => ({ ...card, faceUp: false }));
    next.waste = [];
  }
  return withMove(game, { ...next, status: "playing" });
}

export function moveToTableau(game, source, targetIndex) {
  if (game.status !== "playing" || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= TABLEAU_PILES
    || source?.pile === "tableau" && source.index === targetIndex) return game;
  const cards = sourceCards(game, source);
  if (!cards || !canPlaceOnTableau(cards, game.tableau[targetIndex])) return game;
  const { next, cards: removed } = removeSource(game, source);
  next.tableau[targetIndex].push(...removed);
  next.moves += 1;
  next.status = "playing";
  return withMove(game, next);
}

export function moveToFoundation(game, source, targetIndex) {
  if (game.status !== "playing" || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= FOUNDATION_PILES
    || !sourceIsTopCard(game, source)) return game;
  const cards = sourceCards(game, source);
  if (!cards || cards.length !== 1 || !canPlaceOnFoundation(cards[0], game.foundations[targetIndex])) return game;
  const { next, cards: removed } = removeSource(game, source);
  next.foundations[targetIndex].push(removed[0]);
  next.moves += 1;
  next.status = next.foundations.every((pile) => pile.length === 13) ? "won" : "playing";
  return withMove(game, next);
}

export function undoMove(game) {
  if (!game.history.length) return game;
  const previous = game.history.at(-1);
  return {
    ...game,
    stock: cloneCards(previous.stock),
    waste: cloneCards(previous.waste),
    foundations: clonePiles(previous.foundations),
    tableau: clonePiles(previous.tableau),
    moves: previous.moves,
    status: previous.status,
    history: game.history.slice(0, -1),
  };
}

export function updateElapsed(game, elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return game;
  return { ...game, elapsedMs: game.elapsedMs + elapsedMs };
}

export function cardLabel(card) {
  if (!card) return "空位";
  const suitNames = { spades: "黑桃", hearts: "红桃", clubs: "梅花", diamonds: "方块" };
  return `${suitNames[card.suit] ?? "未知花色"}${RANKS[card.rank] ?? "?"}`;
}
