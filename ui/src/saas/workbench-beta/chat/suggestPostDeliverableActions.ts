// PD-SAAS-FORK: post-complete next-step rule engine (Demo-aligned)

export type SuggestNextAction = {
  id: string;
  labelKey: string;
  prompt: string;
};

export type SuggestInput = {
  basenames: string[];
  profileId?: string | null;
};

function extOf(name: string): string {
  const base = name.split(/[/\\]/).pop() || name;
  const i = base.lastIndexOf('.');
  return i >= 0 ? base.slice(i + 1).toLowerCase() : '';
}

function hasExt(basenames: string[], ext: string): boolean {
  return basenames.some((b) => extOf(b) === ext);
}

function isGeoTrio(basenames: string[]): boolean {
  const joined = basenames.map((b) => b.toLowerCase()).join('\n');
  const hasCheck = /audit-checklist|检查|checklist/.test(joined);
  const hasKw = /keywords|关键词/.test(joined);
  const hasOpt = /optimized|优化/.test(joined);
  return hasCheck && hasKw && hasOpt;
}

function looksCampaign(basenames: string[], profileId?: string | null): boolean {
  if (profileId && /campaign|brand-campaign/i.test(profileId)) return true;
  const n = basenames.filter((b) => extOf(b) === 'md').length;
  return n >= 4;
}

/** Deterministic next actions; max 3. */
export function suggestPostDeliverableActions(input: SuggestInput): SuggestNextAction[] {
  const basenames = (input.basenames || []).filter(Boolean);
  const hasHtml = hasExt(basenames, 'html') || basenames.some((b) => /\.bento\.html$/i.test(b));
  const hasMd = hasExt(basenames, 'md');
  const hasPdf = hasExt(basenames, 'pdf');
  const hasPptx = hasExt(basenames, 'pptx');
  const out: SuggestNextAction[] = [];

  const push = (item: SuggestNextAction) => {
    if (out.length >= 3) return;
    if (out.some((x) => x.id === item.id)) return;
    out.push(item);
  };

  if (isGeoTrio(basenames) && !hasHtml) {
    push({
      id: 'geo_dual_html',
      labelKey: 'workbenchBeta.next.geo_dual_html',
      prompt: '为 GEO 成果生成同名可视化 HTML 双报告，写入同一任务目录。',
    });
  } else if (hasMd && !hasHtml) {
    push({
      id: 'md_to_html',
      labelKey: 'workbenchBeta.next.md_to_html',
      prompt: '再出一份综合可视化 HTML 报告，写入同一任务目录。',
    });
  }

  if ((hasMd || hasHtml) && !hasPdf) {
    push({
      id: 'export_pdf',
      labelKey: 'workbenchBeta.next.export_pdf',
      prompt: '把当前报告导出为 PDF，写入同一任务目录。',
    });
  }

  if (hasMd && !hasPptx) {
    push({
      id: 'to_pptx',
      labelKey: 'workbenchBeta.next.to_pptx',
      prompt: '基于已有报告做一份商务汇报 PPT（可编辑），写入同一任务目录。',
    });
  }

  if (looksCampaign(basenames, input.profileId)) {
    const joined = basenames.map((b) => b.toLowerCase()).join('\n');
    if (!/social|社媒|slices/.test(joined)) {
      push({
        id: 'campaign_social',
        labelKey: 'workbenchBeta.next.campaign_social',
        prompt: '基于已有全案做社媒切片，写入同一任务目录。',
      });
    }
    if (!hasPptx) {
      push({
        id: 'campaign_ppt',
        labelKey: 'workbenchBeta.next.campaign_ppt',
        prompt: '基于已有全案做路演 PPT，写入同一任务目录。',
      });
    }
  }

  return out.slice(0, 3);
}
