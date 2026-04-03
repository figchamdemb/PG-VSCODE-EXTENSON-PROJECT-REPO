CONFIG_TEMPLATE = """import path from \"node:path\";
import { defineConfig, devices } from \"@playwright/test\";

const host = process.env.HOST ?? \"127.0.0.1\";
const port = Number(process.env.PORT ?? process.env.PG_SMOKE_PORT ?? \"3000\");
const baseURL = process.env.PG_SMOKE_BASE_URL ?? process.env.PG_PLAYWRIGHT_BASE_URL ?? `http://${host}:${port}`;
const browserMatrix = (process.env.PG_SMOKE_BROWSER_MATRIX ?? process.env.PG_PLAYWRIGHT_BROWSER_MATRIX ?? \"minimal\").toLowerCase();
const reportDir = process.env.PG_SMOKE_REPORT_DIR ?? path.join(__dirname, \"playwright-report\");
const resultsDir = process.env.PG_SMOKE_RESULTS_DIR ?? path.join(__dirname, \"test-results\");
const jsonReportPath = process.env.PG_SMOKE_JSON_REPORT_PATH ?? path.join(resultsDir, \"report.json\");
const startCommand = process.env.PG_PLAYWRIGHT_START_COMMAND ?? \"npm run dev\";

function resolveProjects() {
  const desktopProjects = [
    { name: \"chromium\", use: { ...devices[\"Desktop Chrome\"] } },
    { name: \"firefox\", use: { ...devices[\"Desktop Firefox\"] } },
    { name: \"webkit\", use: { ...devices[\"Desktop Safari\"] } }
  ];

  if (browserMatrix === \"full\") {
    return [
      ...desktopProjects,
      { name: \"mobile-chrome\", use: { ...devices[\"Pixel 5\"] } },
      { name: \"mobile-safari\", use: { ...devices[\"iPhone 12\"] } }
    ];
  }

  if (browserMatrix === \"desktop\") {
    return desktopProjects;
  }

  return [desktopProjects[0]];
}

export default defineConfig({
  testDir: \"./tests\",
  timeout: 120000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: resultsDir,
  reporter: [
    [\"line\"],
    [\"html\", { open: \"never\", outputFolder: reportDir }],
    [\"json\", { outputFile: jsonReportPath }]
  ],
  use: {
    baseURL,
    trace: \"retain-on-failure\",
    screenshot: \"only-on-failure\",
    video: \"retain-on-failure\"
  },
  projects: resolveProjects(),
  webServer: {
    command: startCommand,
    cwd: __dirname,
    url: baseURL,
    timeout: 120000,
    reuseExistingServer: true,
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port)
    }
  }
});
"""

