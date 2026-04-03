export function createTapSignEnrollmentHelpers({ $, write, setTab }) {
  let lastAnnouncementKey = "";
  return {
    refresh(summary) {
      lastAnnouncementKey = refreshPromptState({ $, write, summary, lastAnnouncementKey });
    },
    startSignup() {
      announceSignupStaging(write);
    },
    startProtection() {
      startProtectionFlow({ $, write, setTab });
    }
  };
}

function isProtected(summary) {
  return Boolean(
    summary?.tapsign_protected ||
    summary?.account?.tapsign_protected ||
    summary?.security?.tapsign_protected
  );
}

function prefillSupportRequest(getById, subject, message) {
  const category = getById("supportCategorySelect");
  const subjectInput = getById("supportSubjectInput");
  const messageInput = getById("supportMessageInput");
  if (category) {
    category.value = "support";
  }
  if (subjectInput && !subjectInput.value) {
    subjectInput.value = subject;
  }
  if (messageInput && !messageInput.value) {
    messageInput.value = message;
  }
}

function updatePromptCopy(getById) {
  const status = getById("tapSignStatusText");
  const detail = getById("tapSignStatusDetail");
  if (status) {
    status.textContent = "TapSign protection required";
  }
  if (detail) {
    detail.textContent =
      "You can still sign in with Google, GitHub, or email, but this account should complete TapSign device protection as the final login gate once the SDK is connected.";
  }
}

function togglePromptCard(getById, summary, protectedState) {
  const card = getById("tapSignPromptCard");
  if (card) {
    card.classList.toggle("hidden", !summary || protectedState);
  }
}

function buildAnnouncementKey(summary) {
  const userKey = String(summary?.account?.email || summary?.account?.user_id || "signed-in-user");
  return `pending:${userKey}`;
}

function refreshPromptState({ $, write, summary, lastAnnouncementKey }) {
  const protectedState = isProtected(summary);
  togglePromptCard($, summary, protectedState);
  if (!summary || protectedState) {
    return lastAnnouncementKey;
  }
  updatePromptCopy($);
  const announcementKey = buildAnnouncementKey(summary);
  if (announcementKey === lastAnnouncementKey) {
    return lastAnnouncementKey;
  }
  write("TapSign protection is pending for this account.", {
    status: "pending_sdk_integration",
    next_step: "Complete TapSign device enrollment once the SDK is available."
  });
  return announcementKey;
}

function announceSignupStaging(write) {
  write("TapSign sign-up staged.", {
    status: "waiting_for_sdk",
    message:
      "Continue with Google, GitHub, or email for now. After sign-in, the portal will keep prompting for TapSign device protection until the SDK is wired."
  });
}

function startProtectionFlow({ $, write, setTab }) {
  prefillSupportRequest(
    $,
    "TapSign device protection setup",
    "I want to finish TapSign protection for this account once the SDK is connected."
  );
  setTab("support");
  write("TapSign protection handoff prepared.", {
    status: "pending_sdk_integration",
    next_step: "Support form prefilled so TapSign onboarding can be completed once the SDK arrives."
  });
}