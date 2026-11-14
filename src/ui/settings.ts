import type { PublicSettings } from "../shared/contracts";
import type { sendRequest } from "./transport";

type Profile = PublicSettings["profile"];

const profiles: { value: Profile; name: string; description: string }[] = [
  { value: "default", name: "Default", description: "Use the website’s original appearance." },
  { value: "low-vision", name: "Low vision", description: "Increase contrast, enlarge text, and strengthen focus outlines." },
  { value: "reading", name: "Reading", description: "Increase text spacing and reduce motion for easier reading." },
];

export function mountSettings(document: Document, request: typeof sendRequest): void {
  const search = document.querySelector<HTMLInputElement>("#settings-search")!;
  const fieldset = document.querySelector<HTMLFieldSetElement>("#profiles")!;
  const options = document.querySelector("#profile-options")!;
  const results = document.querySelector<HTMLElement>("#settings-results")!;
  const status = document.querySelector<HTMLElement>("#settings-status")!;
  let saved: Profile | undefined;

  const rows = profiles.map(({ value, name, description }) => {
    const row = document.createElement("label");
    row.className = "option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "profile";
    input.value = value;
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = name;
    const details = document.createElement("span");
    details.className = "muted";
    details.textContent = description;
    copy.append(title, details);
    row.append(input, copy);
    input.addEventListener("change", () => void save(value, input));
    return { value, row, input, searchText: `${name} ${description}`.toLowerCase() };
  });
  options.append(...rows.map(({ row }) => row));

  search.addEventListener("input", () => {
    const terms = search.value.trim().toLowerCase().split(/\s+/);
    let count = 0;
    for (const { row, searchText } of rows) {
      row.hidden = !terms.every((term) => searchText.includes(term));
      if (!row.hidden) count += 1;
    }
    results.classList.toggle("visually-hidden", count > 0);
    results.textContent = count === 0 ? "No settings match your search." : `${count} matching ${count === 1 ? "setting" : "settings"}.`;
  });

  function reflectSaved(): void {
    for (const row of rows) row.input.checked = row.value === saved;
  }

  async function save(profile: Profile, input: HTMLInputElement): Promise<void> {
    if (fieldset.disabled) return;
    const hadFocus = document.activeElement === input;
    fieldset.disabled = true;
    status.classList.remove("error");
    status.textContent = "Saving preference…";
    try {
      saved = (await request({ type: "SETTINGS_SET", input: { profile } })).profile;
      status.textContent = "Preference saved. Applying profiles to pages will be available later.";
    } catch {
      status.classList.add("error");
      status.textContent = "Couldn’t save the preference. Choose a profile to retry.";
    } finally {
      reflectSaved();
      fieldset.disabled = false;
      if (hadFocus && document.activeElement === document.body) {
        (input.closest("[hidden]") ? search : input).focus();
      }
    }
  }

  void request({ type: "SETTINGS_GET", input: null }).then(({ profile }) => {
    saved = profile;
    reflectSaved();
    status.textContent = "Profile preferences are saved for later use.";
    fieldset.disabled = false;
  }, () => {
    status.classList.add("error");
    status.textContent = "Couldn’t load settings. Reopen the popup to retry.";
  });
}
