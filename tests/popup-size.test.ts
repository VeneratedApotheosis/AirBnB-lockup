import { describe, expect, it } from "vitest";
import {
  clampHeight,
  heightForKey,
  KEY_STEP,
  MAX_HEIGHT,
  MIN_HEIGHT,
  parseSavedHeight,
} from "../src/ui/popup-height";

describe("clampHeight", () => {
  it("keeps heights between the minimum and Chrome's 600 px limit", () => {
    expect(MAX_HEIGHT).toBe(600);
    expect(clampHeight(100)).toBe(MIN_HEIGHT);
    expect(clampHeight(450)).toBe(450);
    expect(clampHeight(900)).toBe(MAX_HEIGHT);
  });

  it("rounds to whole pixels", () => {
    expect(clampHeight(450.6)).toBe(451);
  });
});

describe("heightForKey", () => {
  it("moves the bottom edge with the arrow and page keys", () => {
    expect(heightForKey("ArrowDown", 400)).toBe(400 + KEY_STEP);
    expect(heightForKey("ArrowUp", 400)).toBe(400 - KEY_STEP);
    expect(heightForKey("PageDown", 400)).toBe(400 + KEY_STEP * 4);
    expect(heightForKey("PageUp", 500)).toBe(500 - KEY_STEP * 4);
  });

  it("stays within the limits", () => {
    expect(heightForKey("ArrowDown", MAX_HEIGHT)).toBe(MAX_HEIGHT);
    expect(heightForKey("ArrowUp", MIN_HEIGHT)).toBe(MIN_HEIGHT);
  });

  it("jumps to the limits with Home and End, and fits content with Escape", () => {
    expect(heightForKey("Home", 450)).toBe(MIN_HEIGHT);
    expect(heightForKey("End", 450)).toBe(MAX_HEIGHT);
    expect(heightForKey("Escape", 450)).toBe("auto");
  });

  it("ignores other keys", () => {
    expect(heightForKey("Tab", 450)).toBeNull();
    expect(heightForKey("a", 450)).toBeNull();
  });
});

describe("parseSavedHeight", () => {
  it("reads a saved height and clamps it", () => {
    expect(parseSavedHeight("480")).toBe(480);
    expect(parseSavedHeight("5000")).toBe(MAX_HEIGHT);
  });

  it("returns null when nothing valid is saved", () => {
    expect(parseSavedHeight(null)).toBeNull();
    expect(parseSavedHeight("")).toBeNull();
    expect(parseSavedHeight("tall")).toBeNull();
    expect(parseSavedHeight("-20")).toBeNull();
  });
});
