import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(ROOT_DIR, "client", "src"),
      "@shared": path.resolve(ROOT_DIR, "shared"),
      "@assets": path.resolve(ROOT_DIR, "attached_assets"),
    },
  },
  root: path.resolve(ROOT_DIR, "client"),
  base: "./",
  build: {
    outDir: path.resolve(ROOT_DIR, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
