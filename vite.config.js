import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: [
        resolve(import.meta.dirname, "index.html"),
        resolve(import.meta.dirname, "games/catch-stars/index.html"),
        resolve(import.meta.dirname, "games/gomoku/index.html"),
        resolve(import.meta.dirname, "games/go/index.html"),
        resolve(import.meta.dirname, "games/tic-tac-toe/index.html"),
        resolve(import.meta.dirname, "games/explore-world/index.html"),
      ],
    },
  },
});
