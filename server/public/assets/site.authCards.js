export function initializeAuthCards(getById, write) {
  document.querySelectorAll(".auth-card").forEach((card) => {
    if (!(card instanceof HTMLElement)) {
      return;
    }
    const focusTargetId = card.getAttribute("data-focus-target");
    if (!focusTargetId) {
      return;
    }
    card.addEventListener("click", (event) => {
      if (event.target?.closest("button, a, input, textarea, select, label")) {
        return;
      }
      const focusTarget = getById(focusTargetId);
      if (focusTarget instanceof HTMLElement) {
        window.setTimeout(() => {
          focusTarget.focus();
          write(`Focused ${focusTargetId}.`);
        }, 0);
      }
    });
  });
}