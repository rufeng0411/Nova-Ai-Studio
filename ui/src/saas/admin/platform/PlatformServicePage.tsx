import { Navigate, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PilotDeckConfigTab from '../../../components/settings/view/tabs/PilotDeckConfigTab';
import {
  isPilotDeckConfigSectionId,
  sectionLabelKey,
} from '../../../components/settings/view/tabs/pilotDeckConfigSections';
import type { SettingsProject } from '../../../components/settings/types/types';

type OutletContext = { projects: SettingsProject[] };

export default function PlatformServicePage() {
  const { t } = useTranslation('settings');
  const { projects } = useOutletContext<OutletContext>();
  const { section } = useParams<{ section: string }>();

  if (!section || !isPilotDeckConfigSectionId(section)) {
    return <Navigate to="models" replace />;
  }

  const labelKey = sectionLabelKey(section);

  return (
    <div className="saas-admin-settings-embed" data-testid="saas-admin-platform-service">
      <header className="saas-admin-settings-embed-header">
        <h2>{t(`pilotDeckConfig.sections.${labelKey}.label`)}</h2>
        <p>{t(`pilotDeckConfig.sections.${labelKey}.description`)}</p>
      </header>
      <PilotDeckConfigTab projects={projects} externalNav activeSection={section} />
    </div>
  );
}
