import { chooseAiMove } from "./engine.mjs";

self.addEventListener("message", ({ data }) => {
  const move = chooseAiMove(data.board, data.position, data.difficulty, data.color);
  self.postMessage({ requestId: data.requestId, move });
});
