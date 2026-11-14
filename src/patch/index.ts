import { patchSchema, type Patch, type PatchResult, type RevertResult } from "../shared/contracts";

/** The slice of Element the engine needs. A real Element satisfies it. */
export interface PatchElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/** The slice of Document the engine needs. A real Document satisfies it. */
export interface PatchRoot {
  querySelectorAll(selector: string): ArrayLike<PatchElement>;
}

export type SkipReason =
  | "invalid-patch"
  | "invalid-selector"
  | "target-missing"
  | "target-ambiguous"
  | "site-modified";

interface AppliedEdit {
  element: PatchElement;
  name: string;
  original: string | null;
  applied: string;
}

export interface PatchEngine {
  apply(patches: unknown[]): PatchResult;
  revert(): RevertResult;
}

export function createPatchEngine(root: PatchRoot): PatchEngine {
  const edits: AppliedEdit[] = [];
  const byPatchId = new Map<string, AppliedEdit>();

  function applyOne(patch: Patch): SkipReason | null {
    const target = resolveTarget(root, patch.selector);
    if (typeof target === "string") return target;

    const previous = byPatchId.get(patch.id);
    if (previous) {
      const current = previous.element.getAttribute(previous.name);
      if (current === previous.applied) return null;
      return "site-modified";
    }

    const shared = edits.find((e) => e.element === target && e.name === patch.name);
    if (shared && target.getAttribute(shared.name) !== shared.applied) return "site-modified";

    const edit = shared ?? {
      element: target,
      name: patch.name,
      original: target.getAttribute(patch.name),
      applied: patch.value,
    };
    // setAttribute stores plain text; model output is never parsed as HTML or code.
    target.setAttribute(patch.name, patch.value);
    edit.applied = patch.value;
    if (!shared) edits.push(edit);
    byPatchId.set(patch.id, edit);
    return null;
  }

  return {
    apply(patches) {
      const result: PatchResult = { applied: [], skipped: [] };
      for (const input of patches) {
        const parsed = patchSchema.safeParse(input);
        if (!parsed.success) {
          result.skipped.push({ patchId: patchIdOf(input), reason: "invalid-patch" });
          continue;
        }
        const reason = applyOne(parsed.data);
        if (reason) result.skipped.push({ patchId: parsed.data.id, reason });
        else result.applied.push(parsed.data.id);
      }
      return result;
    },

    revert() {
      const result: RevertResult = { restored: 0, skipped: 0 };
      for (const edit of edits.reverse()) {
        if (edit.element.getAttribute(edit.name) !== edit.applied) {
          result.skipped += 1;
          continue;
        }
        if (edit.original === null) edit.element.removeAttribute(edit.name);
        else edit.element.setAttribute(edit.name, edit.original);
        result.restored += 1;
      }
      edits.length = 0;
      byPatchId.clear();
      return result;
    },
  };
}

function resolveTarget(root: PatchRoot, selector: string): PatchElement | SkipReason {
  let matches: ArrayLike<PatchElement>;
  try {
    matches = root.querySelectorAll(selector);
  } catch {
    return "invalid-selector";
  }
  if (matches.length === 0) return "target-missing";
  if (matches.length > 1) return "target-ambiguous";
  return matches[0] ?? "target-missing";
}

function patchIdOf(input: unknown): string {
  if (typeof input === "object" && input !== null && "id" in input) {
    const id = (input as { id: unknown }).id;
    if (typeof id === "string" && id.length > 0) return id;
  }
  return "unknown";
}
