import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

type Crumb = { label: string; path?: string };

const ROUTE_META: Array<{ match: RegExp; section: string; title: string }> = [
  { match: /^\/admin\/dashboard\/?$/, section: '总览', title: '运营仪表盘' },
  { match: /^\/admin\/users\/?$/, section: '用户与订阅', title: '用户管理' },
  { match: /^\/admin\/user-groups\/?$/, section: '用户与订阅', title: '用户组权限' },
  { match: /^\/admin\/(platform\/)?usage\/?$/, section: '平台', title: '路由用量' },
  { match: /^\/admin\/(platform\/)?skills\/?$/, section: '平台', title: '技能管理' },
  { match: /^\/admin\/(platform\/)?hub-visibility\/?$/, section: '平台', title: '能力可见' },
  { match: /^\/admin\/platform\/im-channels\/?$/, section: '平台', title: '消息通道' },
  { match: /^\/admin\/marketing-leads\/?$/, section: '主站', title: '联系线索' },
  { match: /^\/admin\/invite-codes\/?$/, section: '主站', title: '邀请码' },
  { match: /^\/admin\/marketing-analytics\/?$/, section: '主站', title: '访问统计' },
  { match: /^\/admin\/showcase\/?$/, section: '主站', title: '演示案例' },
  { match: /^\/admin\/platform\/overview\/?$/, section: '平台', title: '平台概览' },
  { match: /^\/admin\/platform\/plugins\/?$/, section: '平台', title: '插件系统' },
  { match: /^\/admin\/platform\/service\//, section: '平台', title: '服务配置' },
  { match: /^\/admin\/platform\/mcp\/?$/, section: '平台', title: 'MCP 服务器' },
  { match: /^\/admin\/platform\/permissions\/?$/, section: '平台', title: '权限' },
  { match: /^\/admin\/platform\/telemetry\/?$/, section: '平台', title: '遥测' },
  { match: /^\/admin\/platform\/about\/?$/, section: '平台', title: '关于' },
  { match: /^\/admin\/platform\/?$/, section: '平台', title: '平台配置' },
];

export function useAdminRouteMeta(): { crumbs: Crumb[]; title: string } {
  const { pathname } = useLocation();

  return useMemo(() => {
    const hit = ROUTE_META.find((entry) => entry.match.test(pathname));
    const section = hit?.section ?? '后台';
    const title = hit?.title ?? '后台管理';
    const crumbs: Crumb[] = [
      { label: '后台' },
      { label: section },
      { label: title },
    ];
    return { crumbs, title };
  }, [pathname]);
}
