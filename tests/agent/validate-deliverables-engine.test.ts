import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  extractCandidateDeliverablePaths,
  validateEngineDeliverables,
} from "../../src/agent/deliverables/validateDeliverablesEngine.js";
import type { CanonicalMessage } from "../../src/model/index.js";

test("extracts deliverables from tool_result write paths", () => {
  const messages: CanonicalMessage[] = [{
    role: "assistant",
    content: [{
      type: "tool_result",
      toolCallId: "call-1",
      content: [{ type: "text", text: JSON.stringify({ writtenFilePath: "artifacts/brief.docx" }) }],
    }],
  }];

  assert.deepEqual(extractCandidateDeliverablePaths(messages), ["artifacts/brief.docx"]);
});

test("normalizes markdown-emphasized deliverable paths before validation", () => {
  const messages: CanonicalMessage[] = [{
    role: "assistant",
    content: [{
      type: "tool_result",
      toolCallId: "call-1",
      content: [{
        type: "text",
        text: JSON.stringify({ writtenFilePath: "**`artifacts/rog-intelligence-20260623/index.html" }),
      }],
    }],
  }];

  assert.deepEqual(extractCandidateDeliverablePaths(messages), [
    "artifacts/rog-intelligence-20260623/index.html",
  ]);
});

test("does not extract root slash markdown names as deliverable candidates", () => {
  const messages: CanonicalMessage[] = [{
    role: "assistant",
    content: [{
      type: "text",
      text: [
        "交付文件汇总",
        "使用方法 Markdown /01-topic.md",
        "可重复使用 Markdown /02-topic-template.md",
        "也不要把 03-extra.md 当成已经落盘的成果。",
      ].join("\n"),
    }],
  }];

  assert.deepEqual(extractCandidateDeliverablePaths(messages), []);
});

test("dynamic html request passes with html only and does not require docx", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-rog-html-"));
  const dir = path.join(cwd, "artifacts", "rog-intelligence-20260623");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "index.html"),
    "<!doctype html><html><body><section>ROG 动态可视化</section><section>时间线</section></body></html>",
  );
  const messages: CanonicalMessage[] = [{
    role: "assistant",
    content: [{
      type: "text",
      text: "动态可视化仪表盘文件路径：artifacts/rog-intelligence-20260623/index.html",
    }],
  }];

  const result = await validateEngineDeliverables({
    cwd,
    messages,
    userGoal: "帮我把上述报告做成动态可视化HTML",
    capabilitySlug: "competitive-intelligence-summary",
  });

  assert.equal(result?.acceptance, "passed");
  assert.deepEqual(result?.missing, []);
  assert.deepEqual(result?.verified, ["artifacts/rog-intelligence-20260623/index.html"]);
});

test("filters process-only scripts and verifies non-empty expected deliverable", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-deliverable-"));
  await fs.mkdir(path.join(cwd, "artifacts"), { recursive: true });
  await fs.writeFile(path.join(cwd, "artifacts", "create_deck.py"), "print('process')\n");
  await fs.writeFile(path.join(cwd, "artifacts", "final.pptx"), Buffer.from("PK\x03\x04pptx-bytes", "latin1"));

  const messages: CanonicalMessage[] = [{
    role: "assistant",
    content: [
      { type: "text", text: "已生成 artifacts/create_deck.py 和 artifacts/final.pptx" },
    ],
  }];

  const result = await validateEngineDeliverables({
    cwd,
    messages,
    userGoal: "生成真实 PPTX 并报路径",
  });

  assert.ok(result);
  assert.deepEqual(result.verified, ["artifacts/final.pptx"]);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.broken, []);
  assert.deepEqual(result.failures, []);
  assert.equal(result.acceptance, "passed");
  assert.equal(result.continuePrompt, "");
  assert.ok(result.expectedManifest?.some((item) => item.kind === "pptx"));
});

test("marks broken deliverables as repair-worthy final acceptance failures", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-deliverable-broken-"));
  await fs.mkdir(path.join(cwd, "artifacts", "broken"), { recursive: true });
  await fs.writeFile(path.join(cwd, "artifacts", "broken", "output.html"), "<<<!DOCTYPE html><html><body></body></html>");

  const messages: CanonicalMessage[] = [{
    role: "assistant",
    content: [
      { type: "text", text: "已完成 artifacts/broken/output.html" },
    ],
  }];

  const result = await validateEngineDeliverables({
    cwd,
    messages,
    userGoal: "做官网落地页网页",
  });

  assert.equal(result?.acceptance, "needs_repair");
  assert.deepEqual(result?.verified, []);
  assert.deepEqual(result?.broken, ["artifacts/broken/output.html"]);
  assert.equal(result?.failures.some((failure) => failure.reason === "invalid_html"), true);
});

