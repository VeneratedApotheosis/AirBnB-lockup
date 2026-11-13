import type { PatchResult, PatchSet, PublicSettings, RevertResult, Settings, Violation } from "./contracts";

export interface OperationMap {
  AUDIT_REQUEST: { input: null; output: { type: "AUDIT_RESULT"; violations: Violation[] } };
  PATCH_REQUEST: { input: { violations: Violation[] }; output: PatchSet };
  PATCH_APPLY: { input: PatchSet; output: PatchResult };
  PATCH_REVERT: { input: null; output: RevertResult };
  SETTINGS_GET: { input: null; output: PublicSettings };
  SETTINGS_SET: { input: Settings; output: PublicSettings };
}

export type Operation = keyof OperationMap;
export type PageOperation = "AUDIT_REQUEST" | "PATCH_APPLY" | "PATCH_REVERT";

export type Request<K extends Operation = Operation> = {
  [Name in K]: { type: Name; input: OperationMap[Name]["input"] };
}[K];

export type Reply<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
