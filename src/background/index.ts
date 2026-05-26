import { DEFAULT_SETTINGS } from "../types";

const SCRIPT_ID = "bwc-main";

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

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === "install") {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
  }
  // Re-register on install/update in case registration was lost
  const { webclassUrl } = await chrome.storage.sync.get({ webclassUrl: "" });
  await registerScript(webclassUrl as string);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "bwc-update-url") {
    registerScript(msg.url as string)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
});
