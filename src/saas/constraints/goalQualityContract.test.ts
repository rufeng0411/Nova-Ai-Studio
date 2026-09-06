import { describe, expect, it } from "vitest";
import { MINGDI_G700_20260718_CASES } from "../../../tests/fixtures/mingdi-g700-20260718-cases.js";
import {
  boundSessionGoalQualityContract,
  buildGoalQualityContractPrompt,
  compileSessionGoalQualityContract,
  computeGoalQualityContractHash,
  type SessionGoalQualityContract,
} from "./goalQualityContract.js";
import {
  compileOfficialMediaRequirement,
} from "./officialMediaRequirement.js";
import {
  isToolAllowedByQualityContract,
  resolveTrustedExecutionScope,
} from "./capabilityScopeContract.js";
import {
  buildBoundedQualityShadowDiff,
  buildQualityAcceptanceMeta,
  resolveQualityCanaryPolicy,
} from "./qualityCanaryPolicy.js";

describe("SessionGoalQualityContract compiler", () => {
  it("compiles all 11 Mingdi G700 fixtures without compiling deliverable files", () => {
    expect(MINGDI_G700_20260718_CASES).toHaveLength(11);

    for (const fixture of MINGDI_G700_20260718_CASES) {
      const contract = compileSessionGoalQualityContract({
        userGoal: fixture.sanitizedGoal,
      });

      if (/鸣镝\s*G\s*700/iu.test(fixture.sanitizedGoal)) {
        expect(contract.subjectAnchor, fixture.id).toBe("鸣镝 G700");
        expect(contract.subjectAliases, fixture.id).toContain("鸣镝G700");
      } else {
        expect(contract.subjectAnchor, fixture.id).toBeUndefined();
      }
      if (fixture.qualityContract.officialMediaOnly) {
        expect(contract.officialMediaPolicy, fixture.id).toBe("official_only");
      }
      if (fixture.qualityContract.forbidGenerateImage) {
        expect(contract.forbidGenerateImage, fixture.id).toBe(true);
      }
      if (fixture.qualityContract.expectedSlideCount) {
        expect(contract.exactQuantityAssertions, fixture.id).toContainEqual({
          unit: "page",
          exact: fixture.qualityContract.expectedSlideCount,
        });
      }
      expect(JSON.stringify(contract), fixture.id).not.toMatch(
        /requiredFiles|expectedKinds|pathHints|basename/i,
      );
    }
  });

  it.each([
    "图片需要来自品牌官方渠道",
    "图要来官方",
    "配图必须使用官方素材",
    "车辆图片必须来自品牌或联名方官方渠道",
    "图片来自官方小红书",
    "图片来自官方 Instagram",
    "只用官方图片且禁止 AI 生图",
  ])("recognizes official-only media semantics: %s", (userGoal) => {
    const requirement = compileOfficialMediaRequirement(userGoal);

    expect(requirement.officialMediaPolicy).toBe("official_only");
    expect(requirement.allowPlaceholders).toBe(false);
    expect(requirement.forbidGenerateImage).toBe(true);
    expect(requirement.allowedSourceTiers.length).toBeGreaterThan(0);
  });

  it("does not treat an official photography style as an official-only source policy", () => {
    expect(compileOfficialMediaRequirement("请采用官方摄影风，画面高级克制")).toEqual({
      officialMediaPolicy: "none",
      allowedSourceTiers: [],
      allowPlaceholders: true,
      forbidGenerateImage: false,
    });
  });

  it("compiles exact page and content quantities as semantic assertions only", () => {
    const contract = compileSessionGoalQualityContract({
      userGoal: "为鸣镝 G700 制作 6 页幻灯、20 个核心词和 8 章用户研究。",
    });

    expect(contract.exactQuantityAssertions).toEqual([
      { unit: "page", exact: 6 },
      { unit: "item", exact: 20 },
      { unit: "chapter", exact: 8 },
    ]);
    expect(JSON.stringify(contract)).not.toMatch(/kind|basename|pathHint/i);
  });

  it("applies user constraints before launch, exact capability, and profile fallback", () => {
    const contract = compileSessionGoalQualityContract({
      userGoal: "把鸣镝 G700 做成 6 页幻灯，只用官方图片，禁止 AI 生图。",
      launchContext: [
        '<launch-context capability="html-ppt">',
        '  <field key="page_count" value="8"/>',
        "</launch-context>",
      ].join("\n"),
      exactCapabilityPolicy: {
        exactQuantityAssertions: [{ unit: "page", exact: 10 }],
        officialMediaPolicy: "official_preferred",
        allowPlaceholders: true,
      },
      profileFallback: {
        exactQuantityAssertions: [{ unit: "page", exact: 12 }],
        officialMediaPolicy: "none",
        allowPlaceholders: true,
      },
    });

    expect(contract.exactQuantityAssertions).toEqual([{ unit: "page", exact: 6 }]);
    expect(contract.officialMediaPolicy).toBe("official_only");
    expect(contract.allowPlaceholders).toBe(false);
    expect(contract.forbidGenerateImage).toBe(true);
    expect(contract.toolPolicy?.deny).toContain("generate_image");
  });

  it("applies structured launch quality fields before exact capability fallback", () => {
    const contract = compileSessionGoalQualityContract({
      userGoal: "制作一份产品素材。",
      launchContext: {
        qualityContract: {
          exactQuantityAssertions: [{ unit: "item", exact: 4 }],
          allowPlaceholders: false,
          toolPolicy: {
            allow: ["fetch_page_images"],
            deny: ["generate_image"],
          },
        },
      },
      exactCapabilityPolicy: {
        exactQuantityAssertions: [{ unit: "item", exact: 8 }],
        allowPlaceholders: true,
        toolPolicy: { allow: ["web_fetch"] },
      },
    });

    expect(contract.exactQuantityAssertions).toEqual([
      { unit: "item", exact: 4 },
    ]);
    expect(contract.allowPlaceholders).toBe(false);
    expect(contract.toolPolicy).toEqual({
      allow: ["fetch_page_images"],
      deny: ["generate_image"],
    });
  });

  it("lets explicit user opt-outs clear lower-priority aliases and source tiers", () => {
    const contract = compileSessionGoalQualityContract({
      userGoal: "品牌：新主体。不要求官方图片，允许 AI 生图。",
      exactCapabilityPolicy: {
        subjectAnchor: "旧主体",
        subjectAliases: ["旧主体别名"],
        officialMediaPolicy: "official_only",
        allowedSourceTiers: ["brand_official"],
        forbidGenerateImage: true,
      },
    });

    expect(contract.subjectAnchor).toBe("新主体");
    expect(contract.subjectAliases).toEqual([]);
    expect(contract.officialMediaPolicy).toBe("none");
    expect(contract.allowedSourceTiers).toEqual([]);
    expect(contract.forbidGenerateImage).toBe(false);
  });

  it("produces a canonical hash independent of field order and non-semantic metadata", () => {
    const left = {
      contractVersion: 1,
      subjectAnchor: "鸣镝 G700",
      subjectAliases: ["鸣镝G700"],
      exactQuantityAssertions: [{ unit: "page", exact: 6 }],
      officialMediaPolicy: "official_only",
      allowedSourceTiers: ["brand_official"],
      allowPlaceholders: false,
      forbidGenerateImage: true,
      toolPolicy: { deny: ["generate_image"], allow: ["fetch_page_images"] },
      compiledAt: "2026-07-19T00:00:00.000Z",
      compiledAtTurnId: "turn-a",
    } as unknown as SessionGoalQualityContract;
    const right = {
      compiledAtTurnId: "turn-b",
      compiledAt: "2027-01-01T00:00:00.000Z",
      toolPolicy: { allow: ["fetch_page_images"], deny: ["generate_image"] },
      forbidGenerateImage: true,
      allowPlaceholders: false,
      allowedSourceTiers: ["brand_official"],
      officialMediaPolicy: "official_only",
      exactQuantityAssertions: [{ exact: 6, unit: "page" }],
      subjectAliases: ["鸣镝G700"],
      subjectAnchor: "鸣镝 G700",
      contractVersion: 1,
    } as unknown as SessionGoalQualityContract;

    expect(computeGoalQualityContractHash(left)).toBe(
      computeGoalQualityContractHash(right),
    );
  });

  it("bounds and redacts persisted values without retaining paths, credentials, or signed URLs", () => {
    const secret = "Bearer SECRET_TOKEN_123";
    const contract = boundSessionGoalQualityContract({
      contractVersion: 1,
      subjectAnchor: `鸣镝 G700 ${secret} C:\\Users\\alice\\private.txt`,
      subjectAliases: [
        "Cookie: sid=PRIVATE_COOKIE",
        "https://example.com/a.png?X-Amz-Signature=SECRET_SIGNATURE",
        "/srv/private/goal.txt",
        "\\\\fileserver\\private\\goal.txt",
        ...Array.from({ length: 40 }, (_, index) => `alias-${index}-${"x".repeat(100)}`),
      ],
      exactQuantityAssertions: Array.from(
        { length: 40 },
        (_, index) => ({ unit: "item" as const, exact: index + 1 }),
      ),
      officialMediaPolicy: "official_only",
      allowedSourceTiers: ["brand_official"],
      allowPlaceholders: false,
      forbidGenerateImage: true,
      toolPolicy: {
        allow: Array.from({ length: 80 }, (_, index) => `tool_allow_${index}`),
        deny: ["generate_image", secret, "C:\\secrets\\token.txt"],
      },
    });
    const serialized = JSON.stringify(contract);

    expect(Buffer.byteLength(serialized, "utf8")).toBeLessThanOrEqual(4_096);
    expect(contract.subjectAliases.length).toBeLessThanOrEqual(8);
    expect(contract.exactQuantityAssertions.length).toBeLessThanOrEqual(8);
    expect(contract.toolPolicy?.allow?.length).toBeLessThanOrEqual(32);
    expect(serialized).not.toContain("SECRET_TOKEN_123");
    expect(serialized).not.toContain("PRIVATE_COOKIE");
    expect(serialized).not.toContain("SECRET_SIGNATURE");
    expect(serialized).not.toContain("C:\\");
    expect(serialized).not.toContain("/srv/private");
    expect(serialized).not.toContain("\\\\fileserver");
  });
});

