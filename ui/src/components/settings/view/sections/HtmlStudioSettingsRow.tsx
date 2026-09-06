// PD-SAAS-FORK: HTML Studio feature toggle in settings
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  isHtmlStudioBuildDisabled,
  isHtmlStudioEnabled,
  setHtmlStudioEnabled,
  subscribeHtmlStudioEnabled,
} from '../../../../shared/htmlStudioGate';
import SettingsRow from '../SettingsRow';
import SettingsToggle from '../SettingsToggle';

export default function HtmlStudioSettingsRow() {
  const { t } = useTranslation('settings');
  const buildDisabled = isHtmlStudioBuildDisabled();
  const [enabled, setEnabled] = useState(() => isHtmlStudioEnabled());

  useEffect(() => subscribeHtmlStudioEnabled(() => setEnabled(isHtmlStudioEnabled())), []);

  if (buildDisabled) return null;

  return (
    <SettingsRow
      label={t('appearanceSettings.htmlStudio.label', { defaultValue: 'HTML 所见即所得' })}
      description={t('appearanceSettings.htmlStudio.description', {
        defaultValue:
          '开启后，artifacts 下的 HTML 报告可在右栏切换「查看 / 编辑」，直接改标题与正文。',
      })}
    >
      <SettingsToggle
        checked={enabled}
        onChange={(next) => {
          setHtmlStudioEnabled(next);
          setEnabled(next);
        }}
        ariaLabel={t('appearanceSettings.htmlStudio.label', { defaultValue: 'HTML 所见即所得' })}
      />
    </SettingsRow>
  );
}
