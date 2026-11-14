import type { ModelProvider } from "../llm";
import { CLAUDE_MODEL, createClaudeProvider } from "../llm/claude";
import { mockProvider } from "../llm/mock";

/** Claude when the user has saved a non-empty API key; the deterministic mock otherwise. */
export function chooseProvider(apiKey: string | undefined): ModelProvider {
  return apiKey?.trim() ? createClaudeProvider(CLAUDE_MODEL) : mockProvider;
}
