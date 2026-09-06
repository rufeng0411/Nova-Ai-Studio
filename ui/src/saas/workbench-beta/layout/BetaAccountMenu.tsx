// PD-SAAS-FORK: Beta account menu actions (replay tour + settings/admin hooks)

import { useTranslation } from 'react-i18next';
import { requestWorkbenchTourReplay } from '../onboarding/WorkbenchTour';

export type BetaAccountMenuProps = {
  onOpenSettings?: () => void;
  onOpenAdmin?: () => void;
  showAdmin?: boolean;
  onLogout?: () => void;
};

export default function BetaAccountMenu({
  onOpenSettings,
  onOpenAdmin,
  showAdmin,
  onLogout,
}: BetaAccountMenuProps) {
  const { t } = useTranslation('common');
  return (
    <div data-testid="wb-beta-account-menu" className="flex flex-col gap-1 text-sm">
      <button
        type="button"
        data-testid="wb-beta-account-replay-tour"
        className="text-left px-2 py-1.5 rounded hover:bg-muted"
        onClick={() => requestWorkbenchTourReplay()}
      >
        {t('workbenchBeta.tour.replay', '重播新手引导')}
      </button>
      {onOpenSettings ? (
        <button type="button" className="text-left px-2 py-1.5 rounded hover:bg-muted" onClick={onOpenSettings}>
          {t('workbenchBeta.account.settings', '设置')}
        </button>
      ) : null}
      {showAdmin && onOpenAdmin ? (
        <button type="button" className="text-left px-2 py-1.5 rounded hover:bg-muted" onClick={onOpenAdmin}>
          {t('workbenchBeta.account.admin', '后台管理')}
        </button>
      ) : null}
      {onLogout ? (
        <button type="button" className="text-left px-2 py-1.5 rounded hover:bg-muted" onClick={onLogout}>
          {t('workbenchBeta.account.logout', '退出')}
        </button>
      ) : null}
    </div>
  );
}
