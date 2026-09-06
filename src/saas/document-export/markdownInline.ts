// PD-SAAS-FORK: markdown inline → readable export text / HTML / DOCX runs
export type InlineSegment =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };

export type DocxTextRun = {
  text: string;
  bold?: boolean;
  italics?: boolean;
  font?: string;
};

const SPECIAL_CHARS = new Set(["*", "`", "[", "<", "\\", "~", "!", "_"]);

function findNextSpecial(input: string, from: number): number {
  for (let index = from; index < input.length; index += 1) {
    if (SPECIAL_CHARS.has(input[index]!)) return index;
  }
  return input.length;
}

function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]+>/g, "");
}

function decodeBasicEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function cleanupResidualMarkdown(input: string): string {
  return input
    .replace(/\*\*(?=\s|$)/g, "")
    .replace(/(^|\s)\*\*(?=\s)/g, "$1")
    .replace(/`+/g, "")
    .replace(/~~/g, "")
    .replace(/\[(.*?)\]\([^)]*\)/g, "$1")
    .replace(/\[(.*?)\]\[[^\]]*\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function linkExportText(label: string, href: string): string {
  const cleanLabel = cleanupResidualMarkdown(normalizeMarkdownInline(label));
  const cleanHref = href.trim();
  if (!cleanHref || cleanHref.startsWith("#")) return cleanLabel;
  if (/^https?:\/\//i.test(cleanHref)) {
    if (!cleanLabel || cleanLabel === cleanHref) return cleanHref;
    return `${cleanLabel}（${cleanHref}）`;
  }
  return cleanLabel || cleanHref;
}

/** Parse markdown inline syntax into semantic segments (export-safe). */
export function parseMarkdownInline(input: string): InlineSegment[] {
  const source = decodeBasicEntities(stripHtmlTags(String(input ?? "")));
  const segments: InlineSegment[] = [];
  let index = 0;

  const pushText = (value: string) => {
    if (value) segments.push({ kind: "text", text: value });
  };

  while (index < source.length) {
    if (source.startsWith("![", index)) {
      const altEnd = source.indexOf("]", index + 2);
      const parenStart = altEnd >= 0 ? source.indexOf("(", altEnd) : -1;
      const parenEnd = parenStart >= 0 ? source.indexOf(")", parenStart) : -1;
      if (altEnd > index && parenStart === altEnd + 1 && parenEnd > parenStart) {
        const alt = source.slice(index + 2, altEnd);
        pushText(alt.trim());
        index = parenEnd + 1;
        continue;
      }
    }

    if (source[index] === "[") {
      const closeBracket = source.indexOf("]", index + 1);
      if (closeBracket > index && source[closeBracket + 1] === "(") {
        const closeParen = source.indexOf(")", closeBracket + 2);
        if (closeParen > closeBracket) {
          segments.push({
            kind: "link",
            text: source.slice(index + 1, closeBracket),
            href: source.slice(closeBracket + 2, closeParen),
          });
          index = closeParen + 1;
          continue;
        }
      }
    }

    if (source.startsWith("**", index)) {
      const end = source.indexOf("**", index + 2);
      if (end > index + 2) {
        segments.push({ kind: "bold", text: source.slice(index + 2, end) });
        index = end + 2;
        continue;
      }
    }

    if (source.startsWith("__", index)) {
      const end = source.indexOf("__", index + 2);
      if (end > index + 2) {
        segments.push({ kind: "bold", text: source.slice(index + 2, end) });
        index = end + 2;
        continue;
      }
    }

    if (source.startsWith("~~", index)) {
      const end = source.indexOf("~~", index + 2);
      if (end > index + 2) {
        segments.push({ kind: "text", text: source.slice(index + 2, end) });
        index = end + 2;
        continue;
      }
    }

    if (source[index] === "`") {
      const end = source.indexOf("`", index + 1);
      if (end > index) {
        segments.push({ kind: "code", text: source.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    if (source[index] === "*" && source[index + 1] !== "*") {
      const end = source.indexOf("*", index + 1);
      if (end > index + 1 && source[end + 1] !== "*") {
        segments.push({ kind: "italic", text: source.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    if (source[index] === "_" && source[index + 1] !== "_") {
      const end = source.indexOf("_", index + 1);
      if (end > index + 1 && source[end + 1] !== "_") {
        segments.push({ kind: "italic", text: source.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    if (source[index] === "<") {
      const end = source.indexOf(">", index + 1);
      if (end > index && /^https?:\/\//i.test(source.slice(index + 1, end))) {
        segments.push({ kind: "link", text: source.slice(index + 1, end), href: source.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    if (source[index] === "\\" && index + 1 < source.length) {
      pushText(source[index + 1]!);
      index += 2;
      continue;
    }

    const next = findNextSpecial(source, index + 1);
    pushText(source.slice(index, next));
    index = next === index ? index + 1 : next;
  }

  return segments;
}

/** Plain readable text for PPTX / fallback paths. */
export function normalizeMarkdownInline(input: string): string {
  const plain = parseMarkdownInline(input)
    .map((segment) => {
      switch (segment.kind) {
        case "link":
          return linkExportText(segment.text, segment.href);
        case "bold":
        case "italic":
        case "code":
        case "text":
          return segment.text;
        default: {
          const exhaustive: never = segment;
          return exhaustive;
        }
      }
    })
    .join("");
  return cleanupResidualMarkdown(plain);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Rich inline HTML for PDF export (Playwright HTML → PDF). */
export function markdownInlineToHtml(input: string): string {
  return parseMarkdownInline(input)
    .map((segment) => {
      switch (segment.kind) {
        case "text":
          return escapeHtml(segment.text);
        case "bold":
          return `<strong>${escapeHtml(normalizeMarkdownInline(segment.text))}</strong>`;
        case "italic":
          return `<em>${escapeHtml(normalizeMarkdownInline(segment.text))}</em>`;
        case "code":
          return `<code>${escapeHtml(segment.text)}</code>`;
        case "link": {
          const label = normalizeMarkdownInline(segment.text);
          const href = segment.href.trim();
          if (!href || href.startsWith("#")) {
            return escapeHtml(label);
          }
          if (/^https?:\/\//i.test(href)) {
            const visible = label && label !== href ? label : href;
            return `<a href="${escapeHtml(href)}">${escapeHtml(visible)}</a>`;
          }
          return escapeHtml(label || href);
        }
        default: {
          const exhaustive: never = segment;
          return exhaustive;
        }
      }
    })
    .join("");
}

/** DOCX TextRun payloads with bold/italic/code styling. */
export function markdownInlineToDocxRuns(input: string): DocxTextRun[] {
  const runs: DocxTextRun[] = [];
  for (const segment of parseMarkdownInline(input)) {
    switch (segment.kind) {
      case "text":
        if (segment.text) runs.push({ text: segment.text });
        break;
      case "bold": {
        const text = normalizeMarkdownInline(segment.text);
        if (text) runs.push({ text, bold: true });
        break;
      }
      case "italic": {
        const text = normalizeMarkdownInline(segment.text);
        if (text) runs.push({ text, italics: true });
        break;
      }
      case "code": {
        if (segment.text) runs.push({ text: segment.text, font: "Consolas" });
        break;
      }
      case "link": {
        const text = linkExportText(segment.text, segment.href);
        if (text) runs.push({ text });
        break;
      }
      default: {
        const exhaustive: never = segment;
        return exhaustive;
      }
    }
  }
  if (runs.length === 0) {
    const fallback = cleanupResidualMarkdown(String(input ?? ""));
    if (fallback) runs.push({ text: fallback });
  }
  return runs;
}
