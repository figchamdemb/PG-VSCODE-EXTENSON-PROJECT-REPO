import { PrismaClient } from "@prisma/client";
import { createDefaultState, normalizeLoadedState, StateStore } from "./store";
import { StoreState } from "./types";

const TABLE_KEY_MAP: Array<{ table: string; key: keyof StoreState }> = [
  { table: "users", key: "users" },
  { table: "auth_challenges", key: "auth_challenges" },
  { table: "sessions", key: "sessions" },
  { table: "subscriptions", key: "subscriptions" },
  { table: "product_entitlements", key: "product_entitlements" },
  { table: "project_quotas", key: "project_quotas" },
  { table: "project_activations", key: "project_activations" },
  { table: "devices", key: "devices" },
  { table: "trials", key: "trials" },
  { table: "refund_requests", key: "refund_requests" },
  { table: "offline_payment_refs", key: "offline_payment_refs" },
  { table: "redeem_codes", key: "redeem_codes" },
  { table: "stripe_events", key: "stripe_events" },
  { table: "affiliate_codes", key: "affiliate_codes" },
  { table: "affiliate_conversions", key: "affiliate_conversions" },
  { table: "affiliate_payouts", key: "affiliate_payouts" },
  { table: "provider_policies", key: "provider_policies" },
  { table: "oauth_states", key: "oauth_states" },
  { table: "teams", key: "teams" },
  { table: "team_memberships", key: "team_memberships" },
  { table: "support_tickets", key: "support_tickets" },
  { table: "feedback_entries", key: "feedback_entries" },
  { table: "governance_settings", key: "governance_settings" },
  { table: "governance_eod_reports", key: "governance_eod_reports" },
  { table: "mastermind_threads", key: "mastermind_threads" },
  { table: "mastermind_options", key: "mastermind_options" },
  { table: "mastermind_entries", key: "mastermind_entries" },
  { table: "mastermind_votes", key: "mastermind_votes" },
  { table: "mastermind_outcomes", key: "mastermind_outcomes" },
  { table: "governance_decision_events", key: "governance_decision_events" },
  { table: "governance_decision_acks", key: "governance_decision_acks" }
];

export class PrismaStateStore implements StateStore {
  private state: StoreState | undefined;
  private writeChain: Promise<void> = Promise.resolve();
  private tableColumnTypes = new Map<string, Map<string, string>>();

  constructor(private readonly prisma: PrismaClient) {}

