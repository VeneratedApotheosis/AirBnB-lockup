import type { sendRequest } from "./transport";

const NAME = "Claude API key";
const DESCRIPTION =
  "Get AI fix suggestions from Claude. The key is stored only in this browser and is sent only to the Claude API.";

/** Builds the API key setting. Returns its row and the text the settings search matches against. */
export function createApiKeySetting(
  document: Document,
  request: typeof sendRequest,
): { row: HTMLElement; searchText: string } {
  const row = document.createElement("div");
  row.className = "key-setting";

  const label = document.createElement("label");
  label.htmlFor = "api-key";
  label.textContent = NAME;
  const help = document.createElement("p");
  help.id = "api-key-help";
  help.className = "muted";
  help.textContent = `${DESCRIPTION} Leave it empty to use the demo suggestions.`;

  const input = document.createElement("input");
  input.id = "api-key";
  input.type = "password";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-describedby", "api-key-help api-key-status");

  const save = button("Save key", "button primary");
  const remove = button("Remove key", "quiet");
  const actions = document.createElement("div");
  actions.className = "key-actions";
  actions.append(save, remove);

  const status = document.createElement("p");
  status.id = "api-key-status";
  status.className = "muted status";
  status.setAttribute("role", "status");

  row.append(label, help, input, actions, status);

  save.addEventListener("click", () => {
    const key = input.value.trim();
    if (!key) {
      report("Paste a key first, or use Remove key to stop using Claude.", true);
      input.focus();
      return;
    }
    void store(key, "Key saved. Scan a page to get suggestions from Claude.");
  });
  remove.addEventListener("click", () => void store("", "Key removed. Suggestions use the demo mock."));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") save.click();
  });

  async function store(apiKey: string, done: string): Promise<void> {
    setBusy(true);
    report("Saving…", false);
    try {
      // SETTINGS_SET needs the full settings; keep the saved profile unchanged.
      const { profile } = await request({ type: "SETTINGS_GET", input: null });
      await request({ type: "SETTINGS_SET", input: { profile, apiKey } });
      input.value = "";
      report(done, false);
    } catch {
      report("Couldn’t save the key. Try again.", true);
    } finally {
      setBusy(false);
    }
  }

  function setBusy(busy: boolean): void {
    for (const control of [input, save, remove]) control.disabled = busy;
  }

  function report(text: string, isError: boolean): void {
    status.textContent = text;
    status.classList.toggle("error", isError);
  }

  function button(text: string, className: string): HTMLButtonElement {
    const element = document.createElement("button");
    element.type = "button";
    element.className = className;
    element.textContent = text;
    return element;
  }

  return { row, searchText: `${NAME} ${DESCRIPTION} key claude api`.toLowerCase() };
}
