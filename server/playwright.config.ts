import { defineConfig } from "@playwright/test";

const port = Number(process.env.PORT ?? "8787");
const host = process.env.HOST ?? "127.0.0.1";
const baseURL = process.env.PG_SMOKE_BASE_URL ?? `http://${host}:${port}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  retries: 0,
  reporter: "line",
  use: {
    baseURL
  },
  webServer: {
    command: "npm run dev",
    cwd: __dirname,
    url: `${baseURL}/health`,
    timeout: 120000,
    reuseExistingServer: true
  }
});
