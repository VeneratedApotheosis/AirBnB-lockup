import type { PatchSet, Violation } from "../shared/contracts";

export async function proposePatches(_request: {
  url: string;
  violations: Violation[];
  apiKey?: string;
}): Promise<PatchSet> {
  throw new Error("Fix suggestions are still being built.");
}
