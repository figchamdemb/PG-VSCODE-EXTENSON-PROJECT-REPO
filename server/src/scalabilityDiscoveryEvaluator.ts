/**
 * Scalability Discovery Evaluator
 * Milestone 10N – Scalability architecture discovery gate.
 *
 * Server-private evaluator that checks feature/code submissions for
 * scalability anti-patterns and verifies that mandatory discovery
 * questions were addressed before architecture-affecting implementation.
 *
 * Consumed by the policy route; clients receive finding messages and
 * rule IDs, never the full private rule corpus.
 */

import type { ScalabilityThresholds } from "./policyVaultTypes";

// ── Types ───────────────────────────────────────────────────────────────

export type ScalabilityPatternCategory =
  | "real-time"
  | "background-jobs"
  | "inter-service"
  | "state-management"
  | "proxy-config";

export interface ScalabilityDiscoveryRequest {
  /** Code snippet or feature description to evaluate. */
  content?: string;
  /** Optional structured discovery answers (keys = question_id). */
  discovery_answers?: Record<string, string>;
  /** Optional list of file paths being touched (for context heuristics). */
  file_paths?: string[];
  /** Source label for audit trail. */
  source?: string;
}

type FindingSeverity = "warning" | "blocker";

interface ScalabilityRule {
  id: string;
  severity: FindingSeverity;
  score: number;
  pattern: RegExp;
  category: ScalabilityPatternCategory;
  message: string;
  hint: string;
}

export interface ScalabilityFinding {
  rule_id: string;
  severity: FindingSeverity;
  score: number;
  category: ScalabilityPatternCategory;
  message: string;
  hint: string;
}

export interface ScalabilityEvaluationResult {
  ok: boolean;
  evaluator_version: "scalability-v1";
  status: "pass" | "warn" | "blocked";
  risk_score: number;
  discovery_complete: boolean;
  summary: {
    source: string;
    findings_count: number;
    categories_affected: ScalabilityPatternCategory[];
    discovery_answered: number;
    discovery_required: number;
    evaluated_at: string;
  };
  findings: ScalabilityFinding[];
  /** Discovery questions that were not addressed (if any). */
  missing_discovery: string[];
}

// ── Discovery questions (Section 0 of the guide) ────────────────────────

interface DiscoveryQuestion {
  id: string;
  question: string;
  required_when: ScalabilityPatternCategory[];
}

const DISCOVERY_QUESTIONS: DiscoveryQuestion[] = [
  {
    id: "concurrency",
    question: "How many concurrent users do you expect at launch, and what is your growth target in 12 months?",
    required_when: ["real-time", "background-jobs", "inter-service", "state-management"]
  },
  {
    id: "direction",
    question: "Does the client need to SEND data back in the same real-time channel, or just RECEIVE updates?",
    required_when: ["real-time"]
  },
  {
    id: "latency",
    question: "How time-sensitive are updates? (sub-second, seconds, minutes, hours)",
    required_when: ["real-time", "background-jobs"]
  },
  {
    id: "async_need",
    question: "Does this task run in the background where the user needs notification when done?",
    required_when: ["background-jobs"]
  },
  {
    id: "framework",
    question: "What language and framework is this project using?",
    required_when: ["real-time", "background-jobs", "inter-service", "proxy-config"]
  },
  {
    id: "existing_infra",
    question: "Is this a new project, or are we adding to existing infrastructure?",
    required_when: ["real-time", "background-jobs", "inter-service", "state-management", "proxy-config"]
  }
];

// ── Anti-pattern rules (server-private) ─────────────────────────────────

