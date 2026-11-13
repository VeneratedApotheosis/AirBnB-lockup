import { copyFile } from "node:fs/promises";
import { build } from "vite";

await build();

for (const entry of ["background", "content"]) {
  await build({
    configFile: false,
    publicDir: false,
    build: {
      target: "chrome106",
      emptyOutDir: false,
      lib: {
        entry: `src/${entry}/index.ts`,
        name: `accessibilityFixer_${entry}`,
        formats: ["iife"],
        fileName: () => `${entry}.js`,
      },
    },
  });
}

await copyFile("manifest.json", "dist/manifest.json");
