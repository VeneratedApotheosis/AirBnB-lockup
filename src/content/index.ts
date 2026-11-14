import { scanPage } from "../audit";
import { createPatchEngine } from "../patch";
import { patchSetSchema, settingsSchema } from "../shared/contracts";
import { applyPreset } from "./presets";
import type { OperationMap, PageOperation, Request } from "../shared/messages";

const scope = globalThis as typeof globalThis & { accessibilityFixerListening?: boolean };

if (!scope.accessibilityFixerListening) {
  const patches = createPatchEngine(document);

  async function dispatch(request: Request<PageOperation>): Promise<OperationMap[PageOperation]["output"]> {
    switch (request.type) {
      case "AUDIT_REQUEST":
        return { type: "AUDIT_RESULT", violations: await scanPage(document) };
      case "PATCH_APPLY": {
        const patchSet = patchSetSchema.parse(request.input);
        if (patchSet.url !== location.href) throw new Error("The page changed. Scan it again.");
        return patches.apply(patchSet.patches);
      }
      case "PATCH_REVERT":
        return patches.revert();
      case "PRESET_APPLY": {
        const profile = settingsSchema.shape.profile.parse(request.input.profile);
        applyPreset(document, profile);
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
