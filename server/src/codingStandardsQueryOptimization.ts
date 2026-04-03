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

const QUERY_SURFACE_PATTERN =
  /\b(select|insert|update|delete)\b[\s\S]{0,120}\b(from|into|set)\b|prisma\.[A-Za-z0-9_]+\.(findMany|findFirst|findUnique|count|aggregate|groupBy|queryRaw|queryRawUnsafe)|createQueryBuilder\s*\(|\.query\s*\(|knex\s*\(|sequelize\.[A-Za-z0-9_]+|entityManager\.[A-Za-z0-9_]+/i;
const SELECT_STAR_PATTERN = /\bselect\s+\*\s+from\b/i;
const N_PLUS_ONE_LOOP_PATTERN =
  /\b(for\s*\(|for\s+const\s+[A-Za-z0-9_]+\s+of|for\s+[A-Za-z0-9_]+\s+in|while\s*\()[\s\S]{0,700}\b(prisma\.[A-Za-z0-9_]+\.(findMany|findFirst|findUnique|count|aggregate|groupBy|queryRaw|queryRawUnsafe)|repository\.[A-Za-z0-9_]+\s*\(|entityManager\.[A-Za-z0-9_]+\s*\(|createQueryBuilder\s*\(|\.query\s*\(|knex\s*\(|sequelize\.[A-Za-z0-9_]+)/i;
const NON_SARGABLE_WHERE_PATTERN =
  /\bwhere\b[\s\S]{0,120}\b(lower|upper|date_trunc|date|year|month|day|cast|coalesce|trim|substring)\s*\(/i;
const HAVING_WITHOUT_AGGREGATE_PATTERN = /\bhaving\b/i;
const HAVING_AGGREGATE_SIGNAL_PATTERN = /\bhaving\b[\s\S]{0,120}\b(sum|count|avg|min|max)\s*\(/i;
const PRISMA_SCHEMA_PATH_PATTERN = /(^|\/)[^/]*\.prisma$/i;
const PRISMA_MODEL_PATTERN = /model\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\}/g;
const PRISMA_MODEL_INDEX_PATTERN = /@@(?:index|unique|id)\s*\(\s*\[([^\]]+)\]/g;
const PRISMA_FIELD_PATTERN = /^([A-Za-z0-9_]+)\s+([A-Za-z0-9_\[\]?]+)/;
const DEEP_OFFSET_THRESHOLD = 1000;

export function evaluateQueryOptimization(
  path: string,
  componentType: ComponentType,
  content: string,
  blockers: CodingStandardsVerificationFinding[],
  warnings: CodingStandardsVerificationFinding[],
  maxFindingsPerFile: number
): number {
  let findings = 0;
  const hasQuerySurface = QUERY_SURFACE_PATTERN.test(content);
  const prismaSchema = isPrismaSchemaPath(path);

  if (hasQuerySurface) {
    findings += evaluateQueryPatterns(path, componentType, content, blockers, warnings);
  }

  if (prismaSchema) {
    findings += evaluatePrismaForeignKeyIndexes(
      path,
      componentType,
      content,
      blockers,
      maxFindingsPerFile
    );
  }

  return findings;
}

function evaluateQueryPatterns(
  path: string,
  componentType: ComponentType,
  content: string,
  blockers: CodingStandardsVerificationFinding[],
  warnings: CodingStandardsVerificationFinding[]
): number {
  if (shouldSkipSelfPolicyQuerySignals(path)) {
    return 0;
  }
  let findings = 0;
  if (SELECT_STAR_PATTERN.test(content)) {
    pushFinding(blockers, {
      rule_id: "COD-DBQ-001",
      severity: "blocker",
      file_path: path,
      component_type: componentType,
      message: "Query uses SELECT *.",
      hint: "Select explicit columns to enable covering-index optimization and reduce payload size."
    });
    findings += 1;
  }
  if (N_PLUS_ONE_LOOP_PATTERN.test(content)) {
    pushFinding(blockers, {
      rule_id: "COD-DBQ-002",
      severity: "blocker",
      file_path: path,
      component_type: componentType,
      message: "Potential N+1 query pattern detected (loop + database call).",
      hint: "Batch related data with JOIN/includes/preload instead of per-row queries inside loops."
    });
    findings += 1;
  }
  findings += evaluateOffsetPagination(path, componentType, content, blockers, warnings);
  if (NON_SARGABLE_WHERE_PATTERN.test(content)) {
    pushFinding(warnings, {
      rule_id: "COD-DBQ-005",
      severity: "warning",
      file_path: path,
      component_type: componentType,
      message: "Potential non-SARGable WHERE predicate detected (function-wrapped filter column).",
      hint: "Avoid wrapping indexed columns in functions/casts; use range filters or expression indexes."
    });
    findings += 1;
  }
  if (HAVING_WITHOUT_AGGREGATE_PATTERN.test(content) && !HAVING_AGGREGATE_SIGNAL_PATTERN.test(content)) {
    pushFinding(warnings, {
      rule_id: "COD-DBQ-006",
      severity: "warning",
      file_path: path,
      component_type: componentType,
      message: "HAVING clause detected without obvious aggregate condition.",
      hint: "Move pre-aggregation filters to WHERE so PostgreSQL can filter rows earlier."
    });
    findings += 1;
  }
  return findings;
}

function evaluateOffsetPagination(
  path: string,
  componentType: ComponentType,
  content: string,
  blockers: CodingStandardsVerificationFinding[],
  warnings: CodingStandardsVerificationFinding[]
): number {
  const offsetValues = collectOffsetValues(content);
  if (offsetValues.length === 0) {
    return 0;
  }
  const deepestOffset = Math.max(...offsetValues);
  if (deepestOffset >= DEEP_OFFSET_THRESHOLD) {
    pushFinding(blockers, {
      rule_id: "COD-DBQ-003",
      severity: "blocker",
      file_path: path,
      component_type: componentType,
      message: `Deep OFFSET pagination detected (OFFSET ${deepestOffset} >= ${DEEP_OFFSET_THRESHOLD}).`,
      hint: "Use keyset/cursor pagination for deep pages to avoid scanning and discarding large row sets."
    });
    return 1;
  }
  pushFinding(warnings, {
    rule_id: "COD-DBQ-004",
    severity: "warning",
    file_path: path,
    component_type: componentType,
    message: "OFFSET pagination detected.",
    hint: "Prefer keyset/cursor pagination for scalable query performance."
  });
  return 1;
}

function collectOffsetValues(content: string): number[] {
  const values: number[] = [];
  const pattern = /\boffset\s+(\d+)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const value = Number.parseInt(match[1], 10);
    if (Number.isFinite(value)) {
      values.push(value);
    }
  }
  return values;
}

function evaluatePrismaForeignKeyIndexes(
  path: string,
  componentType: ComponentType,
  content: string,
  blockers: CodingStandardsVerificationFinding[],
  maxFindingsPerFile: number
): number {
  let findings = 0;
  const models = parsePrismaModels(content);
  for (const model of models) {
    const indexedFields = extractPrismaIndexedFields(model.body);
    const lines = model.body.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@") || line.startsWith("@")) {
        continue;
      }
      const fieldMatch = PRISMA_FIELD_PATTERN.exec(line);
      if (!fieldMatch) {
        continue;
      }
      const fieldName = fieldMatch[1];
      if (!fieldName.endsWith("Id") || line.includes("@id") || line.includes("@unique")) {
        continue;
      }
      if (indexedFields.has(fieldName)) {
        continue;
      }
      pushFinding(blockers, {
        rule_id: "COD-DBI-001",
        severity: "blocker",
        file_path: path,
        component_type: componentType,
        message: `Prisma model '${model.name}' has foreign-key-like field '${fieldName}' without an index.`,
        hint: `Add @@index([${fieldName}]) (or @unique if appropriate) to prevent slow JOIN/filter queries.`
      });
      findings += 1;
      if (findings >= maxFindingsPerFile) {
        return findings;
      }
    }
  }
  return findings;
}

function parsePrismaModels(content: string): Array<{ name: string; body: string }> {
  const models: Array<{ name: string; body: string }> = [];
  PRISMA_MODEL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PRISMA_MODEL_PATTERN.exec(content)) !== null) {
    models.push({ name: match[1], body: match[2] });
  }
  return models;
}

function extractPrismaIndexedFields(modelBody: string): Set<string> {
  const indexedFields = new Set<string>();
  collectInlinePrismaIndexedFields(indexedFields, modelBody);
  collectModelLevelPrismaIndexedFields(indexedFields, modelBody);
  return indexedFields;
}

function pushFinding(
  target: CodingStandardsVerificationFinding[],
  finding: CodingStandardsVerificationFinding
): void {
  target.push(finding);
}

function isPrismaSchemaPath(path: string): boolean {
  return PRISMA_SCHEMA_PATH_PATTERN.test(path);
}

function shouldSkipSelfPolicyQuerySignals(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  return normalized.includes("/codingstandards");
}

function collectInlinePrismaIndexedFields(target: Set<string>, modelBody: string): void {
  const lines = modelBody.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//") || line.startsWith("@@") || line.startsWith("@")) {
      continue;
    }
    const fieldMatch = PRISMA_FIELD_PATTERN.exec(line);
    if (!fieldMatch) {
      continue;
    }
    if (line.includes("@id") || line.includes("@unique")) {
      target.add(fieldMatch[1]);
    }
  }
}

function collectModelLevelPrismaIndexedFields(target: Set<string>, modelBody: string): void {
  PRISMA_MODEL_INDEX_PATTERN.lastIndex = 0;
  let indexMatch: RegExpExecArray | null;
  while ((indexMatch = PRISMA_MODEL_INDEX_PATTERN.exec(modelBody)) !== null) {
    const rawFields = indexMatch[1].split(",");
    for (const rawField of rawFields) {
      const fieldNameMatch = /^([A-Za-z0-9_]+)/.exec(rawField.trim());
      if (fieldNameMatch) {
        target.add(fieldNameMatch[1]);
      }
    }
  }
}
