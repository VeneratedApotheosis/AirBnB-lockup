import { describe, expect, it } from "vitest";
import type { Patch } from "../src/shared/contracts";
import { createPatchEngine, type PatchElement, type PatchRoot } from "../src/patch";

class FakeElement implements PatchElement {
  private attrs = new Map<string, string>();
  constructor(initial: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(initial)) this.attrs.set(k, v);
  }
  getAttribute(name: string) {
    return this.attrs.get(name) ?? null;
  }
  setAttribute(name: string, value: string) {
    this.attrs.set(name, String(value));
  }
  removeAttribute(name: string) {
    this.attrs.delete(name);
  }
}

function fakeRoot(bySelector: Record<string, FakeElement[]>): PatchRoot {
  return {
    querySelectorAll(selector) {
      if (selector.startsWith("[[")) throw new SyntaxError("bad selector");
      return bySelector[selector] ?? [];
    },
  };
}

function patch(overrides: Partial<Patch> = {}): Patch {
  return {
    id: "p1",
    violationId: "v1",
    selector: "#search",
    op: "setAttribute",
    name: "aria-label",
    value: "Search events",
    confidence: 0.9,
    rationale: "Button submits the search form.",
    ...overrides,
  };
}

describe("patch engine apply", () => {
  it("sets an accessible name on a single verified target", () => {
    const button = new FakeElement();
    const engine = createPatchEngine(fakeRoot({ "#search": [button] }));
    expect(engine.apply([patch()])).toEqual({ applied: ["p1"], skipped: [] });
    expect(button.getAttribute("aria-label")).toBe("Search events");
  });

  it("sets alt text on an image", () => {
    const img = new FakeElement();
    const engine = createPatchEngine(fakeRoot({ "img.hero": [img] }));
    engine.apply([patch({ selector: "img.hero", name: "alt", value: "Beach house at sunset" })]);
    expect(img.getAttribute("alt")).toBe("Beach house at sunset");
  });

  it("skips missing, ambiguous and invalid-selector targets", () => {
    const root = fakeRoot({ ".btn": [new FakeElement(), new FakeElement()] });
    const result = createPatchEngine(root).apply([
      patch({ id: "missing", selector: "#nope" }),
      patch({ id: "ambiguous", selector: ".btn" }),
      patch({ id: "bad", selector: "[[x" }),
    ]);
    expect(result.applied).toEqual([]);
    expect(result.skipped).toEqual([
      { patchId: "missing", reason: "target-missing" },
      { patchId: "ambiguous", reason: "target-ambiguous" },
      { patchId: "bad", reason: "invalid-selector" },
    ]);
  });

  it("rejects event handlers, unsupported ops and malformed input without touching the DOM", () => {
    const button = new FakeElement();
    const engine = createPatchEngine(fakeRoot({ "#search": [button] }));
    const result = engine.apply([
      { ...patch({ id: "onclick" }), name: "onclick", value: "alert(1)" },
      { ...patch({ id: "insert" }), op: "insertAfter" },
      { ...patch({ id: "html" }), name: "innerHTML", value: "<img src=x onerror=alert(1)>" },
      null,
    ]);
    expect(result.applied).toEqual([]);
    expect(result.skipped.map((s) => s.reason)).toEqual(Array(4).fill("invalid-patch"));
    expect(result.skipped.map((s) => s.patchId)).toEqual(["onclick", "insert", "html", "unknown"]);
    expect(button.getAttribute("onclick")).toBeNull();
    expect(button.getAttribute("innerHTML")).toBeNull();
  });

  it("stores model text literally, never as markup", () => {
    const button = new FakeElement();
    const engine = createPatchEngine(fakeRoot({ "#search": [button] }));
    engine.apply([patch({ value: "<b>Search</b>" })]);
    expect(button.getAttribute("aria-label")).toBe("<b>Search</b>");
  });

  it("is safe to apply the same patch repeatedly", () => {
    const button = new FakeElement({ "aria-label": "old" });
    const engine = createPatchEngine(fakeRoot({ "#search": [button] }));
    engine.apply([patch()]);
    expect(engine.apply([patch()])).toEqual({ applied: ["p1"], skipped: [] });
    expect(engine.revert()).toEqual({ restored: 1, skipped: 0 });
    expect(button.getAttribute("aria-label")).toBe("old");
  });

  it("does not overwrite a site edit made after apply when re-applying", () => {
    const button = new FakeElement();
    const engine = createPatchEngine(fakeRoot({ "#search": [button] }));
    engine.apply([patch()]);
    button.setAttribute("aria-label", "Site's own label");
    expect(engine.apply([patch()]).skipped).toEqual([{ patchId: "p1", reason: "site-modified" }]);
    expect(button.getAttribute("aria-label")).toBe("Site's own label");
  });
});

describe("patch engine revert", () => {
  it("restores an original attribute and removes one that did not exist", () => {
    const img = new FakeElement({ alt: "" });
    const button = new FakeElement();
    const engine = createPatchEngine(fakeRoot({ img: [img], "#search": [button] }));
    engine.apply([patch({ id: "a", selector: "img", name: "alt", value: "Pool" }), patch({ id: "b" })]);
    expect(engine.revert()).toEqual({ restored: 2, skipped: 0 });
    expect(img.getAttribute("alt")).toBe("");
    expect(button.getAttribute("aria-label")).toBeNull();
  });

  it("keeps the true original when two patches hit the same attribute", () => {
    const button = new FakeElement({ "aria-label": "orig" });
    const engine = createPatchEngine(fakeRoot({ "#search": [button] }));
    engine.apply([patch({ id: "a", value: "First" }), patch({ id: "b", value: "Second" })]);
    expect(button.getAttribute("aria-label")).toBe("Second");
    expect(engine.revert()).toEqual({ restored: 1, skipped: 0 });
    expect(button.getAttribute("aria-label")).toBe("orig");
  });

  it("leaves later site edits in place", () => {
    const button = new FakeElement();
    const engine = createPatchEngine(fakeRoot({ "#search": [button] }));
    engine.apply([patch()]);
    button.setAttribute("aria-label", "Site's own label");
    expect(engine.revert()).toEqual({ restored: 0, skipped: 1 });
    expect(button.getAttribute("aria-label")).toBe("Site's own label");
  });

  it("is a no-op when called twice", () => {
    const button = new FakeElement();
    const engine = createPatchEngine(fakeRoot({ "#search": [button] }));
    engine.apply([patch()]);
    engine.revert();
    expect(engine.revert()).toEqual({ restored: 0, skipped: 0 });
  });
});
