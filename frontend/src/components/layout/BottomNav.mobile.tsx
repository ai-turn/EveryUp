import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ComponentType, SVGProps } from 'react';
import {
  IconHealthCheck,
  IconLogs,
  IconInfra,
  IconAlerts,
  IconSettings,
} from '../icons/SidebarIcons';

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const navItems: { Icon: IconComponent; labelKey: string; href: string }[] = [
  { Icon: IconHealthCheck,  labelKey: 'nav.healthcheck', href: '/healthcheck' },
  { Icon: IconLogs,         labelKey: 'nav.logs',        href: '/logs' },
  { Icon: IconInfra,        labelKey: 'nav.monitoring',  href: '/infra' },
  { Icon: IconAlerts,       labelKey: 'nav.alerts',      href: '/alerts' },
  { Icon: IconSettings,     labelKey: 'nav.settings',    href: '/settings' },
];

export function BottomNavMobile() {
  const location = useLocation();
  const { t } = useTranslation('common');

  function isActive(href: string) {
    return href === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(href);
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-bg-main-dark border-t border-slate-200 dark:border-ui-border-dark flex items-stretch"
      style={{ height: 'calc(4rem + env(safe-area-inset-bottom, 0px))', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {navItems.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          className={`
            flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors
            ${isActive(item.href)
              ? 'text-primary'
              : 'text-slate-400 dark:text-text-muted-dark'
            }
          `}
        >
          <item.Icon size={23} />
          <span className="text-sm font-medium">{t(item.labelKey)}</span>
        </Link>
      ))}
    </nav>
  );
}
