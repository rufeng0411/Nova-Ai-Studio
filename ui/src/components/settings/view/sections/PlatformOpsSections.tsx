/**
 * PD-SAAS-FORK: Platform-level settings panels (telemetry, version/about).
 * Shared by the workspace Settings modal (admin-only in SaaS) and admin console.
 * Full-screen restart copy: Restarting Nova Ai-Studio (see VersionBadge.tsx).
 */
import { useCallback, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { Activity, Sparkles } from 'lucide-react';
import { version } from '../../../../../package.json';
import { usePilotDeckConfig } from '../../../../hooks/usePilotDeckConfig';
import SettingsToggle from '../SettingsToggle';
import { cn } from '../../../../lib/utils';

function GroupedCard({ children, divided }: { children: ReactNode; divided?: boolean }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-card/60',
        divided && 'divide-y divide-border',
      )}
    >
      {children}
    </div>
  );
}

function SettingsGroup({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="text-[15px] font-semibold leading-5 text-foreground">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MenuRow({
  icon: Icon,
  title,
  detail,
  children,
}: {
  icon: typeof Activity;
  title: ReactNode;
  detail: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[66px] items-center gap-3.5 px-5 py-3">
      <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold leading-5 text-foreground">{title}</div>
        <div className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export function TelemetrySettingsRow() {
  const { t } = useTranslation('settings');
  const { raw, setRaw, save, loading } = usePilotDeckConfig();

  const telemetryEnabled = useMemo(() => {
    try {
      const config = parseYaml(raw);
      return config?.telemetry?.enabled === true;
    } catch {
      return false;
    }
  }, [raw]);

  const handleTelemetryToggle = useCallback(
    (value: boolean) => {
      try {
        const config = parseYaml(raw) ?? {};
        config.telemetry = { ...config.telemetry, enabled: value };
        const next = stringifyYaml(config, { indent: 2, lineWidth: 0 });
        setRaw(next);
        void save();
      } catch {
        // YAML parse/stringify failure — ignore silently.
      }
    },
    [raw, setRaw, save],
  );

  return (
    <MenuRow
      icon={Activity}
      title={t('settingsHome.telemetry.title')}
      detail={t('settingsHome.telemetry.detail')}
    >
      <SettingsToggle
        checked={telemetryEnabled}
        onChange={handleTelemetryToggle}
        ariaLabel={t('settingsHome.telemetry.title')}
        disabled={loading}
      />
    </MenuRow>
  );
}

export function TelemetrySettingsSection({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation('settings');
  const row = <TelemetrySettingsRow />;

  if (embedded) {
    return <GroupedCard>{row}</GroupedCard>;
  }

  return (
    <SettingsGroup title={t('settingsHome.advanced')}>
      <GroupedCard>{row}</GroupedCard>
    </SettingsGroup>
  );
}

export function NovaAboutSection({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation('settings');

  const body = (
    <GroupedCard>
      <div className="flex items-start gap-3.5 px-5 py-4">
        <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-5 text-foreground">Nova Ai-Studio</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t('about.novaIntro', {
              defaultValue:
                'Nova Ai-Studio 是一个以对话驱动的 AI 工作台，帮助你用自然语言完成调研、创作、办公与开发等复杂任务。',
            })}
          </p>
          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] font-mono text-muted-foreground">
            <span>{t('about.version')}</span>
            <span>v{version}</span>
          </div>
        </div>
      </div>
    </GroupedCard>
  );

  if (embedded) return body;

  return <SettingsGroup title={t('about.title')}>{body}</SettingsGroup>;
}
