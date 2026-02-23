export type PlanTier = "free" | "trial" | "pro" | "team" | "enterprise";

export function isProOrHigher(plan: PlanTier): boolean {
  return plan === "pro" || plan === "team" || plan === "enterprise";
}

export function normalizePlan(raw: string | undefined): PlanTier {
  if (!raw) {
    return "free";
  }
  const lowered = raw.toLowerCase().trim();
  if (
    lowered === "free" ||
    lowered === "trial" ||
    lowered === "pro" ||
    lowered === "team" ||
    lowered === "enterprise"
  ) {
    return lowered;
  }
  return "free";
}

export function formatPlanLabel(plan: PlanTier): string {
  return plan.toUpperCase();
}
