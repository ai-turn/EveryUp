import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../../../components/common';
import type { CheckEntry } from '../../../services/api';

// HealthCheckPage still passes FailureWithService[] under the hood via the `failures` prop name,
// but now it's wired to getRecentChecks() which returns CheckEntry[].
// The prop type is kept compatible — CheckEntry is a superset of FailureWithService.
interface CheckHistoryTabProps {
  failures: CheckEntry[];
  loading: boolean;
}

type ResultFilter = 'all' | 'success' | 'error';

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

export function CheckHistoryTab({ failures: entries, loading }: CheckHistoryTabProps) {
  const navigate = useNavigate();
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [serviceFilter, setServiceFilter] = useState('all');

  const successCount = useMemo(() => entries.filter((e) => e.status === 'success').length, [entries]);
  const errorCount = useMemo(() => entries.filter((e) => e.status === 'failure').length, [entries]);

  const services = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of entries) seen.set(e.serviceId, e.serviceName);
    return [...seen.entries()];
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (resultFilter === 'success' && e.status !== 'success') return false;
      if (resultFilter === 'error' && e.status !== 'failure') return false;
      if (serviceFilter !== 'all' && e.serviceId !== serviceFilter) return false;
      return true;
    });
  }, [entries, resultFilter, serviceFilter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: { dateLabel: string; entries: CheckEntry[] }[] = [];
    let current: { dateLabel: string; entries: CheckEntry[] } | null = null;
    for (const e of filtered) {
      const label = formatDateLabel(e.checkedAt);
      if (!current || current.dateLabel !== label) {
        current = { dateLabel: label, entries: [] };
        groups.push(current);
      }
      current.entries.push(e);
    }
    return groups;
  }, [filtered]);

  const FILTERS: { id: ResultFilter; label: string; color: string }[] = [
    { id: 'all', label: `전체 ${entries.length}`, color: 'text-slate-600 dark:text-text-muted-dark' },
    { id: 'error', label: `실패 ${errorCount}`, color: 'text-rose-600 dark:text-rose-400' },
    { id: 'success', label: `성공 ${successCount}`, color: 'text-emerald-600 dark:text-emerald-400' },
  ];

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setResultFilter(f.id)}
              className={`px-3 py-1.5 text-xs rounded-md font-semibold transition-colors ${
                resultFilter === f.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : `${f.color} hover:bg-slate-50 dark:hover:bg-ui-hover-dark`
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="text-xs bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-text-muted-dark outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
        >
          <option value="all">모든 서비스</option>
          {services.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark overflow-hidden">
        {/* Column header */}
        <div
          className="grid gap-3 px-4 py-2.5 bg-slate-50/70 dark:bg-ui-hover-dark/50 border-b border-slate-100 dark:border-ui-border-dark text-[11px] font-semibold text-slate-500 dark:text-text-muted-dark uppercase tracking-wide"
          style={{ gridTemplateColumns: '72px 108px 160px 80px 56px 1fr' }}
        >
          <div>상태</div>
          <div>시각</div>
          <div>서비스</div>
          <div className="text-right">응답</div>
          <div className="text-center">코드</div>
          <div className="pl-2">메시지</div>
        </div>

        {entries.length === 0 ? (
          <div className="py-16 text-center">
            <MaterialIcon name="check_circle" className="text-5xl text-emerald-400 mb-3" />
            <p className="font-semibold text-slate-700 dark:text-text-base-dark">체크 기록이 없습니다</p>
            <p className="text-sm text-slate-400 dark:text-text-muted-dark mt-1">서비스가 체크를 시작하면 여기에 표시됩니다</p>
          </div>
        ) : grouped.length === 0 ? (
          <div className="py-12 text-center">
            <MaterialIcon name="search_off" className="text-4xl text-slate-300 mb-3" />
            <p className="text-slate-500 dark:text-text-muted-dark">조건에 맞는 기록이 없습니다</p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.dateLabel}>
              <div className="px-4 py-1.5 bg-slate-50/40 dark:bg-ui-hover-dark/30 border-b border-t border-slate-100 dark:border-ui-border-dark text-[11px] text-slate-500 dark:text-text-muted-dark font-medium sticky top-0 z-10">
                {group.dateLabel}
              </div>
              {group.entries.map((e) => (
                <HistoryRow
                  key={e.id}
                  entry={e}
                  onServiceClick={() => navigate(`/healthcheck/${e.serviceId}`)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {entries.length > 0 && (
        <p className="text-center text-[11px] text-slate-400 dark:text-text-dim-dark">
          최근 {entries.length}건 표시 ({errorCount}건 실패 · {successCount}건 성공)
        </p>
      )}
    </div>
  );
}

function HistoryRow({
  entry: e,
  onServiceClick,
}: {
  entry: CheckEntry;
  onServiceClick: () => void;
}) {
  const isOk = e.status === 'success';

  const latencyColor =
    e.responseTime > 1000 ? 'text-rose-600 dark:text-rose-400' :
    e.responseTime > 300  ? 'text-amber-600 dark:text-amber-400' :
    'text-slate-700 dark:text-text-base-dark';

  const latencyLabel =
    e.responseTime <= 0  ? '—' :
    e.responseTime < 1000 ? `${e.responseTime}ms` :
    `${(e.responseTime / 1000).toFixed(2)}s`;

  const rowBg = isOk
    ? 'hover:bg-slate-50/60 dark:hover:bg-ui-hover-dark/30'
    : 'bg-rose-50/30 dark:bg-rose-900/10 hover:bg-rose-50/60 dark:hover:bg-rose-900/20';

  return (
    <div
      className={`grid gap-3 px-4 py-2.5 border-b border-slate-50 dark:border-ui-border-dark/50 transition-colors items-center ${rowBg}`}
      style={{ gridTemplateColumns: '72px 108px 160px 80px 56px 1fr' }}
    >
      {/* Status */}
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOk ? 'bg-emerald-500' : 'bg-rose-500'}`} />
        <span className={`text-[11px] font-semibold ${isOk ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
          {isOk ? '성공' : '실패'}
        </span>
      </div>

      {/* Time */}
      <div className="flex flex-col">
        <span className="text-xs text-slate-700 dark:text-text-base-dark tabular-nums font-medium">
          {formatTime(e.checkedAt)}
        </span>
        <span className="text-[10px] text-slate-400 dark:text-text-dim-dark">
          {formatTimeAgo(e.checkedAt)}
        </span>
      </div>

      {/* Service */}
      <button
        type="button"
        onClick={onServiceClick}
        className="flex items-center gap-1.5 min-w-0 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
      >
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 font-semibold shrink-0 uppercase">
          {e.serviceType}
        </span>
        <span className="text-xs text-slate-800 dark:text-text-base-dark font-semibold truncate hover:text-primary dark:hover:text-primary">
          {e.serviceName}
        </span>
      </button>

      {/* Response time */}
      <div className="text-right">
        <span className={`text-xs font-semibold tabular-nums ${latencyColor}`}>
          {latencyLabel}
        </span>
      </div>

      {/* HTTP code */}
      <div className="flex justify-center">
        {e.statusCode ? (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            e.statusCode >= 200 && e.statusCode < 300
              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
              : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
          }`}>
            {e.statusCode}
          </span>
        ) : (
          <span className="text-slate-300 dark:text-text-dim-dark text-xs">—</span>
        )}
      </div>

      {/* Message */}
      <div className="min-w-0 pl-2">
        {e.errorMessage ? (
          <p className="text-xs text-rose-600 dark:text-rose-400 font-mono truncate" title={e.errorMessage}>
            {e.errorMessage}
          </p>
        ) : isOk ? (
          <span className="text-xs text-slate-400 dark:text-text-dim-dark">정상 응답</span>
        ) : (
          <span className="text-xs text-slate-300 dark:text-text-dim-dark">—</span>
        )}
      </div>
    </div>
  );
}
