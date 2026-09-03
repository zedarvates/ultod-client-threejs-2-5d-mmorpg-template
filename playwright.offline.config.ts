import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  use: {
    headless: true,
    baseURL: "http://localhost:5200/ultod-client-threejs-2-5d-mmorpg-template/",
  },
  webServer: {
    command: "npm run preview -- --port 5200 --strictPort",
    url: "http://localhost:5200/ultod-client-threejs-2-5d-mmorpg-template/",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
