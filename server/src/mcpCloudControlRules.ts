export type McpCloudControlRule = {
  key: string;
  ruleId: string;
  message: string;
  hint: string;
  regulatedCritical: boolean;
  standardRecommended: boolean;
};

export const CONTROL_RULES: McpCloudControlRule[] = [
  {
    key: "cloudflare_tunnel_enabled",
    ruleId: "CLD-NET-001",
    message: "Cloudflare Tunnel control is not confirmed.",
    hint: "Enable Cloudflare Tunnel so origin IP stays hidden behind edge protection.",
    regulatedCritical: true,
    standardRecommended: true
  },
  {
    key: "cloudflare_full_strict_tls",
    ruleId: "CLD-ENC-001",
    message: "Cloudflare SSL mode Full (Strict) is not confirmed.",
    hint: "Set SSL/TLS mode to Full (Strict) and enforce TLS 1.2+ with HSTS.",
    regulatedCritical: true,
    standardRecommended: true
  },
  {
    key: "ec2_private_subnet_only",
    ruleId: "CLD-NET-002",
    message: "EC2 private-subnet-only control is not confirmed.",
    hint: "Run application servers without public IP and allow ingress only from ALB security group.",
    regulatedCritical: true,
    standardRecommended: false
  },
  {
    key: "db_public_access_disabled",
    ruleId: "CLD-NET-003",
    message: "Database private-only access is not confirmed.",
    hint: "Block public DB access and allow PostgreSQL only through the private tunnel path.",
    regulatedCritical: true,
    standardRecommended: true
  },
  {
    key: "wireguard_db_tunnel_enabled",
    ruleId: "CLD-NET-004",
    message: "WireGuard tunnel between compute and database is not confirmed.",
    hint: "Route DB traffic through WireGuard (AWS <-> Hetzner) and keep port 5432 off the public internet.",
    regulatedCritical: true,
    standardRecommended: false
  },
  {
    key: "secrets_manager_enabled",
    ruleId: "CLD-SEC-001",
    message: "Secrets Manager usage is not confirmed.",
    hint: "Store DB credentials, API keys, tunnel tokens, and signing secrets in AWS Secrets Manager.",
    regulatedCritical: true,
    standardRecommended: true
  },
  {
    key: "iam_role_no_access_keys",
    ruleId: "CLD-IAM-001",
    message: "IAM role/no-access-keys control is not confirmed.",
    hint: "Use IAM roles on compute nodes and remove long-lived access keys.",
    regulatedCritical: true,
    standardRecommended: true
  },
  {
    key: "cloudtrail_multi_region",
    ruleId: "CLD-MON-001",
    message: "CloudTrail multi-region audit logging is not confirmed.",
    hint: "Enable CloudTrail in all regions with log-file validation and alerts for root/IAM changes.",
    regulatedCritical: true,
    standardRecommended: true
  },
  {
    key: "backup_restore_tested_30d",
    ruleId: "CLD-DR-001",
    message: "Backup restore drill in the last 30 days is not confirmed.",
    hint: "Test restore procedures at least monthly and document RTO/RPO readiness.",
    regulatedCritical: true,
    standardRecommended: true
  },
  {
    key: "imdsv2_enforced",
    ruleId: "CLD-SEC-002",
    message: "IMDSv2 enforcement is not confirmed.",
    hint: "Disable IMDSv1 and require IMDSv2 on EC2 to reduce SSRF credential-theft risk.",
    regulatedCritical: true,
    standardRecommended: true
  },
  {
    key: "ssh_port_closed_public",
    ruleId: "CLD-NET-005",
    message: "Public SSH exposure control is not confirmed.",
    hint: "Keep port 22 closed to internet and use SSM Session Manager or approved bastion access.",
    regulatedCritical: true,
    standardRecommended: true
  },
  {
    key: "db_port_not_public",
    ruleId: "CLD-NET-006",
    message: "Public PostgreSQL port exposure control is not confirmed.",
    hint: "Keep port 5432 private-only; allow DB access only through approved private network/tunnel paths.",
    regulatedCritical: true,
    standardRecommended: true
  },
  {
    key: "waf_managed_rules_enabled",
    ruleId: "CLD-WAF-001",
    message: "Managed WAF rules are not confirmed.",
    hint: "Enable managed WAF rules (OWASP baseline) at edge before production traffic.",
    regulatedCritical: true,
    standardRecommended: true
  },
  {
    key: "auth_rate_limits_enabled",
    ruleId: "CLD-WAF-002",
    message: "Auth/payment endpoint rate limiting is not confirmed.",
    hint: "Set endpoint-specific rate limits to mitigate brute-force and abuse traffic.",
    regulatedCritical: true,
    standardRecommended: true
  },
  {
    key: "ci_secret_scanning_enabled",
    ruleId: "CLD-SEC-003",
    message: "CI secret scanning is not confirmed.",
    hint: "Enable gitleaks/trufflehog secret scans in CI and block merges on leaked secrets.",
    regulatedCritical: false,
    standardRecommended: true
  },
  {
    key: "wireguard_alert_enabled",
    ruleId: "CLD-MON-002",
    message: "WireGuard tunnel down-alert control is not confirmed.",
    hint: "Alert when the compute<->database tunnel drops, and include recovery runbook steps.",
    regulatedCritical: false,
    standardRecommended: true
  },
  {
    key: "cloudtrail_root_login_alert",
    ruleId: "CLD-MON-003",
    message: "Root-login alerting control is not confirmed.",
    hint: "Configure alerting for root login and IAM policy-change events.",
    regulatedCritical: false,
    standardRecommended: true
  },
  {
    key: "ec2_multi_az",
    ruleId: "CLD-HA-001",
    message: "Multi-AZ EC2 deployment evidence is not confirmed.",
    hint: "Run at least two instances across AZs for production availability goals.",
    regulatedCritical: false,
    standardRecommended: true
  }
];
