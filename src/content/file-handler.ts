// WebClass uses filedownload(url) which calls:
//   window.open(url, "download", "width=320,height=250")
// We override window.open and intercept these popup calls.

function isPdfUrl(url: string): boolean {
  const decoded = decodeURIComponent(url).toLowerCase();
  return decoded.includes(".pdf");
}

// file_down.php returns an HTML page with a link to the actual file (download.php/...).
// Fetch it and extract that link so we can show the real PDF in the iframe.
async function resolveActualUrl(url: string): Promise<string> {
  try {
    // HEAD first to avoid downloading a large file just to check the content type
    const head = await fetch(url, { method: "HEAD" });
    const contentType = head.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return url; // already a direct file

    const resp = await fetch(url);
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const link = Array.from(doc.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .find((a) => !a.getAttribute("href")!.startsWith("javascript:"));
    if (link) return new URL(link.getAttribute("href")!, resp.url).href;
  } catch {
    // fall through
  }
  return url;
}

// WebClass-specific download URL patterns that should open as PDF modal
function isWebClassFileLink(url: string): boolean {
  return url.includes("/my-reports/download") || url.includes("/file_down.php");
}

function downloadDirect(url: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function getFilename(url: string): string {
  try {
    const params = new URLSearchParams(new URL(url).search);
    const name = params.get("file_name");
    if (name) return decodeURIComponent(name);
  } catch {
    // ignore
  }
  return decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "document.pdf");
}

function sanitizeFilename(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  if (!clean) return "document.pdf";
  return /\.pdf$/i.test(clean) ? clean : clean + ".pdf";
}

function getFilenameFromContentDisposition(cd: string | null): string | null {
  if (!cd) return null;
  // RFC 5987: filename*=UTF-8''encoded-name
  const starMatch = cd.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''\s*([^;]+)/i);
  if (starMatch) return decodeURIComponent(starMatch[1].trim());
  // filename="name"
  const quoted = cd.match(/filename\s*=\s*"([^"]+)"/i);
  if (quoted) return quoted[1];
  // filename=name (no quotes)
  const plain = cd.match(/filename\s*=\s*([^;"\s][^;]*)/i);
  if (plain) return plain[1].trim();
  return null;
}

function showMessageModal(url: string): void {
  document.getElementById("bwc-msg-modal")?.remove();

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

  const closeModal = (): void => {
    overlay.remove();
    location.reload();
  };
  overlay.querySelector(".bwc-btn-close")?.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}

async function showPdfModal(url: string, filenameHint?: string): Promise<void> {
  document.getElementById("bwc-pdf-modal")?.remove();

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
  const titleEl = overlay.querySelector<HTMLElement>(".bwc-modal-title")!;
  titleEl.append("📄 " + filename);

  let objectUrl: string | null = null;
  const closeModal = (): void => {
    overlay.remove();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  };
  overlay.querySelector(".bwc-btn-close")?.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
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

    const iframe = overlay.querySelector<HTMLIFrameElement>(".bwc-pdf-iframe")!;
    const loading = overlay.querySelector<HTMLElement>(".bwc-pdf-loading")!;
    iframe.src = objectUrl;
    loading.remove();

    const dlBtn = overlay.querySelector<HTMLButtonElement>(".bwc-btn-download")!;
    dlBtn.disabled = false;
    dlBtn.addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = objectUrl!;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });

    const newTabBtn = overlay.querySelector<HTMLButtonElement>(".bwc-btn-newtab")!;
    newTabBtn.disabled = false;
    newTabBtn.addEventListener("click", () => window.open(objectUrl!, "_blank"));
  } catch {
    const loading = overlay.querySelector<HTMLElement>(".bwc-pdf-loading");
    if (loading) loading.textContent = "読み込みに失敗しました";
  }
}

// Collect document.title from every frame and return course name + section name.
// The first non-generic title is the course name (top frame), the last is the section name (child frame).
function findTitlesAcrossFrames(top: Window): { course: string; section: string } {
  const titles: string[] = [];
  function collect(win: Window): void {
    try { const t = win.document.title?.trim(); if (t) titles.push(t); } catch { /**/ }
    try { for (let i = 0; i < win.frames.length; i++) collect(win.frames[i]); } catch { /**/ }
  }
  collect(top);

  const isGeneric = (t: string) =>
    /^(upper\s*navi|webclass|loading|home|index|frame|navi|menu|pdf\.?js\s*viewer)(\s*[-–]\s*webclass)?$/i.test(t);
  const cleaned = titles
    .map(t => t.replace(/\s*[-–]\s*WebClass\s*$/i, "").trim())
    .filter(t => t.length > 2 && !isGeneric(t));
  return {
    course: cleaned[0] ?? "",
    section: cleaned.length > 1 ? cleaned[cleaned.length - 1] : "",
  };
}

