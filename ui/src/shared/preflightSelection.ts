// PD-SAAS-FORK: Preflight Studio — selection draft/confirm types
export type PreflightProfileRef = 'open-design' | 'ppt-master' | 'html-ppt' | string;

export type PreflightStatus = 'none' | 'awaiting' | 'resolved' | 'skipped';

export type PreflightResolvedSelection = {
  catalogId: string;
  surface?: string;
  canvas?: string;
  mode?: string;
  style?: string;
  theme?: string;
  deck?: string;
  confirmedAt: string;
  labels?: Record<string, string>;
};

export type PreflightSlotBinding = {
  slotId: string;
  profileRef: PreflightProfileRef;
  status: PreflightStatus;
  resolved?: PreflightResolvedSelection;
};

export type PreflightDraftSelection = {
  stepId: string;
  optionId: string;
  label?: string;
};

export type PreflightStudioRequest = {
  slug: PreflightProfileRef;
  displayName: string;
  sessionId?: string;
  slotId?: string;
  fallbackPrompt?: string;
  stepIndex?: number;
};

export type PreflightCatalogEntry = {
  id: string;
  label: string;
  category?: string;
  group?: string;
  desc?: string;
  accent?: string;
  colors?: string[];
  previewUrl?: string;
  previewThumbUrl?: string;
  previewImageUrl?: string;
  dim?: string;
  ratio?: string;
  recommended?: boolean;
};

export function buildLaunchContextXml(input: {
  capability: string;
  slotId?: string;
  selections: Record<string, { id: string; label?: string }>;
}): string {
  const lines = [
    `<launch-context capability="${input.capability}"${input.slotId ? ` slotId="${input.slotId}"` : ''}>`,
    '  <selections>',
  ];
  for (const [key, sel] of Object.entries(input.selections)) {
    const label = sel.label ? ` label="${sel.label.replace(/"/g, '&quot;')}"` : '';
    lines.push(`    <${key} id="${sel.id}"${label}/>`);
  }
  lines.push('  </selections>');
  lines.push('  <directives>已确认样式选择，跳过模板问卷。</directives>');
  lines.push('</launch-context>');
  return lines.join('\n');
}

/** User skipped template cards — will describe style in composer instead. */
export function buildCustomStyleLaunchContext(input: {
  capability: string;
  slotId?: string;
}): string {
  const slotAttr = input.slotId ? ` slotId="${input.slotId}"` : '';
  return [
    `<launch-context capability="${input.capability}" preflight="custom"${slotAttr}>`,
    '  <directives>用户跳过模板选择，自行在对话中描述风格与版式要求。</directives>',
    '</launch-context>',
  ].join('\n');
}

export type PreflightConfirmPayload = {
  prompt: string;
  launchContext: string;
  mode: 'template' | 'custom';
};
