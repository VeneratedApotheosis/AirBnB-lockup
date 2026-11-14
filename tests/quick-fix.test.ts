import { describe, expect, it, vi } from "vitest";
import { createQuickFix, type QuickFixSteps } from "../src/background/quick-fix";
import type { Patch, PatchSet, Violation } from "../src/shared/contracts";

const violation: Violation = {
  id: "v1", ruleId: "button-name", impact: "critical", selector: "#go",
  html: '<button id="go"></button>', help: "Buttons must have discernible text", wcag: ["wcag412"],
};
const patch: Patch = {
  id: "p1", violationId: "v1", selector: "#go", op: "setAttribute", name: "aria-label",
  value: "Go", confidence: 0.6, rationale: "Mock.",
};
const set = (patches: Patch[]): PatchSet => ({
  url: "https://example.com/", patches, model: "mock-v1", createdAt: "2026-11-14T12:00:00.000Z",
});

function steps(overrides: Partial<QuickFixSteps> = {}) {
  const calls: string[] = [];
  const s: QuickFixSteps = {
    audit: vi.fn(async () => { calls.push("audit"); return [violation]; }),
    propose: vi.fn(async () => { calls.push("propose"); return set([patch]); }),
    apply: vi.fn(async (ps: PatchSet) => { calls.push("apply"); return { applied: ps.patches.map((p) => p.id), skipped: [] }; }),
    ...overrides,
  };
  return { s, calls };
}

describe("quick fix", () => {
  it("scans, proposes and applies every suggested fix in order", async () => {
    const { s, calls } = steps();
    await expect(createQuickFix(s)()).resolves.toEqual({
      status: "applied", findings: 1, result: { applied: ["p1"], skipped: [] },
    });
    expect(calls).toEqual(["audit", "propose", "apply"]);
    expect(s.propose).toHaveBeenCalledWith([violation]);
    expect(s.apply).toHaveBeenCalledWith(set([patch]));
  });

  it("stops after the scan when the page has no findings", async () => {
    const { s, calls } = steps({ audit: async () => [] });
    await expect(createQuickFix(s)()).resolves.toEqual({ status: "no-findings" });
    expect(calls).toEqual([]);
  });

  it("does not apply when no fix was suggested", async () => {
    const { s, calls } = steps({ propose: async () => { calls.push("propose"); return set([]); } });
    await expect(createQuickFix(s)()).resolves.toEqual({ status: "no-fixes", findings: 1 });
    expect(calls).toEqual(["audit", "propose"]);
  });

  it("ignores a second press while a run is in progress, then works again", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const { s } = steps({ audit: async () => { await gate; return [violation]; } });
    const run = createQuickFix(s);
    const first = run();
    await expect(run()).resolves.toEqual({ status: "busy" });
    release();
    await expect(first).resolves.toMatchObject({ status: "applied" });
    await expect(run()).resolves.toMatchObject({ status: "applied" });
  });

  it("propagates errors and recovers for the next press", async () => {
    const audit = vi.fn<QuickFixSteps["audit"]>()
      .mockRejectedValueOnce(new Error("Chrome does not allow the extension to access this page."))
      .mockResolvedValueOnce([violation]);
    const { s } = steps({ audit });
    const run = createQuickFix(s);
    await expect(run()).rejects.toThrow("does not allow");
    await expect(run()).resolves.toMatchObject({ status: "applied" });
  });
});
