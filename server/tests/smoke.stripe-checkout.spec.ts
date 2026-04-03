import { expect, test } from "@playwright/test";

const CHECKOUT_TARGETS = [
  { plan_id: "pro", module_scope: "narrate" },
  { plan_id: "pro", module_scope: "memorybank" },
  { plan_id: "pro", module_scope: "bundle" },
  { plan_id: "team", module_scope: "narrate" },
  { plan_id: "team", module_scope: "memorybank" },
  { plan_id: "team", module_scope: "bundle" },
  { plan_id: "enterprise", module_scope: "narrate" },
  { plan_id: "enterprise", module_scope: "memorybank" },
  { plan_id: "enterprise", module_scope: "bundle" }
] as const;

test("@smoke stripe checkout creates sessions for all paid yearly sku keys", async ({ request }) => {
  const email = `smoke-stripe-${Date.now()}@example.com`;

  const startResponse = await request.post("/auth/email/start", {
    data: { email }
  });
  expect(startResponse.ok()).toBeTruthy();

  const startPayload = (await startResponse.json()) as {
    dev_code?: string;
    error?: string;
  };
  expect(startPayload.dev_code, "Expected local smoke auth to expose dev_code.").toMatch(/^\d{6}$/);

  const verifyResponse = await request.post("/auth/email/verify", {
    data: {
      email,
      code: startPayload.dev_code,
      install_id: `smoke-${Date.now()}`
    }
  });
  expect(verifyResponse.ok()).toBeTruthy();

  const failures: string[] = [];

  for (const target of CHECKOUT_TARGETS) {
    const response = await request.post("/payments/stripe/create-checkout-session", {
      data: {
        plan_id: target.plan_id,
        module_scope: target.module_scope,
        years: 1
      }
    });

    const payload = (await response.json().catch(async () => ({ error: await response.text() }))) as {
      ok?: boolean;
      session_id?: string;
      url?: string;
      error?: string;
    };

    if (!response.ok() || !payload.ok || !payload.session_id || !payload.url) {
      failures.push(`${target.plan_id}:${target.module_scope} -> ${payload.error ?? `HTTP ${response.status()}`}`);
      continue;
    }

    expect(payload.session_id).toMatch(/^cs_(test|live)_/);
    expect(payload.url).toContain("checkout.stripe.com");
  }

  expect(failures, failures.join("\n")).toEqual([]);
});