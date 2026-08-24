import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTranslate } from '@tolgee/react';
import { useTheme } from '../../contexts/ThemeContext';
import { MaterialIcon } from '../common';
import { api, type AgentServiceFlat } from '../../services/api';
import { env } from '../../config/env';
import logo from '../../assets/logo.png';
import logoDark from '../../assets/logo-dark.png';

interface NavItemProps {
  to: string;
  icon: string;
  label: string;
  active: boolean;
  badge?: number;
}

function NavItem({ to, icon, label, active, badge }: NavItemProps) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-primary/10 text-primary' : 'text-text-muted hover:bg-ui-hover hover:text-text-base'
      }`}
    >
      <MaterialIcon name={icon} className="shrink-0 text-lg" />
      <span className="truncate">{label}</span>
      {badge != null && badge > 0 && <span className="ml-auto shrink-0 rounded-full bg-red-500 px-1.5 py-px text-2xs font-bold text-white">{badge}</span>}
    </Link>
  );
}

export function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const { i18n } = useTranslation('common');
  const { t } = useTranslate();
  const location = useLocation();
  const [services, setServices] = useState<AgentServiceFlat[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await api.getAllAgentServicesFlat();
        if (alive) setServices(data ?? []);
      } catch {
        // Navigation remains available even when its alert badge cannot load.
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const path = location.pathname;
  const isHome = path === '/' || path === '/agents';

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-ui-border bg-bg-surface lg:flex">
      <Link to="/" className="group flex h-16 shrink-0 items-center gap-2 px-4">
        <img src={theme === 'dark' ? logoDark : logo} alt="EveryUp" className="h-9 w-9 object-contain" />
        <span className="text-lg font-bold tracking-tight text-text-base transition-colors group-hover:text-primary">EveryUp</span>
      </Link>

      {env.isDemoMode && <div className="mx-3 mb-2 rounded-lg bg-amber-400 px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-amber-950">Live Demo</div>}

      <button
        onClick={() => window.dispatchEvent(new Event('everyup:command-palette'))}
        className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-ui-border bg-bg-main px-3 py-1.5 text-text-dim transition-colors hover:border-primary/40 hover:text-text-base"
      >
        <MaterialIcon name="search" className="shrink-0 text-base" />
        <span className="flex-1 text-left text-xs">{t('검색')}</span>
        <kbd className="rounded border border-ui-border px-1 py-0.5 text-2xs font-semibold">{navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl K'}</kbd>
      </button>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3">
        <NavItem to="/" icon="grid_view" label="Docker" active={isHome} />
        <NavItem to="/uptime" icon="monitor_heart" label={t('업타임')} active={path.startsWith('/uptime')} />
        <NavItem to="/logs" icon="article" label={t('로그')} active={path.startsWith('/logs')} />
        <NavItem to="/infrastructure" icon="memory" label={t('인프라')} active={path.startsWith('/infrastructure')} />
        <NavItem to="/api" icon="api" label="API" active={path.startsWith('/api')} />
        <NavItem to="/metrics" icon="monitoring" label={t('메트릭')} active={path.startsWith('/metrics')} />
        <NavItem to="/alerts" icon="notifications" label={t('알림')} active={path.startsWith('/alerts')} badge={services.filter((service) => !service.healthy).length} />
        <NavItem to="/settings" icon="settings" label={t('환경 설정')} active={path.startsWith('/settings')} />
      </nav>

      <div className="flex shrink-0 flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <button onClick={toggleTheme} aria-label="Toggle theme" className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-ui-hover hover:text-text-base">
            <MaterialIcon name={theme === 'light' ? 'dark_mode' : 'light_mode'} className="text-lg" />
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-ui-border bg-bg-main p-0.5">
            {(['ko', 'en'] as const).map((language) => <button key={language} onClick={() => i18n.changeLanguage(language)} className={`rounded-md px-2 py-1 text-2xs font-bold transition-colors ${i18n.language.startsWith(language) ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-base'}`}>{language.toUpperCase()}</button>)}
          </div>
        </div>
      </div>
    </aside>
  );
}
