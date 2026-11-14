import { describe, expect, it, vi } from "vitest";
import type { Patch, Violation } from "../src/shared/contracts";
import { proposePatches } from "../src/llm";
import { CLAUDE_MODEL, createClaudeProvider } from "../src/llm/claude";

const finding: Violation = {
  id: "button-name:button",
  ruleId: "button-name",
  selector: "button",
  impact: "critical",
  help: "Buttons must have discernible text",
  html: '<button title="Contact person@example.com"></button>',
  wcag: ["wcag412"],
};
const patch: Patch = {
  id: "label-button",
  violationId: finding.id,
  selector: finding.selector,
  op: "setAttribute",
  name: "aria-label",
  value: "Contact",
  confidence: 0.9,
  rationale: "The existing title describes the action.",
};
const url = "https://example.com/private";

function reply(text: string): Response {
  return Response.json({ content: [{ type: "text", text }] });
}

describe("Claude provider", () => {
  it("uses the Messages API and sends only redacted finding context", async () => {
    const fetchMessages = vi.fn<typeof fetch>().mockResolvedValue(reply(JSON.stringify({ patches: [patch] })));
    const provider = createClaudeProvider("test-model", fetchMessages);
    const result = await proposePatches({ url, violations: [finding], apiKey: "test-key", provider });
    expect(result).toMatchObject({ model: "test-model", patches: [patch] });
    expect(fetchMessages).toHaveBeenCalledWith("https://api.anthropic.com/v1/messages", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "x-api-key": "test-key" }),
    }));
    const init = fetchMessages.mock.calls[0]?.[1];
    const body = String(init?.body);
    expect(body).toContain("[email]");
    expect(body).not.toContain("person@example.com");
    expect(body).not.toContain(url);
    expect(body).not.toContain("test-key");
  });

  it("passes malformed output through the shared retry with validation feedback", async () => {
    const fetchMessages = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(reply("invalid JSON"))
      .mockResolvedValueOnce(reply(JSON.stringify({ patches: [patch] })));
    const provider = createClaudeProvider("test-model", fetchMessages);
    await expect(proposePatches({ url, violations: [finding], apiKey: "test-key", provider }))
      .resolves.toMatchObject({ patches: [patch] });
    expect(fetchMessages).toHaveBeenCalledTimes(2);
    expect(String(fetchMessages.mock.calls[1]?.[1]?.body)).toContain("Response is not valid JSON.");
  });

  it("requires a caller-supplied key before making a request", async () => {
    const fetchMessages = vi.fn<typeof fetch>();
    const provider = createClaudeProvider("test-model", fetchMessages);
    await expect(provider.complete({ violations: [finding] })).rejects.toThrow("Enter a Claude API key");
    expect(fetchMessages).not.toHaveBeenCalled();
  });

  it("reports HTTP failures without including the response body", async () => {
    const fetchMessages = vi.fn<typeof fetch>().mockResolvedValue(new Response("private error", { status: 401 }));
    const provider = createClaudeProvider("test-model", fetchMessages);
    await expect(provider.complete({ violations: [finding], apiKey: "test-key" }))
      .rejects.toThrow(/^Claude API request failed \(HTTP 401\)\.$/);
    expect(fetchMessages).toHaveBeenCalledTimes(1);
  });

  it("defaults to the current Opus model", () => {
    expect(CLAUDE_MODEL).toBe("claude-opus-5-5");
    expect(createClaudeProvider(CLAUDE_MODEL).name).toBe("claude-opus-5-5");
  });

  it("sends the browser-access and fallback headers with room for thinking", async () => {
    const fetchMessages = vi.fn<typeof fetch>().mockResolvedValue(reply(JSON.stringify({ patches: [] })));
    await createClaudeProvider(CLAUDE_MODEL, fetchMessages).complete({ violations: [finding], apiKey: "test-key" });
    const init = fetchMessages.mock.calls[0]?.[1];
    expect(init?.headers).toMatchObject({
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01",
      "anthropic-dangerous-direct-browser-access": "true",
    });
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ model: "claude-opus-5-5", max_tokens: 16_000, fallbacks: "default" });
    expect(body).not.toHaveProperty("thinking");
    expect(body).not.toHaveProperty("temperature");
  });

  it("reports a refusal clearly instead of retrying it", async () => {
    const fetchMessages = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ stop_reason: "refusal", content: [] }),
    );
    const provider = createClaudeProvider(CLAUDE_MODEL, fetchMessages);
    await expect(proposePatches({ url, violations: [finding], apiKey: "test-key", provider }))
      .rejects.toThrow("Claude declined to suggest fixes for this page.");
    expect(fetchMessages).toHaveBeenCalledTimes(1);
  });
});
