import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../../../components/common';
import type { LogEntry, Service, LogLevel } from '../../../services/api';

const LEVEL_STYLES: Record<string, { dot: string; badge: string; rowHover: string; expanded: string }> = {
  error: {
    dot:      'bg-red-500',
    badge:    'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    rowHover: 'bg-red-50/30 dark:bg-red-900/10 hover:bg-red-50/60 dark:hover:bg-red-900/20',
    expanded: 'bg-red-50/60 dark:bg-red-900/20',
  },
  warn: {
    dot:      'bg-amber-400',
    badge:    'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    rowHover: 'bg-amber-50/30 dark:bg-amber-900/10 hover:bg-amber-50/60 dark:hover:bg-amber-900/20',
    expanded: 'bg-amber-50/60 dark:bg-amber-900/20',
  },
  info: {
    dot:      'bg-sky-400',
    badge:    'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400',
    rowHover: 'hover:bg-slate-50/60 dark:hover:bg-ui-hover-dark/30',
    expanded: 'bg-slate-50 dark:bg-ui-hover-dark/40',
  },
  debug: {
    dot:      'bg-slate-400',
    badge:    'bg-slate-100 dark:bg-ui-hover-dark text-slate-500',
    rowHover: 'hover:bg-slate-50/60 dark:hover:bg-ui-hover-dark/30',
    expanded: 'bg-slate-50 dark:bg-ui-hover-dark/40',
  },
  trace: {
    dot:      'bg-slate-300',
    badge:    'bg-slate-50 dark:bg-ui-hover-dark text-slate-400',
    rowHover: 'hover:bg-slate-50/60 dark:hover:bg-ui-hover-dark/30',
    expanded: 'bg-slate-50 dark:bg-ui-hover-dark/40',
  },
};

const SOURCE_LABELS: Record<string, string> = {
  internal: '내부',
  external: '외부',
  agent: 'Agent',
};

const ALL_LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace'];

const COL = '68px 130px 150px 68px 1fr';

function formatTimeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('ko-KR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDateLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    month: '2-digit', day: '2-digit', weekday: 'short',
  });
}

interface LogStreamTabProps {
  logs: LogEntry[];
  loading: boolean;
  services: Service[];
  onRefresh: () => void;
}

