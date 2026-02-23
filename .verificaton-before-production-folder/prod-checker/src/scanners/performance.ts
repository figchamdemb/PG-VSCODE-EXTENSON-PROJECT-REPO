import { Scanner, ScanContext, Finding } from "../types";

export const performanceScanner: Scanner = {
  name: "Performance & Database Scanner",
  description: "Detects N+1 queries, unbounded queries, missing pagination, error handling gaps",
  supportedStacks: [
    "nextjs", "react", "nestjs", "typescript", "prisma",
    "java-spring-boot", "python-fastapi", "python-django",
  ],

  async scan(ctx: ScanContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const file of ctx.files) {
      const isCode = [".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".kt"].includes(file.extension);
      if (!isCode) continue;

      checkNPlusOne(file.relativePath, file.content, findings, ctx.detectedStack);
      checkUnboundedQueries(file.relativePath, file.content, findings, ctx.detectedStack);
      checkSelectAll(file.relativePath, file.content, findings, ctx.detectedStack);
      checkMissingErrorBoundary(file.relativePath, file.content, findings, ctx.detectedStack);
      checkMissingErrorHandling(file.relativePath, file.content, findings);
      checkEmptyCatchBlocks(file.relativePath, file.content, findings);
      checkUseEffectDataFetching(file.relativePath, file.content, findings, ctx.detectedStack);
      checkScrollViewForLists(file.relativePath, file.content, findings, ctx.detectedStack);
    }

    // Project-level checks
    checkMissingHealthEndpoint(ctx, findings);
    checkMissingGlobalErrorHandler(ctx, findings);

    return findings;
  },
};

