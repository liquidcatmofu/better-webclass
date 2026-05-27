import { DEFAULT_SETTINGS } from "../types";
import type { ExtensionSettings } from "../types";

const SESSION_PROGRESS = "bwcRefreshProgress";

interface RefreshProgress {
  total: number;
  completed: number;
  isRunning: boolean;
}

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
    enableAutoRefresh: getEl<HTMLInputElement>("enable-auto-refresh").checked,
    autoRefreshInterval: Number(getEl<HTMLSelectElement>("auto-refresh-interval").value),
  };
}

function applyToForm(settings: ExtensionSettings): void {
  getEl<HTMLInputElement>("webclass-url").value = settings.webclassUrl;
  getEl<HTMLInputElement>("enable-file-handler").checked = settings.enableFileHandler;
  getEl<HTMLInputElement>("enable-ui-enhancer").checked = settings.enableUiEnhancer;
  getEl<HTMLInputElement>("enable-assignment-tracker").checked = settings.enableAssignmentTracker;
  getEl<HTMLInputElement>("enable-auto-refresh").checked = settings.enableAutoRefresh;
  getEl<HTMLSelectElement>("auto-refresh-interval").value = String(settings.autoRefreshInterval);
  updateIntervalVisibility(settings.enableAutoRefresh);
}

function updateIntervalVisibility(enabled: boolean): void {
  getEl("auto-refresh-interval-field").style.display = enabled ? "" : "none";
}

function showStatus(msg: string, color = "#16a34a"): void {
  const el = getEl("save-status");
  el.textContent = msg;
  el.style.color = color;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 2500);
}

function renderProgress(prog: RefreshProgress | null): void {
  const el = getEl("refresh-progress");
  if (!prog || (!prog.isRunning && prog.completed === 0)) {
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

async function init(): Promise<void> {
  const items = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  applyToForm(items as ExtensionSettings);

  // Show current progress on open
  const localData = await chrome.storage.local.get({ [SESSION_PROGRESS]: null });
  renderProgress(localData[SESSION_PROGRESS] as RefreshProgress | null);

  // Live progress updates while popup is open
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[SESSION_PROGRESS]) {
      renderProgress(changes[SESSION_PROGRESS].newValue as RefreshProgress | null);
    }
  });

  getEl<HTMLInputElement>("enable-auto-refresh").addEventListener("change", (e) => {
    updateIntervalVisibility((e.target as HTMLInputElement).checked);
  });

  getEl("use-current-tab-btn").addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        getEl<HTMLInputElement>("webclass-url").value = new URL(tab.url).origin;
      }
    } catch { /**/ }
  });

  getEl("save-btn").addEventListener("click", async () => {
    const settings = readForm();

    // Start saving without awaiting: Firefox requires permissions.request() to be
    // called with no prior await (user gesture context), while Chrome closes the
    // popup during the dialog so storage must be in-flight before request() runs.
    // Browser storage writes complete even if the popup is destroyed mid-flight.
    const savePromise = chrome.storage.sync.set(settings);

    if (settings.webclassUrl) {
      try {
        const origin = new URL(settings.webclassUrl).origin;
        await chrome.permissions.request({ origins: [`${origin}/*`] });
      } catch { /**/ }
    }

    await savePromise;

    // These run when the popup stays open (Firefox, or permission already granted).
    // On Chrome first-save the background handles registration via permissions.onAdded.
    try {
      await chrome.runtime.sendMessage({
        type: "bwc-update-url",
        url: settings.webclassUrl,
      });
    } catch { /**/ }

    try {
      await chrome.runtime.sendMessage({ type: "bwc-setup-alarm" });
    } catch { /**/ }

    showStatus("保存しました ✓");
  });

  getEl("refresh-now-btn").addEventListener("click", async () => {
    try {
      const result = await chrome.runtime.sendMessage({ type: "bwc-refresh-now" }) as
        { started: boolean; courseCount: number };
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
