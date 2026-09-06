// PD-SAAS-FORK: default Chinese deliverable basenames aligned with task title (unless English required).
import { defaultPathHintForKind, sdmBasename } from "./sdmSlotMatching.js";
import { isDeliverableChineseFilenameDefaultEnabled, isSdmGeoKeywordAliasEnabled } from "../resilience/stabilityFlags.js";

export type DeliverableFilenameSlotLike = {
  id?: string;
  label?: string;
  kind?: string;
  pathHint?: string;
  pathHints?: string[];
};

export type DeliverableFilenameContext = {
  displayLabel?: string;
  profileId?: string;
  capabilitySlug?: string;
  userGoal?: string;
  lockedBasenames?: string[];
};

const GENERIC_ENGLISH_FALLBACKS = new Set([
  "index.html",
  "brief.md",
  "report.pdf",
  "document.docx",
  "presentation.pptx",
  "output.png",
  "report.md",
  "document.md",
  "output.md",
]);

/** Basenames / patterns that must stay ASCII for tooling, export, or GEO/Nova contracts. */
const ENGLISH_REQUIRED_BASENAME_RE: RegExp[] = [
  /^slide-\d+\.png$/i,
  /^slide-manifest\.json$/i,
  /^visual-asset-manifest\.json$/i,
  /^canvas-manifest\.json$/i,
  /^schema\.jsonld$/i,
  /^monitor-data\.json$/i,
  /^data-sources\.md$/i,
  /^promo\.mp4$/i,
  /^hf-project(?:\/|$)/i,
  /^index\.html$/i,
  /^landing\.html$/i,
  /^product-user-research\.html$/i,
  /^visibility-report\.html$/i,
  /^geo-visibility-report\.html$/i,
  /^02-charts-and-data\.md$/i,
  /^02-支柱长文[A-Z]\.md$/i,
  /-manifest\.json$/i,
  /\.jsonld$/i,
  /^deck\.bento\.html$/i,
  /\.bento\.html$/i,
  /^outline\.json$/i,
  /\.tsx?$/i,
  /\.jsx?$/i,
  /\.css$/i,
  /\.py$/i,
  /\.sh$/i,
  /\.mjs$/i,
  /^promo\.mp4$/i,
];

const ENGLISH_REQUIRED_PROFILE_IDS = new Set([
  "nova-slide-deck",
  "geo",
  "ppt",
  "video-mp4",
  "hf-slideshow",
  "hf-remotion",
]);

const ENGLISH_REQUIRED_CAPABILITY_PREFIXES = [
  "geo-",
  "nova-ppt-",
  "hf-",
  "html-ppt-",
];

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

export function containsCjk(text: string): boolean {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(text);
}

export function extensionFromKind(kind: string | undefined): string | undefined {
  const k = String(kind ?? "").toLowerCase();
  if (k === "html") return ".html";
  if (k === "markdown" || k === "md") return ".md";
  if (k === "pdf") return ".pdf";
  if (k === "docx") return ".docx";
  if (k === "pptx") return ".pptx";
  if (k === "image" || k === "png") return ".png";
  if (k === "video") return ".mp4";
  return undefined;
}

export function extensionFromBasename(basename: string): string {
  const dot = basename.lastIndexOf(".");
  if (dot <= 0) return "";
  return basename.slice(dot);
}

export function sanitizeTitleForFilename(title: string, maxLen = 48): string {
  let cleaned = String(title ?? "")
    .replace(INVALID_FILENAME_CHARS, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.。\s]+$/g, "");
  if (!cleaned) return "";
  if (cleaned.length > maxLen) cleaned = cleaned.slice(0, maxLen).replace(/[.\s]+$/g, "");
  return cleaned;
}

