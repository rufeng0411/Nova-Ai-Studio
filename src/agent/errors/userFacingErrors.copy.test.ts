import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_ERROR_LABELS_EN,
  DEFAULT_ERROR_LABELS_ZH,
} from "./userFacingErrors.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** User-visible primary copy must not use panic wording (see docs/process-feedback-copy-voice.zh-CN.md). */
const BANNED_ZH_PRIMARY = /重试|多次尝试|失败|卡住|危机|Failed tools/i;
const BANNED_EN_PRIMARY = /\bretry\b|\bfailed\b|\bstuck\b|several tries/i;

function loadJson(rel: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, rel), "utf8")) as Record<string, unknown>;
}

function flattenStrings(value: unknown, prefix = ""): Array<{ key: string; text: string }> {
  if (typeof value === "string") return [{ key: prefix, text: value }];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      flattenStrings(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [];
}

describe("userFacingErrors copy voice", () => {
  it("zh default labels avoid panic wording in primary copy", () => {
    for (const [key, text] of Object.entries(DEFAULT_ERROR_LABELS_ZH)) {
      expect(text, `DEFAULT_ERROR_LABELS_ZH.${key}`).not.toMatch(BANNED_ZH_PRIMARY);
    }
  });

  it("en default labels avoid panic wording in primary copy", () => {
    for (const [key, text] of Object.entries(DEFAULT_ERROR_LABELS_EN)) {
      expect(text, `DEFAULT_ERROR_LABELS_EN.${key}`).not.toMatch(BANNED_EN_PRIMARY);
    }
  });

  it("zh-CN chat.json working/recovery/process keys avoid banned terms", () => {
    const chat = loadJson("ui/src/i18n/locales/zh-CN/chat.json");
    const keys = flattenStrings(chat).filter(({ key }) =>
      /^(working|recovery|process\.clue|process\.recovery|errors)\./.test(key),
    );
    for (const { key, text } of keys) {
      expect(text, key).not.toMatch(BANNED_ZH_PRIMARY);
    }
  });

  it("en chat.json working/recovery/process keys avoid banned terms", () => {
    const chat = loadJson("ui/src/i18n/locales/en/chat.json");
    const keys = flattenStrings(chat).filter(({ key }) =>
      /^(working|recovery|process\.clue|process\.recovery|errors)\./.test(key),
    );
    for (const { key, text } of keys) {
      expect(text, key).not.toMatch(BANNED_EN_PRIMARY);
    }
  });
});