test("storyboard pack missing required files triggers needs_repair", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-storyboard-validate-"));
  await fs.mkdir(path.join(cwd, "artifacts", "pack"), { recursive: true });
  await fs.writeFile(path.join(cwd, "artifacts", "pack", "project_brief.md"), "# brief\n");

  const goal = "用「连续性分镜包」输出 continuity 分镜包：bible、镜头卡、交接矩阵";
  const messages: CanonicalMessage[] = [{
    role: "assistant",
    content: [
      { type: "text", text: "已保存 artifacts/pack/project_brief.md" },
    ],
  }];

  const result = await validateEngineDeliverables({
    cwd,
    messages,
    userGoal: goal,
    capabilitySlug: "create-vid-storyboard-pack",
  });

  assert.equal(result?.acceptance, "needs_repair");
  assert.ok(result!.missing.some((p) => p.includes("continuity_bible.md")));
  assert.ok(result!.missing.some((p) => p.includes("shot_cards.md")));
  assert.ok(result!.missing.some((p) => p.includes("handoff_design_matrix.md")));
  assert.match(result!.continuePrompt ?? "", /edit_file|补齐/);
});

test("TimesFM forecast task cannot pass with prose only and no forecast artifacts", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-timesfm-validate-"));
  const messages: CanonicalMessage[] = [{
    role: "assistant",
    content: [{
      type: "text",
      text: "雷蛇灵刃2026销售预期：预计销量上涨，价格上调。",
    }],
  }];

  const result = await validateEngineDeliverables({
    cwd,
    messages,
    userGoal: "用「时序预测 TimesFM」帮我：【雷蛇灵刃2026销售预期】，输出预测图表和结果文件",
    capabilitySlug: "edu-sci-timesfm-forecasting",
  });

  assert.ok(result);
  assert.equal(result.acceptance, "needs_repair");
  assert.ok(result.missing.some((filePath) => filePath.includes("forecast")));
});

test("brand geo full case validates every reported artifact path, not only one representative md", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-brand-geo-validate-"));
  const root = path.join(cwd, "artifacts", "razer-blade-2026-geo");
  await fs.mkdir(path.join(root, "audit"), { recursive: true });
  await fs.mkdir(path.join(root, "content"), { recursive: true });
  await fs.mkdir(path.join(root, "schema"), { recursive: true });
  await fs.mkdir(path.join(root, "citability"), { recursive: true });
  await fs.mkdir(path.join(root, "report"), { recursive: true });
  await fs.mkdir(path.join(root, "xiaohongshu-draft"), { recursive: true });
  await fs.writeFile(path.join(root, "audit", "geo-aeo-audit-checklist.md"), "# audit\n");
  await fs.writeFile(path.join(root, "content", "keywords-research.md"), "# keywords\n");
  await fs.writeFile(path.join(root, "content", "zhihu-article.md"), "# zhihu\n");
  await fs.writeFile(path.join(root, "content", "xiaohongshu-article.md"), "# xhs\n");
  await fs.writeFile(path.join(root, "content", "wechat-article.md"), "# wechat\n");
  await fs.writeFile(path.join(root, "content", "optimized.md"), "# optimized\n");
  await fs.writeFile(path.join(root, "schema", "schema.jsonld"), "{}\n");
  await fs.writeFile(path.join(root, "citability", "citability-report.md"), "# score\n");
  await fs.writeFile(
    path.join(root, "report", "visibility-report.html"),
    "<!doctype html><html><body><section>report</section></body></html>",
  );
  await fs.writeFile(path.join(root, "xiaohongshu-draft", "draft-manifest.json"), "{}\n");

  const goal = [
    "帮【雷蛇灵刃2026】做品牌 GEO 全案，按阶段一次执行。",
    "geo-aeo-audit 审计清单。",
    "pd-geo：关键词 + 至少 3 个平台成稿 + optimized.md。",
    "mkt-schema：schema.jsonld。",
    "geo-citability：引用评分报告。",
    "od-data-report：visibility-report.html。",
    "可选：将一篇图文存【小红书】草稿（不公开发布），回报任务编号。",
  ].join("\n");
  const messages: CanonicalMessage[] = [{
    role: "assistant",
    content: [{
      type: "text",
      text: [
        "自检通过，文件：",
        "geo-aeo-audit-checklist.md",
        "keywords-research.md / zhihu-article.md / xiaohongshu-article.md / wechat-article.md",
        "optimized.md",
        "schema/schema.jsonld",
        "citability-report.md",
        "visibility-report.html",
        "draft-manifest.json",
        "blade16-hero.png",
        "comparison-thickness.png",
      ].join("\n"),
    }],
  }];

  const result = await validateEngineDeliverables({
    cwd,
    messages,
    userGoal: goal,
    capabilitySlug: "pd-geo",
  });

  assert.ok(result);
  assert.ok(result!.verified.some((p) => /visibility-report\.html/i.test(p)));
  assert.ok(result!.verified.some((p) => /geo-aeo-audit-checklist/i.test(p)));
  assert.ok(result!.verified.some((p) => /keywords/i.test(p)));
});

