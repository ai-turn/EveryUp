import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, SegmentedControl, SearchInput } from '../../../components/common';
import { ChannelIcon } from '../../../components/icons/ChannelIcons';
import { api, NotificationChannel, NotificationHistory, NotificationStats } from '../../../services/api';
import { getChannelStyle } from '../utils/channelMeta';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';

const PAGE_SIZE = 25;

type StatusFilter = 'all' | 'sent' | 'failed';
type PeriodDays = 1 | 7 | 30;

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  info: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
};

const STATUS_META: Record<string, { dot: string; text: string }> = {
  sent: { dot: 'bg-status-healthy', text: 'text-status-healthy' },
  failed: { dot: 'bg-status-error', text: 'text-status-error' },
  pending: { dot: 'bg-status-warn', text: 'text-status-warn' },
};

// Pages to render: first, last, current±1, with null for ellipsis gaps.
function pageItems(current: number, totalPages: number): (number | null)[] {
  const pages = new Set([1, totalPages, current - 1, current, current + 1]);
  const sorted = [...pages].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const items: (number | null)[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) items.push(null);
    items.push(p);
    prev = p;
  }
  return items;
}

interface NotificationHistoryTabProps {
  channels: NotificationChannel[];
  initialStatus?: StatusFilter;
}

export function NotificationHistoryTab({ channels, initialStatus }: NotificationHistoryTabProps) {
  const { t, i18n } = useTranslation(['alerts', 'common']);
  const [history, setHistory] = useState<NotificationHistory[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus ?? 'all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [periodDays, setPeriodDays] = useState<PeriodDays>(7);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const dateLocale = i18n.language === 'ko' ? ko : enUS;

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  // Any filter change resets to page 1
  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, channelFilter, periodDays, debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getNotificationHistory({
      status: statusFilter === 'all' ? undefined : statusFilter,
      alert_type: typeFilter === 'all' ? undefined : typeFilter,
      channel_id: channelFilter === 'all' ? undefined : channelFilter,
      q: debouncedSearch || undefined,
      from: new Date(Date.now() - periodDays * 86400_000).toISOString(),
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
      .then(response => {
        if (cancelled) return;
        setHistory(response.items || []);
        setTotal(response.total || 0);
      })
      .catch(error => console.error('Failed to load notification history:', error))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [statusFilter, typeFilter, channelFilter, periodDays, debouncedSearch, page]);

  useEffect(() => {
    api.getNotificationHistoryStats(periodDays)
      .then(setStats)
      .catch(error => console.error('Failed to load stats:', error));
  }, [periodDays]);

  const totalSent = stats?.totalSent ?? 0;
  const totalFailed = stats?.totalFailed ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const typeLabel = (type: string) => {
    const cap = type.charAt(0).toUpperCase() + type.slice(1);
    return t(`alerts.history.type${cap}`, { defaultValue: cap });
  };

  const dateGroupLabel = (d: Date) => {
    const dayLabel = format(d, i18n.language === 'ko' ? 'M월 d일' : 'MMM d', { locale: dateLocale });
    if (isToday(d)) return `${t('alerts.history.today')} · ${dayLabel}`;
    if (isYesterday(d)) return `${t('alerts.history.yesterday')} · ${dayLabel}`;
    return dayLabel;
  };

  // Rows interleaved with date-group headers
  const groupedRows = useMemo(() => {
    const rows: ({ kind: 'group'; label: string; key: string } | { kind: 'item'; item: NotificationHistory })[] = [];
    let prevDay = '';
    for (const item of history) {
      const d = new Date(item.createdAt);
      const day = format(d, 'yyyy-MM-dd');
      if (day !== prevDay) {
        rows.push({ kind: 'group', label: dateGroupLabel(d), key: day });
        prevDay = day;
      }
      rows.push({ kind: 'item', item });
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, i18n.language]);

  const thClass = 'px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider';

  return (
    <div className="space-y-3">
      {/* Filter bar — status segments + type/channel/period + search */}
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          size="md"
          ariaLabel={t('alerts.history.status')}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: `${t('alerts.history.statusAll')} ${totalSent + totalFailed}` },
            { value: 'sent', label: `${t('alerts.history.statusSent')} ${totalSent}` },
            { value: 'failed', label: `${t('alerts.history.statusFailed')} ${totalFailed}` },
          ]}
        />

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-2 py-1.5 bg-bg-surface border border-ui-border rounded-md text-sm font-medium text-text-secondary cursor-pointer"
        >
          <option value="all">{t('alerts.history.typeAllOption')}</option>
          <option value="resource">{t('alerts.history.typeResource')}</option>
          <option value="healthcheck">{t('alerts.history.typeHealthcheck')}</option>
          <option value="endpoint">{t('alerts.history.typeEndpoint')}</option>
          <option value="log">{t('alerts.history.typeLog')}</option>
          <option value="scheduled">{t('alerts.history.typeScheduled')}</option>
          <option value="system">{t('alerts.history.typeSystem')}</option>
        </select>

        <select
          value={channelFilter}
          onChange={e => setChannelFilter(e.target.value)}
          className="px-2 py-1.5 bg-bg-surface border border-ui-border rounded-md text-sm font-medium text-text-secondary cursor-pointer"
        >
          <option value="all">{t('alerts.history.channelAll')}</option>
          {channels.map(ch => (
            <option key={ch.id} value={ch.id}>{ch.name}</option>
          ))}
        </select>

        <select
          value={periodDays}
          onChange={e => setPeriodDays(Number(e.target.value) as PeriodDays)}
          className="px-2 py-1.5 bg-bg-surface border border-ui-border rounded-md text-sm font-medium text-text-secondary cursor-pointer"
        >
          <option value={1}>{t('alerts.history.period24h')}</option>
          <option value={7}>{t('alerts.history.period7d')}</option>
          <option value={30}>{t('alerts.history.period30d')}</option>
        </select>

        <div className="ml-auto relative w-64">
          <SearchInput
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('alerts.history.searchPlaceholder')}
            className="pr-7"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700"
              aria-label="Clear"
            >
              <MaterialIcon name="close" className="text-sm" />
            </button>
          )}
        </div>
      </div>

      {/* History Table */}
      <div className="bg-bg-surface rounded-xl border border-ui-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] table-fixed">
            <thead className="bg-ui-hover-soft/40">
              <tr className="border-b border-ui-border">
                <th className={`${thClass} w-[110px]`}>{t('alerts.history.status')}</th>
                <th className={`${thClass} w-[120px]`}>{t('alerts.history.type')}</th>
                <th className={`${thClass} w-[190px]`}>{t('alerts.history.channel')}</th>
                <th className={thClass}>{t('alerts.history.message')}</th>
                <th className={`${thClass} w-[110px]`}>{t('alerts.history.severity')}</th>
                <th className={`${thClass} w-[170px] text-right`}>{t('alerts.history.time')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                    <MaterialIcon name="sync" className="text-4xl animate-spin mx-auto mb-2" />
                    <p>{t('alerts.history.loading')}</p>
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-dim">
                    <MaterialIcon name="inbox" className="text-4xl mx-auto mb-2" />
                    <p className="text-sm">{t('alerts.history.empty')}</p>
                  </td>
                </tr>
              ) : (
                groupedRows.map(row => {
                  if (row.kind === 'group') {
                    return (
                      <tr key={`g-${row.key}`}>
                        <td colSpan={6} className="px-4 py-1.5 border-t border-ui-border-soft/50 bg-ui-hover-soft/30 text-2xs font-bold text-text-muted">
                          {row.label}
                        </td>
                      </tr>
                    );
                  }
                  const { item } = row;
                  const statusMeta = STATUS_META[item.status] ?? STATUS_META.pending;
                  const channelStyle = getChannelStyle(item.channelType);
                  const created = new Date(item.createdAt);
                  const failed = item.status === 'failed';
                  return (
                    <tr
                      key={item.id}
                      className={`border-t border-ui-border-soft/50 transition-colors ${
                        failed
                          ? 'bg-red-50/60 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/15'
                          : 'hover:bg-ui-hover-soft/40'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-sm font-bold capitalize ${statusMeta.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {typeLabel(item.alertType)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${channelStyle.bg}`}>
                            <ChannelIcon type={item.channelType} size={13} className={channelStyle.text} />
                          </div>
                          <span className="truncate text-sm text-text-secondary">{item.channelName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate text-sm text-text-base">{item.message}</p>
                        {item.errorMessage && (
                          <p className="mt-0.5 truncate text-2xs text-red-600 dark:text-red-400">
                            {item.errorMessage}
                            {item.retryCount > 0 && ` · ${t('alerts.history.retried', { count: item.retryCount })}`}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.severity && (
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-2xs font-bold uppercase tracking-wide ${SEVERITY_BADGE[item.severity] ?? SEVERITY_BADGE.info}`}>
                            {item.severity}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-text-muted whitespace-nowrap">
                        {formatDistanceToNow(created, { addSuffix: true, locale: dateLocale })}
                        <span className="text-text-dim"> · {format(created, 'HH:mm')}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between border-t border-ui-border bg-slate-50/60 dark:bg-ui-hover-dark/20 px-4 py-2.5">
            <p className="text-xs text-text-muted">
              {t('alerts.history.pagination', {
                start: (page - 1) * PAGE_SIZE + 1,
                end: Math.min(page * PAGE_SIZE, total),
                total,
              })}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-ui-border text-sm text-text-muted hover:bg-ui-hover disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={t('common.previous', { defaultValue: 'Previous' })}
              >
                ‹
              </button>
              {pageItems(page, totalPages).map((p, i) =>
                p === null ? (
                  <span key={`e-${i}`} className="px-1 text-sm text-text-dim">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-xs font-semibold ${
                      p === page
                        ? 'bg-primary text-white'
                        : 'border border-ui-border text-text-muted hover:bg-ui-hover'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-ui-border text-sm text-text-muted hover:bg-ui-hover disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={t('common.next', { defaultValue: 'Next' })}
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
