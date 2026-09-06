import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  PILOTDECK_CONFIG_SECTION_GROUPS,
  sectionLabelKey,
  type PilotDeckConfigSectionId,
} from '../../../components/settings/view/tabs/pilotDeckConfigSections';
import { useAdminSettingsProjects } from './useAdminSettingsProjects';
import '../../theme/saasAdmin.css';

const PLATFORM_NAV = [
  { to: 'overview', label: '平台概览' },
  { to: 'mcp', label: 'MCP 服务器' },
  { to: 'permissions', label: '权限' },
  { to: 'telemetry', label: '遥测' },
  { to: 'about', label: '关于' },
] as const;

export default function PlatformSettingsLayout() {
  const { projects, loading } = useAdminSettingsProjects();
  const { t } = useTranslation('settings');

  const sectionLabel = (id: PilotDeckConfigSectionId) =>
    t(`pilotDeckConfig.sections.${sectionLabelKey(id)}.label`);

  return (
    <div className="saas-admin-platform-layout" data-testid="saas-admin-platform-settings">
      <nav className="saas-admin-platform-nav" aria-label="平台配置">
        <NavLink
          to="overview"
          className={({ isActive }) => `saas-admin-platform-nav-item${isActive ? ' active' : ''}`}
          end
        >
          平台概览
        </NavLink>

        <div className="saas-admin-platform-nav-group" data-testid="saas-admin-platform-service-nav">
          <div className="saas-admin-platform-nav-group-title">服务配置</div>
          <div className="saas-admin-platform-nav-group-children">
            {PILOTDECK_CONFIG_SECTION_GROUPS.map((group) => (
              <div key={group.id} className="saas-admin-platform-nav-subgroup">
                <div className="saas-admin-platform-nav-subgroup-label">
                  {t(`pilotDeckConfig.sectionGroups.${group.id}`)}
                </div>
                {group.sections.map((sectionId) => (
                  <NavLink
                    key={sectionId}
                    to={`service/${sectionId}`}
                    className={({ isActive }) =>
                      `saas-admin-platform-nav-item saas-admin-platform-nav-item--child${
                        isActive ? ' active' : ''
                      }`
                    }
                  >
                    {sectionLabel(sectionId)}
                  </NavLink>
                ))}
              </div>
            ))}
          </div>
        </div>

        {PLATFORM_NAV.slice(1).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `saas-admin-platform-nav-item${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="saas-admin-platform-panel">
        {loading ? <p className="saas-admin-platform-loading">加载项目列表…</p> : null}
        <Outlet context={{ projects }} />
      </div>
    </div>
  );
}