describe("quality canary and trusted scope", () => {
  const selectedEnv = {
    PILOTDECK_GOAL_QUALITY_CONTRACT: "shadow",
    PILOTDECK_GOAL_QUALITY_CANARY_SLUGS: "nova-ppt-aesthetic-slides",
    PILOTDECK_GOAL_QUALITY_CANARY_TENANTS: "tenant-alpha",
  };

  it("defaults to no selected canary when allowlists are empty", () => {
    expect(resolveQualityCanaryPolicy({
      capabilitySlug: "nova-ppt-aesthetic-slides",
      trustedScope: {
        tenantScopeId: "tenant-alpha",
        principalScopeId: "user-1",
      },
      env: { PILOTDECK_GOAL_QUALITY_CONTRACT: "enforce" },
    }).effectiveMode).toBe("off");
  });

  it("requires exact slug and tenant matches without prefix widening", () => {
    const exact = resolveQualityCanaryPolicy({
      capabilitySlug: "nova-ppt-aesthetic-slides",
      trustedScope: {
        tenantScopeId: "tenant-alpha",
        principalScopeId: "user-1",
      },
      env: selectedEnv,
    });
    const prefix = resolveQualityCanaryPolicy({
      capabilitySlug: "nova-ppt-aesthetic-slides-plus",
      trustedScope: {
        tenantScopeId: "tenant-alpha",
        principalScopeId: "user-1",
      },
      env: selectedEnv,
    });
    const otherTenant = resolveQualityCanaryPolicy({
      capabilitySlug: "nova-ppt-aesthetic-slides",
      trustedScope: {
        tenantScopeId: "tenant-beta",
        principalScopeId: "user-1",
      },
      env: selectedEnv,
    });

    expect(exact).toMatchObject({ selected: true, effectiveMode: "shadow" });
    expect(prefix).toMatchObject({ selected: false, effectiveMode: "off" });
    expect(otherTenant).toMatchObject({ selected: false, effectiveMode: "off" });
  });

  it("supports enforce only for the same exact slug and tenant selection", () => {
    const policy = resolveQualityCanaryPolicy({
      capabilitySlug: "nova-ppt-aesthetic-slides",
      trustedScope: {
        tenantScopeId: "tenant-alpha",
        principalScopeId: "user-1",
      },
      env: {
        ...selectedEnv,
        PILOTDECK_GOAL_QUALITY_CONTRACT: "enforce",
      },
    });

    expect(policy).toMatchObject({
      configuredMode: "enforce",
      effectiveMode: "enforce",
      selected: true,
    });
  });

  it("keeps shadow diff bounded and free of subject text", () => {
    const contract = compileSessionGoalQualityContract({
      userGoal: [
        "制作鸣镝 G700 的 6 页幻灯。",
        "只用官方图片且禁止 AI 生图。",
      ].join("\n"),
    });
    const diff = buildBoundedQualityShadowDiff(contract);
    const serialized = JSON.stringify(diff);

    expect(diff.fields).toEqual([
      "subject_anchor",
      "exact_quantity",
      "official_media",
      "placeholder_policy",
      "tool_policy",
    ]);
    expect(serialized).not.toContain("鸣镝");
    expect(serialized).not.toContain("G700");
    expect(Buffer.byteLength(serialized, "utf8")).toBeLessThanOrEqual(512);
  });

  it("projects only hash, effective mode, and bounded diff into acceptance meta", () => {
    const contract = compileSessionGoalQualityContract({
      userGoal: "制作鸣镝 G700 的 6 页幻灯，只用官方图片。",
    });
    const meta = buildQualityAcceptanceMeta({
      qualityContractHash: computeGoalQualityContractHash(contract),
      effectiveMode: "shadow",
      shadowDiff: buildBoundedQualityShadowDiff(contract),
    });
    const serialized = JSON.stringify(meta);

    expect(Object.keys(meta).sort()).toEqual([
      "qualityContractHash",
      "qualityContractMode",
      "qualityContractShadowDiff",
    ]);
    expect(serialized).not.toContain("鸣镝");
    expect(serialized).not.toContain("G700");
    expect(serialized).not.toContain("subjectAnchor");
  });

  it("uses local/local for standalone and rejects a tenant/pilotHome mismatch", () => {
    expect(resolveTrustedExecutionScope({})).toEqual({
      tenantScopeId: "local",
      principalScopeId: "local",
    });
    expect(() => resolveTrustedExecutionScope({
      pilotHomeTenantId: "tenant-alpha",
      claimedScope: {
        tenantScopeId: "tenant-beta",
        principalScopeId: "user-2",
      },
    })).toThrow(/trusted tenant scope/i);
  });
});

