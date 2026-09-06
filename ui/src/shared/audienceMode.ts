// PD-SAAS-FORK: resolve audience mode for process UX (code fold / tool labels)

export type AudienceMode = "technical" | "non_technical";

const TECHNICAL_MAJOR_CATEGORIES = new Set(["development", "dev", "开发"]);

export function resolveAudienceMode(input: {
  majorCategory?: string | null;
  capabilitySlug?: string | null;
}): AudienceMode {
  const major = String(input.majorCategory || "").trim().toLowerCase();
  if (major && TECHNICAL_MAJOR_CATEGORIES.has(major)) {
    return "technical";
  }
  // Default: hide code for marketing/education/creative/office and unknown slugs
  return "non_technical";
}

export function shouldFoldCodeForAudience(mode: AudienceMode): boolean {
  return mode === "non_technical";
}

export function humanizeToolLabel(
  toolName: string,
  mode: AudienceMode,
  t?: (key: string, opts?: { defaultValue?: string }) => string,
): string | null {
  if (mode === "technical") return null;
  const name = toolName.toLowerCase();
  const tr = (key: string, def: string) => (t ? t(key, { defaultValue: def }) : def);
  if (name === "bash" || name === "run_terminal_cmd") {
    return tr("process.tool.humanize.processData", "处理数据");
  }
  if (name === "write_file" || name === "write") {
    return tr("process.tool.humanize.organizeContent", "整理内容");
  }
  if (name === "edit_file" || name === "edit") {
    return tr("process.tool.humanize.editContent", "编辑内容");
  }
  if (name === "grep" || name === "glob") {
    return tr("process.tool.humanize.searchProject", "检索资料");
  }
  return null;
}
