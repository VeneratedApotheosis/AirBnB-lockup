import { sendRequest } from "../shared/messages";

const scanButton = document.querySelector<HTMLButtonElement>("#scan");
const status = document.querySelector<HTMLElement>("#status");

if (!scanButton || !status) throw new Error("The popup markup is missing scan controls.");

scanButton.addEventListener("click", async () => {
  scanButton.disabled = true;
  status.textContent = "Checking this page…";

  try {
    const scan = await sendRequest<"scan">({ type: "scan", input: null });
    status.textContent = `Accessibility rules flagged: ${scan.findings.length}.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Could not scan this page.";
  } finally {
    scanButton.disabled = false;
  }
});
