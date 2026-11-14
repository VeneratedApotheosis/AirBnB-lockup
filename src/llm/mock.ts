import type { Patch } from "../shared/contracts";
import type { ModelViolation } from "./context";
import type { ModelProvider } from "./index";

const NAME_RULES = new Set(["button-name", "link-name", "input-button-name", "label", "select-name"]);

/**
 * Deterministic stand-in for a real model. It guesses a name from hints in the
 * element's own markup and returns the same response shape a real provider must.
 */
export const mockProvider: ModelProvider = {
  name: "mock-v1",
  async complete({ violations }) {
    const patches = violations.flatMap((v) => {
      const patch = proposeFor(v);
      return patch ? [patch] : [];
    });
    return { patches };
  },
};

function proposeFor(v: ModelViolation): Patch | null {
  const attr = v.ruleId === "image-alt" ? "alt" : NAME_RULES.has(v.ruleId) ? "aria-label" : null;
  if (!attr) return null;
  const hint = nameHint(v.html, attr === "alt");
  if (!hint) return null;
  return {
    id: `patch-${v.id}`,
    violationId: v.id,
    selector: v.selector,
    op: "setAttribute",
    name: attr,
    value: hint.text,
    confidence: hint.confidence,
    rationale: `Mock suggestion based on the element's ${hint.source}.`,
  };
}

function nameHint(html: string, isImage: boolean): { text: string; source: string; confidence: number } | null {
  for (const source of ["title", "placeholder", "name", "id"]) {
    const value = attribute(html, source);
    const text = value && humanize(value);
    if (text) return { text, source: `${source} attribute`, confidence: source === "title" ? 0.8 : 0.6 };
  }
  if (isImage) {
    const src = attribute(html, "src");
    const file = src && !src.startsWith("data:") ? src.split(/[?#]/)[0]?.split("/").pop() : undefined;
    const text = file && humanize(file.replace(/\.[a-z0-9]+$/i, ""));
    if (text) return { text, source: "file name", confidence: 0.5 };
  }
  if (attribute(html, "type") === "submit") return { text: "Submit", source: "submit type", confidence: 0.5 };
  return null;
}

function attribute(html: string, name: string): string | undefined {
  const tag = html.match(/^<[^>]*>?/)?.[0] ?? "";
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function humanize(raw: string): string {
  if (raw.includes("[")) return ""; // redacted placeholder: no usable hint
  const words = raw.replace(/([a-z])([A-Z])/g, "$1 $2").split(/[\s_.-]+/).filter((w) => /^[a-z]+$/i.test(w));
  const text = words.join(" ").toLowerCase();
  return text ? text[0]!.toUpperCase() + text.slice(1) : "";
}