export function titleToChineseBasename(title: string, ext: string): string {
  const stem = sanitizeTitleForFilename(title);
  const normalizedExt = ext.startsWith(".") ? ext : ext ? `.${ext}` : "";
  if (!stem) return "";
  if (normalizedExt && stem.toLowerCase().endsWith(normalizedExt.toLowerCase())) {
    return stem;
  }
  return `${stem}${normalizedExt}`;
}

export function isGenericEnglishFallbackBasename(basename: string): boolean {
  return GENERIC_ENGLISH_FALLBACKS.has(sdmBasename(basename).toLowerCase());
}

export function isEnglishBasenameRequired(input: {
  basename: string;
  kind?: string;
  profileId?: string;
  capabilitySlug?: string;
  slotId?: string;
}): boolean {
  const base = sdmBasename(input.basename);
  if (!base) return false;

  if (input.profileId && ENGLISH_REQUIRED_PROFILE_IDS.has(input.profileId)) {
    if (/^slide-\d+\.png$/i.test(base) || /manifest\.json$/i.test(base)) return true;
    if (input.profileId === "geo" && /\.html$/i.test(base)) return true;
    if (input.profileId === "geo" && /schema\.jsonld$/i.test(base)) return true;
    if (input.profileId === "nova-slide-deck") return true;
  }

  const slug = String(input.capabilitySlug ?? "").toLowerCase();
  if (slug && ENGLISH_REQUIRED_CAPABILITY_PREFIXES.some((prefix) => slug.startsWith(prefix))) {
    if (/^slide-\d+\.png$/i.test(base) || /manifest\.json$/i.test(base)) return true;
    if (/\.html$/i.test(base) && /^(index|landing|visibility-report|product-user-research)\.html$/i.test(base)) {
      return true;
    }
  }

  return ENGLISH_REQUIRED_BASENAME_RE.some((re) => re.test(base));
}

function isGenericSlotLabel(label: string): boolean {
  const trimmed = label.trim();
  if (!trimmed) return true;
  return /^(markdown|html|pdf|docx|pptx|image|file|document|report|brief|output)$/i.test(trimmed);
}

function normalizeLockedBasename(value: string | undefined): string {
  return sdmBasename(value ?? "").toLowerCase();
}

const MUST_DELIVER_FILE_TOKEN =
  /([A-Za-z0-9_\u4e00-\u9fff][A-Za-z0-9._\u4e00-\u9fff\-]*?\.(?:md|markdown|html?|pdf|docx?|pptx?|json(?:ld)?|png|jpe?g|csv|xlsx?|mp4))/gi;

export function extractMustDeliverBasenames(userGoal: string): string[] {
  const names: string[] = [];
  for (const match of String(userGoal ?? "").matchAll(/须交付[:：]\s*([^\n]+)/g)) {
    const clause = String(match[1] ?? "").replace(/(?:不要|别做|禁止空转|直接开始做)[\s\S]*$/u, "");
    MUST_DELIVER_FILE_TOKEN.lastIndex = 0;
    let file: RegExpExecArray | null = MUST_DELIVER_FILE_TOKEN.exec(clause);
    while (file) {
      if (file[1]) names.push(file[1]);
      file = MUST_DELIVER_FILE_TOKEN.exec(clause);
    }
  }
  return [...new Set(names)];
}

export function collectLockedBasenames(context: DeliverableFilenameContext): string[] {
  const locked = new Set<string>();
  for (const name of [...(context.lockedBasenames ?? []), ...extractMustDeliverBasenames(context.userGoal ?? "")]) {
    const base = sdmBasename(name);
    if (base) locked.add(base);
  }
  return [...locked];
}

function isUserLockedBasename(
  slot: DeliverableFilenameSlotLike,
  context: DeliverableFilenameContext,
  currentBase: string,
): boolean {
  if (String(slot.id ?? "").startsWith("must_deliver_")) return true;
  const needle = normalizeLockedBasename(currentBase);
  if (!needle) return false;
  return collectLockedBasenames(context).some((name) => normalizeLockedBasename(name) === needle);
}

