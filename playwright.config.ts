import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: {
    headless: true,
    baseURL: "http://localhost:5199",
  },
  webServer: {
    command: "npm run dev -- --base / --port 5199 --strictPort",
    url: "http://localhost:5199",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
