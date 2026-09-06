// PD-SAAS-FORK P0-6: fail-closed task-scope guard for official-media writes and exports.

import path from "node:path";

import type { GoalToolPolicy } from "./goalToolPolicy.js";
import { isOfficialMediaPlaceholderContent } from "./officialMediaPlaceholder.js";

export type PolicyAwarePathGuardDecision = {
  allowed: boolean;
  input: unknown;
  reason?: string;
};

type MutableInput = Record<string, unknown>;

function recordFromUnknown(value: unknown): MutableInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as MutableInput;
}

function isPathInside(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === ""
    || (!path.isAbsolute(relative)
      && relative !== ".."
      && !relative.startsWith(`..${path.sep}`))
  );
}

function workspaceRelative(
  absolutePath: string,
  workspaceRoot: string,
): string {
  return path.relative(workspaceRoot, absolutePath).split(path.sep).join("/");
}

function resolveTaskScopedPath(input: {
  value: unknown;
  field: string;
  policy: GoalToolPolicy;
}): { ok: true; path: string } | { ok: false; reason: string } {
  if (typeof input.value !== "string" || !input.value.trim()) {
    return {
      ok: false,
      reason: `Goal tool policy requires a non-empty ${input.field}.`,
    };
  }
  const raw = input.value.trim();
  if (
    raw.includes("\0")
    || /^[a-z][a-z0-9+.-]*:\/\//iu.test(raw)
  ) {
    return {
      ok: false,
      reason: `${input.field} is not a local task path.`,
    };
  }

  const workspaceRoot = path.resolve(input.policy.workspaceRoot);
  const taskRoot = path.resolve(
    workspaceRoot,
    input.policy.taskArtifactDir,
  );
  if (
    taskRoot === workspaceRoot
    || !isPathInside(taskRoot, workspaceRoot)
  ) {
    return {
      ok: false,
      reason: "Goal tool policy has no valid active task root.",
    };
  }

  const slashNormalized = raw.replace(/\\/gu, "/");
  if (
    slashNormalized === ".."
    || slashNormalized.startsWith("../")
    || slashNormalized.includes("/../")
  ) {
    return {
      ok: false,
      reason: `${input.field} attempts to escape the active task root.`,
    };
  }

  let absolute: string;
  if (path.isAbsolute(raw)) {
    absolute = path.resolve(raw);
  } else if (
    slashNormalized === input.policy.taskArtifactDir
    || slashNormalized.startsWith(`${input.policy.taskArtifactDir}/`)
  ) {
    absolute = path.resolve(workspaceRoot, slashNormalized);
  } else if (slashNormalized.startsWith("artifacts/")) {
    return {
      ok: false,
      reason: `${input.field} targets a different artifacts task root.`,
    };
  } else {
    absolute = path.resolve(taskRoot, slashNormalized);
  }

  if (!isPathInside(absolute, taskRoot) || absolute === taskRoot) {
    return {
      ok: false,
      reason: `${input.field} must stay below the active task root.`,
    };
  }
  return {
    ok: true,
    path: workspaceRelative(absolute, workspaceRoot),
  };
}