function resolveLabelSource(slot: DeliverableFilenameSlotLike, context: DeliverableFilenameContext): string {
  const label = String(slot.label ?? "").trim();
  if (label && !isGenericSlotLabel(label) && containsCjk(label)) return label;
  if (label && !isGenericSlotLabel(label) && !/^[a-z0-9_.-]+$/i.test(label)) return label;
  const display = String(context.displayLabel ?? "").trim();
  if (display) return display;
  if (label && !isGenericSlotLabel(label)) return label;
  return display;
}

function resolveExtForSlot(slot: DeliverableFilenameSlotLike): string {
  const hint = slot.pathHint ?? slot.pathHints?.[0] ?? "";
  const fromHint = hint ? extensionFromBasename(hint) : "";
  if (fromHint) return fromHint;
  return extensionFromKind(slot.kind) ?? ".md";
}

export function resolveSuggestedBasename(
  slot: DeliverableFilenameSlotLike,
  context: DeliverableFilenameContext,
): string | undefined {
  const current = slot.pathHint ?? slot.pathHints?.[0];
  if (current && containsCjk(sdmBasename(current))) {
    return sdmBasename(current);
  }
  if (current && isEnglishBasenameRequired({
    basename: current,
    kind: slot.kind,
    profileId: context.profileId,
    capabilitySlug: context.capabilitySlug,
    slotId: slot.id,
  })) {
    return sdmBasename(current);
  }

  const ext = resolveExtForSlot(slot);
  if (/manifest\.json$/i.test(current ?? "") || /schema\.jsonld$/i.test(current ?? "")) {
    return current ? sdmBasename(current) : undefined;
  }
  if (/^index\.html$/i.test(current ?? "") || /^landing\.html$/i.test(current ?? "")) {
    return current ? sdmBasename(current) : defaultPathHintForKind("html");
  }

  const labelSource = resolveLabelSource(slot, context);
  const chinese = titleToChineseBasename(labelSource, ext);
  if (chinese) return chinese;

  if (current && !isGenericEnglishFallbackBasename(current)) {
    return sdmBasename(current);
  }

  const kindDefault = defaultPathHintForKind(slot.kind ?? "markdown");
  if (kindDefault && labelSource) {
    return titleToChineseBasename(labelSource, extensionFromBasename(kindDefault) || ext);
  }
  return kindDefault ? sdmBasename(kindDefault) : undefined;
}

function isGeoKeywordCanonicalSlot(
  slot: DeliverableFilenameSlotLike,
  context: DeliverableFilenameContext,
): boolean {
  if (!isSdmGeoKeywordAliasEnabled()) return false;
  const hint = (slot.pathHint ?? slot.pathHints?.[0] ?? "").toLowerCase();
  if (/^keywords\.(?:md|html)$/.test(hint)) return true;
  return String(context.capabilitySlug ?? "").toLowerCase() === "geo-keyword-research"
    && (slot.kind === "markdown" || slot.kind === "html" || slot.kind === "md");
}

