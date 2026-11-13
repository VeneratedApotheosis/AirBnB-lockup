import type { ApplyResult, OperationMap, Profile, UndoResult } from "../shared/contracts";

export async function applyFixes(_input: OperationMap["apply"]["input"]): Promise<ApplyResult> {
  throw new Error("Page fixes are still being built.");
}

export async function undoFixes(): Promise<UndoResult> {
  throw new Error("Undo is still being built.");
}

export async function setPageProfile(_profile: Profile): Promise<Profile> {
  throw new Error("Reading profiles are still being built.");
}
