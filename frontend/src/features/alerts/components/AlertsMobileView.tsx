import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { MaterialIcon } from '../../../components/common';
import { ChannelIcon } from '../../../components/icons/ChannelIcons';
import type { NotificationChannel, AlertRule, NotificationHistory, NotificationStats } from '../../../services/api';

type MobileTab = 'channels' | 'rules' | 'history';

interface AlertsMobileViewProps {
  channels: NotificationChannel[];
  rules: AlertRule[];
  history: NotificationHistory[];
  stats: NotificationStats | null;
  isLoading: boolean;
  rulesLoading: boolean;
  historyLoading: boolean;
  activeTab: MobileTab;
  setActiveTab: (tab: MobileTab) => void;
  onAddChannel: () => void;
  onEditChannel: (channel: NotificationChannel) => void;
  onDeleteChannel: (id: string) => void;
  onToggleChannel: (id: string) => void;
  onTestChannel: (id: string) => void;
}

const channelColors: Record<string, { color: string; bg: string }> = {
  telegram: { color: 'text-sky-500', bg: 'bg-sky-500/10' },
  discord: { color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  slack: { color: 'text-purple-500', bg: 'bg-purple-500/10' },
};

const severityColors: Record<string, { text: string; bg: string }> = {
  critical: { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
  warning: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
  info: { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
};

const historyStatusConfig: Record<string, { icon: string; color: string }> = {
  sent: { icon: 'check_circle', color: 'text-emerald-500' },
  failed: { icon: 'error', color: 'text-red-500' },
  pending: { icon: 'schedule', color: 'text-amber-500' },
};

export function AlertsMobileView({
  channels,
  rules,
  history,
  stats,
  isLoading,
  rulesLoading,
  historyLoading,
  activeTab,
  setActiveTab,
  onAddChannel,
  onEditChannel,
  onDeleteChannel,
  onToggleChannel,
  onTestChannel,
}: AlertsMobileViewProps) {
  const { t, i18n } = useTranslation(['alerts', 'common']);
  const dateLocale = i18n.language === 'ko' ? ko : enUS;

  const tabs: { key: MobileTab; label: string; icon: string; count?: number }[] = [
    { key: 'channels', label: t('alerts.channelsTitle'), icon: 'notifications', count: channels.length },
    { key: 'rules', label: t('alerts.rulesTitle'), icon: 'rule', count: rules.length },
    { key: 'history', label: t('alerts.history.title'), icon: 'history' },
  ];

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      {stats && (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          <div className="shrink-0 flex-1 min-w-[100px] bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-3">
            <p className="text-xs font-medium text-slate-500 dark:text-text-muted-dark">
              {t('alerts.history.stats.successRate', { defaultValue: 'Success' })}
            </p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.successRate.toFixed(0)}%</p>
          </div>
          <div className="shrink-0 flex-1 min-w-[100px] bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-3">
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {t('alerts.history.stats.sent', { defaultValue: 'Sent' })}
            </p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.totalSent}</p>
          </div>
          <div className="shrink-0 flex-1 min-w-[100px] bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-3">
            <p className="text-xs font-medium text-red-500">
              {t('alerts.history.stats.failed', { defaultValue: 'Failed' })}
            </p>
            <p className="text-xl font-bold text-red-500">{stats.totalFailed}</p>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex bg-slate-100 dark:bg-bg-surface-dark/50 p-1 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-white dark:bg-bg-surface-dark text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-text-muted-dark'
            }`}
          >
            <MaterialIcon name={tab.icon} className="text-sm" />
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-xs bg-slate-200 dark:bg-ui-active-dark px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Channels Tab */}
      {activeTab === 'channels' && (
        <div className="space-y-3">
          <button
            onClick={onAddChannel}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-ui-border-dark text-primary font-bold text-sm active:scale-95 transition-transform"
          >
            <MaterialIcon name="add_circle" className="text-lg" />
            {t('alerts.addChannel')}
          </button>

          {isLoading ? (
            [1, 2].map(i => (
              <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
            ))
          ) : channels.length === 0 ? (
            <div className="py-8 text-center">
              <MaterialIcon name="notifications_off" className="text-4xl text-slate-300 dark:text-text-dim-dark" />
              <p className="text-sm text-slate-400 dark:text-text-muted-dark mt-2">
                {t('alerts.noChannels')}
              </p>
              <button
                onClick={onAddChannel}
                className="mt-3 text-sm font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
              >
                {t('alerts.addChannel')} →
              </button>
            </div>
          ) : (
            channels.map(channel => {
              const meta = channelColors[channel.type] ?? channelColors.discord;
              return (
                <div
                  key={channel.id}
                  className={`bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-4 ${!channel.isEnabled ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.bg}`}>
                      <ChannelIcon type={channel.type} size={20} className={meta.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{channel.name}</p>
                      <p className={`text-xs font-semibold capitalize ${meta.color}`}>{channel.type}</p>
                    </div>
                    <button
                      onClick={() => onToggleChannel(channel.id)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${channel.isEnabled ? 'bg-primary' : 'bg-slate-400'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${channel.isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onTestChannel(channel.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary text-xs font-bold active:scale-95 transition-transform"
                    >
                      <MaterialIcon name="send" className="text-sm" />
                      {t('alerts.test')}
                    </button>
                    <button
                      onClick={() => onEditChannel(channel)}
                      className="flex items-center justify-center p-2 rounded-lg bg-slate-100 dark:bg-ui-hover-dark text-slate-500 active:scale-95 transition-transform"
                    >
                      <MaterialIcon name="edit" className="text-base" />
                    </button>
                    <button
                      onClick={() => onDeleteChannel(channel.id)}
                      className="flex items-center justify-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 active:scale-95 transition-transform"
                    >
                      <MaterialIcon name="delete" className="text-base" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-2">
          {rulesLoading ? (
            [1, 2].map(i => (
              <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
            ))
          ) : rules.length === 0 ? (
            <div className="py-8 text-center">
              <MaterialIcon name="rule" className="text-4xl text-slate-300 dark:text-text-dim-dark" />
              <p className="text-sm text-slate-400 dark:text-text-muted-dark mt-2">
                {t('alerts.rules.empty', { defaultValue: 'No alert rules configured' })}
              </p>
            </div>
          ) : (
            rules.map(rule => {
              const sev = severityColors[rule.severity] ?? severityColors.info;
              return (
                <div
                  key={rule.id}
                  className={`bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-4 ${!rule.isEnabled ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${sev.bg} flex items-center justify-center shrink-0`}>
                      <span className={`text-xs font-bold ${sev.text}`}>
                        {rule.metric?.toUpperCase().slice(0, 3)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{rule.name}</p>
                      <p className="text-xs text-slate-500 dark:text-text-muted-dark capitalize">
                        {rule.severity} · {rule.metric} {rule.operator} {rule.threshold}
                      </p>
                    </div>
                    {rule.isEnabled ? (
                      <span className="w-2 h-2 rounded-full bg-lime-500 shrink-0" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-2">
          {historyLoading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
            ))
          ) : history.length === 0 ? (
            <div className="py-8 text-center">
              <MaterialIcon name="history" className="text-4xl text-slate-300 dark:text-text-dim-dark" />
              <p className="text-sm text-slate-400 dark:text-text-muted-dark mt-2">
                {t('alerts.history.empty', { defaultValue: 'No notification history' })}
              </p>
            </div>
          ) : (
            history.map(item => {
              const statusConf = historyStatusConfig[item.status] ?? historyStatusConfig.pending;
              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-3"
                >
                  <div className="flex items-start gap-3">
                    <MaterialIcon name={statusConf.icon} className={`text-lg mt-0.5 shrink-0 ${statusConf.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-text-base-dark truncate">
                        {item.hostName || item.serviceName || item.channelName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-text-muted-dark truncate mt-0.5">
                        {item.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400 dark:text-text-dim-dark">
                          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: dateLocale })}
                        </span>
                        <span className="text-xs capitalize text-slate-400 dark:text-text-dim-dark">
                          {item.channelType}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
