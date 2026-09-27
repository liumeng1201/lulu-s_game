import test from "node:test";
import assert from "node:assert/strict";
import {
  SUITS, canPlaceOnFoundation, canPlaceOnTableau, cardColor, createDeck, createGame,
  drawFromStock, isValidTableauSequence, moveToFoundation, moveToTableau, undoMove, updateElapsed,
} from "../games/solitaire/engine.mjs";

const card = (suit, rank, faceUp = true) => ({ id: `${suit}-${rank}`, suit, rank, faceUp });
function emptyGame() {
  const game = createGame(() => 0);
  return { ...game, stock: [], waste: [], foundations: Array.from({ length: 4 }, () => []), tableau: Array.from({ length: 7 }, () => []), moves: 0, elapsedMs: 0, status: "playing", history: [] };
}

test("creates a unique standard 52-card deck and deals seven ascending tableau piles", () => {
  const deck = createDeck(() => 0.4);
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map((item) => item.id)).size, 52);
  assert.deepEqual(new Set(deck.map((item) => item.suit)), new Set(SUITS));

  const game = createGame(() => 0.2);
  assert.deepEqual(game.tableau.map((pile) => pile.length), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(game.stock.length, 24);
  assert.equal(game.waste.length, 0);
  assert.ok(game.tableau.every((pile) => pile.slice(0, -1).every((item) => !item.faceUp) && pile.at(-1).faceUp));
  assert.ok(game.stock.every((item) => !item.faceUp));
});

test("requires alternating colors and descending ranks in tableau sequences", () => {
  assert.equal(cardColor(card("hearts", 1)), "red");
  assert.equal(cardColor(card("spades", 1)), "black");
  assert.equal(isValidTableauSequence([card("spades", 13), card("hearts", 12), card("clubs", 11)]), true);
  assert.equal(isValidTableauSequence([card("spades", 13), card("clubs", 12)]), false);
  assert.equal(isValidTableauSequence([card("spades", 13), card("hearts", 11)]), false);
  assert.equal(isValidTableauSequence([card("spades", 13, false)]), false);
  assert.equal(canPlaceOnTableau([card("hearts", 12)], [card("clubs", 13)]), true);
  assert.equal(canPlaceOnTableau([card("hearts", 12)], []), false);
  assert.equal(canPlaceOnTableau([card("spades", 13)], []), true);
});

test("draws one card at a time and recycles the waste in the original draw order", () => {
  const game = emptyGame();
  game.stock = [card("spades", 1, false), card("hearts", 2, false)];
  const first = drawFromStock(game);
  assert.equal(first.waste.at(-1).id, "hearts-2");
  assert.equal(first.waste.at(-1).faceUp, true);
  assert.equal(first.moves, 1);
  const second = drawFromStock(first);
  assert.equal(second.waste.at(-1).id, "spades-1");
  const recycled = drawFromStock(second);
  assert.equal(recycled.waste.length, 0);
  assert.equal(recycled.stock.length, 2);
  assert.ok(recycled.stock.every((item) => !item.faceUp));
  const redrawn = drawFromStock(recycled);
  assert.equal(redrawn.waste.at(-1).id, "hearts-2");
  const noCards = emptyGame();
  assert.equal(drawFromStock(noCards), noCards);
});

test("moves only legal waste cards onto tableau piles", () => {
  const game = emptyGame();
  game.waste = [card("hearts", 13)];
  const moved = moveToTableau(game, { pile: "waste" }, 0);
  assert.equal(moved.tableau[0].at(-1).id, "hearts-13");
  assert.equal(moved.waste.length, 0);
  assert.equal(moved.moves, 1);

  const queen = { ...game, waste: [card("hearts", 12)] };
  assert.equal(moveToTableau(queen, { pile: "waste" }, 0), queen);
  assert.equal(moveToTableau(game, { pile: "waste" }, 7), game);
});

test("moves a valid face-up tableau suffix and turns over the newly exposed card", () => {
  const game = emptyGame();
  game.tableau[0] = [card("spades", 7, false), card("hearts", 8), card("clubs", 7)];
  game.tableau[1] = [card("clubs", 9)];
  const moved = moveToTableau(game, { pile: "tableau", index: 0, cardIndex: 1 }, 1);
  assert.deepEqual(moved.tableau[0], [card("spades", 7)]);
  assert.equal(moved.tableau[0][0].faceUp, true);
  assert.deepEqual(moved.tableau[1].slice(-2).map((item) => item.rank), [8, 7]);
  assert.equal(moved.moves, 1);
  assert.equal(moveToTableau(game, { pile: "tableau", index: 0, cardIndex: 0 }, 2), game);
});

test("builds foundations by suit from ace upward and only moves tableau top cards there", () => {
  assert.equal(canPlaceOnFoundation(card("hearts", 1), []), true);
  assert.equal(canPlaceOnFoundation(card("hearts", 2), [card("hearts", 1)]), true);
  assert.equal(canPlaceOnFoundation(card("spades", 2), [card("hearts", 1)]), false);
  assert.equal(canPlaceOnFoundation(card("hearts", 3), [card("hearts", 1)]), false);

  const game = emptyGame();
  game.waste = [card("hearts", 1)];
  const ace = moveToFoundation(game, { pile: "waste" }, 0);
  assert.equal(ace.foundations[0].at(-1).id, "hearts-1");
  const two = { ...ace, waste: [card("hearts", 2)] };
  assert.equal(moveToFoundation(two, { pile: "waste" }, 0).foundations[0].at(-1).rank, 2);

  const buried = { ...emptyGame(), tableau: [[card("hearts", 1), card("clubs", 2)], [], [], [], [], [], []] };
  assert.equal(moveToFoundation(buried, { pile: "tableau", index: 0, cardIndex: 0 }, 0), buried);
});

test("allows a foundation top card to return to a legal tableau column", () => {
  const game = emptyGame();
  game.foundations[1] = [card("hearts", 6)];
  game.tableau[0] = [card("clubs", 7)];
  const moved = moveToTableau(game, { pile: "foundation", index: 1 }, 0);
  assert.equal(moved.foundations[1].length, 0);
  assert.deepEqual(moved.tableau[0].map((item) => item.rank), [7, 6]);
});

test("undo restores stock, waste, tableau, and move count while preserving elapsed time", () => {
  const game = emptyGame();
  game.stock = [card("spades", 1, false)];
  const drawn = drawFromStock(game);
  const timed = updateElapsed(drawn, 4500);
  const undone = undoMove(timed);
  assert.equal(undone.stock.length, 1);
  assert.equal(undone.waste.length, 0);
  assert.equal(undone.moves, 0);
  assert.equal(undone.elapsedMs, 4500);
  assert.equal(undoMove(game), game);
});

test("wins only after the final king is moved to its matching foundation", () => {
  const game = emptyGame();
  game.foundations = SUITS.map((suit, suitIndex) => Array.from({ length: suitIndex === 0 ? 12 : 13 }, (_, index) => card(suit, index + 1)));
  game.waste = [card("spades", 13)];
  const won = moveToFoundation(game, { pile: "waste" }, 0);
  assert.equal(won.status, "won");
  assert.equal(won.foundations[0].length, 13);
  assert.equal(moveToTableau(won, { pile: "waste" }, 0), won);
  assert.equal(undoMove(won).status, "playing");
});
