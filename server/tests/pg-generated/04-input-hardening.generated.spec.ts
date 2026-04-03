import { expect, test } from "@playwright/test";
import { fillFirstEditableInputs, gotoAndSettle } from "./_pg.generated.helpers";

const routes = [
  "/",
  "/app",
  "/checkout/cancel",
  "/checkout/success",
  "/help",
  "/oauth/github/complete",
  "/oauth/google/complete",
  "/pricing",
  "/privacy",
  "/terms"
] as string[];
const suspiciousPayload = `<script>alert("pg")</script>' OR 1=1 --`;

test.describe("PG authored input hardening", () => {
  for (const route of routes) {
    test(`@pg-authored route ${route} handles suspicious text input without client-side breakage`, async ({ page }) => {
      const { pageErrors, dialogs } = await gotoAndSettle(page, route);
      const filledCount = await fillFirstEditableInputs(page, suspiciousPayload, 1);
      test.skip(filledCount === 0, `No editable text-like inputs found on ${route}`);
      expect(pageErrors).toEqual([]);
      expect(dialogs).toEqual([]);
      await expect(page.locator("body")).toBeVisible();
    });
  }
});
