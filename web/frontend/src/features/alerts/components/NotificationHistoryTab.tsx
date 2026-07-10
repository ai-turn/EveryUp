import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { KPIChip, MaterialIcon } from '../../../components/common';
import { ChannelIcon } from '../../../components/icons/ChannelIcons';
import { api, NotificationHistory, NotificationHistoryFilter, NotificationStats } from '../../../services/api';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';

export function NotificationHistoryTab() {
  const { t, i18n } = useTranslation(['alerts', 'common']);
  const [history, setHistory] = useState<NotificationHistory[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NotificationHistoryFilter>({
    limit: 50,
    offset: 0,
  });

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const dateLocale = i18n.language === 'ko' ? ko : enUS;

  useEffect(() => {
    loadHistory();
    loadStats();
  }, [filter]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await api.getNotificationHistory(filter);
      setHistory(response.items || []);
      setTotal(response.total || 0);
    } catch (error) {
      console.error('Failed to load notification history:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await api.getNotificationHistoryStats(7);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setFilter(prev => ({
      ...prev,
      status: status === 'all' ? undefined : status,
      offset: 0,
    }));
  };

  const handleTypeFilterChange = (type: string) => {
    setTypeFilter(type);
    setFilter(prev => ({
      ...prev,
      alert_type: type === 'all' ? undefined : type,
      offset: 0,
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <MaterialIcon name="check_circle" className="text-emerald-500" />;
      case 'failed':
        return <MaterialIcon name="error" className="text-red-500" />;
      case 'pending':
        return <MaterialIcon name="schedule" className="text-amber-500" />;
      default:
        return <MaterialIcon name="help" className="text-slate-400" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'resource':
        return <MaterialIcon name="memory" className="text-sky-500" />;
      case 'healthcheck':
        return <MaterialIcon name="favorite" className="text-pink-500" />;
      case 'endpoint':
        return <MaterialIcon name="http" className="text-teal-500" />;
      case 'log':
        return <MaterialIcon name="description" className="text-orange-500" />;
      case 'scheduled':
        return <MaterialIcon name="schedule" className="text-violet-500" />;
      case 'system':
        return <MaterialIcon name="power_settings_new" className="text-emerald-500" />;
      default:
        return <MaterialIcon name="notifications" className="text-slate-400" />;
    }
  };

  const getSeverityBadge = (severity?: string) => {
    if (!severity) return null;

    const colors: Record<string, string> = {
      critical: 'bg-red-500/10 text-red-500 dark:text-red-400',
      warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      info: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[severity] || colors.info}`}>
        {severity.toUpperCase()}
      </span>
    );
  };

  const thClass = 'px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-text-muted-dark uppercase tracking-wider';

  return (
    <div className="space-y-5">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIChip label={t('alerts.history.totalSent')} value={stats.totalSent} tone="emerald" icon="send" />
          <KPIChip label={t('alerts.history.totalFailed')} value={stats.totalFailed} tone="red" icon="error_outline" />
          <KPIChip label={t('alerts.history.successRate')} value={`${stats.successRate.toFixed(1)}%`} tone="primary" icon="check_circle" />
          <KPIChip
            label={t('alerts.history.totalNotifications')}
            value={stats.totalSent + stats.totalFailed}
            tone="slate"
            icon="notifications_active"
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-bg-surface-dark rounded-xl p-4 border border-slate-200 dark:border-ui-border-dark">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark mb-2">
              {t('alerts.history.status')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-ui-border-dark rounded-lg bg-white dark:bg-bg-surface-dark text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">{t('alerts.history.statusAll')}</option>
              <option value="sent">{t('alerts.history.statusSent')}</option>
              <option value="failed">{t('alerts.history.statusFailed')}</option>
              <option value="pending">{t('alerts.history.statusPending')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark mb-2">
              {t('alerts.history.type')}
            </label>
            <select
              value={typeFilter}
              onChange={(e) => handleTypeFilterChange(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-ui-border-dark rounded-lg bg-white dark:bg-bg-surface-dark text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">{t('alerts.history.typeAll')}</option>
              <option value="resource">{t('alerts.history.typeResource')}</option>
              <option value="healthcheck">{t('alerts.history.typeHealthcheck')}</option>
              <option value="endpoint">{t('alerts.history.typeEndpoint')}</option>
              <option value="log">{t('alerts.history.typeLog')}</option>
              <option value="scheduled">{t('alerts.history.typeScheduled')}</option>
              <option value="system">{t('alerts.history.typeSystem')}</option>
            </select>
          </div>

          <button
            onClick={loadHistory}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-ui-border-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark rounded-lg text-sm font-medium transition-all text-slate-600 dark:text-text-muted-dark"
          >
            <MaterialIcon name="refresh" className="text-lg" />
            {t('alerts.history.refresh')}
          </button>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-bg-surface-dark rounded-xl border border-slate-200 dark:border-ui-border-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-ui-border-dark">
            <thead className="bg-slate-50 dark:bg-bg-surface-dark">
              <tr>
                <th className={thClass}>{t('alerts.history.status')}</th>
                <th className={thClass}>{t('alerts.history.type')}</th>
                <th className={thClass}>{t('alerts.history.channel')}</th>
                <th className={thClass}>{t('alerts.history.message')}</th>
                <th className={thClass}>{t('alerts.history.severity')}</th>
                <th className={thClass}>{t('alerts.history.retryCount')}</th>
                <th className={thClass}>{t('alerts.history.time')}</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-bg-surface-dark divide-y divide-slate-200 dark:divide-ui-border-dark">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-text-muted-dark">
                    <MaterialIcon name="sync" className="text-4xl animate-spin mx-auto mb-2" />
                    <p>{t('alerts.history.loading')}</p>
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 dark:text-text-muted-dark">
                    <MaterialIcon name="inbox" className="text-4xl mx-auto mb-2" />
                    <p className="text-sm">{t('alerts.history.empty')}</p>
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.status)}
                        <span className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                          {item.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(item.alertType)}
                        <span className="text-sm text-slate-900 dark:text-white capitalize">
                          {item.alertType}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <ChannelIcon type={item.channelType} size={18} className="text-slate-500 dark:text-text-muted-dark" />
                        <span className="text-sm text-slate-900 dark:text-white">
                          {item.channelName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-md">
                        <p className="text-sm text-slate-900 dark:text-white truncate">
                          {item.message}
                        </p>
                        {item.errorMessage && (
                          <p className="text-sm text-red-600 dark:text-red-400 mt-1 truncate">
                            Error: {item.errorMessage}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getSeverityBadge(item.severity)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-900 dark:text-white">
                        {item.retryCount > 0 ? item.retryCount : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-text-muted-dark">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: dateLocale })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 50 && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-ui-border-dark">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600 dark:text-text-muted-dark">
                {t('alerts.history.pagination', {
                  start: (filter.offset || 0) + 1,
                  end: Math.min((filter.offset || 0) + (filter.limit || 50), total),
                  total
                })}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter(prev => ({ ...prev, offset: Math.max(0, (prev.offset || 0) - 50) }))}
                  disabled={(filter.offset || 0) === 0}
                  className="px-3 py-1 border border-slate-200 dark:border-ui-border-dark rounded-lg disabled:opacity-50 text-sm text-slate-600 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark"
                >
                  {t('common.previous', { defaultValue: 'Previous' })}
                </button>
                <button
                  onClick={() => setFilter(prev => ({ ...prev, offset: (prev.offset || 0) + 50 }))}
                  disabled={(filter.offset || 0) + 50 >= total}
                  className="px-3 py-1 border border-slate-200 dark:border-ui-border-dark rounded-lg disabled:opacity-50 text-sm text-slate-600 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark"
                >
                  {t('common.next', { defaultValue: 'Next' })}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
