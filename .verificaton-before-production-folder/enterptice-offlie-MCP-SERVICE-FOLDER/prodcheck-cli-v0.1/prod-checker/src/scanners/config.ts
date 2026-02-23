import { Scanner, ScanContext, Finding } from "../types";
import * as path from "path";

export const configScanner: Scanner = {
  name: "Configuration Scanner",
  description: "Validates Dockerfiles, framework configs, Prisma schema, and dependency health",
  supportedStacks: [
    "nextjs", "react", "nestjs", "typescript", "prisma", "docker",
    "react-native", "flutter", "kotlin-android",
  ],

  async scan(ctx: ScanContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const file of ctx.files) {
      const name = path.basename(file.path);

      if (name === "Dockerfile") checkDockerfile(file.relativePath, file.content, findings);
      if (name.endsWith(".prisma")) checkPrismaSchema(file.relativePath, file.content, findings);
      if (name === "next.config.js" || name === "next.config.mjs" || name === "next.config.ts") {
        checkNextConfig(file.relativePath, file.content, findings);
      }
      if (name === "docker-compose.yml" || name === "docker-compose.yaml") {
        checkDockerCompose(file.relativePath, file.content, findings);
      }
      if (name === "package.json" && file.relativePath === "package.json") {
        checkPackageJson(file.relativePath, file.content, findings);
      }
      if (name === "AndroidManifest.xml") {
        checkAndroidManifest(file.relativePath, file.content, findings);
      }
    }

    // Check for missing critical files
    checkMissingFiles(ctx, findings);

    return findings;
  },
};

function checkDockerfile(filePath: string, content: string, findings: Finding[]): void {
  const lines = content.split("\n");

  // Check for non-root user
  if (!content.includes("USER ") || /USER\s+root/i.test(content)) {
    findings.push({
      ruleId: "CFG-001",
      category: "security",
      severity: "blocker",
      status: "fail",
      title: "Docker container runs as root",
      detail: "No non-root USER directive found in Dockerfile",
      file: filePath,
      recommendation: "Add 'USER nonroot' or 'USER 1001' after installing dependencies",
    });
  }

  // Check for latest tag
  for (let i = 0; i < lines.length; i++) {
    if (/^FROM\s+\S+:latest/i.test(lines[i]) || /^FROM\s+\S+\s*$/i.test(lines[i])) {
      if (!lines[i].includes(":") || lines[i].includes(":latest")) {
        findings.push({
          ruleId: "CFG-002",
          category: "security",
          severity: "blocker",
          status: "fail",
          title: "Docker image uses 'latest' tag",
          detail: "'latest' tag is unpredictable and non-reproducible",
          file: filePath,
          line: i + 1,
          recommendation: "Pin a specific version (e.g., node:20.11-alpine)",
        });
      }
    }
  }

  // Check for secrets in build args
  for (let i = 0; i < lines.length; i++) {
    if (/(?:ARG|ENV)\s+(?:.*(?:PASSWORD|SECRET|TOKEN|API_KEY))/i.test(lines[i])) {
      findings.push({
        ruleId: "CFG-003",
        category: "security",
        severity: "blocker",
        status: "fail",
        title: "Secret in Dockerfile ARG/ENV",
        detail: "Secrets in Dockerfile are visible in image layers and build logs",
        file: filePath,
        line: i + 1,
        recommendation: "Use Docker secrets, mount secrets at runtime, or use a secrets manager",
      });
    }
  }

  // Check for HEALTHCHECK
  if (!content.includes("HEALTHCHECK")) {
    findings.push({
      ruleId: "CFG-004",
      category: "observability",
      severity: "warning",
      status: "fail",
      title: "No HEALTHCHECK in Dockerfile",
      detail: "Container orchestrators need health checks to manage container lifecycle",
      file: filePath,
      recommendation: "Add HEALTHCHECK instruction: HEALTHCHECK CMD curl -f http://localhost:PORT/health || exit 1",
    });
  }

  // Check for multi-stage build
  const fromCount = (content.match(/^FROM\s+/gim) || []).length;
  if (fromCount < 2) {
    findings.push({
      ruleId: "CFG-005",
      category: "performance",
      severity: "info",
      status: "fail",
      title: "No multi-stage Docker build",
      detail: "Single-stage builds include build tools in the final image, increasing size",
      file: filePath,
      recommendation: "Use multi-stage builds to keep the final image minimal",
    });
  }
}

