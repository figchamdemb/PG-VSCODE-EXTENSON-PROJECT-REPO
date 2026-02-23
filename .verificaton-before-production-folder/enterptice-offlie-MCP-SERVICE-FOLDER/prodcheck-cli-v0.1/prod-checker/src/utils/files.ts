import * as fs from "fs";
import * as path from "path";
import { FileInfo, TechStack, ProjectStats } from "../types";

// ============================================================
// FILE DISCOVERY — Find all scannable files in the project
// ============================================================

const IGNORE_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", "build",
  ".cache", "coverage", ".turbo", ".vercel", "__pycache__",
  ".gradle", ".idea", "Pods", ".dart_tool", ".pub-cache",
]);

const SCANNABLE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".kt", ".java", ".dart", ".swift",
  ".json", ".yaml", ".yml", ".toml", ".env",
  ".prisma", ".graphql", ".gql",
  ".xml", ".gradle", ".properties",
  ".sql",
]);

export function discoverFiles(projectPath: string): FileInfo[] {
  const files: FileInfo[] = [];
  walkDir(projectPath, projectPath, files);
  return files;
}

function walkDir(dir: string, root: string, files: FileInfo[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.isDirectory()) continue;
    if (IGNORE_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkDir(fullPath, root, files);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!SCANNABLE_EXTENSIONS.has(ext)) continue;

      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        const loc = content.split("\n").length;

        files.push({
          path: fullPath,
          relativePath: path.relative(root, fullPath),
          extension: ext,
          loc,
          content,
        });
      } catch {
        // Skip files we can't read
      }
    }
  }
}

// ============================================================
// TECH STACK DETECTION — Detect what technologies the project uses
// ============================================================

export function detectStack(projectPath: string, files: FileInfo[]): TechStack[] {
  const stack: TechStack[] = [];
  const fileNames = new Set(files.map((f) => path.basename(f.path)));
  const extensions = new Set(files.map((f) => f.extension));

  // Read package.json if exists
  const pkgPath = path.join(projectPath, "package.json");
  let pkg: Record<string, any> = {};
  if (fs.existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    } catch {}
  }
  const allDeps = {
    ...((pkg.dependencies as Record<string, string>) || {}),
    ...((pkg.devDependencies as Record<string, string>) || {}),
  };

  // TypeScript
  if (extensions.has(".ts") || extensions.has(".tsx") || allDeps["typescript"]) {
    stack.push("typescript");
  }

  // Next.js
  if (allDeps["next"] || fileNames.has("next.config.js") || fileNames.has("next.config.mjs") || fileNames.has("next.config.ts")) {
    stack.push("nextjs");
  }

  // React (web)
  if (allDeps["react"] && !allDeps["react-native"] && !allDeps["next"]) {
    stack.push("react");
  }

  // React Native
  if (allDeps["react-native"]) {
    stack.push("react-native");
  }

  // NestJS
  if (allDeps["@nestjs/core"]) {
    stack.push("nestjs");
  }

  // Prisma
  if (allDeps["@prisma/client"] || allDeps["prisma"] || fileNames.has("schema.prisma")) {
    stack.push("prisma");
  }

  // GraphQL
  if (allDeps["graphql"] || allDeps["@apollo/server"] || allDeps["@apollo/client"] || extensions.has(".graphql") || extensions.has(".gql")) {
    stack.push("graphql");
  }

  // Redis
  if (allDeps["redis"] || allDeps["ioredis"] || allDeps["@nestjs/cache-manager"]) {
    stack.push("redis");
  }

  // Docker
  if (fileNames.has("Dockerfile") || fileNames.has("docker-compose.yml") || fileNames.has("docker-compose.yaml")) {
    stack.push("docker");
  }

  // Flutter
  if (fileNames.has("pubspec.yaml") && extensions.has(".dart")) {
    stack.push("flutter");
  }

  // Kotlin Android
  if (extensions.has(".kt") && (fileNames.has("build.gradle.kts") || fileNames.has("build.gradle"))) {
    stack.push("kotlin-android");
  }

  // Java Spring Boot
  if (extensions.has(".java") && files.some((f) => f.content.includes("@SpringBootApplication"))) {
    stack.push("java-spring-boot");
  }

  // Python FastAPI
  if (extensions.has(".py") && files.some((f) => f.content.includes("from fastapi") || f.content.includes("import fastapi"))) {
    stack.push("python-fastapi");
  }

  // Python Django
  if (extensions.has(".py") && (fileNames.has("manage.py") || files.some((f) => f.content.includes("from django")))) {
    stack.push("python-django");
  }

  return stack;
}

// ============================================================
// PROJECT STATS — Compute aggregate statistics
// ============================================================

export function computeStats(files: FileInfo[]): ProjectStats {
  let maxLoc = 0;
  let maxLocPath = "";
  const fileCounts: Record<string, number> = {};

  for (const file of files) {
    if (file.loc > maxLoc) {
      maxLoc = file.loc;
      maxLocPath = file.relativePath;
    }
    fileCounts[file.extension] = (fileCounts[file.extension] || 0) + 1;
  }

  return {
    filesScanned: files.length,
    totalLoc: files.reduce((sum, f) => sum + f.loc, 0),
    maxFileLoc: maxLoc,
    maxFileLocPath: maxLocPath,
    fileCount: fileCounts,
  };
}
