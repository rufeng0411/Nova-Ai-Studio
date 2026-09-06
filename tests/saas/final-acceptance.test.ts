import { describe, expect, it } from "vitest";

import {
  buildAcceptanceRepairPrompt,
  runFinalAcceptance,
} from "../../src/saas/final-acceptance/finalAcceptance.js";
import { buildTaskGoalContract } from "../../src/saas/taskState/taskGoalContract.js";

describe("final acceptance", () => {
  it("passes a normal html deliverable without judging visual taste", async () => {
    const result = await runFinalAcceptance({
      userGoal: "做【雷蛇2026产品系列】介绍页，5页，全屏滑动效果",
      assistantText: "已生成 output.html",
      candidates: [{
        path: "output.html",
        kind: "html",
        exists: true,
        sizeBytes: 4096,
        textPreview: "<!doctype html><html><body><section>雷蛇2026产品系列</section><section>1</section><section>2</section><section>3</section><section>4</section></body></html>",
      }],
    });

    expect(result.status).toBe("passed");
    expect(result.failures).toEqual([]);
  });

  it("passes a modern full-screen landing page when it is technically renderable", async () => {
    const html = `<!doctype html>
<html lang="zh-CN">
<head><title>RAZER 2026</title><style>.screen{min-height:100vh}</style></head>
<body>
  <main>
    <div class="screen hero"><h1>FOR GAMERS. FOR THE FUTURE.</h1></div>
    <div class="screen blade"><img src="https://medias-p1.phoenix.razer.com/blade.png" alt="Razer Blade" placeholder="blur"><h2>Blade</h2></div>
    <div class="screen huntsman"><h2>Huntsman</h2></div>
    <div class="screen viper"><h2>Viper</h2></div>
    <div class="screen audio"><h2>HyperCloud</h2></div>
  </main>
  <script>new IntersectionObserver(() => {});</script>
</body>`;

    const result = await runFinalAcceptance({
      userGoal: "用「官网落地页」做【雷蛇2026产品系列】介绍页，5页，炫酷现代网页效果",
      assistantText: "已生成 index.html",
      candidates: [{
        path: "index.html",
        kind: "html",
        exists: true,
        sizeBytes: html.length,
        textPreview: html,
      }],
    });

    expect(result.status).toBe("passed");
    expect(result.failures).toEqual([]);
  });

  it("fails html that is blank or leaked code instead of a formal page", async () => {
    const result = await runFinalAcceptance({
      userGoal: "做官网落地页",
      assistantText: "已生成 output.html",
      candidates: [{
        path: "output.html",
        kind: "html",
        exists: true,
        sizeBytes: 128,
        textPreview: "} /* CONTINUE HERE */ nav{position:fixed;top:0;width:100%}",
      }],
    });

    expect(result.status).toBe("needs_repair");
    expect(result.failures.map((f) => f.reason)).toContain("invalid_html");
  });

  it("fails when requested count is not met and suggests continuing missing items", async () => {
    const result = await runFinalAcceptance({
      userGoal: "做 5 页 HTML 产品介绍页",
      assistantText: "已生成 output.html",
      candidates: [{
        path: "output.html",
        kind: "html",
        exists: true,
        sizeBytes: 4096,
        textPreview: "<!doctype html><html><body><section>首页</section><section>产品</section><section>技术</section></body></html>",
      }],
    });

    expect(result.status).toBe("needs_repair");
    expect(result.failures.some((f) => f.reason === "count_insufficient")).toBe(true);
    expect(result.expectedManifest).toEqual([{
      id: "required_html",
      kind: "html",
      count: 5,
      required: true,
    }]);
    expect(result.continuePrompt).toMatch(/当前只有 3/);
    expect(result.continuePrompt).toMatch(/还缺 2/);
  });

  it("checks task goal contract requiredFiles in addition to expected kinds", async () => {
    const result = await runFinalAcceptance({
      userGoal: "帮品牌做 GEO 全案，交付 optimized.md 与 visibility-report.html",
      goalContract: {
        goalVersion: 1,
        sourceGoal: "帮品牌做 GEO 全案",
        expectedKinds: [],
        requiredFiles: ["optimized.md", "visibility-report.html"],
        qualityChecks: ["exists", "non_empty"],
      },
      candidates: [{
        path: "artifacts/geo/demo/optimized.md",
        kind: "markdown",
        exists: true,
        sizeBytes: 128,
        textPreview: "# 优化稿\n正文",
      }],
    });

    expect(result.status).toBe("needs_repair");
    expect(result.verifiedPaths).toContain("artifacts/geo/demo/optimized.md");
    expect(result.missingPaths).toContain("visibility-report.html");
    expect(result.expectedManifest).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "required_file:optimized.md", required: true }),
      expect.objectContaining({ id: "required_file:visibility-report.html", required: true }),
    ]));
  });

  it("recognizes Chinese and English requested page counts", async () => {
    const chinese = await runFinalAcceptance({
      userGoal: "做二十页 HTML 产品手册",
      candidates: [{
        path: "manual.html",
        kind: "html",
        exists: true,
        sizeBytes: 4096,
        textPreview: "<!doctype html><html><body><section>一</section><section>二</section></body></html>",
      }],
    });
    expect(chinese.status).toBe("needs_repair");
    expect(chinese.failures.find((f) => f.reason === "count_insufficient")?.expected).toBe(20);

    const english = await runFinalAcceptance({
      userGoal: "Create 5 pages HTML microsite",
      candidates: [{
        path: "site.html",
        kind: "html",
        exists: true,
        sizeBytes: 4096,
        textPreview: "<!doctype html><html><body><section>one</section><section>two</section></body></html>",
      }],
    });
    expect(english.status).toBe("needs_repair");
    expect(english.failures.find((f) => f.reason === "count_insufficient")?.expected).toBe(5);
  });

  it("fails invalid Office/PDF binary headers as broken deliverables", async () => {
    const result = await runFinalAcceptance({
      userGoal: "导出 PPTX 文件",
      candidates: [{
        path: "deck.pptx",
        kind: "pptx",
        exists: true,
        sizeBytes: 128,
        binaryHeader: "not-a-zip",
      }],
    });

    expect(result.status).toBe("needs_repair");
    expect(result.brokenPaths).toEqual(["deck.pptx"]);
    expect(result.failures.some((f) => f.reason === "broken")).toBe(true);
  });

  it("fails invalid image headers and placeholder markdown", async () => {
    const result = await runFinalAcceptance({
      userGoal: "输出主视觉海报和 Markdown 监测模板",
      candidates: [
        {
          path: "poster.png",
          kind: "image",
          exists: true,
          sizeBytes: 64,
          binaryHeader: "not-png",
        },
        {
          path: "monitoring.md",
          kind: "markdown",
          exists: true,
          sizeBytes: 32,
          textPreview: "TODO placeholder",
        },
      ],
    });

    expect(result.status).toBe("needs_repair");
    expect(result.brokenPaths).toEqual(expect.arrayContaining(["poster.png", "monitoring.md"]));
    expect(result.failures.some((f) => f.reason === "broken" && f.path === "poster.png")).toBe(true);
    expect(result.failures.some((f) => f.reason === "placeholder" && f.path === "monitoring.md")).toBe(true);
  });

  it("fails chart html reports without real chart containers", async () => {
    const result = await runFinalAcceptance({
      userGoal: "输出带有好看先进图表的 HTML 报告",
      candidates: [{
        path: "report.html",
        kind: "html",
        exists: true,
        sizeBytes: 4096,
        textPreview: "<!doctype html><html><body><section>雷蛇报告</section><script src=\"https://cdn.jsdelivr.net/npm/chart.js\"></script><script>new Chart(ctx,{})</script></body></html>",
      }],
    });

    expect(result.status).toBe("needs_repair");
    expect(result.brokenPaths).toContain("report.html");
    expect(result.failures.some((f) => f.reason === "invalid_html" && f.path === "report.html")).toBe(true);
  });

  it("fails office exports when extracted content is empty or pdf is a shell", async () => {
    const result = await runFinalAcceptance({
      userGoal: "同时输出 docx 和 pdf 版本",
      candidates: [
        {
          path: "report.docx",
          kind: "docx",
          exists: true,
          sizeBytes: 4096,
          binaryHeader: "PK\x03\x04",
          textPreview: "   ",
        },
        {
          path: "report.pdf",
          kind: "pdf",
          exists: true,
          sizeBytes: 12,
          binaryHeader: "%PDF-1.7",
        },
      ],
    });

    expect(result.status).toBe("needs_repair");
    expect(result.brokenPaths).toEqual(expect.arrayContaining(["report.docx", "report.pdf"]));
  });

  it("uses type_mismatch when deliverable type differs from the user goal", async () => {
    const result = await runFinalAcceptance({
      userGoal: "生成真实 PPTX 并报路径",
      candidates: [{
        path: "presentation.html",
        kind: "html",
        exists: true,
        sizeBytes: 256,
        textPreview: "<!doctype html><html><body><section>Deck preview page</section></body></html>",
      }],
    });

    expect(result.status).toBe("needs_repair");
    expect(result.missingPaths).toContain("*.pptx");
    expect(result.failures.some((f) => f.reason === "type_mismatch")).toBe(true);
  });

  it("requires a real video file for video goals instead of accepting html or markdown", async () => {
    const userGoal = "用 HTML 代码做视频，导出一支 18 秒 MP4 视频";
    const result = await runFinalAcceptance({
      userGoal,
      goalContract: buildTaskGoalContract({ userGoal }),
      candidates: [
        {
          path: "artifacts/norway-viking-worldcup-2026/index.html",
          kind: "html",
          exists: true,
          sizeBytes: 4096,
          textPreview: "<!doctype html><html><body><section>Norway video page</section></body></html>",
        },
        {
          path: "artifacts/geo/visual-styles.md",
          kind: "markdown",
          exists: true,
          sizeBytes: 256,
          textPreview: "# 视觉风格\n深色现代风",
        },
      ],
    });

    expect(result.status).toBe("needs_repair");
    expect(result.missingPaths).toContain("*.mp4");
    expect(result.failures.some((f) => f.reason === "type_mismatch")).toBe(true);
  });

  it("does not accept webm when the user explicitly requested mp4", async () => {
    const userGoal = "用 HTML 代码做视频，导出一支 18 秒 MP4 视频";
    const result = await runFinalAcceptance({
      userGoal,
      goalContract: buildTaskGoalContract({ userGoal }),
      candidates: [{
        path: "artifacts/norway-viking-worldcup-2026/output.webm",
        kind: "video",
        exists: true,
        sizeBytes: 1024,
        binaryHeader: "\x1a\x45\xdf\xa3webm",
      }],
    });

    expect(result.status).toBe("needs_repair");
    expect(result.missingPaths).toContain("*.mp4");
  });

  it("fails tiny mp4 shells even when the ftyp header exists", async () => {
    const userGoal = "用 HTML 代码做视频，导出一支 18 秒 MP4 视频";
    const result = await runFinalAcceptance({
      userGoal,
      goalContract: buildTaskGoalContract({ userGoal }),
      candidates: [{
        path: "artifacts/norway-viking-worldcup-2026/output.mp4",
        kind: "video",
        exists: true,
        sizeBytes: 1024,
        binaryHeader: "\x00\x00\x00\x18ftypisom",
      }],
    });

    expect(result.status).toBe("needs_repair");
    expect(result.brokenPaths).toContain("artifacts/norway-viking-worldcup-2026/output.mp4");
  });

  it("fails html deliverables that can only show an indefinite loading screen", async () => {
    const html = `<!doctype html>
<html><head><title>3D Stars</title></head>
<body>
  <div id="loading">Loading 3D scene...</div>
  <script src="https://unpkg.com/three@0.160.0/build/three.module.js"></script>
  <script type="module">
    import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
    initExternalOnlyScene();
  </script>
</body></html>`;
    const result = await runFinalAcceptance({
      userGoal: "用 3D网页创作做世界杯2026巨星集锦展示网页",
      candidates: [{
        path: "artifacts/3d/world-cup-2026-stars/index.html",
        kind: "html",
        exists: true,
        sizeBytes: html.length,
        textPreview: html,
      }],
    });

    expect(result.status).toBe("needs_repair");
    expect(result.brokenPaths).toContain("artifacts/3d/world-cup-2026-stars/index.html");
    expect(result.failures.some((f) => f.reason === "invalid_html")).toBe(true);
  });

  it("requires all three outputs for outline plus animated html plus video tasks", async () => {
    const userGoal = [
      "帮我把【世界杯2026挪威主题】做成一支能直接发的演示视频，三步连着做，每步把文件存到 artifacts/ 并告诉我路径：",
      "先查清楚这个主题的要点，写一份 8-12 节的结构化大纲。",
      "按大纲做一套深色现代风的动效网页演示，每节一屏。",
      "把演示页按每屏 4-6 秒渲染成横版 1080p 视频。",
    ].join("\n");
    const goalContract = buildTaskGoalContract({ userGoal, capabilitySlug: "html-video" });
    const incomplete = await runFinalAcceptance({
      userGoal,
      goalContract,
      candidates: [
        {
          path: "artifacts/norway-worldcup-2026/outline.md",
          kind: "markdown",
          exists: true,
          sizeBytes: 512,
          textPreview: "# 大纲\n1. 北欧战神\n2. 黄金一代",
        },
        {
          path: "artifacts/norway-worldcup-2026/index.html",
          kind: "html",
          exists: true,
          sizeBytes: 4096,
          textPreview: "<!doctype html><html><body><section>1</section><section>2</section><section>3</section><section>4</section><section>5</section><section>6</section><section>7</section><section>8</section></body></html>",
        },
      ],
    });
    expect(incomplete.status).toBe("needs_repair");
    expect(incomplete.missingPaths).toContain("*.mp4");

    const complete = await runFinalAcceptance({
      userGoal,
      goalContract,
      candidates: [
        {
          path: "artifacts/norway-worldcup-2026/outline.md",
          kind: "markdown",
          exists: true,
          sizeBytes: 1024,
          textPreview: "# 结构化大纲\n1. 资格赛背景\n2. 北欧精神\n3. 核心球星\n4. 战术看点\n5. 视觉主轴\n6. 粉丝情绪\n7. 世界杯预期\n8. 结尾号召",
        },
        {
          path: "artifacts/norway-worldcup-2026/index.html",
          kind: "html",
          exists: true,
          sizeBytes: 8192,
          textPreview: "<!doctype html><html><body><section>1</section><section>2</section><section>3</section><section>4</section><section>5</section><section>6</section><section>7</section><section>8</section></body></html>",
        },
        {
          path: "artifacts/norway-worldcup-2026/output.mp4",
          kind: "video",
          exists: true,
          sizeBytes: 65536,
          binaryHeader: "\x00\x00\x00\x18ftypisom",
        },
      ],
    });
    expect(complete.status).toBe("passed");
  });

  it("can validate against the latest explicit goal contract", async () => {
    const goalContract = buildTaskGoalContract({
      previousContract: buildTaskGoalContract({ userGoal: "做一份 PPT" }),
      userGoal: "不要 PPT 了，改成一份 Word 报告",
    });
    const result = await runFinalAcceptance({
      userGoal: "不要 PPT 了，改成一份 Word 报告",
      goalContract,
      candidates: [{
        path: "presentation.pptx",
        kind: "pptx",
        exists: true,
        sizeBytes: 256,
        binaryHeader: "PK\x03\x04",
      }],
    });

    expect(result.status).toBe("needs_repair");
    expect(result.missingPaths).toContain("*.docx");
    expect(result.failures.some((failure) => failure.reason === "type_mismatch")).toBe(true);
  });

  it("requires every explicitly requested report format", async () => {
    const goal = "我需要一个带有雷蛇风格和好看先进图表的html版本报告，并同时输出docx和pdf版本";
    const result = await runFinalAcceptance({
      userGoal: goal,
      goalContract: buildTaskGoalContract({ userGoal: goal }),
      candidates: [
        {
          path: "report.html",
          kind: "html",
          exists: true,
          sizeBytes: 4096,
          textPreview: "<!doctype html><html><body><section>雷蛇报告正文</section><section>图表</section></body></html>",
        },
        {
          path: "report.docx",
          kind: "docx",
          exists: true,
          sizeBytes: 4096,
          binaryHeader: "PK\x03\x04",
        },
      ],
    });

    expect(result.status).toBe("needs_repair");
    expect(result.missingPaths).toContain("*.pdf");
    expect(result.failures.some((failure) => failure.reason === "missing" && failure.expected === "pdf")).toBe(true);
    expect(result.expectedManifest?.map((item) => item.kind)).toEqual(["html", "docx", "pdf"]);
  });

  it("accepts legacy hyphenated storyboard filenames through required-file aliases", async () => {
    const userGoal = "生成连续性分镜包，包含 bible、镜头卡和交接矩阵";
    const result = await runFinalAcceptance({
      userGoal,
      goalContract: {
        goalVersion: 1,
        sourceGoal: userGoal,
        expectedKinds: [],
        requiredFiles: ["continuity_bible.md", "shot_cards.md", "handoff_design_matrix.md"],
        qualityChecks: ["exists", "non_empty"],
      },
      candidates: [
        { path: "artifacts/sb/story-bible.md", kind: "markdown", exists: true, sizeBytes: 256, textPreview: "# 连续性圣经\n人物、空间、轴线、光线设定" },
        { path: "artifacts/sb/shot-cards.md", kind: "markdown", exists: true, sizeBytes: 256, textPreview: "# 镜头卡\nSHOT001 起幅 落幅 时长" },
        { path: "artifacts/sb/handoff-matrix.md", kind: "markdown", exists: true, sizeBytes: 256, textPreview: "# 交接矩阵\nCLIP001->CLIP002 接棒线索" },
      ],
    });

    expect(result.status).toBe("passed");
    expect(result.missingPaths).toEqual([]);
  });

  it("reports kind-scoped count gaps that name the specific kind", async () => {
    const userGoal = [
      "帮我把【世界杯2026挪威主题】做成演示视频，三步连做：",
      "先写一份 8-12 节的结构化大纲。",
      "按大纲做动效网页演示，每节一屏。",
      "把演示页渲染成视频。",
    ].join("\n");
    const goalContract = buildTaskGoalContract({ userGoal, capabilitySlug: "html-video" });
    expect(goalContract.kindCounts).toEqual([{ kind: "html", min: 8 }]);

    const result = await runFinalAcceptance({
      userGoal,
      goalContract,
      candidates: [
        { path: "artifacts/wc/outline.md", kind: "markdown", exists: true, sizeBytes: 512, textPreview: "# 大纲\n1\n2\n3\n4\n5\n6\n7\n8" },
        { path: "artifacts/wc/index.html", kind: "html", exists: true, sizeBytes: 4096, textPreview: "<!doctype html><html><body><section>1</section><section>2</section><section>3</section></body></html>" },
        { path: "artifacts/wc/output.mp4", kind: "video", exists: true, sizeBytes: 65536, binaryHeader: "\x00\x00\x00\x18ftypisom" },
      ],
    });

    expect(result.status).toBe("needs_repair");
    const countFailure = result.failures.find((f) => f.reason === "count_insufficient");
    expect(countFailure?.message).toMatch(/html/);
    expect(countFailure?.expected).toBe(8);
    expect(countFailure?.actual).toBe(3);
  });

  it("builds a focused repair prompt without asking the user to intervene", () => {
    const prompt = buildAcceptanceRepairPrompt({
      userGoal: "生成 5 页网页",
      result: {
        status: "needs_repair",
        expected: { kind: "html", count: 5 },
        verifiedPaths: ["output.html"],
        missingPaths: [],
        brokenPaths: ["output.html"],
        failures: [
          { reason: "count_insufficient", message: "当前只有 3 页，还缺 2 页。", expected: 5, actual: 3 },
          { reason: "invalid_html", message: "output.html 无法作为正式网页交付。", path: "output.html" },
        ],
        continuePrompt: "继续补齐缺失页面并修复 output.html。",
      },
    });

    expect(prompt).toMatch(/不要询问用户/);
    expect(prompt).toMatch(/当前只有 3 页/);
    expect(prompt).toMatch(/output\.html/);
  });

  it("collapses missing + type_mismatch lines for the same kind in the repair prompt", () => {
    const prompt = buildAcceptanceRepairPrompt({
      userGoal: "出 html 和 pdf 两版",
      result: {
        status: "needs_repair",
        expected: { kind: "pdf" },
        verifiedPaths: ["report.html"],
        missingPaths: ["*.pdf"],
        brokenPaths: [],
        failures: [
          { reason: "missing", message: "缺少用户要求的 pdf 成果。", expected: "pdf" },
          { reason: "type_mismatch", message: "已有成果类型不完整，仍缺少用户要求的 pdf。", expected: "pdf", actual: "html" },
        ],
        continuePrompt: "继续补齐 pdf。",
      },
    });

    expect(prompt).toMatch(/缺少用户要求的 pdf 成果。/);
    expect(prompt).not.toMatch(/已有成果类型不完整/);
    const pdfReasonMatches = prompt.match(/用户要求的 pdf/g) ?? [];
    expect(pdfReasonMatches.length).toBe(1);
  });

  it("keeps distinct missing kinds and ungrouped broken failures", () => {
    const prompt = buildAcceptanceRepairPrompt({
      userGoal: "出 pdf 和 docx",
      result: {
        status: "needs_repair",
        expected: { kind: "pdf" },
        verifiedPaths: [],
        missingPaths: ["*.pdf", "*.docx"],
        brokenPaths: ["a.pdf"],
        failures: [
          { reason: "missing", message: "缺少用户要求的 pdf 成果。", expected: "pdf" },
          { reason: "missing", message: "缺少用户要求的 docx 成果。", expected: "docx" },
          { reason: "broken", message: "a.pdf 打不开。", path: "a.pdf" },
        ],
        continuePrompt: "继续。",
      },
    });

    expect(prompt).toMatch(/缺少用户要求的 pdf 成果。/);
    expect(prompt).toMatch(/缺少用户要求的 docx 成果。/);
    expect(prompt).toMatch(/a\.pdf 打不开。/);
  });
});