test("campaign full case scans the dominant artifacts/campaign folder for completeness", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-campaign-validate-"));
  const root = path.join(cwd, "artifacts", "campaign", "wuyutai-2026summer");
  const files = [
    "index.html",
    "platform-content.html",
    "visual-kv-preview.html",
    "Wuyutai-2026Summer-Brief.docx",
    "wuyutai-2026summer-campaign-all-in-one.html",
    "Wuyutai-2026Summer-CampaignPlan.md",
    "market-research.md",
    "main-visual.png",
    "draft-manifest.json",
    "monitoring-retrospective.md",
  ];
  for (const name of files) {
    await fs.mkdir(root, { recursive: true });
    const content = name.endsWith(".html")
      ? "<!doctype html><html><body><section>campaign</section></body></html>"
      : name.endsWith(".docx")
        ? Buffer.from("PK\x03\x04docx-bytes", "latin1")
        : name.endsWith(".png")
          ? Buffer.from("\x89PNG\r\n\x1a\npng-bytes", "latin1")
          : name === "draft-manifest.json"
            ? JSON.stringify({ publishMode: "draft", public: false })
        : "# campaign\n";
    await fs.writeFile(path.join(root, name), content);
  }

  const goal = [
    "帮我做【吴裕泰2026年夏季营销】的品牌传播 campaign 全案",
    "传播 brief：输出 Word(.docx)",
    "主视觉：一张竖版主视觉海报",
    "多平台内容：各平台文案与配图",
    "监测：给出监测指标与复盘模板",
  ].join("\n");
  const messages: CanonicalMessage[] = [
    {
      role: "assistant",
      content: [{
        type: "tool_call",
        id: "w1",
        name: "write_file",
        input: { file_path: "artifacts/campaign/wuyutai-2026summer/Wuyutai-2026Summer-Brief.docx" },
      }],
    },
    {
      role: "assistant",
      content: [{
        type: "text",
        text: "落地页见 index.html",
      }],
    },
  ];

  const result = await validateEngineDeliverables({
    cwd,
    messages,
    userGoal: goal,
  });

  assert.equal(result?.acceptance, "passed");
  assert.ok(result!.verified.includes("artifacts/campaign/wuyutai-2026summer/index.html"));
  assert.ok(result!.verified.includes("artifacts/campaign/wuyutai-2026summer/platform-content.html"));
  assert.ok(result!.verified.includes("artifacts/campaign/wuyutai-2026summer/Wuyutai-2026Summer-Brief.docx"));
});

test("campaign full case requires stage deliverables and safe draft manifest", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-campaign-required-"));
  const root = path.join(cwd, "artifacts", "campaign", "wuyutai-missing");
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, "index.html"), "<!doctype html><html><body><section>campaign</section></body></html>");
  await fs.writeFile(path.join(root, "Wuyutai-Brief.docx"), Buffer.from("PK\x03\x04docx-bytes", "latin1"));
  await fs.writeFile(path.join(root, "platform-content.html"), "<!doctype html><html><body><section>platform</section></body></html>");
  await fs.writeFile(path.join(root, "draft-manifest.json"), JSON.stringify({ public: true }));

  const result = await validateEngineDeliverables({
    cwd,
    userGoal: "帮我做吴裕泰 campaign 全案：调研、传播 brief、主视觉、多平台内容、平台草稿不公开发布、监测复盘模板",
    messages: [{
      role: "assistant",
      content: [{
        type: "tool_call",
        id: "w1",
        name: "write_file",
        input: { file_path: "artifacts/campaign/wuyutai-missing/index.html" },
      }],
    }],
  });

  assert.equal(result?.acceptance, "needs_repair");
  assert.equal(result?.acceptance, "needs_repair");
  assert.ok(result!.missing.length >= 1 || result!.failures.length >= 1);
  assert.ok(
    result!.failures.some((failure) => failure.reason === "broken" && /draft/i.test(String(failure.path)))
    || result!.broken.some((p) => /draft-manifest/i.test(p))
    || result!.missing.some((p) => /draft|research|visual|monitoring/i.test(p)),
  );
});

