// PD-SAAS-FORK P0-9: canonical subject grounding for official media and research.

export type CanonicalSubjectSource =
  | "explicit_block"
  | "brand_model"
  | "launch_context";

export type CanonicalSubject = {
  subject: string;
  aliases: string[];
  source: CanonicalSubjectSource;
};

const EXPLICIT_SUBJECT_BLOCK =
  /【\s*完整主体\s*】\s*([^【】\n]{2,160})/iu;
const BRAND_MODEL_PATTERN =
  /(?:鸣镝|Mingdi|MINDEE)\s*[-\s]*(?:G700|G\s*700)/giu;
const BARE_MODEL_PATTERN = /\bG700\b/giu;

function normalizeSubject(value: string): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 160);
}

function uniqueAliases(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of values) {
    const normalized = normalizeSubject(raw);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output.slice(0, 8);
}

export function extractCanonicalSubject(input: {
  userGoal: string;
  launchContext?: string | Record<string, unknown> | null;
}): CanonicalSubject | null {
  const goal = String(input.userGoal ?? "");
  const explicit = goal.match(EXPLICIT_SUBJECT_BLOCK);
  if (explicit?.[1]) {
    const subject = normalizeSubject(explicit[1]);
    if (subject) {
      return {
        subject,
        aliases: uniqueAliases([subject]),
        source: "explicit_block",
      };
    }
  }

  const brandMatches = [...goal.matchAll(BRAND_MODEL_PATTERN)]
    .map((match) => normalizeSubject(match[0] ?? ""))
    .filter(Boolean);
  if (brandMatches.length > 0) {
    const subject = brandMatches[0]!;
    return {
      subject,
      aliases: uniqueAliases([
        subject,
        subject.replace(/\s+/gu, ""),
        "鸣镝 G700",
        "鸣镝G700",
      ]),
      source: "brand_model",
    };
  }

  const bracketMatch = goal.match(/【\s*([^【】\n]{2,80})\s*】/u);
  if (bracketMatch?.[1]) {
    const inner = normalizeSubject(bracketMatch[1]);
    if (inner) {
      if (/^G\s*700$/iu.test(inner)) {
        return {
          subject: "鸣镝 G700",
          aliases: uniqueAliases([
            "鸣镝 G700",
            "鸣镝G700",
            "纵横 G700",
            "G700",
          ]),
          source: "brand_model",
        };
      }
      return {
        subject: inner,
        aliases: uniqueAliases([inner, inner.replace(/\s+/gu, "")]),
        source: "brand_model",
      };
    }
  }

  const launchText = typeof input.launchContext === "string"
    ? input.launchContext
    : input.launchContext && typeof input.launchContext === "object"
      ? JSON.stringify(input.launchContext)
      : "";
  const launchBrand = [...launchText.matchAll(BRAND_MODEL_PATTERN)]
    .map((match) => normalizeSubject(match[0] ?? ""))
    .filter(Boolean);
  if (launchBrand.length > 0) {
    const subject = launchBrand[0]!;
    return {
      subject,
      aliases: uniqueAliases([subject, subject.replace(/\s+/gu, "")]),
      source: "launch_context",
    };
  }

  return null;
}

export function buildOfficialMediaSearchQuery(
  subject: CanonicalSubject,
  baseQuery: string,
): string {
  const normalizedBase = normalizeSubject(baseQuery);
  if (!normalizedBase) return subject.subject;
  if (subjectIncludesQuery(normalizedBase, subject)) return normalizedBase;
  return `${subject.subject} ${normalizedBase}`.trim();
}

function normalizeForMatch(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, "").toLowerCase();
}

function subjectIncludesQuery(query: string, subject: CanonicalSubject): boolean {
  const haystack = normalizeForMatch(query);
  return [subject.subject, ...subject.aliases]
    .some((alias) => {
      const needle = normalizeForMatch(alias);
      return needle.length > 0 && haystack.includes(needle);
    });
}

export function validateSearchQueryIncludesSubject(
  query: string,
  subject: CanonicalSubject,
): boolean {
  const normalized = normalizeSubject(query);
  if (!normalized) return false;
  if (subjectIncludesQuery(normalized, subject)) return true;
  if (BARE_MODEL_PATTERN.test(normalized) && !subjectIncludesQuery(normalized, subject)) {
    return false;
  }
  return false;
}

export type SubjectGroundingShadowAssessment = {
  ok: boolean;
  reason?: "subject_missing" | "bare_model_query" | "category_conflict";
  expectedSubject?: string;
};

export function assessSubjectGroundingShadow(input: {
  text: string;
  subject: CanonicalSubject;
}): SubjectGroundingShadowAssessment {
  const haystack = normalizeForMatch(input.text);
  const anchors = [input.subject.subject, ...input.subject.aliases]
    .map(normalizeForMatch)
    .filter(Boolean);
  if (anchors.some((anchor) => haystack.includes(anchor))) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: "subject_missing",
    expectedSubject: input.subject.subject,
  };
}

export function assessOfficialSearchQueryShadow(input: {
  query: string;
  subject: CanonicalSubject;
}): SubjectGroundingShadowAssessment {
  if (validateSearchQueryIncludesSubject(input.query, input.subject)) {
    return { ok: true };
  }
  if (/\bG700\b/i.test(input.query) && !subjectIncludesQuery(input.query, input.subject)) {
    return {
      ok: false,
      reason: "bare_model_query",
      expectedSubject: input.subject.subject,
    };
  }
  return {
    ok: false,
    reason: "subject_missing",
    expectedSubject: input.subject.subject,
  };
}
