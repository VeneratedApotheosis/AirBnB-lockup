import { scanPage } from "../audit";
import { createPatchEngine } from "../patch";
import { patchSetSchema, settingsSchema, type PatchSet, type Violation } from "../shared/contracts";
import { createRescanScheduler } from "./observer";
import { applyPreset, PRESET_STYLE_ID, READING_FONT_PATH } from "./presets";
import type { OperationMap, PageOperation, Request } from "../shared/messages";

const scope = globalThis as typeof globalThis & { accessibilityFixerListening?: boolean };

if (!scope.accessibilityFixerListening) {
  const patches = createPatchEngine(document);
  let currentPatches: PatchSet | null = null;
  let latest: Violation[] | null = null;
  let observer: MutationObserver | null = null;
  let busy = 0;

  const scheduler = createRescanScheduler({ run: () => ownWork(rescan), isOwnNode });

  function isOwnNode(node: unknown): boolean {
    if (!(node instanceof Node)) return false;
    const element = node instanceof Element ? node : node.parentElement;
    return element?.closest(`#${PRESET_STYLE_ID}`) != null;
  }

  /** Runs our own DOM writes, drops the mutations they caused, and marks stored results stale. */
  function ownWrite<T>(write: () => T): T {
    try {
      return write();
    } finally {
      observer?.takeRecords();
      latest = null;
    }
  }

  /** Mutations during our own async work (a scan) are ours, not the site's. */
  async function ownWork<T>(work: () => Promise<T>): Promise<T> {
    busy += 1;
    try {
      return await work();
    } finally {
      observer?.takeRecords();
      busy -= 1;
    }
  }

  function watch(): void {
    if (observer) return;
    observer = new MutationObserver((records) => {
      if (busy > 0) return;
      scheduler.notify(records);
      // A site change is waiting to be rescanned, so stored results are stale.
      if (scheduler.pending) latest = null;
    });
    observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  }

  function unwatch(): void {
    observer?.disconnect();
    observer = null;
    scheduler.cancel();
    currentPatches = null;
    latest = null;
  }

  /** Re-applies the current fixes (the page may have re-rendered them away), then scans. */
  async function rescan(): Promise<void> {
    if (currentPatches && currentPatches.url !== location.href) currentPatches = null;
    const active = currentPatches;
    if (active) ownWrite(() => patches.apply(active.patches));
    latest = await scanPage(document);
  }

  async function audit(): Promise<Violation[]> {
    watch();
    if (latest && !scheduler.pending) return latest;
    scheduler.cancel();
    await ownWork(rescan);
    return latest ?? [];
  }

  async function dispatch(request: Request<PageOperation>): Promise<OperationMap[PageOperation]["output"]> {
    switch (request.type) {
      case "AUDIT_REQUEST":
        return { type: "AUDIT_RESULT", violations: await audit() };
      case "PATCH_APPLY": {
        const patchSet = patchSetSchema.parse(request.input);
        if (patchSet.url !== location.href) throw new Error("The page changed. Scan it again.");
        watch();
        currentPatches = patchSet;
        return ownWrite(() => patches.apply(patchSet.patches));
      }
      case "PATCH_REVERT": {
        const result = ownWrite(() => patches.revert());
        unwatch();
        return result;
      }
      case "PRESET_APPLY": {
        const profile = settingsSchema.shape.profile.parse(request.input.profile);
        const fontUrl = profile === "reading" ? chrome.runtime.getURL(READING_FONT_PATH) : undefined;
        ownWrite(() => applyPreset(document, profile, fontUrl));
        return { profile };
      }
    }
  }

  scope.accessibilityFixerListening = true;
  chrome.runtime.onMessage.addListener((request: Request<PageOperation>, sender, respond) => {
    if (sender.id !== chrome.runtime.id || sender.tab) return;
    void dispatch(request).then(
      (data) => respond({ ok: true, data }),
      (error: unknown) => respond({
        ok: false,
        error: error instanceof Error ? error.message : "The page request failed.",
      }),
    );
    return true;
  });
}