describe("quality tool policy", () => {
  it("enforces deny before allow and keeps shadow behavior unchanged", () => {
    const contract = compileSessionGoalQualityContract({
      userGoal: "图片只用官方素材，禁止 AI 生图。",
    });

    expect(isToolAllowedByQualityContract("generate_image", contract, "enforce")).toBe(false);
    expect(isToolAllowedByQualityContract("generate_image", contract, "shadow")).toBe(true);
    expect(isToolAllowedByQualityContract("fetch_page_images", contract, "enforce")).toBe(true);
  });

  it("compiles nova required_official_first capability policy to official_only", () => {
    const contract = compileSessionGoalQualityContract({
      userGoal:
        "用「Nova-美学幻灯」把【G700】做成【8】页【16:9】，图和资料要来自官网：https://zongheng.chery.cn/vehicle/g700-refit",
      exactCapabilityPolicy: {
        officialMediaPolicy: "required_official_first" as never,
        forbidGenerateImage: true,
        allowPlaceholders: false,
        toolPolicy: { deny: ["generate_image"] },
      },
    });
    expect(contract.officialMediaPolicy).toBe("official_only");
    expect(contract.forbidGenerateImage).toBe(true);
  });

  it("injects bounded semantics only in enforce mode", () => {
    const contract = compileSessionGoalQualityContract({
      userGoal: "制作鸣镝 G700 的 6 页幻灯，只用官方图片，禁止 AI 生图。",
    });

    expect(buildGoalQualityContractPrompt(contract, "shadow")).toBeUndefined();
    const prompt = buildGoalQualityContractPrompt(contract, "enforce");
    expect(prompt).toContain("<session-goal-quality-contract");
    expect(prompt).toContain('"officialMediaPolicy":"official_only"');
    expect(prompt).toContain('"exact":6');
    expect(prompt).not.toMatch(/compiledAt|turnId|requiredFiles|pathHints/iu);
  });
});
