import type { ScanResult } from "../shared/contracts";

export async function scanPage(): Promise<ScanResult> {
  throw new Error("The accessibility audit is still being built.");
}

// Resolve a candidate against the current scan and connected document in this content script.
export function resolveCandidate(_scanId: string, _candidateId: string): Element | null {
  return null;
}
