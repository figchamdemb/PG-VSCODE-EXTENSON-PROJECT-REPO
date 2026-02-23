import { PlanTier } from "./types";

export interface PlanRule {
  device_limit: number;
  projects_allowed_memorybank: number;
  can_export: boolean;
  can_change_report: boolean;
}

export const PLAN_RULES: Record<PlanTier, PlanRule> = {
  free: {
    device_limit: 1,
    projects_allowed_memorybank: 0,
    can_export: false,
    can_change_report: false
  },
  trial: {
    device_limit: 1,
    projects_allowed_memorybank: 0,
    can_export: false,
    can_change_report: false
  },
  pro: {
    device_limit: 3,
    projects_allowed_memorybank: 20,
    can_export: true,
    can_change_report: true
  },
  team: {
    device_limit: 10,
    projects_allowed_memorybank: 200,
    can_export: true,
    can_change_report: true
  },
  enterprise: {
    device_limit: 50,
    projects_allowed_memorybank: 2000,
    can_export: true,
    can_change_report: true
  }
};
