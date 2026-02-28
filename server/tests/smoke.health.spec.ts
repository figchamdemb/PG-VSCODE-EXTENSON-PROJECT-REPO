import { expect, test } from "@playwright/test";

test("@smoke health endpoint returns ok", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload.ok).toBe(true);
});

test("@smoke landing page responds", async ({ request }) => {
  const response = await request.get("/");
  expect(response.ok()).toBeTruthy();
  const body = await response.text();
  expect(body.toLowerCase()).toContain("narrate");
});
