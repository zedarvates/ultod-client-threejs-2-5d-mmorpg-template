import { defineConfig } from "vite";

export default defineConfig({
  base: "/ultod-client-threejs-2-5d-mmorpg-template/",
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
