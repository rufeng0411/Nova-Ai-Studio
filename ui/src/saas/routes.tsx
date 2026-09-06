import { Navigate, Route, Routes } from 'react-router-dom';
import SaasProtectedRoute from './guards/SaasProtectedRoute';
import { useMobileShell } from '../hooks/useMobileShell';
import MobileAdminBlock from '../mobile/MobileAdminBlock';
import AdminLayout from './admin/AdminLayout';
import DashboardPage from './admin/DashboardPage';
import UsagePage from './admin/UsagePage';
import PlatformSettingsLayout from './admin/platform/PlatformSettingsLayout';
import PlatformOverviewPage from './admin/platform/PlatformOverviewPage';
import PlatformPluginsPage from './admin/platform/PlatformPluginsPage';
import PlatformServicePage from './admin/platform/PlatformServicePage';
import PlatformMcpPage from './admin/platform/PlatformMcpPage';
import PlatformPermissionsPage from './admin/platform/PlatformPermissionsPage';
import PlatformTelemetryPage from './admin/platform/PlatformTelemetryPage';
import PlatformAboutPage from './admin/platform/PlatformAboutPage';
import SkillsAdminPage from './admin/SkillsAdminPage';
import HubVisibilityAdminPage from './admin/HubVisibilityAdminPage';
import PlatformImChannelsPage from './admin/platform/PlatformImChannelsPage';

/** Mounted at App route `/admin/*` — paths here are relative to the splat. */
export function SaasAdminRoutes() {
 const isMobile = useMobileShell();
 if (isMobile) {
 return (
 <SaasProtectedRoute>
 <MobileAdminBlock />
 </SaasProtectedRoute>
 );
 }
 return (
 <SaasProtectedRoute>
 <Routes>
 <Route element={<AdminLayout />}>
 <Route index element={<Navigate to="dashboard" replace />} />
 <Route path="dashboard" element={<DashboardPage />} />
 <Route path="users" element={<Navigate to="/admin/dashboard" replace />} />
 <Route path="user-groups" element={<Navigate to="/admin/dashboard" replace />} />
 <Route path="usage" element={<Navigate to="platform/usage" replace />} />
 <Route path="skills" element={<Navigate to="platform/skills" replace />} />
 <Route path="hub-visibility" element={<Navigate to="platform/hub-visibility" replace />} />
 <Route path="marketing-leads" element={<Navigate to="/admin/dashboard" replace />} />
 <Route path="invite-codes" element={<Navigate to="/admin/dashboard" replace />} />
 <Route path="marketing-analytics" element={<Navigate to="/admin/dashboard" replace />} />
 <Route path="showcase" element={<Navigate to="/admin/dashboard" replace />} />
 <Route path="marketing-pages" element={<Navigate to="/admin/dashboard" replace />} />
 <Route path="platform/usage" element={<UsagePage />} />
 <Route path="platform/skills" element={<SkillsAdminPage />} />
 <Route path="platform/hub-visibility" element={<HubVisibilityAdminPage />} />
 <Route path="platform/im-channels" element={<PlatformImChannelsPage />} />
 <Route path="platform/plugins" element={<PlatformPluginsPage />} />
 <Route path="platform" element={<PlatformSettingsLayout />}>
 <Route index element={<Navigate to="overview" replace />} />
 <Route path="overview" element={<PlatformOverviewPage />} />
 <Route path="service">
 <Route index element={<Navigate to="models" replace />} />
 <Route path=":section" element={<PlatformServicePage />} />
 </Route>
 <Route path="mcp" element={<PlatformMcpPage />} />
 <Route path="permissions" element={<PlatformPermissionsPage />} />
 <Route path="telemetry" element={<PlatformTelemetryPage />} />
 <Route path="about" element={<PlatformAboutPage />} />
 </Route>
 </Route>
 </Routes>
 </SaasProtectedRoute>
 );
}

export { default as SaasAuthPage } from './auth/SaasAuthPage';
