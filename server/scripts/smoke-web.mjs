import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const host = process.env.SMOKE_HOST || "127.0.0.1";
const port = Number(process.env.SMOKE_PORT || "8798");
const baseUrl = `http://${host}:${port}`;
const timeoutMs = 25000;

function log(line) {
  process.stdout.write(`${line}\n`);
}

async function fetchText(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  const text = await response.text();
  return { response, text };
}

async function waitForHealth() {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // keep retrying until timeout.
    }
    await delay(350);
  }
  throw new Error(`Server did not become healthy at ${baseUrl}/health within ${timeoutMs}ms`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (buf) => {
    const line = buf.toString().trim();
    if (line) {
      log(`[server] ${line}`);
    }
  });
  child.stderr.on("data", (buf) => {
    const line = buf.toString().trim();
    if (line) {
      log(`[server:err] ${line}`);
    }
  });

  try {
    await waitForHealth();

    const checks = [
      { path: "/", mustContain: "Open Secure Portal" },
      { path: "/", mustContain: "Enterprise Security" },
      { path: "/", mustContain: "Secure Portal" },
      { path: "/assets/site.css", mustContain: ":root" },
      { path: "/assets/app.css", mustContain: ".portal-shell" },
      { path: "/assets/site.js", mustContain: "loadAccountSummary" },
      { path: "/app", mustContain: "Super Admin Board" },
      { path: "/terms", mustContain: "Terms and Conditions" },
      { path: "/privacy", mustContain: "Privacy Notice" },
      { path: "/checkout/success", mustContain: "Payment Received" },
      { path: "/checkout/cancel", mustContain: "Checkout Canceled" },
      { path: "/oauth/github/complete", mustContain: "Finishing Sign-In" },
      { path: "/oauth/google/complete", mustContain: "Finishing Sign-In" }
    ];

    for (const check of checks) {
      const { response, text } = await fetchText(check.path);
      assert(response.status === 200, `${check.path} returned ${response.status}`);
      assert(text.includes(check.mustContain), `${check.path} missing text: ${check.mustContain}`);
      log(`ok ${check.path}`);
    }

    log(`web smoke test passed at ${baseUrl}`);
  } finally {
    child.kill("SIGTERM");
    await delay(150);
    if (!child.killed) {
      child.kill("SIGKILL");
    }
  }
}

run().catch((error) => {
  console.error(`web smoke test failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
