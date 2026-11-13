import type { Violation } from "../shared/contracts";

export async function scanPage(_document: Document): Promise<Violation[]> {
  throw new Error("The accessibility audit is still being built.");
}
