import { Link, useLocation } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { MaterialIcon } from '../common';

const navItems = [
  { icon: 'grid_view', label: '에이전트', href: '/' },
  { icon: 'monitor_heart', label: '업타임', href: '/uptime' },
  { icon: 'article', label: '로그', href: '/logs' },
  { icon: 'memory', label: '인프라', href: '/infrastructure' },
  { icon: 'apps', label: '더보기', href: '/more' },
];

export function BottomNavMobile() {
  const location = useLocation();
  const { t } = useTranslate();

  function isActive(href: string) {
    if (href === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/agents') || location.pathname.startsWith('/projects') || location.pathname.startsWith('/services');
    }
    return location.pathname.startsWith(href);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-stretch border-t border-ui-border bg-bg-surface lg:hidden" style={{ height: 'calc(4rem + env(safe-area-inset-bottom, 0px))', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {navItems.map((item) => (
        <Link key={item.href} to={item.href} className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${isActive(item.href) ? 'text-primary' : 'text-text-dim'}`}>
          <MaterialIcon name={item.icon} className="text-2xl" />
          <span className="whitespace-nowrap text-sm font-medium">{t(item.label)}</span>
          {isActive(item.href) && <span className="absolute top-1.5 h-1 w-1 rounded-full bg-primary" />}
        </Link>
      ))}
    </nav>
  );
}
