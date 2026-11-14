import { describe, expect, it } from "vitest";
import { patchSchema, settingsSchema } from "../src/shared/contracts";
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
