import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

/**
 * Serves /hub/ as a standalone app instead of falling through to the SPA.
 * Files under public/hub/ are served directly; /hub/ resolves to hub/index.html.
 */
function hubStandalonePlugin(): Plugin {
  return {
    name: "hub-standalone",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith("/hub")) {
          const urlPath = req.url === "/hub" ? "/hub/" : req.url;
          const filePath = urlPath === "/hub/"
            ? path.resolve(__dirname, "public/hub/index.html")
            : path.resolve(__dirname, "public" + urlPath);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath);
            const types: Record<string, string> = {
              ".html": "text/html",
              ".js": "application/javascript",
              ".css": "text/css",
              ".json": "application/json",
              ".svg": "image/svg+xml",
            };
            res.setHeader("Content-Type", types[ext] || "application/octet-stream");
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [hubStandalonePlugin(), react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
