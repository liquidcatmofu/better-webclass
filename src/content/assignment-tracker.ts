// WebClass course page selectors (confirmed via DevTools inspection):
//   Row container : .cl-contentsList_listGroupItem
//   Title         : .cm-contentsList_contentName
//   Date/deadline : .cm-contentsList_contentDetailListItemData
//   Resubmit warn : .text-danger (text: "再提出が必要です。")
//   Category      : .cl-contentsList_categoryLabel

import type { Assignment, CourseSummary } from "../types";

const EXCLUDED_TYPES = new Set(["資料"]);

// Date format in WebClass: "YYYY/MM/DD HH:MM - YYYY/MM/DD HH:MM" or "締め切り: YYYY/MM/DD HH:MM"
function parseWebClassDate(text: string): Date | null {
  const deadlineMatch = text.match(/締め切り[：:]\s*(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
  if (deadlineMatch) {
    const [, y, mo, d, h, mi] = deadlineMatch;
    return new Date(+y, +mo - 1, +d, +h, +mi);
  }

  // Use the END date of a range as the deadline
  const rangeMatch = text.match(/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2} - (\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})/);
  if (rangeMatch) {
    const [, y, mo, d, h, mi] = rangeMatch;
    return new Date(+y, +mo - 1, +d, +h, +mi);
  }

  return null;
}

