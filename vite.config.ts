import { defineConfig } from "vite";

const DEFAULT_BASE = "/ultod-client-threejs-2-5d-mmorpg-template/";

function normalizeBasePath(raw: string | undefined): string {
  if (!raw) return DEFAULT_BASE;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.includes(":") || trimmed.includes("\\")) {
    throw new Error("VITE_BASE_PATH must be an absolute same-origin path");
  }
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

export default defineConfig({
  // GitHub Pages remains the default, while portal deployments such as
  // obolune.com/games/<game>/ can inject a same-origin VITE_BASE_PATH.
  base: normalizeBasePath(process.env.VITE_BASE_PATH),
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.endsWith("/node_modules/three/build/three.module.js")) {
            return "three-core";
          }
        },
      },
    },
  },
});