test("profile required deliverables stay constrained to the current turn artifact dir", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-profile-turndir-"));
  const oldRoot = path.join(cwd, "artifacts", "old-storyboard");
  const liveRoot = path.join(cwd, "artifacts", "live-storyboard");
  await fs.mkdir(oldRoot, { recursive: true });
  await fs.mkdir(liveRoot, { recursive: true });
  await fs.writeFile(path.join(oldRoot, "continuity_bible.md"), "# old bible\n");
  await fs.writeFile(path.join(oldRoot, "shot_cards.md"), "# old cards\n");
  await fs.writeFile(path.join(oldRoot, "handoff_design_matrix.md"), "# old matrix\n");
  await fs.writeFile(path.join(liveRoot, "project_brief.md"), "# live brief\n");

  const result = await validateEngineDeliverables({
    cwd,
    userGoal: "用「连续性分镜包」输出 continuity 分镜包：bible、镜头卡、交接矩阵",
    capabilitySlug: "create-vid-storyboard-pack",
    messages: [{
      role: "assistant",
      content: [{
        type: "tool_call",
        id: "w1",
        name: "write_file",
        input: { file_path: "artifacts/live-storyboard/project_brief.md" },
      }],
    }],
  });

  assert.equal(result?.acceptance, "needs_repair");
  assert.ok(result!.missing.some((p) => p.includes("continuity_bible.md")));
  assert.ok(!result!.verified.some((p) => p.includes("old-storyboard")));
});

test("React programmatic video template accepts root project files and common preview names", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-video-template-"));
  const root = path.join(cwd, "ai-video-template");
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { start: "remotion studio" } }));
  await fs.writeFile(path.join(root, "Root.tsx"), "export const RemotionRoot = () => null;\n");
  await fs.writeFile(path.join(root, "src", "AiVideoTemplate.tsx"), "export function AiVideoTemplate(){ return null; }\n");
  await fs.writeFile(
    path.join(root, "demo-preview.html"),
    "<!doctype html><html><body><section>AI Video Template</section></body></html>",
  );

  const messages: CanonicalMessage[] = [{
    role: "assistant",
    content: [{
      type: "text",
      text: [
        "已完成：",
        "ai-video-template/package.json",
        "ai-video-template/Root.tsx",
        "ai-video-template/src/AiVideoTemplate.tsx",
        "ai-video-template/demo-preview.html",
      ].join("\n"),
    }],
  }];

  const result = await validateEngineDeliverables({
    cwd,
    messages,
    userGoal: "用 React 程序化视频搭一个人工智能用途视频模板，支持标题与数字参数化，方便批量渲染。",
    capabilitySlug: "remotion-video-template",
  });

  assert.equal(result?.acceptance, "passed");
  assert.deepEqual(result?.missing, []);
  assert.ok(result!.verified.includes("ai-video-template/demo-preview.html"));
  assert.ok(result!.verified.includes("ai-video-template/src/AiVideoTemplate.tsx"));
});

