import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { Button, MaterialIcon } from '../../../components/common';
import { ChannelIcon } from '../../../components/icons/ChannelIcons';
import { getChannelStyle, getChannelTypeLabel } from '../utils/channelMeta';
import { ChannelHealthMeta } from './ChannelHealthMeta';
import type { NotificationChannel, NotificationChannelHealth, AlertRule, NotificationHistory, NotificationStats } from '../../../services/api';

type MobileTab = 'channels' | 'rules' | 'history';

interface AlertsMobileViewProps {
  channels: NotificationChannel[];
  channelHealth: Record<string, NotificationChannelHealth>;
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

const severityColors: Record<string, { text: string; bg: string }> = {
  critical: { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
  warning: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
  info: { text: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10' },
};

const historyStatusConfig: Record<string, { icon: string; color: string }> = {
  sent: { icon: 'check_circle', color: 'text-emerald-500' },
  failed: { icon: 'error', color: 'text-red-500' },
  pending: { icon: 'schedule', color: 'text-amber-500' },
};

export function AlertsMobileView({
  channels,
  channelHealth,
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-base">{t('alerts.title')}</h1>
          <p className="text-sm text-text-muted mt-0.5">{t('alerts.subtitle')}</p>
        </div>
        {activeTab === 'channels' && (
          <Button size="sm" onClick={onAddChannel}>
            <MaterialIcon name="add" className="text-base" />
            {t('alerts.addChannel')}
          </Button>
        )}
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-bg-surface border border-ui-border rounded-xl p-3">
            <p className="text-sm font-medium text-text-muted truncate">
              {t('alerts.history.stats.successRate', { defaultValue: 'Success' })}
            </p>
            <p className="text-xl font-bold text-text-base">{stats.successRate.toFixed(0)}%</p>
          </div>
          <div className="bg-bg-surface border border-ui-border rounded-xl p-3">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 truncate">
              {t('alerts.history.stats.sent', { defaultValue: 'Sent' })}
            </p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.totalSent}</p>
          </div>
          <div className="bg-bg-surface border border-ui-border rounded-xl p-3">
            <p className="text-sm font-medium text-red-500 truncate">
              {t('alerts.history.stats.failed', { defaultValue: 'Failed' })}
            </p>
            <p className="text-xl font-bold text-red-500">{stats.totalFailed}</p>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div role="tablist" aria-label={t('alerts.title')} className="flex bg-slate-100 dark:bg-bg-surface-dark/50 p-1 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-bg-surface text-text-base shadow-sm'
                : 'text-text-muted'
            }`}
          >
            <MaterialIcon name={tab.icon} className="text-lg" />
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-xs bg-ui-active px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Channels Tab */}
      {activeTab === 'channels' && (
        <div className="space-y-3">
          {isLoading ? (
            [1, 2].map(i => (
              <div key={i} className="h-20 rounded-xl bg-ui-hover animate-pulse" />
            ))
          ) : channels.length === 0 ? (
            <div className="py-8 text-center">
              <MaterialIcon name="notifications_off" className="text-4xl text-text-dim" />
              <p className="text-sm text-text-dim mt-2">
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
              const meta = getChannelStyle(channel.type);
              return (
                <div
                  key={channel.id}
                  className="bg-bg-surface border border-ui-border rounded-xl p-4"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.bg} ${!channel.isEnabled ? 'opacity-50' : ''}`}>
                      <ChannelIcon type={channel.type} size={20} className={meta.text} />
                    </div>
                    <div className={`flex-1 min-w-0 ${!channel.isEnabled ? 'opacity-60' : ''}`}>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-text-base truncate">{channel.name}</p>
                        {!channel.isEnabled && (
                          <span className="px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider bg-ui-active text-text-muted rounded-full shrink-0">
                            {t('common.disabled', { defaultValue: 'Disabled' })}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm font-semibold ${meta.text}`}>{getChannelTypeLabel(channel.type, t)}</p>
                    </div>
                    <button
                      onClick={() => onToggleChannel(channel.id)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${channel.isEnabled ? 'bg-primary' : 'bg-slate-400'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${channel.isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="mb-3 pb-3 border-b border-ui-border-soft/50">
                    <ChannelHealthMeta health={channelHealth[channel.id]} compact />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onTestChannel(channel.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary text-sm font-bold active:scale-95 transition-transform"
                    >
                      <MaterialIcon name="send" className="text-sm" />
                      {t('alerts.test')}
                    </button>
                    <button
                      onClick={() => onEditChannel(channel)}
                      className="flex items-center justify-center p-2 rounded-lg bg-ui-hover text-slate-500 active:scale-95 transition-transform"
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
              <div key={i} className="h-16 rounded-xl bg-ui-hover animate-pulse" />
            ))
          ) : rules.length === 0 ? (
            <div className="py-8 text-center">
              <MaterialIcon name="rule" className="text-4xl text-text-dim" />
              <p className="text-sm text-text-dim mt-2">
                {t('alerts.rules.empty', { defaultValue: 'No alert rules configured' })}
              </p>
            </div>
          ) : (
            rules.map(rule => {
              const sev = severityColors[rule.severity] ?? severityColors.info;
              return (
                <div
                  key={rule.id}
                  className={`bg-bg-surface border border-ui-border rounded-xl p-4 ${!rule.isEnabled ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${sev.bg} flex items-center justify-center shrink-0`}>
                      <span className={`text-xs font-bold ${sev.text}`}>
                        {rule.metric?.toUpperCase().slice(0, 3)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-text-base truncate">{rule.name}</p>
                      <p className="text-sm text-text-muted capitalize">
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
              <div key={i} className="h-16 rounded-xl bg-ui-hover animate-pulse" />
            ))
          ) : history.length === 0 ? (
            <div className="py-8 text-center">
              <MaterialIcon name="history" className="text-4xl text-text-dim" />
              <p className="text-sm text-text-dim mt-2">
                {t('alerts.history.empty', { defaultValue: 'No notification history' })}
              </p>
            </div>
          ) : (
            history.map(item => {
              const statusConf = historyStatusConfig[item.status] ?? historyStatusConfig.pending;
              return (
                <div
                  key={item.id}
                  className="bg-bg-surface border border-ui-border rounded-xl p-3"
                >
                  <div className="flex items-start gap-3">
                    <MaterialIcon name={statusConf.icon} className={`text-lg mt-0.5 shrink-0 ${statusConf.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-base truncate">
                        {item.hostName || item.serviceName || item.channelName}
                      </p>
                      <p className="text-sm text-text-muted truncate mt-0.5">
                        {item.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-text-dim">
                          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: dateLocale })}
                        </span>
                        <span className="text-sm capitalize text-text-dim">
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
