import { describe, expect, it } from "vitest";
import { buildModelContext } from "../src/llm/context";
import { redactPersonalData } from "../src/llm/redact";
import type { Violation } from "../src/shared/contracts";

describe("redactPersonalData", () => {
  it("replaces email addresses, including mailto links", () => {
    expect(redactPersonalData('<a href="mailto:jane.doe+bnb@example.co.uk">Jane</a>'))
      .toBe('<a href="mailto:[email]">Jane</a>');
  });

  it.each([
    "555-123-4567",
    "(555) 123-4567",
    "+1 555 123 4567",
    "+44 20 7946 0958",
    "5551234567",
  ])("replaces phone number %s", (phone) => {
    expect(redactPersonalData(`<span>Call ${phone} now</span>`)).toBe("<span>Call [phone] now</span>");
  });

  it("replaces long digit runs such as card numbers", () => {
    expect(redactPersonalData("<td>4111 1111 1111 1111</td><td>4111-1111-1111-1111</td>"))
      .toBe("<td>[number]</td><td>[number]</td>");
  });

  it("replaces every input value and textarea body", () => {
    const html =
      '<input type="text" value="Jane Doe"><input value=\'secret\' name="pw">' +
      "<input value=unquoted><textarea name=msg>My address is 1 Main St</textarea>";
    const out = redactPersonalData(html);
    expect(out).toBe(
      '<input type="text" value="[value]"><input value="[value]" name="pw">' +
        '<input value="[value]"><textarea name=msg>[value]</textarea>',
    );
  });

  it("redacts a value in a snippet cut off mid-tag", () => {
    expect(redactPersonalData('<input name="email" value="jane@exa')).toBe('<input name="email" value="[value]"');
  });

  it("leaves ordinary markup alone", () => {
    const html = '<img src="/img/hero-1200.jpg" width="1200" alt=""><time>2026-11-14</time><b>$1,299.99</b>';
    expect(redactPersonalData(html)).toBe(html);
  });

  it("is idempotent", () => {
    const once = redactPersonalData('<input value="jane@example.com"> 555-123-4567');
    expect(redactPersonalData(once)).toBe(once);
  });
});

describe("buildModelContext", () => {
  const violation: Violation = {
    id: "v1",
    ruleId: "button-name",
    impact: "critical",
    selector: "#contact",
    html: '<button id="contact" data-email="host@example.com"><input value="Jane"> 555-123-4567</button>',
    help: "Buttons must have discernible text",
    wcag: ["wcag2a", "wcag412"],
  };

  it("sends no email, phone or field value to the model", () => {
    const [ctx] = buildModelContext([violation]);
    const text = JSON.stringify(ctx);
    expect(text).not.toContain("host@example.com");
    expect(text).not.toContain("555-123-4567");
    expect(text).not.toContain("Jane");
  });

  it("copies only the allowed fields, even if extra page data is attached", () => {
    const withExtras = { ...violation, pageBody: "<body>everything</body>", screenshot: "data:image/png;base64,AAAA" };
    const [ctx] = buildModelContext([withExtras]);
    expect(Object.keys(ctx ?? {}).sort()).toEqual(["help", "html", "id", "impact", "ruleId", "selector", "wcag"]);
  });
});
