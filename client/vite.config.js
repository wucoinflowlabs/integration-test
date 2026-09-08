import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Not part of the Coinflow guide, but required here: @coinflowlabs/react
  // statically imports @solana/web3.js, which expects Node's Buffer and global.
  // Vite externalizes "buffer" for the browser by default, so point it at the
  // npm shim and define global, or the SDK throws while loading.
  resolve: {
    alias: { buffer: "buffer/" },
  },
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    esbuildOptions: {
      define: { global: "globalThis" },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
