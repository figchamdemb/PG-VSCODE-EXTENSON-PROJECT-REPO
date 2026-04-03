(function () {
  const params = new URLSearchParams(window.location.search);
  const editorReturnUrl = params.get("editor_return_url") || "";
  const messageNode = document.querySelector("[data-checkout-return-message]");
  const buttonNode = document.querySelector("[data-checkout-return-button]");

  if (!editorReturnUrl) {
    if (messageNode) {
      messageNode.textContent = "Return to the extension and refresh your license if the update does not appear automatically.";
    }
    return;
  }

  if (messageNode) {
    messageNode.textContent = "Trying to return you to the installed editor now. If nothing opens, use the button below.";
  }

  if (buttonNode instanceof HTMLAnchorElement) {
    buttonNode.href = editorReturnUrl;
    buttonNode.classList.remove("hidden");
  }

  window.setTimeout(function () {
    window.location.assign(editorReturnUrl);
  }, 800);
})();