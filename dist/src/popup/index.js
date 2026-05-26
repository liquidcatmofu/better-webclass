(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
const DEFAULT_SETTINGS = {
  webclassUrl: "",
  enableUiEnhancer: true,
  enableFileHandler: true,
  enableAssignmentTracker: true
};
function getEl(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
}
function readForm() {
  return {
    webclassUrl: getEl("webclass-url").value.trim(),
    enableFileHandler: getEl("enable-file-handler").checked,
    enableUiEnhancer: getEl("enable-ui-enhancer").checked,
    enableAssignmentTracker: getEl("enable-assignment-tracker").checked
  };
}
function applyToForm(settings) {
  getEl("webclass-url").value = settings.webclassUrl;
  getEl("enable-file-handler").checked = settings.enableFileHandler;
  getEl("enable-ui-enhancer").checked = settings.enableUiEnhancer;
  getEl("enable-assignment-tracker").checked = settings.enableAssignmentTracker;
}
function showSaved() {
  const status = getEl("save-status");
  status.hidden = false;
  setTimeout(() => {
    status.hidden = true;
  }, 2e3);
}
async function init() {
  const items = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  applyToForm(items);
  getEl("save-btn").addEventListener("click", async () => {
    const settings = readForm();
    await chrome.storage.sync.set(settings);
    try {
      if (settings.webclassUrl) {
        const origin = new URL(settings.webclassUrl).origin;
        const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
        if (granted) {
          await chrome.runtime.sendMessage({ type: "bwc-update-url", url: settings.webclassUrl });
        }
      } else {
        await chrome.runtime.sendMessage({ type: "bwc-update-url", url: "" });
      }
    } catch {
    }
    showSaved();
  });
}
init();
//# sourceMappingURL=index.js.map