function containsRemoteOrInlineMediaReference(content: string): boolean {
  return (
    /<(?:img|source|image|video)\b[^>]*(?:src|srcset|poster|href)\s*=\s*["']?\s*(?:https?:|data:image)/iu.test(content)
    || /!\[[^\]]*\]\(\s*(?:https?:|data:image)/iu.test(content)
    || /\burl\(\s*["']?\s*(?:https?:|data:image)/iu.test(content)
  );
}

function deny(
  input: unknown,
  reason: string,
): PolicyAwarePathGuardDecision {
  return { allowed: false, input, reason };
}

function allow(input: unknown): PolicyAwarePathGuardDecision {
  return { allowed: true, input };
}

function guardWriteLikeInput(
  toolName: string,
  input: MutableInput,
  policy: GoalToolPolicy,
): PolicyAwarePathGuardDecision {
  const guarded = resolveTaskScopedPath({
    value: input.file_path ?? input.filePath,
    field: "file_path",
    policy,
  });
  if (!guarded.ok) return deny(input, guarded.reason);

  const content = toolName === "write_file"
    ? input.content
    : input.new_string;
  if (
    typeof content === "string"
    && containsRemoteOrInlineMediaReference(content)
  ) {
    return deny(
      input,
      "Official media must be localized before write_file; remote or inline media references are blocked.",
    );
  }
  if (
    isOfficialMediaPlaceholderContent(content)
    && !policy.allowPlaceholders
  ) {
    return deny(
      input,
      "Official media placeholders are forbidden by the goal contract.",
    );
  }
  return allow({
    ...input,
    ...(Object.hasOwn(input, "filePath")
      ? { filePath: guarded.path }
      : { file_path: guarded.path }),
  });
}

function outputExtension(
  format: unknown,
  fallback: string,
): string {
  const normalized = String(format ?? "").trim().toLowerCase();
  return /^[a-z0-9]{2,8}$/u.test(normalized) ? normalized : fallback;
}

function defaultSiblingOutput(
  sourcePath: string,
  extension: string,
): string {
  const parsed = path.posix.parse(sourcePath.replace(/\\/gu, "/"));
  return path.posix.join(parsed.dir, `${parsed.name}.${extension}`);
}

function guardExportDocument(
  input: MutableInput,
  policy: GoalToolPolicy,
): PolicyAwarePathGuardDecision {
  const source = resolveTaskScopedPath({
    value: input.source_path,
    field: "source_path",
    policy,
  });
  if (!source.ok) return deny(input, source.reason);
  const outputValue = input.output_path
    ?? defaultSiblingOutput(
      source.path,
      outputExtension(input.output_format, "pdf"),
    );
  const output = resolveTaskScopedPath({
    value: outputValue,
    field: "output_path",
    policy,
  });
  if (!output.ok) return deny(input, output.reason);
  return allow({
    ...input,
    source_path: source.path,
    output_path: output.path,
  });
}

function guardPathArray(
  input: MutableInput,
  field: "image_paths" | "input_paths",
  policy: GoalToolPolicy,
): { ok: true; paths: string[] } | { ok: false; reason: string } {
  const values = input[field];
  if (!Array.isArray(values) || values.length === 0) {
    return { ok: false, reason: `${field} must contain task-scoped paths.` };
  }
  const paths: string[] = [];
  for (const value of values) {
    const guarded = resolveTaskScopedPath({ value, field, policy });
    if (!guarded.ok) return guarded;
    paths.push(guarded.path);
  }
  return { ok: true, paths };
}

function guardDocumentComposer(
  toolName: "compose_images_to_document" | "ocr_to_editable_pptx",
  input: MutableInput,
  policy: GoalToolPolicy,
): PolicyAwarePathGuardDecision {
  const field = toolName === "compose_images_to_document"
    ? "image_paths"
    : "input_paths";
  const sourcePaths = guardPathArray(input, field, policy);
  if (!sourcePaths.ok) return deny(input, sourcePaths.reason);
  const extension = toolName === "compose_images_to_document"
    ? outputExtension(input.format, "pdf")
    : "pptx";
  const output = resolveTaskScopedPath({
    value: input.output_path
      ?? `${policy.taskArtifactDir}/${toolName === "compose_images_to_document" ? "composed" : "editable"}.${extension}`,
    field: "output_path",
    policy,
  });
  if (!output.ok) return deny(input, output.reason);
  return allow({
    ...input,
    [field]: sourcePaths.paths,
    output_path: output.path,
  });
}

function guardLocalRender(
  input: MutableInput,
  policy: GoalToolPolicy,
): PolicyAwarePathGuardDecision {
  const source = resolveTaskScopedPath({
    value: input.html_path,
    field: "html_path",
    policy,
  });
  if (!source.ok) return deny(input, source.reason);
  const output = resolveTaskScopedPath({
    value: input.output_path
      ?? defaultSiblingOutput(source.path, "png"),
    field: "output_path",
    policy,
  });
  if (!output.ok) return deny(input, output.reason);
  return allow({
    ...input,
    html_path: source.path,
    output_path: output.path,
  });
}

export function guardPolicyAwareToolInput(input: {
  toolName: string;
  input: unknown;
  policy: GoalToolPolicy;
}): PolicyAwarePathGuardDecision {
  if (input.policy.mode !== "enforce" || !input.policy.officialMediaRequired) {
    return allow(input.input);
  }
  const record = recordFromUnknown(input.input);
  if (!record) return deny(input.input, "Goal tool policy requires object input.");
  const toolName = input.toolName.trim().toLowerCase();
  if (toolName === "write_file" || toolName === "edit_file") {
    return guardWriteLikeInput(toolName, record, input.policy);
  }
  if (toolName === "export_document") {
    return guardExportDocument(record, input.policy);
  }
  if (
    toolName === "compose_images_to_document"
    || toolName === "ocr_to_editable_pptx"
  ) {
    return guardDocumentComposer(toolName, record, input.policy);
  }
  if (toolName === "render_local_html_to_image") {
    return guardLocalRender(record, input.policy);
  }
  return allow(input.input);
}
