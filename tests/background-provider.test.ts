import { describe, expect, it } from "vitest";
import { chooseProvider, resolveApiKey } from "../src/background/provider";

describe("chooseProvider", () => {
  it("uses Claude when a key is saved", () => {
    expect(chooseProvider("sk-ant-test").name).toBe("claude-opus-5-5");
  });

  it.each([undefined, "", "   "])("uses the mock when the key is %j", (key) => {
    expect(chooseProvider(key).name).toBe("mock-v1");
  });
});

describe("resolveApiKey", () => {
  it("prefers the key saved in settings", () => {
    expect(resolveApiKey(" sk-ant-mine ", "sk-ant-team")).toBe("sk-ant-mine");
  });

  it("falls back to the build key when nothing is saved", () => {
    expect(resolveApiKey(undefined, "sk-ant-team")).toBe("sk-ant-team");
    expect(resolveApiKey("   ", " sk-ant-team ")).toBe("sk-ant-team");
  });

  it("returns undefined when there is no key at all, so the mock is used", () => {
    expect(resolveApiKey(undefined, "")).toBeUndefined();
    expect(resolveApiKey("", undefined)).toBeUndefined();
    expect(chooseProvider(resolveApiKey("", "")).name).toBe("mock-v1");
  });
});
