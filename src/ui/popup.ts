import type { Patch, PatchSet, Violation } from "../shared/contracts";
import type { sendRequest } from "./transport";
import { mountSettings } from "./settings";

const findingCopy: ReadonlyMap<string, { title: string; explanation: string }> = new Map([
  ["aria-allowed-attr", {
    title: "A control has an unsupported accessibility setting",
    explanation: "Assistive technology may give people incomplete or confusing information about how the control works.",
  }],
  ["button-name", {
    title: "Button has no name",
    explanation: "A screen reader may say “button” without telling the person what it does.",
  }],
  ["image-alt", {
    title: "Image is missing a description",
    explanation: "Someone using a screen reader may miss information that appears only in the image.",
  }],
  ["heading-order", {
    title: "Heading levels skip a step",
    explanation: "People who navigate by headings may have trouble following how the page is organized.",
  }],
  ["link-name", {
    title: "Link has no name",
    explanation: "A screen reader may announce a link without explaining where it goes.",
  }],
  ["label", {
    title: "Form field is missing a label",
    explanation: "A screen reader may give no clue about what to enter in this field.",
  }],
  ["color-contrast", {
    title: "Text is hard to see",
    explanation: "The text and its background are too similar in color, which can make the text hard to read.",
  }],
]);

export function mountPopup(document: Document, request: typeof sendRequest): void {
  const scan = get<HTMLButtonElement>("scan");
  const revert = get<HTMLButtonElement>("revert");
  const apply = get<HTMLButtonElement>("apply");
  const selectAll = get<HTMLButtonElement>("select-all");
  const status = get("status");
  const scanResult = get("scan-result");
  const review = get("review");
  const reviewNote = get("review-note");
  const choices = get<HTMLFieldSetElement>("choices");
  const proposals = get("proposals");
  const findings = get<HTMLDetailsElement>("findings");
  const findingsLabel = get("findings-label");
  const findingsList = get("findings-list");
  const selected = new Set<string>();
  let titles = new Map<string, string>();
  let patchSet: PatchSet | undefined;
  let working = false;

  function get<T extends HTMLElement = HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`The popup is missing #${id}.`);
    return element as T;
  }

  function showFindings(violations: Violation[]): void {
    const count = violations.length;
    scanResult.textContent = `${count} accessibility ${count === 1 ? "finding" : "findings"}`;
    scanResult.hidden = false;
    findings.hidden = count === 0;
    findings.open = false;
    findingsLabel.textContent = `Findings (${violations.length})`;
    const groups = new Map<string, [Violation, ...Violation[]]>();
    for (const violation of violations) {
      const group = groups.get(violation.ruleId);
      if (group) group.push(violation);
      else groups.set(violation.ruleId, [violation]);
    }
    const rows = [...groups.entries()].map(([ruleId, group]) => {
      const row = document.createElement("li");
      const copy = findingCopy.get(ruleId);
      const title = document.createElement("strong");
      title.textContent = copy?.title ?? group[0].help;
      row.append(title);
      if (copy) {
        const explanation = document.createElement("p");
        explanation.className = "muted";
        explanation.textContent = copy.explanation;
        row.append(explanation);
      }
      if (group.length > 1) {
        const details = document.createElement("details");
        details.className = "finding-group";
        const summary = document.createElement("summary");
        summary.textContent = `${group.length} affected elements`;
        const occurrences = document.createElement("ol");
        for (const { impact, html } of group) {
          const occurrence = document.createElement("li");
          const tag = /^<([a-z][\w-]*)\b/i.exec(html)?.[1]?.toLowerCase();
          const element = tag === "button" ? "Button" : tag === "a" ? "Link" : tag === "img" ? "Image" : "Page element";
          occurrence.textContent = `${element} · ${impact} impact`;
          occurrences.append(occurrence);
        }
        details.append(summary, occurrences);
        row.append(details);
      }
      return row;
    });
    findingsList.replaceChildren(...rows);
  }

  function proposalRow(patch: Patch, title: string, source: string, index: number): HTMLLIElement {
    const row = document.createElement("li");
    const label = document.createElement("label");
    label.className = "option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = selected.has(patch.id);
    input.addEventListener("change", () => {
      if (input.checked) selected.add(patch.id);
      else selected.delete(patch.id);
      updateControls();
    });
    const copy = document.createElement("span");
    const change = document.createElement("strong");
    change.id = `proposal-change-${index}`;
    change.textContent = patch.name === "alt"
      ? `Set image description to “${patch.value}”`
      : `Set accessible name to “${patch.value}”`;
    const target = document.createElement("span");
    target.className = "muted";
    target.id = `proposal-target-${index}`;
    target.textContent = `${title} · ${patch.selector}`;
    const confidence = patch.confidence >= 0.8 ? "High" : patch.confidence >= 0.5 ? "Medium" : "Low";
    const metadata = document.createElement("span");
    metadata.className = "proposal-metadata";
    metadata.id = `proposal-metadata-${index}`;
    metadata.textContent = `${source}. ${confidence} confidence.`;
    const rationale = document.createElement("span");
    rationale.className = "muted";
    rationale.id = `proposal-rationale-${index}`;
    rationale.textContent = patch.rationale;
    input.setAttribute("aria-labelledby", change.id);
    input.setAttribute("aria-describedby", `${target.id} ${metadata.id} ${rationale.id}`);
    copy.append(change, target, metadata, rationale);
    label.append(input, copy);
    row.append(label);
    return row;
  }

  function showProposals(): void {
    const patches = patchSet?.patches ?? [];
    const hasPatches = patches.length > 0;
    review.hidden = !hasPatches;
    choices.hidden = !hasPatches;
    selectAll.hidden = !hasPatches;
    apply.hidden = !hasPatches;
    reviewNote.textContent = "Choose the fixes you want to apply.";
    const source = patchSet?.model === "mock-v1" ? "AI suggestion (demo mock)" : "AI suggestion";
    proposals.replaceChildren(...patches.map((patch, index) =>
      proposalRow(patch, titles.get(patch.violationId) ?? "Page element", source, index),
    ));
  }

  function updateControls(): void {
    scan.disabled = working;
    revert.disabled = working;
    choices.disabled = working;
    selectAll.disabled = working;
    selectAll.textContent = allSelected() ? "Clear selection" : "Select all";
    apply.disabled = working || selected.size === 0;
  }

  function allSelected(): boolean {
    return selected.size > 0 && (patchSet?.patches.every((patch) => selected.has(patch.id)) ?? false);
  }

  selectAll.addEventListener("click", () => {
    if (!patchSet?.patches.length || working) return;
    const check = !allSelected();
    selected.clear();
    if (check) {
      for (const patch of patchSet.patches) selected.add(patch.id);
    }
    for (const input of proposals.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
      input.checked = check;
    }
    updateControls();
  });

  async function run(button: HTMLButtonElement, pending: string, action: () => Promise<string>): Promise<void> {
    if (working) return;
    const hadFocus = document.activeElement === button;
    working = true;
    updateControls();
    status.textContent = pending;
    status.classList.remove("error");
    try {
      status.textContent = await action();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Something went wrong. Try again.";
      status.classList.add("error");
    } finally {
      working = false;
      updateControls();
      if (hadFocus && document.activeElement === document.body) {
        (button.hidden || button.disabled ? scan : button).focus();
      }
    }
  }

  scan.addEventListener("click", () => void run(scan, "Scanning this page…", async () => {
    patchSet = undefined;
    selected.clear();
    showProposals();
    findings.hidden = true;
    scanResult.hidden = true;
    const { violations } = await request({ type: "AUDIT_REQUEST", input: null });
    showFindings(violations);
    scan.textContent = "Rescan page";
    if (violations.length === 0) return "No accessibility issues found in this scan.";
    const count = `${violations.length} ${violations.length === 1 ? "finding" : "findings"}`;
    status.textContent = `${count}. Preparing suggested fixes…`;
    titles = new Map(violations.map((violation) => [violation.id, violation.help]));
    patchSet = await request({ type: "PATCH_REQUEST", input: { violations } });
    showProposals();
    if (patchSet.patches.length === 0) {
      findings.open = true;
      return "No suggested fixes for this scan.";
    }
    return `${patchSet.patches.length} suggested ${patchSet.patches.length === 1 ? "fix" : "fixes"} to review.`;
  }));

  apply.addEventListener("click", () => {
    const approved = patchSet && { ...patchSet, patches: patchSet.patches.filter((patch) => selected.has(patch.id)) };
    if (!approved?.patches.length) return;
    void run(apply, "Applying selected fixes…", async () => {
      const result = await request({ type: "PATCH_APPLY", input: approved });
      const applied = new Set(result.applied);
      if (patchSet) {
        const remaining = patchSet.patches.filter((patch) => !applied.has(patch.id));
        patchSet = remaining.length ? { ...patchSet, patches: remaining } : undefined;
      }
      selected.clear();
      showProposals();
      return `Applied ${result.applied.length} · Skipped ${result.skipped.length}. Rescan to check the page.`;
    });
  });

  revert.addEventListener("click", () => void run(revert, "Undoing fixes…", async () => {
    const result = await request({ type: "PATCH_REVERT", input: null });
    if (result.restored === 0 && result.skipped === 0) return "There are no fixes to undo on this page.";
    patchSet = undefined;
    selected.clear();
    showProposals();
    return `Undone ${result.restored} · Skipped ${result.skipped}. Rescan to check the page.`;
  }));

  // Re-apply fixes saved for this page on an earlier visit.
  const initialStatus = status.textContent ?? "";
  void run(scan, "Checking for saved fixes…", async () => {
    const result = await request({ type: "SAVED_FIXES_APPLY", input: null });
    if (!result) return initialStatus;
    const fixes = `${result.applied.length} saved ${result.applied.length === 1 ? "fix" : "fixes"}`;
    return `Restored ${fixes} for this page · Skipped ${result.skipped.length}.`;
  });

  mountSettings(document, request);
}
