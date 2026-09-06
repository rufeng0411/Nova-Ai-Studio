/**
 * PD-SAAS-FORK: PilotDeck 服务配置分区 — 供表单与后台树导航共用
 */
export type PilotDeckConfigSectionId =
  | 'models'
  | 'agents'
  | 'memory'
  | 'tools'
  | 'providerHub'
  | 'router'
  | 'gateway'
  | 'customEnv'
  | 'alwaysOn'
  | 'cron'
  | 'advanced';

export const PILOTDECK_CONFIG_SECTIONS: Array<{
  id: PilotDeckConfigSectionId;
  labelKey: string;
  descriptionKey: string;
}> = [
  { id: 'advanced', labelKey: 'runtime', descriptionKey: 'runtime' },
  { id: 'models', labelKey: 'models', descriptionKey: 'models' },
  { id: 'agents', labelKey: 'agents', descriptionKey: 'agents' },
  { id: 'alwaysOn', labelKey: 'alwaysOn', descriptionKey: 'alwaysOn' },
  { id: 'cron', labelKey: 'cron', descriptionKey: 'cron' },
  { id: 'memory', labelKey: 'memory', descriptionKey: 'memory' },
  { id: 'providerHub', labelKey: 'providerHub', descriptionKey: 'providerHub' },
  { id: 'tools', labelKey: 'tools', descriptionKey: 'tools' },
  { id: 'router', labelKey: 'router', descriptionKey: 'router' },
  { id: 'gateway', labelKey: 'gateway', descriptionKey: 'gateway' },
  { id: 'customEnv', labelKey: 'customEnv', descriptionKey: 'customEnv' },
];

export const PILOTDECK_CONFIG_SECTION_GROUPS: Array<{
  id: 'basic' | 'features' | 'advanced';
  sections: PilotDeckConfigSectionId[];
}> = [
  { id: 'basic', sections: ['models', 'agents'] },
  {
    id: 'features',
    sections: ['router', 'memory', 'providerHub', 'tools', 'alwaysOn', 'cron', 'gateway'],
  },
  { id: 'advanced', sections: ['advanced', 'customEnv'] },
];

export function isPilotDeckConfigSectionId(value: string): value is PilotDeckConfigSectionId {
  return PILOTDECK_CONFIG_SECTIONS.some((item) => item.id === value);
}

export function sectionLabelKey(sectionId: PilotDeckConfigSectionId): string {
  const meta = PILOTDECK_CONFIG_SECTIONS.find((item) => item.id === sectionId);
  return meta?.labelKey ?? sectionId;
}