test("brand geo full case passes when all final paths are canonical and accessible", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-brand-geo-pass-"));
  const root = path.join(cwd, "artifacts", "razer-blade-2026-geo");
  const files = [
    "audit/geo-aeo-audit-checklist.md",
    "content/keywords-research.md",
    "content/zhihu-article.md",
    "content/xiaohongshu-article.md",
    "content/wechat-article.md",
    "content/optimized.md",
    "schema/schema.jsonld",
    "citability/citability-report.md",
    "report/visibility-report.html",
  ];
  for (const rel of files) {
    await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
    const content = rel.endsWith(".html")
      ? "<!doctype html><html><body><section>report</section></body></html>"
      : rel.endsWith(".jsonld")
        ? "{}\n"
        : "# ok\n";
    await fs.writeFile(path.join(root, rel), content);
  }

  const goal = "帮【雷蛇灵刃2026】做品牌 GEO 全案：geo-aeo-audit、pd-geo、mkt-schema、geo-citability、od-data-report visibility-report.html。";
  const messages: CanonicalMessage[] = [{
    role: "assistant",
    content: [{
      type: "text",
      text: files.map((rel) => `artifacts/razer-blade-2026-geo/${rel}`).join("\n"),
    }],
  }];

  const result = await validateEngineDeliverables({
    cwd,
    messages,
    userGoal: goal,
    capabilitySlug: "pd-geo",
  });

  assert.equal(result?.acceptance, "passed");
  assert.deepEqual(result?.missing, []);
  assert.deepEqual(result?.broken, []);
});

test("brand geo full case prefers explicit artifact directory when basenames collide", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-brand-geo-collision-"));
  const oldRoot = path.join(cwd, "artifacts", "geo", "old-task");
  const liveRoot = path.join(cwd, "artifacts", "razer-blade-2026-geo-live");
  await fs.mkdir(oldRoot, { recursive: true });
  await fs.mkdir(liveRoot, { recursive: true });
  await fs.writeFile(path.join(oldRoot, "schema.jsonld"), "{}\n");
  for (const name of [
    "geo-aeo-audit-checklist.md",
    "keywords-research.md",
    "zhihu-article.md",
    "xiaohongshu-article.md",
    "wechat-article.md",
    "optimized.md",
    "schema.jsonld",
    "citability-report.md",
  ]) {
    await fs.writeFile(path.join(liveRoot, name), name.endsWith(".jsonld") ? "{}\n" : "# geo\n");
  }
  await fs.writeFile(
    path.join(liveRoot, "visibility-report.html"),
    "<!doctype html><html><body><section>visibility</section></body></html>",
  );

  const goal = [
    "帮【雷蛇灵刃2026】做品牌 GEO 全案。",
    "全部文件写入 artifacts/razer-blade-2026-geo-live/。",
    "pd-geo：关键词 + 至少 3 个平台成稿 + optimized.md。",
    "mkt-schema：schema.jsonld。",
    "od-data-report：visibility-report.html。",
  ].join("\n");

  const result = await validateEngineDeliverables({
    cwd,
    messages: [{
      role: "assistant",
      content: [{
        type: "text",
        text: [
          "已完成：",
          "artifacts/razer-blade-2026-geo-live/geo-aeo-audit-checklist.md",
          "artifacts/razer-blade-2026-geo-live/keywords-research.md",
          "artifacts/razer-blade-2026-geo-live/zhihu-article.md",
          "artifacts/razer-blade-2026-geo-live/xiaohongshu-article.md",
          "artifacts/razer-blade-2026-geo-live/wechat-article.md",
          "artifacts/razer-blade-2026-geo-live/optimized.md",
          "artifacts/razer-blade-2026-geo-live/schema.jsonld",
          "artifacts/razer-blade-2026-geo-live/citability-report.md",
          "artifacts/razer-blade-2026-geo-live/visibility-report.html",
        ].join("\n"),
      }],
    }],
    userGoal: goal,
    capabilitySlug: "pd-geo",
  });

  assert.ok(result!.verified.includes("artifacts/razer-blade-2026-geo-live/schema.jsonld"));
  assert.equal(result!.verified.includes("artifacts/geo/old-task/schema.jsonld"), false);
  assert.equal(result!.missing.includes("schema.jsonld"), false);
});