function checkNPlusOne(filePath: string, content: string, findings: Finding[], stack: string[]): void {
  const lines = content.split("\n");

  // Prisma N+1: findMany/findFirst inside loops
  if (stack.includes("prisma") || stack.includes("typescript")) {
    const loopPatterns = [
      /\.map\s*\(\s*(?:async\s*)?\(/,
      /\.forEach\s*\(\s*(?:async\s*)?\(/,
      /for\s*\(\s*(?:const|let|var)/,
      /for\s*\(\s*\w+\s+(?:of|in)/,
    ];

    let insideLoop = false;
    let loopDepth = 0;
    let loopStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect loop start
      for (const pattern of loopPatterns) {
        if (pattern.test(line)) {
          if (!insideLoop) loopStartLine = i;
          insideLoop = true;
          loopDepth++;
          break;
        }
      }

      // Simple brace counting for loop scope
      if (insideLoop) {
        const opens = (line.match(/\{/g) || []).length;
        const closes = (line.match(/\}/g) || []).length;
        loopDepth += opens - closes;
        if (loopDepth <= 0) {
          insideLoop = false;
          loopDepth = 0;
        }
      }

      // Detect DB call inside loop
      if (insideLoop) {
        const dbCallPatterns = [
          /prisma\.\w+\.(?:findMany|findFirst|findUnique|create|update|delete)\s*\(/,
          /\.query\s*\(/,
          /\.execute\s*\(/,
          /await\s+fetch\s*\(/,
          /\.find\s*\(\s*\{/,     // Mongoose
          /\.findOne\s*\(\s*\{/,  // Mongoose
        ];

        for (const dbPattern of dbCallPatterns) {
          if (dbPattern.test(line)) {
            findings.push({
              ruleId: "PERF-001",
              category: "database",
              severity: "blocker",
              status: "fail",
              title: "N+1 query pattern detected",
              detail: "Database query found inside a loop — this will make N separate queries instead of 1",
              file: filePath,
              line: i + 1,
              recommendation: stack.includes("prisma")
                ? "Use Prisma 'include' for eager loading or batch with 'where: { id: { in: ids } }'"
                : "Use JOIN, batch query, or DataLoader to fetch all data in a single query",
            });
            return; // One N+1 finding per file is enough
          }
        }
      }
    }
  }

  // Django N+1: missing select_related/prefetch_related
  if (stack.includes("python-django")) {
    if (/\.objects\.(?:all|filter)\s*\(/.test(content)) {
      const hasRelatedLoop = /for\s+\w+\s+in\s+.*\.objects\./.test(content);
      const hasEagerLoad = /select_related|prefetch_related/.test(content);

      if (hasRelatedLoop && !hasEagerLoad) {
        findings.push({
          ruleId: "PERF-001",
          category: "database",
          severity: "warning",
          status: "fail",
          title: "Potential N+1: Django queryset iterated without select_related/prefetch_related",
          detail: "Iterating over queryset without eager loading may cause N+1 queries",
          file: filePath,
          recommendation: "Add .select_related() or .prefetch_related() to the queryset",
        });
      }
    }
  }
}

function checkUnboundedQueries(filePath: string, content: string, findings: Finding[], stack: string[]): void {
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Prisma findMany without take
    if (/prisma\.\w+\.findMany\s*\(/.test(line)) {
      // Look ahead 10 lines for 'take'
      const block = lines.slice(i, Math.min(i + 10, lines.length)).join("\n");
      if (!block.includes("take:") && !block.includes("take :")) {
        findings.push({
          ruleId: "PERF-002",
          category: "database",
          severity: "warning",
          status: "fail",
          title: "Unbounded query: findMany without take (limit)",
          detail: "Query can return unlimited rows, causing memory and performance issues",
          file: filePath,
          line: i + 1,
          recommendation: "Add 'take: N' to limit results. Implement pagination with cursor or skip/take",
        });
      }
    }

    // SQL without LIMIT
    if (/(?:SELECT|select).*(?:FROM|from)/i.test(line)) {
      const block = lines.slice(i, Math.min(i + 5, lines.length)).join("\n");
      if (!/LIMIT\s+\d/i.test(block) && !/\.findOne|\.findFirst|findUnique|\.first\(\)/.test(block)) {
        // Only flag SELECT queries that look like list queries
        if (/WHERE|where/.test(block) || !block.includes("=")) {
          findings.push({
            ruleId: "PERF-002",
            category: "database",
            severity: "warning",
            status: "fail",
            title: "Unbounded SQL query: missing LIMIT",
            detail: "SELECT query without LIMIT can return unlimited rows",
            file: filePath,
            line: i + 1,
            recommendation: "Add LIMIT clause. Implement pagination for list endpoints",
          });
        }
      }
    }
  }
}

function checkSelectAll(filePath: string, content: string, findings: Finding[], stack: string[]): void {
  // SELECT * in raw queries
  if (/SELECT\s+\*\s+FROM/i.test(content)) {
    const lines = content.split("\n");
    const lineNum = lines.findIndex((l) => /SELECT\s+\*\s+FROM/i.test(l));
    findings.push({
      ruleId: "PERF-003",
      category: "database",
      severity: "warning",
      status: "fail",
      title: "SELECT * detected — fetching all columns",
      detail: "Fetching all columns wastes memory and bandwidth when only a subset is needed",
      file: filePath,
      line: lineNum >= 0 ? lineNum + 1 : undefined,
      recommendation: "Explicitly SELECT only required columns, or use Prisma 'select' to restrict fields",
    });
  }
}

function checkMissingErrorBoundary(filePath: string, content: string, findings: Finding[], stack: string[]): void {
  if (!stack.includes("nextjs")) return;

  // Check for error.tsx in app directory route segments
  if (filePath.includes("app/") && filePath.endsWith("page.tsx")) {
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    const hasErrorBoundary = content.includes("error.tsx") || content.includes("ErrorBoundary");
    // We can't check sibling files from content alone, so flag as info
    // The API scoring engine will cross-reference file list
  }
}

function checkMissingErrorHandling(filePath: string, content: string, findings: Finding[]): void {
  // Check for async functions without try/catch
  const lines = content.split("\n");
  let asyncWithoutTryCatch = 0;

  for (let i = 0; i < lines.length; i++) {
    if (/async\s+(?:function|\w+)\s*\(/.test(lines[i]) || /=\s*async\s*\(/.test(lines[i])) {
      // Look ahead for try/catch in the function body
      const block = lines.slice(i, Math.min(i + 30, lines.length)).join("\n");
      if (!block.includes("try") && !block.includes("catch") && (block.includes("await") || block.includes("fetch"))) {
        asyncWithoutTryCatch++;
      }
    }
  }

  if (asyncWithoutTryCatch > 2) {
    findings.push({
      ruleId: "ERR-001",
      category: "error-handling",
      severity: "warning",
      status: "fail",
      title: `${asyncWithoutTryCatch} async functions without error handling`,
      detail: "Async functions with await/fetch calls but no try/catch blocks",
      file: filePath,
      recommendation: "Wrap async operations in try/catch with proper error handling and user feedback",
    });
  }
}

function checkEmptyCatchBlocks(filePath: string, content: string, findings: Finding[]): void {
  // Detect catch blocks with empty or minimal body
  const emptyCatchPattern = /catch\s*\([^)]*\)\s*\{\s*\}/g;
  const lines = content.split("\n");
  let count = 0;
  let firstLine = -1;

  const fullContent = content;
  let match;
  while ((match = emptyCatchPattern.exec(fullContent)) !== null) {
    count++;
    if (firstLine === -1) {
      const upToMatch = fullContent.substring(0, match.index);
      firstLine = upToMatch.split("\n").length;
    }
  }

  if (count > 0) {
    findings.push({
      ruleId: "ERR-002",
      category: "error-handling",
      severity: "blocker",
      status: "fail",
      title: `${count} empty catch block(s) — errors silently swallowed`,
      detail: "Empty catch blocks hide errors and make debugging impossible",
      file: filePath,
      line: firstLine,
      recommendation: "At minimum, log the error. Ideally, handle it properly or re-throw",
    });
  }
}

function checkUseEffectDataFetching(filePath: string, content: string, findings: Finding[], stack: string[]): void {
  if (!stack.includes("nextjs") && !stack.includes("react")) return;
  if (!filePath.endsWith(".tsx") && !filePath.endsWith(".jsx")) return;

  // Detect useEffect + fetch/axios without React Query/SWR
  if (/useEffect\s*\(/.test(content) && (/fetch\s*\(/.test(content) || /axios\./i.test(content))) {
    if (!/useQuery|useSWR|useMutation|createAsyncThunk/.test(content)) {
      const lines = content.split("\n");
      const lineNum = lines.findIndex((l) => /useEffect/.test(l));
      findings.push({
        ruleId: "PERF-004",
        category: "performance",
        severity: "warning",
        status: "fail",
        title: "useEffect used for data fetching without caching library",
        detail: "Raw useEffect + fetch leads to waterfalls, race conditions, and no caching",
        file: filePath,
        line: lineNum >= 0 ? lineNum + 1 : undefined,
        recommendation: stack.includes("nextjs")
          ? "Fetch data in Server Components, or use React Query/SWR for client-side data"
          : "Use React Query (TanStack Query) or SWR for server state management",
      });
    }
  }
}

function checkScrollViewForLists(filePath: string, content: string, findings: Finding[], stack: string[]): void {
  if (!stack.includes("react-native")) return;

  // ScrollView rendering mapped arrays
  if (/ScrollView/.test(content) && /\.map\s*\(/.test(content)) {
    const lines = content.split("\n");
    const lineNum = lines.findIndex((l) => /ScrollView/.test(l));
    findings.push({
      ruleId: "PERF-005",
      category: "performance",
      severity: "warning",
      status: "fail",
      title: "ScrollView used for dynamic list rendering",
      detail: "ScrollView renders ALL items at once, causing memory issues with large lists",
      file: filePath,
      line: lineNum >= 0 ? lineNum + 1 : undefined,
      recommendation: "Use FlatList or @shopify/flash-list for dynamic lists with getItemLayout and keyExtractor",
    });
  }
}

function checkMissingHealthEndpoint(ctx: ScanContext, findings: Finding[]): void {
  const isBackend = ctx.detectedStack.some((s) =>
    ["nestjs", "java-spring-boot", "python-fastapi", "python-django"].includes(s)
  );
  if (!isBackend) return;

  const hasHealth = ctx.files.some((f) =>
    f.content.includes("/health") || f.content.includes("/readiness") || f.content.includes("HealthCheck") || f.content.includes("@nestjs/terminus") || f.content.includes("actuator/health")
  );

  if (!hasHealth) {
    findings.push({
      ruleId: "OBS-001",
      category: "observability",
      severity: "warning",
      status: "fail",
      title: "No health check endpoint detected",
      detail: "Production services need /health and /readiness endpoints for orchestration",
      recommendation: "Add health check endpoints. NestJS: @nestjs/terminus, Spring: /actuator/health, FastAPI: dedicated route",
    });
  }
}

function checkMissingGlobalErrorHandler(ctx: ScanContext, findings: Finding[]): void {
  const hasGlobalHandler = ctx.files.some((f) => {
    if (ctx.detectedStack.includes("nestjs")) {
      return f.content.includes("ExceptionFilter") || f.content.includes("@Catch");
    }
    if (ctx.detectedStack.includes("java-spring-boot")) {
      return f.content.includes("@ControllerAdvice") || f.content.includes("@ExceptionHandler");
    }
    if (ctx.detectedStack.includes("python-fastapi")) {
      return f.content.includes("exception_handler") || f.content.includes("@app.exception_handler");
    }
    if (ctx.detectedStack.includes("nextjs")) {
      return f.relativePath.includes("error.tsx") || f.relativePath.includes("global-error.tsx");
    }
    return false;
  });

  if (!hasGlobalHandler && ctx.detectedStack.some((s) =>
    ["nestjs", "java-spring-boot", "python-fastapi", "nextjs"].includes(s)
  )) {
    findings.push({
      ruleId: "ERR-003",
      category: "error-handling",
      severity: "warning",
      status: "fail",
      title: "No global error handler detected",
      detail: "Without global error handling, unhandled errors leak stack traces and crash the app",
      recommendation: "Implement global exception handling with consistent error response schema",
    });
  }
}
