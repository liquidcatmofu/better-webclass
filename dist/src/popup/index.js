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
  enableAssignmentTracker: true,
  enableAutoRefresh: false,
  autoRefreshInterval: 360
};
const SESSION_PROGRESS = "bwcRefreshProgress";
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
    enableAssignmentTracker: getEl("enable-assignment-tracker").checked,
    enableAutoRefresh: getEl("enable-auto-refresh").checked,
    autoRefreshInterval: Number(getEl("auto-refresh-interval").value)
  };
}
function applyToForm(settings) {
  getEl("webclass-url").value = settings.webclassUrl;
  getEl("enable-file-handler").checked = settings.enableFileHandler;
  getEl("enable-ui-enhancer").checked = settings.enableUiEnhancer;
  getEl("enable-assignment-tracker").checked = settings.enableAssignmentTracker;
  getEl("enable-auto-refresh").checked = settings.enableAutoRefresh;
  getEl("auto-refresh-interval").value = String(settings.autoRefreshInterval);
  updateIntervalVisibility(settings.enableAutoRefresh);
}
function updateIntervalVisibility(enabled) {
  getEl("auto-refresh-interval-field").style.display = enabled ? "" : "none";
}
function showStatus(msg, color = "#16a34a") {
  const el = getEl("save-status");
  el.textContent = msg;
  el.style.color = color;
  el.hidden = false;
  setTimeout(() => {
    el.hidden = true;
  }, 2500);
}
function renderProgress(prog) {
  const el = getEl("refresh-progress");
  if (!prog || !prog.isRunning && prog.completed === 0) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  if (prog.isRunning) {
    el.textContent = `更新中… ${prog.completed} / ${prog.total} コース完了`;
    el.className = "refresh-progress running";
  } else {
    el.textContent = `更新完了 (${prog.completed} / ${prog.total} コース)`;
    el.className = "refresh-progress done";
  }
}
async function init() {
  const items = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  applyToForm(items);
  const localData = await chrome.storage.local.get({ [SESSION_PROGRESS]: null });
  renderProgress(localData[SESSION_PROGRESS]);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[SESSION_PROGRESS]) {
      renderProgress(changes[SESSION_PROGRESS].newValue);
    }
  });
  getEl("enable-auto-refresh").addEventListener("change", (e) => {
    updateIntervalVisibility(e.target.checked);
  });
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
    try {
      await chrome.runtime.sendMessage({ type: "bwc-setup-alarm" });
    } catch {
    }
    showStatus("保存しました ✓");
  });
  getEl("refresh-now-btn").addEventListener("click", async () => {
    try {
      const result = await chrome.runtime.sendMessage({ type: "bwc-refresh-now" });
      if (result.started) {
        showStatus(`更新を開始しました (${result.courseCount} コース)`);
      } else {
        showStatus("コース一覧を先に開いてください", "#9ca3af");
      }
    } catch {
      showStatus("エラーが発生しました", "#dc2626");
    }
  });
}
init();
//# sourceMappingURL=index.js.map
