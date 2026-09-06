/**
 * PD-SAAS-FORK: Mobile "Me" screen — aggregated personal hub for phone users.
 * Profile head + monthly usage summary + sub-pages (profile / memory / tasks)
 * + inline theme & language controls + logout. Admin console intentionally
 * has no entry here (desktop-only).
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAppNavigate } from '../hooks/useAppNavigate';
import { useTranslation } from 'react-i18next';
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe2,
  LogOut,
  Moon,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  SunMoon,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../components/auth/context/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { languages } from '../i18n/languages';
import { isSaasAdmin } from '../saas/auth/roles';
import { saasApi, type MyUsage } from '../saas/api/saasApi';
import { readAvatarUpdatedAt } from '../saas/account/avatarHelpers';
import UserAvatar from '../saas/account/UserAvatar';
import SaasLogoutConfirm from '../saas/account/SaasLogoutConfirm';
import ProfileSettings from '../saas/account/ProfileSettings';
import MemoryPanel from '../components/main-content/view/memory/MemoryPanel';
import { NOVA_PRODUCT_NAME, NOVA_PRODUCT_VERSION } from '../saas/brand/productInfo';
import ProductInfoOverview from '../saas/brand/ProductInfoOverview';
import { IS_SAAS_MODE } from '../constants/config';
import type { Project } from '../types/app';
import { cn } from '../lib/utils.js';

type MeSubPage = 'root' | 'profile' | 'memory' | 'tasks' | 'productIntro';
type ThemeMode = 'system' | 'light' | 'dark';

type MobileMeScreenProps = {
  selectedProject: Project | null;
  onShowSettings: () => void;
  /** Rendered for the tasks sub-page (provided by stage 4 read-only tasks view). */
  tasksView?: ReactNode;
};

function formatTokens(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function MeRow({
  icon,
  label,
  trailing,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  trailing?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[48px] w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left text-[14px] last:border-b-0',
        danger ? 'text-destructive' : 'text-foreground',
        'active:bg-accent/60',
      )}
    >
      <span className={cn('flex h-6 w-6 items-center justify-center', danger ? 'text-destructive' : 'text-muted-foreground')}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {trailing ?? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />}
    </button>
  );
}

