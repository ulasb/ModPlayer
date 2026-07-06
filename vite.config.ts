import { defineConfig } from "vite";

export default defineConfig({
  base: "/ModPlayer/",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 4096,
  },
});
