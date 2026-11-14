import { describe, expect, it } from "vitest";
import type { Patch } from "../src/shared/contracts";
import { createPatchEngine, type PatchElement, type PatchRoot } from "../src/patch";

class FakeElement implements PatchElement {
  private attrs = new Map<string, string>();
  isConnected = true;
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

  it("skips a detached element without throwing", () => {
    const button = new FakeElement();
    const engine = createPatchEngine(fakeRoot({ "#search": [button] }));
    engine.apply([patch()]);
    button.isConnected = false;
    expect(engine.revert()).toEqual({ restored: 0, skipped: 1 });
  });

  it("is a no-op when called twice", () => {
    const button = new FakeElement();
    const engine = createPatchEngine(fakeRoot({ "#search": [button] }));
    engine.apply([patch()]);
    engine.revert();
    expect(engine.revert()).toEqual({ restored: 0, skipped: 0 });
  });
});

describe("patch engine on re-rendered pages", () => {
  /** The page swaps the element behind "#search" for a new one, as a SPA re-render does. */
  function rerender(map: Record<string, FakeElement[]>, old: FakeElement, next: FakeElement) {
    old.isConnected = false;
    map["#search"] = [next];
  }

  it("patches the new element and reverts it to its own original", () => {
    const old = new FakeElement({ "aria-label": "old-first" });
    const map = { "#search": [old] };
    const engine = createPatchEngine(fakeRoot(map));
    engine.apply([patch()]);

    const next = new FakeElement({ "aria-label": "new-original" });
    rerender(map, old, next);
    expect(engine.apply([patch()])).toEqual({ applied: ["p1"], skipped: [] });
    expect(next.getAttribute("aria-label")).toBe("Search events");

    expect(engine.revert()).toEqual({ restored: 1, skipped: 1 });
    expect(next.getAttribute("aria-label")).toBe("new-original");
    expect(old.getAttribute("aria-label")).toBe("Search events");
  });

  it("removes the attribute on revert when the new element had none", () => {
    const old = new FakeElement();
    const map = { "#search": [old] };
    const engine = createPatchEngine(fakeRoot(map));
    engine.apply([patch()]);
    const next = new FakeElement();
    rerender(map, old, next);
    engine.apply([patch()]);
    engine.revert();
    expect(next.getAttribute("aria-label")).toBeNull();
  });

  it("restores every still-attached element the patch touched", () => {
    const first = new FakeElement({ "aria-label": "a" });
    const map = { "#search": [first] };
    const engine = createPatchEngine(fakeRoot(map));
    engine.apply([patch()]);
    const second = new FakeElement({ "aria-label": "b" });
    map["#search"] = [second];
    engine.apply([patch()]);
    expect(engine.revert()).toEqual({ restored: 2, skipped: 0 });
    expect(first.getAttribute("aria-label")).toBe("a");
    expect(second.getAttribute("aria-label")).toBe("b");
  });

  it("still never overwrites a site edit on the new element", () => {
    const old = new FakeElement();
    const map = { "#search": [old] };
    const engine = createPatchEngine(fakeRoot(map));
    engine.apply([patch()]);
    const next = new FakeElement();
    rerender(map, old, next);
    engine.apply([patch()]);
    next.setAttribute("aria-label", "Site's own label");
    expect(engine.apply([patch()]).skipped).toEqual([{ patchId: "p1", reason: "site-modified" }]);
    expect(next.getAttribute("aria-label")).toBe("Site's own label");
  });

  it("still skips missing and ambiguous targets after a re-render", () => {
    const old = new FakeElement();
    const map: Record<string, FakeElement[]> = { "#search": [old] };
    const engine = createPatchEngine(fakeRoot(map));
    engine.apply([patch()]);
    map["#search"] = [];
    expect(engine.apply([patch()]).skipped).toEqual([{ patchId: "p1", reason: "target-missing" }]);
    map["#search"] = [new FakeElement(), new FakeElement()];
    expect(engine.apply([patch()]).skipped).toEqual([{ patchId: "p1", reason: "target-ambiguous" }]);
  });
});
