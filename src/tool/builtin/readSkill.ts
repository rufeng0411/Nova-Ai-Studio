import type { PilotDeckToolDefinition } from "../protocol/types.js";
import { recordStabilityEvent } from "../../telemetry/stabilityEvents.js";
import {
  builtinToolRedirectMessage,
  isConfusedBuiltinToolName,
} from "../../saas/tools/builtinToolNameGuard.js";

export type ReadSkillInput = {
  skillName: string;
  /** Relative path inside the skill directory, e.g. references/checklist.md */
  relativePath?: string;
};

export type ReadSkillDeps = {
  loader: (name: string) => Promise<string | undefined>;
  /** PD-SAAS-FORK: load references/assets without read_file on tenant cwd */
  fileLoader?: (skillName: string, relativePath: string) => Promise<string | undefined>;
  lister: () => { name: string; description?: string }[];
};

export function createReadSkillTool(deps: ReadSkillDeps): PilotDeckToolDefinition<ReadSkillInput> {
  return {
    name: "read_skill",
    aliases: ["ReadSkill"],
    description:
      "Load a skill recipe by name. Returns SKILL.md by default. "
      + "Pass relativePath (e.g. references/checklist.md, viewport-base.css) to load files inside the skill directory "
      + "— use this instead of read_file for skill references (tenant project cwd cannot access skills/).",
    kind: "session",
    inputSchema: {
      type: "object",
      required: ["skillName"],
      additionalProperties: false,
      properties: {
        skillName: {
          type: "string",
          description: "The skill name as listed in <available-skills>.",
        },
        relativePath: {
          type: "string",
          description: "Optional file under the skill dir, e.g. references/checklist.md",
        },
      },
    },
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    async execute(input) {
      if (isConfusedBuiltinToolName(input.skillName)) {
        recordStabilityEvent({
          event: "read_skill_builtin_redirect",
          detail: { name: String(input.skillName ?? "") },
        });
        return {
          content: [{
            type: "text",
            text: builtinToolRedirectMessage(String(input.skillName ?? "")),
          }],
        };
      }

      const rel = String(input.relativePath || "").trim();
      if (rel && deps.fileLoader) {
        const fileContent = await deps.fileLoader(input.skillName, rel);
        if (fileContent) {
          return {
            content: [{
              type: "text",
              text: `# ${input.skillName}/${rel}\n\n${fileContent}`,
            }],
          };
        }
        return {
          content: [{
            type: "text",
            text: `Skill file '${input.skillName}/${rel}' not found. Use relativePath like references/checklist.md`,
          }],
        };
      }

      const content = await deps.loader(input.skillName);
      if (content) {
        return { content: [{ type: "text", text: content }] };
      }
      const available = deps.lister();
      if (available.length === 0) {
        return {
          content: [{ type: "text", text: `Skill '${input.skillName}' not found. No skills are currently loaded.` }],
        };
      }
      const names = available.map((s) => s.name).join(", ");
      return {
        content: [{ type: "text", text: `Skill '${input.skillName}' not found. Available skills: ${names}` }],
      };
    },
  };
}
