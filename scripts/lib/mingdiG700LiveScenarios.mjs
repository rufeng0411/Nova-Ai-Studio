/**
 * PD-SAAS-FORK P0-10: Mingdi G700 live Gateway scenario definitions.
 */
export const MINGDI_G700_LIVE_SCENARIOS = [
  {
    id: 'brand-website-official-media',
    title: '品牌官网官方素材本地化',
    capabilitySlug: 'hub-pack-brand-website',
    message:
      '用「品牌官网全案」为【鸣镝 G700】做官网落地页。配图必须来自品牌或联名方官方渠道并本地化，禁止 generate_image。须交付：index.html。写入系统分配任务目录。',
    timeoutMs: 720_000,
  },
  {
    id: 'nova-slides-6-official',
    title: 'Nova 6 页官方幻灯',
    capabilitySlug: 'nova-ppt-aesthetic-slides',
    message:
      '用「Nova-美学幻灯」把【鸣镝 G700】做成 6 页 16:9 PNG 幻灯，素材仅来自官方渠道，禁止 generate_image。须交付：slide-NN.png、slide-manifest.json。写入系统分配任务目录。',
    timeoutMs: 900_000,
    expectedSlideCount: 6,
  },
  {
    id: 'last30days-single-artifact',
    title: 'last30days 单成果',
    capabilitySlug: 'mkt-last30days',
    message:
      '用「last30days」帮我：【鸣镝 G700】。须交付：marketing-deliverable-2026-07-18.html（唯一成果，不要 01/02/03 多文件）。写入系统分配任务目录。',
    timeoutMs: 720_000,
    singleDeliverableBasename: 'marketing-deliverable-2026-07-18.html',
    forbiddenBasenames: ['01-topics.md', '02-longform.md', '03-social-slices.md'],
  },
  {
    id: 'strategy-consultation',
    title: 'strategy consultation',
    capabilitySlug: 'ala-strategy-advisor',
    completionMode: 'consultation',
    message:
      '用「strategy-advisor」帮我分析【鸣镝 G700】市场定位与竞争格局，仅聊天咨询，不要 write_file 或生成交付文件。',
    timeoutMs: 300_000,
    expectNoDeliverables: true,
  },
  {
    id: 'strategy-report',
    title: 'strategy report',
    capabilitySlug: 'ala-strategy-advisor',
    completionMode: 'report',
    message:
      '用「strategy-advisor」为【鸣镝 G700】写策略分析报告。须交付：strategy-report.md。写入系统分配任务目录。',
    timeoutMs: 600_000,
  },
  {
    id: 'product-user-research',
    title: '产品用研八章与来源引用',
    capabilitySlug: 'nova-research-product-user',
    message:
      '用「Nova-产品用研」为【鸣镝 G700】写产品用户研究报告，按固定八章展开并附来源引用。须交付：product-2026-07-18.html。写入系统分配任务目录。',
    timeoutMs: 900_000,
  },
  {
    id: 'campaign-full-subject',
    title: 'Campaign 完整主体',
    capabilitySlug: 'brand-campaign-full',
    message:
      '帮【鸣镝 G700】做品牌传播 Campaign 全案（调研→策划→brief→主视觉→多平台内容），主体必须是鸣镝 G700，配图来自官方渠道。按阶段写入系统分配任务目录并汇报路径。',
    timeoutMs: 900_000,
    requireLocalizedOfficialImages: 1,
  },
  // PD-SAAS-FORK VAP: 2026-07-19 five-case visual subset (P1-C live KPI).
  {
    id: 'nova-slides-official-20260719',
    title: 'Nova 8 页官网配图（0719）',
    capabilitySlug: 'nova-ppt-aesthetic-slides',
    displayName: 'Nova 美学幻灯',
    message:
      '用「Nova-美学幻灯」把【G700】做成【8】页【16:9】，图和资料要来自官网：https://zongheng.chery.cn/vehicle/g700-refit。须交付 slide-01..08 与 slide-manifest.json。写入系统分配任务目录。',
    timeoutMs: 900_000,
    expectedSlideCount: 8,
    requireLocalizedOfficialImages: 1,
    forbidGenerateImageCalls: true,
  },
  {
    id: 'html-demo-official-20260719',
    title: 'HTML 演示官网资料（0719）',
    capabilitySlug: 'html-ppt-skill',
    displayName: 'HTML 演示',
    message:
      '用「HTML 演示」做【8】页【G700】动画演示：图和资料要来自官网：https://zongheng.chery.cn/vehicle/g700-refit。写入系统分配任务目录。',
    timeoutMs: 900_000,
    requireLocalizedOfficialImages: 1,
    forbidGenerateImageCalls: true,
  },
  {
    id: 'campaign-official-20260719',
    title: 'Campaign 全案官网配图（0719）',
    capabilitySlug: 'brand-campaign-full',
    displayName: '品牌传播全案',
    message:
      '帮我做【纵横-鸣镝G700】的品牌传播 campaign 全案，图和资料优先来自官网 https://zongheng.chery.cn/。按阶段写入系统分配任务目录。',
    timeoutMs: 900_000,
    requireLocalizedOfficialImages: 1,
    forbidGenerateImageCalls: true,
  },
];

