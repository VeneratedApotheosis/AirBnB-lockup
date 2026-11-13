import type { OperationMap, PageOperation, Profile, Reply, Request } from "../shared/contracts";
import { suggest } from "../suggestions";

const profileKey = "accessibilityProfile";

async function sendToActivePage<K extends PageOperation>(
  request: Request<K>,
): Promise<OperationMap[K]["output"]> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined || !tab.url || !/^https?:\/\//.test(tab.url)) {
    throw new Error("Open a website in the current tab and try again.");
  }

  const tabId = tab.id;
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

async function dispatch(request: Request): Promise<OperationMap[keyof OperationMap]["output"]> {
  switch (request.type) {
    case "suggest":
      return suggest(request.input);
    case "getProfile": {
      const stored = await chrome.storage.local.get(profileKey);
      const profile: unknown = stored[profileKey];
      return profile === "low-vision" || profile === "reading" ? profile : "default";
    }
    case "setProfile": {
      const profile = await sendToActivePage<"setProfile">(request);
      await chrome.storage.local.set({ [profileKey]: profile satisfies Profile });
      return profile;
    }
    case "scan":
    case "apply":
    case "undo":
      return sendToActivePage(request);
  }
}

chrome.runtime.onMessage.addListener((request: Request, sender, respond) => {
  if (sender.url !== chrome.runtime.getURL("popup.html")) return;
  void dispatch(request).then(
    (data) => respond({ ok: true, data }),
    (error: unknown) => respond({
      ok: false,
      error: error instanceof Error ? error.message : "The request failed.",
    }),
  );
  return true;
});
