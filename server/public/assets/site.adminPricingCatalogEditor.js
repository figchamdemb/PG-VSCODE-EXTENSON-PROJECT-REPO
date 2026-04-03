import { DEFAULT_PUBLIC_PRICING_CATALOG } from "./pricingCatalogClient.js";

const PLAN_CARD_KEYS = ["free", "trial", "pro", "team", "enterprise"];
const PLAN_CARD_LABELS = {
  free: "Free",
  trial: "Trial / EDU",
  pro: "Pro",
  team: "Team",
  enterprise: "Enterprise"
};
const PAID_TIER_KEYS = ["pro", "team", "enterprise"];
const MODULE_SCOPE_KEYS = ["narrate", "memorybank", "bundle"];
const MODULE_SCOPE_LABELS = {
  narrate: "Narrate",
  memorybank: "Memory-bank",
  bundle: "Bundle"
};

export function initializePricingCatalogEditor(getById) {
  const host = getById("adminPricingCatalogEditor");
  if (!host || host.dataset.ready === "true") {
    return;
  }
  host.innerHTML = [
    '<div class="pricing-editor-section">',
    "<h5>Plan cards</h5>",
    '<p class="small">Headlines, summaries, and bullets for the main pricing cards.</p>',
    `<div class="pricing-editor-plan-grid">${PLAN_CARD_KEYS.map((key) => renderPlanCardEditor(key)).join("")}</div>`,
    "</div>",
    '<div class="pricing-editor-section">',
    "<h5>Paid annual SKUs</h5>",
    '<p class="small">These values control website and billing-page pricing copy only. Stripe charge IDs still live in the separate Stripe price map above.</p>',
    PAID_TIER_KEYS.map((tier) => renderSkuGroupEditor(tier)).join(""),
    "</div>",
    '<div class="pricing-editor-section">',
    "<h5>Commercial notes</h5>",
    '<p class="small">Short notes shown to customers and operators about free access, annual checkout behavior, and enterprise sizing.</p>',
    '<div class="pricing-editor-note-grid">',
    renderNoteEditor("free_trial", "Free / Trial note"),
    renderNoteEditor("annual_checkout", "Annual checkout note"),
    renderNoteEditor("enterprise_sizing", "Enterprise sizing note"),
    "</div>",
    "</div>"
  ].join("");
  host.dataset.ready = "true";
  applyPricingCatalogObjectToEditor(getById, cloneDefaultPricingCatalog());
  syncPricingCatalogEditorToTextarea(getById);
}

export function syncPricingCatalogEditorToTextarea(getById) {
  const raw = prettyPricingCatalog(collectPricingCatalogFromEditor(getById));
  setElementValue(getById, "adminPricingCatalogInput", raw);
  return raw;
}

export function applyPricingCatalogRawToEditor(getById, raw) {
  const catalog = parsePricingCatalogForEditor(raw);
  applyPricingCatalogObjectToEditor(getById, catalog);
  setElementValue(getById, "adminPricingCatalogInput", prettyPricingCatalog(catalog));
}

export function resetPricingCatalogEditorToDefaults(getById) {
  applyPricingCatalogObjectToEditor(getById, cloneDefaultPricingCatalog());
  syncPricingCatalogEditorToTextarea(getById);
}

function renderPlanCardEditor(key) {
  return [
    '<section class="pricing-editor-card">',
    `<h6>${PLAN_CARD_LABELS[key]}</h6>`,
    "<label>Title</label>",
    `<input id="${planCardFieldId(key, "title")}" type="text" />`,
    "<label>Headline</label>",
    `<input id="${planCardFieldId(key, "headline")}" type="text" />`,
    "<label>Summary</label>",
    `<textarea id="${planCardFieldId(key, "summary")}" rows="3"></textarea>`,
    "<label>Bullets (one per line)</label>",
    `<textarea id="${planCardFieldId(key, "bullets")}" rows="4"></textarea>`,
    "</section>"
  ].join("");
}

function renderSkuGroupEditor(tier) {
  return [
    '<div class="pricing-editor-sku-group">',
    '<div class="pricing-editor-sku-head">',
    `<h5>${PLAN_CARD_LABELS[tier]} pricing</h5>`,
    "<p>Base package display copy; seat expansion can still be handled manually.</p>",
    "</div>",
    `<div class="pricing-editor-sku-grid">${MODULE_SCOPE_KEYS.map((scope) => renderSkuEditor(tier, scope)).join("")}</div>`,
    "</div>"
  ].join("");
}

