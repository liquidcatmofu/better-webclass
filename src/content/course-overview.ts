import type { CourseSummary } from "../types";

const STORAGE_KEY = "bwc-course-data";
const SESSION_PROGRESS = "bwcRefreshProgress";

interface RefreshProgress {
  total: number;
  completed: number;
  isRunning: boolean;
}

function courseIdFromHref(href: string | null): string | null {
  if (!href) return null;
  const m = href.match(/\/course\.php\/([^/?]+)/);
  return m ? m[1] : null;
}

function formatNearest(ts: number): string {
  const diffMs = ts - Date.now();
  if (diffMs <= 0) return "";
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `あと${days}日${hours}時間` : `あと${days}日`;
  if (hours > 0) return minutes > 0 ? `あと${hours}時間${minutes}分` : `あと${hours}時間`;
  return `あと${minutes}分`;
}

function injectStats(link: HTMLAnchorElement, stats: CourseSummary): void {
  link.querySelector(".bwc-course-stats")?.remove();
  if (stats.pending === 0 && stats.overdue === 0) return;

  const el = document.createElement("div");
  el.className = "bwc-course-stats";

  if (stats.overdue > 0) {
    const span = document.createElement("span");
    span.className = "bwc-cs-overdue";
    span.textContent = `期限切れ ${stats.overdue}件`;
    el.appendChild(span);
  }
  if (stats.pending > 0) {
    const span = document.createElement("span");
    span.className = "bwc-cs-pending";
    const nearStr = stats.nearestDeadline ? ` · ${formatNearest(stats.nearestDeadline)}` : "";
    span.textContent = `未提出 ${stats.pending}件${nearStr}`;
    el.appendChild(span);
  }

  link.appendChild(el);
}

function allCourseLinks(): HTMLAnchorElement[] {
  return [...document.querySelectorAll<HTMLAnchorElement>("a[href*='/course.php/']")];
}

function renderProgress(statusEl: HTMLElement, prog: RefreshProgress | null): void {
  if (!prog || (!prog.isRunning && prog.completed === 0)) {
    statusEl.textContent = "";
    statusEl.hidden = true;
    return;
  }
  statusEl.hidden = false;
  if (prog.isRunning) {
    statusEl.textContent = `更新中… ${prog.completed} / ${prog.total} コース`;
    statusEl.className = "bwc-overview-status running";
  } else {
    statusEl.textContent = `更新完了 (${prog.completed} / ${prog.total})`;
    statusEl.className = "bwc-overview-status done";
  }
}

function injectRefreshButton(): void {
  if (document.getElementById("bwc-refresh-bar")) return;

  const scheduleTable = document.getElementById("schedule-table");
  const anchor = scheduleTable?.closest(".table-responsive") ?? scheduleTable;
  if (!anchor?.parentElement) return;

  const bar = document.createElement("div");
  bar.id = "bwc-refresh-bar";

  const btn = document.createElement("button");
  btn.className = "bwc-btn bwc-btn-secondary";
  btn.textContent = "課題データを更新";

  const statusEl = document.createElement("span");
  statusEl.className = "bwc-overview-status";
  statusEl.hidden = true;

  bar.appendChild(btn);
  bar.appendChild(statusEl);
  anchor.parentElement.insertBefore(bar, anchor);

  // Show current progress on load
  chrome.storage.local.get({ [SESSION_PROGRESS]: null }, (data) => {
    renderProgress(statusEl, data[SESSION_PROGRESS] as RefreshProgress | null);
  });

  btn.addEventListener("click", async () => {
    try {
      const result = await chrome.runtime.sendMessage({ type: "bwc-refresh-now" }) as
        { started: boolean; courseCount: number };
      if (!result.started) {
        statusEl.textContent = "すでに更新中か、コース情報がありません";
        statusEl.className = "bwc-overview-status";
        statusEl.hidden = false;
      }
    } catch { /**/ }
  });

  // Live progress updates
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[SESSION_PROGRESS]) {
      renderProgress(statusEl, changes[SESSION_PROGRESS].newValue as RefreshProgress | null);
    }
  });
}

export function initCourseOverview(): void {
  if (!document.getElementById("schedule-table") && !document.getElementById("courses_list_left")) return;

  // Save course URLs so background can auto-refresh them
  const urls = [...new Set(allCourseLinks().map((a) => a.href))];
  chrome.storage.local.set({ "bwc-course-urls": urls });

  injectRefreshButton();

  // Initial render from cache
  chrome.storage.local.get({ [STORAGE_KEY]: {} }, (data) => {
    const allStats = data[STORAGE_KEY] as Record<string, CourseSummary>;
    allCourseLinks().forEach((link) => {
      const courseId = courseIdFromHref(link.getAttribute("href"));
      if (!courseId) return;
      const stats = allStats[courseId];
      if (stats) injectStats(link, stats);
    });
  });

  // Live update as background tabs finish refreshing
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    const allStats = changes[STORAGE_KEY].newValue as Record<string, CourseSummary>;
    allCourseLinks().forEach((link) => {
      const courseId = courseIdFromHref(link.getAttribute("href"));
      if (!courseId || !allStats[courseId]) return;
      injectStats(link, allStats[courseId]);
    });
  });
}
