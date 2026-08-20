import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev serves the React SPA on :4567 and proxies /api to the local Express
// backend (npm start on :8000). In production the SPA and /api are served
// from the same Vercel project.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4567,
    proxy: {
      "/api": "http://localhost:8000"
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
