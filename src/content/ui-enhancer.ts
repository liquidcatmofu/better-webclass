import type { ExtensionSettings } from "../types";

// Inject a floating toolbar for quick navigation
function injectToolbar(): void {
  if (document.getElementById("bwc-toolbar")) return;

  const toolbar = document.createElement("div");
  toolbar.id = "bwc-toolbar";
  const topBtn = document.createElement("button");
  topBtn.className = "bwc-toolbar-btn";
  topBtn.title = "トップへ戻る";
  topBtn.id = "bwc-to-top";
  topBtn.textContent = "↑";
  topBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  toolbar.appendChild(topBtn);

  document.body.appendChild(toolbar);
}

// Improve table readability by adding alternating row colors
function enhanceTables(): void {
  const tables = document.querySelectorAll<HTMLTableElement>("table:not(.bwc-enhanced)");
  tables.forEach((table) => {
    table.classList.add("bwc-enhanced");
    table.querySelectorAll("tr:nth-child(even)").forEach((row) => {
      (row as HTMLElement).classList.add("bwc-row-alt");
    });
  });
}

// Make long page titles more readable
function enhanceTitles(): void {
  const titleCandidates = document.querySelectorAll<HTMLElement>(
    "h1, h2, h3, .title, .page-title, td.title",
  );
  titleCandidates.forEach((el) => {
    if (el.textContent && el.textContent.trim().length > 0) {
      el.classList.add("bwc-title");
    }
  });
}

function updateGroupSummary(folder: HTMLElement): void {
  const header = folder.querySelector<HTMLElement>(".panel-heading.bwc-collapsible");
  const body = folder.querySelector<HTMLElement>(".list-group");
  if (!header || !body) return;

  const items = body.querySelectorAll(".cl-contentsList_listGroupItem");
  const countEl = header.querySelector<HTMLElement>(".bwc-group-count");
  if (countEl) countEl.textContent = `${items.length}件`;

  const summaryEl = header.querySelector<HTMLElement>(".bwc-group-summary");
  if (!summaryEl) return;
  summaryEl.replaceChildren();
  body.querySelectorAll<HTMLElement>(".bwc-badge").forEach((badge) => {
    summaryEl.appendChild(badge.cloneNode(true));
  });

}

function injectCollapseControls(): void {
  if (document.getElementById("bwc-collapse-controls")) return;
  const firstFolder = document.querySelector(".cl-contentsList_folder");
  if (!firstFolder) return;

  const controls = document.createElement("div");
  controls.id = "bwc-collapse-controls";
  const collapseBtn = document.createElement("button");
  collapseBtn.className = "bwc-text-btn";
  collapseBtn.textContent = "すべて縮小";
  const divider = document.createElement("span");
  divider.className = "bwc-divider";
  divider.textContent = "|";
  const expandBtn = document.createElement("button");
  expandBtn.className = "bwc-text-btn";
  expandBtn.textContent = "すべて展開";
  controls.append(collapseBtn, divider, expandBtn);
  firstFolder.parentElement?.insertBefore(controls, firstFolder);

  collapseBtn.addEventListener("click", () => {
    document.querySelectorAll<HTMLElement>(".cl-contentsList_folder").forEach((f) => {
      f.querySelector(".panel-heading")?.classList.add("bwc-group-collapsed");
      f.querySelector(".list-group")?.classList.add("bwc-group-collapsed");
    });
  });
  expandBtn.addEventListener("click", () => {
    document.querySelectorAll<HTMLElement>(".cl-contentsList_folder").forEach((f) => {
      f.querySelector(".panel-heading")?.classList.remove("bwc-group-collapsed");
      f.querySelector(".list-group")?.classList.remove("bwc-group-collapsed");
    });
  });
}

function initGroupCollapse(): void {
  document.querySelectorAll<HTMLElement>(".cl-contentsList_folder").forEach((folder) => {
    const header = folder.querySelector<HTMLElement>(".panel-heading");
    const body = folder.querySelector<HTMLElement>(".list-group");
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

export function initUiEnhancer(settings: ExtensionSettings): void {
  injectToolbar();
  enhanceTables();
  enhanceTitles();
  initGroupCollapse();

  // Disconnect before making DOM changes to avoid infinite observer loops
  const observer = new MutationObserver(() => {
    observer.disconnect();
    enhanceTables();
    initGroupCollapse();
    document.querySelectorAll<HTMLElement>(".cl-contentsList_folder").forEach(updateGroupSummary);
    observer.observe(document.body, { childList: true, subtree: true });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
