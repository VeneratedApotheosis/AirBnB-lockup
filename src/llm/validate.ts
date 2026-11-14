import { z } from "zod";
import { patchSchema, type Patch } from "../shared/contracts";
import type { ModelViolation } from "./context";

/** The one response shape every provider (mock or real) must return. */
export const modelResponseSchema = z.object({ patches: z.array(patchSchema) });

/** Proposals below this confidence are weak evidence and never shown (DECISION on #2). */
export const MIN_CONFIDENCE = 0.4;

export type ParsedResponse = { ok: true; patches: Patch[] } | { ok: false; error: string };

/** Accept a parsed object or JSON text (optionally inside a ```json fence). */
export function parseModelResponse(raw: unknown): ParsedResponse {
  let value = raw;
  if (typeof raw === "string") {
    const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
      value = JSON.parse(text);
    } catch {
      return { ok: false, error: "Response is not valid JSON." };
    }
  }
  const parsed = modelResponseSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) };
  return { ok: true, patches: parsed.data.patches };
}

/** Drop low-confidence proposals and any that do not point at a violation we asked about. */
export function dropWeakProposals(patches: Patch[], violations: readonly ModelViolation[]): Patch[] {
  const selectorById = new Map(violations.map((v) => [v.id, v.selector]));
  return patches.filter(
    (p) => p.confidence >= MIN_CONFIDENCE && selectorById.get(p.violationId) === p.selector,
  );
}
