import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { rahamasinApi } from "./server/plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), rahamasinApi()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
