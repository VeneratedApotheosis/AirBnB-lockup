# Website Accessibility Fixer

Chrome Manifest V3 scaffold for auditing the current page and reviewing accessibility fixes.

1. Use Node 22.12 or later and run `npm ci`.
2. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
3. Open `chrome://extensions`, enable Developer mode, and load `dist/` unpacked.
4. Run `npm run demo` and open `http://127.0.0.1:4173/`. The fixture includes an unnamed button, missing alt text, and a skipped heading level.

The popup sends an audit request to the background service worker, which injects the content script on demand. Audit, LLM, and patch entry points are stubs for the four team issues. The shared Zod schemas currently allow only nonempty alt text and accessible-name attribute proposals. Any expansion to the patch operations should update the shared schema and patch engine together.

The scaffold uses plain Vite, a vanilla popup, and activeTab permissions. See [architecture](docs/architecture.md) and [coordination](docs/COORDINATION.md) for ownership and handoffs.
