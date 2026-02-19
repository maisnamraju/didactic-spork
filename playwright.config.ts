import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/playwright",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5173",
    headless: false,
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      port: 3001,
      reuseExistingServer: true,
    },
    {
      command: "cd frontend && npm run dev",
      port: 5173,
      reuseExistingServer: true,
    },
  ],
});
