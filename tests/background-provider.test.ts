import { describe, expect, it } from "vitest";
import { chooseProvider } from "../src/background/provider";

describe("chooseProvider", () => {
  it("uses Claude when a key is saved", () => {
    expect(chooseProvider("sk-ant-test").name).toBe("claude-opus-5-5");
  });

  it.each([undefined, "", "   "])("uses the mock when the key is %j", (key) => {
    expect(chooseProvider(key).name).toBe("mock-v1");
  });
});
