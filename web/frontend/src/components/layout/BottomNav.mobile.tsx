import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../common';

// Same icons as the desktop sidebar (grid_view/notifications/settings).
const navItems: { icon: string; labelKey: string; href: string }[] = [
  { icon: 'grid_view',     labelKey: 'nav.services', href: '/' },
  { icon: 'notifications', labelKey: 'nav.alerts',   href: '/alerts' },
  { icon: 'settings',      labelKey: 'nav.settings', href: '/settings' },
];

export function BottomNavMobile() {
  const location = useLocation();
  const { t } = useTranslation('common');

  function isActive(href: string) {
    return href === '/'
      ? location.pathname === '/' || location.pathname.startsWith('/services')
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
            flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative
            ${isActive(item.href)
              ? 'text-primary'
              : 'text-slate-400 dark:text-text-muted-dark'
            }
          `}
        >
          <MaterialIcon name={item.icon} className="text-2xl" />
          <span className="text-sm font-medium whitespace-nowrap">{t(item.labelKey)}</span>
          {isActive(item.href) && (
            <span className="absolute top-1.5 w-1 h-1 rounded-full bg-primary" />
          )}
        </Link>
      ))}
    </nav>
  );
}
