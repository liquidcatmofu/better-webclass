(function() {
  "use strict";
  function isPdfUrl(url) {
    const decoded = decodeURIComponent(url).toLowerCase();
    return decoded.includes(".pdf");
  }
  async function resolveActualUrl(url) {
    try {
      const head = await fetch(url, { method: "HEAD" });
      const contentType = head.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) return url;
      const resp = await fetch(url);
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const link = Array.from(doc.querySelectorAll("a[href]")).find((a) => !a.getAttribute("href").startsWith("javascript:"));
      if (link) return new URL(link.getAttribute("href"), resp.url).href;
    } catch {
    }
    return url;
  }
  function isWebClassFileLink(url) {
    return url.includes("/my-reports/download") || url.includes("/file_down.php");
  }
  function downloadDirect(url) {
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  function getFilename(url) {
    var _a;
    try {
      const params = new URLSearchParams(new URL(url).search);
      const name = params.get("file_name");
      if (name) return decodeURIComponent(name);
    } catch {
    }
    return decodeURIComponent(((_a = url.split("/").pop()) == null ? void 0 : _a.split("?")[0]) ?? "document.pdf");
  }
  function sanitizeFilename(name) {
    const clean = name.replace(/[\\/:*?"<>|]/g, "_").trim();
    if (!clean) return "document.pdf";
    return /\.pdf$/i.test(clean) ? clean : clean + ".pdf";
  }
  function getFilenameFromContentDisposition(cd) {
    if (!cd) return null;
    const starMatch = cd.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''\s*([^;]+)/i);
    if (starMatch) return decodeURIComponent(starMatch[1].trim());
    const quoted = cd.match(/filename\s*=\s*"([^"]+)"/i);
    if (quoted) return quoted[1];
    const plain = cd.match(/filename\s*=\s*([^;"\s][^;]*)/i);
    if (plain) return plain[1].trim();
    return null;
  }
  function showMessageModal(url) {
    var _a, _b;
    (_a = document.getElementById("bwc-msg-modal")) == null ? void 0 : _a.remove();
    const overlay = document.createElement("div");
    overlay.id = "bwc-msg-modal";
    overlay.className = "bwc-modal-overlay";
    overlay.innerHTML = `
    <div class="bwc-modal bwc-modal-message" role="dialog" aria-label="メッセージ">
      <div class="bwc-modal-header">
        <span class="bwc-modal-title">メッセージ</span>
        <div class="bwc-modal-actions">
          <button class="bwc-btn bwc-btn-close" aria-label="閉じる">✕</button>
        </div>
      </div>
      <div class="bwc-modal-body">
        <iframe src="${url}" class="bwc-msg-iframe" title="メッセージ"></iframe>
      </div>
    </div>
  `;
    const closeModal = () => {
      overlay.remove();
      location.reload();
    };
    (_b = overlay.querySelector(".bwc-btn-close")) == null ? void 0 : _b.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);
  }
  async function showPdfModal(url, filenameHint) {
    var _a, _b;
    (_a = document.getElementById("bwc-pdf-modal")) == null ? void 0 : _a.remove();
    let filename = filenameHint ? sanitizeFilename(filenameHint) : getFilename(url);
    const overlay = document.createElement("div");
    overlay.id = "bwc-pdf-modal";
    overlay.className = "bwc-modal-overlay";
    overlay.innerHTML = `
    <div class="bwc-modal" role="dialog" aria-label="PDF ビューアー">
      <div class="bwc-modal-header">
        <span class="bwc-modal-title"></span>
        <div class="bwc-modal-actions">
          <button class="bwc-btn bwc-btn-secondary bwc-btn-download" disabled>ダウンロード</button>
          <button class="bwc-btn bwc-btn-secondary bwc-btn-newtab" disabled>別タブで開く</button>
          <button class="bwc-btn bwc-btn-close" aria-label="閉じる">✕</button>
        </div>
      </div>
      <div class="bwc-modal-body">
        <div class="bwc-pdf-loading">読み込み中...</div>
        <iframe class="bwc-pdf-iframe" title="PDF ビューアー"></iframe>
      </div>
    </div>
  `;
    const titleEl = overlay.querySelector(".bwc-modal-title");
    titleEl.append("📄 " + filename);
    let objectUrl = null;
    const closeModal = () => {
      overlay.remove();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    (_b = overlay.querySelector(".bwc-btn-close")) == null ? void 0 : _b.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);
    try {
      const resp = await fetch(url);
      const cdFilename = getFilenameFromContentDisposition(resp.headers.get("content-disposition"));
      if (cdFilename) {
        filename = cdFilename;
        titleEl.textContent = "📄 " + filename;
      }
      const blob = await resp.blob();
      objectUrl = URL.createObjectURL(blob);
      const iframe = overlay.querySelector(".bwc-pdf-iframe");
      const loading = overlay.querySelector(".bwc-pdf-loading");
      iframe.src = objectUrl;
      loading.remove();
      const dlBtn = overlay.querySelector(".bwc-btn-download");
      dlBtn.disabled = false;
      dlBtn.addEventListener("click", () => {
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
      const newTabBtn = overlay.querySelector(".bwc-btn-newtab");
      newTabBtn.disabled = false;
      newTabBtn.addEventListener("click", () => window.open(objectUrl, "_blank"));
    } catch {
      const loading = overlay.querySelector(".bwc-pdf-loading");
      if (loading) loading.textContent = "読み込みに失敗しました";
    }
  }
  function findTitlesAcrossFrames(top) {
    const titles = [];
    function collect(win) {
      var _a;
      try {
        const t = (_a = win.document.title) == null ? void 0 : _a.trim();
        if (t) titles.push(t);
      } catch {
      }
      try {
        for (let i = 0; i < win.frames.length; i++) collect(win.frames[i]);
      } catch {
      }
    }
    collect(top);
    const isGeneric = (t) => /^(upper\s*navi|webclass|loading|home|index|frame|navi|menu|pdf\.?js\s*viewer)(\s*[-–]\s*webclass)?$/i.test(t);
    const cleaned = titles.map((t) => t.replace(/\s*[-–]\s*WebClass\s*$/i, "").trim()).filter((t) => t.length > 2 && !isGeneric(t));
    return {
      course: cleaned[0] ?? "",
      section: cleaned.length > 1 ? cleaned[cleaned.length - 1] : ""
    };
  }
  function findCloseButtonInFrameTree(win) {
    var _a, _b;
    try {
      const sel = "input[type='button'], input[type='submit'], button, a";
      for (const el of win.document.querySelectorAll(sel)) {
        const text = ((_a = el.textContent) == null ? void 0 : _a.trim()) || ((_b = el.value) == null ? void 0 : _b.trim()) || "";
        if (text.includes("資料を閉じる")) return { el, doc: win.document };
      }
    } catch {
      return null;
    }
    for (let i = 0; i < win.frames.length; i++) {
      const result = findCloseButtonInFrameTree(win.frames[i]);
      if (result) return result;
    }
    return null;
  }
  function createDlButton(doc, id, label, pdfUrl, filename) {
    const btn = doc.createElement("button");
    btn.id = id;
    btn.className = "bwc-btn bwc-btn-secondary bwc-resource-dl";
    btn.textContent = label;
    btn.title = filename;
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.disabled = true;
      try {
        const resp = await fetch(pdfUrl);
        const cdFilename = getFilenameFromContentDisposition(resp.headers.get("content-disposition"));
        const blob = await resp.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = doc.createElement("a");
        a.href = objectUrl;
        a.download = cdFilename ?? filename;
        doc.body.appendChild(a);
        a.click();
        doc.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      } catch {
      } finally {
        btn.disabled = false;
      }
    });
    return btn;
  }
  function injectDlButtonsNextToClose(el, doc, pdfUrl, course, section) {
    if (doc.getElementById("bwc-resource-dl-section")) return;
    const sectionName = section || course;
    const sectionBtn = createDlButton(
      doc,
      "bwc-resource-dl-section",
      "↓ DL",
      pdfUrl,
      sanitizeFilename(sectionName || getFilename(pdfUrl))
    );
    el.insertAdjacentElement("afterend", sectionBtn);
    if (course && section) {
      const fullName = sanitizeFilename(course + "_" + section);
      const courseBtn = createDlButton(doc, "bwc-resource-dl-course", "↓ 科目名DL", pdfUrl, fullName);
      sectionBtn.insertAdjacentElement("afterend", courseBtn);
    }
  }
  function injectResourceDownloadButtons() {
    document.querySelectorAll("a[target='_blank'][href]").forEach((link) => {
      if (!isPdfUrl(link.href)) return;
      if (link.dataset.bwcDl) return;
      link.dataset.bwcDl = "1";
      const top = window.top ?? window;
      const closeResult = findCloseButtonInFrameTree(top);
      const { course, section } = findTitlesAcrossFrames(top);
      if (closeResult) {
        injectDlButtonsNextToClose(closeResult.el, closeResult.doc, link.href, course, section);
      } else {
        const name = section || course || getFilename(link.href);
        const btn = createDlButton(
          document,
          "bwc-resource-dl-section",
          "↓ DL",
          link.href,
          sanitizeFilename(name)
        );
        link.insertAdjacentElement("afterend", btn);
      }
    });
  }
  function initFileHandler() {
    const originalOpen = window.open.bind(window);
    window.open = (url, target, features) => {
      if (!url) return originalOpen(url, target, features);
      const urlStr = url.toString();
      if (target === "msgeditor") {
        showMessageModal(urlStr);
        return null;
      }
      if (target === "download" || features && features.includes("width=320")) {
        if (isPdfUrl(urlStr)) {
          resolveActualUrl(urlStr).then((resolved) => showPdfModal(resolved));
        } else {
          downloadDirect(urlStr);
        }
        return null;
      }
      return originalOpen(url, target, features);
    };
    document.addEventListener(
      "click",
      (e) => {
        var _a, _b;
        const link = e.target.closest("a[href]");
        if (!link) return;
        if (link.closest("#bwc-pdf-modal") || link.closest("#bwc-msg-modal")) return;
        if (link.target === "msgeditor") {
          e.preventDefault();
          e.stopPropagation();
          showMessageModal(link.href);
          return;
        }
        const href = link.href;
        const isDownloadTarget = link.target === "download";
        const hasFiledownloadOnclick = ((_a = link.getAttribute("onclick")) == null ? void 0 : _a.includes("filedownload")) ?? false;
        if ((isDownloadTarget || hasFiledownloadOnclick) && isPdfUrl(href)) {
          e.preventDefault();
          e.stopPropagation();
          const hint = ((_b = link.textContent) == null ? void 0 : _b.trim()) || void 0;
          resolveActualUrl(href).then((resolved) => showPdfModal(resolved, hint));
          return;
        }
        if ((isDownloadTarget || hasFiledownloadOnclick) && !isPdfUrl(href)) {
          e.preventDefault();
          e.stopPropagation();
          downloadDirect(href);
          return;
        }
        if (!isDownloadTarget && !hasFiledownloadOnclick && isWebClassFileLink(href) && isPdfUrl(href)) {
          e.preventDefault();
          e.stopPropagation();
          resolveActualUrl(href).then((resolved) => showPdfModal(resolved));
        }
      },
      true
    );
    injectResourceDownloadButtons();
    const dlRoot = document.body ?? document.documentElement;
    if (dlRoot) {
      const observer = new MutationObserver(() => {
        observer.disconnect();
        injectResourceDownloadButtons();
        observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true });
      });
      observer.observe(dlRoot, { childList: true, subtree: true });
    }
  }
  function injectToolbar() {
    var _a;
    if (document.getElementById("bwc-toolbar")) return;
    const toolbar = document.createElement("div");
    toolbar.id = "bwc-toolbar";
    toolbar.innerHTML = `
    <button class="bwc-toolbar-btn" title="トップへ戻る" id="bwc-to-top">↑</button>
  `;
    (_a = toolbar.querySelector("#bwc-to-top")) == null ? void 0 : _a.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    document.body.appendChild(toolbar);
  }
  function enhanceTables() {
    const tables = document.querySelectorAll("table:not(.bwc-enhanced)");
    tables.forEach((table) => {
      table.classList.add("bwc-enhanced");
      table.querySelectorAll("tr:nth-child(even)").forEach((row) => {
        row.classList.add("bwc-row-alt");
      });
    });
  }
  function enhanceTitles() {
    const titleCandidates = document.querySelectorAll(
      "h1, h2, h3, .title, .page-title, td.title"
    );
    titleCandidates.forEach((el) => {
      if (el.textContent && el.textContent.trim().length > 0) {
        el.classList.add("bwc-title");
      }
    });
  }
  function updateGroupSummary(folder) {
    const header = folder.querySelector(".panel-heading.bwc-collapsible");
    const body = folder.querySelector(".list-group");
    if (!header || !body) return;
    const items = body.querySelectorAll(".cl-contentsList_listGroupItem");
    const countEl = header.querySelector(".bwc-group-count");
    if (countEl) countEl.textContent = `${items.length}件`;
    const summaryEl = header.querySelector(".bwc-group-summary");
    if (!summaryEl) return;
    summaryEl.innerHTML = "";
    body.querySelectorAll(".bwc-badge").forEach((badge) => {
      summaryEl.appendChild(badge.cloneNode(true));
    });
  }
  function injectCollapseControls() {
    var _a, _b, _c;
    if (document.getElementById("bwc-collapse-controls")) return;
    const firstFolder = document.querySelector(".cl-contentsList_folder");
    if (!firstFolder) return;
    const controls = document.createElement("div");
    controls.id = "bwc-collapse-controls";
    controls.innerHTML = `
    <button class="bwc-text-btn" id="bwc-collapse-all">すべて縮小</button>
    <span class="bwc-divider">|</span>
    <button class="bwc-text-btn" id="bwc-expand-all">すべて展開</button>
  `;
    (_a = firstFolder.parentElement) == null ? void 0 : _a.insertBefore(controls, firstFolder);
    (_b = controls.querySelector("#bwc-collapse-all")) == null ? void 0 : _b.addEventListener("click", () => {
      document.querySelectorAll(".cl-contentsList_folder").forEach((f) => {
        var _a2, _b2;
        (_a2 = f.querySelector(".panel-heading")) == null ? void 0 : _a2.classList.add("bwc-group-collapsed");
        (_b2 = f.querySelector(".list-group")) == null ? void 0 : _b2.classList.add("bwc-group-collapsed");
      });
    });
    (_c = controls.querySelector("#bwc-expand-all")) == null ? void 0 : _c.addEventListener("click", () => {
      document.querySelectorAll(".cl-contentsList_folder").forEach((f) => {
        var _a2, _b2;
        (_a2 = f.querySelector(".panel-heading")) == null ? void 0 : _a2.classList.remove("bwc-group-collapsed");
        (_b2 = f.querySelector(".list-group")) == null ? void 0 : _b2.classList.remove("bwc-group-collapsed");
      });
    });
  }
  function initGroupCollapse() {
    document.querySelectorAll(".cl-contentsList_folder").forEach((folder) => {
      const header = folder.querySelector(".panel-heading");
      const body = folder.querySelector(".list-group");
      if (!header || !body || header.classList.contains("bwc-collapsible")) return;
      header.classList.add("bwc-collapsible");
      const count = document.createElement("span");
      count.className = "bwc-group-count";
      const summary = document.createElement("span");
      summary.className = "bwc-group-summary";
      const icon = document.createElement("span");
      icon.className = "bwc-collapse-icon";
      icon.setAttribute("aria-hidden", "true");
      header.appendChild(count);
      header.appendChild(summary);
      header.appendChild(icon);
      header.addEventListener("click", () => {
        const collapsed = body.classList.toggle("bwc-group-collapsed");
        header.classList.toggle("bwc-group-collapsed", collapsed);
      });
      updateGroupSummary(folder);
    });
    injectCollapseControls();
  }
  function initUiEnhancer(settings) {
    injectToolbar();
    enhanceTables();
    enhanceTitles();
    initGroupCollapse();
    const observer = new MutationObserver(() => {
      observer.disconnect();
      enhanceTables();
      initGroupCollapse();
      document.querySelectorAll(".cl-contentsList_folder").forEach(updateGroupSummary);
      observer.observe(document.body, { childList: true, subtree: true });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function parseWebClassDate(text) {
    const deadlineMatch = text.match(/締め切り[：:]\s*(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
    if (deadlineMatch) {
      const [, y, mo, d, h, mi] = deadlineMatch;
      return new Date(+y, +mo - 1, +d, +h, +mi);
    }
    const rangeMatch = text.match(/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2} - (\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})/);
    if (rangeMatch) {
      const [, y, mo, d, h, mi] = rangeMatch;
      return new Date(+y, +mo - 1, +d, +h, +mi);
    }
    return null;
  }
  function calendarDaysUntil(deadline, now) {
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const deadlineMidnight = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
    return Math.round((deadlineMidnight.getTime() - todayMidnight.getTime()) / (1e3 * 60 * 60 * 24));
  }
  function getUrgencyClass(deadline, submitted) {
    if (submitted) return "bwc-status-submitted";
    if (!deadline) return "";
    const now = /* @__PURE__ */ new Date();
    if (deadline.getTime() < now.getTime()) return "bwc-status-overdue";
    const days = calendarDaysUntil(deadline, now);
    if (days === 0) return "bwc-status-urgent";
    if (days <= 3) return "bwc-status-warning";
    return "bwc-status-ok";
  }
  function formatLabel(deadline, submitted) {
    if (submitted) return "✓ 提出済";
    const now = /* @__PURE__ */ new Date();
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
  function formatRemainingTime(deadline) {
    const diffMs = deadline.getTime() - Date.now();
    if (diffMs <= 0) return "";
    const totalMinutes = Math.floor(diffMs / 6e4);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor(totalMinutes % 1440 / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return hours > 0 ? `あと${days}日${hours}時間` : `あと${days}日`;
    if (hours > 0) return minutes > 0 ? `あと${hours}時間${minutes}分` : `あと${hours}時間`;
    return `あと${minutes}分`;
  }
  const EXCLUDED_TYPES = /* @__PURE__ */ new Set(["資料"]);
  function parseRow(row) {
    var _a, _b, _c, _d, _e;
    const titleEl = row.querySelector(".cm-contentsList_contentName");
    if (!titleEl) return null;
    const category = ((_b = (_a = row.querySelector(".cl-contentsList_categoryLabel")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) ?? "";
    if (EXCLUDED_TYPES.has(category)) return null;
    const dataEls = row.querySelectorAll(".cm-contentsList_contentDetailListItemData");
    let deadline = null;
    for (const el of dataEls) {
      const parsed = parseWebClassDate(el.textContent ?? "");
      if (parsed) {
        deadline = parsed;
        break;
      }
    }
    const hasResubmitWarning = !!row.querySelector(".text-danger");
    const submitted = !hasResubmitWarning && /提出済/.test(row.textContent ?? "");
    const course = ((_d = (_c = document.querySelector(".course-title, h1, h2")) == null ? void 0 : _c.textContent) == null ? void 0 : _d.trim()) ?? "";
    return {
      title: ((_e = titleEl.textContent) == null ? void 0 : _e.trim()) ?? "",
      course,
      deadline,
      submitted,
      element: row
    };
  }
  function injectBadge(assignment) {
    if (!assignment.deadline && !assignment.submitted) return;
    const urgencyClass = getUrgencyClass(assignment.deadline, assignment.submitted);
    if (!urgencyClass) return;
    const badge = document.createElement("span");
    badge.className = `bwc-badge ${urgencyClass}`;
    badge.textContent = assignment.submitted ? "✓ 提出済" : assignment.deadline ? formatLabel(assignment.deadline, assignment.submitted) : "";
    const titleEl = assignment.element.querySelector(".cm-contentsList_contentName");
    titleEl == null ? void 0 : titleEl.insertAdjacentElement("afterend", badge);
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
  function saveCourseStats(assignments) {
    const m = window.location.pathname.match(/\/course\.php\/([^/]+)/);
    if (!m) return;
    const courseId = m[1];
    const now = Date.now();
    let pending = 0, overdue = 0, submitted = 0;
    let nearestDeadline = null;
    for (const a of assignments) {
      if (a.submitted) {
        submitted++;
        continue;
      }
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
    const summary = { courseId, pending, overdue, submitted, nearestDeadline, updatedAt: now };
    chrome.storage.local.get({ "bwc-course-data": {} }, (data) => {
      const all = data["bwc-course-data"];
      all[courseId] = summary;
      chrome.storage.local.set({ "bwc-course-data": all }, () => {
        chrome.runtime.sendMessage({ type: "bwc-stats-saved" }).catch(() => {
        });
      });
    });
  }
  function initAssignmentTracker() {
    const rows = document.querySelectorAll(".cl-contentsList_listGroupItem");
    const assignments = [];
    rows.forEach((row) => {
      const parsed = parseRow(row);
      if (parsed) {
        injectBadge(parsed);
        assignments.push(parsed);
      }
    });
    saveCourseStats(assignments);
  }
  const STORAGE_KEY = "bwc-course-data";
  function courseIdFromHref(href) {
    if (!href) return null;
    const m = href.match(/\/course\.php\/([^/?]+)/);
    return m ? m[1] : null;
  }
  function formatNearest(ts) {
    const diffMs = ts - Date.now();
    if (diffMs <= 0) return "";
    const totalMinutes = Math.floor(diffMs / 6e4);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor(totalMinutes % 1440 / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return hours > 0 ? `あと${days}日${hours}時間` : `あと${days}日`;
    if (hours > 0) return minutes > 0 ? `あと${hours}時間${minutes}分` : `あと${hours}時間`;
    return `あと${minutes}分`;
  }
  function injectStats(link, stats) {
    var _a;
    (_a = link.querySelector(".bwc-course-stats")) == null ? void 0 : _a.remove();
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
  function allCourseLinks() {
    return [...document.querySelectorAll("a[href*='/course.php/']")];
  }
  function initCourseOverview() {
    if (!document.getElementById("schedule-table") && !document.getElementById("courses_list_left")) return;
    const urls = [...new Set(allCourseLinks().map((a) => a.href))];
    chrome.storage.local.set({ "bwc-course-urls": urls });
    chrome.storage.local.get({ [STORAGE_KEY]: {} }, (data) => {
      const allStats = data[STORAGE_KEY];
      allCourseLinks().forEach((link) => {
        const courseId = courseIdFromHref(link.getAttribute("href"));
        if (!courseId) return;
        const stats = allStats[courseId];
        if (stats) injectStats(link, stats);
      });
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[STORAGE_KEY]) return;
      const allStats = changes[STORAGE_KEY].newValue;
      allCourseLinks().forEach((link) => {
        const courseId = courseIdFromHref(link.getAttribute("href"));
        if (!courseId || !allStats[courseId]) return;
        injectStats(link, allStats[courseId]);
      });
    });
  }
  const DEFAULT_SETTINGS = {
    webclassUrl: "",
    enableUiEnhancer: true,
    enableFileHandler: true,
    enableAssignmentTracker: true,
    enableAutoRefresh: false,
    autoRefreshInterval: 360
  };
  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        resolve(items);
      });
    });
  }
  async function main() {
    const settings = await loadSettings();
    if (settings.enableFileHandler) {
      initFileHandler();
    }
    if (window === window.top) {
      if (settings.enableUiEnhancer) {
        initUiEnhancer();
      }
      if (settings.enableAssignmentTracker) {
        initAssignmentTracker();
        initCourseOverview();
      }
    }
  }
  main();
})();
//# sourceMappingURL=index.js.map