export function applyDeliverableChineseFilenamePolicy<T extends DeliverableFilenameSlotLike>(
  slots: T[],
  context: DeliverableFilenameContext,
): T[] {
  if (!isDeliverableChineseFilenameDefaultEnabled()) return slots;

  return slots.map((slot) => {
    const currentHint = slot.pathHint ?? slot.pathHints?.[0];
    if (!currentHint && !slot.kind) return slot;

    const currentBase = currentHint ? sdmBasename(currentHint) : "";
    if (currentBase && containsCjk(currentBase)) return slot;

    if (currentBase && isUserLockedBasename(slot, context, currentBase)) {
      return slot;
    }

    if (currentBase && isEnglishBasenameRequired({
      basename: currentBase,
      kind: slot.kind,
      profileId: context.profileId,
      capabilitySlug: context.capabilitySlug,
      slotId: slot.id,
    })) {
      return slot;
    }

    if (
      currentBase
      && !isGenericEnglishFallbackBasename(currentBase)
      && !isGeoKeywordCanonicalSlot(slot, context)
    ) {
      return slot;
    }

    const suggested = resolveSuggestedBasename(slot, context);
    if (!suggested || suggested === currentBase) return slot;

    const aliases = new Set<string>();
    if (currentBase) aliases.add(currentBase);
    for (const hint of slot.pathHints ?? []) {
      const base = sdmBasename(hint);
      if (base) aliases.add(base);
    }
    aliases.add(suggested);

    // Scheme A: keep canonical English pathHint; Chinese name lives in pathHints only.
    if (isGeoKeywordCanonicalSlot(slot, context) && currentHint && !containsCjk(currentBase)) {
      return {
        ...slot,
        pathHints: [...aliases],
      };
    }

    aliases.delete(suggested);

    return {
      ...slot,
      pathHint: suggested,
      pathHints: [suggested, ...aliases],
    };
  });
}

export function resolvePrimarySuggestedBasenames(context: DeliverableFilenameContext): string[] {
  if (!isDeliverableChineseFilenameDefaultEnabled()) return [];
  const locked = collectLockedBasenames(context);
  if (locked.length > 0) return locked;
  const label = String(context.displayLabel ?? "").trim();
  if (!label) return [];

  const basenames: string[] = [];
  for (const kind of ["markdown", "docx", "pdf"] as const) {
    const ext = extensionFromKind(kind)!;
    const name = titleToChineseBasename(label, ext);
    if (name && !isEnglishBasenameRequired({
      basename: name,
      kind,
      profileId: context.profileId,
      capabilitySlug: context.capabilitySlug,
    })) {
      basenames.push(name);
    }
  }
  return basenames;
}

export function buildDeliverableNamingPromptLines(context: DeliverableFilenameContext): string[] {
  if (!isDeliverableChineseFilenameDefaultEnabled()) return [];

  const locked = collectLockedBasenames(context);
  const lines = [
    "Filename policy: unless a basename is toolchain-required (slide-NN.png, *-manifest.json, index.html, schema.jsonld, code/scripts), use Chinese basenames aligned with the task title/display-label.",
    "Do NOT invent English names like brief.md or report.pdf when a Chinese title is available.",
  ];
  if (locked.length > 0) {
    lines.push(`User named required basenames — write these exactly: ${locked.join(", ")}. Do not use the task title as the filename.`);
  }

  const suggested = resolvePrimarySuggestedBasenames(context);
  if (suggested.length > 0 && locked.length === 0) {
    lines.push(`Suggested primary filenames: ${suggested.join(", ")}`);
  }

  if (context.displayLabel) {
    lines.push(`Task title for naming: ${context.displayLabel.replace(/"/g, "'")}`);
  }

  return lines;
}

export function buildDeliverableNamingPromptLinesZh(context: DeliverableFilenameContext): string[] {
  if (!isDeliverableChineseFilenameDefaultEnabled()) return [];

  const locked = collectLockedBasenames(context);
  const lines = [
    "成果文件名：除工具链强制英文 basename（slide-NN.png、*-manifest.json、index.html、schema.jsonld、代码脚本等）外，一律使用与任务标题一致的中文文件名。",
    "禁止在无必要时自造 brief.md、report.pdf 等英文文件名。",
  ];
  if (locked.length > 0) {
    lines.push(`用户已点名须交付文件名，必须原样写入：${locked.join("、")}。禁止用任务标题或整句当文件名。`);
  }

  const suggested = resolvePrimarySuggestedBasenames(context);
  if (suggested.length > 0 && locked.length === 0) {
    lines.push(`建议主文件名：${suggested.join("、")}`);
  }

  if (context.displayLabel) {
    lines.push(`命名参考标题：${context.displayLabel.replace(/"/g, "「")}`);
  }

  return lines;
}
