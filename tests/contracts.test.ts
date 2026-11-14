import { describe, expect, it } from "vitest";
import { landmarkRoles, patchSchema, settingsSchema } from "../src/shared/contracts";
import type { Request } from "../src/shared/messages";

const proposal = {
  id: "patch-1",
  violationId: "violation-1",
  selector: "#search",
  op: "setAttribute",
  name: "aria-label",
  value: "Find events",
  confidence: 0.9,
  rationale: "The button submits the event search form.",
};

describe("patch boundary", () => {
  it("accepts a supported accessible-name change", () => {
    expect(patchSchema.safeParse(proposal).success).toBe(true);
  });

  it("rejects event handlers and unsupported operations", () => {
    expect(patchSchema.safeParse({ ...proposal, name: "onclick" }).success).toBe(false);
    expect(patchSchema.safeParse({ ...proposal, op: "insertAfter" }).success).toBe(false);
  });

  it.each(["style", "innerHTML", "href", "class", "aria-hidden"])("rejects the %s attribute", (name) => {
    expect(patchSchema.safeParse({ ...proposal, name }).success).toBe(false);
  });

  it("rejects extra keys", () => {
    expect(patchSchema.safeParse({ ...proposal, script: "alert(1)" }).success).toBe(false);
  });
});

describe("heading and landmark patches", () => {
  it.each(landmarkRoles)("accepts role=%s", (role) => {
    expect(patchSchema.safeParse({ ...proposal, name: "role", value: role }).success).toBe(true);
  });

  it.each(["button", "link", "presentation", "none", "main navigation", ""])("rejects role=%j", (role) => {
    expect(patchSchema.safeParse({ ...proposal, name: "role", value: role }).success).toBe(false);
  });

  it.each(["1", "2", "3", "4", "5", "6"])("accepts aria-level=%s", (level) => {
    expect(patchSchema.safeParse({ ...proposal, name: "aria-level", value: level }).success).toBe(true);
  });

  it.each(["0", "7", "2.5", "two", "", " 3"])("rejects aria-level=%j", (level) => {
    expect(patchSchema.safeParse({ ...proposal, name: "aria-level", value: level }).success).toBe(false);
  });

  it("does not let alt or aria-label values through the role or level rules", () => {
    expect(patchSchema.safeParse({ ...proposal, name: "alt", value: "Team photo" }).success).toBe(true);
    expect(patchSchema.safeParse({ ...proposal, name: "aria-level", value: "Team photo" }).success).toBe(false);
  });
});

describe("preset message", () => {
  it("carries a settings profile, including default to turn presets off", () => {
    const request: Request<"PRESET_APPLY"> = { type: "PRESET_APPLY", input: { profile: "default" } };
    for (const profile of ["default", "low-vision", "reading"]) {
      expect(settingsSchema.shape.profile.safeParse(profile).success).toBe(true);
    }
    expect(settingsSchema.shape.profile.safeParse("dark-mode").success).toBe(false);
    expect(request.input.profile).toBe("default");
  });
});
