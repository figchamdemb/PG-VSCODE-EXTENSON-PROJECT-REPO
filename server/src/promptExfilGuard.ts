type GuardSeverity = "warning" | "blocker";
import type { PromptGuardThresholds } from "./policyVaultTypes";

type GuardRule = {
  id: string;
  severity: GuardSeverity;
  score: number;
  pattern: RegExp;
  message: string;
  hint: string;
};

const PROMPT_GUARD_RULES: GuardRule[] = [
  {
    id: "PRM-EXFIL-001",
    severity: "blocker",
    score: 90,
    pattern: /\b(show|reveal|dump|print|expose)\b[\s\S]{0,80}\b(system prompt|hidden rule|private policy|internal policy|secret prompt)\b/i,
    message: "Prompt requests disclosure of private policy/system instructions.",
    hint: "Do not expose private policy internals. Provide only allowed high-level guidance."
  },
  {
    id: "PRM-EXFIL-002",
    severity: "blocker",
    score: 85,
    pattern: /\b(ignore|bypass|override|disable)\b[\s\S]{0,80}\b(previous|above|all)\b[\s\S]{0,80}\b(instruction|rule|policy|guardrail)\b/i,
    message: "Prompt attempts to bypass enforcement instructions.",
    hint: "Enforcement bypass requests must be denied and audited."
  },
  {
    id: "PRM-EXFIL-003",
    severity: "warning",
    score: 60,
    pattern: /\b(base64|rot13|unicode|emoji)\b[\s\S]{0,120}\b(decode|encode|obfuscat|hidden)\b/i,
    message: "Prompt contains obfuscation language associated with policy extraction attempts.",
    hint: "Treat obfuscated extraction requests as suspicious and require clarification."
  },
  {
    id: "PRM-EXFIL-004",
    severity: "warning",
    score: 55,
    pattern: /\b(jailbreak|developer mode|god mode|unfiltered|no restrictions)\b/i,
    message: "Prompt contains jailbreak-style instruction markers.",
    hint: "Reject jailbreak instructions and continue with policy-safe handling."
  },
  {
    id: "PRM-EXFIL-005",
    severity: "warning",
    score: 50,
    pattern: /\b(policy|rule)\b[\s\S]{0,120}\b(file|path|raw|full text|exact content)\b/i,
    message: "Prompt asks for raw policy/rule corpus content.",
    hint: "Return abstract rule outcomes, not full private policy documents."
  }
];

export interface PromptGuardRequest {
  prompt?: string;
  source?: string;
  context?: string;
}

export interface PromptGuardFlag {
  rule_id: string;
  severity: GuardSeverity;
  score: number;
  message: string;
  hint: string;
}

export interface PromptGuardResult {
  ok: boolean;
  evaluator_version: "prompt-guard-v1";
  status: "allow" | "warn" | "blocked";
  risk_score: number;
  summary: {
    source: string;
    matched_rules: number;
    evaluated_at: string;
  };
  flags: PromptGuardFlag[];
}

export function evaluatePromptGuard(requestBody: PromptGuardRequest, thresholds?: PromptGuardThresholds | null): PromptGuardResult {
  const prompt = normalizePrompt(requestBody.prompt);
  const source = normalizeSource(requestBody.source);
  if (!prompt) {
    return createAllowResult(source);
  }

  const flags = collectRuleFlags(prompt);
  const riskScore = computeRiskScore(flags);
  return buildGuardResult({ source, flags, riskScore, blockerThreshold: thresholds?.blocker_score_threshold });
}

function normalizePrompt(prompt: string | undefined): string {
  if (!prompt) {
    return "";
  }
  return prompt.trim();
}

function normalizeSource(source: string | undefined): string {
  if (!source) {
    return "unknown";
  }
  const value = source.trim().toLowerCase();
  return value || "unknown";
}

function createAllowResult(source: string): PromptGuardResult {
  return {
    ok: true,
    evaluator_version: "prompt-guard-v1",
    status: "allow",
    risk_score: 0,
    summary: {
      source,
      matched_rules: 0,
      evaluated_at: new Date().toISOString()
    },
    flags: []
  };
}

function collectRuleFlags(prompt: string): PromptGuardFlag[] {
  const flags = PROMPT_GUARD_RULES.flatMap((rule) => toPromptGuardFlag(rule, prompt));
  appendNoisyPromptFlag(flags, prompt);
  return flags;
}

function toPromptGuardFlag(rule: GuardRule, prompt: string): PromptGuardFlag[] {
  if (!rule.pattern.test(prompt)) {
    return [];
  }
  return [
    {
      rule_id: rule.id,
      severity: rule.severity,
      score: rule.score,
      message: rule.message,
      hint: rule.hint
    }
  ];
}

function appendNoisyPromptFlag(flags: PromptGuardFlag[], prompt: string): void {
  if (computeNoisyCharacterRatio(prompt) < 0.25) {
    return;
  }
  flags.push({
    rule_id: "PRM-EXFIL-006",
    severity: "warning",
    score: 35,
    message: "Prompt appears heavily obfuscated by symbol/emoji density.",
    hint: "Require plain-language restatement and keep policy protections active."
  });
}

function computeRiskScore(flags: PromptGuardFlag[]): number {
  return flags.reduce((total, flag) => total + flag.score, 0);
}

function buildGuardResult(opts: { source: string; flags: PromptGuardFlag[]; riskScore: number; blockerThreshold?: number }): PromptGuardResult {
  const status = resolveStatus(opts.riskScore, opts.flags, opts.blockerThreshold);
  return {
    ok: status !== "blocked",
    evaluator_version: "prompt-guard-v1",
    status,
    risk_score: opts.riskScore,
    summary: {
      source: opts.source,
      matched_rules: opts.flags.length,
      evaluated_at: new Date().toISOString()
    },
    flags: opts.flags
  };
}

function computeNoisyCharacterRatio(prompt: string): number {
  if (!prompt) {
    return 0;
  }
  let noisy = 0;
  let total = 0;
  for (const char of prompt) {
    if (/\s/.test(char)) {
      continue;
    }
    total += 1;
    if (/[^A-Za-z0-9.,:;!?'"()\[\]{}\-_/\\]/.test(char)) {
      noisy += 1;
    }
  }
  if (total === 0) {
    return 0;
  }
  return noisy / total;
}

function resolveStatus(riskScore: number, flags: PromptGuardFlag[], blockerThreshold?: number): "allow" | "warn" | "blocked" {
  if (riskScore >= 100) {
    return "blocked";
  }
  if (flags.some((flag) => flag.severity === "blocker" && flag.score >= (blockerThreshold ?? 85))) {
    return "blocked";
  }
  if (riskScore >= 50 || flags.length > 0) {
    return "warn";
  }
  return "allow";
}
