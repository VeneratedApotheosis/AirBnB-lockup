import type { PatchSet, Violation } from "../shared/contracts";
import { buildModelContext, type ModelViolation } from "./context";
import { mockProvider } from "./mock";
import { dropWeakProposals, parseModelResponse } from "./validate";

export interface ProviderRequest {
  /** Redacted per-violation context from buildModelContext. Nothing else from the page. */
  violations: ModelViolation[];
  /** Supplied by the caller (background worker); never read from storage here. */
  apiKey?: string;
  /** Set on the retry, so the provider can tell the model what was wrong. */
  previousError?: string;
}

/** A model backend. Returns raw output (object or JSON text); validation happens here, not in the provider. */
export interface ModelProvider {
  name: string;
  complete(request: ProviderRequest): Promise<unknown>;
}

export async function proposePatches(request: {
  url: string;
  violations: Violation[];
  apiKey?: string;
  provider?: ModelProvider;
  now?: () => Date;
}): Promise<PatchSet> {
  const provider = request.provider ?? mockProvider;
  const now = request.now ?? (() => new Date());
  const done = (patches: PatchSet["patches"]): PatchSet => ({
    url: request.url,
    patches,
    model: provider.name,
    createdAt: now().toISOString(),
  });

  if (request.violations.length === 0) return done([]);
  const violations = buildModelContext(request.violations);

  let previousError: string | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await provider.complete({ violations, apiKey: request.apiKey, previousError });
    const parsed = parseModelResponse(raw);
    if (parsed.ok) return done(dropWeakProposals(parsed.patches, violations));
    previousError = parsed.error;
  }
  throw new Error("The fix suggestions were not valid, so none were shown. Try again.");
}
