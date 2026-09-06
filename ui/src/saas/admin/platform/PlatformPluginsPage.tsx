/**
 * PD-SAAS-FORK: 平台 → 插件系统
 */
import AdminPageShell from '../components/AdminPageShell';
import PlatformFeaturesPanel from './PlatformFeaturesPanel';

export default function PlatformPluginsPage() {
  return (
    <AdminPageShell
      title="插件系统"
      description="管理创作预览与企业 MCP 插件。展开后以表格查看能力范围与内部功能明细。"
      testId="saas-admin-platform-plugins"
    >
      <PlatformFeaturesPanel />
    </AdminPageShell>
  );
}
