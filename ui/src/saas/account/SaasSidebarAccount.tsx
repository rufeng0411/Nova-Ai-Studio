/**
 * PD-SAAS-FORK: SaaS account strip in workbench sidebar (identity + admin entry).
 * PC/Pad: click avatar/name opens menu with settings + logout.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../components/auth/context/AuthContext';
import { useMobileShell } from '../../hooks/useMobileShell';
import { cn } from '../../lib/utils.js';
import { isSaasAdmin } from '../auth/roles';
import { readAvatarUpdatedAt } from './avatarHelpers';
import UserAvatar from './UserAvatar';

export type SaasSidebarAccountProps = {
  onShowSettings?: () => void;
  onRequestLogout?: () => void;
};

export default function SaasSidebarAccount({
  onShowSettings,
  onRequestLogout,
}: SaasSidebarAccountProps) {
  const { t } = useTranslation(['sidebar', 'auth', 'common']);
  const { user } = useAuth();
  const navigate = useNavigate();
  // PD-SAAS-FORK: admin console entry is desktop-only.
  const isMobile = useMobileShell();
  const username = user?.username ?? '用户';
  const admin = isSaasAdmin(user) && !isMobile;
  const accountMenuEnabled = !isMobile && Boolean(onShowSettings || onRequestLogout);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const runAndClose = (action?: () => void) => {
    setMenuOpen(false);
    action?.();
  };

  const identity = (
    <>
      <UserAvatar
        username={username}
        avatarUpdatedAt={readAvatarUpdatedAt(user)}
        title={username}
      />
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-[13px] font-medium text-foreground">{username}</div>
        <div className="text-[11px] text-muted-foreground">
          {admin ? '管理员' : '成员'}
        </div>
      </div>
    </>
  );

  return (
    <div
      ref={rootRef}
      className="relative border-t border-border px-2 py-2"
      data-testid="saas-sidebar-account"
    >
      <div className="flex items-center gap-1">
        {accountMenuEnabled ? (
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label={t('common:productInfo.accountMenu', {
              defaultValue: '账户菜单',
            })}
            title={t('common:productInfo.accountMenu', { defaultValue: '账户菜单' })}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            className={cn(
              'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
              'hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              menuOpen && 'bg-muted',
            )}
          >
            {identity}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5">
            {identity}
          </div>
        )}

        {admin ? (
          <button
            type="button"
            onClick={() => navigate('/admin/dashboard')}
            aria-label="后台管理"
            title="后台管理"
            data-testid="saas-admin-entry"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary transition-colors hover:border-primary/40 hover:bg-primary/15 hover:text-primary"
          >
            <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </button>
        ) : null}
      </div>

      {menuOpen && accountMenuEnabled ? (
        <div
          id={menuId}
          role="menu"
          aria-label={t('common:productInfo.accountMenu', { defaultValue: '账户菜单' })}
          className="absolute bottom-full left-2 right-2 z-50 mb-1 rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {onShowSettings ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => runAndClose(onShowSettings)}
              className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-foreground hover:bg-muted"
            >
              <SettingsIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <span>{t('sidebar:actions.settings', { defaultValue: '设置' })}</span>
            </button>
          ) : null}
          {onRequestLogout ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => runAndClose(onRequestLogout)}
              className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span>{t('auth:logout.button', { defaultValue: '退出' })}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
