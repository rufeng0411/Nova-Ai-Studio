export type MingdiG700FailureLabel =
  | 'scope_expansion'
  | 'cross_session_artifact'
  | 'passed_with_pending'
  | 'false_incomplete_loop'
  | 'official_media_violation'
  | 'forbidden_generate_image'
  | 'unreachable_hotlink'
  | 'unlabeled_degrade'
  | 'entity_misclassification'
  | 'slide_count_drift'
  | 'output_kind_mismatch'
  | 'deliverable_contract_mismatch'
  | 'content_assertion_failed'
  | 'snapshot_missing';

type DeliverableStatus = 'done' | 'pending' | 'missing';

export interface MingdiG700CaseFixture {
  id: string;
  sanitizedGoal: string;
  exportBasename: string;
  expectedFiles: Array<{
    basename: string;
    kind: string;
    required: boolean;
  }>;
  qualityContract: {
    snapshotRequired: true;
    scopeGuardBasenames?: string[];
    crossSessionSignatures?: string[];
    officialMediaOnly?: boolean;
    officialMediaEvidenceRequired?: boolean;
    forbidGenerateImage?: boolean;
    expectedSlideCount?: number;
    requiredOutputKindGroups?: string[][];
    requiredTableBasenames?: string[];
    forbiddenEntityTerms?: string[];
    contentAssertionForbiddenPatterns?: string[];
  };
  structureEvidence: {
    deliverableRows: Array<{
      label: string;
      status: DeliverableStatus;
      basename: string | null;
    }>;
    toolCalls: Record<string, number>;
    snapshotPresent: boolean;
    completionClaim: boolean;
    crossSessionArtifactCount: number;
    falseIncompleteSignals: number;
    unreachableHotlinkCount: number;
    syntheticPlaceholderCount: number;
    degradeDisclosed: boolean;
    entityMisclassificationCount: number;
    observedContractSlideCount: number | null;
    outputKinds: string[];
    contentAssertionFailures: number;
    officialMediaProvenanceComplete: boolean;
  };
  expectedFailureLabels: MingdiG700FailureLabel[];
}

