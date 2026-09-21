import { chooseAiMove } from "./engine.mjs";

self.addEventListener("message", ({ data }) => {
  const { requestId, board, difficulty, player } = data;
  const move = chooseAiMove(board, difficulty, player);
  self.postMessage({ requestId, move });
});
