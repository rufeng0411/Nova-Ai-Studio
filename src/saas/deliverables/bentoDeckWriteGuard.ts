// PD-SAAS-FORK: engine-side guard — agent write_file must produce valid Bento shell + doc
import { createHash } from "node:crypto";

const ARTIFACTS_ROOT_RE = /(?:^|[\\/])artifacts[\\/]/i;
const BENTO_FILE_RE = /\.bento\.html$/i;
const BENTO_DOC_RE =
  /<script\s+type=["']application\/bento\+json["']\s+id=["']bento-doc["'][^>]*>([\s\S]*?)<\/script>/i;

export const BENTO_DECK_MAX_BYTES = Number(process.env.BENTO_DECK_MAX_BYTES || 8 * 1024 * 1024);

function sha256Content(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function extractShellWithoutDoc(html: string): string {
  return String(html ?? "").replace(BENTO_DOC_RE, "<!-- bento-doc -->");
}

function hasBentoDocBlock(html: string): boolean {
  return BENTO_DOC_RE.test(String(html ?? ""));
}

export function isBentoDeckWritePath(relativePath: string): boolean {
  const normalized = String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!ARTIFACTS_ROOT_RE.test(normalized)) return false;
  return BENTO_FILE_RE.test(normalized);
}

export function validateBentoDeckWriteContent(
  beforeContent: string | null | undefined,
  afterContent: string,
): { ok: true } | { ok: false; message: string } {
  const after = String(afterContent ?? "");
  const before = String(beforeContent ?? "");

  if (Buffer.byteLength(after, "utf8") > BENTO_DECK_MAX_BYTES) {
    return {
      ok: false,
      message: `Bento deck exceeds size limit (${Math.round(BENTO_DECK_MAX_BYTES / (1024 * 1024))}MB). Use splice-bento-shell.mjs instead of hand-written HTML.`,
    };
  }

  const match = BENTO_DOC_RE.exec(after);
  if (!match) {
    return {
      ok: false,
      message:
        "Invalid deck.bento.html: missing #bento-doc block. Run skills/nova-bento-slides/scripts/splice-bento-shell.mjs — do not write plain HTML slides to *.bento.html.",
    };
  }

  const jsonText = match[1]?.trim() ?? "";
  if (/<(?![/!])/.test(jsonText) && !jsonText.includes("\\u003c")) {
    return { ok: false, message: "Bento JSON block contains unescaped < characters." };
  }

  if (before && hasBentoDocBlock(before)) {
    const beforeShell = extractShellWithoutDoc(before);
    const afterShell = extractShellWithoutDoc(after);
    if (sha256Content(beforeShell) !== sha256Content(afterShell)) {
      return {
        ok: false,
        message: "Bento shell structure changes are not allowed — only #bento-doc JSON may change.",
      };
    }
  }

  try {
    const doc = JSON.parse(jsonText) as { format?: string };
    if (doc.format !== "bento/slides") {
      return { ok: false, message: 'Invalid Bento document: format must be "bento/slides".' };
    }
  } catch {
    return { ok: false, message: "Invalid JSON in #bento-doc block." };
  }

  return { ok: true };
}
