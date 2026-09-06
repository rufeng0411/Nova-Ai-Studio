import { createHash } from "node:crypto";
import {
  compileOfficialMediaRequirement,
  hasExplicitOfficialMediaSourceRequirement,
  type OfficialMediaPolicy,
  type OfficialMediaSourceTier,
} from "./officialMediaRequirement.js";

/**
 * PD-SAAS-FORK: Keep hard goal-quality semantics independently recoverable from
 * the Session Deliverable Manifest. File kinds, basenames, and slot counts do
 * not belong in this contract.
 */
export const GOAL_QUALITY_CONTRACT_VERSION = 1 as const;
export const GOAL_QUALITY_CONTRACT_HASH_VERSION = 1 as const;
export const GOAL_QUALITY_CONTRACT_MAX_BYTES = 4_096;

const MAX_SUBJECT_CHARS = 160;
const MAX_SUBJECT_ALIASES = 8;
const MAX_ALIAS_CHARS = 96;
const MAX_QUANTITY_ASSERTIONS = 8;
const MAX_TOOL_NAMES_PER_LIST = 16;
const MAX_TOOL_NAME_CHARS = 64;

export type ExactQuantityUnit =
  | "page"
  | "item"
  | "chapter"
  | "section"
  | "second";

export type ExactQuantityAssertion = {
  unit: ExactQuantityUnit;
  exact: number;
};

export type GoalQualityToolPolicy = {
  allow?: string[];
  deny?: string[];
};

export type SessionGoalQualityContract = {
  contractVersion: typeof GOAL_QUALITY_CONTRACT_VERSION;
  subjectAnchor?: string;
  subjectAliases: string[];
  exactQuantityAssertions: ExactQuantityAssertion[];
  officialMediaPolicy: OfficialMediaPolicy;
  allowedSourceTiers: OfficialMediaSourceTier[];
  allowPlaceholders: boolean;
  forbidGenerateImage: boolean;
  toolPolicy?: GoalQualityToolPolicy;
};

export type GoalQualityPolicyInput = Partial<
  Omit<SessionGoalQualityContract, "contractVersion">
>;

export type CompileSessionGoalQualityContractInput = {
  userGoal: string;
  launchContext?: string | Record<string, unknown> | null;
  exactCapabilityPolicy?: GoalQualityPolicyInput | null;
  profileFallback?: GoalQualityPolicyInput | null;
};

type QualityPatch = GoalQualityPolicyInput & {
  subjectAnchor?: string;
};

