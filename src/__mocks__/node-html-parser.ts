export interface MockNode {
  tagName: string;
  text: string;
  rawText: string;
  querySelector: (selector: string) => MockNode | null;
  querySelectorAll: (selector: string) => MockNode[];
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function parseElement(tag: string, content: string): MockNode {
  const innerText = stripTags(content);
  return {
    tagName: tag.toLowerCase(),
    text: innerText,
    rawText: innerText,
    querySelector(selector: string) {
      const results = this.querySelectorAll(selector);
      return results.length > 0 ? results[0] : null;
    },
    querySelectorAll(selector: string) {
      return querySelectorAllFromHtml(content, selector);
    },
  };
}

function querySelectorAllFromHtml(html: string, selector: string): MockNode[] {
  const selectors = selector.split(",").map((s) => s.trim());
  const found: MockNode[] = [];

  for (const sel of selectors) {
    let targetTag = sel.toLowerCase();
    if (targetTag.includes(" ")) {
      const parts = targetTag.split(/\s+/);
      targetTag = parts[parts.length - 1];
    }
    targetTag = targetTag.replace(/:[a-zA-Z0-9_-]+(\([^)]*\))?/g, "");

    const regex = new RegExp(
      `<${targetTag}\\b[^>]*>([\\s\\S]*?)<\\/${targetTag}>`,
      "gi",
    );
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      found.push(parseElement(targetTag, match[1]));
    }
  }

  return found;
}

export const parse = (html: string = "") => ({
  querySelector: (selector: string) => {
    const list = querySelectorAllFromHtml(html, selector);
    return list.length > 0 ? list[0] : null;
  },
  querySelectorAll: (selector: string) => querySelectorAllFromHtml(html, selector),
});