  async initialize(): Promise<void> {
    await this.ensureTables();
    await this.loadTableColumnTypes();
    const base = createDefaultState();
    const loaded: Partial<StoreState> = {};

    for (const item of TABLE_KEY_MAP) {
      const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM ${quoteIdent(item.table)}`
      );
      (loaded[item.key] as unknown) = rows.map((row) => normalizeDbObject(row));
    }

    const keyRows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      "SELECT * FROM keys ORDER BY id ASC LIMIT 1"
    );
    if (keyRows.length > 0) {
      loaded.keys = normalizeDbObject(keyRows[0]) as unknown as StoreState["keys"];
    } else {
      loaded.keys = base.keys;
    }
    loaded.updated_at = new Date().toISOString();
    this.state = normalizeLoadedState(loaded);

    if (keyRows.length === 0) {
      await this.persist();
    }
  }

  snapshot(): StoreState {
    assertState(this.state);
    return structuredClone(this.state);
  }

  async update(mutator: (state: StoreState) => void): Promise<void> {
    assertState(this.state);
    mutator(this.state);
    this.state.updated_at = new Date().toISOString();
    this.writeChain = this.writeChain.then(() => this.persist());
    await this.writeChain;
  }

  private async persist(): Promise<void> {
    assertState(this.state);
    for (const item of TABLE_KEY_MAP) {
      await this.prisma.$executeRawUnsafe(`DELETE FROM ${quoteIdent(item.table)}`);
      const rows = (this.state?.[item.key] as unknown[]) ?? [];
      const columnTypes = this.tableColumnTypes.get(item.table);
      for (const row of rows) {
        await insertGenericRow(
          this.prisma,
          item.table,
          row as Record<string, unknown>,
          columnTypes
        );
      }
    }
    await this.prisma.$executeRawUnsafe("DELETE FROM keys");
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO keys (id, alg, private_key_pem, public_key_pem) VALUES ($1, $2::"JwtAlg", $3, $4)',
      "main",
      this.state!.keys.alg,
      this.state!.keys.private_key_pem,
      this.state!.keys.public_key_pem
    );
  }

  private async ensureTables(): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `DO $$ BEGIN
         IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TeamRole') THEN
           BEGIN
             ALTER TYPE "TeamRole" ADD VALUE IF NOT EXISTS 'manager';
           EXCEPTION WHEN duplicate_object THEN
             NULL;
           END;
         END IF;
       END $$;`
    );

    await this.prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS support_tickets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        category TEXT NOT NULL,
        severity TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL,
        resolution_note TEXT NULL,
        created_at TIMESTAMPTZ(3) NOT NULL,
        updated_at TIMESTAMPTZ(3) NOT NULL
      )`
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS feedback_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        rating INTEGER NOT NULL,
        message TEXT NULL,
        created_at TIMESTAMPTZ(3) NOT NULL
      )`
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS governance_settings (
        id TEXT PRIMARY KEY,
        scope_type TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        slack_enabled BOOLEAN NOT NULL,
        slack_addon_active BOOLEAN NOT NULL,
        slack_channel TEXT NULL,
        vote_mode TEXT NOT NULL,
        max_debate_chars INTEGER NOT NULL,
        retention_days INTEGER NOT NULL,
        created_at TIMESTAMPTZ(3) NOT NULL,
        updated_at TIMESTAMPTZ(3) NOT NULL
      )`
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS governance_eod_reports (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        team_id TEXT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        work_started_at TIMESTAMPTZ(3) NULL,
        work_ended_at TIMESTAMPTZ(3) NULL,
        changed_files TEXT[] NOT NULL DEFAULT '{}',
        blockers TEXT[] NOT NULL DEFAULT '{}',
        source TEXT NOT NULL,
        agent_name TEXT NULL,
        created_at TIMESTAMPTZ(3) NOT NULL,
        updated_at TIMESTAMPTZ(3) NOT NULL
      )`
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS mastermind_threads (
        id TEXT PRIMARY KEY,
        team_id TEXT NULL,
        created_by_user_id TEXT NOT NULL,
        created_by_email TEXT NOT NULL,
        title TEXT NOT NULL,
        question TEXT NOT NULL,
        status TEXT NOT NULL,
        vote_mode TEXT NOT NULL,
        decision TEXT NULL,
        decision_option_key TEXT NULL,
        decision_note TEXT NULL,
        decided_by_user_id TEXT NULL,
        decided_by_email TEXT NULL,
        decided_at TIMESTAMPTZ(3) NULL,
        last_activity_at TIMESTAMPTZ(3) NOT NULL,
        expires_at TIMESTAMPTZ(3) NOT NULL,
        created_at TIMESTAMPTZ(3) NOT NULL,
        updated_at TIMESTAMPTZ(3) NOT NULL
      )`
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS mastermind_options (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        option_key TEXT NOT NULL,
        title TEXT NOT NULL,
        rationale TEXT NULL,
        created_at TIMESTAMPTZ(3) NOT NULL
      )`
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS mastermind_entries (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        entry_type TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ(3) NOT NULL
      )`
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS mastermind_votes (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        option_key TEXT NOT NULL,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        weight INTEGER NOT NULL,
        rationale TEXT NULL,
        created_at TIMESTAMPTZ(3) NOT NULL,
        updated_at TIMESTAMPTZ(3) NOT NULL
      )`
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS mastermind_outcomes (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        team_id TEXT NULL,
        title TEXT NOT NULL,
        decision TEXT NOT NULL,
        winning_option_key TEXT NULL,
        decision_note TEXT NULL,
        decided_by_email TEXT NULL,
        decided_at TIMESTAMPTZ(3) NOT NULL,
        created_at TIMESTAMPTZ(3) NOT NULL
      )`
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS governance_decision_events (
        id TEXT PRIMARY KEY,
        sequence INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        team_id TEXT NULL,
        decision TEXT NOT NULL,
        winning_option_key TEXT NULL,
        summary TEXT NOT NULL,
        created_at TIMESTAMPTZ(3) NOT NULL,
        expires_at TIMESTAMPTZ(3) NOT NULL
      )`
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS governance_decision_acks (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        note TEXT NULL,
        updated_at TIMESTAMPTZ(3) NOT NULL,
        acked_at TIMESTAMPTZ(3) NULL
      )`
    );
  }

  private async loadTableColumnTypes(): Promise<void> {
    this.tableColumnTypes.clear();
    for (const table of [...TABLE_KEY_MAP.map((item) => item.table), "keys"]) {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ column_name: string; column_type: string }>>(
        `SELECT a.attname AS column_name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS column_type
           FROM pg_catalog.pg_attribute a
           INNER JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
           INNER JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = $1
            AND n.nspname = current_schema()
            AND a.attnum > 0
            AND NOT a.attisdropped`,
        table
      );
      const typeMap = new Map<string, string>();
      for (const row of rows) {
        if (row.column_name && row.column_type) {
          typeMap.set(row.column_name, row.column_type);
        }
      }
      this.tableColumnTypes.set(table, typeMap);
    }
  }
}

function assertState(value: StoreState | undefined): asserts value is StoreState {
  if (!value) {
    throw new Error("Prisma state store is not initialized.");
  }
}

async function insertGenericRow(
  client: { $executeRawUnsafe(query: string, ...values: unknown[]): Promise<unknown> },
  table: string,
  row: Record<string, unknown>,
  columnTypes: Map<string, string> | undefined
): Promise<void> {
  const entries = Object.entries(row);
  if (entries.length === 0) {
    return;
  }
  const columns = entries.map(([key]) => quoteIdent(key)).join(", ");
  const placeholders = entries
    .map(([key], index) => {
      const base = `$${index + 1}`;
      const columnType = columnTypes?.get(key);
      return columnType ? `${base}::${columnType}` : base;
    })
    .join(", ");
  const values = entries.map(([, value]) => serializeDbValue(value));
  await client.$executeRawUnsafe(
    `INSERT INTO ${quoteIdent(table)} (${columns}) VALUES (${placeholders})`,
    ...values
  );
}

function serializeDbValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeDbValue(item));
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return value;
}

function normalizeDbObject(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = normalizeDbValue(value);
  }
  return out;
}

function normalizeDbValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDbValue(item));
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(record)) {
      normalized[key] = normalizeDbValue(child);
    }
    return normalized;
  }
  return value;
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, "\"\"")}"`;
}
