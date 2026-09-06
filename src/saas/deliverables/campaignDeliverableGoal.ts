// PD-SAAS-FORK: browser-safe campaign goal detection + SDM slot templates (no node/fs).
import type { SessionDeliverableSlot } from "../taskState/sessionDeliverableManifest.js";

const CAMPAIGN_FULL_CASE_GOAL =
  /(?:campaign|品牌传播|传播\s*brief|mkt-campaign|营销全案|campaign\s*全案)/i;
const CAMPAIGN_PHASE_MARKERS =
  /(?:调研|策划|brief|主视觉|多平台|发布|监测|docx|\.docx|platform-content|visual-kv|阶段|一次规划|全案)/i;

const CAMPAIGN_WEBSITE_PHASE_GOAL =
  /(?:世界杯|world\s*cup|worldcup|官方网站|官网落地|05-website|stage_website|index\.html)/i;

const STANDARD_DELIVERABLE_CHECKLIST_HEADER =
  /标准成果清单|standard\s+deliverables/i;

export function isCampaignFullCaseGoal(userGoal: string): boolean {
  const goal = String(userGoal || "");
  if (!goal.trim()) return false;
  return CAMPAIGN_FULL_CASE_GOAL.test(goal) && CAMPAIGN_PHASE_MARKERS.test(goal);
}

export function isBrandCampaignFullCaseGoal(userGoal: string): boolean {
  const goal = String(userGoal || "").trim();
  if (!isCampaignFullCaseGoal(goal)) return false;
  if (STANDARD_DELIVERABLE_CHECKLIST_HEADER.test(goal)) return true;
  if (CAMPAIGN_WEBSITE_PHASE_GOAL.test(goal)) return false;
  if (/^\s*\d+[.、)]\s*[^\n]*(?:官网|官方网站|index\.html)/im.test(goal)) return false;
  if (/(?:品牌传播\s*campaign|campaign\s*全案)/i.test(goal) && /(?:一次规划|各阶段)/i.test(goal)) {
    return true;
  }
  return true;
}

export function isWorldcupCampaignFullCaseGoal(userGoal: string): boolean {
  return isCampaignFullCaseGoal(userGoal) && !isBrandCampaignFullCaseGoal(userGoal);
}

export function extractStandardDeliverableChecklistSection(userGoal: string): string {
  const text = String(userGoal ?? "");
  const idx = text.search(STANDARD_DELIVERABLE_CHECKLIST_HEADER);
  if (idx < 0) return text;
  return text.slice(idx);
}

export function buildCampaignSdmSlots(): SessionDeliverableSlot[] {
  return buildBrandCampaignSdmSlots().map((slot) => {
    if (slot.stageId === "research") return slot;
    return {
      ...slot,
      parallelGroup: "campaign-independent",
      stageId: "stage_parallel_writes",
    };
  });
}

export function buildWorldcupCampaignSdmSlots(): SessionDeliverableSlot[] {
  return [
    { id: "stage_research", label: "调研", kind: "markdown", required: true, stageId: "research", stageOrder: 1, status: "active" },
    { id: "stage_plan_html", label: "Campaign 策划 HTML", kind: "html", required: true, stageId: "plan", stageOrder: 2, status: "pending" },
    { id: "stage_brief", label: "传播 brief", kind: "markdown", required: true, stageId: "brief", stageOrder: 3, status: "pending", pathHint: "brief.md" },
    { id: "stage_main_visual", label: "主视觉海报", kind: "image", required: true, stageId: "visual", stageOrder: 4, status: "pending" },
    { id: "stage_website", label: "官方网站", kind: "html", required: true, stageId: "website", stageOrder: 5, status: "pending", pathHint: "index.html" },
    { id: "stage_platform", label: "多平台内容", kind: "markdown", required: true, stageId: "platform", stageOrder: 6, status: "pending" },
    { id: "stage_draft", label: "平台草稿", kind: "markdown", required: true, stageId: "draft", stageOrder: 7, status: "pending" },
    { id: "stage_monitoring", label: "监测复盘", kind: "markdown", required: true, stageId: "monitoring", stageOrder: 8, status: "pending" },
  ];
}

const BRAND_STAGE_IDS = ["research", "brief", "visual", "platform", "draft", "monitoring"] as const;

export function buildBrandCampaignSdmSlots(): SessionDeliverableSlot[] {
  return [
    {
      id: "brand_research",
      label: "调研",
      kind: "markdown",
      required: true,
      stageId: "research",
      stageOrder: 1,
      status: "active",
      pathHint: "research-report.md",
      pathHints: ["research-report.md", "research.md", "01-research.md"],
    },
    {
      id: "brand_brief",
      label: "传播 brief",
      kind: "docx",
      required: true,
      stageId: "brief",
      stageOrder: 2,
      status: "pending",
      pathHint: "campaign-brief.docx",
      pathHints: ["campaign-brief.docx", "brief.docx"],
    },
    {
      id: "brand_visual",
      label: "主视觉海报",
      kind: "image",
      required: true,
      stageId: "visual",
      stageOrder: 3,
      status: "pending",
      pathHints: ["key-visual-poster.png", "key-visual-poster.html", "poster.png", "04-visual-kv.png"],
    },
    {
      id: "brand_platform",
      label: "社媒包",
      kind: "markdown",
      required: true,
      stageId: "platform",
      stageOrder: 4,
      status: "pending",
      pathHints: ["03-social-slices.md", "copy-matrix.md", "platform-content.md", "06-platform-content.md"],
    },
    {
      id: "brand_draft",
      label: "草稿编号",
      kind: "markdown",
      required: true,
      stageId: "draft",
      stageOrder: 5,
      status: "pending",
      pathHints: ["draft-status.md", "draft-manifest.json"],
    },
    {
      id: "brand_monitoring",
      label: "监测模板",
      kind: "markdown",
      required: true,
      stageId: "monitoring",
      stageOrder: 6,
      status: "pending",
      pathHint: "monitoring-template.md",
      pathHints: ["monitoring-template.md", "monitoring.md", "08-monitoring.md"],
    },
  ];
}

export function mapBrandChecklistSlots(slots: SessionDeliverableSlot[]): SessionDeliverableSlot[] {
  return slots.map((slot, index) => {
    const stageId = BRAND_STAGE_IDS[index] ?? `stage_${index + 1}`;
    return {
      ...slot,
      id: `brand_${stageId}`,
      stageId,
      stageOrder: index + 1,
      required: true,
      status: index === 0 ? "active" : (slot.status ?? "pending"),
    };
  });
}

export function resolveCampaignSdmSlots(input: {
  userGoal: string;
  parseNumberedList: (goal: string) => SessionDeliverableSlot[];
}): SessionDeliverableSlot[] {
  if (!isCampaignFullCaseGoal(input.userGoal)) return [];
  if (isBrandCampaignFullCaseGoal(input.userGoal)) {
    const checklist = extractStandardDeliverableChecklistSection(input.userGoal);
    const parsed = input.parseNumberedList(checklist);
    if (parsed.length >= 6) {
      return mapBrandChecklistSlots(parsed);
    }
    return buildBrandCampaignSdmSlots();
  }
  return buildWorldcupCampaignSdmSlots();
}
