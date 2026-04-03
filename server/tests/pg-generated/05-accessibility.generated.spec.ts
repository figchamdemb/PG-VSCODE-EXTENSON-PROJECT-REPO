import { expect, test } from "@playwright/test";
import { collectAccessibilityIssues, gotoAndSettle } from "./_pg.generated.helpers";

const routes = [
  "/",
  "/app",
  "/checkout/cancel",
  "/checkout/success",
  "/help"
] as string[];

test.describe("PG authored accessibility basics", () => {
  for (const route of routes) {
    test(`@pg-authored route ${route} meets baseline accessibility checks`, async ({ page }) => {
      await gotoAndSettle(page, route);
      const issues = await collectAccessibilityIssues(page);
      expect(issues.missingAlt, `Missing alt text on ${route}`).toEqual([]);
      expect(issues.unlabeledInputs, `Inputs missing labels on ${route}`).toEqual([]);
      expect(issues.headingJump, `Heading levels should not skip on ${route}`).toBeFalsy();
      if (issues.focusableCount > 0) {
        await page.keyboard.press("Tab");
        await expect(page.locator("body")).toBeVisible();
      }
    });
  }
});