export default function MobileMeScreen({ selectedProject, onShowSettings, tasksView }: MobileMeScreenProps) {
  const { t, i18n } = useTranslation(['common', 'auth', 'settings']);
  const navigate = useAppNavigate();
  const { user, logout } = useAuth();
  // ThemeContext is plain JSX (untyped) — narrow the mode locally.
  const { themeMode, setThemeMode } = useTheme() as {
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
  };
  const [subPage, setSubPage] = useState<MeSubPage>('root');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [usage, setUsage] = useState<MyUsage | null>(null);

  const username = user?.username ?? '用户';
  const admin = isSaasAdmin(user);

  useEffect(() => {
    if (!IS_SAAS_MODE) return;
    let cancelled = false;
    saasApi
      .myUsage()
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as MyUsage;
        if (!cancelled) setUsage(payload);
      })
      .catch(() => {
        // Usage summary is best-effort; keep the card hidden on failure.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConfirmLogout = useCallback(() => {
    setShowLogoutConfirm(false);
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const cycleTheme = useCallback(() => {
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(themeMode) + 1) % order.length];
    setThemeMode(next);
  }, [themeMode, setThemeMode]);

  const cycleLanguage = useCallback(() => {
    const values = languages.map((lang) => lang.value);
    const index = values.indexOf(i18n.language);
    const next = values[(index + 1) % values.length] ?? values[0];
    void i18n.changeLanguage(next);
  }, [i18n]);

  const themeLabel = {
    system: t('common:mobile.me.themeSystem'),
    light: t('common:mobile.me.themeLight'),
    dark: t('common:mobile.me.themeDark'),
  }[themeMode];
  const ThemeIcon = themeMode === 'light' ? Sun : themeMode === 'dark' ? Moon : SunMoon;
  const currentLanguage = languages.find((lang) => lang.value === i18n.language)?.nativeName
    ?? languages[0].nativeName;

  if (subPage !== 'root') {
    const subTitle = {
      profile: t('common:mobile.me.profile'),
      memory: t('common:mobile.me.memory'),
      tasks: t('common:mobile.me.tasks'),
      productIntro: t('common:mobile.me.productIntro'),
    }[subPage];

    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-2">
          <button
            type="button"
            onClick={() => setSubPage('root')}
            className="mobile-touch-target flex min-h-[44px] items-center gap-1 rounded-lg pl-1 pr-3 text-[14px] font-medium text-muted-foreground active:bg-accent"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
            {t('common:mobile.me.back')}
          </button>
          <span className="text-[15px] font-semibold text-foreground">{subTitle}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {subPage === 'profile' ? (
            <div className="px-5 py-5">
              <ProfileSettings />
            </div>
          ) : null}
          {subPage === 'memory' ? <MemoryPanel selectedProject={selectedProject} /> : null}
          {subPage === 'tasks' ? tasksView ?? null : null}
          {subPage === 'productIntro' ? <ProductInfoOverview layout="mobile" /> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      {/* Profile head */}
      <div className="flex items-center gap-3.5 px-3.5 pb-4 pt-5">
        <UserAvatar
          username={username}
          avatarUpdatedAt={readAvatarUpdatedAt(user)}
          title={username}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-semibold text-foreground">{username}</div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            {admin ? t('common:mobile.me.roleAdmin') : t('common:mobile.me.roleMember')}
          </div>
        </div>
      </div>

      {/* Monthly usage summary */}
      {usage ? (
        <div className="mx-3.5 mb-3.5 grid grid-cols-3 gap-2 rounded-[var(--radius)] border border-border bg-card px-3.5 py-3.5">
          <div>
            <div className="text-[17px] font-bold tracking-tight text-foreground">
              {formatTokens(usage.total.totalTokens)}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{t('common:mobile.me.usageTokens')}</div>
          </div>
          <div>
            <div className="text-[17px] font-bold tracking-tight text-foreground">
              {usage.total.requestCount}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{t('common:mobile.me.usageRequests')}</div>
          </div>
          <div>
            <div className="text-[17px] font-bold tracking-tight text-foreground">
              ${usage.total.estimatedCost.toFixed(2)}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{t('common:mobile.me.usageCost')}</div>
          </div>
        </div>
      ) : null}

      {/* Personal pages */}
      <div className="mx-3.5 mb-3.5 overflow-hidden rounded-[var(--radius)] border border-border bg-card">
        <MeRow
          icon={<UserRound className="h-[18px] w-[18px]" strokeWidth={1.75} />}
          label={t('common:mobile.me.profile')}
          onClick={() => setSubPage('profile')}
        />
        <MeRow
          icon={<Brain className="h-[18px] w-[18px]" strokeWidth={1.75} />}
          label={t('common:mobile.me.memory')}
          onClick={() => setSubPage('memory')}
        />
        {tasksView ? (
          <MeRow
            icon={<Clock className="h-[18px] w-[18px]" strokeWidth={1.75} />}
            label={t('common:mobile.me.tasks')}
            onClick={() => setSubPage('tasks')}
          />
        ) : null}
      </div>

      {/* Preferences */}
      <div className="mx-3.5 mb-3.5 overflow-hidden rounded-[var(--radius)] border border-border bg-card">
        <MeRow
          icon={<ThemeIcon className="h-[18px] w-[18px]" strokeWidth={1.75} />}
          label={t('common:mobile.me.theme')}
          trailing={<span className="text-[13px] text-muted-foreground">{themeLabel}</span>}
          onClick={cycleTheme}
        />
        <MeRow
          icon={<Globe2 className="h-[18px] w-[18px]" strokeWidth={1.75} />}
          label={t('common:mobile.me.language')}
          trailing={<span className="text-[13px] text-muted-foreground">{currentLanguage}</span>}
          onClick={cycleLanguage}
        />
        <MeRow
          icon={<SettingsIcon className="h-[18px] w-[18px]" strokeWidth={1.75} />}
          label={t('common:mobile.me.settings')}
          onClick={onShowSettings}
        />
        <MeRow
          icon={<Sparkles className="h-[18px] w-[18px]" strokeWidth={1.75} />}
          label={t('common:mobile.me.productIntro')}
          onClick={() => setSubPage('productIntro')}
        />
      </div>

      {/* Logout */}
      <div className="mx-3.5 mb-3.5 overflow-hidden rounded-[var(--radius)] border border-border bg-card">
        <MeRow
          icon={<LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />}
          label={t('common:mobile.me.logout')}
          trailing={<span />}
          onClick={() => setShowLogoutConfirm(true)}
          danger
        />
      </div>

      <div className="pb-6 pt-1 text-center text-[11px] text-muted-foreground">
        {NOVA_PRODUCT_NAME} · v{NOVA_PRODUCT_VERSION}
      </div>

      <SaasLogoutConfirm
        open={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
      />

    </div>
  );
}
