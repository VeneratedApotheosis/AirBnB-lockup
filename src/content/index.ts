import type { OperationMap, PageOperation, Request } from "../shared/contracts";
import { scanPage } from "../audit";
import { applyFixes, setPageProfile, undoFixes } from "../remediation";

const scope = globalThis as typeof globalThis & { accessibilityFixerListening?: boolean };

async function dispatch(request: Request<PageOperation>): Promise<OperationMap[PageOperation]["output"]> {
  switch (request.type) {
    case "scan":
      return scanPage();
    case "apply":
      return applyFixes(request.input);
    case "undo":
      return undoFixes();
    case "setProfile":
      return setPageProfile(request.input);
  }
}

// Reopening the popup or rescanning must preserve the listener and its document state.
if (!scope.accessibilityFixerListening) {
  scope.accessibilityFixerListening = true;
  chrome.runtime.onMessage.addListener((request: Request<PageOperation>, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
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