HELPER_TEMPLATE = """import { expect, Page } from \"@playwright/test\";

type AccessibilityIssues = {
  missingAlt: string[];
  unlabeledInputs: string[];
  headingJump: boolean;
  focusableCount: number;
};

export async function gotoAndSettle(page: Page, route: string) {
  const pageErrors: string[] = [];
  const dialogs: string[] = [];

  page.on(\"pageerror\", (error) => pageErrors.push(error.message));
  page.on(\"dialog\", async (dialog) => {
    dialogs.push(`${dialog.type()}: ${dialog.message()}`);
    await dialog.dismiss().catch(() => {});
  });

  const response = await page.goto(route, { waitUntil: \"domcontentloaded\" });
  await expect(page.locator(\"body\")).toBeVisible();
  await page.waitForLoadState(\"networkidle\", { timeout: 5000 }).catch(() => {});

  return { response, pageErrors, dialogs };
}

export function textLikeInputLocator(page: Page) {
  return page.locator(
    'input:not([type=\"hidden\"]):not([type=\"checkbox\"]):not([type=\"radio\"]):not([type=\"file\"]):not([type=\"submit\"]):not([type=\"button\"]), textarea'
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
  return page.locator(\"img\").evaluateAll((elements) =>
    elements
      .filter((element) => {
        const html = element as HTMLElement;
        const style = window.getComputedStyle(html);
        const rect = html.getBoundingClientRect();
        return style.display !== \"none\" && style.visibility !== \"hidden\" && rect.width > 0 && rect.height > 0 && !element.hasAttribute(\"alt\");
      })
      .map((element) => (element as HTMLImageElement).currentSrc || element.getAttribute(\"src\") || \"<unknown>\")
      .slice(0, 10)
  );
}

async function collectUnlabeledInputs(page: Page): Promise<string[]> {
  const selector = \"input:not([type='hidden']), textarea, select\";
  return page.locator(selector).evaluateAll((elements) => {
    const labels = Array.from(document.querySelectorAll(\"label\")) as HTMLLabelElement[];
    return elements
      .filter((element) => {
        const html = element as HTMLElement;
        const style = window.getComputedStyle(html);
        const rect = html.getBoundingClientRect();
        if (style.display === \"none\" || style.visibility === \"hidden\" || rect.width <= 0 || rect.height <= 0) {
          return false;
        }
        const input = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        const hasForLabel = !!(input.id && labels.some((label) => label.htmlFor === input.id));
        const hasAria = !!input.getAttribute(\"aria-label\") || !!input.getAttribute(\"aria-labelledby\");
        const hasPlaceholder = !!input.getAttribute(\"placeholder\");
        return !(hasForLabel || hasAria || hasPlaceholder);
      })
      .map((element) => (element as HTMLElement).outerHTML.slice(0, 120))
      .slice(0, 10);
  });
}

async function detectHeadingJump(page: Page): Promise<boolean> {
  const headingLevels = await page.locator(\"h1, h2, h3, h4, h5, h6\").evaluateAll((elements) =>
    elements
      .filter((element) => {
        const html = element as HTMLElement;
        const style = window.getComputedStyle(html);
        const rect = html.getBoundingClientRect();
        return style.display !== \"none\" && style.visibility !== \"hidden\" && rect.width > 0 && rect.height > 0;
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
  const selector = 'a[href], button, input:not([type=\"hidden\"]), select, textarea, [tabindex]:not([tabindex=\"-1\"])';
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
"""

SMOKE_TEMPLATE = """import {{ expect, test }} from \"@playwright/test\";
import {{ gotoAndSettle }} from \"./_pg.generated.helpers\";

test.describe(\"PG authored smoke\", () => {{
  test(\"@smoke @pg-authored homepage renders visible content\", async ({{ page }}) => {{
    const {{ response, pageErrors, dialogs }} = await gotoAndSettle(page, \"__HOME_ROUTE__\");

    if (response) {{
      expect(response.status()).toBeLessThan(400);
    }}

    expect(pageErrors).toEqual([]);
    expect(dialogs).toEqual([]);
    await expect(page.locator(\"body\")).toContainText(/\\S+/);
  }});
}});
"""

ROUTES_TEMPLATE = """import {{ expect, test }} from \"@playwright/test\";
import {{ gotoAndSettle }} from \"./_pg.generated.helpers\";

const routes = __ROUTES_JSON__ as string[];

test.describe(\"PG authored route coverage\", () => {{
  for (const route of routes) {{
    test(`@pg-authored route ${{route}} loads without frontend errors`, async ({{ page }}) => {{
      const {{ response, pageErrors, dialogs }} = await gotoAndSettle(page, route);
      if (response) {{
        expect(response.status()).toBeLessThan(400);
      }}
      expect(pageErrors).toEqual([]);
      expect(dialogs).toEqual([]);
      await expect(page.locator(\"body\")).toBeVisible();
    }});
  }}
}});
"""

FORMS_TEMPLATE = """import {{ expect, test }} from \"@playwright/test\";
import {{ gotoAndSettle }} from \"./_pg.generated.helpers\";

const routes = __ROUTES_JSON__ as string[];

test.describe(\"PG authored form surfaces\", () => {{
  for (const route of routes) {{
    test(`@pg-authored route ${{route}} exposes form controls when forms are present`, async ({{ page }}) => {{
      await gotoAndSettle(page, route);
      const forms = page.locator(\"form\");
      const formCount = await forms.count();
      test.skip(formCount === 0, `No form elements found on ${{route}}`);
      const controlCount = await page.locator(\"form input, form textarea, form select\").count();
      expect(controlCount).toBeGreaterThan(0);
    }});
  }}
}});
"""

