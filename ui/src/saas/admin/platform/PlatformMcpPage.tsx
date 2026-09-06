import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import McpServersTab from '../../../components/settings/view/tabs/McpServersTab';
import type { SettingsProject } from '../../../components/settings/types/types';

type OutletContext = { projects: SettingsProject[] };

export default function PlatformMcpPage() {
  const { t } = useTranslation('settings');
  const { projects } = useOutletContext<OutletContext>();

  return (
    <div className="saas-admin-settings-embed" data-testid="saas-admin-platform-mcp">
      <header className="saas-admin-settings-embed-header">
        <h2>{t('mcpConfig.title')}</h2>
        <p>{t('settingsHome.mcp.detail')}</p>
      </header>
      <McpServersTab projects={projects} />
    </div>
  );
}
