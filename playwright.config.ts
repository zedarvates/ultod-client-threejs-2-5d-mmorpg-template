import { defineConfig } from "@playwright/test";

const e2ePort = process.env.E2E_PORT ?? "5199";
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: {
    headless: true,
    baseURL: e2eBaseUrl,
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${e2ePort} --strictPort`,
    url: e2eBaseUrl,
    reuseExistingServer: !process.env.CI && process.env.E2E_PORT === undefined,
    timeout: 30000,
  },
});
