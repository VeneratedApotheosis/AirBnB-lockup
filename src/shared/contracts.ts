import { z } from "zod";

export const violationSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  impact: z.enum(["minor", "moderate", "serious", "critical"]),
  selector: z.string().min(1),
  html: z.string(),
  help: z.string(),
  wcag: z.array(z.string()),
});

const patchTargetSchema = z.object({
  id: z.string().min(1),
  violationId: z.string().min(1),
  selector: z.string().min(1),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
});

export const patchSchema = patchTargetSchema.extend({
  op: z.literal("setAttribute"),
  name: z.enum(["alt", "aria-label"]),
  value: z.string().trim().min(1),
}).strict();

export const patchSetSchema = z.object({
  url: z.url(),
  patches: z.array(patchSchema),
  model: z.string(),
  createdAt: z.iso.datetime(),
});

export type Violation = z.infer<typeof violationSchema>;
export type Patch = z.infer<typeof patchSchema>;
export type PatchSet = z.infer<typeof patchSetSchema>;

export const settingsSchema = z.object({
  profile: z.enum(["default", "low-vision", "reading"]),
  apiKey: z.string().optional(),
});

export type Settings = z.infer<typeof settingsSchema>;
export type PublicSettings = Pick<Settings, "profile">;

export interface PatchResult {
  applied: string[];
  skipped: { patchId: string; reason: string }[];
}

export interface RevertResult {
  restored: number;
  skipped: number;
}
