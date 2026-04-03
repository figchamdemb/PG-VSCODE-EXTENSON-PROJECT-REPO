export function applyPortalLaunchContext({ $, setTab, refreshBillingSkuHint }) {
  const params = new URLSearchParams(window.location.search);
  const requestedTab = params.get("tab");
  if (requestedTab && ["overview", "billing", "support", "team", "admin"].includes(requestedTab)) {
    setTab(requestedTab);
  }
  setSelectValue($, "planSelect", params.get("plan"));
  setSelectValue($, "moduleSelect", params.get("module"));
  setSelectValue($, "supportCategorySelect", params.get("category"));
  setSelectValue($, "supportSeveritySelect", params.get("severity"));

  const subject = params.get("subject");
  const subjectInput = $("supportSubjectInput");
  if (subject && subjectInput && !subjectInput.value) {
    subjectInput.value = subject;
  }
  const message = params.get("message");
  const messageInput = $("supportMessageInput");
  if (message && messageInput && !messageInput.value) {
    messageInput.value = message;
  }
  refreshBillingSkuHint();
}

function setSelectValue(getById, id, value) {
  const element = getById(id);
  if (!element || !value) {
    return;
  }
  const normalized = String(value).trim();
  const supported = Array.from(element.options).some((option) => option.value === normalized);
  if (supported) {
    element.value = normalized;
  }
}