// Search the entire frame tree (same-origin) for the 資料を閉じる button.
function findCloseButtonInFrameTree(win: Window): { el: HTMLElement; doc: Document } | null {
  try {
    const sel = "input[type='button'], input[type='submit'], button, a";
    for (const el of win.document.querySelectorAll<HTMLElement>(sel)) {
      // Use || so that empty textContent falls through to .value (for <input> elements)
      const text = el.textContent?.trim() || (el as HTMLInputElement).value?.trim() || "";
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

// Create a download button that fetches a PDF and saves with the given filename.
function createDlButton(
  doc: Document,
  id: string,
  label: string,
  pdfUrl: string,
  filename: string,
): HTMLButtonElement {
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
      // ignore
    } finally {
      btn.disabled = false;
    }
  });

  return btn;
}

// Inject DL buttons next to the 資料を閉じる button.
function injectDlButtonsNextToClose(
  el: HTMLElement,
  doc: Document,
  pdfUrl: string,
  course: string,
  section: string,
): void {
  if (doc.getElementById("bwc-resource-dl-section")) return;

  const sectionName = section || course;
  const sectionBtn = createDlButton(
    doc, "bwc-resource-dl-section", "↓ DL", pdfUrl, sanitizeFilename(sectionName || getFilename(pdfUrl)),
  );
  el.insertAdjacentElement("afterend", sectionBtn);

  if (course && section) {
    const fullName = sanitizeFilename(course + "_" + section);
    const courseBtn = createDlButton(doc, "bwc-resource-dl-course", "↓ 科目名DL", pdfUrl, fullName);
    sectionBtn.insertAdjacentElement("afterend", courseBtn);
  }
}

// Scan for _blank PDF links. When found, locate 資料を閉じる in the frame tree and
// inject a DL button beside it. Falls back to inline injection in the top frame.
function injectResourceDownloadButtons(): void {
  document.querySelectorAll<HTMLAnchorElement>("a[target='_blank'][href]").forEach((link) => {
    if (!isPdfUrl(link.href)) return;
    if (link.dataset.bwcDl) return;
    link.dataset.bwcDl = "1";

    const top = window.top ?? window;
    const closeResult = findCloseButtonInFrameTree(top);
    const { course, section } = findTitlesAcrossFrames(top);

    if (closeResult) {
      injectDlButtonsNextToClose(closeResult.el, closeResult.doc, link.href, course, section);
    } else {
      // Fallback: inject inline next to the link (top-frame direct links)
      const name = section || course || getFilename(link.href);
      const btn = createDlButton(
        document, "bwc-resource-dl-section", "↓ DL", link.href, sanitizeFilename(name),
      );
      link.insertAdjacentElement("afterend", btn);
    }
  });
}

export function initFileHandler(): void {
  // Override window.open — catches filedownload() calls made by WebClass
  const originalOpen = window.open.bind(window);
  window.open = (url?: string | URL, target?: string, features?: string): Window | null => {
    if (!url) return originalOpen(url, target, features);
    const urlStr = url.toString();

    // Message window (openMessageWindow → openWCWindow → window.open with target="msgeditor")
    if (target === "msgeditor") {
      showMessageModal(urlStr);
      return null;
    }

    // filedownload() always uses target="download"
    if (target === "download" || (features && features.includes("width=320"))) {
      if (isPdfUrl(urlStr)) {
        resolveActualUrl(urlStr).then((resolved) => showPdfModal(resolved));
      } else {
        downloadDirect(urlStr);
      }
      return null;
    }

    return originalOpen(url, target, features);
  };

  // Intercept clicks on submission PDF links (target="download", onclick*="filedownload")
  // and WebClass file links. _blank PDF links are left alone (floating DL button instead).
  document.addEventListener(
    "click",
    (e) => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
      if (!link) return;

      // Never intercept links inside our own modals
      if (link.closest("#bwc-pdf-modal") || link.closest("#bwc-msg-modal")) return;

      // Message links (target="msgeditor")
      if (link.target === "msgeditor") {
        e.preventDefault();
        e.stopPropagation();
        showMessageModal(link.href);
        return;
      }

      const href = link.href;
      const isDownloadTarget = link.target === "download";
      const hasFiledownloadOnclick = link.getAttribute("onclick")?.includes("filedownload") ?? false;

      if ((isDownloadTarget || hasFiledownloadOnclick) && isPdfUrl(href)) {
        e.preventDefault();
        e.stopPropagation();
        const hint = link.textContent?.trim() || undefined;
        resolveActualUrl(href).then((resolved) => showPdfModal(resolved, hint));
        return;
      }

      if ((isDownloadTarget || hasFiledownloadOnclick) && !isPdfUrl(href)) {
        e.preventDefault();
        e.stopPropagation();
        downloadDirect(href);
        return;
      }

      // Plain links to WebClass download endpoints (e.g. my-reports/download)
      if (!isDownloadTarget && !hasFiledownloadOnclick && isWebClassFileLink(href) && isPdfUrl(href)) {
        e.preventDefault();
        e.stopPropagation();
        resolveActualUrl(href).then((resolved) => showPdfModal(resolved));
      }
    },
    true,
  );

  // Inject download buttons for _blank PDF links (runs in all frames)
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
