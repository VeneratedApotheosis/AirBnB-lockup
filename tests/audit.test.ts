import { readFileSync } from "node:fs";
import axe, { type AxeResults, type NodeResult, type Result } from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { violationSchema } from "../src/shared/contracts";
import { scanPage } from "../src/audit";

vi.mock("axe-core", () => ({ default: { run: vi.fn() } }));

const fixture = readFileSync(new URL("./fixtures/barriers.html", import.meta.url), "utf8");
const button = {} as HTMLElement;
const image = {} as HTMLElement;
const document = {
  querySelectorAll: vi.fn(),
} as unknown as Document;

function node(selector: string, element: HTMLElement, html: string): NodeResult {
  return { target: [selector], element, html, any: [], all: [], none: [] };
}

function rule(id: string, tags: string[], nodes: NodeResult[]): Result {
  return { id, tags, nodes, impact: "critical", help: id, helpUrl: "", description: "" };
}

function results(violations: Result[]): AxeResults {
  return { violations, passes: [], incomplete: [], inapplicable: [] } as AxeResults;
}

describe("scanPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(document.querySelectorAll).mockImplementation((selector) => {
      const matches = selector === "form > button" ? [button] : selector === "figure > img" ? [image] : [];
      return matches as unknown as NodeListOf<Element>;
    });
  });

  it("normalizes fixture findings in a stable order with bounded snippets", async () => {
    const buttonHtml = fixture.match(/<button\b[\s\S]*?<\/button>/)?.[0] ?? "";
    const imageHtml = fixture.match(/<img\b[^>]*>/)?.[0] ?? "";
    const buttonFinding = rule("button-name", ["wcag412", "cat.name-role-value", "wcag2a"], [
      { ...node("form > button", button, buttonHtml), impact: "serious" },
    ]);
    const imageFinding = rule("image-alt", ["wcag111", "wcag2a", "wcag111"], [
      node("figure > img", image, imageHtml.replace("data:", `data:${"x".repeat(600)}`)),
    ]);
    vi.mocked(axe.run)
      .mockResolvedValueOnce(results([imageFinding, buttonFinding]))
      .mockResolvedValueOnce(results([buttonFinding, imageFinding]));

    const first = violationSchema.array().parse(await scanPage(document));
    expect(first).toEqual(await scanPage(document));
    expect(first).toMatchObject([
      { ruleId: "button-name", selector: "form > button", impact: "serious", wcag: ["wcag2a", "wcag412"] },
      { ruleId: "image-alt", selector: "figure > img", impact: "critical", wcag: ["wcag111", "wcag2a"] },
    ]);
    expect(first[0]?.html).toContain('<button type="submit">');
    expect(first[1]?.html).toHaveLength(512);
    expect(axe.run).toHaveBeenCalledWith(document, { iframes: false, elementRef: true, resultTypes: ["violations"] });
  });

  it("drops shadow, multi-frame, missing, ambiguous, and mismatched targets", async () => {
    vi.mocked(document.querySelectorAll).mockImplementation((selector) => {
      const matches = selector === ".ambiguous" ? [button, image] : selector === "figure > img" ? [image] : [];
      return matches as unknown as NodeListOf<Element>;
    });
    vi.mocked(axe.run).mockResolvedValue(results([
      rule("button-name", [], [
        { ...node("form > button", button, ""), target: [["host", "button"]] },
        { ...node("form > button", button, ""), target: ["iframe", "button"] },
        node(".gone", button, ""),
        node(".ambiguous", button, ""),
        node("figure > img", button, ""),
      ]),
    ]));
    expect(await scanPage(document)).toEqual([]);
  });

  it("shares overlapping scans and allows a retry after a failure", async () => {
    vi.mocked(axe.run).mockRejectedValueOnce(new Error("Audit failed")).mockResolvedValueOnce(results([]));
    const first = scanPage(document);
    expect(scanPage(document)).toBe(first);
    await expect(first).rejects.toThrow("Audit failed");
    await expect(scanPage(document)).resolves.toEqual([]);
    expect(axe.run).toHaveBeenCalledTimes(2);
  });
});
