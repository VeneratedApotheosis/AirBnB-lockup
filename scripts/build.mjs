import { copyFile, readFile } from "node:fs/promises";
import process from "node:process";
import { parseEnv } from "node:util";
import { build } from "vite";

// Shared team key, read only from the gitignored .env file (never from the shell environment,
// so a personal ANTHROPIC_API_KEY is not baked in by accident). NO_API_KEY=1 leaves it out.
// The key ends up in plain text in dist/background.js: never share or publish dist/.
async function buildApiKey() {
  if (process.env.NO_API_KEY === "1") return "";
  const text = await readFile(".env", "utf8").catch(() => "");
  return (parseEnv(text).ANTHROPIC_API_KEY ?? "").trim();
}

const apiKey = await buildApiKey();
console.log(apiKey ? "Build: shared Claude API key from .env included in background.js." : "Build: no shared API key.");

await build();

for (const entry of ["background", "content"]) {
  await build({
    configFile: false,
    publicDir: false,
    // Only the service worker gets the key; content.js and the popup never see it.
    define: entry === "background" ? { __BUILD_API_KEY__: JSON.stringify(apiKey) } : {},
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
