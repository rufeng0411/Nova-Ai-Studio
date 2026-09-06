import { describe, expect, it } from "vitest";

import { createReadSkillTool } from "../../tool/builtin/readSkill.js";
import {
  builtinToolRedirectMessage,
  isConfusedBuiltinToolName,
} from "./builtinToolNameGuard.js";

describe("builtinToolNameGuard", () => {
  it("treats export_document and sibling builtins as tools, not skills", () => {
    expect(isConfusedBuiltinToolName("export_document")).toBe(true);
    expect(isConfusedBuiltinToolName("ocr_to_editable_pptx")).toBe(true);
    expect(isConfusedBuiltinToolName("write_file")).toBe(true);
    expect(isConfusedBuiltinToolName("anth-pptx")).toBe(false);
    expect(isConfusedBuiltinToolName("ppt-master")).toBe(false);
    expect(isConfusedBuiltinToolName("open-design")).toBe(false);
  });

  it("read_skill redirects builtin names instead of Skill not found", async () => {
    const tool = createReadSkillTool({
      loader: async () => undefined,
      lister: () => [{ name: "anth-pptx" }],
    });
    const result = await tool.execute({ skillName: "export_document" }, {} as never);
    const text = result.content.map((block) => ("text" in block ? block.text : "")).join("");
    expect(text).toContain("内置工具");
    expect(text).not.toMatch(/Skill 'export_document' not found/);
    expect(builtinToolRedirectMessage("export_document")).toMatch(/export_document/);
  });
});
