import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Backend (FastAPI) běží na :8000, viz docs/BACKEND.md.
    // Jiný port backendu: CESTY_API_TARGET=http://localhost:8001 npm run dev
    // Veřejná adresa ze start-server.command (cloudflared, Tailscale), záloha localhost.run a ngrok, jméno Macu v síti.
    allowedHosts: [".trycloudflare.com", ".ts.net", ".local", ".lhr.life", ".localhost.run", ".ngrok-free.app", ".ngrok.app"],
    proxy: {
      // changeOrigin: backend kolegy přes tunel (https://…trycloudflare.com) čeká svůj Host.
      "/api": { target: process.env.CESTY_API_TARGET ?? "http://localhost:8000", changeOrigin: true },
    },
  },
});
