import "./styles.css";
import { initFileHandler } from "./file-handler";
import { initUiEnhancer } from "./ui-enhancer";
import { initAssignmentTracker } from "./assignment-tracker";
import { initCourseOverview } from "./course-overview";
import { DEFAULT_SETTINGS } from "../types";
import type { ExtensionSettings } from "../types";

async function loadSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
      resolve(items as ExtensionSettings);
    });
  });
}

async function main(): Promise<void> {
  const settings = await loadSettings();

  // File handler runs in all frames (catches clicks/window.open inside iframes too)
  if (settings.enableFileHandler) {
    initFileHandler();
  }

  // UI features only apply to the top-level page
  if (window === window.top) {
    if (settings.enableUiEnhancer) {
      initUiEnhancer(settings);
    }

    if (settings.enableAssignmentTracker) {
      await initAssignmentTracker();
      initCourseOverview();
    }
  }
}

main();
