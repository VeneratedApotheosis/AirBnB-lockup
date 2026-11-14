import type { Settings } from "../shared/contracts";

export type PresetProfile = Settings["profile"];

/** Id of the one <style> element this module owns on a page. */
export const PRESET_STYLE_ID = "accessibility-fixer-preset";

const LOW_VISION_CSS = `
html { font-size: 125% !important; }
body, body * { color: #000 !important; background-color: #fff !important; border-color: #000 !important; }
body a, body a * { color: #00e !important; text-decoration: underline !important; }
*:focus, *:focus-visible { outline: 4px solid #000 !important; outline-offset: 2px !important; box-shadow: 0 0 0 6px #ff0 !important; }
`.trim();

export const READING_FONT_PATH = "fonts/OpenDyslexic-Regular.woff2";

const READING_CSS = `
body, body * { font-family: OpenDyslexic, Verdana, Tahoma, sans-serif !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; line-height: 1.8 !important; }
body p, body li { max-width: 70ch !important; }
html { scroll-behavior: auto !important; }
*, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
`.trim();

const CSS: Record<PresetProfile, string> = {
  default: "",
  "low-vision": LOW_VISION_CSS,
  reading: READING_CSS,
};

export function presetCss(profile: PresetProfile, readingFontUrl?: string): string {
  if (profile === "reading" && readingFontUrl) {
    return `@font-face { font-family: OpenDyslexic; src: url("${readingFontUrl}") format("woff2"); font-display: swap; }\n${CSS.reading}`;
  }
  return CSS[profile];
}

/** The parts of Document that applyPreset uses, so it can be tested without a browser. */
export interface PresetStyle {
  id: string;
  textContent: string | null;
  remove(): void;
}
/** Generic over the style element type so a real `Document` (with HTMLStyleElement) fits. */
export interface PresetDocument<S extends PresetStyle = PresetStyle> {
  getElementById(id: string): unknown;
  createElement(tag: "style"): S;
  // NoInfer: S comes from createElement only; DOM's generic appendChild would otherwise confuse inference.
  head: { appendChild(node: NoInfer<S>): unknown } | null;
  documentElement: { appendChild(node: NoInfer<S>): unknown };
}

/** Adds or replaces the preset <style> this module owns. `default` removes it. */
export function applyPreset<S extends PresetStyle>(
  doc: PresetDocument<S>,
  profile: PresetProfile,
  readingFontUrl?: string,
): void {
  const existing = doc.getElementById(PRESET_STYLE_ID) as S | null;
  const css = presetCss(profile, readingFontUrl);
  if (!css) {
    existing?.remove();
    return;
  }
  if (existing) {
    existing.textContent = css;
    return;
  }
  const style = doc.createElement("style");
  style.id = PRESET_STYLE_ID;
  style.textContent = css;
  (doc.head ?? doc.documentElement).appendChild(style);
}
