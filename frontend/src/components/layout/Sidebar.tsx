import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSidebar } from '../../contexts/SidebarContext';
import {
  IconDashboard,
  IconHealthCheck,
  IconLogs,
  IconInfra,
  IconAlerts,
  IconSettings,
} from '../icons/SidebarIcons';
import { ComponentType, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const navItems: { Icon: IconComponent; labelKey: string; href: string }[] = [
  { Icon: IconDashboard, labelKey: 'nav.dashboard', href: '/' },
  { Icon: IconHealthCheck, labelKey: 'nav.healthcheck', href: '/healthcheck' },
  { Icon: IconLogs, labelKey: 'nav.logs', href: '/logs' },
  { Icon: IconInfra, labelKey: 'nav.monitoring', href: '/infra' },
  { Icon: IconAlerts, labelKey: 'nav.alerts', href: '/alerts' },
  { Icon: IconSettings, labelKey: 'nav.settings', href: '/settings' },
];

export function Sidebar() {
  const location = useLocation();
  const { t } = useTranslation('common');
  const { isCollapsed } = useSidebar();

  return (
    <aside
      className={`
        flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-ui-border-dark
        bg-white dark:bg-bg-main-dark relative
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-[72px]' : 'w-64'}
      `}
    >
      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-ui-border-dark">
        <nav className={`space-y-1.5 transition-all duration-300 ${isCollapsed ? 'px-2' : 'px-4'}`}>
          {navItems.map((item) => {
            const isActive = item.href === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                title={isCollapsed ? t(item.labelKey) : undefined}
                className={`
                  flex items-center rounded-lg transition-all duration-200
                  ${isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'}
                  ${isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 dark:text-text-muted-dark hover:bg-slate-100 dark:hover:bg-ui-hover-dark dark:hover:text-white'
                  }
                `}
              >
                <item.Icon
                  size={isCollapsed ? 22 : 20}
                  className="shrink-0 transition-all duration-200"
                />
                <span
                  className={`
                    text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300
                    ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}
                  `}
                >
                  {t(item.labelKey)}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Floating Toggle Button (Appears on Hover) */}

    </aside>
  );
}
