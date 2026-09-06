/**
 * PD-SAAS-FORK: tenant member toggle for project continuity memory.
 */
import { useEffect, useState } from 'react';
import { Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SettingsToggle from '../../components/settings/view/SettingsToggle';
import { saasApi } from '../api/saasApi';

export default function ProjectContinuitySettingsRow() {
  const { t } = useTranslation('settings');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await saasApi.getPreferences();
        if (!res.ok || !alive) return;
        const payload = await res.json();
        setEnabled(payload?.preferences?.projectContinuity !== false);
      } catch {
        /* keep default on */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onToggle = async (next: boolean) => {
    setEnabled(next);
    setSaving(true);
    try {
      const res = await saasApi.updatePreferences({ projectContinuity: next });
      if (!res.ok) {
        setEnabled(!next);
      }
    } catch {
      setEnabled(!next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="flex min-w-0 items-start gap-3">
        <Brain className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            {t('pilotDeckConfig.panels.memory.projectContinuity.label')}
          </div>
          <div className="text-xs text-muted-foreground">
            {t('pilotDeckConfig.panels.memory.projectContinuity.description')}
          </div>
        </div>
      </div>
      <SettingsToggle
        checked={enabled}
        disabled={loading || saving}
        ariaLabel={t('pilotDeckConfig.panels.memory.projectContinuity.label')}
        onChange={onToggle}
      />
    </div>
  );
}
