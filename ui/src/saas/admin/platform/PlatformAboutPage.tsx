import { useTranslation } from 'react-i18next';
import { NovaAboutSection } from '../../../components/settings/view/sections/PlatformOpsSections';

export default function PlatformAboutPage() {
  const { t } = useTranslation('settings');

  return (
    <div className="saas-admin-settings-embed" data-testid="saas-admin-platform-about">
      <header className="saas-admin-settings-embed-header">
        <h2>{t('about.title')}</h2>
        <p>{t('about.novaIntro')}</p>
      </header>
      <NovaAboutSection embedded />
    </div>
  );
}