const SENSITIVE_URL = /\bhttps?:\/\/[^\s"'<>]+/giu;
const WINDOWS_ABSOLUTE_PATH =
  /\b[A-Za-z]:\\(?:[^\\\s"'<>]+\\)*[^\\\s"'<>]*/gu;
const UNC_ABSOLUTE_PATH =
  /(^|[\s("'=])\\\\[^\\\s"'<>]+\\[^\\\s"'<>]+(?:\\[^\\\s"'<>]+)*/gu;
const POSIX_ABSOLUTE_PATH =
  /(^|[\s("'=])\/(?!\/)[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+/gu;
const AUTHORIZATION_SECRET =
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/giu;
const COOKIE_SECRET =
  /\b(?:Cookie|Set-Cookie)\s*:\s*[^,\r\n]+/giu;
const NAMED_SECRET =
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|authorization)\s*[:=]\s*[^\s,;]+/giu;
const TOOL_NAME = /^[a-zA-Z][a-zA-Z0-9_.:-]*$/u;
const EXPLICIT_NO_OFFICIAL_SOURCE =
  /(?:不限|不要求|无需|不用|不必)[^。；，,\n]{0,8}官方(?:图片|配图|素材|渠道)/iu;
const EXPLICIT_GENERATE_IMAGE_ALLOW =
  /(?:允许|可以|可用|接受)[^。；，,\n]{0,12}(?:AI|人工智能|模型)?[^。；，,\n]{0,8}(?:生图|生成图片|生成图像|绘图)/iu;
const EXPLICIT_GENERATE_IMAGE_DENY =
  /(?:禁止|不得|不要|不可|不能|严禁)[^。；，,\n]{0,12}(?:AI|人工智能|模型)?[^。；，,\n]{0,8}(?:生图|生成图片|生成图像|绘图)/iu;
const EXPLICIT_PLACEHOLDER_ALLOW =
  /(?:允许|可以|可用|接受)[^。；，,\n]{0,8}(?:占位|占位图|临时图)/iu;
const EXPLICIT_PLACEHOLDER_DENY =
  /(?:禁止|不得|不要|不可|不能|不允许)[^。；，,\n]{0,8}(?:占位|占位图|临时图)/iu;

function sanitizeContractText(value: unknown, maxChars: number): string {
  return String(value ?? "")
    .replace(SENSITIVE_URL, "[redacted-url]")
    .replace(AUTHORIZATION_SECRET, "[redacted]")
    .replace(COOKIE_SECRET, "[redacted]")
    .replace(NAMED_SECRET, "[redacted]")
    .replace(WINDOWS_ABSOLUTE_PATH, "[redacted-path]")
    .replace(
      UNC_ABSOLUTE_PATH,
      (_match, prefix: string) => `${prefix}[redacted-path]`,
    )
    .replace(
      POSIX_ABSOLUTE_PATH,
      (_match, prefix: string) => `${prefix}[redacted-path]`,
    )
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxChars);
}

function sanitizeToolNames(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const result: string[] = [];
  for (const raw of values) {
    const value = sanitizeContractText(raw, MAX_TOOL_NAME_CHARS);
    if (!TOOL_NAME.test(value) || result.includes(value)) continue;
    result.push(value);
    if (result.length >= MAX_TOOL_NAMES_PER_LIST) break;
  }
  return result.length > 0 ? result : undefined;
}

function normalizePositiveInteger(value: unknown): number | null {
  const parsed = typeof value === "number"
    ? value
    : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 100_000) {
    return null;
  }
  return parsed;
}

function normalizeQuantityAssertions(
  assertions: unknown,
): ExactQuantityAssertion[] {
  if (!Array.isArray(assertions)) return [];
  const result: ExactQuantityAssertion[] = [];
  const seen = new Set<ExactQuantityUnit>();
  for (const assertion of assertions) {
    if (!assertion || typeof assertion !== "object") continue;
    const record = assertion as Record<string, unknown>;
    const unit = record.unit;
    if (
      unit !== "page"
      && unit !== "item"
      && unit !== "chapter"
      && unit !== "section"
      && unit !== "second"
    ) {
      continue;
    }
    const exact = normalizePositiveInteger(record.exact);
    if (exact === null || seen.has(unit)) continue;
    result.push({ unit, exact });
    seen.add(unit);
    if (result.length >= MAX_QUANTITY_ASSERTIONS) break;
  }
  return result;
}

function normalizeSourceTiers(values: unknown): OfficialMediaSourceTier[] {
  if (!Array.isArray(values)) return [];
  const valid = new Set<OfficialMediaSourceTier>([
    "brand_official",
    "authorized_partner_official",
    "platform_verified_official",
  ]);
  const result: OfficialMediaSourceTier[] = [];
  for (const value of values) {
    if (
      valid.has(value as OfficialMediaSourceTier)
      && !result.includes(value as OfficialMediaSourceTier)
    ) {
      result.push(value as OfficialMediaSourceTier);
    }
  }
  return result;
}

function compactToolPolicy(
  value: GoalQualityToolPolicy | undefined,
): GoalQualityToolPolicy | undefined {
  if (!value) return undefined;
  const allow = sanitizeToolNames(value.allow);
  const deny = sanitizeToolNames(value.deny);
  if (!allow && !deny) return undefined;
  return {
    ...(allow ? { allow } : {}),
    ...(deny ? { deny } : {}),
  };
}

/** Map legacy capability policy tokens to bounded OfficialMediaPolicy. */
export function normalizeOfficialMediaPolicyInput(
  policy: unknown,
  userGoal = "",
): OfficialMediaPolicy | undefined {
  if (
    policy === "official_only"
    || policy === "official_preferred"
    || policy === "none"
  ) {
    return policy;
  }
  if (policy === "required_official_first") {
    const compiled = compileOfficialMediaRequirement(userGoal);
    if (
      compiled.officialMediaPolicy === "official_only"
      || hasExplicitOfficialMediaSourceRequirement(userGoal)
    ) {
      return "official_only";
    }
    return "official_preferred";
  }
  return undefined;
}

export function boundSessionGoalQualityContract(
  input: SessionGoalQualityContract,
): SessionGoalQualityContract {
  const subjectAnchor = sanitizeContractText(
    input.subjectAnchor,
    MAX_SUBJECT_CHARS,
  );
  const aliases: string[] = [];
  for (const raw of Array.isArray(input.subjectAliases)
    ? input.subjectAliases
    : []) {
    const alias = sanitizeContractText(raw, MAX_ALIAS_CHARS);
    if (!alias || aliases.includes(alias)) continue;
    aliases.push(alias);
    if (aliases.length >= MAX_SUBJECT_ALIASES) break;
  }

  const bounded: SessionGoalQualityContract = {
    contractVersion: GOAL_QUALITY_CONTRACT_VERSION,
    ...(subjectAnchor ? { subjectAnchor } : {}),
    subjectAliases: aliases,
    exactQuantityAssertions: normalizeQuantityAssertions(
      input.exactQuantityAssertions,
    ),
    officialMediaPolicy:
      normalizeOfficialMediaPolicyInput(input.officialMediaPolicy)
      ?? "none",
    allowedSourceTiers: normalizeSourceTiers(input.allowedSourceTiers),
    allowPlaceholders: input.allowPlaceholders !== false,
    forbidGenerateImage: input.forbidGenerateImage === true,
    ...(compactToolPolicy(input.toolPolicy)
      ? { toolPolicy: compactToolPolicy(input.toolPolicy) }
      : {}),
  };

  while (
    Buffer.byteLength(JSON.stringify(bounded), "utf8")
      > GOAL_QUALITY_CONTRACT_MAX_BYTES
  ) {
    if ((bounded.toolPolicy?.allow?.length ?? 0) > 0) {
      bounded.toolPolicy?.allow?.pop();
      continue;
    }
    if ((bounded.toolPolicy?.deny?.length ?? 0) > 0) {
      bounded.toolPolicy?.deny?.pop();
      continue;
    }
    if (bounded.subjectAliases.length > 0) {
      bounded.subjectAliases.pop();
      continue;
    }
    if (bounded.exactQuantityAssertions.length > 0) {
      bounded.exactQuantityAssertions.pop();
      continue;
    }
    break;
  }
  if (
    bounded.toolPolicy
    && !bounded.toolPolicy.allow?.length
    && !bounded.toolPolicy.deny?.length
  ) {
    delete bounded.toolPolicy;
  }
  return bounded;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    sorted[key] = canonicalize(record[key]);
  }
  return sorted;
}

function semanticHashInput(
  contract: SessionGoalQualityContract,
): SessionGoalQualityContract {
  const bounded = boundSessionGoalQualityContract(contract);
  return {
    ...bounded,
    subjectAliases: [...bounded.subjectAliases].sort(),
    exactQuantityAssertions: [...bounded.exactQuantityAssertions].sort(
      (left, right) =>
        left.unit.localeCompare(right.unit) || left.exact - right.exact,
    ),
    allowedSourceTiers: [...bounded.allowedSourceTiers].sort(),
    ...(bounded.toolPolicy
      ? {
          toolPolicy: {
            ...(bounded.toolPolicy.allow
              ? { allow: [...bounded.toolPolicy.allow].sort() }
              : {}),
            ...(bounded.toolPolicy.deny
              ? { deny: [...bounded.toolPolicy.deny].sort() }
              : {}),
          },
        }
      : {}),
  };
}

export function computeGoalQualityContractHash(
  contract: SessionGoalQualityContract,
): string {
  const canonical = JSON.stringify(canonicalize(semanticHashInput(contract)));
  const digest = createHash("sha256").update(canonical, "utf8").digest("hex");
  return `qgc1:${digest}`;
}

function parseChineseInteger(value: string): number | null {
  if (/^\d+$/u.test(value)) {
    return normalizePositiveInteger(value);
  }
  const digits: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  if (value === "十") return 10;
  const parts = value.split("十");
  if (parts.length === 2) {
    const tens = parts[0] ? digits[parts[0]] : 1;
    const ones = parts[1] ? digits[parts[1]] : 0;
    const parsed = (tens ?? 0) * 10 + (ones ?? 0);
    return normalizePositiveInteger(parsed);
  }
  return digits[value] ?? null;
}

function quantityUnitFromText(unitText: string): ExactQuantityUnit {
  if (unitText === "页") return "page";
  if (unitText === "章") return "chapter";
  if (unitText === "节") return "section";
  if (unitText === "秒") return "second";
  return "item";
}

export function compileExactQuantityAssertions(
  text: string,
): ExactQuantityAssertion[] {
  const result: ExactQuantityAssertion[] = [];
  const seen = new Set<ExactQuantityUnit>();
  const normalized = String(text ?? "");
  const pattern =
    /(\d{1,5}|[一二两三四五六七八九十]{1,3})\s*(?:个\s*)?(页|章|节|秒|核心词|关键词|问句|问题|条|项|个)/gu;
  for (const match of normalized.matchAll(pattern)) {
    const exact = parseChineseInteger(match[1] ?? "");
    const unit = quantityUnitFromText(match[2] ?? "");
    if (exact === null || seen.has(unit)) continue;
    result.push({ unit, exact });
    seen.add(unit);
    if (result.length >= MAX_QUANTITY_ASSERTIONS) break;
  }
  return result;
}

function compileSubjectPatch(text: string): QualityPatch {
  const normalized = String(text ?? "");
  const bracketed = normalized.match(/【([^】\r\n]{1,80})】/u)?.[1]?.trim();
  if (bracketed) {
    const subjectAnchor = sanitizeContractText(
      bracketed.replace(/([\p{Script=Han}])([A-Za-z]\d)/gu, "$1 $2"),
      MAX_SUBJECT_CHARS,
    );
    return {
      subjectAnchor,
      subjectAliases: [
        subjectAnchor.replace(/\s+/gu, ""),
      ],
    };
  }

  const modelMatch = normalized.match(
    /([\p{Script=Han}]{2,24})\s*([A-Za-z][A-Za-z0-9-]*\d[A-Za-z0-9-]*)/u,
  );
  if (modelMatch?.[1] && modelMatch[2]) {
    let brand = modelMatch[1];
    const cueWords = [
      "协助",
      "分析",
      "执行",
      "整理",
      "制作",
      "输出",
      "研究",
      "针对",
      "关于",
      "使用",
      "将",
      "把",
      "为",
    ];
    let lastCueEnd = 0;
    for (const cue of cueWords) {
      const index = brand.lastIndexOf(cue);
      if (index >= 0) {
        lastCueEnd = Math.max(lastCueEnd, index + cue.length);
      }
    }
    brand = brand.slice(lastCueEnd).replace(/^(?:的|给|对)/u, "").trim();
    if (brand.length > 8) {
      brand = brand.slice(-8);
    }
    if (brand.length >= 2) {
      const model = modelMatch[2].replace(/\s+/gu, "");
      const subjectAnchor = `${brand} ${model}`;
      return {
        subjectAnchor,
        subjectAliases: [`${brand}${model}`, model],
      };
    }
  }

  const namedSubject = normalized.match(
    /(?:品牌|主体|项目|产品)\s*[：:]\s*([^，,。；;\r\n]{2,80})/u,
  )?.[1]?.trim();
  if (namedSubject) {
    return {
      subjectAnchor: sanitizeContractText(
        namedSubject,
        MAX_SUBJECT_CHARS,
      ),
      subjectAliases: [],
    };
  }
  return {};
}

function compileUserPatch(userGoal: string): QualityPatch {
  const official = compileOfficialMediaRequirement(userGoal);
  const patch: QualityPatch = {
    ...compileSubjectPatch(userGoal),
  };
  const quantities = compileExactQuantityAssertions(userGoal);
  if (quantities.length > 0) {
    patch.exactQuantityAssertions = quantities;
  }

  const officialIsExplicit =
    hasExplicitOfficialMediaSourceRequirement(userGoal)
    || official.officialMediaPolicy === "official_preferred"
    || EXPLICIT_NO_OFFICIAL_SOURCE.test(userGoal);
  if (officialIsExplicit) {
    patch.officialMediaPolicy = EXPLICIT_NO_OFFICIAL_SOURCE.test(userGoal)
      ? "none"
      : official.officialMediaPolicy;
    patch.allowedSourceTiers = EXPLICIT_NO_OFFICIAL_SOURCE.test(userGoal)
      ? []
      : official.allowedSourceTiers;
  }

  const placeholderIsExplicit =
    official.officialMediaPolicy === "official_only"
    || EXPLICIT_PLACEHOLDER_ALLOW.test(userGoal)
    || EXPLICIT_PLACEHOLDER_DENY.test(userGoal);
  if (placeholderIsExplicit) {
    patch.allowPlaceholders = official.allowPlaceholders;
  }

  const generateImageIsExplicit =
    official.officialMediaPolicy === "official_only"
    || EXPLICIT_GENERATE_IMAGE_ALLOW.test(userGoal)
    || EXPLICIT_GENERATE_IMAGE_DENY.test(userGoal);
  if (generateImageIsExplicit) {
    patch.forbidGenerateImage = official.forbidGenerateImage;
  }
  return patch;
}

function flattenLaunchContext(
  value: string | Record<string, unknown> | null | undefined,
): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function recordFromUnknown(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function compileStructuredLaunchPatch(
  launchContext: Record<string, unknown>,
): QualityPatch {
  const nested =
    recordFromUnknown(launchContext.qualityContract)
    ?? recordFromUnknown(launchContext.goalQualityContract)
    ?? launchContext;
  const patch: QualityPatch = {};
  if (typeof nested.subjectAnchor === "string") {
    patch.subjectAnchor = nested.subjectAnchor;
  }
  if (Array.isArray(nested.subjectAliases)) {
    patch.subjectAliases = nested.subjectAliases.filter(
      (value): value is string => typeof value === "string",
    );
  }
  if (Array.isArray(nested.exactQuantityAssertions)) {
    patch.exactQuantityAssertions = normalizeQuantityAssertions(
      nested.exactQuantityAssertions,
    );
  }
  if (
    nested.officialMediaPolicy === "none"
    || nested.officialMediaPolicy === "official_preferred"
    || nested.officialMediaPolicy === "official_only"
  ) {
    patch.officialMediaPolicy = nested.officialMediaPolicy;
  }
  if (Array.isArray(nested.allowedSourceTiers)) {
    patch.allowedSourceTiers = normalizeSourceTiers(nested.allowedSourceTiers);
  }
  if (typeof nested.allowPlaceholders === "boolean") {
    patch.allowPlaceholders = nested.allowPlaceholders;
  }
  if (typeof nested.forbidGenerateImage === "boolean") {
    patch.forbidGenerateImage = nested.forbidGenerateImage;
  }
  const toolPolicy = recordFromUnknown(nested.toolPolicy);
  if (toolPolicy) {
    patch.toolPolicy = compactToolPolicy({
      allow: Array.isArray(toolPolicy.allow)
        ? toolPolicy.allow.filter(
            (value): value is string => typeof value === "string",
          )
        : undefined,
      deny: Array.isArray(toolPolicy.deny)
        ? toolPolicy.deny.filter(
            (value): value is string => typeof value === "string",
          )
        : undefined,
    });
  }
  return patch;
}

function compileLaunchPatch(
  launchContext: CompileSessionGoalQualityContractInput["launchContext"],
): QualityPatch {
  const text = flattenLaunchContext(launchContext);
  if (!text) return {};
  const patch = compileUserPatch(text);
  const structured = recordFromUnknown(launchContext)
    ? compileStructuredLaunchPatch(launchContext as Record<string, unknown>)
    : {};
  const pageCount =
    text.match(
      /(?:page_count|pageCount|slide_count|slideCount|slidesCount)["'\s:=]+(?:value=)?["']?(\d{1,4})/iu,
    )?.[1];
  const exact = normalizePositiveInteger(pageCount);
  if (exact !== null) {
    patch.exactQuantityAssertions = [{ unit: "page", exact }];
  }
  return {
    ...patch,
    ...structured,
  };
}

function firstDefined<T>(
  ...values: Array<T | null | undefined>
): T | undefined {
  return values.find((value) => value !== undefined && value !== null)
    ?? undefined;
}

function firstNonEmptyArray<T>(
  ...values: Array<T[] | null | undefined>
): T[] {
  return values.find((value) => Array.isArray(value) && value.length > 0)
    ?? [];
}

function mergeQuantityAssertions(
  ...groups: Array<ExactQuantityAssertion[] | null | undefined>
): ExactQuantityAssertion[] {
  const result: ExactQuantityAssertion[] = [];
  const seen = new Set<ExactQuantityUnit>();
  for (const group of groups) {
    for (const assertion of normalizeQuantityAssertions(group)) {
      if (seen.has(assertion.unit)) continue;
      result.push(assertion);
      seen.add(assertion.unit);
    }
  }
  return result;
}

export function compileSessionGoalQualityContract(
  input: CompileSessionGoalQualityContractInput,
): SessionGoalQualityContract {
  const user = compileUserPatch(input.userGoal);
  const launch = compileLaunchPatch(input.launchContext);
  const exact = input.exactCapabilityPolicy ?? {};
  const profile = input.profileFallback ?? {};
  const subjectAnchor = firstDefined(
    user.subjectAnchor,
    launch.subjectAnchor,
    exact.subjectAnchor,
    profile.subjectAnchor,
  );
  const explicitForbidGenerateImage = firstDefined(
    user.forbidGenerateImage,
    launch.forbidGenerateImage,
    exact.forbidGenerateImage,
    profile.forbidGenerateImage,
  );
  const selectedToolPolicy = firstDefined(
    user.toolPolicy,
    launch.toolPolicy,
    exact.toolPolicy,
    profile.toolPolicy,
  );
  const deny = new Set(selectedToolPolicy?.deny ?? []);
  if (explicitForbidGenerateImage === true) {
    deny.add("generate_image");
  } else if (explicitForbidGenerateImage === false) {
    deny.delete("generate_image");
  }
  const forbidGenerateImage =
    explicitForbidGenerateImage
    ?? deny.has("generate_image");
  const toolPolicy = compactToolPolicy({
    ...(selectedToolPolicy?.allow ? { allow: selectedToolPolicy.allow } : {}),
    ...(deny.size > 0 ? { deny: [...deny] } : {}),
  });

  return boundSessionGoalQualityContract({
    contractVersion: GOAL_QUALITY_CONTRACT_VERSION,
    ...(subjectAnchor ? { subjectAnchor } : {}),
    subjectAliases: firstDefined(
      user.subjectAliases,
      launch.subjectAliases,
      exact.subjectAliases,
      profile.subjectAliases,
    ) ?? [],
    exactQuantityAssertions: mergeQuantityAssertions(
      user.exactQuantityAssertions,
      launch.exactQuantityAssertions,
      exact.exactQuantityAssertions,
      profile.exactQuantityAssertions,
    ),
    officialMediaPolicy:
      normalizeOfficialMediaPolicyInput(
        firstDefined(
          user.officialMediaPolicy,
          launch.officialMediaPolicy,
          exact.officialMediaPolicy,
          profile.officialMediaPolicy,
        ),
        input.userGoal,
      ) ?? "none",
    allowedSourceTiers: firstDefined(
      user.allowedSourceTiers,
      launch.allowedSourceTiers,
      exact.allowedSourceTiers,
      profile.allowedSourceTiers,
    ) ?? [],
    allowPlaceholders: firstDefined(
      user.allowPlaceholders,
      launch.allowPlaceholders,
      exact.allowPlaceholders,
      profile.allowPlaceholders,
    ) ?? true,
    forbidGenerateImage,
    ...(toolPolicy ? { toolPolicy } : {}),
  });
}

export function buildGoalQualityContractPrompt(
  contract: SessionGoalQualityContract | null | undefined,
  mode: "off" | "shadow" | "enforce",
): string | undefined {
  if (!contract || mode !== "enforce") return undefined;
  const bounded = boundSessionGoalQualityContract(contract);
  return [
    '<session-goal-quality-contract version="1">',
    "Treat the following bounded JSON as hard quality constraints.",
    "It does not define deliverable filenames, file kinds, or SDM slots.",
    JSON.stringify(bounded),
    "</session-goal-quality-contract>",
  ].join("\n");
}
