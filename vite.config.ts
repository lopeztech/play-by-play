import { defineConfig } from "vite";

// /nrl-api/* is proxied to nrl.com so match /data endpoints can be fetched
// on demand in dev without CORS. For static hosting you'd need to either
// pre-fetch matches with scripts/fetch-match.mjs or stand up your own proxy.
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/nrl-api": {
        target: "https://www.nrl.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/nrl-api/, ""),
      },
    },
  },
});
