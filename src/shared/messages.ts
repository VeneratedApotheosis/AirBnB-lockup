import type { PatchResult, PatchSet, PublicSettings, RevertResult, Settings, Violation } from "./contracts";

export interface OperationMap {
  AUDIT_REQUEST: { input: null; output: { type: "AUDIT_RESULT"; violations: Violation[] } };
  PAGE_TEXT: { input: null; output: { text: string } };
  PAGE_HELP: { input: { question: string | null }; output: { answer: string } };
  PATCH_REQUEST: { input: { violations: Violation[] }; output: PatchSet };
  PATCH_APPLY: { input: PatchSet; output: PatchResult };
  PATCH_REVERT: { input: null; output: RevertResult };
  SETTINGS_GET: { input: null; output: PublicSettings };
  SETTINGS_SET: { input: Settings; output: PublicSettings };
  /** Turn a page preset on, or off with "default". Handled by the content script. */
  PRESET_APPLY: { input: { profile: Settings["profile"] }; output: { profile: Settings["profile"] } };
  /** Re-apply the fixes saved for the current site. null when none are saved. Routed by background. */
  SAVED_FIXES_APPLY: { input: null; output: PatchResult | null };
}

export type Operation = keyof OperationMap;
export type PageOperation = "AUDIT_REQUEST" | "PATCH_APPLY" | "PATCH_REVERT" | "PRESET_APPLY" | "PAGE_TEXT";

export type Request<K extends Operation = Operation> = {
  [Name in K]: { type: Name; input: OperationMap[Name]["input"] };
}[K];

export type Reply<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
