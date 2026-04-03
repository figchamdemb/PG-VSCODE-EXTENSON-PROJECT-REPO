import { expect, type Page, test } from "@playwright/test";

async function startEmailLogin(page: Page, email: string): Promise<string> {
  await page.locator("#emailAuthCard").click();
  await page.locator("#emailInput").fill(email);
  await expect(page.locator("#emailInput")).toHaveValue(email);

  const responsePromise = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().includes("/auth/email/start")
  );
  await page.locator("#sendCodeBtn").click();

  const response = await responsePromise;
  expect(response.ok(), "Expected /auth/email/start to succeed.").toBeTruthy();
  const payload = await response.json();
  expect(payload.dev_code, "Expected local auth smoke run to expose a 6-digit dev_code.").toMatch(/^\d{6}$/);
  return payload.dev_code;
}

async function verifyEmailLogin(page: Page, code: string): Promise<void> {
  await page.locator("#codeInput").fill(code);

  const responsePromise = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().includes("/auth/email/verify")
  );
  await page.locator("#verifyCodeBtn").click();

  const response = await responsePromise;
  expect(response.ok(), "Expected /auth/email/verify to succeed.").toBeTruthy();
  const payload = await response.json();
  expect(payload.access_token, "Expected /auth/email/verify to return an access token.").toBeTruthy();
}

async function createOfflineReference(page: Page): Promise<string> {
  const responsePromise = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().includes("/payments/offline/create-ref")
  );
  await page.locator("#createOfflineBtn").click();

  const response = await responsePromise;
  expect(response.ok(), "Expected /payments/offline/create-ref to succeed.").toBeTruthy();
  const payload = await response.json();
  expect(payload.ref_code, "Expected offline payment flow to return a reference code.").toMatch(/^OFF/);
  return payload.ref_code;
}

async function submitOfflineProof(page: Page): Promise<void> {
  const responsePromise = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().includes("/payments/offline/submit-proof")
  );
  await page.locator("#submitProofBtn").click();

  const response = await responsePromise;
  expect(response.ok(), "Expected /payments/offline/submit-proof to succeed.").toBeTruthy();
}

test("@smoke email auth flow signs into the portal", async ({ page }) => {
  const email = `smoke-auth-${Date.now()}@example.com`;
  const accountOutput = page.locator("#accountOutput");
  const offlineRefInput = page.locator("#offlineRefInput");

  await page.goto("/app");
  const devCode = await startEmailLogin(page, email);
  await verifyEmailLogin(page, devCode);

  await expect(page.locator("#authState")).toHaveText(/Signed in\./i, { timeout: 15000 });
  await expect(accountOutput).toContainText(`"email": "${email}"`, { timeout: 15000 });
  await expect(page.locator("#profileEmail")).toHaveText(email);

  await page.locator('.portal-nav-btn[data-tab="billing"]').click();
  await page.locator("#planSelect").selectOption("pro");
  await page.locator("#moduleSelect").selectOption("narrate");

  const refCode = await createOfflineReference(page);
  await expect(offlineRefInput).toHaveValue(refCode, { timeout: 15000 });
  await submitOfflineProof(page);
});
