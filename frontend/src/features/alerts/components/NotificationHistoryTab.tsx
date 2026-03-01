import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/common';
import { api, NotificationHistory, NotificationHistoryFilter, NotificationStats } from '../../../services/api';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';

export function NotificationHistoryTab() {
  const { t, i18n } = useTranslation();
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
        return <MaterialIcon name="check_circle" className="text-green-500" />;
      case 'failed':
        return <MaterialIcon name="error" className="text-red-500" />;
      case 'pending':
        return <MaterialIcon name="schedule" className="text-yellow-500" />;
      default:
        return <MaterialIcon name="help" className="text-gray-500" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'resource':
        return <MaterialIcon name="memory" className="text-blue-500" />;
      case 'healthcheck':
        return <MaterialIcon name="favorite" className="text-pink-500" />;
      case 'endpoint':
        return <MaterialIcon name="http" className="text-teal-500" />;
      case 'log':
        return <MaterialIcon name="description" className="text-orange-500" />;
      case 'scheduled':
        return <MaterialIcon name="schedule" className="text-purple-500" />;
      case 'system':
        return <MaterialIcon name="power_settings_new" className="text-green-500" />;
      default:
        return <MaterialIcon name="notifications" className="text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity?: string) => {
    if (!severity) return null;

    const colors: Record<string, string> = {
      critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[severity] || colors.info}`}>
        {severity.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-200 dark:border-ui-border-dark">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('alerts.history.totalSent')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalSent}</p>
              </div>
              <MaterialIcon name="send" className="text-3xl text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-200 dark:border-ui-border-dark">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('alerts.history.totalFailed')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalFailed}</p>
              </div>
              <MaterialIcon name="error_outline" className="text-3xl text-red-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-200 dark:border-ui-border-dark">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('alerts.history.successRate')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.successRate.toFixed(1)}%
                </p>
              </div>
              <MaterialIcon name="check_circle" className="text-3xl text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-200 dark:border-ui-border-dark">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('alerts.history.totalNotifications')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalSent + stats.totalFailed}
                </p>
              </div>
              <MaterialIcon name="notifications_active" className="text-3xl text-purple-500" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-bg-surface-dark rounded-lg p-4 shadow-sm border border-gray-200 dark:border-ui-border-dark">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('alerts.history.status')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-ui-border-dark rounded-lg bg-white dark:bg-bg-surface-dark text-gray-900 dark:text-white"
            >
              <option value="all">{t('alerts.history.statusAll')}</option>
              <option value="sent">{t('alerts.history.statusSent')}</option>
              <option value="failed">{t('alerts.history.statusFailed')}</option>
              <option value="pending">{t('alerts.history.statusPending')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('alerts.history.type')}
            </label>
            <select
              value={typeFilter}
              onChange={(e) => handleTypeFilterChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-ui-border-dark rounded-lg bg-white dark:bg-bg-surface-dark text-gray-900 dark:text-white"
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
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-bg-surface-dark hover:bg-slate-200 dark:hover:bg-ui-hover-dark rounded-lg text-sm font-medium transition-all text-slate-900 dark:text-white border border-gray-300 dark:border-ui-border-dark"
          >
            <MaterialIcon name="refresh" className="text-lg" />
            {t('alerts.history.refresh')}
          </button>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-ui-border-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-ui-border-dark">
            <thead className="bg-gray-50 dark:bg-bg-surface-dark">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('alerts.history.status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('alerts.history.type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('alerts.history.channel')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('alerts.history.message')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('alerts.history.severity')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('alerts.history.retryCount')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('alerts.history.time')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-bg-surface-dark divide-y divide-gray-200 dark:divide-ui-border-dark">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <MaterialIcon name="hourglass_empty" className="text-4xl animate-spin mx-auto mb-2" />
                    <p>{t('alerts.history.loading')}</p>
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <MaterialIcon name="inbox" className="text-4xl mx-auto mb-2" />
                    <p>{t('alerts.history.empty')}</p>
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-ui-hover-dark transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.status)}
                        <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                          {item.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(item.alertType)}
                        <span className="text-sm text-gray-900 dark:text-white capitalize">
                          {item.alertType}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <MaterialIcon
                          name={item.channelType === 'discord' ? 'sports_esports' : 'send'}
                          className="text-lg"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {item.channelName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-md">
                        <p className="text-sm text-gray-900 dark:text-white truncate">
                          {item.message}
                        </p>
                        {item.errorMessage && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1 truncate">
                            Error: {item.errorMessage}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getSeverityBadge(item.severity)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {item.retryCount > 0 ? item.retryCount : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
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
          <div className="px-6 py-4 border-t border-gray-200 dark:border-ui-border-dark">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700 dark:text-gray-300">
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
                  className="px-3 py-1 border border-gray-300 dark:border-ui-border-dark rounded disabled:opacity-50 text-sm text-gray-900 dark:text-white"
                >
                  {t('common.previous', { defaultValue: 'Previous' })}
                </button>
                <button
                  onClick={() => setFilter(prev => ({ ...prev, offset: (prev.offset || 0) + 50 }))}
                  disabled={(filter.offset || 0) + 50 >= total}
                  className="px-3 py-1 border border-gray-300 dark:border-ui-border-dark rounded disabled:opacity-50 text-sm text-gray-900 dark:text-white"
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
