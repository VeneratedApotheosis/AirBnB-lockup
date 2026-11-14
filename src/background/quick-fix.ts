import type { PatchResult, PatchSet, Violation } from "../shared/contracts";

export interface QuickFixSteps {
  audit(): Promise<Violation[]>;
  propose(violations: Violation[]): Promise<PatchSet>;
  apply(patchSet: PatchSet): Promise<PatchResult>;
}

export type QuickFixOutcome =
  | { status: "busy" }
  | { status: "no-findings" }
  | { status: "no-fixes"; findings: number }
  | { status: "applied"; findings: number; result: PatchResult };

/**
 * Scan, suggest and apply every suggested fix in one go (the keyboard shortcut).
 * A second call while one is running is ignored. Errors from any step propagate.
 */
export function createQuickFix(steps: QuickFixSteps): () => Promise<QuickFixOutcome> {
  let running = false;
  return async () => {
    if (running) return { status: "busy" };
    running = true;
    try {
      const violations = await steps.audit();
      if (violations.length === 0) return { status: "no-findings" };
      const patchSet = await steps.propose(violations);
      if (patchSet.patches.length === 0) return { status: "no-fixes", findings: violations.length };
      return { status: "applied", findings: violations.length, result: await steps.apply(patchSet) };
    } finally {
      running = false;
    }
  };
}