export function evaluateLiveScenarioKpis(scenario, result) {
  const toolCalls = result.toolCalls ?? {};
  const kpis = {
    false_complete: 0,
    false_incomplete: 0,
    passed_with_pending: 0,
    scope_expansion: 0,
    cross_session_artifact: 0,
    forbidden_generate_image: 0,
    slide_count_drift: 0,
    missing_localized_official: 0,
    previewBrokenImages: 0,
    resolve_session_visual_assets: toolCalls.resolve_session_visual_assets ?? 0,
  };
  const writePaths = Array.isArray(result.toolWritePaths) ? result.toolWritePaths : [];
  const basenames = writePaths.map((p) => p.replace(/\\/g, '/').split('/').pop() ?? '');
  const status = String(result.acceptanceStatus ?? '').toLowerCase();

  if (!scenario.expectNoDeliverables) {
    if (!result.turnCompleted) {
      kpis.false_incomplete = 1;
    } else if (writePaths.length === 0 && status !== 'passed') {
      kpis.false_incomplete = 1;
    }
  }
  if (scenario.expectNoDeliverables && writePaths.length > 0) {
    kpis.scope_expansion = 1;
  }

  if (result.durationMs != null && result.durationMs < 10_000 && !scenario.expectNoDeliverables) {
    kpis.false_incomplete = 1;
  }

  // Official-media / visual cases: any generate_image counts as forbidden.
  // Consultation / non-visual scenarios may still use generate_image without this KPI.
  if (
    (toolCalls.generate_image ?? 0) > 0
    && (
      scenario.forbidGenerateImageCalls
      || scenario.requireLocalizedOfficialImages
      || /官方|官网/u.test(String(scenario.message ?? ""))
    )
  ) {
    kpis.forbidden_generate_image = 1;
  }

  if (scenario.requireLocalizedOfficialImages) {
    const localized = writePaths.filter((p) =>
      /assets\/(?:raw|prepared)\//i.test(String(p).replace(/\\/g, '/'))
      || /visual-asset-manifest\.json$/i.test(String(p))
    ).length;
    const fetchHits = (toolCalls.fetch_page_images ?? 0)
      + (toolCalls.fetch_media_asset ?? 0)
      + (toolCalls.resolve_session_visual_assets ?? 0)
      + (toolCalls.discover_visual_assets ?? 0);
    if (localized < scenario.requireLocalizedOfficialImages && fetchHits < 1) {
      kpis.missing_localized_official = 1;
    }
  }

  if (scenario.forbiddenBasenames?.length) {
    const hits = scenario.forbiddenBasenames.filter((name) => basenames.includes(name));
    if (hits.length > 0) kpis.scope_expansion += hits.length;
  }

  if (scenario.expectedSlideCount) {
    const slideCount = basenames.filter((name) => /^slide-\d+\.png$/i.test(name)).length;
    if (slideCount > 0 && slideCount !== scenario.expectedSlideCount) {
      kpis.slide_count_drift = 1;
    }
  }

  if (status === 'passed' && (result.acceptanceFailureReasons?.length ?? 0) > 0) {
    kpis.false_complete = 1;
  }
  if (status === 'needs_repair' || status === 'incomplete') {
    kpis.passed_with_pending = 1;
  }
  if (!result.ok && !result.timeout && status !== 'passed') {
    kpis.false_incomplete = 1;
  }
  if (result.timeout) {
    kpis.false_incomplete = 1;
  }

  return kpis;
}

export function aggregateLiveKpis(scenarioResults) {
  const totals = {
    false_complete: 0,
    false_incomplete: 0,
    passed_with_pending: 0,
    scope_expansion: 0,
    cross_session_artifact: 0,
    forbidden_generate_image: 0,
    slide_count_drift: 0,
    missing_localized_official: 0,
    previewBrokenImages: 0,
    resolve_session_visual_assets: 0,
  };
  for (const row of scenarioResults) {
    for (const key of Object.keys(totals)) {
      totals[key] += Number(row.kpis?.[key] ?? 0);
    }
  }
  const pass = Object.values(totals).every((value) => value === 0);
  return { totals, pass };
}
