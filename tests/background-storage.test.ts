import { describe, expect, it } from "vitest";
import { createSiteFixes, siteKey, type StorageAdapter } from "../src/background/site-fixes";
import type { Patch } from "../src/shared/contracts";

class FakeStorage implements StorageAdapter {
  data: Record<string, unknown> = {};
  async get(key: string) {
    return key in this.data ? { [key]: this.data[key] } : {};
  }
  async set(items: Record<string, unknown>) {
    Object.assign(this.data, structuredClone(items));
  }
  async remove(key: string) {
    delete this.data[key];
  }
}

function patch(id: string, overrides: Partial<Patch> = {}): Patch {
  return {
    id,
    violationId: `v-${id}`,
    selector: `#${id}`,
    op: "setAttribute",
    name: "aria-label",
    value: `Label ${id}`,
    confidence: 0.9,
    rationale: "Names the control.",
    ...overrides,
  } as Patch;
}

const page = "https://stay.example/listings/42?ref=mail#photos";

describe("siteKey", () => {
  it("keys by origin and path, dropping query and hash", () => {
    expect(siteKey(page)).toBe("siteFixes:https://stay.example/listings/42");
    expect(siteKey("https://stay.example/listings/42")).toBe(siteKey(page));
  });

  it("keeps different paths and origins apart", () => {
    expect(siteKey("https://stay.example/listings/43")).not.toBe(siteKey(page));
    expect(siteKey("http://stay.example/listings/42")).not.toBe(siteKey(page));
  });

  it("returns null for non-web or malformed URLs", () => {
    expect(siteKey("chrome://extensions")).toBeNull();
    expect(siteKey("file:///C:/page.html")).toBeNull();
    expect(siteKey("not a url")).toBeNull();
  });
});

describe("createSiteFixes", () => {
  it("saves only the patches the page applied", async () => {
    const fixes = createSiteFixes(new FakeStorage());
    await fixes.save(page, [patch("a"), patch("b"), patch("c")], {
      applied: ["a", "c"],
      skipped: [{ patchId: "b", reason: "target-missing" }],
    });
    expect((await fixes.load(page)).map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("loads the same fixes for the page with a different query or hash", async () => {
    const fixes = createSiteFixes(new FakeStorage());
    await fixes.save(page, [patch("a")], { applied: ["a"], skipped: [] });
    expect(await fixes.load("https://stay.example/listings/42")).toEqual([patch("a")]);
    expect(await fixes.load("https://stay.example/listings/43")).toEqual([]);
  });

  it("merges later applies by patch id", async () => {
    const fixes = createSiteFixes(new FakeStorage());
    await fixes.save(page, [patch("a"), patch("b")], { applied: ["a", "b"], skipped: [] });
    await fixes.save(page, [patch("b", { value: "Newer" }), patch("c")], { applied: ["b", "c"], skipped: [] });
    const saved = await fixes.load(page);
    expect(saved.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(saved.find((p) => p.id === "b")?.value).toBe("Newer");
  });

  it("writes nothing when no patch was applied", async () => {
    const storage = new FakeStorage();
    await createSiteFixes(storage).save(page, [patch("a")], {
      applied: [],
      skipped: [{ patchId: "a", reason: "site-modified" }],
    });
    expect(storage.data).toEqual({});
  });

  it("clear deletes only that page's fixes", async () => {
    const fixes = createSiteFixes(new FakeStorage());
    const other = "https://stay.example/listings/43";
    await fixes.save(page, [patch("a")], { applied: ["a"], skipped: [] });
    await fixes.save(other, [patch("b")], { applied: ["b"], skipped: [] });
    await fixes.clear(page);
    expect(await fixes.load(page)).toEqual([]);
    expect(await fixes.load(other)).toEqual([patch("b")]);
  });

  it("treats invalid stored data as nothing saved", async () => {
    const storage = new FakeStorage();
    storage.data[siteKey(page)!] = [{ ...patch("a"), name: "onclick", value: "alert(1)" }];
    expect(await createSiteFixes(storage).load(page)).toEqual([]);
    storage.data[siteKey(page)!] = "garbage";
    expect(await createSiteFixes(storage).load(page)).toEqual([]);
  });

  it("ignores non-web pages", async () => {
    const storage = new FakeStorage();
    const fixes = createSiteFixes(storage);
    await fixes.save("chrome://extensions", [patch("a")], { applied: ["a"], skipped: [] });
    await fixes.clear("chrome://extensions");
    expect(storage.data).toEqual({});
    expect(await fixes.load("chrome://extensions")).toEqual([]);
  });
});