function calendarDaysUntil(deadline: Date, now: Date): number {
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlineMidnight = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  return Math.round((deadlineMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
}

function getUrgencyClass(deadline: Date | null, submitted: boolean): string {
  if (submitted) return "bwc-status-submitted";
  if (!deadline) return "";

  const now = new Date();
  if (deadline.getTime() < now.getTime()) return "bwc-status-overdue";

  const days = calendarDaysUntil(deadline, now);
  if (days === 0) return "bwc-status-urgent";
  if (days <= 3) return "bwc-status-warning";
  return "bwc-status-ok";
}

function formatLabel(deadline: Date, submitted: boolean): string {
  if (submitted) return "✓ 提出済";
  const now = new Date();
  if (deadline.getTime() <= now.getTime()) return "期限切れ";

  const days = calendarDaysUntil(deadline, now);
  if (days === 0) {
    const h = deadline.getHours();
    const m = deadline.getMinutes();
    if (h === 23 && m === 59) return "今日中";
    return `今日${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}まで`;
  }
  if (days === 1) return "明日まで";
  return `あと ${days} 日`;
}

function formatRemainingTime(deadline: Date): string {
  const diffMs = deadline.getTime() - Date.now();
  if (diffMs <= 0) return "";

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return hours > 0 ? `あと${days}日${hours}時間` : `あと${days}日`;
  if (hours > 0) return minutes > 0 ? `あと${hours}時間${minutes}分` : `あと${hours}時間`;
  return `あと${minutes}分`;
}

// Fetch /scores page and return Map<title, isSubmitted>
async function fetchSubmissionStatus(courseId: string): Promise<Map<string, boolean>> {
  try {
    const url = `${window.location.origin}/webclass/course.php/${courseId}/scores`;
    const resp = await fetch(url, { credentials: "include" });
    if (!resp.ok) return new Map();

    const doc = new DOMParser().parseFromString(await resp.text(), "text/html");
    const table = doc.getElementById("PersonalScoreSheet");
    if (!table) return new Map();

    const result = new Map<string, boolean>();
    for (const row of table.querySelectorAll<HTMLTableRowElement>("tr")) {
      // contents-title is on a TH element, not TD
      const titleCell = row.querySelector<HTMLElement>(".contents-title");
      if (!titleCell) continue;
      // Score is in the first TD of the row (TH is the title cell)
      const scoreCell = row.querySelector<HTMLElement>("td");
      if (!scoreCell) continue;

      const title = titleCell.textContent?.trim() ?? "";
      if (!title) continue;

      const score = scoreCell.textContent?.trim() ?? "";
      // "未" = not submitted; anything else (number, *[N]) = submitted
      result.set(title, score !== "未" && score !== "");
    }
    return result;
  } catch {
    return new Map();
  }
}

function rowTitle(row: HTMLElement): string {
  const nameEl = row.querySelector<HTMLElement>(".cm-contentsList_contentName");
  if (!nameEl) return "";
  // Prefer link text or inner div (excludes "New" badge from .cl-contentsList_new)
  const inner = nameEl.querySelector<HTMLElement>("a, div:not(.cl-contentsList_new)");
  return (inner ?? nameEl).textContent?.trim() ?? "";
}

function parseRow(row: HTMLElement, submissionStatus: Map<string, boolean>): Assignment | null {
  const title = rowTitle(row);
  if (!title) return null;

  const category = row.querySelector<HTMLElement>(".cl-contentsList_categoryLabel")?.textContent?.trim() ?? "";
  if (EXCLUDED_TYPES.has(category)) return null;

  const dataEls = row.querySelectorAll<HTMLElement>(".cm-contentsList_contentDetailListItemData");
  let deadline: Date | null = null;
  for (const el of dataEls) {
    const parsed = parseWebClassDate(el.textContent ?? "");
    if (parsed) { deadline = parsed; break; }
  }

  const hasResubmitWarning = !!row.querySelector(".text-danger");

  let submitted: boolean;
  if (hasResubmitWarning) {
    submitted = false;
  } else if (submissionStatus.has(title)) {
    submitted = submissionStatus.get(title)!;
  } else {
    submitted = /提出済/.test(row.textContent ?? "");
  }

  const course = document.querySelector<HTMLElement>(".course-title, h1, h2")?.textContent?.trim() ?? "";
  return { title, course, deadline, submitted, element: row };
}

function injectBadge(assignment: Assignment): void {
  if (!assignment.deadline && !assignment.submitted) return;

  const urgencyClass = getUrgencyClass(assignment.deadline, assignment.submitted);
  if (!urgencyClass) return;

  const badge = document.createElement("span");
  badge.className = `bwc-badge ${urgencyClass}`;
  badge.textContent = assignment.submitted
    ? "✓ 提出済"
    : assignment.deadline
    ? formatLabel(assignment.deadline, assignment.submitted)
    : "";

  const titleEl = assignment.element.querySelector(".cm-contentsList_contentName");
  titleEl?.insertAdjacentElement("afterend", badge);

  if (!assignment.submitted && assignment.deadline) {
    const remaining = formatRemainingTime(assignment.deadline);
    if (remaining) {
      const timeEl = document.createElement("span");
      timeEl.className = "bwc-time-remaining";
      timeEl.textContent = remaining;
      badge.insertAdjacentElement("afterend", timeEl);
    }
  }

  assignment.element.classList.add("bwc-assignment-row", urgencyClass);
}

function saveCourseStats(assignments: Assignment[]): void {
  const m = window.location.pathname.match(/\/course\.php\/([^/]+)/);
  if (!m) return;
  const courseId = m[1];

  const now = Date.now();
  let pending = 0, overdue = 0, submitted = 0;
  let nearestDeadline: number | null = null;

  for (const a of assignments) {
    if (a.submitted) { submitted++; continue; }
    if (!a.deadline) continue;
    if (a.deadline.getTime() < now) {
      overdue++;
    } else {
      pending++;
      if (nearestDeadline === null || a.deadline.getTime() < nearestDeadline) {
        nearestDeadline = a.deadline.getTime();
      }
    }
  }

  const summary: CourseSummary = { courseId, pending, overdue, submitted, nearestDeadline, updatedAt: now };
  chrome.storage.local.get({ "bwc-course-data": {} }, (data) => {
    const all = data["bwc-course-data"] as Record<string, CourseSummary>;
    all[courseId] = summary;
    chrome.storage.local.set({ "bwc-course-data": all }, () => {
      chrome.runtime.sendMessage({ type: "bwc-stats-saved" }).catch(() => {});
    });
  });
}

export async function initAssignmentTracker(): Promise<void> {
  const m = window.location.pathname.match(/\/course\.php\/([^/]+)/);
  const courseId = m?.[1] ?? null;

  const submissionStatus = courseId ? await fetchSubmissionStatus(courseId) : new Map<string, boolean>();

  const rows = document.querySelectorAll<HTMLElement>(".cl-contentsList_listGroupItem");
  const assignments: Assignment[] = [];
  rows.forEach((row) => {
    const parsed = parseRow(row, submissionStatus);
    if (parsed) {
      injectBadge(parsed);
      assignments.push(parsed);
    }
  });
  saveCourseStats(assignments);
}
