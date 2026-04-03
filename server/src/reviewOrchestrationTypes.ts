export interface ReviewWorkflowRecord {
  id: string;
  user_id: string;
  repo_key: string;
  project_root: string;
  state: Record<string, unknown>;
  current_lease_id: string | null;
  current_lease_expires_at: string | null;
  last_sync_action: string;
  last_actor_role: "builder" | "reviewer" | null;
  last_page_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewWorkflowAuditRecord {
  id: string;
  workflow_id: string;
  user_id: string;
  repo_key: string;
  action: string;
  actor_role: "builder" | "reviewer" | null;
  page_id: string | null;
  outcome_status: string;
  summary: string;
  created_at: string;
}