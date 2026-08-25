import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
  build: {
    emptyOutDir: false,
    outDir: "assets",
    lib: {
      entry: path.resolve(rootDir, "src/reviews-marquee.tsx"),
      name: "ReviewsMarquee",
      fileName: () => "reviews-marquee.js",
      formats: ["iife"],
    },
    rollupOptions: {
      output: {
        assetFileNames: (info) =>
          info.name && info.name.endsWith(".css")
            ? "reviews-marquee.css"
            : "[name][extname]",
      },
    },
  },
});
