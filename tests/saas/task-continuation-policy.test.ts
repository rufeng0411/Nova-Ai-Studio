import { describe, expect, it } from "vitest";
import {
  buildUserActionRequiredNotice,
  resolveContinuationAction,
  buildRetryAlternateWeakHint,
  classifyAskUserQuestionPolicy,
  resolveContinuationDecision,
  shouldAutoBypassPreferenceAskUser,
  resolvePreferenceAskUserBypass,
  shouldTriggerDeliverableRepair,
} from "../../src/saas/taskContinuationPolicy.js";
import {
  shouldAutoContinueAfterIncompleteDeliverableStop,
  shouldAutoContinueAfterTurnOutcome,
  shouldAutoContinueAfterAssistantText,
  userGoalImpliesDeliverable,
} from "../../src/agent/errors/userFacingErrors.js";
import { classifyUserActionBlocker } from "../../src/saas/userActionBlocker.js";
import type { SessionDeliverableManifest } from "../../src/saas/taskState/sessionDeliverableManifest.js";

describe("taskContinuationPolicy", () => {
  it("P0-7: accepted_partial is terminal even when stale gaps remain", () => {
    const context = {
      userGoal: "交付报告和网页版",
      assistantText: "还需要继续补齐网页版。",
      autoRecoveryContinueEnabled: true,
      validationResult: {
        verified: ["artifacts/task/report.md"],
        missing: ["artifacts/task/report.html"],
        broken: [],
        acceptance: "passed" as const,
        completionState: "accepted_partial" as const,
      },
    };

    expect(shouldTriggerDeliverableRepair(context)).toBe(false);
    expect(resolveContinuationAction(context)).toBe("none");
  });

  it("Fix-greeting: pure hello must not auto-continue after assistant reply", () => {
    const greetingReply = "你好！我是你的 AI 助手。请问有什么我可以帮你的吗？";
    expect(shouldAutoContinueAfterAssistantText(greetingReply, {
      userGoalText: "你好啊",
      latestUserText: "你好啊",
    })).toBe(false);
    expect(resolveContinuationAction({
      userGoal: "你好啊",
      assistantText: greetingReply,
      turnInteractionMode: "dialogue",
      autoRecoveryContinueEnabled: true,
    })).toBe("none");
    expect(resolveContinuationAction({
      userGoal: "你好啊",
      assistantText: greetingReply,
      autoRecoveryContinueEnabled: true,
    })).toBe("none");
  });

  it("P0-7: blocked completion never enters automatic continuation", () => {
    expect(resolveContinuationAction({
      userGoal: "交付报告",
      assistantText: "还需要继续。",
      autoRecoveryContinueEnabled: true,
      validationResult: {
        verified: [],
        missing: ["artifacts/task/report.md"],
        broken: [],
        acceptance: "failed",
        completionState: "blocked",
      },
    })).toBe("none");
  });

  it("P0-7: pathless quality repair remains engine-owned", () => {
    expect(resolveContinuationAction({
      userGoal: "交付鸣镝 G700 的两页报告",
      assistantText: "报告文件已生成。",
      autoRecoveryContinueEnabled: true,
      validationResult: {
        verified: ["artifacts/task/report.html"],
        missing: [],
        broken: [],
        acceptance: "needs_repair",
      },
    })).toBe("deliverable_repair");
  });

  it("X2: streak 1-2 retry_alternate for missing key", () => {
    const blocker = classifyUserActionBlocker({
      toolErrorMessage: "MINERU API key not configured",
    });
    expect(resolveContinuationAction({
      blocker,
      blockerStreak: 1,
    })).toBe("retry_alternate");
    expect(resolveContinuationAction({
      blocker,
      blockerStreak: 2,
    })).toBe("retry_alternate");
  });

  it("X2: streak 3 user_action_required", () => {
    const blocker = classifyUserActionBlocker({
      toolErrorMessage: "MINERU API key not configured",
    })!;
    expect(resolveContinuationAction({
      blocker,
      blockerStreak: 3,
    })).toBe("user_action_required");
    const notice = buildUserActionRequiredNotice({ blocker, locale: "zh-CN" });
    expect(notice.reason).toMatch(/3/);
    expect(notice.steps.length).toBeGreaterThanOrEqual(3);
  });

  it("does not block GEO full-case delivery on optional MinerU OCR key when degrade is allowed", () => {
    const blocker = classifyUserActionBlocker({
      toolErrorMessage: "MINERU API key not configured",
    })!;
    expect(resolveContinuationAction({
      blocker,
      blockerStreak: 3,
      userGoal: [
        "帮【雷蛇灵刃笔记本】做品牌 GEO 全案，按阶段一次执行。",
        "pd-geo：关键词 + 至少 3 个平台成稿 + optimized.md。",
        "geo-citability：引用评分报告 + 必要时 geo_api 验证。",
        "od-data-report：visibility-report.html。",
        "若评分或联网验证不可用请降级仍交付，不要中断。",
      ].join("\n"),
    })).toBe("retry_alternate");
  });

  it("does not block GEO full-case on optional Yixiaoer draft when degrade is allowed", () => {
    const blocker = classifyUserActionBlocker({
      toolErrorMessage: "已尝试 3 种方式，仍缺少 蚁小二 的 API Key，无法推送社媒草稿。",
    })!;
    expect(blocker.serviceId).toBe("yixiaoer");
    expect(resolveContinuationAction({
      blocker,
      blockerStreak: 3,
      userGoal: [
        "帮【南美旅游】做品牌 GEO 全案，按阶段一次执行。",
        "7. 可选：将一篇图文存【小红书】草稿（不公开发布），回报任务编号。",
        "若评分或联网验证不可用请降级仍交付，不要中断。",
      ].join("\n"),
    })).toBe("retry_alternate");
  });

  it("auto-continues deliverable tasks that end with bare fetch failed bodies", () => {
    expect(resolveContinuationAction({
      assistantText: "fetch failed\n\nfetch failed",
      userGoal: "用「Nova-竞品对标」对【南美旅游】做竞品全量对标：竞品清单、维度对比与突围策略。",
      autoRecoveryContinueEnabled: true,
    })).toBe("auto_continue_engine");
  });

  it("does not block GEO full-case delivery on generic export API key when degrade is allowed", () => {
    const blocker = classifyUserActionBlocker({
      toolErrorMessage: "export_document failed: API key not configured",
    })!;
    expect(resolveContinuationAction({
      blocker,
      blockerStreak: 3,
      userGoal: [
        "帮【雷蛇灵刃2026 5090笔记本】做品牌 GEO 全案，按阶段一次执行。",
        "pd-geo：关键词 + 至少 3 个平台成稿 + optimized.md。",
        "geo-citability：引用评分报告 + 必要时 geo_api 验证。",
        "od-data-report：visibility-report.html。",
        "若评分或联网验证不可用请降级仍交付，不要中断。",
      ].join("\n"),
    })).toBe("retry_alternate");
  });

  it("does not block social matrix on generic export API key when direct start", () => {
    const blocker = classifyUserActionBlocker({
      toolErrorMessage: "已尝试 3 种方式，仍缺少 API 的 API Key，无法继续导出。",
    })!;
    expect(blocker.serviceId).toBe("export");
    expect(resolveContinuationAction({
      blocker,
      blockerStreak: 3,
      userGoal: [
        "帮我把【ROG大油条】做成国内社媒矩阵，一次做完并存 artifacts/social-matrix/",
        "写 brief 与创意锚点；四套比例配图；多平台文案；打包存小红书草稿。",
        "直接开始做，做完告诉我目录和草稿编号。",
      ].join("\n"),
    })).toBe("retry_alternate");
  });

  it("social matrix yixiaoer missing key still requires user action at streak 3", () => {
    const blocker = classifyUserActionBlocker({
      toolErrorMessage: "YIXIAOER_API_KEY not configured for yixiaoer_api",
    })!;
    expect(blocker.serviceId).toBe("yixiaoer");
    expect(resolveContinuationAction({
      blocker,
      blockerStreak: 3,
      userGoal: "社媒矩阵存小红书草稿箱，直接开始做",
    })).toBe("user_action_required");
    const notice = buildUserActionRequiredNotice({
      blocker,
      locale: "zh-CN",
      userGoal: "社媒矩阵存小红书草稿箱",
    });
    expect(notice.reason).toMatch(/蚁小二/);
    expect(notice.steps[0]).toMatch(/蚁小二/);
    expect(notice.reason).not.toMatch(/OCR|文档 OCR/);
  });

  it("generate_image network failure is not a credential blocker", () => {
    expect(classifyUserActionBlocker({
      toolErrorMessage: "generate_image fetch failed: connect ETIMEDOUT to googleapis.com",
    })).toBeNull();
  });

  it("missing key notice uses image settings for generate_image", () => {
    const blocker = classifyUserActionBlocker({
      toolErrorMessage: "generate_image is not configured. Set tools.image.apiKey",
    })!;
    expect(blocker?.serviceId).toBe("image");
    const notice = buildUserActionRequiredNotice({ blocker: blocker!, locale: "zh-CN" });
    expect(notice.reason).toMatch(/生图/);
    expect(notice.steps[0]).toMatch(/图片生成/);
    expect(notice.reason).not.toMatch(/OCR|导出/);
  });

  it("social matrix bypasses export key without direct-start phrase", () => {
    const blocker = classifyUserActionBlocker({
      toolErrorMessage: "export_document: API key not configured",
    })!;
    expect(resolveContinuationAction({
      blocker,
      blockerStreak: 3,
      userGoal: "帮【ROG大油条】做成国内社媒矩阵，存 artifacts/social-matrix/，四套配图与多平台文案",
    })).toBe("retry_alternate");
  });

  it("capability execution contracts bypass optional media keys for visual tasks", () => {
    const imageBlocker = classifyUserActionBlocker({
      toolErrorMessage: "generate_image is not configured. Set tools.image.apiKey",
    })!;
    process.env.PILOTDECK_HF_KEY_OPTIONAL_DEGRADE = "1";
    expect(resolveContinuationAction({
      blocker: imageBlocker,
      blockerStreak: 3,
      capabilitySlug: "hf-website-to-video",
      userGoal: "用网站一键成片抓取 nike.com.cn 生成品牌宣传视频",
    })).toBe("retry_alternate");

    delete process.env.PILOTDECK_HF_KEY_OPTIONAL_DEGRADE;
    expect(resolveContinuationAction({
      blocker: imageBlocker,
      blockerStreak: 1,
      capabilitySlug: "hf-website-to-video",
      userGoal: "用网站一键成片抓取 nike.com.cn 生成品牌宣传视频",
    })).toBe("user_action_required");

    const hfNotice = buildUserActionRequiredNotice({
      blocker: imageBlocker,
      capabilitySlug: "hf-website-to-video",
      locale: "zh-CN",
    });
    expect(hfNotice.title).toContain("HyperFrames");

    const exportBlocker = classifyUserActionBlocker({
      toolErrorMessage: "export_document failed: API key not configured",
    })!;
    expect(resolveContinuationAction({
      blocker: exportBlocker,
      blockerStreak: 3,
      userGoal: "用 3D网页创作做世界杯2026巨星集锦展示网页",
    })).toBe("retry_alternate");
  });

  it("engine user_action notice text is not reclassified as blocker", () => {
    expect(classifyUserActionBlocker({
      assistantText: [
        "已尝试 3 种方式，仍缺少 API 的 API Key，无法继续导出。",
        "",
        "1. 打开 设置 → 能力接入 → 文档 OCR（或对应模型池）",
        "2. 填入有效的 API Key / Token 并保存",
        "3. 在本对话回复「已配置，继续」",
      ].join("\n"),
    })).toBeNull();
  });

  it("unambiguous auth fast-path", () => {
    const blocker = classifyUserActionBlocker({
      toolErrorMessage: "401 Unauthorized invalid api key",
    })!;
    expect(blocker.unambiguous).toBe(true);
    expect(resolveContinuationAction({ blocker, blockerStreak: 1 })).toBe("user_action_required");
  });

  it("FIX-A: planning stop auto_continue", () => {
    expect(resolveContinuationAction({
      userGoal: "生成PPT",
      assistantText: "Now let me write the Python script for pptx",
      planningOrSetupStop: true,
    })).toBe("auto_continue_engine");
  });

  it("FIX-A2: template todo-only stop auto_continue (b565c213 class)", () => {
    expect(resolveContinuationAction({
      userGoal: "用 Nova-用户研究 做八章式用户研究，直接开始做",
      assistantText: "已创建 todo 清单，接下来我会逐章 write_file。",
      planningOrSetupStop: false,
    })).toBe("auto_continue_engine");
  });

  it("deliverable_repair when missing files", () => {
    expect(resolveContinuationAction({
      userGoal: "生成pptx",
      validationResult: { verified: [], missing: ["out.pptx"], broken: [] },
    })).toBe("deliverable_repair");
  });

  it("returns state-machine decision for missing deliverables", () => {
    expect(resolveContinuationDecision({
      userGoal: "生成pptx",
      validationResult: { verified: [], missing: ["out.pptx"], broken: [] },
    })).toEqual({
      action: "deliverable_repair",
      state: "repairing",
      owner: "deliverable_repair",
      reason: "acceptance_failed",
    });
  });

  it("deliverable_repair when final acceptance finds broken files", () => {
    expect(resolveContinuationAction({
      userGoal: "生成网页",
      validationResult: { verified: [], missing: [], broken: ["output.html"] },
    })).toBe("deliverable_repair");
  });

  it("does not treat root-level slash markdown paths as completed deliverables", () => {
    expect(shouldAutoContinueAfterIncompleteDeliverableStop(
      "已完成，交付文件汇总：使用方法 Markdown /01-topic.md，可重复使用 Markdown /02-topic-template.md",
      {
        userGoalText: "用 audience-intelligence 帮我：世界杯周边受众，输出文件",
      },
    )).toBe(true);
  });

  it("auto continues to repair when user reports generated deliverables cannot be opened", () => {
    expect(shouldAutoContinueAfterAssistantText(
      "请问您遇到的具体问题是怎样的呢？例如：提示文件找不到？格式不对？请详细描述具体出现的情况。",
      {
        userGoalText: "用 audience-intelligence 帮我：世界杯周边受众，输出文件",
        latestUserText: "你给的交付物打不开",
      },
    )).toBe(true);
  });

  it("no auto_continue when user action confirmed", () => {
    const blocker = classifyUserActionBlocker({
      assistantText: "请上传附件 docx",
    })!;
    expect(resolveContinuationAction({
      blocker,
      blockerStreak: 3,
      userGoal: "生成PPT",
      planningOrSetupStop: true,
    })).toBe("user_action_required");
  });

  it("weak hint for retry alternate", () => {
    expect(buildRetryAlternateWeakHint({ streak: 2, locale: "zh-CN" })).toMatch(/2\/3/);
  });

  it("direct start does not bypass irreplaceable missing input", () => {
    expect(resolveContinuationAction({
      missingIrreplaceableInput: true,
      directStartRequested: true,
      blockerStreak: 1,
    })).toBe("retry_alternate");

    expect(resolveContinuationAction({
      missingIrreplaceableInput: true,
      directStartRequested: true,
      blockerStreak: 3,
    })).toBe("user_action_required");
  });

  it("auto recovery flag disables deliverable repair", () => {
    expect(resolveContinuationAction({
      userGoal: "生成 Word 文档并报路径",
      validationResult: { verified: [], missing: ["artifacts/brief.docx"], broken: [] },
      autoRecoveryContinueEnabled: false,
    })).toBe("stop");
  });

  it("blocks auto recovery for irreversible side-effect tasks", () => {
    expect(resolveContinuationAction({
      userGoal: "公开发布到小红书并报路径",
      validationResult: { verified: [], missing: ["external:publish"], broken: [] },
      autoRecoveryContinueEnabled: true,
    })).toBe("user_action_required");
  });

  it("classifies ask_user_question as skippable preference or required blocker", () => {
    expect(classifyAskUserQuestionPolicy({
      question: "请选择主视觉风格",
      options: ["清凉国风（推荐）", "现代极简", "按默认方案继续"],
    })).toEqual({
      kind: "preference",
      hasDefaultOption: true,
    });

    expect(classifyAskUserQuestionPolicy({
      question: "请上传源文件后继续",
      options: ["我已上传"],
    }).kind).toBe("required");
  });

  it("shouldAutoBypassPreferenceAskUser: directStart deliverable path", () => {
    const askUserPolicy = classifyAskUserQuestionPolicy({
      question: "请选择报告深度",
      options: ["standard（推荐）", "deep"],
    });
    const goal = "写调研报告，直接开始做，做完告诉我路径";
    expect(shouldAutoBypassPreferenceAskUser({
      userGoal: goal,
      askUserPolicy,
    })).toBe(true);
    expect(resolvePreferenceAskUserBypass({
      userGoal: goal,
      askUserPolicy,
    })).toBe("direct_start");
  });

  it("shouldAutoBypassPreferenceAskUser: nova-research hub try without directStart", () => {
    const askUserPolicy = classifyAskUserQuestionPolicy({
      question: "数据是否充分，是否继续补充来源？",
      options: ["继续补充数据", "数据已充分，开始写报告"],
    });
    const goal =
      "用「Nova-行业市场」写【冷泡茶】市场研究报告：规模、产业链、PEST/SWOT 与进入建议。";
    expect(shouldAutoBypassPreferenceAskUser({
      userGoal: goal,
      capabilitySlug: "nova-research-industry-market",
      askUserPolicy,
    })).toBe(true);
    expect(resolvePreferenceAskUserBypass({
      userGoal: goal,
      capabilitySlug: "nova-research-industry-market",
      askUserPolicy,
    })).toBe("research_deliverable");
    expect(resolveContinuationAction({
      userGoal: goal,
      assistantText: "好的，我来整理冷泡茶行业市场研究报告。先加载技能并启动调研。",
      hadRecentToolSuccess: true,
      capabilitySlug: "nova-research-industry-market",
      autoRecoveryContinueEnabled: true,
    })).toBe("auto_continue_engine");
  });

  it("shouldAutoBypassPreferenceAskUser: required ask_user never bypasses", () => {
    const askUserPolicy = classifyAskUserQuestionPolicy({
      question: "请上传源文件后继续",
      options: ["我已上传"],
    });
    expect(shouldAutoBypassPreferenceAskUser({
      userGoal: "用「Nova-行业市场」写【冷泡茶】市场研究报告",
      capabilitySlug: "nova-research-industry-market",
      askUserPolicy,
    })).toBe(false);
  });

  it("shouldAutoBypassPreferenceAskUser: unrelated chat does not bypass", () => {
    const askUserPolicy = classifyAskUserQuestionPolicy({
      question: "你更偏好哪种语气？",
      options: ["正式", "轻松"],
    });
    expect(shouldAutoBypassPreferenceAskUser({
      userGoal: "聊聊今天天气",
      askUserPolicy,
    })).toBe(false);
  });

  it("T-STOP-01: React programmatic video promise-only reply auto-continues", () => {
    const userGoal = "用「React 程序化视频」搭一个【人工智能用途】视频模板：【要参数化的内容，如标题与数字】，方便批量渲染。";
    const assistantText = "我来创建一个完全参数化的 AI 用途视频模板——支持批量渲染不同标题、数字指标和配色方案。\n可能需要些时间，请稍后";

    expect(userGoalImpliesDeliverable(userGoal)).toBe(true);
    expect(shouldAutoContinueAfterIncompleteDeliverableStop(assistantText, {
      userGoalText: userGoal,
    })).toBe(true);
    expect(resolveContinuationAction({
      userGoal,
      assistantText,
    })).toBe("auto_continue_engine");
  });

  it("T-TERM-01/02: infrastructure abort or tool failure continues deliverable tasks", () => {
    const userGoal = "直接开始做一个 5 页 HTML 落地页，做完告诉我文件在哪";

    expect(shouldAutoContinueAfterTurnOutcome({
      aborted: true,
      userAborted: false,
      userGoalText: userGoal,
      assistantText: "开发服务连接中断，正在自动续跑",
    })).toBe(true);
    expect(shouldAutoContinueAfterTurnOutcome({
      exitCode: 1,
      userGoalText: userGoal,
      assistantText: "工具参数错误",
    })).toBe(true);
  });

  it("T-TERM-01: non-user infrastructure abort continues any deliverable goal", () => {
    expect(shouldAutoContinueAfterTurnOutcome({
      aborted: true,
      userAborted: false,
      userGoalText: "生成一份 Word 调研报告",
      assistantText: "Gateway 连接中断",
    })).toBe(true);
  });

  it("T-TERM-04: user abort remains a terminal whitelist case", () => {
    expect(shouldAutoContinueAfterTurnOutcome({
      aborted: true,
      userAborted: true,
      userGoalText: "生成 PPT 并报路径",
    })).toBe(false);
  });

  it("shouldTriggerDeliverableRepair: acceptance passed hard-blocks repair", () => {
    expect(shouldTriggerDeliverableRepair({
      userGoal: "品牌官网全案交付 html 和 md",
      validationResult: {
        verified: ["artifacts/a/index.html"],
        missing: ["artifacts/a/brief.md"],
        broken: [],
        acceptance: "passed",
      },
    })).toBe(false);
  });

  it("shouldTriggerDeliverableRepair: partial delivery 1 verified + missing", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    expect(shouldTriggerDeliverableRepair({
      userGoal: "品牌官网全案交付 html 和 md",
      validationResult: {
        verified: ["artifacts/a/index.html"],
        missing: ["artifacts/a/brief.md"],
        broken: [],
      },
    })).toBe(true);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("shouldTriggerDeliverableRepair: brainstorm chat-first skips without deliverable signal", () => {
    expect(shouldTriggerDeliverableRepair({
      userGoal: "聊聊 AI 趋势",
      majorCategory: "brainstorming",
      validationResult: { verified: [], missing: ["x.md"], broken: [] },
    })).toBe(false);
  });

  it("ROG Phase5: SDM-only pivot gap does not trigger repair when disk complete", () => {
    process.env.PILOTDECK_GROUND_TRUTH_RECONCILE = "1";
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const userGoal = [
      "1. competitive-brief.md 竞品简报",
      "2. sentiment-notes.md 口碑要点",
    ].join("\n");
    expect(shouldTriggerDeliverableRepair({
      userGoal,
      validationResult: {
        verified: [
          "artifacts/competitive-brief.md",
          "artifacts/sentiment-notes.md",
        ],
        missing: [],
        broken: [],
      },
      sessionManifest: {
        manifestVersion: 2,
        goalVersion: 1,
        sessionGoalAnchor: userGoal,
        slots: [
          { id: "slot_1", label: "competitive-brief.md", pathHint: "competitive-brief.md", required: true, status: "done" },
          { id: "slot_2", label: "sentiment-notes.md", pathHint: "sentiment-notes.md", required: true, status: "done" },
          { id: "pivot_html_2", label: "html", kind: "html", required: true, status: "active" },
        ],
      },
      autoRecoveryContinueEnabled: true,
    })).toBe(false);
    delete process.env.PILOTDECK_GROUND_TRUTH_RECONCILE;
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("ROG: battlecard SDM 1/3 partial triggers deliverable_repair (M1/M4)", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    expect(shouldTriggerDeliverableRepair({
      userGoal: "为【ROG vs 竞品】做销售 Battlecard 全链路，三步一次做完",
      capabilitySlug: "sales-battlecard-full",
      sessionManifest: {
        manifestVersion: 1,
        goalVersion: 1,
        sessionGoalAnchor: "battlecard",
        profileId: "sales_enablement",
        slots: [
          { id: "slot_1", label: "intel.md", pathHint: "intel.md", required: true, status: "done" },
          { id: "slot_2", label: "battlecard.md", pathHint: "battlecard.md", required: true, status: "pending" },
          { id: "slot_3", label: "talk-track.md", pathHint: "talk-track.md", required: true, status: "pending" },
        ],
      },
      validationResult: {
        verified: ["artifacts/sales/rog/intel.md"],
        missing: ["artifacts/sales/rog/battlecard.md", "artifacts/sales/rog/talk-track.md"],
        broken: [],
      },
    })).toBe(true);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("shouldTriggerDeliverableRepair: repair circuit tripped suppresses partialGate", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    expect(shouldTriggerDeliverableRepair({
      userGoal: "GEO 竞品分析",
      sessionManifest: {
        manifestVersion: 3,
        goalVersion: 1,
        sessionGoalAnchor: "GEO",
        profileId: "geo_competitor",
        repairCircuit: { tripped: true, gapCounts: { partial: 3 }, totalRepairs: 6 },
        slots: [
          { id: "slot_1", label: "a.md", pathHint: "a.md", required: true, status: "done" },
          { id: "slot_2", label: "b.md", pathHint: "b.md", required: true, status: "pending" },
        ],
      },
      validationResult: {
        verified: ["artifacts/task/a.md"],
        missing: ["artifacts/task/b.md"],
        broken: [],
      },
    })).toBe(false);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("0717 P1: three-step video 2/3 slots triggers engine deliverable_repair", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const userGoal =
      "用 Seedance 做 10 秒产品演示视频，须交付：1. 视频脚本 .md 2. 分镜说明 .md 3. 成片 .mp4";
    const sessionManifest: SessionDeliverableManifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: userGoal,
      compiledAtTurnId: "t1",
      slots: [
        { id: "slot_script", label: "视频脚本", kind: "markdown", required: true, status: "done" },
        { id: "slot_storyboard", label: "分镜说明", kind: "markdown", required: true, status: "done" },
        { id: "slot_video", label: "成片", kind: "video", required: true, status: "pending" },
      ],
    };
    const validationResult = {
      verified: [
        "artifacts/task-demo/script.md",
        "artifacts/task-demo/storyboard.md",
      ],
      missing: ["artifacts/task-demo/final.mp4"],
      broken: [],
      acceptance: "needs_repair" as const,
    };
    expect(shouldTriggerDeliverableRepair({
      userGoal,
      capabilitySlug: "hf-video-script",
      sessionManifest,
      validationResult,
    })).toBe(true);
    expect(resolveContinuationAction({
      userGoal,
      assistantText: "脚本与分镜已写入任务目录，视频仍在生成。",
      sessionManifest,
      validationResult,
      autoRecoveryContinueEnabled: true,
    })).toBe("deliverable_repair");
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("R8: DUAL + SDM profileId not ppt + md verified does not phantom-ppt repair", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const userGoal = [
      "帮我做知乎选题和一篇长文，主题：企业级 Agent 落地。",
      "须交付：01-topics.md、02-longform.md。",
      "另外做成一份PPT。",
      "写入系统分配任务目录。",
    ].join("\n");
    expect(shouldTriggerDeliverableRepair({
      userGoal,
      sessionManifest: {
        manifestVersion: 1,
        goalVersion: 1,
        sessionGoalAnchor: userGoal,
        profileId: "content_flywheel",
        compiledAtTurnId: "t1",
        slots: [
          { id: "topics", label: "选题", kind: "markdown", required: true, status: "done", pathHint: "01-topics.md" },
          { id: "longform", label: "长文", kind: "markdown", required: true, status: "done", pathHint: "02-longform.md" },
        ],
      },
      validationResult: {
        verified: ["artifacts/task-x/01-topics.md", "artifacts/task-x/02-longform.md"],
        missing: [],
        broken: [],
        acceptance: "passed",
      },
    })).toBe(false);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });
});
