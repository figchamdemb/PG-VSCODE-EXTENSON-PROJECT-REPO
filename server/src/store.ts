import { generateKeyPairSync } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import { OAuthStateRecord, StoreState } from "./types";

export interface StateStore {
  initialize(): Promise<void>;
  checkReady(): Promise<boolean>;
  snapshot(): StoreState;
  update(mutator: (state: StoreState) => void): Promise<void>;
  appendOAuthStateRecord?(record: OAuthStateRecord): Promise<void>;
  consumeOAuthStateRecord?(
    provider: "github" | "google",
    stateToken: string
  ): Promise<OAuthStateRecord | undefined>;
}

export class JsonStore implements StateStore {
  private state: StoreState | undefined;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly storePath: string) {}

  async checkReady(): Promise<boolean> {
    return this.state !== undefined;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(path.dirname(this.storePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.storePath, "utf8");
      this.state = normalizeLoadedState(JSON.parse(raw) as Partial<StoreState>);
    } catch {
      this.state = createDefaultState();
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

  async appendOAuthStateRecord(record: OAuthStateRecord): Promise<void> {
    await this.update((state) => {
      state.oauth_states.push(record);
    });
  }

  async consumeOAuthStateRecord(
    provider: "github" | "google",
    stateToken: string
  ): Promise<OAuthStateRecord | undefined> {
    let consumed: OAuthStateRecord | undefined;
    const now = Date.now();
    await this.update((state) => {
      const record = state.oauth_states.find(
        (item) =>
          item.provider === provider &&
          item.state === stateToken &&
          item.consumed_at === null &&
          new Date(item.expires_at).getTime() > now
      );
      if (!record) {
        return;
      }
      record.consumed_at = new Date().toISOString();
      consumed = { ...record };
    });
    return consumed;
  }

  private async persist(): Promise<void> {
    assertState(this.state);
    await fs.writeFile(this.storePath, JSON.stringify(this.state, null, 2), "utf8");
  }
}

const DEFAULT_ARRAY_COLLECTIONS: Omit<StoreState, "keys" | "updated_at"> = {
  users: [],
  auth_challenges: [],
  sessions: [],
  subscriptions: [],
  product_entitlements: [],
  project_quotas: [],
  project_activations: [],
  devices: [],
  trials: [],
  refund_requests: [],
  offline_payment_refs: [],
  redeem_codes: [],
  stripe_events: [],
  affiliate_codes: [],
  affiliate_conversions: [],
  affiliate_payouts: [],
  provider_policies: [],
  oauth_states: [],
  teams: [],
  team_memberships: [],
  support_tickets: [],
  feedback_entries: [],
  governance_settings: [],
  governance_eod_reports: [],
  mastermind_threads: [],
  mastermind_options: [],
  mastermind_entries: [],
  mastermind_votes: [],
  mastermind_outcomes: [],
  governance_decision_events: [],
  governance_decision_acks: [],
  policy_tenant_overlays: [],
  enforcement_audit_log: [],
  reviewer_automation_policies: [],
  frontend_integration_workflows: [],
  frontend_integration_audit_log: [],
  review_workflows: [],
  review_workflow_audit_log: []
};

const ARRAY_STATE_KEYS = Object.keys(DEFAULT_ARRAY_COLLECTIONS) as Array<
  keyof Omit<StoreState, "keys" | "updated_at">
>;

function assertState(value: StoreState | undefined): asserts value is StoreState {
  if (!value) {
    throw new Error("Store is not initialized.");
  }
}

export function createDefaultState(): StoreState {
  const collections = structuredClone(DEFAULT_ARRAY_COLLECTIONS);
  const keyPair = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: { format: "pem", type: "spki" },
    privateKeyEncoding: { format: "pem", type: "pkcs8" }
  });

  return {
    ...collections,
    keys: {
      alg: "ES256",
      private_key_pem: keyPair.privateKey,
      public_key_pem: keyPair.publicKey
    },
    updated_at: new Date().toISOString()
  };
}

export function normalizeLoadedState(raw: Partial<StoreState>): StoreState {
  const base = createDefaultState();
  const state: StoreState = {
    ...base,
    ...raw,
    subscriptions: normalizeSubscriptions(raw.subscriptions),
    keys: raw.keys ?? base.keys,
    updated_at: raw.updated_at ?? new Date().toISOString()
  };
  applyArrayFallbacks(state, raw);
  return state;
}

function normalizeSubscriptions(rawSubscriptions: StoreState["subscriptions"] | undefined): StoreState["subscriptions"] {
  return (rawSubscriptions ?? []).map((item) => ({
    ...item,
    team_id: item.team_id ?? null
  }));
}

function applyArrayFallbacks(state: StoreState, raw: Partial<StoreState>): void {
  for (const key of ARRAY_STATE_KEYS) {
    if (key === "subscriptions") {
      continue;
    }
    const rawValue = raw[key] as unknown;
    state[key] = (Array.isArray(rawValue) ? rawValue : []) as never;
  }
}
