import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRescanScheduler,
  isOwnMutation,
  RESCAN_DELAY_MS,
  type MutationLike,
} from "../src/content/observer";

const ownStyle = { id: "own-style" };
const ownText = { id: "own-text" };
const siteNode = { id: "site" };
const isOwnNode = (node: unknown) => node === ownStyle || node === ownText;

function record(overrides: Partial<MutationLike> = {}): MutationLike {
  return { type: "childList", target: siteNode, addedNodes: [], removedNodes: [], ...overrides };
}

describe("isOwnMutation", () => {
  it("counts a change inside the extension's own node as its own", () => {
    expect(isOwnMutation(record({ type: "characterData", target: ownText }), isOwnNode)).toBe(true);
    expect(isOwnMutation(record({ target: ownStyle, addedNodes: [{}] }), isOwnNode)).toBe(true);
  });

  it("counts adding or removing only the extension's nodes as its own", () => {
    expect(isOwnMutation(record({ addedNodes: [ownStyle] }), isOwnNode)).toBe(true);
    expect(isOwnMutation(record({ removedNodes: [ownStyle] }), isOwnNode)).toBe(true);
  });

  it("counts site changes, including mixed ones", () => {
    expect(isOwnMutation(record({ addedNodes: [siteNode] }), isOwnNode)).toBe(false);
    expect(isOwnMutation(record({ addedNodes: [ownStyle, siteNode] }), isOwnNode)).toBe(false);
    expect(isOwnMutation(record({ type: "attributes" }), isOwnNode)).toBe(false);
    expect(isOwnMutation(record(), isOwnNode)).toBe(false);
  });
});

describe("createRescanScheduler", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(run = vi.fn(async () => {})) {
    return { run, scheduler: createRescanScheduler({ run, isOwnNode }) };
  }

  it("defaults to a 1000 ms window", () => {
    expect(RESCAN_DELAY_MS).toBe(1000);
  });

  it("debounces a burst of changes into one rescan after the last one", () => {
    const { run, scheduler } = setup();
    scheduler.notify([record()]);
    vi.advanceTimersByTime(600);
    scheduler.notify([record()]);
    vi.advanceTimersByTime(600);
    scheduler.notify([record(), record()]);
    vi.advanceTimersByTime(999);
    expect(run).not.toHaveBeenCalled();
    expect(scheduler.pending).toBe(true);
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(scheduler.pending).toBe(false);
  });

  it("never starts a rescan for the extension's own changes", () => {
    const { run, scheduler } = setup();
    scheduler.notify([record({ addedNodes: [ownStyle] }), record({ type: "characterData", target: ownText })]);
    vi.advanceTimersByTime(5000);
    expect(run).not.toHaveBeenCalled();
    expect(scheduler.pending).toBe(false);
  });

  it("does not let own changes delay a pending rescan", () => {
    const { run, scheduler } = setup();
    scheduler.notify([record()]);
    vi.advanceTimersByTime(900);
    scheduler.notify([record({ addedNodes: [ownStyle] })]);
    vi.advanceTimersByTime(100);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("ignores changes reported while a rescan is running", async () => {
    let finish!: () => void;
    const run = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { scheduler } = setup(run);
    scheduler.notify([record()]);
    vi.advanceTimersByTime(1000);
    expect(scheduler.running).toBe(true);
    scheduler.notify([record()]);
    expect(scheduler.pending).toBe(false);
    finish();
    await vi.runAllTimersAsync();
    expect(scheduler.running).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
    scheduler.notify([record()]);
    vi.advanceTimersByTime(1000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("recovers after a failed rescan", async () => {
    const run = vi.fn(async () => { throw new Error("scan failed"); });
    const { scheduler } = setup(run);
    scheduler.notify([record()]);
    vi.advanceTimersByTime(1000);
    await vi.runAllTimersAsync();
    expect(scheduler.running).toBe(false);
  });

  it("cancel drops a pending rescan", () => {
    const { run, scheduler } = setup();
    scheduler.notify([record()]);
    scheduler.cancel();
    vi.advanceTimersByTime(5000);
    expect(run).not.toHaveBeenCalled();
    expect(scheduler.pending).toBe(false);
  });
});
