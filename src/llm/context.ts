import type { Violation } from "../shared/contracts";
import { redactPersonalData } from "./redact";

/** What the model may see about one violation. Nothing else from the page is sent. */
export type ModelViolation = Pick<Violation, "id" | "ruleId" | "impact" | "selector" | "help" | "wcag" | "html">;

/**
 * The only way to build page context for a model request. It copies the allowed
 * fields by name, so extra properties never pass through, and always redacts `html`.
 */
export function buildModelContext(violations: readonly Violation[]): ModelViolation[] {
  return violations.map((v) => ({
    id: v.id,
    ruleId: v.ruleId,
    impact: v.impact,
    selector: v.selector,
    help: v.help,
    wcag: [...v.wcag],
    html: redactPersonalData(v.html),
  }));
}
