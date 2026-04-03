import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PG_SMOKE_PORT ?? "8791");
const host = process.env.HOST ?? "127.0.0.1";
const baseURL = process.env.PG_SMOKE_BASE_URL ?? `http://${host}:${port}`;
const browserMatrix = (process.env.PG_SMOKE_BROWSER_MATRIX ?? "minimal").toLowerCase();
const reportDir = process.env.PG_SMOKE_REPORT_DIR ?? path.join(__dirname, "playwright-report");
const resultsDir = process.env.PG_SMOKE_RESULTS_DIR ?? path.join(__dirname, "test-results");
const jsonReportPath = process.env.PG_SMOKE_JSON_REPORT_PATH ?? path.join(resultsDir, "report.json");
const traceMode = process.env.PG_PLAYWRIGHT_TRACE_MODE ?? "retain-on-failure";
const screenshotMode = process.env.PG_PLAYWRIGHT_SCREENSHOT_MODE ?? "only-on-failure";
const videoMode = process.env.PG_PLAYWRIGHT_VIDEO_MODE ?? "retain-on-failure";

function resolveProjects() {
  const desktopProjects = [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] }
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] }
    }
  ];

  if (browserMatrix === "full") {
    return [
      ...desktopProjects,
      {
        name: "mobile-chrome",
        use: { ...devices["Pixel 5"] }
      },
      {
        name: "mobile-safari",
        use: { ...devices["iPhone 12"] }
      }
    ];
  }

  if (browserMatrix === "desktop") {
    return desktopProjects;
  }

  return [desktopProjects[0]];
}

export default defineConfig({
  testDir: "./tests",
  timeout: 120000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: resultsDir,
  reporter: [
    ["line"],
    ["html", { open: "never", outputFolder: reportDir }],
    ["json", { outputFile: jsonReportPath }]
  ],
  use: {
    baseURL,
    trace: traceMode,
    screenshot: screenshotMode,
    video: videoMode
  },
  projects: resolveProjects(),
  webServer: {
    command: "npm run dev",
    cwd: __dirname,
    url: `${baseURL}/health`,
    timeout: 120000,
    reuseExistingServer: true,
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port),
      STORE_BACKEND: process.env.STORE_BACKEND ?? "json",
      ENABLE_EMAIL_OTP: "true",
      EXPOSE_DEV_OTP_CODE: "true"
    }
  }
});

