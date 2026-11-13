import type { SuggestRequest, SuggestResult } from "../shared/contracts";

export async function suggest(_request: SuggestRequest): Promise<SuggestResult> {
  throw new Error("Fix suggestions are still being built.");
}
