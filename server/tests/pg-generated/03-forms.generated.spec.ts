import { expect, test } from "@playwright/test";
import { gotoAndSettle } from "./_pg.generated.helpers";

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

test.describe("PG authored form surfaces", () => {
  for (const route of routes) {
    test(`@pg-authored route ${route} exposes form controls when forms are present`, async ({ page }) => {
      await gotoAndSettle(page, route);
      const forms = page.locator("form");
      const formCount = await forms.count();
      test.skip(formCount === 0, `No form elements found on ${route}`);
      const controlCount = await page.locator("form input, form textarea, form select").count();
      expect(controlCount).toBeGreaterThan(0);
    });
  }
});
