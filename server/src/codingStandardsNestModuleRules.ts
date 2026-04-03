type VerificationSeverity = "blocker" | "warning";

type ComponentType =
  | "controller"
  | "service"
  | "repository"
  | "dto"
  | "entity"
  | "utility"
  | "component"
  | "hook"
  | "config"
  | "module"
  | "screen"
  | "page"
  | "test"
  | "unknown";

type CodingStandardsVerificationFinding = {
  rule_id: string;
  severity: VerificationSeverity;
  file_path: string | null;
  component_type: ComponentType | null;
  message: string;
  hint: string;
};

const MODULE_TARGET_TOTAL_ENTRIES = 16;
const MODULE_HARD_TOTAL_ENTRIES = 28;
const MODULE_ARRAY_PATTERN = /\b(imports|providers|controllers|exports)\s*:\s*\[([\s\S]*?)\]/g;
const PLACEHOLDER_MODULE_FILE_PATTERN =
  /(?:^|\/)(new|temp|test|sample|demo|untitled|module\d*|my)\.module\.(ts|js)$/i;
const PLACEHOLDER_MODULE_CLASS_PATTERN =
  /\bexport\s+class\s+(New|Temp|Test|Sample|Demo|Untitled|My|Module\d*)Module\b/;

export function evaluateNestModuleRules(
  path: string,
  componentType: ComponentType,
  content: string,
  blockers: CodingStandardsVerificationFinding[],
  warnings: CodingStandardsVerificationFinding[]
): number {
  if (componentType !== "module" || isTestPath(path) || !/@Module\s*\(/.test(content)) {
    return 0;
  }
  let findings = 0;

  const metadataCounts = getNestModuleMetadataCounts(content);
  const totalEntries = metadataCounts.imports + metadataCounts.providers
    + metadataCounts.controllers + metadataCounts.exports;

  if (totalEntries > MODULE_HARD_TOTAL_ENTRIES) {
    pushFinding(blockers, {
      rule_id: "COD-NEST-001",
      severity: "blocker",
      file_path: path,
      component_type: componentType,
      message: `NestJS module metadata is too large (${totalEntries} entries > ${MODULE_HARD_TOTAL_ENTRIES}).`,
      hint: "Split the module into narrower feature modules and reduce unrelated imports/providers/controllers/exports."
    });
    findings += 1;
  } else if (totalEntries > MODULE_TARGET_TOTAL_ENTRIES) {
    pushFinding(warnings, {
      rule_id: "COD-NEST-002",
      severity: "warning",
      file_path: path,
      component_type: componentType,
      message: `NestJS module is above target complexity (${totalEntries} metadata entries > ${MODULE_TARGET_TOTAL_ENTRIES}).`,
      hint: "Avoid over-engineered modules; prefer smaller feature boundaries and focused provider/controller groupings."
    });
    findings += 1;
  }

  if (PLACEHOLDER_MODULE_FILE_PATTERN.test(path) || PLACEHOLDER_MODULE_CLASS_PATTERN.test(content)) {
    pushFinding(warnings, {
      rule_id: "COD-NEST-003",
      severity: "warning",
      file_path: path,
      component_type: componentType,
      message: "NestJS module uses a placeholder or non-meaningful name.",
      hint: "Rename the module to reflect its real feature/domain responsibility."
    });
    findings += 1;
  }

  return findings;
}

function getNestModuleMetadataCounts(content: string): Record<"imports" | "providers" | "controllers" | "exports", number> {
  const counts = {
    imports: 0,
    providers: 0,
    controllers: 0,
    exports: 0
  };
  for (const match of content.matchAll(MODULE_ARRAY_PATTERN)) {
    const key = match[1] as keyof typeof counts;
    const body = match[2] ?? "";
    counts[key] += countModuleEntries(body);
  }
  return counts;
}

function countModuleEntries(input: string): number {
  const cleaned = input
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ")
    .trim();
  if (!cleaned) {
    return 0;
  }
  return cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .length;
}

function pushFinding(
  target: CodingStandardsVerificationFinding[],
  finding: CodingStandardsVerificationFinding
): void {
  target.push(finding);
}

function isTestPath(path: string): boolean {
  return (
    path.includes("/__tests__/") ||
    path.includes("/tests/") ||
    /\.test\./.test(path) ||
    /\.spec\./.test(path)
  );
}
