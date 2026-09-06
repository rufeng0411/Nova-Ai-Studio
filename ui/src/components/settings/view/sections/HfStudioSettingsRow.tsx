// PD-SAAS-FORK: HyperFrames Studio feature toggle in settings
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  isHfStudioBuildDisabled,
  isHfStudioEnabled,
  setHfStudioEnabled,
  subscribeHfStudioEnabled,
} from '../../../../shared/hfStudioGate';
import SettingsRow from '../SettingsRow';
import SettingsToggle from '../SettingsToggle';

export default function HfStudioSettingsRow() {
  const { t } = useTranslation('settings');
  const buildDisabled = isHfStudioBuildDisabled();
  const [enabled, setEnabled] = useState(() => isHfStudioEnabled());

  useEffect(() => subscribeHfStudioEnabled(() => setEnabled(isHfStudioEnabled())), []);

  if (buildDisabled) return null;

  return (
    <SettingsRow
      label={t('appearanceSettings.hfStudio.label', { defaultValue: 'HyperFrames 工程编辑' })}
      description={t('appearanceSettings.hfStudio.description', {
        defaultValue: '开启后，可在右栏编辑 hf-project 工程并重新渲染 promo.mp4。',
      })}
    >
      <SettingsToggle
        checked={enabled}
        onChange={(next) => {
          setHfStudioEnabled(next);
          setEnabled(next);
        }}
        ariaLabel={t('appearanceSettings.hfStudio.label', { defaultValue: 'HyperFrames 工程编辑' })}
      />
    </SettingsRow>
  );
}