export const MINGDI_G700_20260718_CASES: MingdiG700CaseFixture[] = [
  {
    id: 'strategy',
    sanitizedGoal: '使用 strategy-advisor 协助分析鸣镝 G700。',
    exportBasename: 'web-s_02c1951f-c042-4824-8eec-358822552f__用「strategy-advisor」帮我：【鸣镝G700】。-2026-07-18.html',
    expectedFiles: [],
    qualityContract: {
      snapshotRequired: true,
    },
    structureEvidence: {
      deliverableRows: [
        { label: 'strategy report', status: 'pending', basename: null },
      ],
      toolCalls: {},
      snapshotPresent: false,
      completionClaim: true,
      crossSessionArtifactCount: 1,
      falseIncompleteSignals: 1,
      unreachableHotlinkCount: 0,
      syntheticPlaceholderCount: 0,
      degradeDisclosed: false,
      entityMisclassificationCount: 0,
      observedContractSlideCount: null,
      outputKinds: [],
      contentAssertionFailures: 0,
      officialMediaProvenanceComplete: false,
    },
    expectedFailureLabels: [
      'scope_expansion',
      'cross_session_artifact',
      'passed_with_pending',
      'false_incomplete_loop',
      'snapshot_missing',
    ],
  },
  {
    id: 'geo-plan',
    sanitizedGoal: '执行鸣镝 G700 品牌 GEO 全案；内容配图必须来自品牌或联名方官方渠道。',
    exportBasename: 'web-s_07d0636c-0668-4aa3-9f2e-1008acd51a__帮【鸣镝G700】做品牌 GEO 全案，按阶段一次执行，存 系统分配的任务目录 每阶段报路径。核心优-2026-07-18.html',
    expectedFiles: [
      { basename: 'geo-aeo-audit-checklist.md', kind: 'md', required: true },
      { basename: 'keywords-research.md', kind: 'md', required: true },
      { basename: 'zhihu-article.md', kind: 'md', required: true },
      { basename: 'xiaohongshu-article.md', kind: 'md', required: true },
      { basename: 'wechat-article.md', kind: 'md', required: true },
      { basename: 'optimized.md', kind: 'md', required: true },
      { basename: 'schema.jsonld', kind: 'jsonld', required: true },
      { basename: 'citability-report.md', kind: 'md', required: true },
      { basename: 'visibility-report.html', kind: 'html', required: true },
    ],
    qualityContract: {
      snapshotRequired: true,
      officialMediaOnly: true,
      officialMediaEvidenceRequired: true,
      forbidGenerateImage: true,
    },
    structureEvidence: {
      deliverableRows: [
        { label: 'GEO 审计清单', status: 'done', basename: 'geo-aeo-audit-checklist.md' },
        { label: '关键词研究', status: 'done', basename: 'keywords-research.md' },
        { label: '知乎文章', status: 'done', basename: 'zhihu-article.md' },
        { label: '小红书文章', status: 'done', basename: 'xiaohongshu-article.md' },
        { label: '公众号文章', status: 'done', basename: 'wechat-article.md' },
        { label: '优化稿', status: 'done', basename: 'optimized.md' },
        { label: '结构化数据', status: 'done', basename: 'schema.jsonld' },
        { label: '可引用性报告', status: 'done', basename: 'citability-report.md' },
        { label: '可见度报告', status: 'done', basename: 'visibility-report.html' },
      ],
      toolCalls: { generate_image: 6 },
      snapshotPresent: false,
      completionClaim: true,
      crossSessionArtifactCount: 0,
      falseIncompleteSignals: 0,
      unreachableHotlinkCount: 0,
      syntheticPlaceholderCount: 2,
      degradeDisclosed: true,
      entityMisclassificationCount: 0,
      observedContractSlideCount: null,
      outputKinds: ['md', 'html', 'jsonld'],
      contentAssertionFailures: 0,
      officialMediaProvenanceComplete: false,
    },
    expectedFailureLabels: [
      'official_media_violation',
      'forbidden_generate_image',
      'snapshot_missing',
    ],
  },
  {
    id: 'geo-keywords',
    sanitizedGoal: '整理鸣镝 G700 的 20 个 AI 搜索核心词与常见问句，并输出 MD 与 HTML。',
    exportBasename: 'web-s_4445346c-be62-442a-9df4-962e1fe1ae__用「GEO挖词」为【鸣镝G700】整理 AI 搜索关键词：20 个核心词与用户常问句式。须交付：ke-2026-07-18.html',
    expectedFiles: [
      { basename: 'keywords.md', kind: 'md', required: true },
      { basename: 'keywords.html', kind: 'html', required: true },
    ],
    qualityContract: {
      snapshotRequired: true,
      requiredOutputKindGroups: [['md'], ['html']],
    },
    structureEvidence: {
      deliverableRows: [
        { label: '关键词报告', status: 'done', basename: 'keywords.md' },
        { label: '关键词可视化报告', status: 'done', basename: 'keywords.html' },
      ],
      toolCalls: {},
      snapshotPresent: false,
      completionClaim: true,
      crossSessionArtifactCount: 0,
      falseIncompleteSignals: 0,
      unreachableHotlinkCount: 0,
      syntheticPlaceholderCount: 0,
      degradeDisclosed: false,
      entityMisclassificationCount: 0,
      observedContractSlideCount: null,
      outputKinds: ['md', 'html'],
      contentAssertionFailures: 0,
      officialMediaProvenanceComplete: false,
    },
    expectedFailureLabels: ['snapshot_missing'],
  },
  {
    id: 'last30days',
    sanitizedGoal: '使用近 30 天调研能力，仅交付一份结构化营销报告。',
    exportBasename: 'web-s_48f8fe77-6038-48a9-bf2e-8a19921494__用「last30days」帮我：【鸣镝G700】。须交付：marketing-deliverable-2026-07-18.html',
    expectedFiles: [
      { basename: 'marketing-deliverable-2026-07-18.html', kind: 'html', required: true },
    ],
    qualityContract: {
      snapshotRequired: true,
      scopeGuardBasenames: ['01-topics.md', '02-longform.md', '03-social-slices.md'],
      crossSessionSignatures: ['campaign-brief.docx', 'key-visual-poster.png'],
    },
    structureEvidence: {
      deliverableRows: [
        { label: '营销报告', status: 'pending', basename: null },
        { label: '选题', status: 'done', basename: '01-topics.md' },
        { label: '长文', status: 'done', basename: '02-longform.md' },
        { label: '社媒切片', status: 'done', basename: '03-social-slices.md' },
        { label: '传播简报', status: 'done', basename: 'campaign-brief.docx' },
        { label: '主视觉', status: 'done', basename: 'key-visual-poster.png' },
      ],
      toolCalls: {},
      snapshotPresent: false,
      completionClaim: false,
      crossSessionArtifactCount: 2,
      falseIncompleteSignals: 0,
      unreachableHotlinkCount: 0,
      syntheticPlaceholderCount: 0,
      degradeDisclosed: true,
      entityMisclassificationCount: 0,
      observedContractSlideCount: null,
      outputKinds: ['md', 'html', 'docx', 'png'],
      contentAssertionFailures: 0,
      officialMediaProvenanceComplete: false,
    },
    expectedFailureLabels: [
      'scope_expansion',
      'cross_session_artifact',
      'deliverable_contract_mismatch',
      'snapshot_missing',
    ],
  },
  {
    id: 'nova-slides',
    sanitizedGoal: '将鸣镝 G700 制作为 6 页 16:9 PNG 幻灯；图片必须使用官方素材。',
    exportBasename: 'web-s_4f8c2015-0551-42d0-8662-6e5b4c6384__用「Nova-美学幻灯」把【鸣镝G700】做成【6】页【画幅，如 16_9】，图要来官方，配图 PN-2026-07-18.html',
    expectedFiles: [
      { basename: 'slide-01.png', kind: 'png', required: true },
      { basename: 'slide-02.png', kind: 'png', required: true },
      { basename: 'slide-03.png', kind: 'png', required: true },
      { basename: 'slide-04.png', kind: 'png', required: true },
      { basename: 'slide-05.png', kind: 'png', required: true },
      { basename: 'slide-06.png', kind: 'png', required: true },
      { basename: 'slide-manifest.json', kind: 'json', required: true },
    ],
    qualityContract: {
      snapshotRequired: true,
      officialMediaOnly: true,
      officialMediaEvidenceRequired: true,
      forbidGenerateImage: true,
      expectedSlideCount: 6,
      requiredOutputKindGroups: [['png'], ['json']],
    },
    structureEvidence: {
      deliverableRows: [
        { label: '第 1 页', status: 'done', basename: 'slide-05.png' },
        { label: '第 2 页', status: 'done', basename: 'slide-02.png' },
        { label: '第 3 页', status: 'done', basename: 'slide-03.png' },
        { label: '第 4 页', status: 'done', basename: 'slide-04.png' },
        { label: '第 5 页', status: 'done', basename: 'slide-05.png' },
        { label: '第 6 页', status: 'done', basename: 'slide-06.png' },
        { label: '第 7 页', status: 'missing', basename: null },
        { label: '第 8 页', status: 'missing', basename: null },
        { label: '第 9 页', status: 'missing', basename: null },
        { label: '第 10 页', status: 'missing', basename: null },
        { label: '清单', status: 'done', basename: 'slide-manifest.json' },
      ],
      toolCalls: { generate_image: 14 },
      snapshotPresent: false,
      completionClaim: true,
      crossSessionArtifactCount: 0,
      falseIncompleteSignals: 1,
      unreachableHotlinkCount: 0,
      syntheticPlaceholderCount: 0,
      degradeDisclosed: false,
      entityMisclassificationCount: 0,
      observedContractSlideCount: 10,
      outputKinds: ['png', 'json'],
      contentAssertionFailures: 1,
      officialMediaProvenanceComplete: false,
    },
    expectedFailureLabels: [
      'false_incomplete_loop',
      'official_media_violation',
      'forbidden_generate_image',
      'slide_count_drift',
      'deliverable_contract_mismatch',
      'content_assertion_failed',
      'snapshot_missing',
    ],
  },
  {
    id: 'product-research',
    sanitizedGoal: '按固定八章输出鸣镝 G700 产品用户研究 HTML，图片必须来自官方渠道。',
    exportBasename: 'web-s_5874e249-e8fd-4329-a33b-02184a4013__用「Nova-产品用研」为【鸣镝G700】写产品用户研究报告，按固定八章展开。须交付：product-2026-07-18.html',
    expectedFiles: [
      { basename: 'product-2026-07-18.html', kind: 'html', required: true },
    ],
    qualityContract: {
      snapshotRequired: true,
      officialMediaOnly: true,
      officialMediaEvidenceRequired: true,
      forbidGenerateImage: true,
    },
    structureEvidence: {
      deliverableRows: [
        { label: '用户研究报告', status: 'done', basename: 'product-user-research.md' },
        { label: 'HTML 网页', status: 'missing', basename: null },
        { label: 'HTML 网页', status: 'missing', basename: null },
      ],
      toolCalls: {},
      snapshotPresent: false,
      completionClaim: false,
      crossSessionArtifactCount: 0,
      falseIncompleteSignals: 0,
      unreachableHotlinkCount: 0,
      syntheticPlaceholderCount: 0,
      degradeDisclosed: false,
      entityMisclassificationCount: 0,
      observedContractSlideCount: null,
      outputKinds: ['md'],
      contentAssertionFailures: 0,
      officialMediaProvenanceComplete: false,
    },
    expectedFailureLabels: [
      'scope_expansion',
      'official_media_violation',
      'output_kind_mismatch',
      'deliverable_contract_mismatch',
      'snapshot_missing',
    ],
  },
  {
    id: 'gsap',
    sanitizedGoal: '为鸣镝 G700 页面或视频添加 GSAP 动效，交付视频或分镜。',
    exportBasename: 'web-s_65e12eef-71ba-43e4-8ad4-e29aed8717__用「GSAP 动画模式库」给我的页面或视频加动效：【鸣镝G700】。须交付：视频或分镜 md_mp4-2026-07-18.html',
    expectedFiles: [
      { basename: 'mingdi-G700-demo.mp4', kind: 'mp4', required: true },
    ],
    qualityContract: {
      snapshotRequired: true,
      requiredOutputKindGroups: [['mp4', 'md']],
    },
    structureEvidence: {
      deliverableRows: [
        { label: '动效视频', status: 'done', basename: 'mingdi-G700-demo.mp4' },
        { label: '动效页面', status: 'done', basename: 'index.html' },
      ],
      toolCalls: { generate_video: 1, render_html_video: 7, generate_image: 2 },
      snapshotPresent: false,
      completionClaim: true,
      crossSessionArtifactCount: 0,
      falseIncompleteSignals: 0,
      unreachableHotlinkCount: 0,
      syntheticPlaceholderCount: 0,
      degradeDisclosed: false,
      entityMisclassificationCount: 0,
      observedContractSlideCount: null,
      outputKinds: ['mp4', 'html'],
      contentAssertionFailures: 0,
      officialMediaProvenanceComplete: false,
    },
    expectedFailureLabels: ['scope_expansion', 'snapshot_missing'],
  },
  {
    id: 'campaign',
    sanitizedGoal: '执行鸣镝 G700 品牌传播全案；后续明确要求将非官方配图替换为真实官方素材。',
    exportBasename: 'web-s_748644ab-b9a0-417f-bc60-20d35466d6__帮我做【鸣镝G700】的品牌传播 campaign 全案，按阶段一次规划执行，产出存系统分配的任务目-2026-07-18.html',
    expectedFiles: [
      { basename: 'research-report.md', kind: 'md', required: true },
      { basename: 'campaign-brief.docx', kind: 'docx', required: true },
      { basename: 'key-visual-poster.png', kind: 'png', required: true },
      { basename: '03-social-slices.md', kind: 'md', required: true },
      { basename: 'draft-status.md', kind: 'md', required: true },
      { basename: 'monitoring-template.md', kind: 'md', required: true },
    ],
    qualityContract: {
      snapshotRequired: true,
      officialMediaOnly: true,
      officialMediaEvidenceRequired: true,
      forbidGenerateImage: true,
      forbiddenEntityTerms: ['空气净化器'],
    },
    structureEvidence: {
      deliverableRows: [
        { label: '调研报告', status: 'done', basename: 'research-report.md' },
        { label: '传播简报', status: 'done', basename: 'campaign-brief.docx' },
        { label: '主视觉', status: 'done', basename: 'key-visual-poster.png' },
        { label: '社媒切片', status: 'done', basename: '03-social-slices.md' },
        { label: '草稿状态', status: 'done', basename: 'draft-status.md' },
        { label: '监测模板', status: 'done', basename: 'monitoring-template.md' },
      ],
      toolCalls: { generate_image: 5 },
      snapshotPresent: false,
      completionClaim: true,
      crossSessionArtifactCount: 0,
      falseIncompleteSignals: 0,
      unreachableHotlinkCount: 0,
      syntheticPlaceholderCount: 2,
      degradeDisclosed: true,
      entityMisclassificationCount: 1,
      observedContractSlideCount: null,
      outputKinds: ['md', 'docx', 'png'],
      contentAssertionFailures: 0,
      officialMediaProvenanceComplete: false,
    },
    expectedFailureLabels: [
      'official_media_violation',
      'forbidden_generate_image',
      'entity_misclassification',
      'snapshot_missing',
    ],
  },
  {
    id: 'html-slides',
    sanitizedGoal: '制作鸣镝 G700 的 10 页横版 HTML 幻灯与越野指南；只用官方图片且禁止 AI 生图。',
    exportBasename: 'web-s_8d833e67-3cb8-43b8-b3c7-1df6637466__做《鸣镝G700》详细介绍+科学分解图+越野指南风格的HTML 幻灯：图片无比来自顶火和捷途官方或者-2026-07-18.html',
    expectedFiles: [
      { basename: 'index.html', kind: 'html', required: true },
    ],
    qualityContract: {
      snapshotRequired: true,
      officialMediaOnly: true,
      officialMediaEvidenceRequired: true,
      forbidGenerateImage: true,
      expectedSlideCount: 10,
      requiredOutputKindGroups: [['html']],
      contentAssertionForbiddenPatterns: ['665\\s*kW'],
    },
    structureEvidence: {
      deliverableRows: [
        { label: 'HTML 幻灯', status: 'done', basename: 'index.html' },
        { label: '附加演示文档', status: 'done', basename: '鸣镝G700-顶火鸣镝版-官方介绍与越野指南.pptx' },
        { label: '附加研究报告', status: 'done', basename: '鸣镝G700-顶火鸣镝版-全解报告.md' },
        { label: '附加演示文档', status: 'pending', basename: null },
      ],
      toolCalls: {},
      snapshotPresent: false,
      completionClaim: true,
      crossSessionArtifactCount: 0,
      falseIncompleteSignals: 1,
      unreachableHotlinkCount: 0,
      syntheticPlaceholderCount: 0,
      degradeDisclosed: false,
      entityMisclassificationCount: 0,
      observedContractSlideCount: 10,
      outputKinds: ['html', 'pptx', 'md'],
      contentAssertionFailures: 1,
      officialMediaProvenanceComplete: false,
    },
    expectedFailureLabels: [
      'scope_expansion',
      'passed_with_pending',
      'false_incomplete_loop',
      'official_media_violation',
      'content_assertion_failed',
      'snapshot_missing',
    ],
  },
  {
    id: 'remotion',
    sanitizedGoal: '使用 Remotion 最佳实践为鸣镝 G700 生产可播放视频成果。',
    exportBasename: 'web-s_b088d379-9cb6-487d-9209-29a73b2587__用「Remotion 最佳实践」帮我：【鸣镝G700】。-2026-07-18.html',
    expectedFiles: [
      { basename: 'mingdi-g700.mp4', kind: 'mp4', required: true },
    ],
    qualityContract: {
      snapshotRequired: true,
      requiredOutputKindGroups: [['mp4']],
    },
    structureEvidence: {
      deliverableRows: [
        { label: 'Remotion 入口', status: 'done', basename: 'root.tsx' },
        { label: '工程配置', status: 'done', basename: 'package.json' },
        { label: '预览页面', status: 'done', basename: 'preview.html' },
      ],
      toolCalls: {},
      snapshotPresent: false,
      completionClaim: true,
      crossSessionArtifactCount: 0,
      falseIncompleteSignals: 0,
      unreachableHotlinkCount: 0,
      syntheticPlaceholderCount: 0,
      degradeDisclosed: false,
      entityMisclassificationCount: 0,
      observedContractSlideCount: null,
      outputKinds: ['tsx', 'json', 'html'],
      contentAssertionFailures: 0,
      officialMediaProvenanceComplete: false,
    },
    expectedFailureLabels: [
      'scope_expansion',
      'output_kind_mismatch',
      'deliverable_contract_mismatch',
      'snapshot_missing',
    ],
  },
  {
    id: 'website',
    sanitizedGoal: '制作鸣镝 G700 全屏品牌官网；车辆图片必须来自品牌或联名方官方渠道。',
    exportBasename: 'web-s_b7b9f02b-5ad6-4b57-b09f-f7a1518196__帮【鸣镝G700】做品牌官网，图片需要来自顶火和捷途官方或者官方小红书（ins）等，技术要使用最新的-2026-07-18.html',
    expectedFiles: [
      { basename: 'index.html', kind: 'html', required: true },
    ],
    qualityContract: {
      snapshotRequired: true,
      officialMediaOnly: true,
      officialMediaEvidenceRequired: true,
      forbidGenerateImage: true,
      requiredOutputKindGroups: [['html']],
    },
    structureEvidence: {
      deliverableRows: [
        { label: '品牌官网', status: 'done', basename: 'index.html' },
      ],
      toolCalls: {},
      snapshotPresent: false,
      completionClaim: false,
      crossSessionArtifactCount: 0,
      falseIncompleteSignals: 0,
      unreachableHotlinkCount: 1,
      syntheticPlaceholderCount: 1,
      degradeDisclosed: false,
      entityMisclassificationCount: 0,
      observedContractSlideCount: null,
      outputKinds: ['html'],
      contentAssertionFailures: 0,
      officialMediaProvenanceComplete: false,
    },
    expectedFailureLabels: [
      'official_media_violation',
      'unreachable_hotlink',
      'unlabeled_degrade',
      'snapshot_missing',
    ],
  },
];
