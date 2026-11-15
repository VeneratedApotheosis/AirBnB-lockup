export const MAX_PAGE_TEXT = 16_000;

export function readPageText(document: Document): string {
  const root = document.body;
  const view = document.defaultView;
  if (!root || !view) return "";

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node instanceof Element) {
        if (node.matches("script, style, noscript, select, textarea, input, [contenteditable], [hidden], [inert], [aria-hidden='true']")) {
          return NodeFilter.FILTER_REJECT;
        }
        const style = view.getComputedStyle(node);
        return style.display === "none" ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      }
      return node.parentElement && view.getComputedStyle(node.parentElement).visibility === "visible"
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  let text = "";
  while (text.length < MAX_PAGE_TEXT && walker.nextNode()) {
    const part = walker.currentNode.textContent?.trim();
    if (part) text += `${part.slice(0, MAX_PAGE_TEXT - text.length)}\n`;
  }
  return text.trim();
}
