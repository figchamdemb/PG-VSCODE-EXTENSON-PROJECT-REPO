export type PlanTier = "free" | "trial" | "pro" | "team" | "enterprise";
export type PaidPlanTier = Exclude<PlanTier, "trial" | "free">;
export type ModuleScope = "narrate" | "memorybank" | "bundle";

export interface UserRecord {
  id: string;
  email: string;
  created_at: string;
  last_login_at: string;
}

export interface AuthChallengeRecord {
  id: string;
  email: string;
  code: string;
  expires_at: string;
  created_at: string;
}

export interface SessionRecord {
  token: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export type SubscriptionStatus = "active" | "expired" | "revoked" | "refunded";

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  plan_id: PaidPlanTier;
  team_id: string | null;
  status: SubscriptionStatus;
  starts_at: string;
  ends_at: string;
  revoked_at: string | null;
  refund_window_ends_at: string;
  source: "stripe" | "offline" | "manual";
  created_at: string;
}

export interface ProductEntitlementRecord {
  id: string;
  user_id: string;
  narrate_enabled: boolean;
  memorybank_enabled: boolean;
  bundle_enabled: boolean;
  starts_at: string;
  ends_at: string;
  status: SubscriptionStatus;
  created_at: string;
}

export interface ProjectQuotaRecord {
  id: string;
  user_id: string;
  scope: "memorybank";
  period_start: string;
  period_end: string;
  projects_allowed: number;
  projects_used: number;
  updated_at: string;
}

export interface ProjectActivationRecord {
  id: string;
  user_id: string;
  scope: "memorybank";
  repo_fingerprint: string;
  repo_label: string | null;
  first_activated_at: string;
  last_seen_at: string;
}

export interface DeviceRecord {
  id: string;
  user_id: string;
  install_id: string;
  device_label: string | null;
  last_seen_at: string;
  revoked_at: string | null;
}

export interface TrialRecord {
  user_id: string;
  trial_started_at: string;
  trial_expires_at: string;
}

export interface RefundRequestRecord {
  id: string;
  user_id: string;
  subscription_id: string;
  requested_at: string;
  status: "requested" | "approved" | "rejected";
  approved_at: string | null;
  reason: string | null;
}

export interface OfflinePaymentRefRecord {
  id: string;
  email: string;
  ref_code: string;
  amount_cents: number;
  plan_id: PaidPlanTier;
  module_scope: ModuleScope;
  years: number;
  proof_url: string | null;
  status: "pending" | "submitted" | "approved" | "rejected";
  expires_at: string;
  created_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  redeem_code: string | null;
}

export interface RedeemCodeRecord {
  id: string;
  code: string;
  email: string;
  plan_id: PaidPlanTier;
  module_scope: ModuleScope;
  years: number;
  status: "unused" | "used" | "revoked";
  source: "offline" | "admin";
  created_at: string;
  used_at: string | null;
  used_by_user_id: string | null;
  revoked_at: string | null;
}

export interface StripeEventRecord {
  id: string;
  event_id: string;
  event_type: string;
  created_at: string;
}

export interface AffiliateCodeRecord {
  id: string;
  user_id: string;
  code: string;
  commission_rate_bps: number;
  status: "active" | "paused";
  created_at: string;
}

export type AffiliateConversionStatus =
  | "clicked"
  | "registered"
  | "paid_confirmed"
  | "refunded";

export interface AffiliateConversionRecord {
  id: string;
  affiliate_user_id: string;
  buyer_user_id: string | null;
  ref_code: string;
  status: AffiliateConversionStatus;
  order_id: string | null;
  gross_amount_cents: number;
  commission_amount_cents: number;
  confirmed_at: string | null;
  created_at: string;
  payout_id: string | null;
}