test("brand geo full case accepts staged draft paths without bare drafts repair loop", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-brand-geo-drafts-"));
  const root = path.join(cwd, "artifacts", "razer-blade-geo-20260623-1000");
  const files = [
    "01-audit-checklist.md",
    "02-keywords.md",
    "drafts/zhihu.md",
    "drafts/xiaohongshu.md",
    "drafts/wechat.md",
    "optimized.md",
    "03-content-optimization-audit.md",
    "schema.jsonld",
    "05-citability-score-report.md",
    "visibility-report.html",
  ];
  for (const rel of files) {
    await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
    const content = rel.endsWith(".html")
      ? "<!doctype html><html><body><section>visibility</section></body></html>"
      : rel.endsWith(".jsonld")
        ? "{}\n"
        : "# geo\n正文内容完整，非占位。\n";
    await fs.writeFile(path.join(root, rel), content);
  }

  const goal = [
    "帮【雷蛇灵刃笔记本】做品牌 GEO 全案，按阶段一次执行。",
    "geo-aeo-audit 审计清单。",
    "pd-geo：关键词 + 至少 3 个平台成稿 + optimized.md。",
    "geo-content-optimizer：优化 optimized.md 可引用性。",
    "mkt-schema：schema.jsonld。",
    "geo-citability：引用评分报告。",
    "od-data-report：visibility-report.html。",
  ].join("\n");
  const messages: CanonicalMessage[] = [{
    role: "assistant",
    content: [{
      type: "text",
      text: files.map((rel) => `artifacts/razer-blade-geo-20260623-1000/${rel}`).join("\n"),
    }],
  }];

  const result = await validateEngineDeliverables({
    cwd,
    messages,
    userGoal: goal,
    capabilitySlug: "pd-geo",
  });

  assert.equal(result?.acceptance, "passed");
  assert.deepEqual(result?.missing, []);
  assert.equal(result?.failures.some((failure) => failure.reason === "count_insufficient"), false);
  assert.equal(result?.continuePrompt ?? "", "");
  assert.ok(result!.verified.includes("artifacts/razer-blade-geo-20260623-1000/drafts/zhihu.md"));
});

test("brand geo full case accepts any three platform drafts", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-brand-geo-platforms-"));
  const root = path.join(cwd, "artifacts", "geo", "razer-blade-20260623");
  const files = [
    "audit-checklist.md",
    "keywords.md",
    "zhihu.md",
    "xiaohongshu.md",
    "weibo.md",
    "optimized.md",
    "schema.jsonld",
    "citability-report.md",
    "visibility-report.html",
  ];
  for (const rel of files) {
    await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
    await fs.writeFile(
      path.join(root, rel),
      rel.endsWith(".html")
        ? "<!doctype html><html><body><section>visibility</section></body></html>"
        : rel.endsWith(".jsonld")
          ? "{}\n"
          : "# geo\n正文内容完整，非占位。\n",
    );
  }

  const result = await validateEngineDeliverables({
    cwd,
    messages: [{
      role: "assistant",
      content: [{
        type: "text",
        text: files.map((rel) => `artifacts/geo/razer-blade-20260623/${rel}`).join("\n"),
      }],
    }],
    userGoal: [
      "帮【雷蛇灵刃笔记本】做品牌 GEO 全案，按阶段一次执行。",
      "pd-geo：关键词 + 至少 3 个平台成稿 + optimized.md。",
      "mkt-schema：schema.jsonld。",
      "geo-citability：引用评分报告。",
      "od-data-report：visibility-report.html。",
    ].join("\n"),
    capabilitySlug: "pd-geo",
  });

  assert.equal(result?.acceptance, "passed");
  assert.deepEqual(result?.missing, []);
  assert.ok(result!.verified.includes("artifacts/geo/razer-blade-20260623/weibo.md"));
});

test("nova aesthetic PNG slides reject html pdf outline without slide manifest", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-nova-slides-bad-"));
  const root = path.join(cwd, "artifacts", "slides-razer-blade-geo-20260623-1430");
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, "index.html"), "<!doctype html><html><body><section>slides</section></body></html>");
  await fs.writeFile(path.join(root, "razer-blade-geo-report.pdf"), Buffer.from("%PDF-1.7\n", "latin1"));
  await fs.writeFile(path.join(root, "outline.json"), "{}\n");

  const result = await validateEngineDeliverables({
    cwd,
    messages: [{
      role: "assistant",
      content: [{
        type: "text",
        text: [
          "8 页雷蛇风格 GEO 可见度幻灯片已完成：",
          "artifacts/slides-razer-blade-geo-20260623-1430/index.html",
          "artifacts/slides-razer-blade-geo-20260623-1430/razer-blade-geo-report.pdf",
          "artifacts/slides-razer-blade-geo-20260623-1430/outline.json",
        ].join("\n"),
      }],
    }],
    userGoal: "用「Nova-美学幻灯」把参考附件做成 8 页 16:9 雷蛇风格配图 PNG 幻灯",
    capabilitySlug: "nova-ppt-aesthetic-slides",
  });

  assert.equal(result?.acceptance, "needs_repair");
  assert.ok(result!.missing.includes("artifacts/slides-*/slide-manifest.json"));
  assert.ok(result!.failures.some((failure) => String(failure.message).includes("不能用 HTML/PDF/outline.json 替代")));
});