function renderSkuEditor(tier, scope) {
  return [
    '<section class="pricing-editor-card">',
    `<h6>${MODULE_SCOPE_LABELS[scope]}</h6>`,
    `<div class="pricing-key-chip">${tier}:${scope}</div>`,
    "<label>Label</label>",
    `<input id="${skuFieldId(tier, scope, "label")}" type="text" />`,
    '<div class="pricing-editor-field-grid">',
    "<div>",
    "<label>Amount (GBP)</label>",
    `<input id="${skuFieldId(tier, scope, "amount_gbp")}" type="number" min="0" step="1" />`,
    "</div>",
    "<div>",
    "<label>Price text</label>",
    `<input id="${skuFieldId(tier, scope, "price_text")}" type="text" />`,
    "</div>",
    "</div>",
    "<label>Note</label>",
    `<textarea id="${skuFieldId(tier, scope, "note")}" rows="3"></textarea>`,
    "<label>Seat hint</label>",
    `<input id="${skuFieldId(tier, scope, "seat_hint")}" type="text" />`,
    "</section>"
  ].join("");
}

function renderNoteEditor(key, label) {
  return [
    "<div>",
    `<label>${label}</label>`,
    `<textarea id="${noteFieldId(key)}" rows="4"></textarea>`,
    "</div>"
  ].join("");
}

function collectPricingCatalogFromEditor(getById) {
  const defaults = cloneDefaultPricingCatalog();
  const catalog = cloneDefaultPricingCatalog();

  PLAN_CARD_KEYS.forEach((key) => {
    const defaultCard = defaults.plan_cards[key];
    catalog.plan_cards[key] = {
      title: valueOrDefault(getById, planCardFieldId(key, "title"), defaultCard.title),
      headline: valueOrDefault(getById, planCardFieldId(key, "headline"), defaultCard.headline),
      summary: valueOrDefault(getById, planCardFieldId(key, "summary"), defaultCard.summary),
      bullets: textAreaLinesOrDefault(getById, planCardFieldId(key, "bullets"), defaultCard.bullets)
    };
  });

  PAID_TIER_KEYS.forEach((tier) => {
    MODULE_SCOPE_KEYS.forEach((scope) => {
      const defaultSku = defaults.skus[tier][scope];
      const amountGbp = numberOrDefault(getById, skuFieldId(tier, scope, "amount_gbp"), defaultSku.amount_gbp);
      catalog.skus[tier][scope] = {
        stripe_key: defaultSku.stripe_key,
        label: valueOrDefault(getById, skuFieldId(tier, scope, "label"), defaultSku.label),
        amount_gbp: amountGbp,
        minor_units: Math.round(amountGbp * 100),
        price_text: valueOrDefault(getById, skuFieldId(tier, scope, "price_text"), defaultSku.price_text),
        billing_model: "annual_one_time",
        note: valueOrDefault(getById, skuFieldId(tier, scope, "note"), defaultSku.note),
        seat_hint: valueOrDefault(getById, skuFieldId(tier, scope, "seat_hint"), defaultSku.seat_hint)
      };
    });
  });

  Object.keys(catalog.notes).forEach((key) => {
    catalog.notes[key] = valueOrDefault(getById, noteFieldId(key), defaults.notes[key]);
  });

  return catalog;
}

function applyPricingCatalogObjectToEditor(getById, catalogInput) {
  const catalog = normalizePricingCatalogObject(catalogInput);

  PLAN_CARD_KEYS.forEach((key) => {
    const card = catalog.plan_cards[key];
    setElementValue(getById, planCardFieldId(key, "title"), card.title);
    setElementValue(getById, planCardFieldId(key, "headline"), card.headline);
    setElementValue(getById, planCardFieldId(key, "summary"), card.summary);
    setElementValue(getById, planCardFieldId(key, "bullets"), card.bullets.join("\n"));
  });

  PAID_TIER_KEYS.forEach((tier) => {
    MODULE_SCOPE_KEYS.forEach((scope) => {
      const sku = catalog.skus[tier][scope];
      setElementValue(getById, skuFieldId(tier, scope, "label"), sku.label);
      setElementValue(getById, skuFieldId(tier, scope, "amount_gbp"), String(sku.amount_gbp));
      setElementValue(getById, skuFieldId(tier, scope, "price_text"), sku.price_text);
      setElementValue(getById, skuFieldId(tier, scope, "note"), sku.note);
      setElementValue(getById, skuFieldId(tier, scope, "seat_hint"), sku.seat_hint);
    });
  });

  Object.entries(catalog.notes).forEach(([key, value]) => {
    setElementValue(getById, noteFieldId(key), value);
  });
}

