import type { ModelProvider } from "../llm";
import { CLAUDE_MODEL, createClaudeProvider } from "../llm/claude";
import { mockProvider } from "../llm/mock";

/** The key saved in settings wins; otherwise the shared key baked in at build time; otherwise none. */
export function resolveApiKey(saved: string | undefined, buildKey: string | undefined): string | undefined {
  return saved?.trim() || buildKey?.trim() || undefined;
}

/** Claude when the user has saved a non-empty API key; the deterministic mock otherwise. */
export function chooseProvider(apiKey: string | undefined): ModelProvider {
  return apiKey?.trim() ? createClaudeProvider(CLAUDE_MODEL) : mockProvider;
}