test("nova aesthetic PNG slides pass with manifest and requested PNG pages", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-nova-slides-pass-"));
  const root = path.join(cwd, "artifacts", "slides-razer-blade-geo-20260623-1430");
  await fs.mkdir(root, { recursive: true });
  const pages = [];
  for (let page = 1; page <= 8; page += 1) {
    const fileName = `slide-${String(page).padStart(2, "0")}.png`;
    await fs.writeFile(path.join(root, fileName), Buffer.from("\x89PNG\r\n\x1a\nimage", "latin1"));
    pages.push({
      page_index: page,
      title: `第 ${page} 页`,
      page_description: `第 ${page} 页`,
      image_path: fileName,
      status: "completed",
    });
  }
  await fs.writeFile(path.join(root, "slide-manifest.json"), JSON.stringify({
    skill_version: "test",
    deck_title: "Razer GEO",
    idea_prompt: "Razer GEO",
    preset_id: null,
    template_style: "razer",
    aspect_ratio: "16:9",
    language: "zh-CN",
    detail_level: "default",
    page_count: 8,
    pages,
  }, null, 2));

  const result = await validateEngineDeliverables({
    cwd,
    messages: [{
      role: "assistant",
      content: [{
        type: "text",
        text: "已完成 artifacts/slides-razer-blade-geo-20260623-1430/slide-manifest.json",
      }],
    }],
    userGoal: [
      "用「Nova-美学幻灯」把参考附件做成配图 PNG 幻灯",
      "补充：8页",
    ].join("\n"),
    capabilitySlug: "nova-ppt-aesthetic-slides",
  });

  assert.equal(result?.acceptance, "passed");
  assert.deepEqual(result?.missing, []);
  assert.ok(result!.verified.includes("artifacts/slides-razer-blade-geo-20260623-1430/slide-manifest.json"));
  assert.ok(result!.verified.includes("artifacts/slides-razer-blade-geo-20260623-1430/slide-08.png"));
});

test("nova aesthetic PNG slides can validate manifest discovered on disk", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-nova-slides-disk-"));
  const root = path.join(cwd, "artifacts", "slides-razer-disk-scan");
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, "slide-01.png"), Buffer.from("\x89PNG\r\n\x1a\nimage", "latin1"));
  await fs.writeFile(path.join(root, "slide-02.png"), Buffer.from("\x89PNG\r\n\x1a\nimage", "latin1"));
  await fs.writeFile(path.join(root, "slide-manifest.json"), JSON.stringify({
    pages: [
      { image_path: "slide-01.png" },
      { image_path: "slide-02.png" },
    ],
  }));

  const result = await validateEngineDeliverables({
    cwd,
    messages: [{
      role: "assistant",
      content: [{ type: "text", text: "2 页雷蛇风格配图 PNG 幻灯已完成。" }],
    }],
    userGoal: "用「Nova-美学幻灯」做成 2 页 16:9 雷蛇风格配图 PNG 幻灯",
    capabilitySlug: "nova-ppt-aesthetic-slides",
  });

  assert.equal(result?.acceptance, "passed");
  assert.deepEqual(result?.missing, []);
  assert.ok(result!.verified.includes("artifacts/slides-razer-disk-scan/slide-manifest.json"));
  assert.ok(result!.verified.includes("artifacts/slides-razer-disk-scan/slide-02.png"));
});

test("discovers sibling artifacts in the turn dir even when prose omits them", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-sweep-"));
  const dir = path.join(cwd, "artifacts", "deck-20260624");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "page-1.html"), "<!doctype html><html><body><section>1</section></body></html>");
  await fs.writeFile(path.join(dir, "page-2.html"), "<!doctype html><html><body><section>2</section></body></html>");
  const messages: CanonicalMessage[] = [{
    role: "assistant",
    content: [{ type: "text", text: "第一页已生成：artifacts/deck-20260624/page-1.html" }],
  }];

  const result = await validateEngineDeliverables({
    cwd,
    messages,
    userGoal: "做一个网页 HTML",
    capabilitySlug: "competitive-intelligence-summary",
  });

  assert.equal(result?.acceptance, "passed");
  assert.ok(result!.verified.includes("artifacts/deck-20260624/page-1.html"));
  assert.ok(result!.verified.includes("artifacts/deck-20260624/page-2.html"));
});