function parsePricingCatalogForEditor(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return cloneDefaultPricingCatalog();
  }
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Pricing catalog JSON must be valid before it can be applied to cards.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Pricing catalog JSON must be an object.");
  }
  return normalizePricingCatalogObject(parsed);
}

function normalizePricingCatalogObject(source) {
  const defaults = cloneDefaultPricingCatalog();
  const planCards = asObject(source.plan_cards);
  const skus = asObject(source.skus);
  const notes = asObject(source.notes);
  const catalog = cloneDefaultPricingCatalog();

  PLAN_CARD_KEYS.forEach((key) => {
    const sourceCard = asObject(planCards[key]);
    const defaultCard = defaults.plan_cards[key];
    catalog.plan_cards[key] = {
      title: coerceString(sourceCard.title, defaultCard.title),
      headline: coerceString(sourceCard.headline, defaultCard.headline),
      summary: coerceString(sourceCard.summary, defaultCard.summary),
      bullets: coerceStringArray(sourceCard.bullets, defaultCard.bullets)
    };
  });

  PAID_TIER_KEYS.forEach((tier) => {
    const tierSkus = asObject(skus[tier]);
    MODULE_SCOPE_KEYS.forEach((scope) => {
      const sourceSku = asObject(tierSkus[scope]);
      const defaultSku = defaults.skus[tier][scope];
      const amountGbp = coerceNumber(sourceSku.amount_gbp, defaultSku.amount_gbp);
      const minorUnitsSource = Number(sourceSku.minor_units);
      catalog.skus[tier][scope] = {
        stripe_key: defaultSku.stripe_key,
        label: coerceString(sourceSku.label, defaultSku.label),
        amount_gbp: amountGbp,
        minor_units: Number.isFinite(minorUnitsSource) ? Math.round(minorUnitsSource) : Math.round(amountGbp * 100),
        price_text: coerceString(sourceSku.price_text, defaultSku.price_text),
        billing_model: "annual_one_time",
        note: coerceString(sourceSku.note, defaultSku.note),
        seat_hint: coerceString(sourceSku.seat_hint, defaultSku.seat_hint)
      };
    });
  });

  catalog.notes = {
    free_trial: coerceString(notes.free_trial, defaults.notes.free_trial),
    annual_checkout: coerceString(notes.annual_checkout, defaults.notes.annual_checkout),
    enterprise_sizing: coerceString(notes.enterprise_sizing, defaults.notes.enterprise_sizing)
  };

  return catalog;
}

function cloneDefaultPricingCatalog() {
  return JSON.parse(JSON.stringify(DEFAULT_PUBLIC_PRICING_CATALOG));
}

function prettyPricingCatalog(catalog) {
  return JSON.stringify(catalog, null, 2);
}

function planCardFieldId(planKey, field) {
  return `adminPricingPlan-${planKey}-${field}`;
}

function skuFieldId(tier, scope, field) {
  return `adminPricingSku-${tier}-${scope}-${field}`;
}

function noteFieldId(key) {
  return `adminPricingNote-${key}`;
}

function setElementValue(getById, id, value) {
  const input = getById(id);
  if (input) {
    input.value = value;
  }
}

function valueOrDefault(getById, id, fallback) {
  const value = (getById(id)?.value || "").trim();
  return value.length > 0 ? value : fallback;
}

function numberOrDefault(getById, id, fallback) {
  const raw = (getById(id)?.value || "").trim();
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
}

function textAreaLinesOrDefault(getById, id, fallback) {
  const raw = (getById(id)?.value || "").trim();
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : fallback;
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function coerceString(value, fallback) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function coerceNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function coerceStringArray(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const entries = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
  return entries.length > 0 ? entries : fallback;
}
