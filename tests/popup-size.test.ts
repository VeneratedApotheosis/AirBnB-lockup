import { describe, expect, it } from "vitest";
import { clampSize, dragSize, KEY_STEP, LIMITS, parseSavedSize, sizeForKey } from "../src/ui/popup-size";

describe("clampSize", () => {
  it("keeps sizes within Chrome's 800 x 600 popup limits", () => {
    expect(LIMITS.width.max).toBe(800);
    expect(LIMITS.height.max).toBe(600);
    expect(clampSize("width", 100)).toBe(LIMITS.width.min);
    expect(clampSize("width", 650)).toBe(650);
    expect(clampSize("width", 1200)).toBe(800);
    expect(clampSize("height", 100)).toBe(LIMITS.height.min);
    expect(clampSize("height", 450)).toBe(450);
    expect(clampSize("height", 900)).toBe(600);
  });

  it("rounds to whole pixels", () => {
    expect(clampSize("height", 450.6)).toBe(451);
  });
});

describe("sizeForKey", () => {
  it("uses Up/Down for height and Left/Right for width", () => {
    expect(sizeForKey("height", "ArrowDown", 400)).toBe(400 + KEY_STEP);
    expect(sizeForKey("height", "ArrowUp", 400)).toBe(400 - KEY_STEP);
    expect(sizeForKey("width", "ArrowRight", 500)).toBe(500 + KEY_STEP);
    expect(sizeForKey("width", "ArrowLeft", 500)).toBe(500 - KEY_STEP);
    expect(sizeForKey("height", "ArrowLeft", 400)).toBeNull();
    expect(sizeForKey("width", "ArrowUp", 500)).toBeNull();
  });

  it("takes big steps with Page Up/Down and stays within limits", () => {
    expect(sizeForKey("width", "PageDown", 500)).toBe(500 + KEY_STEP * 4);
    expect(sizeForKey("height", "PageUp", 500)).toBe(500 - KEY_STEP * 4);
    expect(sizeForKey("height", "ArrowDown", 600)).toBe(600);
    expect(sizeForKey("width", "ArrowLeft", LIMITS.width.min)).toBe(LIMITS.width.min);
  });

  it("jumps to the limits with Home/End and resets with Escape", () => {
    expect(sizeForKey("width", "Home", 500)).toBe(LIMITS.width.min);
    expect(sizeForKey("width", "End", 500)).toBe(800);
    expect(sizeForKey("height", "End", 400)).toBe(600);
    expect(sizeForKey("height", "Escape", 400)).toBe("auto");
    expect(sizeForKey("width", "Tab", 400)).toBeNull();
  });
});

describe("dragSize", () => {
  const start = { width: 500, height: 400 };

  it("grows when the bottom edge is dragged down and ignores sideways movement", () => {
    expect(dragSize(start, { dx: 50, dy: 30 }, { x: 0, y: 1 })).toEqual({ width: null, height: 430 });
  });

  it("grows when a side edge is dragged outward, on either side", () => {
    expect(dragSize(start, { dx: 40, dy: 99 }, { x: 1, y: 0 })).toEqual({ width: 540, height: null });
    expect(dragSize(start, { dx: -40, dy: 99 }, { x: -1, y: 0 })).toEqual({ width: 540, height: null });
    expect(dragSize(start, { dx: 40, dy: 0 }, { x: -1, y: 0 })).toEqual({ width: 460, height: null });
  });

  it("resizes both axes from a corner, clamped", () => {
    expect(dragSize(start, { dx: 1000, dy: 1000 }, { x: 1, y: 1 })).toEqual({ width: 800, height: 600 });
    expect(dragSize(start, { dx: 1000, dy: -1000 }, { x: -1, y: 1 })).toEqual({
      width: LIMITS.width.min,
      height: LIMITS.height.min,
    });
  });
});

describe("parseSavedSize", () => {
  it("reads a saved size and clamps it", () => {
    expect(parseSavedSize("height", "480")).toBe(480);
    expect(parseSavedSize("height", "5000")).toBe(600);
    expect(parseSavedSize("width", "5000")).toBe(800);
  });

  it("returns null when nothing valid is saved", () => {
    expect(parseSavedSize("width", null)).toBeNull();
    expect(parseSavedSize("width", "")).toBeNull();
    expect(parseSavedSize("height", "tall")).toBeNull();
    expect(parseSavedSize("height", "-20")).toBeNull();
  });
});
