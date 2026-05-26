import { DEFAULT_SETTINGS } from "../types";
import type { ExtensionSettings } from "../types";

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as T;
}

function readForm(): ExtensionSettings {
  return {
    webclassUrl: getEl<HTMLInputElement>("webclass-url").value.trim(),
    enableFileHandler: getEl<HTMLInputElement>("enable-file-handler").checked,
    enableUiEnhancer: getEl<HTMLInputElement>("enable-ui-enhancer").checked,
    enableAssignmentTracker: getEl<HTMLInputElement>("enable-assignment-tracker").checked,
  };
}

function applyToForm(settings: ExtensionSettings): void {
  getEl<HTMLInputElement>("webclass-url").value = settings.webclassUrl;
  getEl<HTMLInputElement>("enable-file-handler").checked = settings.enableFileHandler;
  getEl<HTMLInputElement>("enable-ui-enhancer").checked = settings.enableUiEnhancer;
  getEl<HTMLInputElement>("enable-assignment-tracker").checked = settings.enableAssignmentTracker;
}

function showSaved(): void {
  const status = getEl("save-status");
  status.hidden = false;
  setTimeout(() => { status.hidden = true; }, 2000);
}

async function init(): Promise<void> {
  const items = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  applyToForm(items as ExtensionSettings);

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
    } catch { /**/ }

    showSaved();
  });
}

init();
