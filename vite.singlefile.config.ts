import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "path";

// Build config that produces a single self-contained index.html
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist-share",
    assetsInlineLimit: 100000000, // inline everything
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: undefined, // no code splitting
      },
    },
  },
});
