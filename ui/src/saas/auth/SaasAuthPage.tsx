import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import novaLogoMark from '../brand/novaLogoMark';
import { useMobileAuthLayout } from './useMobileAuthLayout';
import AuthShell from './AuthShell';
import LoginPage from './LoginPage';
import { hydrateMarketingSiteFlagFromBridge } from '../marketing/sanitizeMarketingNext';
import '../theme/marketingAuth.css';

export default function SaasAuthPage() {
  const { t } = useTranslation(['auth', 'common']);
  const isMobileLayout = useMobileAuthLayout();

  useEffect(() => {
    void hydrateMarketingSiteFlagFromBridge();
  }, []);

  return (
    <AuthShell>
      <div
        className={`saas-auth-card${isMobileLayout ? ' saas-auth-card--mobile' : ''}`}
        data-testid="saas-auth-shell"
      >
        <div className="saas-auth-card-logo">
          <img
            src={novaLogoMark}
            alt="Nova Ai-Studio"
            className="saas-auth-card-logo-img"
            draggable={false}
          />
        </div>
        <h2>{t('auth:login.title')}</h2>
        <p className="saas-auth-sub">{t('auth:login.description')}</p>
        <LoginPage onSwitchToRegister={() => undefined} hideSwitch />
      </div>
    </AuthShell>
  );
}
