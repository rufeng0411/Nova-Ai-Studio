// PD-SAAS-FORK: design canvas feature toggle in settings
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  isDesignCanvasBuildDisabled,
  isDesignCanvasEnabled,
  setDesignCanvasEnabled,
  subscribeDesignCanvasEnabled,
} from '../../../../shared/designCanvasGate';
import { persistDesignCanvasEnabledToServer } from '../../../../shared/designCanvasGateSync';
import SettingsRow from '../SettingsRow';
import SettingsToggle from '../SettingsToggle';

export default function DesignCanvasSettingsRow() {
  const { t } = useTranslation('settings');
  const buildDisabled = isDesignCanvasBuildDisabled();
  const [enabled, setEnabled] = useState(() => isDesignCanvasEnabled());

  useEffect(() => subscribeDesignCanvasEnabled(() => setEnabled(isDesignCanvasEnabled())), []);

  if (buildDisabled) return null;

  return (
    <SettingsRow
      label={t('appearanceSettings.designCanvas.label', { defaultValue: '设计画布' })}
      description={t('appearanceSettings.designCanvas.description', {
        defaultValue: '开启后，图片与制图成果可在预览中切换「查看 / 编辑」，并在右栏画布中继续编排。',
      })}
    >
      <SettingsToggle
        checked={enabled}
        onChange={(next) => {
          setDesignCanvasEnabled(next);
          setEnabled(next);
          void persistDesignCanvasEnabledToServer(next);
        }}
        ariaLabel={t('appearanceSettings.designCanvas.label', { defaultValue: '设计画布' })}
      />
    </SettingsRow>
  );
}
