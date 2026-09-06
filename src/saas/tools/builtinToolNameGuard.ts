// PD-SAAS-FORK: models sometimes read_skill(export_document). Those names are tools, not skills.
const CONFUSED_BUILTIN_TOOL_NAMES = new Set([
  "export_document",
  "ocr_to_editable_pptx",
  "compose_images_to_document",
  "write_file",
  "read_file",
  "web_search",
  "web_fetch",
  "generate_image",
  "generate_video",
  "render_html_video",
]);

export function isConfusedBuiltinToolName(skillName: string | undefined): boolean {
  const name = String(skillName ?? "").trim().toLowerCase();
  if (!name) return false;
  return CONFUSED_BUILTIN_TOOL_NAMES.has(name);
}

export function builtinToolRedirectMessage(skillName: string): string {
  const name = String(skillName ?? "").trim() || "export_document";
  return (
    `「${name}」是内置工具，不是技能。请直接调用该工具，不要 read_skill。`
    + "PPT/PDF/Word 导出用 export_document（source_path + output_format）。"
    + "需要配方时才 read_skill anth-pptx。"
  );
}
