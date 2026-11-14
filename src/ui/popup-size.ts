/**
 * Popup resizing. Chrome has no native resize for action popups, but it sizes the popup window
 * to the page (up to 800 x 600 px), so handles that set the body size work.
 *
 * Chrome usually pins one side of the popup under the toolbar icon, so a wider popup may grow to
 * the left. Every handle therefore grows the popup when dragged outward, whichever side is pinned.
 */

export type Axis = "width" | "height";
export type SizeChoice = number | "auto";

/** Chrome caps action popups at 800 px wide and 600 px tall. */
export const LIMITS: Record<Axis, { min: number; max: number }> = {
  width: { min: 320, max: 800 },
  height: { min: 320, max: 600 },
};
export const KEY_STEP = 24;

export function clampSize(axis: Axis, px: number): number {
  const { min, max } = LIMITS[axis];
  return Math.round(Math.min(max, Math.max(min, px)));
}

/** New size for a key on an axis's handle, or null when the key does nothing there. */
export function sizeForKey(axis: Axis, key: string, current: number): SizeChoice | null {
  const [shrink, grow] = axis === "height" ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
  switch (key) {
    case shrink: return clampSize(axis, current - KEY_STEP);
    case grow: return clampSize(axis, current + KEY_STEP);
    case "PageUp": return clampSize(axis, current - KEY_STEP * 4);
    case "PageDown": return clampSize(axis, current + KEY_STEP * 4);
    case "Home": return LIMITS[axis].min;
    case "End": return LIMITS[axis].max;
    case "Escape": return "auto";
    default: return null;
  }
}

/** A saved size, or null when nothing valid is saved. */
export function parseSavedSize(axis: Axis, value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  return clampSize(axis, Number(value));
}

/** Size after dragging a handle by (dx, dy) screen pixels. `sign` is +1 or -1 per axis, 0 to ignore it. */
export function dragSize(
  start: { width: number; height: number },
  delta: { dx: number; dy: number },
  sign: { x: -1 | 0 | 1; y: 0 | 1 },
): { width: number | null; height: number | null } {
  return {
    width: sign.x === 0 ? null : clampSize("width", start.width + sign.x * delta.dx),
    height: sign.y === 0 ? null : clampSize("height", start.height + sign.y * delta.dy),
  };
}

type SizeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const storageKeys = { height: "popup-height", width: "popup-width-px", preset: "popup-width" } as const;

/**
 * Wires the resize handles (`[data-resize]` = "s" | "e" | "w" | "se" | "sw", the edge or corner)
 * and the #popup-width preset picker. Dragging a side edge switches the picker to "Custom".
 */
