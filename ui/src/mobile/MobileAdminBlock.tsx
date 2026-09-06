/**
 * PD-SAAS-FORK: Mobile guard for the admin console — the `/admin/*` area is
 * desktop-only, so phone visitors get a gentle notice instead of a cramped UI.
 */
import { useAppNavigate } from '../hooks/useAppNavigate';
import { useTranslation } from 'react-i18next';
import { MonitorSmartphone } from 'lucide-react';

export default function MobileAdminBlock() {
  const { t } = useTranslation('common');
  const navigate = useAppNavigate();

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <MonitorSmartphone className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div>
        <h1 className="text-[16px] font-semibold text-foreground">
          {t('mobile.me.desktopOnlyAdmin')}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {t('mobile.me.desktopOnlyAdminHint')}
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mt-2 h-10 rounded-lg bg-primary px-5 text-[14px] font-medium text-primary-foreground active:opacity-90"
      >
        {t('mobile.me.backToApp')}
      </button>
    </div>
  );
}