test("bounded sweep does not pull files from sibling turn directories", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-sweep-iso-"));
  const liveDir = path.join(cwd, "artifacts", "live-20260624");
  const oldDir = path.join(cwd, "artifacts", "old-20260101");
  await fs.mkdir(liveDir, { recursive: true });
  await fs.mkdir(oldDir, { recursive: true });
  await fs.writeFile(path.join(liveDir, "index.html"), "<!doctype html><html><body><section>live</section></body></html>");
  await fs.writeFile(path.join(oldDir, "stale.html"), "<!doctype html><html><body><section>old</section></body></html>");
  const messages: CanonicalMessage[] = [{
    role: "assistant",
    content: [{ type: "text", text: "本轮成果：artifacts/live-20260624/index.html" }],
  }];

  const result = await validateEngineDeliverables({
    cwd,
    messages,
    userGoal: "做一个网页 HTML",
    capabilitySlug: "competitive-intelligence-summary",
  });

  assert.ok(result!.verified.includes("artifacts/live-20260624/index.html"));
  assert.ok(!result!.verified.some((p) => p.includes("old-20260101")));
});

test("resolvedPathMap maps basenames and full paths to the real relative path", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-resolved-"));
  const dir = path.join(cwd, "artifacts", "report-20260624");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "index.html"), "<!doctype html><html><body><section>report</section></body></html>");
  const messages: CanonicalMessage[] = [{
    role: "assistant",
    content: [{ type: "text", text: "artifacts/report-20260624/index.html" }],
  }];

  const result = await validateEngineDeliverables({
    cwd,
    messages,
    userGoal: "做一个网页 HTML",
    capabilitySlug: "competitive-intelligence-summary",
  });

  assert.equal(result?.resolvedPathMap?.["index.html"], "artifacts/report-20260624/index.html");
  assert.equal(
    result?.resolvedPathMap?.["artifacts/report-20260624/index.html"],
    "artifacts/report-20260624/index.html",
  );
});

test("0717 P1: composite slot quality shadow telemetry on social_matrix index-only binding", async () => {
  const prevCert = process.env.PILOTDECK_DELIVERABLE_CERTIFICATE_V2;
  const prevContract = process.env.PILOTDECK_CONTRACT_AUTHORITY_V2;
  const prevComposite = process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY;
  const prevSdm = process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  process.env.PILOTDECK_DELIVERABLE_CERTIFICATE_V2 = "shadow";
  process.env.PILOTDECK_CONTRACT_AUTHORITY_V2 = "shadow";
  process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY = "shadow";
  process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";

  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "pd-composite-shadow-"));
  const scopeDir = path.join(cwd, "artifacts", "social-matrix");
  await fs.mkdir(scopeDir, { recursive: true });
  await fs.writeFile(path.join(scopeDir, "index.md"), "# social\n", "utf8");
  const messages: CanonicalMessage[] = [{
    role: "assistant",
    content: [{
      type: "tool_result",
      toolCallId: "call-social",
      content: [{ type: "text", text: JSON.stringify({ writtenFilePath: "artifacts/social-matrix/index.md" }) }],
    }],
  }];

  try {
    const result = await validateEngineDeliverables({
      cwd,
      messages,
      userGoal: "社媒矩阵包写入系统分配任务目录",
      sessionManifest: {
        manifestVersion: 1,
        goalVersion: 1,
        profileId: "social_matrix",
        taskArtifactDir: "artifacts/social-matrix",
        slots: [{
          id: "social_pack",
          label: "社媒矩阵",
          kind: "markdown",
          required: true,
          status: "active",
          pathHint: "index.md",
        }],
      } as never,
    });

    assert.match(result?.compositeQualityShadow ?? "", /composite_directory_incomplete/);
    assert.equal(result?.acceptance, "passed");
  } finally {
    if (prevCert == null) delete process.env.PILOTDECK_DELIVERABLE_CERTIFICATE_V2;
    else process.env.PILOTDECK_DELIVERABLE_CERTIFICATE_V2 = prevCert;
    if (prevContract == null) delete process.env.PILOTDECK_CONTRACT_AUTHORITY_V2;
    else process.env.PILOTDECK_CONTRACT_AUTHORITY_V2 = prevContract;
    if (prevComposite == null) delete process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY;
    else process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY = prevComposite;
    if (prevSdm == null) delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    else process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = prevSdm;
  }
});