export function LogStreamTab({ logs, loading, services, onRefresh }: LogStreamTabProps) {
  const [levelFilter, setLevelFilter] = useState<LogLevel | ''>('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter((l) => {
      if (levelFilter && l.level !== levelFilter) return false;
      if (serviceFilter && l.serviceId !== serviceFilter) return false;
      if (q && !l.message.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, levelFilter, serviceFilter, search]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: { dateLabel: string; entries: LogEntry[] }[] = [];
    let current: { dateLabel: string; entries: LogEntry[] } | null = null;
    for (const l of filtered) {
      const label = formatDateLabel(l.createdAt);
      if (!current || current.dateLabel !== label) {
        current = { dateLabel: label, entries: [] };
        groups.push(current);
      }
      current.entries.push(l);
    }
    return groups;
  }, [filtered]);

  const toggleExpand = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <input
            type="text"
            placeholder="메시지 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/50 dark:text-white dark:placeholder-text-muted-dark"
          />
        </div>

        <div className="flex items-center gap-1 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg p-1">
          <button
            type="button"
            onClick={() => setLevelFilter('')}
            className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors ${
              levelFilter === ''
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'text-slate-500 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark'
            }`}
          >
            전체
          </button>
          {ALL_LEVELS.map((lv) => {
            const s = LEVEL_STYLES[lv];
            return (
              <button
                key={lv}
                type="button"
                onClick={() => setLevelFilter(lv === levelFilter ? '' : lv)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md font-semibold transition-colors ${
                  levelFilter === lv
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : `${s.badge.split(' ').slice(-2).join(' ')} hover:opacity-80`
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {lv.toUpperCase()}
              </button>
            );
          })}
        </div>

        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg text-sm font-medium text-slate-700 dark:text-text-muted-dark outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
        >
          <option value="">전체 서비스</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark text-sm font-medium text-slate-600 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-colors cursor-pointer disabled:opacity-50"
        >
          <MaterialIcon name="refresh" className={`text-sm ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-text-muted-dark">
        <span>{filtered.length}건 표시</span>
        {(levelFilter || serviceFilter || search) && (
          <button
            type="button"
            onClick={() => { setLevelFilter(''); setServiceFilter(''); setSearch(''); }}
            className="text-primary hover:underline cursor-pointer"
          >
            필터 초기화
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-11 rounded-lg bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-200 dark:border-ui-border-dark rounded-2xl">
          <MaterialIcon name="receipt_long" className="text-5xl text-slate-300 mb-3" />
          <p className="text-slate-500 dark:text-text-muted-dark font-medium">표시할 로그가 없습니다</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark overflow-hidden">
          {/* Column header */}
          <div
            className="grid gap-3 px-4 py-2.5 bg-slate-50/70 dark:bg-ui-hover-dark/50 border-b border-slate-100 dark:border-ui-border-dark text-[11px] font-semibold text-slate-500 dark:text-text-muted-dark uppercase tracking-wide"
            style={{ gridTemplateColumns: COL }}
          >
            <div>레벨</div>
            <div>시각</div>
            <div>서비스</div>
            <div>소스</div>
            <div>메시지</div>
          </div>

          {grouped.map((group) => (
            <div key={group.dateLabel}>
              <div className="px-4 py-1.5 bg-slate-50/40 dark:bg-ui-hover-dark/30 border-b border-t border-slate-100 dark:border-ui-border-dark text-[11px] text-slate-500 dark:text-text-muted-dark font-medium sticky top-0 z-10">
                {group.dateLabel}
              </div>
              {group.entries.map((log) => (
                <LogRow
                  key={log.id}
                  log={log}
                  expanded={expanded.has(Number(log.id))}
                  onToggle={() => toggleExpand(Number(log.id))}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LogRow({
  log,
  expanded,
  onToggle,
}: {
  log: LogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const navigate = useNavigate();
  const style = LEVEL_STYLES[log.level] ?? LEVEL_STYLES.info;
  const serviceName = (log as LogEntry & { serviceName?: string }).serviceName ?? log.serviceId;
  const hasDetail = log.message.length > 100 || !!log.metadata;

  return (
    <>
      <div
        className={`grid gap-3 px-4 py-2.5 border-b border-slate-50 dark:border-ui-border-dark/50 transition-colors items-start ${style.rowHover} ${hasDetail ? 'cursor-pointer' : ''}`}
        style={{ gridTemplateColumns: COL }}
        onClick={hasDetail ? onToggle : undefined}
      >
        {/* Level */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
          <span className={`text-[11px] font-bold uppercase px-1.5 py-0.5 rounded ${style.badge}`}>
            {log.level}
          </span>
        </div>

        {/* Time */}
        <div className="flex flex-col pt-0.5">
          <span className="text-xs text-slate-700 dark:text-text-base-dark tabular-nums font-medium">
            {formatTime(log.createdAt)}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-text-dim-dark">
            {formatTimeAgo(log.createdAt)}
          </span>
        </div>

        {/* Service */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); navigate(`/logs/${log.serviceId}`); }}
          className="text-xs font-semibold text-slate-700 dark:text-text-base-dark hover:text-primary dark:hover:text-primary truncate text-left pt-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
        >
          {serviceName}
        </button>

        {/* Source */}
        <div className="pt-0.5">
          {log.source ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark font-medium">
              {SOURCE_LABELS[log.source] ?? log.source}
            </span>
          ) : (
            <span className="text-slate-300 dark:text-text-dim-dark text-xs">—</span>
          )}
        </div>

        {/* Message */}
        <div className="min-w-0 pt-0.5">
          <p className={`text-xs text-slate-700 dark:text-text-base-dark font-mono leading-relaxed ${expanded ? '' : 'truncate'}`}>
            {log.message}
          </p>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          className={`px-4 py-3 border-b border-slate-100 dark:border-ui-border-dark ${style.expanded}`}
          style={{ gridColumn: '1 / -1' }}
        >
          <p className="text-xs font-mono text-slate-700 dark:text-text-base-dark whitespace-pre-wrap break-all leading-relaxed mb-2">
            {log.message}
          </p>
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <pre className="text-[11px] font-mono text-slate-500 dark:text-text-muted-dark bg-slate-100/60 dark:bg-ui-hover-dark/60 rounded-lg p-3 overflow-x-auto">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          )}
          {log.fingerprint && (
            <p className="mt-2 text-[10px] text-slate-400 dark:text-text-dim-dark font-mono">
              fingerprint: {log.fingerprint}
            </p>
          )}
        </div>
      )}
    </>
  );
}
