/**
 * PD-SAAS-FORK: 后台新建技能 — 分类路径与 overrides 字段映射
 */
import {
  EDUCATION_BAND_ORDER,
  GEO_FLYWHEEL_ORDER,
  MARKETING_FLYWHEEL_ORDER,
  type HubMajorCategory,
} from '../../shared/capabilityHubTheme.js';
import {
  getFlywheelTaskGroups,
  getGeoFlywheelStages,
  getMajorCategoriesMeta,
  getMajorCategorySubtags,
  HUB_MAJOR_CATEGORY_ORDER,
} from '../../shared/capabilityHubTaxonomy.js';

export type AdminSkillPlacement = {
  major: HubMajorCategory;
  /** 营销飞轮阶段 ID；非营销大类时通常与 major 相同 */
  stage: string;
  taskGroup?: string;
  categorySubtag?: string;
  educationBand?: string;
};

export type PlacementOption = { id: string; label: string };

const MAJOR_LABELS: Record<HubMajorCategory, string> = {
  marketing: '营销',
  geo: 'GEO',
  office: '办公',
  creation: '创作',
  development: '开发',
  brainstorming: '脑暴',
  education: '教育',
};

export function getMajorPlacementOptions(): PlacementOption[] {
  const meta = getMajorCategoriesMeta();
  return HUB_MAJOR_CATEGORY_ORDER.map((id) => ({
    id,
    label:
      id === 'marketing'
        ? MAJOR_LABELS.marketing
        : id === 'education'
          ? MAJOR_LABELS.education
          : meta[id]?.label || MAJOR_LABELS[id] || id,
  }));
}

export function getStageOptionsForMajor(major: HubMajorCategory): PlacementOption[] {
  if (major === 'marketing') {
    return MARKETING_FLYWHEEL_ORDER.map((id) => ({
      id,
      label: STAGE_LABELS[id] || id,
    }));
  }
  if (major === 'geo') {
    return getGeoFlywheelStages().map((stage) => ({
      id: stage.id,
      label: stage.label,
    }));
  }
  if (major === 'education') {
    return [{ id: 'education', label: '教育' }];
  }
  return [{ id: major, label: MAJOR_LABELS[major] || major }];
}

const STAGE_LABELS: Record<string, string> = {
  research: '调研',
  strategy: '策略',
  create: '创意',
  activate: '触达',
  distribute: '发布',
  measure: '监测',
};

const GEO_STAGE_LABELS: Record<string, string> = Object.fromEntries(
  getGeoFlywheelStages().map((stage) => [stage.id, stage.label]),
);

const BAND_LABELS: Record<string, string> = {
  preschool: '学前',
  primary: '小学',
  junior: '初中',
  senior: '高中',
  general: '综合升学',
  academic_research: '学术研究',
};

export function getThirdLevelOptions(
  major: HubMajorCategory,
  stage: string,
): PlacementOption[] {
  if (major === 'marketing') {
    return getFlywheelTaskGroups(stage).map((g) => ({
      id: g.id,
      label: g.label,
    }));
  }
  if (major === 'education') {
    return EDUCATION_BAND_ORDER.map((id) => ({
      id,
      label: BAND_LABELS[id] || id,
    }));
  }
  if (major === 'geo') {
    return [{ id: 'general', label: '本段全部' }];
  }
  if (
    major === 'office' ||
    major === 'creation' ||
    major === 'development' ||
    major === 'brainstorming'
  ) {
    return getMajorCategorySubtags(major).map((s) => ({
      id: s.id,
      label: s.label,
    }));
  }
  return [{ id: 'general', label: '通用' }];
}

export function defaultPlacementForMajor(major: HubMajorCategory): AdminSkillPlacement {
  if (major === 'marketing') {
    return {
      major,
      stage: MARKETING_FLYWHEEL_ORDER[0],
      taskGroup: getFlywheelTaskGroups(MARKETING_FLYWHEEL_ORDER[0])[0]?.id || 'general',
    };
  }
  if (major === 'geo') {
    return {
      major,
      stage: GEO_FLYWHEEL_ORDER[0],
    };
  }
  if (major === 'education') {
    return {
      major,
      stage: 'education',
      educationBand: EDUCATION_BAND_ORDER[0],
    };
  }
  const subtags = getMajorCategorySubtags(major);
  return {
    major,
    stage: major,
    categorySubtag: subtags[0]?.id || 'general',
  };
}

export function placementBreadcrumb(
  placement: AdminSkillPlacement,
  labels?: {
    stage?: string;
    third?: string;
  },
): string {
  const majorLabel = MAJOR_LABELS[placement.major] || placement.major;
  if (placement.major === 'marketing') {
    const stageLabel = labels?.stage || STAGE_LABELS[placement.stage] || placement.stage;
    const tgLabel = labels?.third || placement.taskGroup || 'general';
    return `${majorLabel} / ${stageLabel} / ${tgLabel}`;
  }
  if (placement.major === 'geo') {
    const stageLabel = labels?.stage || GEO_STAGE_LABELS[placement.stage] || placement.stage;
    return `${majorLabel} / ${stageLabel}`;
  }
  if (placement.major === 'education') {
    const bandLabel = labels?.third || BAND_LABELS[placement.educationBand || 'general'] || placement.educationBand;
    return `${majorLabel} / ${bandLabel}`;
  }
  const subLabel = labels?.third || placement.categorySubtag || 'general';
  return `${majorLabel} / ${subLabel}`;
}

export function placementToOverride(placement: AdminSkillPlacement): Record<string, unknown> {
  if (placement.major === 'marketing') {
    return {
      major_category: 'marketing',
      stage: placement.stage,
      task_group: placement.taskGroup || 'general',
    };
  }
  if (placement.major === 'geo') {
    return {
      major_category: 'geo',
      geo_stage: placement.stage,
    };
  }
  if (placement.major === 'education') {
    return {
      major_category: 'education',
      stage: 'education',
      education_bands: [placement.educationBand || 'general'],
    };
  }
  if (
    placement.major === 'office' ||
    placement.major === 'creation' ||
    placement.major === 'development' ||
    placement.major === 'brainstorming'
  ) {
    return {
      major_category: placement.major,
      stage: placement.major,
      category_subtag: placement.categorySubtag || 'general',
    };
  }
  return {
    stage: 'uncategorized',
    major_category: placement.major,
  };
}

export function thirdLevelLabel(placement: AdminSkillPlacement): string {
  if (placement.major === 'marketing') return '任务子类';
  if (placement.major === 'geo') return '（无子类）';
  if (placement.major === 'education') return '学段';
  return '子分类';
}
