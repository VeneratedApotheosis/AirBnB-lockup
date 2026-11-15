import type { sendRequest } from "./transport";

export function mountPageHelp(document: Document, request: typeof sendRequest): void {
  const summary = document.querySelector<HTMLButtonElement>("#summarize-page");
  const form = document.querySelector<HTMLFormElement>("#page-question-form");
  const question = document.querySelector<HTMLInputElement>("#page-question");
  const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
  const output = document.getElementById("page-help-answer");
  if (!summary || !form || !question || !submit || !output) return;

  const respond = async (prompt: string | null, button: HTMLButtonElement): Promise<void> => {
    if (summary.disabled) return;
    const hadFocus = document.activeElement === button;
    summary.disabled = submit.disabled = true;
    output.classList.remove("error");
    output.textContent = prompt === null ? "Summarizing this page…" : "Looking for an answer…";
    try {
      const result = await request({ type: "PAGE_HELP", input: { question: prompt } });
      output.textContent = result.answer;
    } catch (error) {
      output.classList.add("error");
      output.textContent = error instanceof Error ? error.message : "Page help failed. Try again.";
    } finally {
      summary.disabled = submit.disabled = false;
      if (hadFocus && document.activeElement === document.body) button.focus();
    }
  };

  summary.addEventListener("click", () => void respond(null, summary));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const prompt = question.value.trim();
    if (prompt) void respond(prompt, submit);
    else question.focus();
  });
}
