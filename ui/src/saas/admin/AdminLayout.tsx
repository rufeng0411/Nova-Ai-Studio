import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../components/auth/context/AuthContext';
import { isSaasAdmin } from '../auth/roles';
import UserAvatar from '../account/UserAvatar';
import { readAvatarUpdatedAt } from '../account/avatarHelpers';
import novaLogoMark from '../brand/novaLogoMark';
import ProductInfoDialog from '../brand/ProductInfoDialog';
import { NOVA_PRODUCT_VERSION } from '../brand/productInfo';
import ErrorBoundary from '../../components/main-content/view/ErrorBoundary';
import { useAdminRouteMeta } from './useAdminRouteMeta';
import '../theme/saasAdmin.css';

/** PD-SAAS-FORK: open same-origin app in a new tab */
function openInNewWindow(path: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${origin}${path.startsWith('/') ? path : `/${path}`}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function AdminLayout() {
 const { user, logout } = useAuth();
 const navigate = useNavigate();
 const [showProductInfo, setShowProductInfo] = useState(false);
 const { crumbs, title } = useAdminRouteMeta();

 if (!isSaasAdmin(user)) {
 return (
 <div className="saas-admin-content">
 <p>需要管理员权限才能访问后台。</p>
 <button type="button" className="saas-admin-btn" onClick={() => openInNewWindow('/app')}>
 打开工作台
 </button>
 </div>
 );
 }

 return (
 <div className="saas-admin-root" data-testid="saas-admin-layout">
 <nav className="saas-admin-sidebar" aria-label="主导航">
        <button
          type="button"
          className="saas-admin-brand"
          onClick={() => setShowProductInfo(true)}
          aria-label="关于 Nova Ai-Studio"
        >
          <img
            src={novaLogoMark}
            alt="Nova Ai-Studio"
            className="saas-admin-brand-logo"
            draggable={false}
          />
        </button>
 <div className="saas-admin-nav-section">总览</div>
 <NavLink
 to="/admin/dashboard"
 className={({ isActive }) => `saas-admin-nav-item${isActive ? ' active' : ''}`}
 >
 运营仪表盘
 </NavLink>
 <div className="saas-admin-nav-section">平台</div>
 <NavLink
 to="/admin/platform"
 end
 className={({ isActive }) => `saas-admin-nav-item${isActive ? ' active' : ''}`}
 >
 平台配置
 </NavLink>
 <NavLink
 to="/admin/platform/usage"
 className={({ isActive }) => `saas-admin-nav-item${isActive ? ' active' : ''}`}
 >
 路由用量
 </NavLink>
 <NavLink
 to="/admin/platform/skills"
 className={({ isActive }) => `saas-admin-nav-item${isActive ? ' active' : ''}`}
 >
 技能管理
 </NavLink>
 <NavLink
 to="/admin/platform/hub-visibility"
 className={({ isActive }) => `saas-admin-nav-item${isActive ? ' active' : ''}`}
 >
 能力可见
 </NavLink>
 <NavLink
 to="/admin/platform/im-channels"
 className={({ isActive }) => `saas-admin-nav-item${isActive ? ' active' : ''}`}
 >
 消息通道
 </NavLink>
 <NavLink
 to="/admin/platform/plugins"
 className={({ isActive }) => `saas-admin-nav-item${isActive ? ' active' : ''}`}
 data-testid="saas-admin-nav-plugins"
 >
 插件系统
 </NavLink>
        <div className="saas-admin-sidebar-footer">
          <div className="saas-admin-sidebar-footer-row" role="group" aria-label="快捷打开">
            <button
              type="button"
              className="saas-admin-sidebar-footer-btn"
              title="在新窗口打开工作台"
              onClick={() => openInNewWindow('/app')}
            >
              工作台
            </button>
          </div>
          <button
            type="button"
            className="saas-admin-sidebar-footer-btn"
            onClick={() => { logout(); navigate('/login'); }}
          >
            退出
          </button>
          <p className="saas-admin-sidebar-version">v{NOVA_PRODUCT_VERSION}</p>
        </div>
      </nav>
 <div className="saas-admin-main">
 <header className="saas-admin-topbar">
 <div className="saas-admin-topbar-copy">
  <h1>{title}</h1>
  <ol className="saas-admin-breadcrumb" aria-label="面包屑">
   {crumbs.map((crumb, index) => (
    <li key={`${crumb.label}-${index}`}>
     {index === crumbs.length - 1 ? <strong>{crumb.label}</strong> : <span>{crumb.label}</span>}
    </li>
   ))}
  </ol>
 </div>
 <div className="saas-admin-topbar-right">
            <UserAvatar
              username={user?.username ?? '管理员'}
              avatarUpdatedAt={readAvatarUpdatedAt(user)}
              size="md"
              title={user?.username ?? '管理员'}
            />
 </div>
 </header>
 <div className="saas-admin-content">
 <ErrorBoundary showDetails>
 <Outlet />
 </ErrorBoundary>
 </div>
 </div>
 <ProductInfoDialog open={showProductInfo} onClose={() => setShowProductInfo(false)} />
 </div>
 );
}
