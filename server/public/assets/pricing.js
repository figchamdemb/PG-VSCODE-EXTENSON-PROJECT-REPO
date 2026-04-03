import {
  getModuleScopeOrder,
  getPaidTierOrder,
  getPlanCard,
  getSkuEntry,
  loadPublicPricingCatalog,
  priceText
} from "./pricingCatalogClient.js";

const state = {
  rows: [],
  category: "all",
  body: document.getElementById("comparisonBody"),
  filters: document.querySelectorAll("#categoryFilters .chip"),
  plansHost: document.getElementById("pricingPlans"),
  skuGridHost: document.getElementById("skuGrid"),
  skuSummary: document.getElementById("skuSummary"),
  skuFootnote: document.getElementById("skuFootnote")
};

function buildPortalUrl(params = {}) {
  const url = new URL("/app", window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  return `${url.pathname}${url.search}`;
}

function renderActionLink(label, href, variant = "primary") {
  return `<a class="btn ${variant === "ghost" ? "btn-ghost" : "btn-primary"}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

function getPlanActions(planKey) {
  if (planKey === "free") {
    return [renderActionLink("Start Free", buildPortalUrl({ tab: "overview" }))];
  }
  if (planKey === "trial") {
    return [renderActionLink("Open Trial Portal", buildPortalUrl({ tab: "overview" }))];
  }
  if (planKey === "enterprise") {
    return [
      renderActionLink("Open Billing", buildPortalUrl({ tab: "billing", plan: "enterprise" })),
      renderActionLink(
        "Contact Sales",
        buildPortalUrl({
          tab: "support",
          category: "billing",
          subject: "Enterprise Custom quote request",
          message: "I need Enterprise Custom pricing for larger seat counts or quota limits."
        }),
        "ghost"
      )
    ];
  }
  return [renderActionLink("Buy In Portal", buildPortalUrl({ tab: "billing", plan: planKey }))];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeCell(value) {
  const text = String(value ?? "").trim();
  if (text === "✅") {
    return "<span aria-label=\"included\">✓</span>";
  }
  if (text === "❌") {
    return "<span aria-label=\"not included\">—</span>";
  }
  return escapeHtml(text);
}

function getVisibleRows() {
  if (state.category === "all") {
    return state.rows;
  }
  return state.rows.filter((row) => row.category === state.category);
}

function renderEmptyRow(text) {
  if (!state.body) {
    return;
  }
  state.body.innerHTML = `<tr><td colspan="6">${escapeHtml(text)}</td></tr>`;
}

function buildRowHtml(row) {
  return `
    <tr data-category="${escapeHtml(row.category)}">
      <td>${escapeHtml(row.feature)}</td>
      <td>${normalizeCell(row.free)}</td>
      <td>${normalizeCell(row.trial)}</td>
      <td>${normalizeCell(row.pro)}</td>
      <td>${normalizeCell(row.team)}</td>
      <td>${normalizeCell(row.enterprise)}</td>
    </tr>`;
}

function renderTable() {
  if (!state.body) {
    return;
  }
  const visible = getVisibleRows();
  if (!visible.length) {
    renderEmptyRow("No rows for this category.");
    return;
  }
  state.body.innerHTML = visible.map(buildRowHtml).join("");
}

function updateFilterUi() {
  state.filters.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.category === state.category);
  });
}

function setCategory(category) {
  state.category = category;
  updateFilterUi();
  renderTable();
}

async function fetchComparisonRows() {
  const response = await fetch("/api/plans/comparison", { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const json = await response.json();
  return Array.isArray(json.rows) ? json.rows : [];
}

function renderPlanCards(catalog) {
  if (!state.plansHost) {
    return;
  }
  const order = ["free", "trial", "pro", "team", "enterprise"];
  state.plansHost.innerHTML = order
    .map((key) => {
      const card = getPlanCard(catalog, key);
      const extraClass = key === "pro" || key === "enterprise" ? ` ${key}` : "";
      return `
        <article class="plan${extraClass}">
          <p class="plan-tag">${escapeHtml(card.title)}</p>
          <h2>${escapeHtml(card.headline)}</h2>
          <p>${escapeHtml(card.summary)}</p>
          <ul>
            ${card.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}
          </ul>
          <div class="plan-actions">
            ${getPlanActions(key).join("")}
          </div>
        </article>`;
    })
    .join("");
}

function renderSkuGrid(catalog) {
  if (!state.skuGridHost) {
    return;
  }
  state.skuGridHost.innerHTML = getPaidTierOrder()
    .flatMap((tier) =>
      getModuleScopeOrder().map((moduleScope) => {
        const entry = getSkuEntry(catalog, tier, moduleScope);
        const enterpriseClass = tier === "enterprise" ? " enterprise" : "";
        return `
          <article class="sku-card${enterpriseClass}">
            <p class="sku-tier">${escapeHtml(tier)}</p>
            <h4>${escapeHtml(entry.label)}</h4>
            <p class="sku-price">${escapeHtml(priceText(entry))}</p>
            <p class="sku-key"><code>${escapeHtml(entry.stripe_key)}</code></p>
            <p>${escapeHtml(entry.note)}</p>
            <p>${escapeHtml(entry.seat_hint)}</p>
            <div class="sku-actions">
              ${renderActionLink(
                tier === "enterprise" ? "Open Billing" : "Buy In Portal",
                buildPortalUrl({ tab: "billing", plan: tier, module: moduleScope })
              )}
              ${tier === "enterprise"
                ? renderActionLink(
                    "Request Quote",
                    buildPortalUrl({
                      tab: "support",
                      category: "billing",
                      subject: `Enterprise quote for ${entry.label}`,
                      message: `Please contact me about Enterprise Custom pricing for ${entry.label}.`
                    }),
                    "ghost"
                  )
                : ""}
            </div>
          </article>`;
      })
    )
    .join("");
}

function renderPricingCatalog(catalog) {
  renderPlanCards(catalog);
  renderSkuGrid(catalog);
  if (state.skuSummary) {
    state.skuSummary.textContent = catalog?.notes?.free_trial || "";
  }
  if (state.skuFootnote) {
    state.skuFootnote.textContent = `${catalog?.notes?.annual_checkout || ""} ${catalog?.notes?.enterprise_sizing || ""}`.trim();
  }
}

async function loadComparison() {
  try {
    state.rows = await fetchComparisonRows();
    renderTable();
  } catch (error) {
    renderEmptyRow(`Could not load plan comparison (${String(error.message || error)}).`);
  }
}

async function loadPricingCatalog() {
  const catalog = await loadPublicPricingCatalog();
  renderPricingCatalog(catalog);
}

function registerFilterHandlers() {
  state.filters.forEach((chip) => {
    chip.addEventListener("click", () => {
      setCategory(chip.dataset.category || "all");
    });
  });
}

async function bootstrapPricingPage() {
  registerFilterHandlers();
  await Promise.all([loadComparison(), loadPricingCatalog()]);
}

bootstrapPricingPage();
