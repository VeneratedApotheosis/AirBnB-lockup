import { cp, mkdir } from "node:fs/promises";
import { build } from "esbuild";

await mkdir("dist", { recursive: true });
await cp("extension", "dist", { recursive: true });
await build({
  entryPoints: {
    background: "src/background/index.ts",
    content: "src/content/index.ts",
    popup: "src/popup/index.ts",
  },
  bundle: true,
  outdir: "dist",
  platform: "browser",
  target: "chrome106",
});
