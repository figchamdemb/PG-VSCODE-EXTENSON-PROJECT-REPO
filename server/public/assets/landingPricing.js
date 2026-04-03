import { getPlanCard, loadPublicPricingCatalog } from "./pricingCatalogClient.js";

const cardsHost = document.getElementById("homePricingCards");
const footnote = document.getElementById("homePricingFootnote");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderLandingPricing(catalog) {
  if (cardsHost) {
    const order = ["free", "trial", "pro", "team", "enterprise"];
    cardsHost.innerHTML = order
      .map((key) => {
        const card = getPlanCard(catalog, key);
        return `
          <article class="card pricing">
            <h3>${escapeHtml(card.title)}</h3>
            <p class="price">${escapeHtml(card.headline)}</p>
            <p>${escapeHtml(card.summary)}</p>
            <ul class="pricing-points">
              ${card.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}
            </ul>
          </article>`;
      })
      .join("");
  }

  if (footnote) {
    footnote.textContent = `${catalog?.notes?.free_trial || ""} ${catalog?.notes?.annual_checkout || ""}`.trim();
  }
}

async function bootstrapLandingPricing() {
  const catalog = await loadPublicPricingCatalog();
  renderLandingPricing(catalog);
}

bootstrapLandingPricing();
