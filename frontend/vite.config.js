import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, proxy /api and /health to the backend so there are no CORS issues.
// In production (nginx image) the same paths are proxied to the api Service.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/health": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
