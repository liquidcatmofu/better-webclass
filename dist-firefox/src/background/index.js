var _ = (function(exports) {
  "use strict";
  const DEFAULT_SETTINGS = {
    webclassUrl: "",
    enableUiEnhancer: true,
    enableFileHandler: true,
    enableAssignmentTracker: true,
    enableAutoRefresh: false,
    autoRefreshInterval: 360
  };
  const compatSession = chrome.storage.session ?? chrome.storage.local;
  const SCRIPT_ID = "bwc-main";
  const ALARM_NAME = "bwc-refresh";
  const SESSION_QUEUE = "bwcRefreshQueue";
  const SESSION_TAB = "bwcRefreshTabId";
  const SESSION_PROGRESS = "bwcRefreshProgress";
  async function registerScript(webclassUrl) {
    try {
      const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
      if (existing.length > 0) {
        await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
      }
    } catch {
    }
    if (!webclassUrl) return;
    try {
      const origin = new URL(webclassUrl).origin;
      await chrome.scripting.registerContentScripts([{
        id: SCRIPT_ID,
        matches: [`${origin}/*`],
        js: ["src/content/index.js"],
        css: ["better-webclass.css"],
        runAt: "document_end",
        allFrames: true
      }]);
      const tabs = await chrome.tabs.query({ url: `${origin}/*` });
      for (const tab of tabs) {
        if (!tab.id) continue;
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ["better-webclass.css"]
        }).catch(() => {
        });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ["src/content/index.js"]
        }).catch(() => {
        });
      }
    } catch (e) {
      console.error("[BWC] Failed to register content script:", e);
    }
  }
  async function setupAlarm() {
    const settings = await chrome.storage.sync.get({
      enableAutoRefresh: DEFAULT_SETTINGS.enableAutoRefresh,
      autoRefreshInterval: DEFAULT_SETTINGS.autoRefreshInterval
    });
    await chrome.alarms.clear(ALARM_NAME);
    if (settings.enableAutoRefresh) {
      chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: settings.autoRefreshInterval,
        periodInMinutes: settings.autoRefreshInterval
      });
    }
  }
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  async function getProgress() {
    const s = await chrome.storage.local.get({ [SESSION_PROGRESS]: null });
    return s[SESSION_PROGRESS];
  }
  async function setProgress(patch) {
    const current = await getProgress() ?? { total: 0, completed: 0, isRunning: false };
    await chrome.storage.local.set({ [SESSION_PROGRESS]: { ...current, ...patch } });
  }
  async function openNextRefreshTab() {
    const s = await compatSession.get({ [SESSION_QUEUE]: [] });
    const queue = s[SESSION_QUEUE];
    if (queue.length === 0) {
      await compatSession.set({ [SESSION_TAB]: null });
      await setProgress({ isRunning: false });
      return;
    }
    const [url, ...rest] = queue;
    await compatSession.set({ [SESSION_QUEUE]: rest });
    await delay(1e3);
    const tab = await chrome.tabs.create({ url, active: false });
    await compatSession.set({ [SESSION_TAB]: tab.id ?? null });
  }
  async function startRefresh() {
    const s = await compatSession.get({ [SESSION_TAB]: null });
    const activeTabId = s[SESSION_TAB];
    if (activeTabId !== null) {
      try {
        await chrome.tabs.get(activeTabId);
        return { started: false, courseCount: 0 };
      } catch {
        await compatSession.set({ [SESSION_TAB]: null });
      }
    }
    const data = await chrome.storage.local.get({ "bwc-course-urls": [] });
    const urls = data["bwc-course-urls"];
    if (urls.length === 0) return { started: false, courseCount: 0 };
    await chrome.storage.local.set({ [SESSION_PROGRESS]: { total: urls.length, completed: 0, isRunning: true } });
    const [first, ...rest] = urls;
    await compatSession.set({ [SESSION_QUEUE]: rest });
    const tab = await chrome.tabs.create({ url: first, active: false });
    await compatSession.set({ [SESSION_TAB]: tab.id ?? null });
    return { started: true, courseCount: urls.length };
  }
  chrome.permissions.onAdded.addListener(async () => {
    const { webclassUrl } = await chrome.storage.sync.get({ webclassUrl: "" });
    await registerScript(webclassUrl);
    await setupAlarm();
  });
  chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    if (reason === "install") {
      await chrome.storage.sync.set(DEFAULT_SETTINGS);
    }
    const { webclassUrl } = await chrome.storage.sync.get({ webclassUrl: "" });
    await registerScript(webclassUrl);
    await setupAlarm();
  });
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) return;
    await startRefresh();
  });
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    const s = await compatSession.get({ [SESSION_TAB]: null });
    if (s[SESSION_TAB] === tabId) {
      await openNextRefreshTab();
    }
  });
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    var _a;
    if (msg.type === "bwc-update-url") {
      registerScript(msg.url).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
      return true;
    }
    if (msg.type === "bwc-setup-alarm") {
      setupAlarm().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
      return true;
    }
    if (msg.type === "bwc-refresh-now") {
      startRefresh().then((result) => sendResponse(result)).catch(() => sendResponse({ started: false, courseCount: 0 }));
      return true;
    }
    if (msg.type === "bwc-stats-saved" && ((_a = sender.tab) == null ? void 0 : _a.id)) {
      const tabId = sender.tab.id;
      compatSession.get({ [SESSION_TAB]: null }).then(async (s) => {
        var _a2;
        if (s[SESSION_TAB] === tabId) {
          await setProgress({ completed: (((_a2 = await getProgress()) == null ? void 0 : _a2.completed) ?? 0) + 1 });
          await compatSession.set({ [SESSION_TAB]: null });
          await chrome.tabs.remove(tabId).catch(() => {
          });
          await openNextRefreshTab();
        }
      });
    }
  });
  exports.SESSION_PROGRESS = SESSION_PROGRESS;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  return exports;
})({});
//# sourceMappingURL=index.js.map
