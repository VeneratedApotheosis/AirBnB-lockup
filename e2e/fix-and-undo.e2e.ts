import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { chromium, expect, test } from "@playwright/test";

const extensionPath = fileURLToPath(new URL("../dist", import.meta.url));
const fixturePath = new URL("../tests/fixtures/barriers.html", import.meta.url);

test("applying and undoing a suggested fix changes axe findings from 3 to 2 to 3", async () => {
  const fixture = await readFile(fixturePath);
  const server = createServer((request, response) => {
    if (request.url !== "/") {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(fixture);
  });
  server.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Could not start the demo fixture server.");
    const url = `http://127.0.0.1:${address.port}/`;

    // Invoke the real toolbar action so Chrome grants activeTab for this page.
    const context = await chromium.launchPersistentContext("", {
      channel: "chrome",
      args: ["--enable-unsafe-extension-debugging"],
      ignoreDefaultArgs: ["--disable-extensions"],
    });
    try {
      const browser = context.browser();
      if (!browser) throw new Error("Playwright did not expose the Chrome browser.");
      const cdp = await browser.newBrowserCDPSession();
      const { id } = await cdp.send("Extensions.loadUnpacked", { path: extensionPath });
      const [page, { targetId }] = await Promise.all([
        context.waitForEvent("page", { timeout: 5000 }),
        cdp.send("Target.createTarget", { url, forTab: true }),
      ]);
      await page.waitForURL(url);
      const searchButton = page.locator('form[role="search"] button');
      await expect(searchButton).toHaveAccessibleName("");
      await cdp.send("Target.activateTarget", { targetId });

      const popupUrl = `chrome-extension://${id}/src/ui/popup.html`;
      await cdp.send("Extensions.triggerAction", { id, targetId });
      // Playwright can drive the popup document in a tab while the fixture stays active.
      const popup = await context.newPage();
      await popup.goto(popupUrl);
      await page.bringToFront();

      const scan = popup.getByRole("button", { name: /^(Scan this page|Rescan page)$/ });
      const findings = popup.locator("#findings-label");
      const status = popup.locator("#status");
      await scan.click();
      await expect(findings).toHaveText("Findings (3)");
      await findings.click();
      const buttonFinding = popup.locator("#findings-list li").filter({ hasText: "Button has no name" });
      await expect(buttonFinding.getByText(/A screen reader may say/)).toBeVisible();
      await expect(popup.locator("#findings-list details")).toHaveCount(0);
      await findings.click();
      await expect(popup.getByText("AI suggestion (demo mock). Medium confidence.")).toBeVisible();
      const approval = popup.getByRole("checkbox", { name: /Set accessible name/ });
      const apply = popup.getByRole("button", { name: "Apply selected fixes" });
      await expect(apply).toBeDisabled();
      await popup.getByRole("button", { name: "Select all" }).press("Enter");
      await expect(approval).toBeChecked();
      await expect(apply).toBeEnabled();
      await popup.getByRole("button", { name: "Clear selection" }).click();
      await expect(approval).not.toBeChecked();
      await expect(apply).toBeDisabled();
      await approval.check();
      await expect(popup.getByRole("button", { name: "Clear selection" })).toBeVisible();
      await apply.click();
      await expect(status).toContainText("Applied 1");
      await expect(searchButton).toHaveAccessibleName("Submit");

      await scan.click();
      await expect(findings).toHaveText("Findings (2)");
      await popup.getByRole("button", { name: "Undo fixes" }).click();
      await expect(status).toContainText("Undone 1");
      await expect(searchButton).toHaveAccessibleName("");

      await scan.click();
      await expect(findings).toHaveText("Findings (3)");
    } finally {
      await context.close();
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
