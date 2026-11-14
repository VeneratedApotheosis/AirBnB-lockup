import { describe, expect, it } from "vitest";
import {
  applyPreset,
  presetCss,
  PRESET_STYLE_ID,
  type PresetDocument,
  type PresetStyle,
} from "../src/content/presets";

class FakeNode implements PresetStyle {
  id = "";
  textContent: string | null = null;
  parent: FakeParent | null = null;
  constructor(public tag: string) {}
  remove() {
    this.parent?.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
}

class FakeParent {
  children: FakeNode[] = [];
  appendChild(node: PresetStyle) {
    const fake = node as FakeNode;
    fake.parent = this;
    this.children.push(fake);
    return node;
  }
}

function fakeDocument(withHead = true) {
  const head = new FakeParent();
  const root = new FakeParent();
  const existing = new FakeNode("link");
  existing.id = "site-css";
  head.appendChild(existing);
  const doc: PresetDocument = {
    head: withHead ? head : null,
    documentElement: root,
    createElement: (tag) => new FakeNode(tag),
    getElementById: (id) =>
      [...head.children, ...root.children].find((n) => n.id === id) ?? null,
  };
  return { doc, head, root };
}

function snapshot(nodes: FakeNode[]) {
  return nodes.map((n) => ({ tag: n.tag, id: n.id, text: n.textContent }));
}

describe("presetCss", () => {
  it("returns an empty string for default", () => {
    expect(presetCss("default")).toBe("");
  });

  it("low-vision raises contrast, enlarges text and thickens focus outlines", () => {
    const css = presetCss("low-vision");
    expect(css).toMatch(/color: #000/);
    expect(css).toMatch(/background-color: #fff/);
    const size = Number(/font-size: (\d+)%/.exec(css)?.[1]);
    expect(size).toBeGreaterThanOrEqual(125);
    expect(css).toMatch(/:focus[^{]*\{[^}]*outline: [3-9]px/);
  });

  it("reading uses a readable font, wider spacing and reduced motion", () => {
    const css = presetCss("reading");
    expect(css).toMatch(/font-family: OpenDyslexic, Verdana, Tahoma, sans-serif/);
    expect(css).toMatch(/letter-spacing: 0\.12em/);
    expect(css).toMatch(/word-spacing: 0\.16em/);
    expect(css).toMatch(/line-height: 1\.8/);
    expect(css).toMatch(/animation-duration: 0\.01ms/);
    expect(css).toMatch(/transition-duration: 0\.01ms/);
  });

  it.each(["low-vision", "reading"] as const)("%s sets no content and loads no URLs", (profile) => {
    const css = presetCss(profile);
    expect(css).not.toMatch(/content\s*:/);
    expect(css).not.toMatch(/url\s*\(/i);
    expect(css).not.toMatch(/@import/i);
  });
});

describe("applyPreset", () => {
  it("adds one owned style element to head", () => {
    const { doc, head } = fakeDocument();
    applyPreset(doc, "low-vision");
    const styles = head.children.filter((n) => n.id === PRESET_STYLE_ID);
    expect(styles).toHaveLength(1);
    expect(styles[0]?.tag).toBe("style");
    expect(styles[0]?.textContent).toBe(presetCss("low-vision"));
  });

  it("replaces the CSS on repeated calls without adding a second element", () => {
    const { doc, head } = fakeDocument();
    applyPreset(doc, "low-vision");
    applyPreset(doc, "reading");
    applyPreset(doc, "reading");
    const styles = head.children.filter((n) => n.id === PRESET_STYLE_ID);
    expect(styles).toHaveLength(1);
    expect(styles[0]?.textContent).toBe(presetCss("reading"));
  });

  it("default removes the preset and leaves the page exactly as it was", () => {
    const { doc, head, root } = fakeDocument();
    const before = { head: snapshot(head.children), root: snapshot(root.children) };
    applyPreset(doc, "reading");
    applyPreset(doc, "low-vision");
    applyPreset(doc, "default");
    expect({ head: snapshot(head.children), root: snapshot(root.children) }).toEqual(before);
  });

  it("default on a page with no preset changes nothing", () => {
    const { doc, head } = fakeDocument();
    const before = snapshot(head.children);
    applyPreset(doc, "default");
    expect(snapshot(head.children)).toEqual(before);
  });

  it("falls back to the document element when there is no head", () => {
    const { doc, root } = fakeDocument(false);
    applyPreset(doc, "reading");
    expect(root.children.filter((n) => n.id === PRESET_STYLE_ID)).toHaveLength(1);
  });
});
