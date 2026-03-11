import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/common';
import { IconAlerts } from '../../../components/icons/SidebarIcons';
import { useNotificationChannels } from '../../../hooks/useData';

const CHANNEL_META: Record<string, { icon: string; color: string; bg: string }> = {
  telegram: { icon: 'send', color: 'text-sky-500', bg: 'bg-sky-500/10' },
  discord: { icon: 'sports_esports', color: 'text-violet-500', bg: 'bg-violet-500/10' },
};

export function NotificationChannelStatus() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: channels, loading } = useNotificationChannels();

  const activeCount = (channels || []).filter((c) => c.isEnabled).length;
  const totalCount = (channels || []).length;

  return (
    <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <IconAlerts size={20} className="text-primary" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('dashboard.notifications.title')}
          </h2>
          {!loading && totalCount > 0 && (
            <span className="text-xs font-semibold text-slate-500 dark:text-text-muted-dark bg-slate-100 dark:bg-ui-hover-dark px-2 py-0.5 rounded-full">
              {activeCount}/{totalCount}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/alerts')}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          {t('dashboard.notifications.manage')}
          <MaterialIcon name="arrow_forward" className="text-sm" />
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-ui-hover-dark animate-pulse">
              <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-ui-active-dark" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-28 bg-slate-200 dark:bg-ui-active-dark rounded" />
                <div className="h-2.5 w-16 bg-slate-200 dark:bg-ui-active-dark rounded" />
              </div>
              <div className="h-5 w-14 bg-slate-200 dark:bg-ui-active-dark rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && totalCount === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-ui-hover-dark flex items-center justify-center mb-3">
            <IconAlerts size={24} className="text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-text-muted-dark">
            {t('dashboard.notifications.empty')}
          </p>
          <button
            onClick={() => navigate('/alerts')}
            className="mt-3 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            {t('dashboard.notifications.addChannel')} →
          </button>
        </div>
      )}

      {/* Channel List */}
      {!loading && totalCount > 0 && (
        <div className="space-y-2">
          {(channels || []).map((channel) => {
            const meta = CHANNEL_META[channel.type] ?? { icon: 'notifications', color: 'text-slate-500', bg: 'bg-slate-500/10' };
            return (
              <div
                key={channel.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-ui-hover-dark/60 hover:bg-slate-100 dark:hover:bg-ui-hover-dark transition-colors"
              >
                {/* Icon */}
                <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
                  <MaterialIcon name={meta.icon} className={`text-lg ${meta.color}`} />
                </div>

                {/* Name & Type */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-text-base-dark truncate">
                    {channel.name}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-text-dim-dark capitalize">
                    {channel.type}
                  </p>
                </div>

                {/* Status Badge */}
                {channel.isEnabled ? (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-lime-500/10 text-lime-600 dark:text-lime-400 text-xs font-bold shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-500 animate-pulse" />
                    {t('dashboard.notifications.active')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200 dark:bg-ui-active-dark text-slate-500 dark:text-text-muted-dark text-xs font-bold shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    {t('dashboard.notifications.inactive')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
