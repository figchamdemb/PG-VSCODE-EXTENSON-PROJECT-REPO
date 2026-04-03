import { expect, Page } from "@playwright/test";

type AccessibilityIssues = {
  missingAlt: string[];
  unlabeledInputs: string[];
  headingJump: boolean;
  focusableCount: number;
};

export async function gotoAndSettle(page: Page, route: string) {
  const pageErrors: string[] = [];
  const dialogs: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("dialog", async (dialog) => {
    dialogs.push(`${dialog.type()}: ${dialog.message()}`);
    await dialog.dismiss().catch(() => {});
  });

  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toBeVisible();
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

  return { response, pageErrors, dialogs };
}

export function textLikeInputLocator(page: Page) {
  return page.locator(
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="submit"]):not([type="button"]), textarea'
  );
}

export async function fillFirstEditableInputs(page: Page, payload: string, limit = 3) {
  const fields = textLikeInputLocator(page);
  const count = await fields.count();
  let filled = 0;

  for (let index = 0; index < count && filled < limit; index += 1) {
    const field = fields.nth(index);
    if (!(await field.isVisible().catch(() => false))) {
      continue;
    }
    if (!(await field.isEditable().catch(() => false))) {
      continue;
    }
    await field.fill(payload);
    filled += 1;
  }

  return filled;
}

async function collectMissingAlt(page: Page): Promise<string[]> {
  return page.locator("img").evaluateAll((elements) =>
    elements
      .filter((element) => {
        const html = element as HTMLElement;
        const style = window.getComputedStyle(html);
        const rect = html.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 && !element.hasAttribute("alt");
      })
      .map((element) => (element as HTMLImageElement).currentSrc || element.getAttribute("src") || "<unknown>")
      .slice(0, 10)
  );
}

async function collectUnlabeledInputs(page: Page): Promise<string[]> {
  const selector = "input:not([type='hidden']), textarea, select";
  return page.locator(selector).evaluateAll((elements) => {
    const labels = Array.from(document.querySelectorAll("label")) as HTMLLabelElement[];
    return elements
      .filter((element) => {
        const html = element as HTMLElement;
        const style = window.getComputedStyle(html);
        const rect = html.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) {
          return false;
        }
        const input = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        const hasForLabel = !!(input.id && labels.some((label) => label.htmlFor === input.id));
        const hasAria = !!input.getAttribute("aria-label") || !!input.getAttribute("aria-labelledby");
        const hasPlaceholder = !!input.getAttribute("placeholder");
        return !(hasForLabel || hasAria || hasPlaceholder);
      })
      .map((element) => (element as HTMLElement).outerHTML.slice(0, 120))
      .slice(0, 10);
  });
}

async function detectHeadingJump(page: Page): Promise<boolean> {
  const headingLevels = await page.locator("h1, h2, h3, h4, h5, h6").evaluateAll((elements) =>
    elements
      .filter((element) => {
        const html = element as HTMLElement;
        const style = window.getComputedStyle(html);
        const rect = html.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .map((element) => Number(element.tagName.substring(1)))
  );

  for (let index = 1; index < headingLevels.length; index += 1) {
    if (headingLevels[index] - headingLevels[index - 1] > 1) {
      return true;
    }
  }
  return false;
}

async function countFocusableElements(page: Page): Promise<number> {
  const selector = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';
  return page.locator(selector).count();
}

export async function collectAccessibilityIssues(page: Page): Promise<AccessibilityIssues> {
  const [missingAlt, unlabeledInputs, headingJump, focusableCount] = await Promise.all([
    collectMissingAlt(page),
    collectUnlabeledInputs(page),
    detectHeadingJump(page),
    countFocusableElements(page)
  ]);

  return { missingAlt, unlabeledInputs, headingJump, focusableCount };
}