function checkPrismaSchema(filePath: string, content: string, findings: Finding[]): void {
  const lines = content.split("\n");

  // Check for Float used for money
  for (let i = 0; i < lines.length; i++) {
    if (/(?:price|amount|total|balance|cost|fee|salary|payment)\s+Float/i.test(lines[i])) {
      findings.push({
        ruleId: "CFG-010",
        category: "database",
        severity: "blocker",
        status: "fail",
        title: "Float type used for monetary value",
        detail: "Float causes precision errors for money (e.g., 0.1 + 0.2 ≠ 0.3)",
        file: filePath,
        line: i + 1,
        recommendation: "Use Decimal type for all monetary values",
      });
    }
  }

  // Check for missing @@index
  const models = content.match(/model\s+\w+\s*\{[\s\S]*?\}/g) || [];
  for (const model of models) {
    const modelName = model.match(/model\s+(\w+)/)?.[1] || "Unknown";
    const hasRelations = /\w+\s+\w+\s+@relation/.test(model);
    const hasIndex = /@@index/.test(model);

    if (hasRelations && !hasIndex) {
      findings.push({
        ruleId: "CFG-011",
        category: "database",
        severity: "warning",
        status: "fail",
        title: `Model '${modelName}' has relations but no @@index`,
        detail: "Related fields should be indexed for query performance",
        file: filePath,
        recommendation: `Add @@index on foreign key fields in model ${modelName}`,
      });
    }
  }

  // Check for missing createdAt/updatedAt
  for (const model of models) {
    const modelName = model.match(/model\s+(\w+)/)?.[1] || "Unknown";
    if (!model.includes("createdAt") && !model.includes("created_at")) {
      findings.push({
        ruleId: "CFG-012",
        category: "database",
        severity: "info",
        status: "fail",
        title: `Model '${modelName}' missing createdAt timestamp`,
        detail: "Business models should track creation and update times",
        file: filePath,
        recommendation: "Add: createdAt DateTime @default(now()) and updatedAt DateTime @updatedAt",
      });
    }
  }
}

function checkNextConfig(filePath: string, content: string, findings: Finding[]): void {
  // Check for CSP headers
  if (!content.includes("Content-Security-Policy") && !content.includes("contentSecurityPolicy")) {
    findings.push({
      ruleId: "CFG-020",
      category: "security",
      severity: "warning",
      status: "fail",
      title: "No Content Security Policy (CSP) in Next.js config",
      detail: "CSP headers prevent XSS and code injection attacks",
      file: filePath,
      recommendation: "Add CSP headers via next.config.js headers() or middleware",
    });
  }
}

function checkDockerCompose(filePath: string, content: string, findings: Finding[]): void {
  if (/privileged:\s*true/i.test(content)) {
    findings.push({
      ruleId: "CFG-030",
      category: "security",
      severity: "blocker",
      status: "fail",
      title: "Privileged container in docker-compose",
      detail: "Privileged containers have full host access — severe security risk",
      file: filePath,
      recommendation: "Remove privileged: true. Use specific capabilities (cap_add) if needed",
    });
  }

  // Check for exposed database ports
  const dbPortPatterns = [
    { regex: /["']?5432:5432["']?/, name: "PostgreSQL" },
    { regex: /["']?3306:3306["']?/, name: "MySQL" },
    { regex: /["']?27017:27017["']?/, name: "MongoDB" },
    { regex: /["']?6379:6379["']?/, name: "Redis" },
  ];

  for (const pattern of dbPortPatterns) {
    if (pattern.regex.test(content)) {
      findings.push({
        ruleId: "CFG-031",
        category: "security",
        severity: "warning",
        status: "fail",
        title: `${pattern.name} port exposed in docker-compose`,
        detail: `${pattern.name} default port is mapped to host — should be internal only in production`,
        file: filePath,
        recommendation: `Remove port mapping for ${pattern.name} in production compose file. Use internal Docker networking`,
      });
    }
  }
}

function checkPackageJson(filePath: string, content: string, findings: Finding[]): void {
  try {
    const pkg = JSON.parse(content);

    // Check for console stripping in production
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

    if (!allDeps["babel-plugin-transform-remove-console"] && !content.includes("remove-console")) {
      if (allDeps["react"] || allDeps["react-native"] || allDeps["next"]) {
        findings.push({
          ruleId: "CFG-040",
          category: "code-quality",
          severity: "info",
          status: "fail",
          title: "No console.log stripping configured for production",
          detail: "console.log statements may remain in production bundle",
          file: filePath,
          recommendation: "Add babel-plugin-transform-remove-console or configure your bundler to strip console calls",
        });
      }
    }
  } catch {
    // Can't parse package.json
  }
}

function checkAndroidManifest(filePath: string, content: string, findings: Finding[]): void {
  if (/usesCleartextTraffic\s*=\s*["']true["']/i.test(content)) {
    findings.push({
      ruleId: "CFG-050",
      category: "security",
      severity: "blocker",
      status: "fail",
      title: "Cleartext HTTP traffic enabled on Android",
      detail: "usesCleartextTraffic=true allows unencrypted HTTP connections",
      file: filePath,
      recommendation: "Set android:usesCleartextTraffic=\"false\" for production builds",
    });
  }
}

function checkMissingFiles(ctx: ScanContext, findings: Finding[]): void {
  const fileNames = new Set(ctx.files.map((f) => f.relativePath));

  // .gitignore should exist
  if (!fileNames.has(".gitignore")) {
    findings.push({
      ruleId: "CFG-060",
      category: "security",
      severity: "warning",
      status: "fail",
      title: "No .gitignore file",
      detail: "Without .gitignore, secrets and build artifacts may be committed",
      recommendation: "Create .gitignore to exclude node_modules, .env, dist, build, etc.",
    });
  }

  // .env should not be committed (check if .env exists but not in .gitignore)
  if (fileNames.has(".env")) {
    const gitignore = ctx.files.find((f) => f.relativePath === ".gitignore");
    if (gitignore && !gitignore.content.includes(".env")) {
      findings.push({
        ruleId: "CFG-061",
        category: "security",
        severity: "blocker",
        status: "fail",
        title: ".env file exists but not in .gitignore",
        detail: "Environment file with potential secrets is not gitignored",
        file: ".gitignore",
        recommendation: "Add .env* to .gitignore immediately",
      });
    }
  }
}
