# Extension regression test

Use Node 22.12+ and a current Google Chrome installation. To install Chrome through Playwright if needed, run `npx playwright install chrome`.

```sh
npm ci
npm run build
npm run e2e
```

The test starts a local server for the existing demo fixture on a free port, loads the unpacked extension from `dist/` in a temporary browser profile, and invokes its toolbar action. It uses the extension's built-in deterministic mock provider, so no API key is needed.
