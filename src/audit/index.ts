import axe, { type Result } from "axe-core";
import type { Violation } from "../shared/contracts";

const maxHtmlLength = 512;
const activeScans = new WeakMap<Document, Promise<Violation[]>>();

export function scanPage(document: Document): Promise<Violation[]> {
  const active = activeScans.get(document);
  if (active) return active;

  // The patch engine can address elements in the current document with CSS.
  const scan = axe.run(document, {
    iframes: false,
    elementRef: true,
    resultTypes: ["violations"],
  }).then(({ violations }) => normalize(document, violations))
    .finally(() => activeScans.delete(document));

  activeScans.set(document, scan);
  return scan;
}

function normalize(document: Document, results: Result[]): Violation[] {
  const findings = new Map<string, Violation>();
  for (const rule of results) {
    const wcag = [...new Set(rule.tags.filter((tag) => tag.startsWith("wcag")))].sort();
    for (const node of rule.nodes) {
      const [selector] = node.target;
      const impact = node.impact ?? rule.impact;
      if (node.target.length !== 1 || typeof selector !== "string" || !impact || !node.element) continue;
      if (!matchesTarget(document, selector, node.element)) continue;

      const id = `${rule.id}:${selector}`;
      findings.set(id, {
        id,
        ruleId: rule.id,
        impact,
        selector,
        html: node.html.slice(0, maxHtmlLength),
        help: rule.help,
        wcag,
      });
    }
  }

  return [...findings.values()].sort((a, b) => (a.id < b.id ? -1 : Number(a.id > b.id)));
}

function matchesTarget(document: Document, selector: string, element: Element): boolean {
  try {
    const matches = document.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === element;
  } catch {
    return false;
  }
}