export function mountPopupSize(document: Document, storage: SizeStorage): void {
  const body = document.body;
  const picker = document.querySelector<HTMLSelectElement>("#popup-width");
  const separators: Record<Axis, HTMLElement | null> = {
    height: document.getElementById("popup-resize-height"),
    width: document.getElementById("popup-resize-width"),
  };

  function read(key: string): string | null {
    try { return storage.getItem(key); } catch { return null; }
  }
  function write(key: string, value: string | null): void {
    try {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    } catch {
      // Storage can be unavailable; the size still applies for this session.
    }
  }

  function rendered(axis: Axis): number {
    const box = body.getBoundingClientRect();
    return clampSize(axis, axis === "width" ? box.width : box.height);
  }

  function announce(axis: Axis, choice: SizeChoice): void {
    const separator = separators[axis];
    if (!separator) return;
    const now = choice === "auto" ? rendered(axis) : choice;
    separator.setAttribute("aria-valuemin", String(LIMITS[axis].min));
    separator.setAttribute("aria-valuemax", String(LIMITS[axis].max));
    separator.setAttribute("aria-valuenow", String(now));
    const label = axis === "width" && choice === "auto" ? `${picker?.selectedOptions[0]?.text ?? "Preset"} width` : "Fit to content";
    separator.setAttribute("aria-valuetext", choice === "auto" ? `${label}, ${now} pixels` : `${now} pixels`);
  }

  function apply(axis: Axis, choice: SizeChoice): void {
    if (axis === "height") {
      if (choice === "auto") {
        delete body.dataset.popupHeight;
        body.style.removeProperty("--popup-height");
      } else {
        body.dataset.popupHeight = "fixed";
        body.style.setProperty("--popup-height", `${choice}px`);
      }
    } else if (choice === "auto") {
      body.style.removeProperty("--popup-width");
      const preset = picker && picker.value !== "custom" ? picker.value : "standard";
      if (picker) picker.value = preset;
      body.dataset.popupWidth = preset;
    } else {
      body.style.setProperty("--popup-width", `${choice}px`);
      body.dataset.popupWidth = "custom";
      if (picker) picker.value = "custom";
    }
    announce(axis, choice);
  }

  function save(axis: Axis, choice: SizeChoice): void {
    write(storageKeys[axis], choice === "auto" ? null : String(choice));
    if (axis === "width") write(storageKeys.preset, choice === "auto" ? picker?.value ?? null : "custom");
  }

  // Restore: a saved custom width wins over a saved preset.
  const savedPreset = read(storageKeys.preset);
  if (picker && savedPreset && savedPreset !== "custom" && [...picker.options].some((o) => o.value === savedPreset)) {
    picker.value = savedPreset;
  }
  const savedWidth = savedPreset === "custom" ? parseSavedSize("width", read(storageKeys.width)) : null;
  apply("width", savedWidth ?? "auto");
  apply("height", parseSavedSize("height", read(storageKeys.height)) ?? "auto");

  picker?.addEventListener("change", () => {
    if (picker.value === "custom") return;
    apply("width", "auto");
    save("width", "auto");
    // Height "fit to content" changes with the width.
    if (!body.dataset.popupHeight) announce("height", "auto");
  });

  const signs: Record<string, { x: -1 | 0 | 1; y: 0 | 1 }> = {
    s: { x: 0, y: 1 },
    e: { x: 1, y: 0 },
    w: { x: -1, y: 0 },
    se: { x: 1, y: 1 },
    sw: { x: -1, y: 1 },
  };

  for (const handle of document.querySelectorAll<HTMLElement>("[data-resize]")) {
    const sign = signs[handle.dataset.resize ?? ""];
    if (!sign) continue;
    let drag: {
      pointerId: number;
      x: number;
      y: number;
      start: { width: number; height: number };
      last: { width: number | null; height: number | null };
    } | null = null;

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      const start = { width: rendered("width"), height: rendered("height") };
      drag = { pointerId: event.pointerId, x: event.screenX, y: event.screenY, start, last: { width: null, height: null } };
      body.dataset.resizing = handle.dataset.resize;
    });

    handle.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag.last = dragSize(drag.start, { dx: event.screenX - drag.x, dy: event.screenY - drag.y }, sign);
      if (drag.last.width !== null) apply("width", drag.last.width);
      if (drag.last.height !== null) apply("height", drag.last.height);
    });

    const end = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      if (drag.last.width !== null) save("width", drag.last.width);
      if (drag.last.height !== null) save("height", drag.last.height);
      drag = null;
      delete body.dataset.resizing;
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);

    handle.addEventListener("dblclick", () => {
      for (const axis of ["width", "height"] as const) {
        if ((axis === "width" ? sign.x : sign.y) === 0) continue;
        apply(axis, "auto");
        save(axis, "auto");
      }
    });
  }

  for (const axis of ["width", "height"] as const) {
    separators[axis]?.addEventListener("keydown", (event) => {
      const next = sizeForKey(axis, event.key, rendered(axis));
      if (next === null) return;
      event.preventDefault();
      apply(axis, next);
      save(axis, next);
    });
  }
}
