import { useEffect, useState } from 'react';
import { Link, useLocation, useMatch } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTranslate } from '@tolgee/react';
import { useTheme } from '../../contexts/ThemeContext';
import { MaterialIcon } from '../common';
import { api, type AgentServiceFlat, type ConnectedAgent } from '../../services/api';
import { env } from '../../config/env';
import logo from '../../assets/logo.png';
import logoDark from '../../assets/logo-dark.png';

// 2분 내 통신이면 온라인 (ServiceGridPage와 동일 기준)
function agentOnline(agent: ConnectedAgent): boolean {
  return Date.now() - new Date(agent.lastSeenAt).getTime() < 2 * 60 * 1000;
}

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
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-primary/10 text-primary'
          : 'text-text-muted hover:bg-ui-hover hover:text-text-base'
      }`}
    >
      <MaterialIcon name={icon} className="text-lg shrink-0" />
      <span className="truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto shrink-0 rounded-full bg-red-500 px-1.5 py-px text-2xs font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

// 데스크톱(lg+) 전용 좌측 내비게이션. 모바일은 Header + BottomNav 유지.
export function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const { i18n } = useTranslation('common');
  const { t } = useTranslate();
  const location = useLocation();

  // 레이아웃 라우트에서 렌더되므로 useParams가 아닌 useMatch로 현재 프로젝트를 추출
  const projMatch = useMatch('/projects/:agentId');
  const svcMatch = useMatch('/services/:agentId/:key');
  const agentId = projMatch?.params.agentId ?? svcMatch?.params.agentId ?? null;
  const activeServiceKey = svcMatch?.params.key ?? null;

  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [services, setServices] = useState<AgentServiceFlat[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [agts, svcs] = await Promise.all([api.getAgents(), api.getAllAgentServicesFlat()]);
        if (!alive) return;
        setAgents(agts ?? []);
        setServices(svcs ?? []);
      } catch {
        // non-critical — 사이드바는 데이터 없어도 렌더
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const currentAgent = agents.find(a => a.id === agentId) ?? null;
  const projectServices = agentId ? services.filter(s => s.agentId === agentId) : [];
  const online = currentAgent ? agentOnline(currentAgent) : false;
  const healthyCount = projectServices.filter(s => s.healthy).length;

  const isHome = location.pathname === '/';
  const isDash = !!projMatch;
  const isAlerts = location.pathname.startsWith('/alerts');
  const isSettings = location.pathname.startsWith('/settings');

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-bg-surface border-r border-ui-border">
      {/* Logo → 홈(프로젝트 목록) */}
      <Link to="/" className="flex items-center gap-2 px-4 h-16 shrink-0 group">
        <img src={theme === 'dark' ? logoDark : logo} alt="EveryUp" className="h-9 w-9 object-contain" />
        <span className="text-lg font-bold text-text-base tracking-tight group-hover:text-primary transition-colors">EveryUp</span>
      </Link>

      {/* 데모 모드 배지 — 데스크톱은 상단 배너 대신 여기 표시 (모바일은 DemoBanner 유지) */}
      {env.isDemoMode && (
        <div className="relative group mx-3 mb-2">
          <span className="flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider bg-amber-400 text-amber-950 uppercase cursor-default">
            Live Demo
          </span>
          {/* 커스텀 툴팁 (네이티브 title 대체) */}
          <div className="absolute left-0 top-full mt-1.5 w-full z-50 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-2xs leading-relaxed text-slate-200 shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {t('모든 데이터는 예시용 데이터이며, 실제 서버와 연결되어 있지 않습니다.')}
          </div>
        </div>
      )}

      {/* ⌘K 팔레트 트리거 (CommandPalette가 이벤트 수신) */}
      <button
        onClick={() => window.dispatchEvent(new Event('everyup:command-palette'))}
        className="mx-3 mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-ui-border bg-bg-main text-text-dim hover:border-primary/40 hover:text-text-base transition-colors"
      >
        <MaterialIcon name="search" className="text-base shrink-0" />
        <span className="flex-1 text-left text-xs">{t('검색')}</span>
        <kbd className="text-2xs font-semibold border border-ui-border rounded px-1 py-0.5">
          {navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl K'}
        </kbd>
      </button>

      {/* 내비게이션 */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 flex flex-col gap-0.5">
        <NavItem to="/" icon="grid_view" label={t('프로젝트')} active={isHome} />
        {agentId && (
          <>
            <NavItem to={`/projects/${agentId}`} icon="folder_open" label={currentAgent?.name ?? t('대시보드')} active={isDash} />
            {projectServices.length > 0 && (
              <div className="flex flex-col gap-0.5 ml-[18px] pl-3 py-1 border-l border-ui-border">
                {projectServices.map(s => (
                  <Link
                    key={s.key}
                    to={`/services/${agentId}/${encodeURIComponent(s.key)}`}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                      s.key === activeServiceKey
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-text-muted hover:bg-ui-hover hover:text-text-base'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.healthy ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="truncate">{s.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
        {/* Badge = currently unhealthy services across every project (same 30s poll) */}
        <NavItem to="/alerts" icon="notifications" label={t('알림')} active={isAlerts} badge={services.filter(s => !s.healthy).length} />
        <NavItem to="/settings" icon="settings" label={t('환경설정')} active={isSettings} />
      </nav>

      {/* 하단: 에이전트 상태 + 테마/언어 */}
      <div className="p-3 shrink-0 flex flex-col gap-2">
        {currentAgent && (
          <div className="rounded-lg bg-bg-main border border-ui-border px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-2xs font-semibold text-text-base">
              <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span className="truncate">
                {currentAgent.version ? `Agent v${currentAgent.version}` : 'Agent'} · {online ? 'online' : 'offline'}
              </span>
            </div>
            <div className="mt-1 text-2xs text-text-dim">
              {t('서비스 {count}개', { count: projectServices.length })} · {t('정상')} {healthyCount}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-ui-hover hover:text-text-base transition-colors"
          >
            <MaterialIcon name={theme === 'light' ? 'dark_mode' : 'light_mode'} className="text-lg" />
          </button>
          <div className="flex items-center gap-1 bg-bg-main border border-ui-border p-0.5 rounded-lg">
            {(['ko', 'en'] as const).map(lng => (
              <button
                key={lng}
                onClick={() => i18n.changeLanguage(lng)}
                className={`px-2 py-1 text-2xs font-bold rounded-md transition-colors ${
                  i18n.language.startsWith(lng)
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-muted hover:text-text-base'
                }`}
              >
                {lng.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
