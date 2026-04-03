import {
  applyPricingCatalogRawToEditor,
  initializePricingCatalogEditor,
  resetPricingCatalogEditorToDefaults,
  syncPricingCatalogEditorToTextarea
} from "./site.adminPricingCatalogEditor.js";

export function createAdminOps(ctx) {
  initializePricingCatalogEditor(ctx.$);
  return {
    loadAdminSummary: () => loadAdminSummary(ctx),
    loadAdminUsers: () => loadAdminUsers(ctx),
    loadAdminSubscriptions: () => loadAdminSubscriptions(ctx),
    loadAdminPayments: () => loadAdminPayments(ctx),
    loadAdminSupportQueue: () => loadAdminSupportQueue(ctx),
    loadAdminGovernance: () => loadAdminGovernance(ctx),
    updateTicketStatus: () => updateTicketStatus(ctx),
    revokeSubscription: () => revokeSubscription(ctx),
    revokeUserSessions: () => revokeUserSessions(ctx),
    setTeamSlackAddon: () => setTeamSlackAddon(ctx),
    setUserSlackAddon: () => setUserSlackAddon(ctx),
    loadAdminStripeConfig: () => loadAdminStripeConfig(ctx),
    saveAdminStripeConfig: () => saveAdminStripeConfig(ctx),
    testAdminStripeConfig: () => testAdminStripeConfig(ctx),
    syncAdminPricingCatalog: () => syncAdminPricingCatalog(ctx),
    applyAdminPricingCatalogJson: () => applyAdminPricingCatalogJson(ctx),
    resetAdminPricingCatalog: () => resetAdminPricingCatalog(ctx)
  };
}

async function loadAdminSummary(ctx) {
  const { api, write, writePanel, adminOutput, adminApiBase } = ctx;
  const result = await api(`${adminApiBase()}/summary`);
  writePanel(adminOutput, result, "No admin data loaded.");
  write("Admin summary loaded.", result);
}

async function loadAdminUsers(ctx) {
  const { api, write, writePanel, adminOutput, adminApiBase } = ctx;
  const result = await api(`${adminApiBase()}/users?limit=200`);
  writePanel(adminOutput, result, "No admin data loaded.");
  write("Admin users loaded.", result);
}

async function loadAdminSubscriptions(ctx) {
  const { api, write, writePanel, adminOutput, adminApiBase } = ctx;
  const result = await api(`${adminApiBase()}/subscriptions?limit=200`);
  writePanel(adminOutput, result, "No admin data loaded.");
  write("Admin subscriptions loaded.", result);
}

async function loadAdminPayments(ctx) {
  const { api, write, writePanel, adminOutput, adminApiBase } = ctx;
  const result = await api(`${adminApiBase()}/payments`);
  writePanel(adminOutput, result, "No admin data loaded.");
  write("Admin payments loaded.", result);
}

async function loadAdminSupportQueue(ctx) {
  const { api, write, writePanel, adminOutput, adminApiBase } = ctx;
  const result = await api(`${adminApiBase()}/support?limit=200`);
  writePanel(adminOutput, result, "No admin data loaded.");
  write("Admin support queue loaded.", result);
}

async function loadAdminGovernance(ctx) {
  const { api, write, writePanel, adminOutput, adminApiBase } = ctx;
  const result = await api(`${adminApiBase()}/governance`);
  writePanel(adminOutput, result, "No governance admin data loaded.");
  write("Admin governance loaded.", result);
}

async function updateTicketStatus(ctx) {
  const { $, api, write, adminApiBase } = ctx;
  const ticketId = ($("adminTicketIdInput")?.value || "").trim();
  const status = $("adminTicketStatusSelect")?.value;
  if (!ticketId || !status) {
    write("Ticket ID and status are required.");
    return;
  }
  const result = await api(`${adminApiBase()}/support/status`, "POST", {
    ticket_id: ticketId,
    status,
    resolution_note: ($("adminTicketNoteInput")?.value || "").trim()
  });
  write("Admin ticket updated.", result);
  await loadAdminSupportQueue(ctx);
}

async function revokeSubscription(ctx) {
  const { $, api, write, adminApiBase } = ctx;
  const subscriptionId = ($("adminSubscriptionIdInput")?.value || "").trim();
  if (!subscriptionId) {
    write("Subscription ID is required.");
    return;
  }
  const result = await api(`${adminApiBase()}/subscription/revoke`, "POST", {
    subscription_id: subscriptionId
  });
  write("Subscription revoked.", result);
  await loadAdminSubscriptions(ctx);
}

async function revokeUserSessions(ctx) {
  const { $, api, write, adminApiBase } = ctx;
  const userId = ($("adminUserIdInput")?.value || "").trim();
  if (!userId) {
    write("User ID is required.");
    return;
  }
  const result = await api(`${adminApiBase()}/sessions/revoke-user`, "POST", {
    user_id: userId
  });
  write("User sessions revoked.", result);
}

async function setTeamSlackAddon(ctx) {
  const { $, api, write, state, parseBool } = ctx;
  const teamKey = ($("adminGovernanceTeamKeyInput")?.value || "").trim().toUpperCase();
  if (!teamKey) {
    write("Team key is required.");
    return;
  }
  const active = parseBool($("adminGovernanceAddonActiveSelect")?.value);
  const result = await api(`${state.adminRoutePrefix}/governance/slack-addon/team`, "POST", {
    team_key: teamKey,
    active
  });
  write("Team slack add-on updated.", result);
  await loadAdminGovernance(ctx);
}

