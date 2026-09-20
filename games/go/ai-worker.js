import { chooseAiMove } from "./engine.mjs";

self.addEventListener("message", (event) => {
  const { requestId, board, difficulty, player, previousBoardKey, opponentPassed } = event.data;
  const move = chooseAiMove(board, difficulty, player, previousBoardKey, Math.random, {
    opponentPassed,
    timeBudgetMs: 120,
  });
  self.postMessage({ requestId, move });
});