export interface AffiliatePayoutRecord {
  id: string;
  affiliate_user_id: string;
  period_start: string;
  period_end: string;
  amount_cents: number;
  status: "pending" | "approved" | "paid" | "rejected";
  payout_reference: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface ProviderPolicy {
  local_only: boolean;
  byo_allowed: boolean;
  allowlist: string[];
  denylist: string[];
}

export interface ProviderPolicyRecord {
  id: string;
  scope_type: "user" | "team";
  scope_id: string;
  local_only: boolean;
  byo_allowed: boolean;
  allowlist: string[];
  denylist: string[];
  created_at: string;
  updated_at: string;
}

export interface OAuthStateRecord {
  id: string;
  state: string;
  provider: "github" | "google";
  install_id: string | null;
  callback_url: string | null;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
}

export interface TeamRecord {
  id: string;
  team_key: string;
  owner_user_id: string;
  plan_id: "team" | "enterprise";
  module_scope: ModuleScope;
  seat_limit: number;
  created_at: string;
}

export interface TeamMembershipRecord {
  id: string;
  team_id: string;
  user_id: string;
  role: "owner" | "manager" | "member";
  status: "active" | "revoked";
  invited_email: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface SupportTicketRecord {
  id: string;
  user_id: string;
  email: string;
  category: "support" | "billing" | "bug" | "feature";
  severity: "low" | "medium" | "high";
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackEntryRecord {
  id: string;
  user_id: string;
  email: string;
  rating: 1 | 2 | 3 | 4 | 5;
  message: string | null;
  created_at: string;
}

export interface GovernanceEodReportRecord {
  id: string;
  user_id: string;
  email: string;
  team_id: string | null;
  title: string;
  summary: string;
  work_started_at: string | null;
  work_ended_at: string | null;
  changed_files: string[];
  blockers: string[];
  source: "agent" | "human";
  agent_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface GovernanceSettingsRecord {
  id: string;
  scope_type: "user" | "team";
  scope_id: string;
  slack_enabled: boolean;
  slack_addon_active: boolean;
  slack_channel: string | null;
  vote_mode: "majority" | "single_reviewer";
  max_debate_chars: number;
  retention_days: number;
  created_at: string;
  updated_at: string;
}

export interface MastermindThreadRecord {
  id: string;
  team_id: string | null;
  created_by_user_id: string;
  created_by_email: string;
  title: string;
  question: string;
  status: "open" | "decided" | "closed";
  vote_mode: "majority" | "single_reviewer";
  decision: "approve" | "reject" | "needs_change" | null;
  decision_option_key: string | null;
  decision_note: string | null;
  decided_by_user_id: string | null;
  decided_by_email: string | null;
  decided_at: string | null;
  last_activity_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface MastermindOptionRecord {
  id: string;
  thread_id: string;
  option_key: string;
  title: string;
  rationale: string | null;
  created_at: string;
}

export interface MastermindEntryRecord {
  id: string;
  thread_id: string;
  user_id: string;
  email: string;
  entry_type: "argument" | "suggestion" | "review";
  message: string;
  created_at: string;
}

export interface MastermindVoteRecord {
  id: string;
  thread_id: string;
  option_key: string;
  user_id: string;
  email: string;
  weight: number;
  rationale: string | null;
  created_at: string;
  updated_at: string;
}

export interface MastermindOutcomeRecord {
  id: string;
  thread_id: string;
  team_id: string | null;
  title: string;
  decision: "approve" | "reject" | "needs_change";
  winning_option_key: string | null;
  decision_note: string | null;
  decided_by_email: string | null;
  decided_at: string;
  created_at: string;
}

export interface GovernanceDecisionEventRecord {
  id: string;
  sequence: number;
  event_type: "decision_finalized";
  thread_id: string;
  team_id: string | null;
  decision: "approve" | "reject" | "needs_change";
  winning_option_key: string | null;
  summary: string;
  created_at: string;
  expires_at: string;
}

export interface GovernanceDecisionAckRecord {
  id: string;
  event_id: string;
  user_id: string;
  status: "pending" | "applied" | "conflict" | "skipped";
  note: string | null;
  updated_at: string;
  acked_at: string | null;
}

export interface PolicyTenantOverlayRecord {
  id: string;
  scope_type: "user" | "team";
  scope_id: string;
  plan: PlanTier;
  overrides: Record<string, Record<string, unknown>>;
  updated_at: string;
  created_at: string;
}

export type EnforcementPhase = "start-session" | "post-write" | "pre-push" | "prompt-guard";
export type EnforcementStatus = "pass" | "warn" | "blocked" | "error";

export interface EnforcementAuditRecord {
  id: string;
  user_id: string;
  phase: EnforcementPhase;
  status: EnforcementStatus;
  risk_score: number;
  blocker_count: number;
  warning_count: number;
  checks_run: string[];
  findings_summary: string;
  source: string;
  created_at: string;
}

export type ReviewerAssignmentMode = "round_robin" | "all";

export interface ReviewerAutomationPolicyRecord {
  id: string;
  scope_type: "user" | "team";
  scope_id: string;
  enabled: boolean;
  reviewer_emails: string[];
  required_approvals: number;
  sla_hours: number;
  escalation_email: string | null;
  assignment_mode: ReviewerAssignmentMode;
  last_assigned_index: number;
  created_at: string;
  updated_at: string;
}

export interface ServerKeySet {
  alg: "ES256";
  private_key_pem: string;
  public_key_pem: string;
}

export interface StoreState {
  users: UserRecord[];
  auth_challenges: AuthChallengeRecord[];
  sessions: SessionRecord[];
  subscriptions: SubscriptionRecord[];
  product_entitlements: ProductEntitlementRecord[];
  project_quotas: ProjectQuotaRecord[];
  project_activations: ProjectActivationRecord[];
  devices: DeviceRecord[];
  trials: TrialRecord[];
  refund_requests: RefundRequestRecord[];
  offline_payment_refs: OfflinePaymentRefRecord[];
  redeem_codes: RedeemCodeRecord[];
  stripe_events: StripeEventRecord[];
  affiliate_codes: AffiliateCodeRecord[];
  affiliate_conversions: AffiliateConversionRecord[];
  affiliate_payouts: AffiliatePayoutRecord[];
  provider_policies: ProviderPolicyRecord[];
  oauth_states: OAuthStateRecord[];
  teams: TeamRecord[];
  team_memberships: TeamMembershipRecord[];
  support_tickets: SupportTicketRecord[];
  feedback_entries: FeedbackEntryRecord[];
  governance_settings: GovernanceSettingsRecord[];
  governance_eod_reports: GovernanceEodReportRecord[];
  mastermind_threads: MastermindThreadRecord[];
  mastermind_options: MastermindOptionRecord[];
  mastermind_entries: MastermindEntryRecord[];
  mastermind_votes: MastermindVoteRecord[];
  mastermind_outcomes: MastermindOutcomeRecord[];
  governance_decision_events: GovernanceDecisionEventRecord[];
  governance_decision_acks: GovernanceDecisionAckRecord[];
  policy_tenant_overlays: PolicyTenantOverlayRecord[];
  enforcement_audit_log: EnforcementAuditRecord[];
  reviewer_automation_policies: ReviewerAutomationPolicyRecord[];
  keys: ServerKeySet;
  updated_at: string;
}
