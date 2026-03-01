import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../common';

const navItems = [
  { icon: 'home',          labelKey: 'nav.dashboard',   href: '/' },
  { icon: 'monitor_heart', labelKey: 'nav.healthcheck', href: '/services' },
  { icon: 'article',       labelKey: 'nav.logs',        href: '/logs' },
  { icon: 'dns',           labelKey: 'nav.monitoring',  href: '/monitoring' },
  { icon: 'notifications', labelKey: 'nav.alerts',      href: '/alerts' },
  { icon: 'settings',      labelKey: 'nav.settings',    href: '/settings' },
];

export function BottomNavMobile() {
  const location = useLocation();
  const { t } = useTranslation();

  function isActive(href: string) {
    return href === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(href);
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white dark:bg-bg-main-dark border-t border-slate-200 dark:border-ui-border-dark flex items-stretch">
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
          <MaterialIcon name={item.icon} className="text-[20px]" />
          <span className="text-[9px] font-medium">{t(item.labelKey)}</span>
        </Link>
      ))}
    </nav>
  );
}
