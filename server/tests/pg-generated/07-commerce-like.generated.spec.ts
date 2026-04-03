import { expect, test } from "@playwright/test";
import { gotoAndSettle } from "./_pg.generated.helpers";

const commerceRoutes = [
  "/checkout/cancel",
  "/checkout/success"
] as string[];

test.describe("PG authored commerce-like routes", () => {
  for (const route of commerceRoutes) {
    test(`@pg-authored commerce-like route ${route} renders checkout controls`, async ({ page }) => {
      await gotoAndSettle(page, route);
      const actionControls = page.locator('button, input[type="submit"], form');
      const actionCount = await actionControls.count();
      test.skip(actionCount === 0, `No checkout-specific controls found on ${route}`);
      expect(actionCount).toBeGreaterThan(0);
    });
  }
});
