# Website Accessibility Fixer

Chrome Manifest V3 scaffold for auditing the current page and reviewing accessibility fixes.

1. Use Node 22.12 or later and run `npm ci`.
2. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
3. Open `chrome://extensions`, enable Developer mode, and load `dist/` unpacked.
4. Run `npm run demo` and open `http://127.0.0.1:4173/`. The fixture includes an unnamed button, missing alt text, and a skipped heading level.

## Shared Claude API key

Without a key, suggestions come from a built-in demo mock. To use Claude for the whole team:

1. Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. Get the team key privately; never post it in issues or chat logs.
2. Run `npm run build`. It prints whether the key was included. Then reload the extension.

A key saved in the popup's settings takes priority over the build key. The build key is stored in plain text in `dist/background.js`, so never commit `.env` and never share or publish `dist/`. Set a monthly spend limit on the key in the Anthropic Console and rotate it after the hackathon. For the mock-only e2e test, build without the key: `NO_API_KEY=1 npm run build` (PowerShell: `$env:NO_API_KEY=1; npm run build`).

## Architecture

The popup sends an audit request to the background service worker, which injects the content script on demand. Audit, LLM, and patch entry points are stubs for the four team issues. The shared Zod schemas currently allow only nonempty alt text and accessible-name attribute proposals. Any expansion to the patch operations should update the shared schema and patch engine together.

The scaffold uses plain Vite, a vanilla popup, and activeTab permissions. See [architecture](docs/ARCHITECTURE.md) and [coordination](docs/COORDINATION.md) for ownership and handoffs.
