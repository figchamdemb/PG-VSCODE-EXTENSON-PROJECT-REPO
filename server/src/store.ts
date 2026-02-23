import { generateKeyPairSync } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import { StoreState } from "./types";

export interface StateStore {
  initialize(): Promise<void>;
  snapshot(): StoreState;
  update(mutator: (state: StoreState) => void): Promise<void>;
}

export class JsonStore implements StateStore {
  private state: StoreState | undefined;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly storePath: string) {}

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

  private async persist(): Promise<void> {
    assertState(this.state);
    await fs.writeFile(this.storePath, JSON.stringify(this.state, null, 2), "utf8");
  }
}

function assertState(value: StoreState | undefined): asserts value is StoreState {
  if (!value) {
    throw new Error("Store is not initialized.");
  }
}

export function createDefaultState(): StoreState {
  const keyPair = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: { format: "pem", type: "spki" },
    privateKeyEncoding: { format: "pem", type: "pkcs8" }
  });

  return {
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
  return {
    ...base,
    ...raw,
    users: raw.users ?? [],
    auth_challenges: raw.auth_challenges ?? [],
    sessions: raw.sessions ?? [],
    subscriptions: (raw.subscriptions ?? []).map((item) => ({
      ...item,
      team_id: item.team_id ?? null
    })),
    product_entitlements: raw.product_entitlements ?? [],
    project_quotas: raw.project_quotas ?? [],
    project_activations: raw.project_activations ?? [],
    devices: raw.devices ?? [],
    trials: raw.trials ?? [],
    refund_requests: raw.refund_requests ?? [],
    offline_payment_refs: raw.offline_payment_refs ?? [],
    redeem_codes: raw.redeem_codes ?? [],
    stripe_events: raw.stripe_events ?? [],
    affiliate_codes: raw.affiliate_codes ?? [],
    affiliate_conversions: raw.affiliate_conversions ?? [],
    affiliate_payouts: raw.affiliate_payouts ?? [],
    provider_policies: raw.provider_policies ?? [],
    oauth_states: raw.oauth_states ?? [],
    teams: raw.teams ?? [],
    team_memberships: raw.team_memberships ?? [],
    support_tickets: raw.support_tickets ?? [],
    feedback_entries: raw.feedback_entries ?? [],
    governance_settings: raw.governance_settings ?? [],
    governance_eod_reports: raw.governance_eod_reports ?? [],
    mastermind_threads: raw.mastermind_threads ?? [],
    mastermind_options: raw.mastermind_options ?? [],
    mastermind_entries: raw.mastermind_entries ?? [],
    mastermind_votes: raw.mastermind_votes ?? [],
    mastermind_outcomes: raw.mastermind_outcomes ?? [],
    governance_decision_events: raw.governance_decision_events ?? [],
    governance_decision_acks: raw.governance_decision_acks ?? [],
    keys: raw.keys ?? base.keys,
    updated_at: raw.updated_at ?? new Date().toISOString()
  };
}
