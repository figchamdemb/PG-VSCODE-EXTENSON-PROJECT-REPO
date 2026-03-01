/**
 * rules.ts — Backward-compatible re-export of PLAN_RULES.
 *
 * The canonical source is now entitlementMatrix.ts (Milestone 13B).
 * This file re-exports the legacy PlanRule shape so existing callers
 * (entitlementHelpers, etc.) continue to compile unchanged.
 */

export { PlanRule, PLAN_RULES } from "./entitlementMatrix";

