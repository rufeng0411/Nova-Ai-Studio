import { useTranslation } from 'react-i18next';
import { TelemetrySettingsSection } from '../../../components/settings/view/sections/PlatformOpsSections';

export default function PlatformTelemetryPage() {
  const { t } = useTranslation('settings');

  return (
    <div className="saas-admin-settings-embed" data-testid="saas-admin-platform-telemetry">
      <header className="saas-admin-settings-embed-header">
        <h2>{t('settingsHome.telemetry.title')}</h2>
        <p>{t('settingsHome.telemetry.detail')}</p>
      </header>
      <TelemetrySettingsSection embedded />
    </div>
  );
}
