/** Pure pieces of the page watcher: which mutations count, and debouncing them into one rescan. */

export const RESCAN_DELAY_MS = 1000;

/** The parts of MutationRecord the filter reads. A real MutationRecord satisfies it. */
export interface MutationLike {
  type: string;
  target: unknown;
  addedNodes: ArrayLike<unknown>;
  removedNodes: ArrayLike<unknown>;
}

/**
 * True when every node a record touches belongs to the extension (for example the preset
 * <style> or its text). Patch attribute writes are not filtered here: the content script
 * discards those records right after it writes them, so a site's own edits still count.
 */
export function isOwnMutation(record: MutationLike, isOwnNode: (node: unknown) => boolean): boolean {
  if (isOwnNode(record.target)) return true;
  if (record.type !== "childList") return false;
  const touched = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)];
  return touched.length > 0 && touched.every(isOwnNode);
}

export interface Timers {
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface RescanScheduler {
  /** Report observed mutations. Any that are not the extension's own (re)start the wait. */
  notify(records: ArrayLike<MutationLike>): void;
  /** Drop a pending rescan. */
  cancel(): void;
  readonly pending: boolean;
  readonly running: boolean;
}

/**
 * Debounces page changes into one `run` call `delayMs` after the last change.
 * Changes reported while `run` is in progress are ignored: they are the rescan's own work.
 */
export function createRescanScheduler(options: {
  run: () => Promise<void>;
  isOwnNode: (node: unknown) => boolean;
  delayMs?: number;
  timers?: Timers;
}): RescanScheduler {
  const { run, isOwnNode, delayMs = RESCAN_DELAY_MS } = options;
  const timers: Timers = options.timers ?? {
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
  let handle: unknown = null;
  let running = false;

  function cancel(): void {
    if (handle !== null) timers.clearTimeout(handle);
    handle = null;
  }

  return {
    notify(records) {
      if (running) return;
      if (Array.from(records).every((r) => isOwnMutation(r, isOwnNode))) return;
      cancel();
      handle = timers.setTimeout(() => {
        handle = null;
        running = true;
        void run().catch(() => undefined).finally(() => { running = false; });
      }, delayMs);
    },
    cancel,
    get pending() { return handle !== null; },
    get running() { return running; },
  };
}
