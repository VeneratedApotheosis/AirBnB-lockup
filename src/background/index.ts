import { proposePatches } from "../llm";
import { patchSetSchema, settingsSchema, violationSchema, type Settings } from "../shared/contracts";
import type { Operation, OperationMap, PageOperation, Reply, Request } from "../shared/messages";
import { chooseProvider } from "./provider";
import { createSiteFixes } from "./site-fixes";

const settingsKey = "accessibilitySettings";
const siteFixes = createSiteFixes(chrome.storage.local);

async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(settingsKey);
  const parsed = settingsSchema.safeParse(stored[settingsKey]);
  return parsed.success ? parsed.data : { profile: "default" };
}

async function activePage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined || !tab.url || !/^https?:\/\//.test(tab.url)) {
    throw new Error("Open a website in the current tab and try again.");
  }
  return { tabId: tab.id, url: tab.url };
}

async function sendToPage<K extends PageOperation>(request: Request<K>): Promise<OperationMap[K]["output"]> {
  const { tabId } = await activePage();
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  }).catch(() => {
    throw new Error("Chrome does not allow the extension to access this page.");
  });
  if (!injection?.documentId) throw new Error("The page is unavailable. Try again.");

  const reply: Reply<OperationMap[K]["output"]> | undefined =
    await chrome.tabs.sendMessage(tabId, request, { documentId: injection.documentId });
  if (!reply) throw new Error("The page changed. Try again.");
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}

async function dispatch(request: Request): Promise<OperationMap[Operation]["output"]> {
  switch (request.type) {
    case "PATCH_REQUEST": {
      const { url } = await activePage();
      const { apiKey } = await getSettings();
      const violations = violationSchema.array().parse(request.input.violations);
      const provider = chooseProvider(apiKey);
      return patchSetSchema.parse(await proposePatches({ url, apiKey, violations, provider }));
    }
    case "SETTINGS_GET": {
      const { profile } = await getSettings();
      return { profile };
    }
    case "SETTINGS_SET": {
      const settings = settingsSchema.parse(request.input);
      await chrome.storage.local.set({ [settingsKey]: { ...await getSettings(), ...settings } });
      return { profile: settings.profile };
    }
    case "PATCH_APPLY": {
      const patchSet = patchSetSchema.parse(request.input);
      const result = await sendToPage({ type: "PATCH_APPLY", input: patchSet });
      await siteFixes.save(patchSet.url, patchSet.patches, result);
      return result;
    }
    case "PATCH_REVERT": {
      const { url } = await activePage();
      const result = await sendToPage(request);
      await siteFixes.clear(url);
      return result;
    }
    case "SAVED_FIXES_APPLY": {
      // Not a website (e.g. chrome://): nothing can be saved there, so nothing to restore.
      const page = await activePage().catch(() => null);
      if (!page) return null;
      const patches = await siteFixes.load(page.url);
      if (patches.length === 0) return null;
      return sendToPage({
        type: "PATCH_APPLY",
        input: { url: page.url, patches, model: "saved-fixes", createdAt: new Date().toISOString() },
      });
    }
    case "AUDIT_REQUEST":
    case "PRESET_APPLY":
      return sendToPage(request);
  }
}

const storageReady = chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });

chrome.runtime.onMessage.addListener((request: Request, sender, respond) => {
  if (sender.url !== chrome.runtime.getURL("src/ui/popup.html")) return;
  void storageReady.then(() => dispatch(request)).then(
    (data) => respond({ ok: true, data }),
    (error: unknown) => respond({
      ok: false,
      error: error instanceof Error ? error.message : "The request failed.",
    }),
  );
  return true;
});
