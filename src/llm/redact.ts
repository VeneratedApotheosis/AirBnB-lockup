/**
 * Replace personal data in an HTML snippet with placeholders before it can reach a model.
 * Over-redaction is preferred to leaks: a stray ID that looks like a phone number is fine to lose.
 */
export function redactPersonalData(html: string): string {
  return [redactFieldValues, redactEmails, redactDigitRuns, redactPhones].reduce(
    (text, step) => step(text),
    html,
  );
}

const FIELD_TAG = /<(?:input|textarea)\b[^>]*>?/gi;
const VALUE_ATTR = /(\svalue\s*=\s*)(?:"[^"]*"?|'[^']*'?|[^\s>]+)/gi;
const TEXTAREA_BODY = /(<textarea\b[^>]*>)[^<]+/gi;

function redactFieldValues(html: string): string {
  return html
    .replace(FIELD_TAG, (tag) => tag.replace(VALUE_ATTR, '$1"[value]"'))
    .replace(TEXTAREA_BODY, "$1[value]");
}

const EMAIL = /[\w.%+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}/gi;

function redactEmails(html: string): string {
  return html.replace(EMAIL, "[email]");
}

// 12+ digits, optionally split by single spaces or dashes: card, account and ID numbers.
// A leading "+" marks an international phone number, which the phone step handles.
const DIGIT_RUN = /(?<![+\d])\d(?:[ -]?\d){11,}/g;

function redactDigitRuns(html: string): string {
  return html.replace(DIGIT_RUN, "[number]");
}

// Separated forms like 555-123-4567, (555) 123-4567, +44 20 7946 0958, or 10-11 bare digits.
const PHONE_SEPARATED = /(?<!\w)(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)\s?|\d{2,4}[\s.-])\d{3,4}[\s.-]\d{3,4}(?!\w)/g;
const PHONE_BARE = /(?<![\w-])\+?\d{10,11}(?!\w)/g;

function redactPhones(html: string): string {
  return html.replace(PHONE_SEPARATED, "[phone]").replace(PHONE_BARE, "[phone]");
}
