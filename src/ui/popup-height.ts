/**
 * Vertical resizing for the popup. Chrome has no native resize for action popups, but it sizes
 * the popup window to the page (up to 600 px tall), so a handle that sets the body height works.
 */

export const MIN_HEIGHT = 320;
/** Chrome caps action popups at 600 px tall. */
export const MAX_HEIGHT = 600;
export const KEY_STEP = 24;

export type HeightChoice = number | "auto";

export function clampHeight(px: number): number {
  return Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, px)));
}

/** New height for a key on the handle, or null when the key does nothing. */
export function heightForKey(key: string, current: number): HeightChoice | null {
  switch (key) {
    case "ArrowUp": return clampHeight(current - KEY_STEP);
    case "ArrowDown": return clampHeight(current + KEY_STEP);
    case "PageUp": return clampHeight(current - KEY_STEP * 4);
    case "PageDown": return clampHeight(current + KEY_STEP * 4);
    case "Home": return MIN_HEIGHT;
    case "End": return MAX_HEIGHT;
    case "Escape": return "auto";
    default: return null;
  }
}

/** A saved height, or null when nothing valid is saved. */
export function parseSavedHeight(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  return clampHeight(Number(value));
}

type HeightStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const storageKey = "popup-height";

/** Wires the #popup-resize handle: pointer drag, keyboard, double-click to fit content. */
export function mountPopupHeight(document: Document, storage: HeightStorage): void {
  const handle = document.getElementById("popup-resize");
  if (!handle) return;
  const body = document.body;
  handle.setAttribute("aria-valuemin", String(MIN_HEIGHT));
  handle.setAttribute("aria-valuemax", String(MAX_HEIGHT));

  function rendered(): number {
    return clampHeight(body.getBoundingClientRect().height);
  }

  function save(choice: HeightChoice): void {
    try {
      if (choice === "auto") storage.removeItem(storageKey);
      else storage.setItem(storageKey, String(choice));
    } catch {
      // Storage can be unavailable; the height still applies for this session.
    }
  }

  function apply(choice: HeightChoice): void {
    if (choice === "auto") {
      delete body.dataset.popupHeight;
      body.style.removeProperty("--popup-height");
    } else {
      body.dataset.popupHeight = "fixed";
      body.style.setProperty("--popup-height", `${choice}px`);
    }
    const now = choice === "auto" ? rendered() : choice;
    handle!.setAttribute("aria-valuenow", String(now));
    handle!.setAttribute("aria-valuetext", choice === "auto" ? `Fit to content, ${now} pixels` : `${now} pixels`);
  }

  let saved: string | null = null;
  try {
    saved = storage.getItem(storageKey);
  } catch {
    saved = null;
  }
  apply(parseSavedHeight(saved) ?? "auto");

  let drag: { pointerId: number; startY: number; startHeight: number; height: number } | null = null;

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    const startHeight = rendered();
    drag = { pointerId: event.pointerId, startY: event.screenY, startHeight, height: startHeight };
    body.classList.add("resizing");
  });

  handle.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.height = clampHeight(drag.startHeight + event.screenY - drag.startY);
    apply(drag.height);
  });

  function endDrag(event: PointerEvent): void {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (handle!.hasPointerCapture(event.pointerId)) handle!.releasePointerCapture(event.pointerId);
    save(drag.height);
    drag = null;
    body.classList.remove("resizing");
  }
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);

  handle.addEventListener("dblclick", () => {
    apply("auto");
    save("auto");
  });

  handle.addEventListener("keydown", (event) => {
    const next = heightForKey(event.key, rendered());
    if (next === null) return;
    event.preventDefault();
    apply(next);
    save(next);
  });
}
