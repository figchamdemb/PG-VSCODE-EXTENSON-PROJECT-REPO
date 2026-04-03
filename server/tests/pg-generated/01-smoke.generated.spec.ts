import { expect, test } from "@playwright/test";
import { gotoAndSettle } from "./_pg.generated.helpers";

test.describe("PG authored smoke", () => {
  test("@smoke @pg-authored homepage renders visible content", async ({ page }) => {
    const { response, pageErrors, dialogs } = await gotoAndSettle(page, "/");

    if (response) {
      expect(response.status()).toBeLessThan(400);
    }

    expect(pageErrors).toEqual([]);
    expect(dialogs).toEqual([]);
    await expect(page.locator("body")).toContainText(/\S+/);
  });
});
