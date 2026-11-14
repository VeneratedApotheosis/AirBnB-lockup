import { describe, expect, it, vi } from "vitest";
import { proposePatches, type ModelProvider, type ProviderRequest } from "../src/llm";
import { mockProvider } from "../src/llm/mock";
import { patchSetSchema, type Patch, type Violation } from "../src/shared/contracts";

const url = "https://example.com/events";
const now = () => new Date("2026-11-14T12:00:00.000Z");

function violation(overrides: Partial<Violation> = {}): Violation {
  return {
    id: "v1",
    ruleId: "button-name",
    impact: "critical",
    selector: "#search-button",
    html: '<button id="search-button" type="submit"><svg aria-hidden="true"></svg></button>',
    help: "Buttons must have discernible text",
    wcag: ["wcag2a", "wcag412"],
    ...overrides,
  };
}

function proposal(overrides: Partial<Patch> = {}): Patch {
  return {
    id: "p1",
    violationId: "v1",
    selector: "#search-button",
    op: "setAttribute",
    name: "aria-label",
    value: "Search events",
    confidence: 0.9,
    rationale: "Submit button of the event search form.",
    ...overrides,
  };
}

function scripted(...replies: unknown[]): ModelProvider & { calls: ProviderRequest[] } {
  const calls: ProviderRequest[] = [];
  return {
    name: "scripted",
    calls,
    complete: vi.fn(async (req: ProviderRequest) => {
      calls.push(req);
      return replies[Math.min(calls.length - 1, replies.length - 1)];
    }),
  };
}

describe("mock provider", () => {
  it("proposes a deterministic accessible name for an unlabeled button", async () => {
    const a = await proposePatches({ url, violations: [violation()], now });
    const b = await proposePatches({ url, violations: [violation()], now });
    expect(a).toEqual(b);
    expect(patchSetSchema.safeParse(a).success).toBe(true);
    expect(a.model).toBe("mock-v1");
    expect(a.patches).toEqual([
      expect.objectContaining({ violationId: "v1", selector: "#search-button", name: "aria-label", value: "Search button" }),
    ]);
  });

  it("proposes alt text from an image file name", async () => {
    const img = violation({ ruleId: "image-alt", selector: "img", html: '<img src="/photos/beach-house_sunset.jpg">' });
    const set = await proposePatches({ url, violations: [img], now });
    expect(set.patches[0]).toMatchObject({ name: "alt", value: "Beach house sunset" });
  });

  it("returns the shape the real provider must return", async () => {
    const raw = await mockProvider.complete({ violations: [] });
    expect(raw).toEqual({ patches: [] });
  });
});

describe("proposePatches validation", () => {
  it("accepts valid output, including JSON text in a code fence", async () => {
    const provider = scripted("```json\n" + JSON.stringify({ patches: [proposal()] }) + "\n```");
    const set = await proposePatches({ url, violations: [violation()], provider, now });
    expect(set).toEqual({ url, patches: [proposal()], model: "scripted", createdAt: "2026-11-14T12:00:00.000Z" });
    expect(provider.calls).toHaveLength(1);
  });

  it("retries malformed output once, passing the error back", async () => {
    const provider = scripted("not json", { patches: [proposal()] });
    const set = await proposePatches({ url, violations: [violation()], provider, now });
    expect(set.patches).toEqual([proposal()]);
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[0]?.previousError).toBeUndefined();
    expect(provider.calls[1]?.previousError).toBe("Response is not valid JSON.");
  });

  it("reports failure after a second invalid response", async () => {
    const unsafe = { patches: [{ ...proposal(), name: "onclick", value: "alert(1)" }] };
    const provider = scripted(unsafe, unsafe);
    await expect(proposePatches({ url, violations: [violation()], provider, now })).rejects.toThrow(/not valid/);
    expect(provider.calls).toHaveLength(2);
  });

  it("omits proposals with insufficient evidence", async () => {
    const provider = scripted({
      patches: [
        proposal({ id: "weak", confidence: 0.39 }),
        proposal({ id: "edge", confidence: 0.4 }),
        proposal({ id: "unknown-violation", violationId: "v404" }),
        proposal({ id: "wrong-target", selector: "body" }),
      ],
    });
    const set = await proposePatches({ url, violations: [violation()], provider, now });
    expect(set.patches.map((p) => p.id)).toEqual(["edge"]);
  });

  it("sends only redacted context and the caller's credentials", async () => {
    const provider = scripted({ patches: [] });
    const v = violation({ html: '<button id="b" data-owner="host@example.com"></button>' });
    await proposePatches({ url, violations: [v], provider, apiKey: "sk-test", now });
    const [req] = provider.calls;
    expect(req?.apiKey).toBe("sk-test");
    expect(JSON.stringify(req?.violations)).not.toContain("host@example.com");
  });

  it("does not call the provider when there is nothing to fix", async () => {
    const provider = scripted({ patches: [] });
    const set = await proposePatches({ url, violations: [], provider, now });
    expect(set.patches).toEqual([]);
    expect(provider.calls).toHaveLength(0);
  });
});