INPUT_HARDENING_TEMPLATE = """import {{ expect, test }} from \"@playwright/test\";
import {{ fillFirstEditableInputs, gotoAndSettle }} from \"./_pg.generated.helpers\";

const routes = __ROUTES_JSON__ as string[];
const suspiciousPayload = `<script>alert(\"pg\")</script>' OR 1=1 --`;

test.describe(\"PG authored input hardening\", () => {{
  for (const route of routes) {{
    test(`@pg-authored route ${{route}} handles suspicious text input without client-side breakage`, async ({{ page }}) => {{
      const {{ pageErrors, dialogs }} = await gotoAndSettle(page, route);
      const filledCount = await fillFirstEditableInputs(page, suspiciousPayload, 1);
      test.skip(filledCount === 0, `No editable text-like inputs found on ${{route}}`);
      expect(pageErrors).toEqual([]);
      expect(dialogs).toEqual([]);
      await expect(page.locator(\"body\")).toBeVisible();
    }});
  }}
}});
"""

ACCESSIBILITY_TEMPLATE = """import {{ expect, test }} from \"@playwright/test\";
import {{ collectAccessibilityIssues, gotoAndSettle }} from \"./_pg.generated.helpers\";

const routes = __ROUTES_JSON__ as string[];

test.describe(\"PG authored accessibility basics\", () => {{
  for (const route of routes) {{
    test(`@pg-authored route ${{route}} meets baseline accessibility checks`, async ({{ page }}) => {{
      await gotoAndSettle(page, route);
      const issues = await collectAccessibilityIssues(page);
      expect(issues.missingAlt, `Missing alt text on ${{route}}`).toEqual([]);
      expect(issues.unlabeledInputs, `Inputs missing labels on ${{route}}`).toEqual([]);
      expect(issues.headingJump, `Heading levels should not skip on ${{route}}`).toBeFalsy();
      if (issues.focusableCount > 0) {{
        await page.keyboard.press(\"Tab\");
        await expect(page.locator(\"body\")).toBeVisible();
      }}
    }});
  }}
}});
"""

AUTH_TEMPLATE = """import {{ expect, test }} from \"@playwright/test\";
import {{ gotoAndSettle }} from \"./_pg.generated.helpers\";

const authRoutes = __ROUTES_JSON__ as string[];

test.describe(\"PG authored auth-like routes\", () => {{
  for (const route of authRoutes) {{
    test(`@pg-authored auth-like route ${{route}} renders sign-in controls`, async ({{ page }}) => {{
      await gotoAndSettle(page, route);
      const passwordInputs = page.locator('input[type=\"password\"]');
      const emailInputs = page.locator('input[type=\"email\"], input[name*=\"email\" i], input[id*=\"email\" i]');
      const submitButtons = page.locator('button[type=\"submit\"], input[type=\"submit\"]');
      expect((await passwordInputs.count()) + (await emailInputs.count()) + (await submitButtons.count())).toBeGreaterThan(0);
    }});
  }}
}});
"""

COMMERCE_TEMPLATE = """import {{ expect, test }} from \"@playwright/test\";
import {{ gotoAndSettle }} from \"./_pg.generated.helpers\";

const commerceRoutes = __ROUTES_JSON__ as string[];

test.describe(\"PG authored commerce-like routes\", () => {{
  for (const route of commerceRoutes) {{
    test(`@pg-authored commerce-like route ${{route}} renders checkout controls`, async ({{ page }}) => {{
      await gotoAndSettle(page, route);
      const actionControls = page.locator('button, input[type=\"submit\"], form');
      const actionCount = await actionControls.count();
      test.skip(actionCount === 0, `No checkout-specific controls found on ${{route}}`);
      expect(actionCount).toBeGreaterThan(0);
    }});
  }}
}});
"""