import { useTranslation } from 'react-i18next';
import novaLogoMark from '../../../saas/brand/novaLogoMark';
import NovaLoadingScreen from '../../../saas/brand/NovaLoadingScreen';

export default function AuthLoadingScreen() {
  const { t } = useTranslation('common');

  return (
    <NovaLoadingScreen
      logoSrc={novaLogoMark}
      label={t('boot.authenticating')}
      ariaLabel={t('boot.authenticating')}
    />
  );
}
