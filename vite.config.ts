import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Backend (FastAPI) běží na :8000, viz docs/BACKEND.md.
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
