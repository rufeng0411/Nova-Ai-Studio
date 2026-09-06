import { useTranslation } from 'react-i18next';
import PermissionsSettingsTab from '../../../components/settings/view/tabs/PermissionsSettingsTab';

export default function PlatformPermissionsPage() {
  const { t } = useTranslation('settings');

  return (
    <div className="saas-admin-settings-embed" data-testid="saas-admin-platform-permissions">
      <header className="saas-admin-settings-embed-header">
        <h2>{t('mainTabs.permissions')}</h2>
        <p>{t('settingsHome.permissions.detail')}</p>
      </header>
      <PermissionsSettingsTab />
    </div>
  );
}