async function setUserSlackAddon(ctx) {
  const { $, api, write, state, parseBool } = ctx;
  const email = ($("adminGovernanceEmailInput")?.value || "").trim();
  if (!email) {
    write("User email is required.");
    return;
  }
  const active = parseBool($("adminGovernanceAddonActiveSelect")?.value);
  const result = await api(`${state.adminRoutePrefix}/governance/slack-addon/user`, "POST", {
    email,
    active
  });
  write("User slack add-on updated.", result);
  await loadAdminGovernance(ctx);
}

async function loadAdminStripeConfig(ctx) {
  const { api, write, writePanel, adminOutput, adminApiBase } = ctx;
  const result = await api(`${adminApiBase()}/payments/stripe-config`);
  applyStripeConfigToInputs(ctx.$, result.config);
  write("Stripe runtime config loaded.", result);
  writePanel(adminOutput, result, "No Stripe config data loaded.");
}

async function saveAdminStripeConfig(ctx) {
  const { api, write, writePanel, adminOutput, adminApiBase } = ctx;
  const payload = buildStripeConfigUpdatePayload(ctx.$);
  if (Object.keys(payload).length === 0) {
    write("Enter at least one Stripe config field before saving.");
    return;
  }
  const result = await api(`${adminApiBase()}/payments/stripe-config`, "POST", payload);
  write("Stripe runtime config saved.", result);
  writePanel(adminOutput, result, "No Stripe config data loaded.");
  resetStripeSecretInputs(ctx.$);
  await loadAdminStripeConfig(ctx);
}

async function testAdminStripeConfig(ctx) {
  const { api, write, writePanel, adminOutput, adminApiBase } = ctx;
  const result = await api(`${adminApiBase()}/payments/stripe-config/test`, "POST", {});
  write("Stripe runtime config test passed.", result);
  writePanel(adminOutput, result, "No Stripe test data loaded.");
}

function syncAdminPricingCatalog(ctx) {
  syncPricingCatalogEditorToTextarea(ctx.$);
  ctx.write("Pricing catalog JSON rebuilt from the field editor.");
}

function applyAdminPricingCatalogJson(ctx) {
  const raw = ctx.$("adminPricingCatalogInput")?.value || "";
  try {
    applyPricingCatalogRawToEditor(ctx.$, raw);
    ctx.write("Advanced pricing JSON applied to the field editor.");
  } catch (error) {
    ctx.write(error instanceof Error ? error.message : "Pricing catalog JSON must be valid.");
  }
}

function resetAdminPricingCatalog(ctx) {
  resetPricingCatalogEditorToDefaults(ctx.$);
  ctx.write("Pricing catalog reset to defaults.");
}

function buildStripeConfigUpdatePayload(getById) {
  syncPricingCatalogEditorToTextarea(getById);
  const payload = {};
  setPayloadValue(payload, "stripe_publishable_key", valueOrUndefined(getById, "adminStripePublishableKeyInput"));
  setPayloadValue(payload, "stripe_secret_key", valueOrUndefined(getById, "adminStripeSecretKeyInput"));
  setPayloadValue(payload, "stripe_webhook_secret", valueOrUndefined(getById, "adminStripeWebhookSecretInput"));
  setPayloadValue(payload, "stripe_price_map_raw", valueOrUndefined(getById, "adminStripePriceMapInput"));
  setPayloadValue(payload, "pricing_catalog_raw", valueOrUndefined(getById, "adminPricingCatalogInput"));
  setPayloadValue(payload, "checkout_success_url", valueOrUndefined(getById, "adminStripeSuccessUrlInput"));
  setPayloadValue(payload, "checkout_cancel_url", valueOrUndefined(getById, "adminStripeCancelUrlInput"));
  return payload;
}

function setPayloadValue(payload, key, value) {
  if (value !== undefined) {
    payload[key] = value;
  }
}

function valueOrUndefined(getById, id) {
  const value = (getById(id)?.value || "").trim();
  return value.length > 0 ? value : undefined;
}

function resetStripeSecretInputs(getById) {
  if (getById("adminStripeSecretKeyInput")) {
    getById("adminStripeSecretKeyInput").value = "";
  }
  if (getById("adminStripeWebhookSecretInput")) {
    getById("adminStripeWebhookSecretInput").value = "";
  }
}

function applyStripeConfigToInputs(getById, config) {
  if (!config) {
    return;
  }
  applyStripeValue(getById, "adminStripePublishableKeyInput", "", config.publishable_key_hint);
  applyStripeValue(getById, "adminStripePriceMapInput", config.stripe_price_map_raw || "");
  const pricingCatalogRaw = config.pricing_catalog_raw || "";
  applyStripeValue(getById, "adminPricingCatalogInput", pricingCatalogRaw);
  applyPricingCatalogRawToEditor(getById, pricingCatalogRaw);
  applyStripeValue(getById, "adminStripeSuccessUrlInput", config.checkout_success_url || "");
  applyStripeValue(getById, "adminStripeCancelUrlInput", config.checkout_cancel_url || "");
  applyPlaceholderHint(getById, "adminStripePublishableKeyInput", config.publishable_key_hint);
  applyPlaceholderHint(getById, "adminStripeSecretKeyInput", config.secret_key_hint);
  applyPlaceholderHint(getById, "adminStripeWebhookSecretInput", config.webhook_secret_hint);
}

function applyStripeValue(getById, id, value, hint) {
  const input = getById(id);
  if (!input) {
    return;
  }
  input.value = value;
  if (hint) {
    input.placeholder = hint;
  }
}

function applyPlaceholderHint(getById, id, hint) {
  const input = getById(id);
  if (input && hint) {
    input.placeholder = hint;
  }
}
