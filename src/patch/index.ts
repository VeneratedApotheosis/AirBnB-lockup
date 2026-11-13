import type { Patch, PatchResult, RevertResult } from "../shared/contracts";

export function createPatchEngine(_document: Document): {
  apply(patches: Patch[]): PatchResult;
  revert(): RevertResult;
} {
  return {
    apply() {
      throw new Error("Page fixes are still being built.");
    },
    revert() {
      throw new Error("Revert is still being built.");
    },
  };
}
