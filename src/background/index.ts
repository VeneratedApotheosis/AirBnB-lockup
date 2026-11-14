import { proposePatches } from "../llm";
import { patchSetSchema, settingsSchema, violationSchema, type Settings } from "../shared/contracts";
import type { Operation, OperationMap, PageOperation, Reply, Request } from "../shared/messages";
import { chooseProvider, resolveApiKey } from "./provider";
import { createQuickFix } from "./quick-fix";
import { createSiteFixes } from "./site-fixes";

const settingsKey = "accessibilitySettings";
// Shared team key from .env, injected by scripts/build.mjs. Never sent to the popup or the page.
const buildApiKey = typeof __BUILD_API_KEY__ === "string" ? __BUILD_API_KEY__ : "";
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
      const apiKey = resolveApiKey((await getSettings()).apiKey, buildApiKey);
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

// Keyboard shortcut (manifest `commands.fix-page`): same paths as the popup's Scan -> Apply.
const quickFix = createQuickFix({
  audit: async () => (await dispatch({ type: "AUDIT_REQUEST", input: null }) as OperationMap["AUDIT_REQUEST"]["output"]).violations,
  propose: async (violations) =>
    await dispatch({ type: "PATCH_REQUEST", input: { violations } }) as OperationMap["PATCH_REQUEST"]["output"],
  apply: async (patchSet) => await dispatch({ type: "PATCH_APPLY", input: patchSet }) as OperationMap["PATCH_APPLY"]["output"],
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "fix-page") return;
  const tabId = tab?.id;
  void (async () => {
    await badge(tabId, "", "");
    try {
      await storageReady;
      const outcome = await quickFix();
      if (outcome.status === "busy") return;
      // openPopup needs Chrome 127+. If it fails, the page is still fixed; show the count on the icon instead.
      await chrome.action.openPopup().catch(async () => {
        const applied = outcome.status === "applied" ? outcome.result.applied.length : 0;
        await badge(tabId, String(applied), `Applied ${applied} fixes. Open the extension to review or undo.`);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The shortcut could not fix this page.";
      await badge(tabId, "!", message);
    }
  })();
});

async function badge(tabId: number | undefined, text: string, title: string): Promise<void> {
  if (tabId === undefined) return;
  await chrome.action.setBadgeText({ tabId, text }).catch(() => undefined);
  await chrome.action.setTitle({ tabId, title }).catch(() => undefined);
}

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
