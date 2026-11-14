import { patchSchema, type Patch, type PatchResult } from "../shared/contracts";

/** The slice of chrome.storage.local the helper needs, so it can be tested without Chrome. */
export interface StorageAdapter {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

const keyPrefix = "siteFixes:";
const savedPatchesSchema = patchSchema.array();

/** Storage key for a page: origin + path, query and hash removed. null for non-web URLs. */
export function siteKey(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return `${keyPrefix}${parsed.origin}${parsed.pathname}`;
}

export interface SiteFixes {
  /** Saved patches for the page, or [] when none are saved or the stored data is invalid. */
  load(url: string): Promise<Patch[]>;
  /** Saves the patches whose ids the page applied, merged with earlier ones by patch id. */
  save(url: string, patches: Patch[], result: PatchResult): Promise<void>;
  /** Deletes the page's saved patches. */
  clear(url: string): Promise<void>;
}

export function createSiteFixes(storage: StorageAdapter): SiteFixes {
  async function load(url: string): Promise<Patch[]> {
    const key = siteKey(url);
    if (!key) return [];
    const stored = await storage.get(key);
    const parsed = savedPatchesSchema.safeParse(stored[key]);
    return parsed.success ? parsed.data : [];
  }

  return {
    load,

    async save(url, patches, result) {
      const key = siteKey(url);
      const applied = new Set(result.applied);
      const fresh = patches.filter((patch) => applied.has(patch.id));
      if (!key || fresh.length === 0) return;
      const merged = new Map((await load(url)).map((patch) => [patch.id, patch]));
      for (const patch of fresh) merged.set(patch.id, patch);
      await storage.set({ [key]: [...merged.values()] });
    },

    async clear(url) {
      const key = siteKey(url);
      if (key) await storage.remove(key);
    },
  };
}
