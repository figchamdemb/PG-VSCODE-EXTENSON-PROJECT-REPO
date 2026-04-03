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

test.describe("PG authored route coverage", () => {
  for (const route of routes) {
    test(`@pg-authored route ${route} loads without frontend errors`, async ({ page }) => {
      const { response, pageErrors, dialogs } = await gotoAndSettle(page, route);
      if (response) {
        expect(response.status()).toBeLessThan(400);
      }
      expect(pageErrors).toEqual([]);
      expect(dialogs).toEqual([]);
      await expect(page.locator("body")).toBeVisible();
    });
  }
});
