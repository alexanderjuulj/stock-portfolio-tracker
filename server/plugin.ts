import type { Plugin } from "vite";
import { handleApiRequest } from "./api";

/**
 * Mounts the SQLite-backed API on `/api/*` inside Vite's own server — dev and
 * preview alike — so `pnpm dev` is the only thing to start: one process, one
 * port, no CORS.
 */
export function rahamasinApi(): Plugin {
  return {
    name: "rahamasin-api",
    configureServer(server) {
      server.middlewares.use("/api", (req, res) => void handleApiRequest(req, res));
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api", (req, res) => void handleApiRequest(req, res));
    },
  };
}
