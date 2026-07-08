import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { MaterialIcon } from '../common';
import { api, type AgentServiceFlat, type ConnectedAgent } from '../../services/api';

// Fired by the sidebar search button; ⌘K/Ctrl+K toggles directly.
export const OPEN_PALETTE_EVENT = 'everyup:command-palette';

interface PaletteItem {
  id: string;
  icon: string; // must be registered in MaterialIcon's iconMap
  label: string;
  meta?: string;
  to: string;
  healthy?: boolean; // service items show a status dot instead of an icon
}

export function CommandPalette() {
  const navigate = useNavigate();
  const { t } = useTranslate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  // Fresh data on every open; palette renders fine with none (pages only).
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setIndex(0);
    Promise.all([api.getAgents(), api.getAllAgentServicesFlat()])
      .then(([agts, svcs]) => {
        setAgents(agts ?? []);
        setServices(svcs ?? []);
      })
      .catch(() => {});
    // autofocus after the overlay mounts
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const items: PaletteItem[] = useMemo(() => [
    { id: 'page-home', icon: 'grid_view', label: t('프로젝트'), meta: t('홈'), to: '/' },
    { id: 'page-alerts', icon: 'notifications', label: t('알림'), to: '/alerts' },
    { id: 'page-settings', icon: 'settings', label: t('환경설정'), to: '/settings' },
    ...agents.map((a) => ({
      id: `proj-${a.id}`, icon: 'dashboard', label: a.name, meta: t('프로젝트'), to: `/projects/${a.id}`,
    })),
    ...services.map((s) => ({
      id: `svc-${s.agentId}-${s.key}`, icon: '', label: s.name, meta: s.agentName,
      to: `/services/${s.agentId}/${encodeURIComponent(s.key)}`, healthy: s.healthy,
    })),
  ], [agents, services, t]);

  const filtered = useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.meta?.toLowerCase().includes(q));
  }, [items, query]);

  const go = (item: PaletteItem) => {
    setOpen(false);
    navigate(item.to);
  };

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[index]) go(filtered[index]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Keep the active row visible while arrowing through a long list.
  useEffect(() => {
    listRef.current?.children[index]?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-[18vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-4 border-b border-slate-200 dark:border-ui-border-dark">
          <MaterialIcon name="search" className="text-lg text-slate-400 dark:text-text-dim-dark shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
            onKeyDown={onInputKeyDown}
            placeholder={t('프로젝트, 서비스, 페이지 검색...')}
            className="flex-1 py-3.5 text-sm bg-transparent outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-text-dim-dark"
          />
          <kbd className="shrink-0 px-1.5 py-0.5 rounded border border-slate-200 dark:border-ui-border-dark text-2xs font-semibold text-slate-400 dark:text-text-dim-dark">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400 dark:text-text-muted-dark">{t('검색 결과가 없습니다')}</p>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                onClick={() => go(item)}
                onMouseMove={() => setIndex(i)}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors ${
                  i === index
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-700 dark:text-text-base-dark'
                }`}
              >
                {item.icon ? (
                  <MaterialIcon name={item.icon} className="text-base shrink-0 text-slate-400 dark:text-text-dim-dark" />
                ) : (
                  <span className={`ml-1 mr-1 h-1.5 w-1.5 rounded-full shrink-0 ${item.healthy ? 'bg-emerald-500' : 'bg-red-500'}`} />
                )}
                <span className="text-sm font-medium truncate">{item.label}</span>
                {item.meta && (
                  <span className="ml-auto text-2xs text-slate-400 dark:text-text-dim-dark shrink-0">{item.meta}</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-200 dark:border-ui-border-dark text-2xs text-slate-400 dark:text-text-dim-dark">
          <span>↑↓ {t('이동')}</span>
          <span>Enter {t('열기')}</span>
        </div>
      </div>
    </div>
  );
}