const SCALABILITY_RULES: ScalabilityRule[] = [
  // Real-time anti-patterns
  {
    id: "SCALE-RT-001",
    severity: "blocker",
    score: 80,
    pattern: /\bsetInterval\s*\(\s*(?:\(\)|function)?\s*(?:=>|{)?\s*[\s\S]{0,200}\bfetch\b/i,
    category: "real-time",
    message: "Polling via setInterval+fetch detected — catastrophic at scale.",
    hint: "Replace with Server-Sent Events (SSE) for server→client or WebSockets for bidirectional."
  },
  {
    id: "SCALE-RT-002",
    severity: "blocker",
    score: 75,
    pattern: /\bsetInterval\s*\(\s*(?:\(\)|function)?\s*(?:=>|{)?\s*[\s\S]{0,200}(?:axios|got|ky|superagent|\$fetch|ofetch)\b/i,
    category: "real-time",
    message: "Polling via setInterval with HTTP client detected.",
    hint: "Use SSE or WebSockets instead of periodic HTTP polling for real-time updates."
  },
  {
    id: "SCALE-RT-003",
    severity: "warning",
    score: 40,
    pattern: /\bsetTimeout\s*\(\s*(?:\(\)|function)?\s*(?:=>|{)?\s*[\s\S]{0,300}\bsetTimeout\b/i,
    category: "real-time",
    message: "Recursive setTimeout pattern may indicate manual poll/retry loop.",
    hint: "Consider event-driven patterns (SSE, WebSockets, message queue) instead of recursive timeouts."
  },
  {
    id: "SCALE-RT-004",
    severity: "warning",
    score: 35,
    pattern: /\bnew\s+WebSocket\b(?![\s\S]{0,500}\breconnect|onerror|onclose[\s\S]{0,200}(?:new\s+WebSocket|connect|retry))/i,
    category: "real-time",
    message: "WebSocket instantiation without visible reconnection logic.",
    hint: "Always implement reconnection with exponential backoff for WebSocket connections."
  },

  // Background job anti-patterns
  {
    id: "SCALE-BG-001",
    severity: "blocker",
    score: 70,
    pattern: /\bawait\b[\s\S]{0,200}\b(?:sendEmail|sendMail|sendSMS|sendNotification|processPayment|generatePdf|generateReport)\b[\s\S]{0,100}\b(?:res\.|reply\.|response\.)\b/i,
    category: "background-jobs",
    message: "Long-running operation awaited in request handler blocks the response.",
    hint: "Offload heavy work to a background job queue (BullMQ, RabbitMQ, Celery) and return 202 Accepted."
  },
  {
    id: "SCALE-BG-002",
    severity: "warning",
    score: 45,
    pattern: /\b(?:setTimeout|setImmediate|process\.nextTick)\s*\(\s*(?:\(\)|function|async)?\s*(?:=>|{)?\s*[\s\S]{0,300}\b(?:sendEmail|sendMail|sendSMS|upload|process|generate)\b/i,
    category: "background-jobs",
    message: "Background work via setTimeout/setImmediate loses job on crash and has no retry.",
    hint: "Use a durable message queue with retry/dead-letter for production background jobs."
  },
  {
    id: "SCALE-BG-003",
    severity: "warning",
    score: 30,
    pattern: /\bfor\s*\([\s\S]{0,100}\)\s*\{[\s\S]{0,400}\bawait\b[\s\S]{0,200}\b(?:fetch|axios|got|request|http)\b/i,
    category: "background-jobs",
    message: "Sequential await in loop with HTTP calls — O(n) latency and connection churn.",
    hint: "Use Promise.allSettled or batch API calls. For large batches use a job queue with worker parallelism."
  },

  // Inter-service communication anti-patterns
  {
    id: "SCALE-IPC-001",
    severity: "warning",
    score: 40,
    pattern: /\b(?:fetch|axios|got|http\.request)\b[\s\S]{0,200}\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0)\b[\s\S]{0,100}\b(?:fetch|axios|got|http\.request)\b/i,
    category: "inter-service",
    message: "Multiple hardcoded localhost service calls in same scope — tight coupling risk.",
    hint: "Use service discovery, config-driven endpoints, or a message bus for inter-service calls."
  },
  {
    id: "SCALE-IPC-002",
    severity: "warning",
    score: 35,
    pattern: /\b(?:fetch|axios|got)\b[\s\S]{0,200}\b(?:fetch|axios|got)\b[\s\S]{0,200}\b(?:fetch|axios|got)\b/i,
    category: "inter-service",
    message: "Chain of 3+ synchronous remote calls in one handler — cascade failure risk.",
    hint: "Use circuit breakers, parallel requests where independent, or saga/orchestration patterns."
  },

  // State management anti-patterns
  {
    id: "SCALE-STATE-001",
    severity: "blocker",
    score: 65,
    pattern: /\b(?:global|module)\b[\s\S]{0,100}\b(?:sessions|users|connections|cache|state)\b\s*(?:=|:)\s*(?:new\s+(?:Map|Set|WeakMap)|{}|\[\])/i,
    category: "state-management",
    message: "In-memory global state for sessions/cache — lost on restart, no horizontal scaling.",
    hint: "Use Redis/Memcached for shared state, or externalize sessions to a session store."
  },
  {
    id: "SCALE-STATE-002",
    severity: "warning",
    score: 40,
    pattern: /\bconst\s+\w+\s*=\s*new\s+Map\s*<[\s\S]{0,100}>[\s\S]{0,200}(?:\.set\(|\.get\()/i,
    category: "state-management",
    message: "Module-level Map used as cache — consider bounded size and TTL.",
    hint: "Add max-size eviction and TTL or use a shared cache layer (Redis) for production."
  },

  // Proxy/server config anti-patterns
  {
    id: "SCALE-PROXY-001",
    severity: "warning",
    score: 30,
    pattern: /\b(?:app|server)\s*\.\s*listen\s*\(\s*(?:3000|8080|8000|80)\s*[,)]/i,
    category: "proxy-config",
    message: "Direct port listen without reverse proxy consideration.",
    hint: "In production, place Nginx/Caddy in front for TLS termination, connection limits, and static file serving."
  }
];

// ── Evaluator ───────────────────────────────────────────────────────────

export function evaluateScalabilityDiscovery(
  requestBody: ScalabilityDiscoveryRequest,
  thresholds?: ScalabilityThresholds | null
): ScalabilityEvaluationResult {
  const content = normalizeContent(requestBody.content);
  const source = normalizeSource(requestBody.source);
  const filePaths = requestBody.file_paths ?? [];
  const answers = requestBody.discovery_answers ?? {};

  if (!content && filePaths.length === 0) {
    return createPassResult(source);
  }

  // 1. Detect which categories are affected
  const detectedCategories = detectCategories(content, filePaths);

  // 2. Run anti-pattern rules against content
  const findings = collectFindings(content, thresholds);

  // 3. Merge category detections from findings
  for (const f of findings) {
    if (!detectedCategories.has(f.category)) {
      detectedCategories.add(f.category);
    }
  }

  // 4. Check discovery completeness
  const { answeredCount, requiredCount, missing } = checkDiscoveryCompleteness(
    answers, detectedCategories
  );

  // 5. If discovery is incomplete for affected categories, add finding
  if (missing.length > 0 && detectedCategories.size > 0) {
    const severity: FindingSeverity = (thresholds?.discovery_block_if_missing ?? true)
      ? "blocker"
      : "warning";
    findings.push({
      rule_id: "SCALE-DISC-001",
      severity,
      score: severity === "blocker" ? 60 : 30,
      category: [...detectedCategories][0],
      message: `${missing.length} mandatory discovery question(s) not addressed for affected categories.`,
      hint: `Answer discovery questions before implementing: ${missing.join(", ")}`
    });
  }

  const riskScore = computeRiskScore(findings);
  const discoveryComplete = missing.length === 0;
  const categoriesAffected = [...detectedCategories] as ScalabilityPatternCategory[];

  return buildResult(
    source, findings, riskScore, discoveryComplete,
    answeredCount, requiredCount, categoriesAffected, missing,
    thresholds
  );
}

// ── Internals ───────────────────────────────────────────────────────────

function normalizeContent(v: string | undefined): string {
  return (v ?? "").trim();
}

function normalizeSource(v: string | undefined): string {
  const s = (v ?? "").trim().toLowerCase();
  return s || "unknown";
}

function createPassResult(source: string): ScalabilityEvaluationResult {
  return {
    ok: true,
    evaluator_version: "scalability-v1",
    status: "pass",
    risk_score: 0,
    discovery_complete: true,
    summary: {
      source,
      findings_count: 0,
      categories_affected: [],
      discovery_answered: 0,
      discovery_required: 0,
      evaluated_at: new Date().toISOString()
    },
    findings: [],
    missing_discovery: []
  };
}

/** Heuristic detection of scalability-sensitive categories from content. */
function detectCategories(content: string, filePaths: string[]): Set<ScalabilityPatternCategory> {
  const cats = new Set<ScalabilityPatternCategory>();
  const combined = content + " " + filePaths.join(" ");
  const lower = combined.toLowerCase();

  if (/websocket|socket\.io|ws:\/\/|wss:\/\/|eventsource|server-sent|sse|real.?time|live.?update|notification.?stream/i.test(lower)) {
    cats.add("real-time");
  }
  if (/background.?job|queue|worker|bull|rabbitmq|celery|async.?task|cron|schedule|process.*background/i.test(lower)) {
    cats.add("background-jobs");
  }
  if (/micro.?service|grpc|message.?bus|event.?bus|service.?mesh|inter.?service|rpc/i.test(lower)) {
    cats.add("inter-service");
  }
  if (/session.?store|shared.?state|redis|memcache|distributed.?cache|horizontal.?scal/i.test(lower)) {
    cats.add("state-management");
  }
  if (/nginx|caddy|reverse.?proxy|load.?balance|upstream|ingress/i.test(lower)) {
    cats.add("proxy-config");
  }

  return cats;
}

function collectFindings(content: string, thresholds?: ScalabilityThresholds | null): ScalabilityFinding[] {
  if (!content) return [];

  const maxFindings = thresholds?.max_findings ?? 30;
  const downgradeRules = new Set(thresholds?.downgrade_to_warning ?? []);
  const findings: ScalabilityFinding[] = [];

  for (const rule of SCALABILITY_RULES) {
    if (findings.length >= maxFindings) break;
    if (!rule.pattern.test(content)) continue;

    const severity: FindingSeverity = downgradeRules.has(rule.id) ? "warning" : rule.severity;
    findings.push({
      rule_id: rule.id,
      severity,
      score: severity !== rule.severity ? Math.min(rule.score, 30) : rule.score,
      category: rule.category,
      message: rule.message,
      hint: rule.hint
    });
  }

  return findings;
}

function checkDiscoveryCompleteness(
  answers: Record<string, string>,
  affectedCategories: Set<ScalabilityPatternCategory>
): { answeredCount: number; requiredCount: number; missing: string[] } {
  if (affectedCategories.size === 0) {
    return { answeredCount: 0, requiredCount: 0, missing: [] };
  }

  const required = DISCOVERY_QUESTIONS.filter((q) =>
    q.required_when.some((cat) => affectedCategories.has(cat))
  );

  const missing: string[] = [];
  let answered = 0;

  for (const q of required) {
    const answer = answers[q.id];
    if (answer && answer.trim().length > 0) {
      answered++;
    } else {
      missing.push(q.id);
    }
  }

  return { answeredCount: answered, requiredCount: required.length, missing };
}

function computeRiskScore(findings: ScalabilityFinding[]): number {
  return findings.reduce((sum, f) => sum + f.score, 0);
}

function buildResult(
  source: string,
  findings: ScalabilityFinding[],
  riskScore: number,
  discoveryComplete: boolean,
  answeredCount: number,
  requiredCount: number,
  categories: ScalabilityPatternCategory[],
  missing: string[],
  thresholds?: ScalabilityThresholds | null
): ScalabilityEvaluationResult {
  const status = resolveStatus(riskScore, findings, thresholds);
  return {
    ok: status !== "blocked",
    evaluator_version: "scalability-v1",
    status,
    risk_score: riskScore,
    discovery_complete: discoveryComplete,
    summary: {
      source,
      findings_count: findings.length,
      categories_affected: categories,
      discovery_answered: answeredCount,
      discovery_required: requiredCount,
      evaluated_at: new Date().toISOString()
    },
    findings,
    missing_discovery: missing
  };
}

function resolveStatus(
  riskScore: number,
  findings: ScalabilityFinding[],
  thresholds?: ScalabilityThresholds | null
): "pass" | "warn" | "blocked" {
  const blockerThreshold = thresholds?.blocker_score_threshold ?? 70;

  if (riskScore >= 150) return "blocked";
  if (findings.some((f) => f.severity === "blocker" && f.score >= blockerThreshold)) {
    return "blocked";
  }
  if (riskScore >= 30 || findings.length > 0) return "warn";
  return "pass";
}

/** Returns the list of discovery questions for API consumers. */
export function getDiscoveryQuestions(): Array<{ id: string; question: string; categories: string[] }> {
  return DISCOVERY_QUESTIONS.map((q) => ({
    id: q.id,
    question: q.question,
    categories: [...q.required_when]
  }));
}
