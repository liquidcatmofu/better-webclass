import { DEFAULT_SETTINGS } from "../types";

const SCRIPT_ID = "bwc-main";
const ALARM_NAME = "bwc-refresh";
const SESSION_QUEUE = "bwcRefreshQueue";
const SESSION_TAB = "bwcRefreshTabId";
export const SESSION_PROGRESS = "bwcRefreshProgress";

export interface RefreshProgress {
  total: number;
  completed: number;
  isRunning: boolean;
}

async function registerScript(webclassUrl: string): Promise<void> {
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
    if (existing.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    }
  } catch { /**/ }

  if (!webclassUrl) return;

  try {
    const origin = new URL(webclassUrl).origin;
    await chrome.scripting.registerContentScripts([{
      id: SCRIPT_ID,
      matches: [`${origin}/*`],
      js: ["src/content/index.js"],
      css: ["better-webclass.css"],
      runAt: "document_end",
      allFrames: true,
    }]);
  } catch (e) {
    console.error("[BWC] Failed to register content script:", e);
  }
}

async function setupAlarm(): Promise<void> {
  const settings = await chrome.storage.sync.get({
    enableAutoRefresh: DEFAULT_SETTINGS.enableAutoRefresh,
    autoRefreshInterval: DEFAULT_SETTINGS.autoRefreshInterval,
  });
  await chrome.alarms.clear(ALARM_NAME);
  if (settings.enableAutoRefresh) {
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: settings.autoRefreshInterval as number,
      periodInMinutes: settings.autoRefreshInterval as number,
    });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getProgress(): Promise<RefreshProgress | null> {
  const s = await chrome.storage.local.get({ [SESSION_PROGRESS]: null });
  return s[SESSION_PROGRESS] as RefreshProgress | null;
}

async function setProgress(patch: Partial<RefreshProgress>): Promise<void> {
  const current = await getProgress() ?? { total: 0, completed: 0, isRunning: false };
  await chrome.storage.local.set({ [SESSION_PROGRESS]: { ...current, ...patch } });
}

async function openNextRefreshTab(): Promise<void> {
  const session = await chrome.storage.session.get({ [SESSION_QUEUE]: [] as string[] });
  const queue = session[SESSION_QUEUE] as string[];
  if (queue.length === 0) {
    await chrome.storage.session.set({ [SESSION_TAB]: null });
    await setProgress({ isRunning: false });
    return;
  }
  const [url, ...rest] = queue;
  await chrome.storage.session.set({ [SESSION_QUEUE]: rest });
  await delay(1000);
  const tab = await chrome.tabs.create({ url, active: false });
  await chrome.storage.session.set({ [SESSION_TAB]: tab.id ?? null });
}

async function startRefresh(): Promise<{ started: boolean; courseCount: number }> {
  const session = await chrome.storage.session.get({ [SESSION_TAB]: null });
  if (session[SESSION_TAB] !== null) return { started: false, courseCount: 0 };

  const data = await chrome.storage.local.get({ "bwc-course-urls": [] });
  const urls = data["bwc-course-urls"] as string[];
  if (urls.length === 0) return { started: false, courseCount: 0 };

  await chrome.storage.local.set({ [SESSION_PROGRESS]: { total: urls.length, completed: 0, isRunning: true } });

  const [first, ...rest] = urls;
  await chrome.storage.session.set({ [SESSION_QUEUE]: rest });
  const tab = await chrome.tabs.create({ url: first, active: false });
  await chrome.storage.session.set({ [SESSION_TAB]: tab.id ?? null });
  return { started: true, courseCount: urls.length };
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === "install") {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
  }
  const { webclassUrl } = await chrome.storage.sync.get({ webclassUrl: "" });
  await registerScript(webclassUrl as string);
  await setupAlarm();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  await startRefresh();
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const session = await chrome.storage.session.get({ [SESSION_TAB]: null });
  if (session[SESSION_TAB] === tabId) {
    await openNextRefreshTab();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "bwc-update-url") {
    registerScript(msg.url as string)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === "bwc-setup-alarm") {
    setupAlarm()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === "bwc-refresh-now") {
    startRefresh()
      .then((result) => sendResponse(result))
      .catch(() => sendResponse({ started: false, courseCount: 0 }));
    return true;
  }

  if (msg.type === "bwc-stats-saved" && sender.tab?.id) {
    const tabId = sender.tab.id;
    chrome.storage.session.get({ [SESSION_TAB]: null }).then(async (session) => {
      if (session[SESSION_TAB] === tabId) {
        await setProgress({ completed: ((await getProgress())?.completed ?? 0) + 1 });
        await chrome.storage.session.set({ [SESSION_TAB]: null });
        await chrome.tabs.remove(tabId).catch(() => {});
        await openNextRefreshTab();
      }
    });
  }
});
